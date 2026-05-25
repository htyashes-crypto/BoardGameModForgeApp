import Store from 'electron-store'
import type { ProjectBindingSnapshot, ProjectInfo } from '../types'

interface BindingStoreShape {
  bound: ProjectInfo | null
  recent: ProjectInfo[]
  lastScanRoot: string | null
  preferredIdePath: string | null
}

const MAX_RECENT = 10

/**
 * 桌游工程绑定上下文 + 最近列表的持久化存储。
 * 用 electron-store 写到 %APPDATA%/modforge/modforge-binding.json。
 */
export class ProjectBindingService {
  private store: Store<BindingStoreShape>

  constructor() {
    this.store = new Store<BindingStoreShape>({
      name: 'modforge-binding',
      defaults: {
        bound: null,
        recent: [],
        lastScanRoot: null,
        preferredIdePath: null
      }
    })
  }

  getSnapshot(): ProjectBindingSnapshot {
    return {
      bound: this.store.get('bound'),
      recent: this.store.get('recent')
    }
  }

  /** 绑定工程,自动盖时间戳并入队 recent;同 path 已存在则提到队首。 */
  bind(project: ProjectInfo): void {
    const stamped: ProjectInfo = { ...project, lastOpenedAt: Date.now() }
    this.store.set('bound', stamped)

    const recent = this.store.get('recent').filter((p) => p.path !== project.path)
    recent.unshift(stamped)
    this.store.set('recent', recent.slice(0, MAX_RECENT))
  }

  unbind(): void {
    this.store.set('bound', null)
  }

  getLastScanRoot(): string | null {
    return this.store.get('lastScanRoot')
  }

  setLastScanRoot(rootDir: string): void {
    this.store.set('lastScanRoot', rootDir)
  }

  getPreferredIdePath(): string | null {
    return this.store.get('preferredIdePath')
  }

  setPreferredIdePath(path: string | null): void {
    this.store.set('preferredIdePath', path)
  }
}
