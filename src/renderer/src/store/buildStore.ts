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
  /** 清空当前 task(用户在 BuildingPane 终态点「关闭」时调,回到 ModDetailPane)。 */
  clearTask(): void
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

    let result: { taskId: string; error?: string }
    try {
      result = await window.api.build.start({ projectPath, modId })
    } catch (e) {
      result = { taskId: '', error: `编译启动异常:${(e as Error)?.message ?? String(e)}` }
    }

    if (result.error) {
      // 把"早退错误"(dotnet 缺失 / 工程含错误 / 已有任务在跑 / IPC 异常)合成成一个 failed task,
      // 让 BuildingPane 直接展示原因。否则调用方(onBuild)吞掉返回值 → 表现为「点击无反应」(本次 BUG 根因)。
      const now = Date.now()
      set({
        task: {
          id: 'local-error',
          rootModId: modId,
          modIds: [],
          status: 'failed',
          completedCount: 0,
          currentModId: null,
          startedAt: now,
          endedAt: now,
          logs: [],
          failedAt: modId,
          failureReason: result.error
        },
        logs: [{ ts: now, modId: null, level: 'err', text: result.error }]
      })
      return result.error
    }
    return null
  },

  async cancelBuild() {
    await window.api.build.cancel()
  },

  clearLogs() {
    set({ logs: [] })
  },

  clearTask() {
    set({ task: null, logs: [] })
  }
}))
