/**
 * Mod 相关数据契约(主进程 ↔ renderer 共享)。
 */

/** mod.json 内一条 dependency 声明。 */
export interface ModDependency {
  /** 被依赖 Mod 的全局 Id。 */
  id: string
  /** 版本范围(原始字符串,UI 展示用;主进程内部用 semver 校验)。 */
  versionRange: string
}

/** mod.json 的 JS 端镜像;镜像 C# 端 ModManifest。 */
export interface ModManifestJs {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  dependencies: ModDependency[]
  behaviourIdPrefix?: string
  /** 开发者声明的架构层级(主题群「Mod 开发环境作为独立引擎」收尾补完)。 */
  layer?: 'base' | 'mid' | 'app'
}

/** 扫到的一个 [ModObjectBehaviour] 类元信息(由 src/*.cs 正则提取)。 */
export interface BehaviourMeta {
  /** 类名(含 Behaviour 后缀)。 */
  className: string
  /** [ModObjectBehaviour(id)] 首个位置参数解析出的 BehaviourId(字面量或常量引用 resolve);解析不到时 null。 */
  behaviourId: string | null
  /** DisplayName attribute 参数。 */
  displayName: string | null
  /** Category attribute 参数。 */
  category: string | null
  /** 相对 src/ 的路径(含子目录),如 "Behaviours/RollDiceBehaviour.cs"。 */
  sourceFile: string
}

/** 一个 Mod 的完整扫描结果。 */
export interface ModInfo {
  /** Mod 子目录名(物理路径基础;manifest.Id 可能不同)。 */
  modDir: string
  /** Mod 绝对路径。 */
  modDirPath: string
  /** 解析后的 manifest;null 表示 mod.json 缺失或解析失败,详情见 manifestErrors。 */
  manifest: ModManifestJs | null
  /** manifest 解析累计错误。 */
  manifestErrors: string[]
  /** 是否存在 dll 产物。 */
  hasDll: boolean
  /** dll 绝对路径;无 dll 时 null。 */
  dllPath: string | null
  /** dll 字节数。 */
  dllSize: number
  /** dll SHA-256 hex。 */
  dllSha256: string | null
  /** dll 最后修改时间 ms。 */
  dllMtime: number | null
  /** 扫 src/*.cs 提取的 Behaviour 类列表。 */
  behaviours: BehaviourMeta[]
}

/** 一次 mod:scanProject 的完整快照。 */
export interface ModListSnapshot {
  /** 所有扫到的 Mod(含 manifest 错误的 Mod 也在内)。 */
  mods: ModInfo[]
  /** 拓扑加载序(Mod Id 数组),失败时空。 */
  topologyOrder: string[]
  /** 全部 manifest 解析错误汇总(带 [modDir] 前缀)。 */
  manifestErrors: string[]
  /** 依赖系统错误汇总(缺失 / 版本不匹配 / 循环 / Id 重复)。 */
  dependencyErrors: string[]
  /** 是否任一错误(任一非空 → true)。 */
  hasError: boolean
}
