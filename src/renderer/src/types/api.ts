/**
 * preload 暴露的 window.api 类型映射;与 src/preload/index.ts 的 api 对象保持同步。
 * 这里独立声明,renderer 端无法直接 import preload 模块(跨域)。
 */

import type { ProjectBindingSnapshot, ProjectInfo } from '../../../main/types'
import type { ModListSnapshot, ModInfo, BehaviourMeta, ModManifestJs, ModDependency } from '../../../main/types-mod'
import type { BuildTask, BuildLogChunk, StartBuildInput } from '../../../main/types-build'

export interface ModForgeWindowApi {
  project: {
    scan(rootDir: string): Promise<ProjectInfo[]>
    autoDetectRoot(): Promise<string | null>
    getLastScanRoot(): Promise<string | null>
    browseRoot(): Promise<string | null>
    browseSingleProject(): Promise<ProjectInfo | null>
    getSnapshot(): Promise<ProjectBindingSnapshot>
    bind(project: ProjectInfo): Promise<ProjectBindingSnapshot>
    unbind(): Promise<ProjectBindingSnapshot>
  }
  mod: {
    scanProject(projectPath: string): Promise<ModListSnapshot>
    create(input: CreateModInput): Promise<CreateModResult>
    delete(input: DeleteModInput): Promise<DeleteModResult>
  }
  devEnv: {
    getSnapshot(): Promise<DevEnvSnapshot>
    browseModSdkDir(): Promise<string | null>
    browseDownloadDir(): Promise<string | null>
    validateModSdkPath(path: string): Promise<ValidationResult>
    setModSdkPath(path: string | null): Promise<DevEnvSnapshot>
    downloadFromGitHub(targetDir: string): Promise<{
      success: boolean
      modSdkPath?: string
      error?: string
      output: string
    }>
    openGitHubUrl(): Promise<string>
    getGitHubRepoUrl(): Promise<string>
    onDownloadLog(cb: (line: string) => void): () => void
  }
  behaviour: {
    create(input: CreateBehaviourInput): Promise<CreateBehaviourResult>
  }
  build: {
    start(input: StartBuildInput): Promise<{ taskId: string; error?: string }>
    cancel(): Promise<void>
    getCurrentTask(): Promise<BuildTask | null>
    /** 订阅日志增量;返回 unsubscribe。 */
    onLogChunk(cb: (chunk: BuildLogChunk) => void): () => void
    /** 订阅 task 状态变更;返回 unsubscribe。 */
    onStateChanged(cb: (task: BuildTask) => void): () => void
  }
  ide: {
    detectAll(): Promise<DetectedIde[]>
    getPreferred(): Promise<string | null>
    setPreferred(idePath: string | null): Promise<void>
    browseManual(): Promise<string | null>
    launch(idePath: string, targetPath: string): Promise<void>
    openFolder(folderPath: string): Promise<void>
  }
  update: {
    checkNow(): Promise<void>
    download(): Promise<void>
    install(): Promise<void>
    onChecking(cb: () => void): () => void
    onAvailable(cb: (info: unknown) => void): () => void
    onNotAvailable(cb: (info: unknown) => void): () => void
    onProgress(cb: (progress: unknown) => void): () => void
    onDownloaded(cb: (info: unknown) => void): () => void
    onError(cb: (payload: unknown) => void): () => void
  }
}

export interface DetectedIde {
  name: string
  path: string
}

// 原 `StandaloneContextDto` 已删(主题群「Mod 开发环境作为独立引擎」Phase 5)— 单一工作模式回退,无需 standalone context

/**
 * Mod 开发环境(ModSDK)路径校验结果(与 main 端 `ModDevEnvService.ValidationResult` 同步)。
 */
export interface ValidationResult {
  ok: boolean
  code:
    | 'OK'
    | 'PATH_NOT_FOUND'
    | 'PATH_NOT_DIR'
    | 'MISSING_MANIFEST'
    | 'INVALID_MANIFEST'
    | 'MISSING_LIB'
  message: string
  sdkVersion?: string
  contentHash?: string
}

export interface DevEnvSnapshot {
  modSdkPath: string | null
  validation: ValidationResult | null
}

/** Mod 架构层级(开发者声明)。 */
export type ModLayer = 'base' | 'mid' | 'app'

export interface CreateModInput {
  projectPath: string
  modName: string
  modId: string
  version: string
  description?: string
  author?: string
  behaviourIdPrefix?: string
  dependencies: ModDependency[]
  /** 开发者声明的架构层级(主题群「Mod 开发环境作为独立引擎」收尾补完)。 */
  layer?: ModLayer
}

export interface CreateModResult {
  success: boolean
  modDirPath: string
  errors: string[]
}

export interface DeleteModInput {
  projectPath: string
  modId: string
  modDirName: string
}

export interface DeleteModResult {
  success: boolean
  cancelled: boolean
  errors: string[]
}

export type BehaviourTemplateKind = 'empty' | 'tick' | 'subscribe' | 'chain'

export interface CreateBehaviourInput {
  projectPath: string
  modDir: string
  className: string
  behaviourId: string
  displayName?: string
  category?: string
  template: BehaviourTemplateKind
}

export interface CreateBehaviourResult {
  success: boolean
  filePath: string
  errors: string[]
}

declare global {
  interface Window {
    api: ModForgeWindowApi
  }
}

export type { ProjectInfo, ProjectBindingSnapshot, ModListSnapshot, ModInfo, BehaviourMeta, ModManifestJs, ModDependency, BuildTask, BuildLogChunk, StartBuildInput }
