// Unit test Pages Worker (worker/_worker.js) — dijalankan tanpa network:
// semua panggilan api.github.com di-mock lewat global fetch.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import worker, { validateBuildInput, validateDownloadParams } from "../worker/_worker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TPL = path.join(__dirname, "..", "public", "cordova-template");

const fakeAssets = {
  async fetch(req) {
    const url = new URL(req.url);
    const name = url.pathname.replace("/cordova-template/", "");
    const file = path.join(TPL, name);
    if (!fs.existsSync(file)) return new Response("missing", { status: 404 });
    return new Response(fs.readFileSync(file, "utf8"));
  },
};
const env = { ASSETS: fakeAssets };

const validBody = {
  appName: "My Awesome App",
  packageName: "com.my.app",
  url: "https://example.com",
  githubUsername: "octocat",
  githubToken: "ghp_testtoken123",
  repoName: "my-apk-repo",
  iconBase64: "",
};

// --- Validasi murni ---------------------------------------------------------

test("validateBuildInput: input valid lolos", () => {
  assert.equal(validateBuildInput(validBody), null);
});

test("validateBuildInput: package name tanpa titik ditolak", () => {
  assert.match(validateBuildInput({ ...validBody, packageName: "myapp" }), /Package Name/);
});

test("validateBuildInput: package name huruf besar ditolak", () => {
  assert.match(validateBuildInput({ ...validBody, packageName: "Com.My.App" }), /Package Name/);
});

test("validateBuildInput: URL tanpa skema ditolak", () => {
  assert.match(validateBuildInput({ ...validBody, url: "example.com" }), /Target URL/);
});

test("validateBuildInput: token kosong ditolak", () => {
  assert.match(validateBuildInput({ ...validBody, githubToken: "  " }), /Token/);
});

test("validateBuildInput: username GitHub tidak valid ditolak", () => {
  assert.match(validateBuildInput({ ...validBody, githubUsername: "-bad-" }), /Username/);
});

test("validateBuildInput: ikon bukan PNG/JPG ditolak", () => {
  assert.match(
    validateBuildInput({ ...validBody, iconBase64: "data:image/gif;base64,AAAA" }),
    /PNG atau JPG/,
  );
});

test("validateDownloadParams: parameter kurang ditolak", () => {
  const q = new URLSearchParams({ user: "a", repo: "b" });
  assert.match(validateDownloadParams(q), /artifact/);
});

// --- Mock fetch GitHub ------------------------------------------------------

function mockFetch(routes) {
  // routes: array [method+path-prefix, handler(url) -> {status, json}]
  const calls = [];
  const fn = async (url, init = {}) => {
    const method = (init.method || "GET").toUpperCase();
    calls.push(`${method} ${url}`);
    for (const [prefix, handler] of routes) {
      if (`${method} ${url}`.startsWith(prefix)) {
        const r = handler(url, init);
        // 204 tidak boleh membawa body (Response constructor menolak).
        const body = r.json === null || r.json === undefined ? null : JSON.stringify(r.json);
        return new Response(body, {
          status: r.status,
          headers: r.headers || { "content-type": "application/json" },
        });
      }
    }
    return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
  };
  fn.calls = calls;
  return fn;
}

async function readSse(res) {
  const text = await res.text();
  return text
    .split("\n")
    .filter((l) => l.startsWith("data: "))
    .map((l) => JSON.parse(l.slice(6)));
}

test("POST /api/build: body bukan JSON -> 400 + SSE error", async () => {
  const res = await worker.fetch(
    new Request("http://x/api/build", { method: "POST", body: "bukan-json{" }),
    env,
  );
  assert.equal(res.status, 400);
  assert.equal(res.headers.get("content-type").includes("text/event-stream"), true);
  const events = await readSse(res);
  assert.match(events[0].error, /JSON/);
});

test("POST /api/build: input tidak valid -> 400 + SSE error, tanpa panggilan GitHub", async () => {
  const fetchMock = mockFetch([]);
  const orig = globalThis.fetch;
  globalThis.fetch = fetchMock;
  try {
    const res = await worker.fetch(
      new Request("http://x/api/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...validBody, packageName: "salah" }),
      }),
      env,
    );
    assert.equal(res.status, 400);
    const events = await readSse(res);
    assert.match(events[0].error, /Package Name/);
    assert.equal(fetchMock.calls.length, 0);
  } finally {
    globalThis.fetch = orig;
  }
});

