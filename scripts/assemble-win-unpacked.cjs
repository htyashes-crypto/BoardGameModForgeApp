/**
 * E 侧契约兼容层(全局决策 G3-A):把 tauri release 产物组装成
 * `dist/win-unpacked/ModForge.exe`,供 BoardGameEditor OneClickFullBuild
 * 直接复制合入 `{桌游包}/External/ModForge/`(modforge_precheck 检查该文件)。
 *
 * 注意:vite 前端产物在 dist-web/(与本目录职责隔离,勿混)。
 * 目标机需 WebView2 运行时(Win10/11 常规自带;缺失时装 Evergreen 运行时)。
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const releaseDir = path.join(root, "src-tauri", "target", "release");
const outDir = path.join(root, "dist", "win-unpacked");

// tauri build 会把主 exe 按 productName 命名;兼容两种命名以防版本差异
const candidates = ["ModForge.exe", "modforge-app.exe"];
const src = candidates.map((n) => path.join(releaseDir, n)).find((p) => fs.existsSync(p));
if (!src) {
  console.error(`未找到 release 产物(${candidates.join(" / ")});先跑 pnpm tauri build`);
  process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(src, path.join(outDir, "ModForge.exe"));

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
fs.writeFileSync(path.join(outDir, "modforge-version.txt"), `${pkg.version}\n`);

console.log(`已组装 dist/win-unpacked/ModForge.exe(v${pkg.version},源:${path.basename(src)})`);
