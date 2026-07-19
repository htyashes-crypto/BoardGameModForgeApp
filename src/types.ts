/**
 * 前后端共享类型:与 Rust 各 command 的 serde camelCase 输出一一对齐,
 * 业务结构(ModInfo / ModListSnapshot 等)镜像旧 main/types*.ts。
 */

/** 桌游工程信息。 */
export interface ProjectInfo {
  path: string;
  name: string;
  hasModBehaviourProject: boolean;
  modCount: number;
  lastOpenedAt?: number;
}

export interface ProjectBindingSnapshot {
  bound: ProjectInfo | null;
  recent: ProjectInfo[];
}

/** mod.json 内一条 dependency 声明。 */
export interface ModDependency {
  id: string;
  versionRange: string;
}

export type ModLayer = "base" | "mid" | "app";

/** mod.json 的 JS 端镜像;镜像 C# 端 ModManifest。 */
export interface ModManifestJs {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies: ModDependency[];
  behaviourIdPrefix?: string;
  layer?: ModLayer;
}

/** 扫到的一个 [ModObjectBehaviour] 类元信息。 */
export interface BehaviourMeta {
  className: string;
  behaviourId: string | null;
  displayName: string | null;
  category: string | null;
  sourceFile: string;
}

/** Rust mod_scan_project_raw 的单 Mod 原始返回(manifest 校验在 TS 端做)。 */
export interface ModRawInfo {
  modDir: string;
  modDirPath: string;
  manifestPath: string;
  modJsonText: string | null;
  hasDll: boolean;
  dllPath: string | null;
  dllSize: number;
  dllSha256: string | null;
  dllMtime: number | null;
  behaviours: BehaviourMeta[];
}

/** 一个 Mod 的完整扫描结果(镜像旧 ModInfo)。 */
export interface ModInfo {
  modDir: string;
  modDirPath: string;
  manifest: ModManifestJs | null;
  manifestErrors: string[];
  hasDll: boolean;
  dllPath: string | null;
  dllSize: number;
  dllSha256: string | null;
  dllMtime: number | null;
  behaviours: BehaviourMeta[];
}

/** 一次工程扫描的完整快照(镜像旧 ModListSnapshot)。 */
export interface ModListSnapshot {
  mods: ModInfo[];
  topologyOrder: string[];
  manifestErrors: string[];
  dependencyErrors: string[];
  hasError: boolean;
}

export type BuildStatus = "pending" | "running" | "success" | "failed" | "cancelled";

export interface BuildLogChunk {
  ts: number;
  modId: string | null;
  level: "info" | "ok" | "warn" | "err" | "prompt";
  text: string;
}

export interface BuildTask {
  id: string;
  rootModId: string;
  modIds: string[];
  status: BuildStatus;
  completedCount: number;
  currentModId: string | null;
  startedAt: number;
  endedAt: number | null;
  logs: BuildLogChunk[];
  failedAt: string | null;
  failureReason: string | null;
}

/** build_start 的入参项(TS 端按拓扑闭包算好)。 */
export interface BuildModRef {
  modId: string;
  modDir: string;
  modDirPath: string;
}

export interface StartBuildReply {
  taskId: string;
  error?: string;
}

export interface DetectedIde {
  name: string;
  path: string;
}

export type ValidationCode =
  | "OK"
  | "PATH_NOT_FOUND"
  | "PATH_NOT_DIR"
  | "MISSING_MANIFEST"
  | "INVALID_MANIFEST"
  | "MISSING_LIB";

export interface ValidationResult {
  ok: boolean;
  code: ValidationCode;
  message: string;
  sdkVersion?: string;
  contentHash?: string;
}

export interface DevEnvSnapshot {
  modSdkPath: string | null;
  validation: ValidationResult | null;
}

export interface SdkBindings {
  sdkVersion?: string;
  contentHash?: string;
}

export interface DownloadResult {
  success: boolean;
  modSdkPath?: string;
  error?: string;
  output: string;
}

export interface GithubUrls {
  repoUrl: string;
  browseUrl: string;
}
