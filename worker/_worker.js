// Cloudflare Pages _worker.js — APK Builder.
//
// The Next.js app is a static export (`output: 'export'`), so it cannot ship
// API routes: `next build` refuses any dynamic route handler with static
// export. This worker is therefore the production server for the API routes
// the frontend calls, and serves everything else from the static export via
// the ASSETS binding.
//
// What the app actually does (honest version): it does NOT compile Android
// apps itself. It turns the user's inputs into a Cordova project, pushes
// that project into a (new or existing) GitHub repository with the user's
// own Personal Access Token, and dispatches a GitHub Actions workflow
// (public/cordova-template/build-apk.yml) that runs `cordova build android`
// on GitHub's runners. The APK comes back as a workflow artifact.
//
// THE BUG THIS FILE FIXES: the frontend has always called POST /api/build,
// but no such route ever existed in the repo — only /api/download did.
// Next.js answered 404, so no build could ever start. /api/build exists
// now, as SSE, matching the event format the frontend already parses.
//
// Token handling (see docs/security.md): the user's PAT is sent by the
// browser, forwarded only to api.github.com, and never stored or logged
// anywhere on this server. It is also kept in the browser's own IndexedDB
// by the frontend (pre-existing product behaviour) so the user does not
// have to retype it.

const GH = "https://api.github.com";
const WORKFLOW_PATH = ".github/workflows/build-apk.yml";
const WORKFLOW_FILE = "build-apk.yml";

const ICON_DENSITIES = [
  "res/icon/android/icon-36-ldpi.png",
  "res/icon/android/icon-48-mdpi.png",
  "res/icon/android/icon-72-hdpi.png",
  "res/icon/android/icon-96-xhdpi.png",
  "res/icon/android/icon-144-xxhdpi.png",
  "res/icon/android/icon-192-xxxhdpi.png",
];

const PACKAGE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const USER_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
const REPO_RE = /^[a-zA-Z0-9._-]+$/;
const DATA_URL_RE = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/;

// ---------------------------------------------------------------------------
// Validation (pure — unit-tested). Returns an error string or null.
// ---------------------------------------------------------------------------
export function validateBuildInput(body) {
  if (!body || typeof body !== "object") return "Body harus JSON.";
  const { appName, packageName, url, githubUsername, githubToken, repoName, iconBase64 } = body;
  if (!appName || typeof appName !== "string" || !appName.trim())
    return "App Name wajib diisi.";
  if (appName.trim().length > 100) return "App Name maksimal 100 karakter.";
  if (!packageName || typeof packageName !== "string" || !PACKAGE_RE.test(packageName.trim()))
    return "Package Name tidak valid — contoh yang benar: com.example.aplikasiku.";
  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url.trim()))
    return "Target URL wajib diawali http:// atau https://.";
  if (!githubUsername || typeof githubUsername !== "string" || !USER_RE.test(githubUsername.trim()))
    return "GitHub Username tidak valid.";
  if (!githubToken || typeof githubToken !== "string" || !githubToken.trim())
    return "Personal Access Token wajib diisi.";
  if (!repoName || typeof repoName !== "string" || !REPO_RE.test(repoName.trim()) || repoName.trim().length > 100)
    return "Repository Name tidak valid (huruf, angka, titik, _ , -).";
  if (iconBase64) {
    const m = DATA_URL_RE.exec(String(iconBase64));
    if (!m) return "Ikon harus berupa gambar PNG atau JPG.";
    if (m[2].length > 1_400_000) return "Ikon terlalu besar (maksimal ~1 MB).";
  }
  return null;
}

