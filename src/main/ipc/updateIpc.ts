import { ipcMain } from 'electron'
import type { AutoUpdaterService } from '../services/AutoUpdaterService'

/** Update IPC handler 注册。命名空间 `update:*`。 */
export function registerUpdateIpc(updater: AutoUpdaterService): void {
  ipcMain.handle('update:checkNow', async () => updater.checkNow())
  ipcMain.handle('update:download', async () => updater.download())
  ipcMain.handle('update:install', async () => updater.install())
}
