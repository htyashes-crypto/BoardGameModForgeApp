import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { ProjectScanService } from '../services/ProjectScanService'
import type { ProjectBindingService } from '../services/ProjectBindingService'
import type { ProjectInfo } from '../types'

/**
 * Project 相关 IPC handler 注册。命名空间 `project:*`。
 */
export function registerProjectIpc(
  scan: ProjectScanService,
  binding: ProjectBindingService
): void {
  ipcMain.handle('project:scan', async (_, rootDir: string) => {
    if (rootDir) binding.setLastScanRoot(rootDir)
    return scan.scan(rootDir)
  })

  ipcMain.handle('project:autoDetectRoot', async () => {
    return scan.autoDetectRoot(binding.getLastScanRoot())
  })

  ipcMain.handle('project:getLastScanRoot', async () => {
    return binding.getLastScanRoot()
  })

  ipcMain.handle('project:browseRoot', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: '选择桌游工程文件夹(扫描根目录)',
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('project:browseSingleProject', async (): Promise<ProjectInfo | null> => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: '选择单个桌游工程目录',
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return scan.scanSingle(result.filePaths[0])
  })

  ipcMain.handle('project:getSnapshot', async () => {
    return binding.getSnapshot()
  })

  ipcMain.handle('project:bind', async (_, project: ProjectInfo) => {
    binding.bind(project)
    return binding.getSnapshot()
  })

  ipcMain.handle('project:unbind', async () => {
    binding.unbind()
    return binding.getSnapshot()
  })
}
