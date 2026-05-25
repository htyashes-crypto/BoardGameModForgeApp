import { ipcMain } from 'electron'
import type { ModBuildService } from '../services/ModBuildService'
import type { StartBuildInput } from '../types-build'

/** Build 相关 IPC handler 注册。命名空间 `build:*`。 */
export function registerBuildIpc(build: ModBuildService): void {
  ipcMain.handle('build:start', async (_, input: StartBuildInput) => {
    return build.startBuild(input)
  })

  ipcMain.handle('build:cancel', async () => {
    build.requestCancel()
  })

  ipcMain.handle('build:getCurrentTask', async () => {
    return build.getCurrentTask()
  })
}
