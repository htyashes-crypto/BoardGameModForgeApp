/**
 * 本地一键发版(与 HtyBox 传统发布同款思路):
 *   校验三处版本一致 → 签名构建(需 GH_TOKEN + 私钥)→ 拼 latest.json
 *   → GitHub API 建 Release(tag 须已推送)→ 上传 NSIS exe + latest.json 并设 latest。
 * 用法:$env:GH_TOKEN='ghp_xxx'; node scripts/release.cjs [--notes "更新说明"] [--skip-build]
 */
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const OWNER = "htyashes-crypto";
const REPO = "BoardGameModForgeApp";
const root = path.join(__dirname, "..");

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const token = process.env.GH_TOKEN;
if (!token) fail("缺 GH_TOKEN 环境变量(repo 权限)");

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
const conf = JSON.parse(fs.readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf-8"));
const cargo = fs.readFileSync(path.join(root, "src-tauri", "Cargo.toml"), "utf-8");
const cargoVer = (cargo.match(/^version = "([^"]+)"/m) ?? [])[1];
const version = pkg.version;
if (conf.version !== version || cargoVer !== version)
  fail(`三处版本不一致:package=${version} conf=${conf.version} cargo=${cargoVer};先跑 bump-version`);

const args = process.argv.slice(2);
const notesIdx = args.indexOf("--notes");
const notes = notesIdx >= 0 ? args[notesIdx + 1] : `ModForge v${version}`;

if (!args.includes("--skip-build")) {
  console.log(`> 签名构建 v${version}(NSIS + updater 产物 + win-unpacked)…`);
  execSync("node scripts/build-win.cjs", { cwd: root, stdio: "inherit" });
}

const nsisDir = path.join(root, "src-tauri", "target", "release", "bundle", "nsis");
const setupName = `ModForge_${version}_x64-setup.exe`;
const setupPath = path.join(nsisDir, setupName);
const sigPath = `${setupPath}.sig`;
if (!fs.existsSync(setupPath)) fail(`未找到 ${setupPath}`);
if (!fs.existsSync(sigPath)) fail(`未找到签名 ${sigPath}(确认构建时已带签名私钥环境变量)`);

const latest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature: fs.readFileSync(sigPath, "utf-8"),
      url: `https://github.com/${OWNER}/${REPO}/releases/download/v${version}/${setupName}`,
    },
  },
};
const latestPath = path.join(nsisDir, "latest.json");
fs.writeFileSync(latestPath, JSON.stringify(latest, null, 2));
console.log(`> latest.json 就绪(signature ${latest.platforms["windows-x86_64"].signature.length} chars)`);

async function gh(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "modforge-release",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) fail(`${init.method ?? "GET"} ${url} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log(`> 创建 Release v${version}…`);
  const release = await gh(`https://api.github.com/repos/${OWNER}/${REPO}/releases`, {
    method: "POST",
    body: JSON.stringify({
      tag_name: `v${version}`,
      name: `ModForge v${version}`,
      body: notes,
      draft: false,
      prerelease: false,
      make_latest: "true",
    }),
  });

  for (const file of [setupPath, latestPath]) {
    const name = path.basename(file);
    console.log(`> 上传 ${name}…`);
    const data = fs.readFileSync(file);
    const res = await fetch(
      `https://uploads.github.com/repos/${OWNER}/${REPO}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "Content-Length": String(data.length),
          "User-Agent": "modforge-release",
        },
        body: data,
      },
    );
    if (!res.ok) fail(`上传 ${name} → ${res.status} ${await res.text()}`);
  }

  console.log(`✓ 发布完成:https://github.com/${OWNER}/${REPO}/releases/tag/v${version}`);
}

void main();
