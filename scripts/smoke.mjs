// Smoke test output statis (out/) — dijalankan lokal/CI tanpa network.
// Memeriksa marker penting ada di HTML hasil export / chunk JS.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "out");

let fail = 0;
const check = (name, ok) => {
  console.log(ok ? `PASS ${name}` : `FAIL ${name}`);
  if (!ok) fail++;
};

const readAll = (dir) => {
  let out = "";
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out += readAll(p);
    else if (/\.(html|js|txt)$/.test(e.name)) out += fs.readFileSync(p, "utf8");
  }
  return out;
};

check("out/ ada", fs.existsSync(OUT));
check("out/index.html ada", fs.existsSync(path.join(OUT, "index.html")));
check("out/_worker.js ada (API hidup di Pages)", fs.existsSync(path.join(OUT, "_worker.js")));
check("out/404.html ada", fs.existsSync(path.join(OUT, "404.html")));
check("template config.xml ikut ter-deploy", fs.existsSync(path.join(OUT, "cordova-template", "config.xml")));
check("template build-apk.yml ikut ter-deploy", fs.existsSync(path.join(OUT, "cordova-template", "build-apk.yml")));
check("template www/index.html ikut ter-deploy", fs.existsSync(path.join(OUT, "cordova-template", "www", "index.html")));

const html = fs.readFileSync(path.join(OUT, "index.html"), "utf8");
check("index.html berisi judul APK Builder", html.includes("APK Builder"));
check("index.html berisi link GitHub repo", html.includes("github.com/dezzorigin/apk-builder"));

const all = readAll(OUT);
check("landing hero ada di bundle", all.includes("Ubah website jadi aplikasi Android"));
check("wizard builder ada di bundle", all.includes("Create New App"));
check("tombol Cek APK ada di bundle", all.includes("Cek APK"));
check("worker berisi rute /api/build", fs.readFileSync(path.join(OUT, "_worker.js"), "utf8").includes("/api/build"));
check("worker berisi rute /api/artifact", fs.readFileSync(path.join(OUT, "_worker.js"), "utf8").includes("/api/artifact"));
check("worker berisi rute /api/download", fs.readFileSync(path.join(OUT, "_worker.js"), "utf8").includes("/api/download"));

if (fail > 0) {
  console.log(`\nSMOKE GAGAL: ${fail} check gagal.`);
  process.exit(1);
}
console.log("\nSMOKE OK.");
