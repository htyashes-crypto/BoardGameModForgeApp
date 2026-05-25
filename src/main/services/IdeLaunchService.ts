import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { shell } from 'electron'

/**
 * 启动 IDE 打开目标(目录 / .sln / .csproj)。
 * 子进程 detached + unref → 不阻塞主进程退出,跨 Windows console 弹窗。
 */
export class IdeLaunchService {
  async launch(idePath: string, targetPath: string): Promise<void> {
    const child = spawn(idePath, [targetPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    })
    child.unref()
  }

  /** 用系统默认资源管理器打开目录(主用于"打开文件夹"按钮)。 */
  async openInExplorer(folderPath: string): Promise<void> {
    const st = await fs.stat(folderPath).catch(() => null)
    if (!st?.isDirectory()) {
      throw new Error(`目录不存在:${folderPath}`)
    }
    await shell.openPath(folderPath)
  }
}
