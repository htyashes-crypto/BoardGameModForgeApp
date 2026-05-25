# ModForge 发版流程

参考姊妹工具 BlueprintDebugApp / HtyHubApp 的 `electron-builder + electron-updater + GitHub Releases` 链路。

## 前置准备(只做一次)

### 1. GitHub Personal Access Token

发版命令需要 `GH_TOKEN` 环境变量推送 release 到 GitHub。

1. 进 https://github.com/settings/tokens → Generate new token (classic)
2. 勾选权限:`repo`(完整 repo 权限);若仓库是公开的,`public_repo` 也行
3. 复制 token,**只显示一次**
4. 设环境变量:

```powershell
# 当前会话
$env:GH_TOKEN = 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'

# 永久(写入用户环境变量)
[System.Environment]::SetEnvironmentVariable('GH_TOKEN', 'ghp_xxx...', 'User')
```

### 2. 检查 electron-builder.yml

确认 `publish.repo: BoardGameModForgeApp`(已配)。

### 3. 检查 package.json version

每次发版前 bump version(`patch` / `minor` / `major`)。

---

## 发版步骤

### Step 1:bump version

```powershell
cd ModForgeApp

# 选一种
npm version patch    # 0.1.0 → 0.1.1
npm version minor    # 0.1.0 → 0.2.0
npm version major    # 0.1.0 → 1.0.0
```

这会更新 `package.json` + 自动 `git commit` + `git tag v0.1.x`。

### Step 2:typecheck(可选但推荐)

```powershell
pnpm typecheck
```

### Step 3:打包 + 推送 release

```powershell
pnpm release
```

等价于 `electron-vite build && electron-builder --publish always`。

完成后:
- `dist/ModForge-Setup-x.y.z-x64.exe` (NSIS 安装器)
- `dist/ModForge-Portable-x.y.z-x64.exe` (便携版)
- `dist/latest.yml` (electron-updater 元数据)
- 全部自动上传到 https://github.com/htyashes-crypto/BoardGameModForgeApp/releases

### Step 4:推送 git tag

```powershell
git push --tags
git push    # 推送 npm version 自动创建的 commit
```

### Step 5:在 GitHub Release 页加 Release Notes

电子构建器创建的是空 Release Body。手动去 https://github.com/htyashes-crypto/BoardGameModForgeApp/releases 编辑 → 写本版本变更。

或用 GitHub API + PowerShell 批量写入(参 [[blueprint-debug-app-release]] skill 模式):

```powershell
$body = @"
## 本版本更新

- feat: ...
- fix: ...
"@
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
$bodyEncoded = [System.Text.Encoding]::UTF8.GetString($bodyBytes)

# 查 release id
$release = Invoke-RestMethod -Headers @{Authorization="token $env:GH_TOKEN"} `
  -Uri "https://api.github.com/repos/htyashes-crypto/BoardGameModForgeApp/releases/tags/v0.1.1"

# PATCH body
Invoke-RestMethod -Method Patch `
  -Headers @{Authorization="token $env:GH_TOKEN"} `
  -Uri "https://api.github.com/repos/htyashes-crypto/BoardGameModForgeApp/releases/$($release.id)" `
  -Body (@{body=$bodyEncoded} | ConvertTo-Json) `
  -ContentType 'application/json'
```

---

## 验证更新链路

1. 假设当前 v0.1.0 已装在用户机器(从 v0.1.0 NSIS 安装器装)
2. 发版 v0.1.1 → 推送到 GitHub Releases
3. 用户启动现有 v0.1.0 ModForge → 几秒内 UpdateModal 弹窗显示"检测到新版本 v0.1.1"
4. 用户点"立即更新" → 进度条 → 下载完成 → 点"立即重启安装" → 重启进 v0.1.1

---

## 故障排查

| 症状 | 可能原因 |
|---|---|
| `pnpm release` 报 `401 Unauthorized` | `GH_TOKEN` 没设 / 权限不够 |
| `electron-builder` 找不到 icon | resources/icon.ico 缺失或 electron-builder.yml `buildResources` 路径错 |
| Release 上传成功但 UpdateModal 不弹 | dev 模式下不工作;只在 NSIS 安装版生效。或 release 不是 published(草稿状态) |
| 用户看到 UpdateModal 但点"立即更新"卡住 | 网络问题 / GitHub 限流 / latest.yml 文件签名不匹配 |
| UpdateModal 永远显示"更新检查失败" | 检查 main 进程 console 日志;常见是 `releaseType: draft` 没改成 `release` |

---

## 相关 skill 引用

- [[blueprint-debug-app-release]] — 同款发版流程的完整 skill(可作为详细参考)
- [[htyhubapp-release]] — 同款流程
- [[electron-release]] — 通用 Electron 发版 skill
