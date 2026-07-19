/**
 * Windows 打包一条龙:签名 tauri build + 组装 dist/win-unpacked(E 侧契约)。
 * `pnpm build:win` 的实现体;PowerShell 直跑无需手工设签名环境变量。
 */
const { execSync } = require("node:child_process");
const path = require("node:path");
const signingEnv = require("./signing-env.cjs");

const root = path.join(__dirname, "..");
execSync("pnpm tauri build", { cwd: root, stdio: "inherit", env: signingEnv() });
execSync("node scripts/assemble-win-unpacked.cjs", { cwd: root, stdio: "inherit" });
