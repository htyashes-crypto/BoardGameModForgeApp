# ModForge 发版流程(v2 · Tauri 2,仅 Windows)

> v2 起为 Tauri 2 栈:NSIS 安装包 + tauri updater(GitHub Releases `latest.json`)。
> 旧 Electron 装机(≤0.1.0)与新链互不相通,需人工告知重装(全局决策 G2-A)。
> Mac 暂不发(决策 3-A);真实需求出现时另立子 plan。

## 前置(一次性)

| 项 | 说明 |
|---|---|
| 签名私钥 | `%USERPROFILE%\.tauri\modforge.key`(无密码)。**丢失 = 老装机无法验签新版,只能重装 —— 必须备份**。pubkey 已写进 `src-tauri/tauri.conf.json` plugins.updater。签名环境变量用 `TAURI_SIGNING_PRIVATE_KEY`(直接放私钥文件路径;注意 PowerShell 给环境变量赋空串 = 删除该变量) |
| GH_TOKEN | GitHub PAT(repo 权限),发版会话内 `$env:GH_TOKEN = 'ghp_xxx'` |
| 远端 | `https://github.com/htyashes-crypto/BoardGameModForgeApp`(updater endpoint 指向其 latest release) |

## 发版五步

```powershell
# 1. bump 三处版本(package.json / Cargo.toml / tauri.conf.json 唯一入口)
node scripts/bump-version.cjs patch     # 或 minor / major / x.y.z

# 2. 质量门
pnpm typecheck
cargo test --manifest-path src-tauri/Cargo.toml   # PowerShell 跑,勿用 Git Bash

# 3. 提交并推送(tag 必须先于 release 存在于远端)
git add -A; git commit -m "release: vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags

# 4. 一键发版:签名构建 + 组装 win-unpacked + latest.json + GitHub Release 上传并设 latest
$env:GH_TOKEN = 'ghp_xxx'
pnpm release -- --notes "本版更新说明"

# 5. 验证:装上一版 → 设置 → 检查更新,应检出新版并完成 下载 → 重启安装
```

## 产物与位置

| 产物 | 位置 | 用途 |
|---|---|---|
| `ModForge_<v>_x64-setup.exe` + `.sig` | `src-tauri/target/release/bundle/nsis/` | NSIS 安装包 + updater 验签 |
| `latest.json` | 同上(由 release.cjs 生成并上传) | updater endpoint 清单 |
| `dist/win-unpacked/ModForge.exe` | 由 `assemble-win-unpacked.cjs` 组装 | **E 侧契约**:BoardGameEditor 一键打包直接复制此目录 |

## E 侧联动(改码后没发版时)

只想让桌游包拿到最新 ModForge,不发版也行:

```powershell
pnpm build:win   # = tauri build + 组装 dist/win-unpacked(modforge_precheck 检查该目录)
```

注意:`dist-web/` 是 vite 前端产物、`dist/` 专属 E 侧分发契约 —— 两者职责隔离,
勿把 vite outDir 改回 `dist/`(2026-07-19 踩坑:emptyOutDir 清空过 win-unpacked)。

## 排错

| 症状 | 处理 |
|---|---|
| 构建报 "public key has been found, but no private key" | `$env:TAURI_SIGNING_PRIVATE_KEY = "$env:USERPROFILE\.tauri\modforge.key"`(release.cjs 已默认注入) |
| release.cjs 报三处版本不一致 | 只用 `bump-version.cjs` 改版本,勿手改单处 |
| 安装版检查更新报错 | 确认 release 已设 latest 且含 `latest.json` 资产;dev 模式不支持更新属预期 |
| 目标机启动无窗口 | 缺 WebView2 运行时(Win10/11 常规自带);装 Evergreen 运行时 |
