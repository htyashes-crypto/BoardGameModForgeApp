import { BrowserWindow, dialog } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { ModScanService } from './ModScanService'

export interface DeleteModInput {
  /** 桌游工程根。 */
  projectPath: string
  /** 目标 Mod 的 manifest.id(用于反向依赖检查 + 显示)。 */
  modId: string
  /** 目标 Mod 的物理子目录名。 */
  modDirName: string
}

export interface DeleteModResult {
  success: boolean
  /** 用户在 confirm dialog 中点了"取消"。 */
  cancelled: boolean
  errors: string[]
}

/**
 * Mod 删除服务:递归删除 `<projectPath>/ModBehaviourProject/<modDirName>/`。
 *
 * 安全机制:
 * 1. **反向依赖检查** —— 删除前扫描当前工程其他 Mod,若有 Mod 声明依赖本 Mod 则在 confirm 中警告
 * 2. **Electron native confirm dialog** —— 危险操作必须二次确认(原生窗口阻断,不可错点)
 * 3. **fs.rm recursive force** —— 一次性递归删除整个 Mod 目录(含 src/ + dll + mod.json + sln)
 */
export class ModDeletionService {
  constructor(private scanService: ModScanService) {}

  async delete(input: DeleteModInput): Promise<DeleteModResult> {
    // 反向依赖扫描
    const snapshot = await this.scanService.scanProject(input.projectPath)
    const reverseDeps: string[] = []
    for (const mod of snapshot.mods) {
      if (!mod.manifest || mod.manifest.id === input.modId) continue
      const hasDep = mod.manifest.dependencies.some((d) => d.id === input.modId)
      if (hasDep) reverseDeps.push(mod.manifest.id)
    }

    // 确认弹窗
    const win = BrowserWindow.getFocusedWindow()
    if (!win) {
      return { success: false, cancelled: false, errors: ['未找到 Focused window'] }
    }

    const modDirPath = join(input.projectPath, 'ModBehaviourProject', input.modDirName)
    let detail = `物理位置:${modDirPath}\n\n此操作不可撤销 — Mod 工程文件(含源码 .cs + 编译产物 .dll + mod.json)将被永久删除。`
    if (reverseDeps.length > 0) {
      detail += `\n\n⚠ 警告:以下 Mod 声明依赖 "${input.modId}",删除后它们将无法加载:\n  · ${reverseDeps.join('\n  · ')}`
    }

    const result = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['取消', '永久删除'],
      defaultId: 0,
      cancelId: 0,
      title: '删除 Mod',
      message: `确定要永久删除 Mod "${input.modId}" 吗?`,
      detail,
      noLink: true
    })

    if (result.response !== 1) {
      return { success: false, cancelled: true, errors: [] }
    }

    // 递归删除
    try {
      await fs.rm(modDirPath, { recursive: true, force: true })
    } catch (e) {
      return {
        success: false,
        cancelled: false,
        errors: [`删除目录失败:${(e as Error).message}`]
      }
    }

    return { success: true, cancelled: false, errors: [] }
  }
}
