import { ipcMain } from 'electron'
import type { ModScanService } from '../services/ModScanService'
import type { ModCreationService, CreateModInput } from '../services/ModCreationService'
import type { BehaviourCreationService, CreateBehaviourInput } from '../services/BehaviourCreationService'

/**
 * Mod 相关 IPC handler 注册。命名空间 `mod:*` / `behaviour:*`。
 */
export function registerModIpc(
  scan: ModScanService,
  creation: ModCreationService,
  behaviourCreation: BehaviourCreationService
): void {
  ipcMain.handle('mod:scanProject', async (_, projectPath: string) => {
    return scan.scanProject(projectPath)
  })

  ipcMain.handle('mod:create', async (_, input: CreateModInput) => {
    return creation.create(input)
  })

  ipcMain.handle('behaviour:create', async (_, input: CreateBehaviourInput) => {
    return behaviourCreation.create(input)
  })
}
