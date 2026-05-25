import { create } from 'zustand'
import type { BuildLogChunk, BuildTask } from '../types/api'

interface BuildState {
  task: BuildTask | null
  /** 日志增量数组(最长 2000 条,超出截前面)。 */
  logs: BuildLogChunk[]
  /** 是否已订阅 IPC 事件。 */
  subscribed: boolean

  /** 启动 IPC 事件订阅(在 App 挂载时调一次即可)。 */
  initSubscriptions(): void
  startBuild(projectPath: string, modId: string): Promise<string | null>
  cancelBuild(): Promise<void>
  clearLogs(): void
}

const MAX_LOGS = 2000

export const useBuildStore = create<BuildState>((set, get) => ({
  task: null,
  logs: [],
  subscribed: false,

  initSubscriptions() {
    if (get().subscribed) return
    window.api.build.onLogChunk((chunk) => {
      set((s) => {
        const next = s.logs.length >= MAX_LOGS ? s.logs.slice(s.logs.length - MAX_LOGS + 1) : s.logs.slice()
        next.push(chunk)
        return { logs: next }
      })
    })
    window.api.build.onStateChanged((task) => {
      set({ task })
    })
    // 首次启动同步取一次当前 task(可能 App 还没起就有任务在跑)
    window.api.build.getCurrentTask().then((task) => {
      if (task) set({ task })
    })
    set({ subscribed: true })
  },

  async startBuild(projectPath, modId) {
    // 清空 UI 日志,准备新一轮
    set({ logs: [], task: null })
    const result = await window.api.build.start({ projectPath, modId })
    if (result.error) {
      console.error('[buildStore] start failed', result.error)
      return result.error
    }
    return null
  },

  async cancelBuild() {
    await window.api.build.cancel()
  },

  clearLogs() {
    set({ logs: [] })
  }
}))
