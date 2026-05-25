# ModForge

BoardGameEditor 桌游工程的 Mod 开发 IDE 环境创建器。

## 定位

为每个桌游工程独立创建 Mod 开发环境,绑定在某个桌游工程上下文里:
- 生成 Mod 工程骨架(csproj + mod.json + sln)
- 在 Cursor / Rider / VS Code 打开
- 一键 dotnet build + 自动按拓扑序部署 dll
- 多 Mod 依赖系统(类比 Minecraft 模组生态)

每个 Mod = 一个 .dll = 内含 N 个 `[ModObjectBehaviour]` 标记的 C# 类,类比蓝图工程包含多个蓝图类。

## 上手

首次使用:

```bash
pnpm install              # 或 npm install
pnpm dev                  # 启动开发模式(launch.cjs 清掉 ELECTRON_RUN_AS_NODE 陷阱)
```

打包:

```bash
pnpm build:win            # Windows NSIS 安装器 + portable
pnpm typecheck            # TypeScript 类型检查
```

## 工程结构

```
src/
├── main/                  Electron 主进程(Node 域)
│   ├── index.ts           入口 + BrowserWindow
│   ├── services/          扫桌游工程 / 绑定 / 编译 / IDE 启动
│   └── ipc/               IPC handler 注册
├── preload/               contextBridge 暴露 API 给 renderer
└── renderer/              React UI(浏览器域)
    └── src/
        ├── App.tsx        路由:Hub / Workspace
        ├── views/         主视图
        ├── components/    弹窗与组件
        ├── store/         Zustand state
        └── styles/        Tailwind base
```

## 视觉设计

设计 mockup 见 `<BoardGameEditor>/.claude/svg/modforge-*.svg`:
- modforge-home.svg —— Hub 启动页
- modforge-workspace.svg —— Workspace 主面板
- modforge-modal-new-mod.svg —— 新建 Mod 弹窗
- modforge-modal-new-behaviour.svg —— 新建 Behaviour 弹窗
- modforge-modal-mod-deps.svg —— 依赖图视图
- modforge-workspace-building.svg —— 编译中状态

调色板:黑底 + 橙金品牌色,Tailwind token 在 `tailwind.config.js`。

## 相关 Skill / Plan

- 完整实施计划:`<BoardGameEditor>/.claude/plans/2026-05-25-modforge-mod-dev-tool-v1.md`
- 设计规范:`<BoardGameEditor>/.claude/skills/`
