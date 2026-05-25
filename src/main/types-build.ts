/** 编译任务状态机。 */
export type BuildStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled'

/** 单条编译日志条目;通过 'build:log-chunk' 事件增量推到 renderer。 */
export interface BuildLogChunk {
  /** 时间戳 ms。 */
  ts: number
  /** 哪个 mod 输出的(null 表示通用调度日志,如「按拓扑序编译 3 Mod」)。 */
  modId: string | null
  /** 日志级别。 */
  level: 'info' | 'ok' | 'warn' | 'err' | 'prompt'
  /** 文本。 */
  text: string
}

/** 编译任务快照,renderer 可重连重放历史日志。 */
export interface BuildTask {
  id: string
  /** 用户点编译的 Mod(叶子或中间)。 */
  rootModId: string
  /** 实际要编译的拓扑序(rootMod + 所有上游被依赖 Mod)。 */
  modIds: string[]
  status: BuildStatus
  /** 已完成的 Mod 索引(0..modIds.length);== length 表示全部完成。 */
  completedCount: number
  /** 当前编译中的 Mod Id;null 表示任务未开始或已结束。 */
  currentModId: string | null
  startedAt: number
  endedAt: number | null
  /** 任务级日志快照(初始建任务时为空,UI 通过事件增量追加)。 */
  logs: BuildLogChunk[]
  /** 失败时:首个失败的 Mod Id。 */
  failedAt: string | null
  /** 失败时的简短原因。 */
  failureReason: string | null
}

export interface StartBuildInput {
  projectPath: string
  /** 用户点编译的 Mod Id。 */
  modId: string
}