test("POST /api/build: alur penuh repo-baru -> dispatch -> done", async () => {
  const fetchMock = mockFetch([
    // Urutan penting: prefix dicocokkan berurutan, jadi rute spesifik
    // (runs, contents) harus SEBELUM prefix repo yang menelan semuanya.
    ["GET https://api.github.com/repos/octocat/my-apk-repo/actions/workflows/build-apk.yml/runs", () => ({
      status: 200,
      json: { workflow_runs: [{ id: 42, html_url: "https://github.com/octocat/my-apk-repo/actions/runs/42" }] },
    })],
    ["POST https://api.github.com/repos/octocat/my-apk-repo/actions/workflows/build-apk.yml/dispatches", () => ({ status: 204, json: null })],
    ["GET https://api.github.com/repos/octocat/my-apk-repo/contents/", () => ({ status: 404, json: { message: "Not Found" } })],
    ["PUT https://api.github.com/repos/octocat/my-apk-repo/contents/", () => ({ status: 201, json: { content: { sha: "abc" } } })],
    ["GET https://api.github.com/repos/octocat/my-apk-repo", () => ({ status: 404, json: { message: "Not Found" } })],
    ["POST https://api.github.com/user/repos", () => ({ status: 201, json: { full_name: "octocat/my-apk-repo" } })],
  ]);
  const orig = globalThis.fetch;
  globalThis.fetch = fetchMock;
  try {
    const res = await worker.fetch(
      new Request("http://x/api/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validBody),
      }),
      env,
    );
    const events = await readSse(res);
    const done = events.find((e) => e.done);
    assert.ok(done, `tidak ada event done: ${JSON.stringify(events)}`);
    assert.equal(done.runId, 42);
    assert.equal(done.actionsUrl, "https://github.com/octocat/my-apk-repo/actions");
    assert.ok(events.some((e) => (e.message || "").includes("Repository octocat/my-apk-repo created")));
    // 4 file template di-push + repo dibuat + dispatch
    assert.ok(fetchMock.calls.some((c) => c.includes("/contents/config.xml")), "config.xml tidak di-push");
    assert.ok(fetchMock.calls.some((c) => c.includes("/contents/.github/workflows/build-apk.yml")), "workflow tidak di-push");
    assert.ok(fetchMock.calls.some((c) => c.includes("/dispatches")), "dispatch tidak dipanggil");
  } finally {
    globalThis.fetch = orig;
  }
});

test("POST /api/build: token ditolak GitHub (401) -> SSE error berbahasa Indonesia", async () => {
  const fetchMock = mockFetch([
    ["GET https://api.github.com/repos/octocat/my-apk-repo", () => ({ status: 401, json: { message: "Bad credentials" } })],
  ]);
  const orig = globalThis.fetch;
  globalThis.fetch = fetchMock;
  try {
    const res = await worker.fetch(
      new Request("http://x/api/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validBody),
      }),
      env,
    );
    const events = await readSse(res);
    const errEvent = events.find((e) => e.error);
    assert.ok(errEvent, `tidak ada event error: ${JSON.stringify(events)}`);
    assert.match(errEvent.error, /Token GitHub ditolak/);
  } finally {
    globalThis.fetch = orig;
  }
});

test("GET /api/build: method salah -> 405", async () => {
  const res = await worker.fetch(new Request("http://x/api/build"), env);
  assert.equal(res.status, 405);
});

// --- /api/artifact ----------------------------------------------------------

test("GET /api/artifact: run masih berjalan -> found:false + status", async () => {
  const fetchMock = mockFetch([
    ["GET https://api.github.com/repos/octocat/my-apk-repo/actions/workflows/build-apk.yml/runs", () => ({
      status: 200,
      json: { workflow_runs: [{ id: 7, status: "in_progress", html_url: "https://github.com/x/y/actions/runs/7" }] },
    })],
  ]);
  const orig = globalThis.fetch;
  globalThis.fetch = fetchMock;
  try {
    const res = await worker.fetch(
      new Request("http://x/api/artifact?user=octocat&repo=my-apk-repo&token=t"),
      env,
    );
    const body = await res.json();
    assert.equal(body.found, false);
    assert.equal(body.status, "in_progress");
  } finally {
    globalThis.fetch = orig;
  }
});

test("GET /api/artifact: run sukses + artifact apk -> found:true + downloadUrl", async () => {
  const fetchMock = mockFetch([
    ["GET https://api.github.com/repos/octocat/my-apk-repo/actions/workflows/build-apk.yml/runs", () => ({
      status: 200,
      json: { workflow_runs: [{ id: 9, status: "completed", conclusion: "success", html_url: "https://github.com/x/y/actions/runs/9" }] },
    })],
    ["GET https://api.github.com/repos/octocat/my-apk-repo/actions/runs/9/artifacts", () => ({
      status: 200,
      json: { artifacts: [{ id: 55, name: "apk", size_in_bytes: 1234567, expired: false }] },
    })],
  ]);
  const orig = globalThis.fetch;
  globalThis.fetch = fetchMock;
  try {
    const res = await worker.fetch(
      new Request("http://x/api/artifact?user=octocat&repo=my-apk-repo&token=t"),
      env,
    );
    const body = await res.json();
    assert.equal(body.found, true);
    assert.equal(body.artifact.id, 55);
    assert.match(body.downloadUrl, /^\/api\/download\?user=octocat&repo=my-apk-repo&artifact=55&token=t$/);
  } finally {
    globalThis.fetch = orig;
  }
});

test("GET /api/artifact: parameter kurang -> 400", async () => {
  const res = await worker.fetch(new Request("http://x/api/artifact?user=a"), env);
  assert.equal(res.status, 400);
});

// --- /api/download ----------------------------------------------------------

test("GET /api/download: parameter kurang -> 400", async () => {
  const res = await worker.fetch(new Request("http://x/api/download?user=a&repo=b"), env);
  assert.equal(res.status, 400);
});

test("GET /api/download: redirect 302 ke storage diikuti, zip di-stream", async () => {
  const fetchMock = async (url) => {
    if (String(url).includes("api.github.com")) {
      return new Response(null, { status: 302, headers: { location: "https://storage.example/apk.zip?sig=1" } });
    }
    return new Response("ZIP-BYTES", { status: 200 });
  };
  const orig = globalThis.fetch;
  globalThis.fetch = fetchMock;
  try {
    const res = await worker.fetch(
      new Request("http://x/api/download?user=octocat&repo=my-apk-repo&artifact=55&token=t"),
      env,
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/zip");
    assert.match(res.headers.get("content-disposition"), /my-apk-repo-apk\.zip/);
    assert.equal(await res.text(), "ZIP-BYTES");
  } finally {
    globalThis.fetch = orig;
  }
});
