import { create } from 'zustand'

/**
 * 主题 store:dark / light 双主题切换,纯渲染层 localStorage 持久化(主进程无需感知)。
 *
 * 颜色由 globals.css 的 :root(dark) / .light channel 变量驱动,切换只是给 <html> 加/去 `light` class。
 * 首屏由 main.tsx 在 React 挂载前调 {@link applyThemeFromStorage} 同步应用,消除 FOUC。
 */

export type ThemeMode = 'dark' | 'light'

/** localStorage 键名。 */
const STORAGE_KEY = 'modforge-theme'

/** 读 localStorage 的主题;非 'light' 一律视为默认 'dark'。 */
function readStoredTheme(): ThemeMode {
  return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
}

/** 把主题应用到 <html>:light → class="light",dark → 移除该 class。 */
function applyThemeClass(theme: ThemeMode): void {
  document.documentElement.classList.toggle('light', theme === 'light')
}

/**
 * 首屏同步应用主题 class —— 必须在 React 挂载前调用,
 * 避免先以默认 dark 渲染再切到 light 的闪烁(FOUC)。
 */
export function applyThemeFromStorage(): void {
  applyThemeClass(readStoredTheme())
}

interface ThemeState {
  /** 当前主题。 */
  theme: ThemeMode
  /** 设置主题:写 localStorage + 应用到 <html> + 更新 state。 */
  setTheme(theme: ThemeMode): void
  /** 在 dark / light 之间切换。 */
  toggle(): void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readStoredTheme(),

  setTheme(theme) {
    localStorage.setItem(STORAGE_KEY, theme)
    applyThemeClass(theme)
    set({ theme })
  },

  toggle() {
    get().setTheme(get().theme === 'light' ? 'dark' : 'light')
  }
}))
