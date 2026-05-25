import { create } from 'zustand'
import type { DetectedIde } from '../types/api'

interface IdeState {
  detected: DetectedIde[]
  preferredPath: string | null
  loading: boolean

  detect(): Promise<void>
  setPreferred(path: string | null): Promise<void>
  browseManualAndSet(): Promise<void>
  /** 用偏好 IDE(或 detected 优先级:Cursor→Rider→VS→VSCode 首项)启动目标。 */
  launchTarget(targetPath: string): Promise<void>
  /** 派生:取实际要用的 IDE(偏好 > Cursor > Rider > VS > VSCode > null)。 */
  resolveActiveIde(): DetectedIde | null
}

const PRIORITY = ['Cursor', 'Rider', 'VS', 'VSCode']

export const useIdeStore = create<IdeState>((set, get) => ({
  detected: [],
  preferredPath: null,
  loading: false,

  async detect() {
    set({ loading: true })
    try {
      const [detected, preferred] = await Promise.all([
        window.api.ide.detectAll(),
        window.api.ide.getPreferred()
      ])
      set({ detected, preferredPath: preferred, loading: false })
    } catch (err) {
      console.error('[ideStore] detect failed', err)
      set({ loading: false })
    }
  },

  async setPreferred(path) {
    await window.api.ide.setPreferred(path)
    set({ preferredPath: path })
  },

  async browseManualAndSet() {
    const path = await window.api.ide.browseManual()
    if (path) {
      await window.api.ide.setPreferred(path)
      // 把手动选的也加进 detected(标 Custom)
      const detected = get().detected.slice()
      if (!detected.some((d) => d.path === path)) {
        detected.push({ name: 'Custom', path })
      }
      set({ preferredPath: path, detected })
    }
  },

  async launchTarget(targetPath) {
    const active = get().resolveActiveIde()
    if (!active) {
      console.warn('[ideStore] 无可用 IDE,先扫描或手动选')
      return
    }
    await window.api.ide.launch(active.path, targetPath)
  },

  resolveActiveIde() {
    const { preferredPath, detected } = get()
    if (preferredPath) {
      const match = detected.find((d) => d.path === preferredPath)
      if (match) return match
      // 偏好路径不在 detected 列表(可能手动选的且 detect 后丢)→ 当 Custom 用
      return { name: 'Custom', path: preferredPath }
    }
    for (const name of PRIORITY) {
      const hit = detected.find((d) => d.name === name)
      if (hit) return hit
    }
    return null
  }
}))
