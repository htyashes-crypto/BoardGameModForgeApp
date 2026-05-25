import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { IdeDetectionService, DetectedIde } from '../services/IdeDetectionService'
import type { IdeLaunchService } from '../services/IdeLaunchService'
import type { ProjectBindingService } from '../services/ProjectBindingService'

/** IDE 偏好 + 启动 IPC handler 注册。命名空间 `ide:*`。 */
export function registerIdeIpc(
  detection: IdeDetectionService,
  launch: IdeLaunchService,
  binding: ProjectBindingService
): void {
  ipcMain.handle('ide:detectAll', async (): Promise<DetectedIde[]> => {
    return detection.detectAll()
  })

  ipcMain.handle('ide:getPreferred', async (): Promise<string | null> => {
    return binding.getPreferredIdePath()
  })

  ipcMain.handle('ide:setPreferred', async (_, idePath: string | null) => {
    binding.setPreferredIdePath(idePath)
  })

  ipcMain.handle('ide:browseManual', async (): Promise<string | null> => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: '选择 IDE 可执行文件',
      filters: [
        { name: '可执行文件', extensions: ['exe'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('ide:launch', async (_, idePath: string, targetPath: string) => {
    await launch.launch(idePath, targetPath)
  })

  ipcMain.handle('ide:openFolder', async (_, folderPath: string) => {
    await launch.openInExplorer(folderPath)
  })
}
