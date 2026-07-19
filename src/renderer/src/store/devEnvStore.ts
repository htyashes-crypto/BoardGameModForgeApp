import { create } from 'zustand'
import type { DevEnvSnapshot, ValidationResult } from '../types/api'

/**
 * Mod 开发环境(ModSDK)路径配置 + GitHub 仓库下载状态 store。
 *
 * 主题群「Mod 开发环境作为独立引擎」Phase 5 真机补完。
 */

export type DownloadPhase = 'idle' | 'downloading' | 'success' | 'failed'

interface DevEnvState {
  /** 当前已配置的 ModSDK 路径(null 表示未配置)。 */
  modSdkPath: string | null
  /** 当前路径的校验结果。 */
  validation: ValidationResult | null

  /** 下载阶段。 */
  downloadPhase: DownloadPhase
  /** 下载日志(stdout + stderr 累积)。 */
  downloadLog: string
  /** 下载结果消息(success/failed)。 */
  downloadMessage: string

  /** 启动时从 main 拉 snapshot。 */
  hydrateFromMain(): Promise<void>

  /** 浏览并选某目录作为 Mod SDK 路径(同步校验 + 保存)。 */
  browseAndSetModSdkPath(): Promise<ValidationResult | null>

  /** 浏览父目录后,git clone 到 `<选的目录>/BoardGameModSDK/`。 */
  downloadToBrowsedDir(): Promise<{ success: boolean; modSdkPath?: string; error?: string }>

  /** 清空配置。 */
  unset(): Promise<void>

  /** 监听 main 端推送的下载日志(返回 unsubscribe)。 */
  subscribeToDownloadLog(): () => void
}

export const useDevEnvStore = create<DevEnvState>((set, get) => ({
  modSdkPath: null,
  validation: null,
  downloadPhase: 'idle',
  downloadLog: '',
  downloadMessage: '',

  async hydrateFromMain() {
    const snap: DevEnvSnapshot = await window.api.devEnv.getSnapshot()
    set({ modSdkPath: snap.modSdkPath, validation: snap.validation })
  },

  async browseAndSetModSdkPath() {
    const path = await window.api.devEnv.browseModSdkDir()
    if (!path) return null

    const validation = await window.api.devEnv.validateModSdkPath(path)
    if (validation.ok) {
      const snap = await window.api.devEnv.setModSdkPath(path)
      set({ modSdkPath: snap.modSdkPath, validation: snap.validation })
    } else {
      // 校验失败仍然展示错误,但不写入 store(保留旧配置)
      set({ validation })
    }
    return validation
  },

  async downloadToBrowsedDir() {
    const parent = await window.api.devEnv.browseDownloadDir()
    if (!parent) return { success: false, error: '用户取消' }

    // 目标 = <parent>/BoardGameModSDK
    const targetDir = `${parent.replace(/[/\\]+$/, '')}\\BoardGameModSDK`

    set({
      downloadPhase: 'downloading',
      downloadLog: `> 下载目标:${targetDir}\n`,
      downloadMessage: '下载中...'
    })

    const result = await window.api.devEnv.downloadFromGitHub(targetDir)

    if (result.success && result.modSdkPath) {
      // 主端已自动 setModSdkPath,这里 hydrate 刷新校验
      const snap = await window.api.devEnv.getSnapshot()
      set({
        modSdkPath: snap.modSdkPath,
        validation: snap.validation,
        downloadPhase: 'success',
        downloadMessage: `下载成功!ModSDK 路径已自动配置为 ${result.modSdkPath}`
      })
      return { success: true, modSdkPath: result.modSdkPath }
    } else {
      set({
        downloadPhase: 'failed',
        downloadMessage: result.error ?? '未知错误',
        downloadLog: get().downloadLog + '\n' + result.output
      })
      return { success: false, error: result.error }
    }
  },

  async unset() {
    const snap = await window.api.devEnv.setModSdkPath(null)
    set({
      modSdkPath: snap.modSdkPath,
      validation: snap.validation,
      downloadPhase: 'idle',
      downloadLog: '',
      downloadMessage: ''
    })
  },

  subscribeToDownloadLog() {
    return window.api.devEnv.onDownloadLog((line) => {
      set((s) => ({ downloadLog: s.downloadLog + line + '\n' }))
    })
  }
}))
