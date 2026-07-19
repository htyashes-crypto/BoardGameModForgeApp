import { app, BrowserWindow } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ProjectScanService } from './services/ProjectScanService'
import { ProjectBindingService } from './services/ProjectBindingService'
import { ModManifestReader } from './services/ModManifestReader'
import { ModDependencyGraphService } from './services/ModDependencyGraphService'
import { ModScanService } from './services/ModScanService'
import { ModCreationService } from './services/ModCreationService'
import { BehaviourCreationService } from './services/BehaviourCreationService'
import { ModBuildService } from './services/ModBuildService'
import { ModDeletionService } from './services/ModDeletionService'
import { IdeDetectionService } from './services/IdeDetectionService'
import { IdeLaunchService } from './services/IdeLaunchService'
import { AutoUpdaterService } from './services/AutoUpdaterService'
import { ModDevEnvService } from './services/ModDevEnvService'
import { registerProjectIpc } from './ipc/projectIpc'
import { registerModIpc } from './ipc/modIpc'
import { registerBuildIpc } from './ipc/buildIpc'
import { registerIdeIpc } from './ipc/ideIpc'
import { registerUpdateIpc } from './ipc/updateIpc'
import { registerDevEnvIpc } from './ipc/devEnvIpc'

let mainWindow: BrowserWindow | null = null

const projectScanService = new ProjectScanService()
const projectBindingService = new ProjectBindingService()
const modManifestReader = new ModManifestReader()
const modGraphService = new ModDependencyGraphService()
const modScanService = new ModScanService(modManifestReader, modGraphService)
const modDevEnvService = new ModDevEnvService()
const modCreationService = new ModCreationService(modScanService, modDevEnvService)
const behaviourCreationService = new BehaviourCreationService(modScanService)
const modBuildService = new ModBuildService(modScanService)
const modDeletionService = new ModDeletionService(modScanService)
const ideDetectionService = new IdeDetectionService()
const ideLaunchService = new IdeLaunchService()
const autoUpdaterService = new AutoUpdaterService()

/**
 * 解析 BrowserWindow icon 路径(dev 模式生效;packed 模式由 electron-builder 嵌入 .exe 自动生效)。
 * 候选顺序:resources/icon.ico(Windows 最佳)→ icon.png(跨平台 fallback);文件不存在返 undefined,
 * Electron 会自动 fall back 到 .exe 内嵌或默认图标。
 */
function resolveWindowIcon(): string | undefined {
  const baseDir = join(process.cwd(), 'resources')
  const candidates = process.platform === 'win32'
    ? ['icon.ico', 'icon.png']
    : ['icon.png']
  for (const name of candidates) {
    const full = join(baseDir, name)
    if (existsSync(full)) return full
  }
  return undefined
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 720,
    backgroundColor: '#0a0a0a',
    icon: resolveWindowIcon(),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * 解析 --project <path> / --project=<path> argv 并 auto-bind 到该桌游工程,
 * 让从桌游编辑器 LeftMenuPanel 拉起的 ModForge 启动即绑定当前工程,免去手工选工程。
 * 在 createWindow 之前完成,renderer 启动后直接读到 bound 状态。
 */
async function tryAutoBindFromArgv(): Promise<void> {
  const argv = process.argv
  let projectPath: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--project' && i + 1 < argv.length) {
      projectPath = argv[i + 1]
      break
    }
    if (arg.startsWith('--project=')) {
      projectPath = arg.slice('--project='.length)
      break
    }
  }
  if (!projectPath) return

  // 兼容 path 含包裹引号的场景(部分启动器会保留引号)
  projectPath = projectPath.replace(/^"+|"+$/g, '')

  if (!existsSync(projectPath)) {
    console.warn(`[ModForge] --project 指向路径不存在,忽略: ${projectPath}`)
    return
  }

  const info = await projectScanService.scanSingle(projectPath)
  if (!info) {
    console.warn(`[ModForge] --project 扫描失败,忽略: ${projectPath}`)
    return
  }
  projectBindingService.bind(info)
  console.log(`[ModForge] --project auto-bind 成功: ${info.name} (${info.path})`)
}

app.whenReady().then(async () => {
  // 先 auto-bind --project argv 让 renderer 启动直接读到 bound 状态
  await tryAutoBindFromArgv()

  registerProjectIpc(projectScanService, projectBindingService)
  registerModIpc(modScanService, modCreationService, behaviourCreationService, modDeletionService)
  registerBuildIpc(modBuildService)
  registerIdeIpc(ideDetectionService, ideLaunchService, projectBindingService)
  registerUpdateIpc(autoUpdaterService)
  registerDevEnvIpc(modDevEnvService)
  createWindow()

  if (mainWindow) {
    autoUpdaterService.init(mainWindow)
    // 打包后启动检查;dev 模式 electron-updater 不工作
    if (app.isPackaged) {
      autoUpdaterService.checkOnStartup()
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
