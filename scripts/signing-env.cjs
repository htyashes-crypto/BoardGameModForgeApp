/**
 * updater 签名环境变量注入(单一来源,build-win.cjs / release.cjs 共用)。
 * 为什么必须经 Node:密钥是"空字符串密码"保护,而 PowerShell 给环境变量
 * 赋空串等于删除该变量,无法直传;Node 子进程 env 可携带空串。
 */
const path = require("node:path");

module.exports = function signingEnv() {
  return {
    ...process.env,
    // tauri v2 认 TAURI_SIGNING_PRIVATE_KEY(可直接放私钥文件路径)
    TAURI_SIGNING_PRIVATE_KEY:
      process.env.TAURI_SIGNING_PRIVATE_KEY ??
      path.join(process.env.USERPROFILE ?? "", ".tauri", "modforge.key"),
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? "",
  };
};
