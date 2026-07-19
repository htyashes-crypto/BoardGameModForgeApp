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
    create: (input: unknown) => ipcRenderer.invoke('mod:create', input),
    delete: (input: unknown) => ipcRenderer.invoke('mod:delete', input)
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
  devEnv: {
    getSnapshot: () => ipcRenderer.invoke('devEnv:getSnapshot'),
    browseModSdkDir: () => ipcRenderer.invoke('devEnv:browseModSdkDir'),
    browseDownloadDir: () => ipcRenderer.invoke('devEnv:browseDownloadDir'),
    validateModSdkPath: (path: string) => ipcRenderer.invoke('devEnv:validateModSdkPath', path),
    setModSdkPath: (path: string | null) => ipcRenderer.invoke('devEnv:setModSdkPath', path),
    downloadFromGitHub: (targetDir: string) => ipcRenderer.invoke('devEnv:downloadFromGitHub', targetDir),
    openGitHubUrl: () => ipcRenderer.invoke('devEnv:openGitHubUrl'),
    getGitHubRepoUrl: () => ipcRenderer.invoke('devEnv:getGitHubRepoUrl'),
    onDownloadLog: (cb: (line: string) => void) => {
      const listener = (_e: unknown, line: string): void => cb(line)
      ipcRenderer.on('devEnv:downloadLog', listener)
      return () => ipcRenderer.removeListener('devEnv:downloadLog', listener)
    }
  },
  ide: {
    detectAll: () => ipcRenderer.invoke('ide:detectAll'),
    getPreferred: () => ipcRenderer.invoke('ide:getPreferred'),
    setPreferred: (idePath: string | null) => ipcRenderer.invoke('ide:setPreferred', idePath),
    browseManual: () => ipcRenderer.invoke('ide:browseManual'),
    launch: (idePath: string, targetPath: string) => ipcRenderer.invoke('ide:launch', idePath, targetPath),
    openFolder: (folderPath: string) => ipcRenderer.invoke('ide:openFolder', folderPath)
  },
  update: {
    checkNow: () => ipcRenderer.invoke('update:checkNow'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    onChecking: (cb: () => void) => {
      const listener = (): void => cb()
      ipcRenderer.on('update:checking', listener)
      return () => ipcRenderer.removeListener('update:checking', listener)
    },
    onAvailable: (cb: (info: unknown) => void) => {
      const listener = (_e: unknown, info: unknown): void => cb(info)
      ipcRenderer.on('update:available', listener)
      return () => ipcRenderer.removeListener('update:available', listener)
    },
    onNotAvailable: (cb: (info: unknown) => void) => {
      const listener = (_e: unknown, info: unknown): void => cb(info)
      ipcRenderer.on('update:notAvailable', listener)
      return () => ipcRenderer.removeListener('update:notAvailable', listener)
    },
    onProgress: (cb: (progress: unknown) => void) => {
      const listener = (_e: unknown, progress: unknown): void => cb(progress)
      ipcRenderer.on('update:progress', listener)
      return () => ipcRenderer.removeListener('update:progress', listener)
    },
    onDownloaded: (cb: (info: unknown) => void) => {
      const listener = (_e: unknown, info: unknown): void => cb(info)
      ipcRenderer.on('update:downloaded', listener)
      return () => ipcRenderer.removeListener('update:downloaded', listener)
    },
    onError: (cb: (payload: unknown) => void) => {
      const listener = (_e: unknown, payload: unknown): void => cb(payload)
      ipcRenderer.on('update:error', listener)
      return () => ipcRenderer.removeListener('update:error', listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ModForgeApi = typeof api
