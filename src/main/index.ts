import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { ProjectScanService } from './services/ProjectScanService'
import { ProjectBindingService } from './services/ProjectBindingService'
import { ModManifestReader } from './services/ModManifestReader'
import { ModDependencyGraphService } from './services/ModDependencyGraphService'
import { ModScanService } from './services/ModScanService'
import { ModCreationService } from './services/ModCreationService'
import { BehaviourCreationService } from './services/BehaviourCreationService'
import { ModBuildService } from './services/ModBuildService'
import { IdeDetectionService } from './services/IdeDetectionService'
import { IdeLaunchService } from './services/IdeLaunchService'
import { registerProjectIpc } from './ipc/projectIpc'
import { registerModIpc } from './ipc/modIpc'
import { registerBuildIpc } from './ipc/buildIpc'
import { registerIdeIpc } from './ipc/ideIpc'

let mainWindow: BrowserWindow | null = null

const projectScanService = new ProjectScanService()
const projectBindingService = new ProjectBindingService()
const modManifestReader = new ModManifestReader()
const modGraphService = new ModDependencyGraphService()
const modScanService = new ModScanService(modManifestReader, modGraphService)
const modCreationService = new ModCreationService(modScanService)
const behaviourCreationService = new BehaviourCreationService(modScanService)
const modBuildService = new ModBuildService(modScanService)
const ideDetectionService = new IdeDetectionService()
const ideLaunchService = new IdeLaunchService()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 720,
    backgroundColor: '#0a0a0a',
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

app.whenReady().then(() => {
  registerProjectIpc(projectScanService, projectBindingService)
  registerModIpc(modScanService, modCreationService, behaviourCreationService)
  registerBuildIpc(modBuildService)
  registerIdeIpc(ideDetectionService, ideLaunchService, projectBindingService)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
