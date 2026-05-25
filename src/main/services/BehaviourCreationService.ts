import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import {
  renderBehaviour,
  type BehaviourTemplateKind,
  type BehaviourTemplateInput
} from '../templates/behaviourTemplate'
import type { ModScanService } from './ModScanService'

const CLASS_NAME_PATTERN = /^[A-Z][A-Za-z0-9_]*$/
const BEHAVIOUR_SUFFIX = 'Behaviour'

export interface CreateBehaviourInput {
  /** 桌游工程根。 */
  projectPath: string
  /** 目标 Mod 的子目录名(物理路径)。 */
  modDir: string
  /** 类名(自动补 Behaviour 后缀;若已带后缀则不重复加)。 */
  className: string
  /** Behaviour Id 全局唯一;由 caller 校验唯一(可调 ModScanService 取 snapshot 确认)。 */
  behaviourId: string
  /** Inspector 显示名;空时取 className(去掉 Behaviour 后缀)。 */
  displayName?: string
  /** Category 路径;空时按 `Mods/<modDir>/Behaviour` 派生。 */
  category?: string
  /** 起始模板。 */
  template: BehaviourTemplateKind
}

export interface CreateBehaviourResult {
  success: boolean
  /** 生成的 .cs 绝对路径。 */
  filePath: string
  errors: string[]
}

/**
 * 在已存在的 Mod 内创建新 Behaviour .cs 文件。
 * 校验:类名格式 + 文件不重名;behaviourId 唯一(扫工程整体确认);文件落到 <Mod>/src/<className>.cs。
 */
export class BehaviourCreationService {
  constructor(private scanService: ModScanService) {}

  async create(input: CreateBehaviourInput): Promise<CreateBehaviourResult> {
    const errors: string[] = []
    const className = ensureSuffix(input.className.trim())
    const srcDir = join(input.projectPath, 'ModBehaviourProject', input.modDir, 'src')
    const filePath = join(srcDir, `${className}.cs`)

    if (!CLASS_NAME_PATTERN.test(className)) {
      errors.push(`类名格式非法:"${className}";要求 ^[A-Z][A-Za-z0-9_]*$`)
    }
    if (!input.behaviourId || input.behaviourId.length === 0) {
      errors.push('Behaviour Id 为空')
    }
    if (errors.length > 0) return { success: false, filePath, errors }

    // 校验 src 目录存在
    const srcStat = await fs.stat(srcDir).catch(() => null)
    if (!srcStat?.isDirectory()) {
      errors.push(`目标 Mod 的 src 目录不存在:${srcDir}(请先创建 Mod 工程)`)
      return { success: false, filePath, errors }
    }
    // 校验同名 .cs 不存在
    const exists = await fs.stat(filePath).catch(() => null)
    if (exists?.isFile()) {
      errors.push(`同名文件已存在:${className}.cs`)
      return { success: false, filePath, errors }
    }

    // 校验 BehaviourId 全工程唯一
    const snap = await this.scanService.scanProject(input.projectPath)
    for (const m of snap.mods) {
      for (const b of m.behaviours) {
        if (b.behaviourId && b.behaviourId === input.behaviourId) {
          errors.push(`BehaviourId 已被占用:"${input.behaviourId}"(在 ${m.modDir}/${b.sourceFile})`)
          return { success: false, filePath, errors }
        }
      }
    }

    // 派生 displayName / category
    const displayName = input.displayName?.trim() || className.replace(/Behaviour$/, '')
    const category = input.category?.trim() || `Mods/${input.modDir}/Behaviour`

    const templateInput: BehaviourTemplateInput = {
      className,
      behaviourId: input.behaviourId,
      displayName,
      category,
      namespace: input.modDir
    }
    const text = renderBehaviour(input.template, templateInput)

    try {
      await fs.writeFile(filePath, text, 'utf-8')
    } catch (e) {
      errors.push(`写文件失败:${(e as Error).message}`)
      return { success: false, filePath, errors }
    }

    return { success: true, filePath, errors: [] }
  }
}

function ensureSuffix(name: string): string {
  if (name.endsWith(BEHAVIOUR_SUFFIX)) return name
  return name + BEHAVIOUR_SUFFIX
}