export function validateDownloadParams(q) {
  for (const k of ["user", "repo", "artifact", "token"]) {
    if (!q.get(k)) return `Parameter ${k} wajib diisi.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "apk-builder-pages-worker/1.1.0",
  };
}

async function gh(path, token, init = {}) {
  const res = await fetch(`${GH}${path}`, {
    ...init,
    headers: { ...ghHeaders(token), ...(init.headers || {}) },
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body (e.g. 204) */
  }
  return { status: res.status, ok: res.ok, data };
}

function ghErrorMessage(status, data) {
  const msg = data && data.message ? data.message : `GitHub API error ${status}`;
  if (status === 401) return `Token GitHub ditolak (401): ${msg}. Periksa token di Settings.`;
  if (status === 403) return `GitHub menolak permintaan (403): ${msg}. Token butuh scope repo + workflow, dan periksa rate limit.`;
  if (status === 404) return `Tidak ditemukan di GitHub (404): ${msg}.`;
  if (status === 422) return `GitHub menolak data (422): ${msg}.`;
  return `GitHub API error ${status}: ${msg}`;
}

// Read one template file out of the static export through the ASSETS binding.
async function readTemplate(env, request, name) {
  const url = new URL(`/cordova-template/${name}`, request.url);
  const res = await env.ASSETS.fetch(new Request(url));
  if (!res.ok) throw new Error(`Template ${name} tidak ditemukan di server (${res.status}).`);
  return await res.text();
}

function fillTemplate(text, vars) {
  return text
    .replaceAll("__APP_NAME__", vars.appName)
    .replaceAll("__PACKAGE_NAME__", vars.packageName)
    .replaceAll("__TARGET_URL__", vars.url);
}

// PUT one file via the Contents API (create, or update when it exists).
async function putFile(token, user, repo, path, contentB64, message) {
  const existing = await gh(`/repos/${user}/${repo}/contents/${path}?ref=main`, token);
  const payload = { message, content: contentB64, branch: "main" };
  if (existing.ok && existing.data && existing.data.sha) payload.sha = existing.data.sha;
  const res = await gh(`/repos/${user}/${repo}/contents/${path}`, token, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(ghErrorMessage(res.status, res.data) + ` [file: ${path}]`);
  return res.data;
}

// SSE satu-event (untuk error yang terjadi SEBELUM stream dimulai —
// di sini status HTTP bisa 400 karena belum ada pesan yang terkirim).
function sseErrorResponse(message, status = 200) {
  return new Response(`data: ${JSON.stringify({ error: message })}\n\n`, {
    status,
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache" },
  });
}

// ---------------------------------------------------------------------------
// POST /api/build — SSE stream.
// ---------------------------------------------------------------------------
async function handleBuild(request, env) {
  // Validasi lebih dulu: gagal di sini -> 400 + SSE error (belum ada stream).
  let body;
  try {
    body = await request.json();
  } catch {
    return sseErrorResponse("Body harus JSON.", 400);
  }
  const inputError = validateBuildInput(body);
  if (inputError) return sseErrorResponse(inputError, 400);

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const enc = new TextEncoder();
  const send = async (obj) => {
    await writer.write(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
  };
  const fail = async (message) => {
    await send({ error: message });
    await writer.close();
  };

  (async () => {
    try {
      const appName = body.appName.trim();
      const packageName = body.packageName.trim();
      const url = body.url.trim();
      const user = body.githubUsername.trim();
      const token = body.githubToken.trim();
      const repo = body.repoName.trim();
      const vars = { appName, packageName, url };

      await send({ message: "> Initializing Build Environment..." });
      await send({ message: `> App: ${appName} (${packageName})` });
      await send({ message: `> Target URL: ${url}` });

      // 1. Repo: pakai yang sudah ada, atau buat baru (privat).
      await send({ message: `> Checking repository ${user}/${repo}...` });
      const repoCheck = await gh(`/repos/${user}/${repo}`, token);
      if (repoCheck.status === 404) {
        await send({ message: "> Repository not found — creating a new private repository..." });
        const created = await gh("/user/repos", token, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: repo,
            private: true,
            description: `${appName} — Android app generated by APK Builder (Cordova + GitHub Actions).`,
          }),
        });
        if (!created.ok) return await fail(ghErrorMessage(created.status, created.data));
        await send({ message: `✓ Repository ${user}/${repo} created.` });
      } else if (!repoCheck.ok) {
        return await fail(ghErrorMessage(repoCheck.status, repoCheck.data));
      } else {
        await send({ message: `✓ Repository ${user}/${repo} exists — reusing it.` });
      }

      // 2. Push file proyek Cordova (template + placeholder terisi).
      await send({ message: "> Generating Cordova project files..." });
      const templates = [
        { name: "config.xml", path: "config.xml" },
        { name: "package.json", path: "package.json" },
        { name: "www/index.html", path: "www/index.html" },
        { name: "build-apk.yml", path: WORKFLOW_PATH },
      ];
      for (const t of templates) {
        const text = fillTemplate(await readTemplate(env, request, t.name), vars);
        await putFile(token, user, repo, t.path, b64encode(text), `apk-builder: ${t.path}`);
        await send({ message: `✓ Pushed ${t.path}` });
      }

      // Ikon (opsional): satu gambar yang sama untuk semua densitas.
      if (body.iconBase64) {
        const m = DATA_URL_RE.exec(String(body.iconBase64));
        await send({ message: "> Uploading app icon..." });
        for (const p of ICON_DENSITIES) {
          await putFile(token, user, repo, p, m[2], "apk-builder: app icon");
        }
        await send({ message: "✓ Icon uploaded (all densities)." });
      }

      // 3. Dispatch workflow build-apk.yml.
      await send({ message: "> Dispatching GitHub Actions workflow (build-apk.yml)..." });
      const dispatch = await gh(
        `/repos/${user}/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
        token,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ref: "main" }),
        },
      );
      if (!dispatch.ok) return await fail(ghErrorMessage(dispatch.status, dispatch.data));
      await send({ message: "✓ Workflow dispatched." });

      // 4. Ambil run terbaru supaya frontend bisa menautkan ke halaman Actions.
      const runs = await gh(
        `/repos/${user}/${repo}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=1`,
        token,
      );
      const run = runs.ok && runs.data && runs.data.workflow_runs && runs.data.workflow_runs[0];
      const actionsUrl = `https://github.com/${user}/${repo}/actions`;
      await send({ message: "> Build berjalan di GitHub Actions (biasanya 2–5 menit)." });
      await send({ message: "> APK muncul sebagai artifact saat run selesai — tekan “Cek APK” di bawah." });
      await send({
        done: true,
        actionsUrl,
        runId: run ? run.id : null,
        runUrl: run ? run.html_url : actionsUrl,
        repo: `${user}/${repo}`,
      });
      await writer.close();
    } catch (e) {
      await fail(`ERROR: ${e && e.message ? e.message : String(e)}`);
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}

