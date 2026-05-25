import { create } from 'zustand'

/** electron-updater 的 UpdateInfo 子集(只保留 UI 需要的字段)。 */
export interface UpdateInfo {
  version: string
  /** GitHub Release 描述:可能是 string、string[],或 [{ note, version }] 数组。 */
  releaseNotes?: string | Array<{ version: string; note: string }> | null
  releaseName?: string | null
  releaseDate?: string | null
}

/** download-progress 事件载荷。 */
export interface UpdateProgress {
  bytesPerSecond: number
  percent: number
  transferred: number
  total: number
}

/** 自动更新状态机。 */
export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'dismissed'

interface UpdateStore {
  state: UpdateState
  info: UpdateInfo | null
  progress: UpdateProgress | null
  errorMessage: string | null
  /** 主动点"检查更新"vs 启动自动;前者出错也要弹,后者静默。 */
  manuallyTriggered: boolean
  /** 是否已订阅 IPC 事件(初始化一次)。 */
  subscribed: boolean

  initSubscriptions(): void
  checkNow(manual: boolean): Promise<void>
  download(): Promise<void>
  install(): Promise<void>
  dismiss(): void
  reset(): void
}

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  state: 'idle',
  info: null,
  progress: null,
  errorMessage: null,
  manuallyTriggered: false,
  subscribed: false,

  initSubscriptions() {
    if (get().subscribed) return
    window.api.update.onChecking(() => set({ state: 'checking' }))
    window.api.update.onAvailable((info) =>
      set({ state: 'available', info: info as UpdateInfo })
    )
    window.api.update.onNotAvailable(() => {
      // 静默:仅手动检查时把状态显式置 idle 让 UI 提示"已最新"(可选)
      const manual = get().manuallyTriggered
      set({ state: 'idle', info: null })
      if (manual) {
        // 简单 console 提示,可后续接 toast
        console.info('[Updater] 已是最新版本')
      }
    })
    window.api.update.onProgress((p) =>
      set({ state: 'downloading', progress: p as UpdateProgress })
    )
    window.api.update.onDownloaded((info) =>
      set({ state: 'downloaded', info: info as UpdateInfo, progress: null })
    )
    window.api.update.onError((payload) => {
      const message = (payload as { message?: string })?.message ?? '未知错误'
      const manual = get().manuallyTriggered
      // 启动自动检查时仅 error 静默(网络不通 / 仓库未配)
      if (manual) {
        set({ state: 'error', errorMessage: message })
      } else {
        console.warn('[Updater] 静默错误:', message)
        set({ state: 'idle' })
      }
    })
    set({ subscribed: true })
  },

  async checkNow(manual) {
    set({ manuallyTriggered: manual, state: 'checking' })
    await window.api.update.checkNow()
  },

  async download() {
    set({ state: 'downloading', progress: null })
    await window.api.update.download()
  },

  async install() {
    await window.api.update.install()
  },

  dismiss() {
    set({ state: 'dismissed' })
  },

  reset() {
    set({ state: 'idle', info: null, progress: null, errorMessage: null, manuallyTriggered: false })
  }
}))

/** 把 releaseNotes(可能是 string / 数组 / null)规范成 string。 */
export function normalizeReleaseNotes(notes: UpdateInfo['releaseNotes']): string {
  if (!notes) return ''
  if (typeof notes === 'string') return notes
  if (Array.isArray(notes)) {
    return notes.map((n) => `### ${n.version}\n\n${n.note}`).join('\n\n---\n\n')
  }
  return ''
}
