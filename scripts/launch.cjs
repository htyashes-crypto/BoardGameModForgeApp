#!/usr/bin/env node
/**
 * 跨平台 launcher:启动子进程前清掉 Electron 启动陷阱环境变量。
 *
 * 背景:Cursor / VSCode 的集成终端会继承 ELECTRON_RUN_AS_NODE=1,
 * 这让 Electron 二进制以纯 Node 模式运行,require('electron') 返回安装路径
 * 字符串而非 API 对象,导致 main 进程 `electron.app.whenReady()` 报
 * "Cannot read properties of undefined"。本脚本在 spawn 子进程前删除该变量。
 *
 * 用法(package.json):
 *   "dev":  "node scripts/launch.cjs electron-vite dev"
 *   "preview": "node scripts/launch.cjs electron-vite preview"
 */
const { spawn } = require('node:child_process')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
delete env.ELECTRON_NO_ATTACH_CONSOLE
delete env.NODE_OPTIONS
delete env.VSCODE_INSPECTOR_OPTIONS
delete env.ELECTRON_FORCE_IS_PACKAGED

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('[launch] 用法:node scripts/launch.cjs <command> [...args]')
  process.exit(2)
}

const cmd = args.join(' ')
const child = spawn(cmd, {
  stdio: 'inherit',
  shell: true,
  env
})
child.on('exit', (code) => process.exit(code ?? 1))
child.on('error', (err) => {
  console.error('[launch] 子进程启动失败:', err.message)
  process.exit(1)
})
