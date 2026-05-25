import { promises as fs } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import type { BehaviourMeta, ModInfo, ModListSnapshot } from '../types-mod'
import type { ModManifestReader } from './ModManifestReader'
import type { ModDependencyGraphService } from './ModDependencyGraphService'

/** 工程级 Mod 容器目录名常量,与框架侧 `ProjectModBehaviourLoader.ProjectDirName` 对齐。 */
const MOD_BEHAVIOUR_PROJECT_DIR = 'ModBehaviourProject'

/**
 * 扫描某绑定工程下的所有 Mod 子目录,产出含 manifest / dll 元信息 / Behaviour 列表的完整快照。
 * 同时调用依赖图服务计算拓扑序与错误。
 */
export class ModScanService {
  constructor(
    private manifestReader: ModManifestReader,
    private graphService: ModDependencyGraphService
  ) {}

  async scanProject(projectPath: string): Promise<ModListSnapshot> {
    const result: ModListSnapshot = {
      mods: [],
      topologyOrder: [],
      manifestErrors: [],
      dependencyErrors: [],
      hasError: false
    }

    const modBehaviourRoot = join(projectPath, MOD_BEHAVIOUR_PROJECT_DIR)
    let dirEntries: string[]
    try {
      dirEntries = await fs.readdir(modBehaviourRoot)
    } catch {
      // ModBehaviourProject 不存在 → 工程无 Mod(正常情况,空 snapshot)
      return result
    }

    for (const dirName of dirEntries) {
      if (dirName.startsWith('.')) continue
      const modDirPath = join(modBehaviourRoot, dirName)
      const stat = await fs.stat(modDirPath).catch(() => null)
      if (!stat?.isDirectory()) continue
      const mod = await this.scanSingleMod(dirName, modDirPath)
      result.mods.push(mod)
    }

    const graph = this.graphService.build(result.mods)
    result.topologyOrder = graph.topologyOrder
    result.manifestErrors = graph.manifestErrors
    result.dependencyErrors = graph.dependencyErrors
    result.hasError = result.manifestErrors.length > 0 || result.dependencyErrors.length > 0

    return result
  }

  private async scanSingleMod(modDir: string, modDirPath: string): Promise<ModInfo> {
    const { manifest, errors: manifestErrors } = await this.manifestReader.read(modDirPath)

    // 扫 dll(取 mod 根下第一个 .dll;manifest 暂不约束命名,因为旧 HelloMod 用 HelloModBehaviour.dll)
    let hasDll = false
    let dllPath: string | null = null
    let dllSize = 0
    let dllSha256: string | null = null
    let dllMtime: number | null = null

    try {
      const entries = await fs.readdir(modDirPath)
      for (const f of entries) {
        if (!f.toLowerCase().endsWith('.dll')) continue
        const full = join(modDirPath, f)
        const st = await fs.stat(full).catch(() => null)
        if (!st?.isFile()) continue
        hasDll = true
        dllPath = full
        dllSize = st.size
        dllMtime = st.mtimeMs
        try {
          const bytes = await fs.readFile(full)
          dllSha256 = createHash('sha256').update(bytes).digest('hex')
        } catch {
          // SHA 计算失败不阻塞元信息
        }
        break
      }
    } catch {
      // 目录读失败 → hasDll 保持 false
    }

    const behaviours = await this.scanBehaviours(join(modDirPath, 'src'))

    return {
      modDir,
      modDirPath,
      manifest,
      manifestErrors,
      hasDll,
      dllPath,
      dllSize,
      dllSha256,
      dllMtime,
      behaviours
    }
  }

  /** 正则扫 src/*.cs 提取 `[ModObjectBehaviour(...)] class XxxBehaviour`。 */
  private async scanBehaviours(srcDir: string): Promise<BehaviourMeta[]> {
    const out: BehaviourMeta[] = []
    let files: string[]
    try {
      files = await fs.readdir(srcDir)
    } catch {
      return out
    }

    for (const f of files) {
      if (!f.endsWith('.cs')) continue
      const full = join(srcDir, f)
      const st = await fs.stat(full).catch(() => null)
      if (!st?.isFile()) continue
      let text: string
      try {
        text = await fs.readFile(full, 'utf-8')
      } catch {
        continue
      }

      // 匹配 [ModObjectBehaviour(...)] 后紧跟的 class 声明;[\s\S] 允许跨行匹配 attribute 与 class 之间的修饰符
      const regex = /\[ModObjectBehaviour\s*\(([^)]*)\)\][\s\S]*?class\s+(\w+)/g
      let m: RegExpExecArray | null
      while ((m = regex.exec(text)) !== null) {
        const attrArgs = m[1]
        const className = m[2]
        const idMatch = /\bId\s*=\s*"([^"]+)"/.exec(attrArgs)
        const dnMatch = /\bDisplayName\s*=\s*"([^"]+)"/.exec(attrArgs)
        const catMatch = /\bCategory\s*=\s*"([^"]+)"/.exec(attrArgs)
        out.push({
          className,
          behaviourId: idMatch?.[1] ?? null,
          displayName: dnMatch?.[1] ?? null,
          category: catMatch?.[1] ?? null,
          sourceFile: f
        })
      }
    }
    return out
  }
}
