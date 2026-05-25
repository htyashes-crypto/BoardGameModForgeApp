import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { ModDependency, ModInfo } from '../types-mod'
import { renderCsproj, type SiblingModRef } from '../templates/csprojTemplate'
import { renderModJson } from '../templates/modJsonTemplate'
import { renderSln } from '../templates/slnTemplate'
import type { ModScanService } from './ModScanService'

const MOD_BEHAVIOUR_PROJECT_DIR = 'ModBehaviourProject'
const ID_PATTERN = /^[a-z][a-z0-9._-]+$/
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/

export interface CreateModInput {
  /** 桌游工程根路径(绑定工程)。 */
  projectPath: string
  /** Mod 名(英文,无空格,首字母字母);如 CABOGameLogic。 */
  modName: string
  /** Mod Id(全局唯一);如 com.boardgame.cabo.gamelogic。 */
  modId: string
  /** 版本号 semver;首版用 1.0.0。 */
  version: string
  description?: string
  author?: string
  /** Behaviour Id 命名空间前缀;默认从 modId 末段派生。 */
  behaviourIdPrefix?: string
  /** 依赖列表(基于 modId + 版本范围)。 */
  dependencies: ModDependency[]
}

export interface CreateModResult {
  success: boolean
  modDirPath: string
  /** 校验或写入失败累计;成功时空。 */
  errors: string[]
}

/**
 * 创建新 Mod 工程骨架(空 Mod,不内嵌任何 Behaviour 类):
 *  <projectPath>/ModBehaviourProject/<modName>/
 *  ├── mod.json
 *  └── src/
 *      ├── <modName>.csproj
 *      └── <modName>.sln
 *
 * 校验规则:modName 合法 + 不重名;modId 合法 + 不重名;dependencies 各项在当前工程已存在。
 */
export class ModCreationService {
  constructor(private scanService: ModScanService) {}

  async create(input: CreateModInput): Promise<CreateModResult> {
    const errors: string[] = []
    const modDirPath = join(input.projectPath, MOD_BEHAVIOUR_PROJECT_DIR, input.modName)

    // ===== 字段校验 =====
    if (!NAME_PATTERN.test(input.modName)) {
      errors.push(`Mod 名格式非法:"${input.modName}";要求 ^[A-Za-z][A-Za-z0-9_]*$`)
    }
    if (!ID_PATTERN.test(input.modId)) {
      errors.push(`Mod Id 格式非法:"${input.modId}";要求 ^[a-z][a-z0-9._-]+$`)
    }
    if (!/^\d+\.\d+\.\d+$/.test(input.version)) {
      errors.push(`版本格式非法:"${input.version}";要求 major.minor.patch`)
    }
    if (errors.length > 0) return { success: false, modDirPath, errors }

    // ===== 不重名校验(扫工程当前 Mod 列表)=====
    const snapshot = await this.scanService.scanProject(input.projectPath)
    const dirCollision = snapshot.mods.find((m) => m.modDir === input.modName)
    if (dirCollision) {
      errors.push(`已存在同名子目录:ModBehaviourProject/${input.modName}/`)
    }
    const idCollision = snapshot.mods.find((m) => m.manifest?.id === input.modId)
    if (idCollision) {
      errors.push(`已存在同名 Mod Id "${input.modId}"(在目录 ${idCollision.modDir})`)
    }
    if (errors.length > 0) return { success: false, modDirPath, errors }

    // ===== 依赖完整性校验(每个 dep id 必须在工程已存在)=====
    const idToMod = new Map<string, ModInfo>()
    for (const m of snapshot.mods) {
      if (m.manifest) idToMod.set(m.manifest.id, m)
    }
    const siblingRefs: SiblingModRef[] = []
    for (const dep of input.dependencies) {
      const target = idToMod.get(dep.id)
      if (!target) {
        errors.push(`依赖 "${dep.id}" 在当前工程内不存在(需先创建被依赖 Mod)`)
        continue
      }
      // siblingRefs 用 modDir(物理目录名)定位
      siblingRefs.push({
        modDirName: target.modDir,
        assemblyName: `${target.modDir}Behaviour`
      })
    }
    if (errors.length > 0) return { success: false, modDirPath, errors }

    // ===== 写文件 =====
    const srcDir = join(modDirPath, 'src')
    try {
      await fs.mkdir(srcDir, { recursive: true })
    } catch (e) {
      errors.push(`创建目录失败 ${modDirPath}:${(e as Error).message}`)
      return { success: false, modDirPath, errors }
    }

    const behaviourIdPrefix = input.behaviourIdPrefix ?? deriveBehaviourIdPrefix(input.modId)

    const modJsonText = renderModJson({
      id: input.modId,
      name: input.modName,
      version: input.version,
      description: input.description,
      author: input.author,
      behaviourIdPrefix,
      dependencies: input.dependencies
    })
    const csprojText = renderCsproj({ modName: input.modName, siblingMods: siblingRefs })
    const slnText = renderSln(input.modName)

    try {
      await fs.writeFile(join(modDirPath, 'mod.json'), modJsonText, 'utf-8')
      await fs.writeFile(join(srcDir, `${input.modName}.csproj`), csprojText, 'utf-8')
      await fs.writeFile(join(srcDir, `${input.modName}.sln`), slnText, 'utf-8')
    } catch (e) {
      errors.push(`写文件失败:${(e as Error).message}`)
      return { success: false, modDirPath, errors }
    }

    return { success: true, modDirPath, errors: [] }
  }
}

/** 从 modId 末段派生 BehaviourIdPrefix。如 com.boardgame.cabo.gamelogic → cabogamelogic。 */
function deriveBehaviourIdPrefix(modId: string): string {
  const parts = modId.split('.')
  const last = parts[parts.length - 1] ?? modId
  return last.toLowerCase().replace(/[^a-z0-9]/g, '')
}
