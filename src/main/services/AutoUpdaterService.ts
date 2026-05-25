import { BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

/**
 * 自动更新服务:包装 electron-updater + 事件转发到 renderer 由 UpdateModal 渲染。
 *
 * - 仓库:`htyashes-crypto/BoardGameModForgeApp`(公开 repo,client 端无需 token)
 * - 配置:`autoDownload=false`(用户点"立即更新"才下载)+ `autoInstallOnAppQuit=true`(退出时自动装)
 * - 发版命令:`pnpm release`(electron-builder --publish always)→ 上传到 GitHub Releases
 *
 * 事件 channel(`update:*`):
 *   - `update:checking`     检查中
 *   - `update:available`    有新版本
 *   - `update:notAvailable` 已最新
 *   - `update:progress`     下载进度
 *   - `update:downloaded`   下载完成
 *   - `update:error`        错误
 */
export class AutoUpdaterService {
  private mainWindow: BrowserWindow | null = null

  init(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('checking-for-update', () => this.send('update:checking'))
    autoUpdater.on('update-available', (info) => this.send('update:available', info))
    autoUpdater.on('update-not-available', (info) => this.send('update:notAvailable', info))
    autoUpdater.on('download-progress', (progress) => this.send('update:progress', progress))
    autoUpdater.on('update-downloaded', (info) => this.send('update:downloaded', info))
    autoUpdater.on('error', (err) => this.send('update:error', { message: err?.message ?? String(err) }))
  }

  /** 主动检查(用户点"检查更新")。 */
  async checkNow(): Promise<void> {
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      // 网络 / 限流 / 仓库未配置时 autoUpdater 会 emit 'error' 事件,这里不重复转发
      console.warn('[AutoUpdater] checkForUpdates failed:', (err as Error).message)
    }
  }

  /** 启动时静默检查(packed 模式才跑;dev 模式 electron-updater 不工作)。 */
  async checkOnStartup(): Promise<void> {
    try {
      await autoUpdater.checkForUpdates()
    } catch {
      // 静默:启动时不弹任何提示,失败由 'error' 事件可选 toast
    }
  }

  async download(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate()
    } catch (err) {
      this.send('update:error', { message: (err as Error).message })
    }
  }

  install(): void {
    autoUpdater.quitAndInstall()
  }

  private send(channel: string, payload?: unknown): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    this.mainWindow.webContents.send(channel, payload)
  }
}
