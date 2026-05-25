import { create } from 'zustand'
import type { ProjectInfo } from '../types/api'

interface ProjectState {
  /** 当前绑定的桌游工程,null 表示未绑定(Hub 页)。 */
  bound: ProjectInfo | null
  /** 最近打开列表(主进程持久化在 electron-store)。 */
  recent: ProjectInfo[]
  /** 扫描到的桌游工程列表(当前扫描根的快照)。 */
  scanned: ProjectInfo[]
  /** 扫描根目录(用户上次设置的 rootDir,可空)。 */
  scanRoot: string | null
  /** 是否正在扫描。 */
  scanning: boolean
  /** 关键词过滤,空字符串不过滤。 */
  filterText: string

  /** 启动时从主进程拉取 snapshot + autoDetect 扫描根,触发首次 scan。 */
  hydrateFromMain(): Promise<void>
  /** 绑定一个工程,UI 切到 Workspace。 */
  bind(project: ProjectInfo): Promise<void>
  /** 解绑当前工程,UI 回 Hub。 */
  unbind(): Promise<void>
  /** 刷新扫描;rootDir 不传则用当前 scanRoot。 */
  refreshScan(rootDir?: string | null): Promise<void>
  /** 让用户浏览选个新的扫描根。 */
  browseScanRoot(): Promise<void>
  /** 让用户浏览单个工程并立即绑定(跳过 scan,直接 bind)。 */
  browseAndBindSingle(): Promise<void>
  /** 设置过滤文本。 */
  setFilterText(text: string): void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  bound: null,
  recent: [],
  scanned: [],
  scanRoot: null,
  scanning: false,
  filterText: '',

  async hydrateFromMain() {
    const snap = await window.api.project.getSnapshot()
    const detected = await window.api.project.autoDetectRoot()
    set({ bound: snap.bound, recent: snap.recent, scanRoot: detected })
    if (detected) {
      await get().refreshScan(detected)
    }
  },

  async bind(project: ProjectInfo) {
    const snap = await window.api.project.bind(project)
    set({ bound: snap.bound, recent: snap.recent })
  },

  async unbind() {
    const snap = await window.api.project.unbind()
    set({ bound: snap.bound, recent: snap.recent })
  },

  async refreshScan(rootDir?: string | null) {
    const target = rootDir ?? get().scanRoot
    if (!target) {
      set({ scanned: [], scanRoot: null })
      return
    }
    set({ scanning: true, scanRoot: target })
    try {
      const scanned = await window.api.project.scan(target)
      set({ scanned, scanning: false })
    } catch (err) {
      console.error('[projectStore] scan failed', err)
      set({ scanning: false })
    }
  },

  async browseScanRoot() {
    const path = await window.api.project.browseRoot()
    if (path) await get().refreshScan(path)
  },

  async browseAndBindSingle() {
    const project = await window.api.project.browseSingleProject()
    if (project) await get().bind(project)
  },

  setFilterText(text: string) {
    set({ filterText: text })
  }
}))