// ---------------------------------------------------------------------------
// GET /api/artifact?user&repo&token — cari artifact APK run sukses terakhir.
// ---------------------------------------------------------------------------
async function handleArtifact(request) {
  const q = new URL(request.url).searchParams;
  for (const k of ["user", "repo", "token"]) {
    if (!q.get(k)) return json({ success: false, error: `Parameter ${k} wajib diisi.` }, 400);
  }
  const user = q.get("user");
  const repo = q.get("repo");
  const token = q.get("token");

  const runs = await gh(
    `/repos/${user}/${repo}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=1`,
    token,
  );
  if (!runs.ok) return json({ success: false, error: ghErrorMessage(runs.status, runs.data) }, runs.status);
  const run = runs.data && runs.data.workflow_runs && runs.data.workflow_runs[0];
  if (!run) {
    return json({ success: true, found: false, status: "no-run", actionsUrl: `https://github.com/${user}/${repo}/actions` });
  }
  if (run.status !== "completed") {
    return json({ success: true, found: false, status: run.status, runId: run.id, runUrl: run.html_url });
  }
  if (run.conclusion !== "success") {
    return json({
      success: true, found: false, status: "completed", conclusion: run.conclusion,
      runId: run.id, runUrl: run.html_url,
    });
  }
  const arts = await gh(`/repos/${user}/${repo}/actions/runs/${run.id}/artifacts`, token);
  if (!arts.ok) return json({ success: false, error: ghErrorMessage(arts.status, arts.data) }, arts.status);
  const artifact = (arts.data.artifacts || []).find((a) => a.name === "apk") || (arts.data.artifacts || [])[0];
  if (!artifact) {
    return json({ success: true, found: false, status: "completed", conclusion: "success", runId: run.id, runUrl: run.html_url });
  }
  const params = new URLSearchParams({ user, repo, artifact: String(artifact.id), token });
  return json({
    success: true,
    found: true,
    status: "completed",
    conclusion: "success",
    runId: run.id,
    runUrl: run.html_url,
    artifact: { id: artifact.id, name: artifact.name, sizeInBytes: artifact.size_in_bytes, expired: artifact.expired },
    downloadUrl: `/api/download?${params.toString()}`,
  });
}

// ---------------------------------------------------------------------------
// GET /api/download?user&repo&artifact&token — proxy unduhan artifact (zip).
// Port dari app/api/download/route.ts lama (dihapus saat static export).
// GitHub menjawab 302 ke blob storage; fetch manual-redirect lalu stream.
// ---------------------------------------------------------------------------
async function handleDownload(request) {
  const q = new URL(request.url).searchParams;
  const err = validateDownloadParams(q);
  if (err) return new Response(err, { status: 400 });
  const user = q.get("user");
  const repo = q.get("repo");
  const artifact = q.get("artifact");
  const token = q.get("token");

  const response = await fetch(`${GH}/repos/${user}/${repo}/actions/artifacts/${artifact}/zip`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "apk-builder-pages-worker/1.1.0",
    },
    redirect: "manual",
  });

  if (response.status === 302 || response.status === 301) {
    const location = response.headers.get("location");
    if (!location) return new Response("Failed to download artifact", { status: 502 });
    const s3 = await fetch(location);
    if (!s3.ok) return new Response(`Storage error: ${s3.status}`, { status: s3.status });
    return new Response(s3.body, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${repo}-apk.zip"`,
      },
    });
  }
  if (response.ok) {
    return new Response(response.body, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${repo}-apk.zip"`,
      },
    });
  }
  return new Response("Failed to download artifact", { status: response.status });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const handler = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/build") {
      if (request.method !== "POST") return json({ success: false, error: "Method harus POST." }, 405);
      return handleBuild(request, env);
    }
    if (url.pathname === "/api/artifact") {
      if (request.method !== "GET") return json({ success: false, error: "Method harus GET." }, 405);
      return handleArtifact(request);
    }
    if (url.pathname === "/api/download") {
      if (request.method !== "GET") return json({ success: false, error: "Method harus GET." }, 405);
      return handleDownload(request);
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  },
};

export default handler;
