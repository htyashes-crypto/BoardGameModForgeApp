# ModForge

BoardGameEditor 桌游工程的 Mod 开发 IDE 环境创建器(v2 起为 Tauri 2 完全重写)。

## 定位

为每个桌游工程独立创建 Mod 开发环境,绑定在某个桌游工程上下文里:
- 生成 Mod 工程骨架(csproj + mod.json + sln,sln 在 Mod 根)
- 在 Cursor / Rider / VS / VS Code 打开
- 一键 dotnet build:自动带依赖闭包、按拓扑序串行编译,dll 直出 Mod 根
- 多 Mod 依赖系统(manifest 版本范围 + Kahn 拓扑,类比 Minecraft 模组生态)
- ModSDK 开发环境管理(GitHub 一键下载 / 校验)

每个 Mod = 一个 .dll = 内含 N 个 `[ModObjectBehaviour]` 标记的 C# 类。

## 技术栈(hty-tauri-app-stack)

Tauri 2(Rust 后端)+ React 19 + TypeScript strict + Vite 7 + Tailwind v4;
状态用 `useSyncExternalStore` 单例(无 Zustand/Redux);仅深色主题;无边框窗自绘标题栏。

## 上手

```powershell
pnpm install
pnpm tauri dev        # 开发模式(Vite 端口 1470;主进程改动需重启)
pnpm typecheck        # TS 检查
cargo test --manifest-path src-tauri/Cargo.toml   # Rust 测试(PowerShell 跑,勿用 Git Bash)
```

## 工程结构

```
src/                   React 前端
├── views/             HubView(选工程)/ WorkspaceView(工作区)
├── components/        详情/编译面板/各弹窗 + ui 基件
├── stores/            useSyncExternalStore 单例(project/mod/build/ide/devEnv/update)
└── lib/               manifest 校验 / 依赖图 / 模板渲染 / 扫描组装 / 创建编排
src-tauri/src/         Rust 后端(settings/project/mod_scan/creation/mod_build/ide/devenv)
dist-web/              vite 前端产物(gitignore)
dist/win-unpacked/     E 侧分发契约(BoardGameEditor 一键打包复制源;pnpm build:win 组装)
```

## 打包与发版

```powershell
pnpm build:win        # NSIS + 组装 dist/win-unpacked(E 侧契约)
pnpm release          # 发 GitHub Release(详见 RELEASE.md)
```

## 与 BoardGameEditor(E 工程)的契约

mod.json schema / csproj 模板 / dll 落点 `<Mod>/<Mod>Behaviour.dll` 与框架侧 Loader 双端联动;
改动须两侧同步并用 HelloMod 存量回归。E 侧一键打包直接复制本工程 `dist/win-unpacked/`。
