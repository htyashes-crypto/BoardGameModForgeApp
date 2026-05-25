import { contextBridge, ipcRenderer } from 'electron'

/**
 * 暴露给 renderer 的 ModForge API。命名空间分组:project / mod / behaviour / build / ide。
 * 阶段 1 只暴露 project.* —— 其他在后续 Phase 添加。
 */
const api = {
  project: {
    scan: (rootDir: string) => ipcRenderer.invoke('project:scan', rootDir),
    autoDetectRoot: () => ipcRenderer.invoke('project:autoDetectRoot'),
    getLastScanRoot: () => ipcRenderer.invoke('project:getLastScanRoot'),
    browseRoot: () => ipcRenderer.invoke('project:browseRoot'),
    browseSingleProject: () => ipcRenderer.invoke('project:browseSingleProject'),
    getSnapshot: () => ipcRenderer.invoke('project:getSnapshot'),
    bind: (project: unknown) => ipcRenderer.invoke('project:bind', project),
    unbind: () => ipcRenderer.invoke('project:unbind')
  },
  mod: {
    scanProject: (projectPath: string) => ipcRenderer.invoke('mod:scanProject', projectPath),
    create: (input: unknown) => ipcRenderer.invoke('mod:create', input)
  },
  behaviour: {
    create: (input: unknown) => ipcRenderer.invoke('behaviour:create', input)
  },
  build: {
    start: (input: unknown) => ipcRenderer.invoke('build:start', input),
    cancel: () => ipcRenderer.invoke('build:cancel'),
    getCurrentTask: () => ipcRenderer.invoke('build:getCurrentTask'),
    onLogChunk: (cb: (chunk: unknown) => void) => {
      const listener = (_event: unknown, chunk: unknown): void => cb(chunk)
      ipcRenderer.on('build:log-chunk', listener)
      return () => ipcRenderer.removeListener('build:log-chunk', listener)
    },
    onStateChanged: (cb: (task: unknown) => void) => {
      const listener = (_event: unknown, task: unknown): void => cb(task)
      ipcRenderer.on('build:state-changed', listener)
      return () => ipcRenderer.removeListener('build:state-changed', listener)
    }
  },
  ide: {
    detectAll: () => ipcRenderer.invoke('ide:detectAll'),
    getPreferred: () => ipcRenderer.invoke('ide:getPreferred'),
    setPreferred: (idePath: string | null) => ipcRenderer.invoke('ide:setPreferred', idePath),
    browseManual: () => ipcRenderer.invoke('ide:browseManual'),
    launch: (idePath: string, targetPath: string) => ipcRenderer.invoke('ide:launch', idePath, targetPath),
    openFolder: (folderPath: string) => ipcRenderer.invoke('ide:openFolder', folderPath)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ModForgeApi = typeof api
