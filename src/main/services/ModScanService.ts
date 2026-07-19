import { promises as fs, type Dirent } from 'node:fs'
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

  /**
   * 源工程模式入口:接收**桌游工程根**,内部 join `ModBehaviourProject/` 后委托给 {@link scanModRoot}。
   * 主题群 Phase 5 Step 4 后,Standalone 模式调用方直接走 {@link scanModRoot} 接收 `<exe>/Mods/`。
   */
  async scanProject(projectPath: string): Promise<ModListSnapshot> {
    const modBehaviourRoot = join(projectPath, MOD_BEHAVIOUR_PROJECT_DIR)
    return this.scanModRoot(modBehaviourRoot)
  }

  /**
   * 直接扫某 mod 根目录(`<projectRoot>/ModBehaviourProject/` 或 `<exe>/Mods/`)。
   * 主题群「独立桌游包内嵌 Mod SDK」Phase 5 Step 4:Standalone 模式经此入口。
   */
  async scanModRoot(modBehaviourRoot: string): Promise<ModListSnapshot> {
    const result: ModListSnapshot = {
      mods: [],
      topologyOrder: [],
      manifestErrors: [],
      dependencyErrors: [],
      hasError: false
    }

    let dirEntries: string[]
    try {
      dirEntries = await fs.readdir(modBehaviourRoot)
    } catch {
      // 根目录不存在 → 当前无 Mod(正常情况,空 snapshot)
      return result
    }

    for (const dirName of dirEntries) {
      if (dirName.startsWith('.')) continue
      const modDirPath = join(modBehaviourRoot, dirName)
      const stat = await fs.stat(modDirPath).catch(() => null)
      if (!stat?.isDirectory()) continue

      // 主题群「Mod 开发环境作为独立引擎」补完:与 Loader 对齐 —
      // 没有 mod.json 的子目录是支撑目录(Shared/Generated 等放共享 dll/codegen 产物),
      // 静默跳过不视为 Mod;只有"有 mod.json 但解析失败"才作为 Mod 报 manifestErrors。
      const manifestPath = join(modDirPath, 'mod.json')
      const manifestExists = await fs
        .stat(manifestPath)
        .then((s) => s.isFile())
        .catch(() => false)
      if (!manifestExists) continue

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

  /**
   * 递归扫 src/ 下所有 *.cs(含 Behaviours/ Models/ Util/ 等子目录分层)提取
   * `[ModObjectBehaviour(...)] class XxxBehaviour`。
   *
   * 根因式修复要点:
   * 1. **递归**:旧实现仅 readdir 第一层,开发者按 .NET 常规用子目录组织代码时一个都扫不到;
   *    现递归遍历(跳过 obj/bin 等 MSBuild 产物目录)。
   * 2. **behaviourId 支持常量引用**:构造函数首个位置参数即 BehaviourId(见 ModObjectBehaviourAttribute(string id)),
   *    既可是字面量 "com.x.y" 也可是常量引用 MyConstants.XxxId;后者经 src/ 内 const string 映射 resolve 出真实值。
   * 3. **引号感知取参**:平衡括号解析替代脆弱的 [^)]*,避免 Description 内含 ')' 时整条 attribute 漏匹配。
   */
  private async scanBehaviours(srcDir: string): Promise<BehaviourMeta[]> {
    const out: BehaviourMeta[] = []

    // 递归收集 src/ 下全部 .cs 相对路径(开发者常用 Behaviours/ Models/ Util/ 子目录分层)
    const relFiles = await this.collectCsFiles(srcDir)
    if (relFiles.length === 0) return out

    // 先读全部文本:既用于扫 attribute,也用于建 const string 映射供 behaviourId 常量引用 resolve
    const texts: { rel: string; text: string }[] = []
    for (const rel of relFiles) {
      try {
        texts.push({ rel, text: await fs.readFile(join(srcDir, rel), 'utf-8') })
      } catch {
        // 单文件读失败跳过,不阻塞其余
      }
    }
    const constMap = this.buildConstStringMap(texts.map((t) => t.text))

    for (const { rel, text } of texts) {
      const attrStart = /\[ModObjectBehaviour\s*\(/g
      let m: RegExpExecArray | null
      while ((m = attrStart.exec(text)) !== null) {
        const openIdx = m.index + m[0].length - 1 // 指向 '('
        const paren = this.readBalancedParen(text, openIdx)
        if (!paren) continue
        // ']' 必须紧跟 ')' 之后,再非贪婪匹配到 class 声明
        const classMatch = /^\s*\][\s\S]*?\bclass\s+(\w+)/.exec(text.slice(paren.closeIdx + 1))
        if (!classMatch) continue

        const args = paren.inner
        const dnMatch = /\bDisplayName\s*=\s*"([^"]*)"/.exec(args)
        const catMatch = /\bCategory\s*=\s*"([^"]*)"/.exec(args)
        out.push({
          className: classMatch[1],
          behaviourId: this.resolveBehaviourId(args, constMap),
          displayName: dnMatch?.[1] ?? null,
          category: catMatch?.[1] ?? null,
          sourceFile: rel
        })
        attrStart.lastIndex = paren.closeIdx // 推进游标,跳过已消费的参数区
      }
    }
    return out
  }

  /** 递归收集 dir 下所有 .cs 相对路径(相对最初 srcDir);跳过隐藏目录与 obj/bin 等 MSBuild 产物目录。 */
  private async collectCsFiles(dir: string, relBase = ''): Promise<string[]> {
    const out: string[] = []
    let entries: Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return out
    }
    for (const e of entries) {
      const rel = relBase ? `${relBase}/${e.name}` : e.name
      if (e.isDirectory()) {
        // 跳过隐藏目录 + build 产物目录(obj/bin),避免扫到自动生成的 AssemblyInfo.cs
        if (e.name.startsWith('.') || e.name === 'obj' || e.name === 'bin') continue
        out.push(...(await this.collectCsFiles(join(dir, e.name), rel)))
      } else if (e.isFile() && e.name.endsWith('.cs')) {
        out.push(rel)
      }
    }
    return out
  }

  /** 扫所有 .cs 文本提取 `const string X = "..."` / `static readonly string X = "..."`,建 字段名→值 映射。 */
  private buildConstStringMap(texts: string[]): Map<string, string> {
    const map = new Map<string, string>()
    const re = /\b(?:const|static\s+readonly|readonly\s+static)\s+string\s+(\w+)\s*=\s*"([^"]*)"/g
    for (const t of texts) {
      let m: RegExpExecArray | null
      while ((m = re.exec(t)) !== null) {
        // 同名取首个;跨文件重名罕见,不覆盖
        if (!map.has(m[1])) map.set(m[1], m[2])
      }
    }
    return map
  }

  /**
   * 从 openIdx 指向的 '(' 起,引号 + 嵌套括号感知地读到配对 ')'。
   * 返回括号内文本与 ')' 的索引;不配对返回 null。
   */
  private readBalancedParen(
    text: string,
    openIdx: number
  ): { inner: string; closeIdx: number } | null {
    let depth = 0
    let inStr = false
    for (let i = openIdx; i < text.length; i++) {
      const c = text[i]
      if (inStr) {
        if (c === '\\') {
          i++ // 跳过转义字符
          continue
        }
        if (c === '"') inStr = false
        continue
      }
      if (c === '"') inStr = true
      else if (c === '(') depth++
      else if (c === ')') {
        depth--
        if (depth === 0) return { inner: text.slice(openIdx + 1, i), closeIdx: i }
      }
    }
    return null
  }

  /**
   * 解析 [ModObjectBehaviour(...)] 的 BehaviourId:取首个位置参数,
   * 字面量直取,常量引用(如 MyConstants.XxxId)经 const 映射 resolve;均失败返回 null。
   */
  private resolveBehaviourId(args: string, constMap: Map<string, string>): string | null {
    const first = this.firstPositionalArg(args)
    if (!first) return null
    const lit = /^@?"([\s\S]*?)"$/.exec(first)
    if (lit) return lit[1] // 字符串字面量
    // 标识符引用:取末段(MyConstants.XxxId → XxxId)在 const 映射查真实值
    const ident = (first.split('.').pop() ?? '').trim()
    if (/^\w+$/.test(ident) && constMap.has(ident)) return constMap.get(ident)!
    return null // 真未知 → null,UI 保留"⚠ 缺 Id"语义
  }

  /** 取 attribute 参数文本的首个位置参数(引号 + 括号感知,到第一个顶层逗号为止)。 */
  private firstPositionalArg(args: string): string | null {
    let inStr = false
    let depth = 0
    for (let i = 0; i < args.length; i++) {
      const c = args[i]
      if (inStr) {
        if (c === '\\') {
          i++
          continue
        }
        if (c === '"') inStr = false
        continue
      }
      if (c === '"') inStr = true
      else if (c === '(' || c === '[') depth++
      else if (c === ')' || c === ']') depth--
      else if (c === ',' && depth === 0) return args.slice(0, i).trim()
    }
    const trimmed = args.trim()
    return trimmed.length > 0 ? trimmed : null
  }
}
