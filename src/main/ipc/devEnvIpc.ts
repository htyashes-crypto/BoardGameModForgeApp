import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { ModDevEnvService } from '../services/ModDevEnvService'
import { GITHUB_BROWSE_URL, GITHUB_REPO_URL } from '../services/ModDevEnvService'

/**
 * Mod 开发环境(ModSDK)路径管理 IPC handlers。命名空间 `devEnv:*`。
 */
export function registerDevEnvIpc(devEnv: ModDevEnvService): void {
  ipcMain.handle('devEnv:getSnapshot', async () => {
    return devEnv.getSnapshot()
  })

  ipcMain.handle('devEnv:browseModSdkDir', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: '选择 Mod 开发环境(ModSDK)目录',
      properties: ['openDirectory'],
      buttonLabel: '选择此目录'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('devEnv:browseDownloadDir', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: '选择 GitHub 仓库下载目标父目录(BoardGameModSDK 会作为子目录创建在其下)',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: '选择此父目录'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('devEnv:validateModSdkPath', async (_, path: string) => {
    return devEnv.validateModSdkPath(path)
  })

  ipcMain.handle('devEnv:setModSdkPath', async (_, path: string | null) => {
    devEnv.setModSdkPath(path)
    return devEnv.getSnapshot()
  })

  ipcMain.handle('devEnv:downloadFromGitHub', async (event, targetDir: string) => {
    const sender = event.sender
    const result = await devEnv.downloadFromGitHub(targetDir, (line) => {
      sender.send('devEnv:downloadLog', line)
    })
    if (result.success && result.modSdkPath) {
      // 下载成功后自动设为当前 ModSdkPath
      devEnv.setModSdkPath(result.modSdkPath)
    }
    return result
  })

  ipcMain.handle('devEnv:openGitHubUrl', async () => {
    await shell.openExternal(GITHUB_BROWSE_URL)
    return GITHUB_BROWSE_URL
  })

  ipcMain.handle('devEnv:getGitHubRepoUrl', async () => {
    return GITHUB_REPO_URL
  })
}
