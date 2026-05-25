/**
 * 主进程 ↔ renderer 共享类型(preload contextBridge 透传后 renderer 直接消费)。
 */

/** 桌游工程信息(主进程扫描结果)。 */
export interface ProjectInfo {
  /** 工程绝对路径。 */
  path: string
  /** 工程目录名(用作显示标题)。 */
  name: string
  /** 是否含 ModBehaviourProject 子目录(决定能否直接挂 Mod)。 */
  hasModBehaviourProject: boolean
  /** ModBehaviourProject/ 下的子目录数量(粗扫,不深入 manifest)。 */
  modCount: number
  /** 最近打开时间戳(ms,只有 recent 列表内有值)。 */
  lastOpenedAt?: number
}

/** 工程绑定快照(IPC 返回)。 */
export interface ProjectBindingSnapshot {
  /** 当前绑定工程,null 表示未绑定(用户停在 Hub 页)。 */
  bound: ProjectInfo | null
  /** 最近打开列表,按 lastOpenedAt desc。 */
  recent: ProjectInfo[]
}
