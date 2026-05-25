import { create } from 'zustand'
import type { ModInfo, ModListSnapshot } from '../types/api'

interface ModState {
  /** 最近一次 mod:scanProject 的快照。 */
  snapshot: ModListSnapshot | null
  /** 当前选中的 Mod Id(manifest.Id);snapshot 切换时自动选拓扑序最后一项(应用层)作默认。 */
  selectedModId: string | null
  scanning: boolean

  scan(projectPath: string): Promise<void>
  selectMod(modId: string | null): void

  /** 派生:取当前选中 Mod 的完整 ModInfo。无效时 null。 */
  getSelectedMod(): ModInfo | null
  /** 派生:取某 Mod 依赖了谁(modId 数组)。 */
  getDependsOn(modId: string): string[]
  /** 派生:取被谁依赖。 */
  getUsedBy(modId: string): string[]
}

export const useModStore = create<ModState>((set, get) => ({
  snapshot: null,
  selectedModId: null,
  scanning: false,

  async scan(projectPath: string) {
    set({ scanning: true })
    try {
      const snap = await window.api.mod.scanProject(projectPath)
      // 默认选拓扑序最后一项(应用层);若拓扑失败则选 mods[0]
      let defaultId: string | null = null
      if (snap.topologyOrder.length > 0) defaultId = snap.topologyOrder[snap.topologyOrder.length - 1]
      else if (snap.mods.length > 0 && snap.mods[0].manifest) defaultId = snap.mods[0].manifest.id
      set({ snapshot: snap, scanning: false, selectedModId: defaultId })
    } catch (err) {
      console.error('[modStore] scan failed', err)
      set({ scanning: false })
    }
  },

  selectMod(modId) {
    set({ selectedModId: modId })
  },

  getSelectedMod() {
    const snap = get().snapshot
    const id = get().selectedModId
    if (!snap || !id) return null
    return snap.mods.find((m) => m.manifest?.id === id) ?? null
  },

  getDependsOn(modId) {
    const snap = get().snapshot
    if (!snap) return []
    const mod = snap.mods.find((m) => m.manifest?.id === modId)
    return mod?.manifest?.dependencies.map((d) => d.id) ?? []
  },

  getUsedBy(modId) {
    const snap = get().snapshot
    if (!snap) return []
    const result: string[] = []
    for (const m of snap.mods) {
      if (!m.manifest) continue
      for (const d of m.manifest.dependencies) {
        if (d.id === modId) {
          result.push(m.manifest.id)
          break
        }
      }
    }
    return result
  }
}))
