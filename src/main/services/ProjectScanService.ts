import { promises as fs } from 'node:fs'
import { basename, join } from 'node:path'
import type { ProjectInfo } from '../types'

/**
 * 扫桌游工程文件夹,产出 ProjectInfo 列表;支持单工程详情查询。
 */
export class ProjectScanService {
  /**
   * 扫描某根目录的一级子目录,每个子目录视为一个桌游工程候选。
   * 失败(目录不存在 / 权限)返空数组,不抛。
   */
  async scan(rootDir: string): Promise<ProjectInfo[]> {
    if (!rootDir) return []
    let entries: string[]
    try {
      entries = await fs.readdir(rootDir)
    } catch {
      return []
    }

    const results: ProjectInfo[] = []
    for (const name of entries) {
      if (name.startsWith('.')) continue
      const full = join(rootDir, name)
      const stat = await fs.stat(full).catch(() => null)
      if (!stat?.isDirectory()) continue

      const info = await this.inspectModBehaviour(full)
      results.push({
        path: full,
        name,
        hasModBehaviourProject: info.hasMb,
        modCount: info.modCount
      })
    }
    // 按 name 字典序稳定
    results.sort((a, b) => a.name.localeCompare(b.name))
    return results
  }

  /**
   * 单工程详情扫描(用户手动浏览选某个工程时调用)。
   */
  async scanSingle(projectPath: string): Promise<ProjectInfo | null> {
    if (!projectPath) return null
    const st = await fs.stat(projectPath).catch(() => null)
    if (!st?.isDirectory()) return null
    const info = await this.inspectModBehaviour(projectPath)
    return {
      path: projectPath,
      name: basename(projectPath),
      hasModBehaviourProject: info.hasMb,
      modCount: info.modCount
    }
  }

  /**
   * 自动探测桌游工程文件夹根目录:
   * 1. 若有持久化的 lastScanRoot 且仍存在 → 用之
   * 2. 否则尝试推断 ModForge App 同级的 BoardGameEditor → 桌游工程文件/(中文目录名,与 BoardGameEditor 项目惯例一致)
   * 3. 都失败返 null,UI 弹手动浏览
   */
  async autoDetectRoot(savedRoot: string | null): Promise<string | null> {
    if (savedRoot) {
      const st = await fs.stat(savedRoot).catch(() => null)
      if (st?.isDirectory()) return savedRoot
    }
    // dev 模式 cwd 是 ModForgeApp/;production 是 install 目录,推断不准
    const candidates = [
      join(process.cwd(), '..', '桌游工程文件'),
      join(process.cwd(), '..', '..', '桌游工程文件')
    ]
    for (const candidate of candidates) {
      const st = await fs.stat(candidate).catch(() => null)
      if (st?.isDirectory()) return candidate
    }
    return null
  }

  private async inspectModBehaviour(projectPath: string): Promise<{ hasMb: boolean; modCount: number }> {
    const modBehaviourRoot = join(projectPath, 'ModBehaviourProject')
    const mbStat = await fs.stat(modBehaviourRoot).catch(() => null)
    if (!mbStat?.isDirectory()) return { hasMb: false, modCount: 0 }
    let modCount = 0
    try {
      const children = await fs.readdir(modBehaviourRoot)
      for (const c of children) {
        const cStat = await fs.stat(join(modBehaviourRoot, c)).catch(() => null)
        if (cStat?.isDirectory()) modCount++
      }
    } catch {
      // ignore
    }
    return { hasMb: true, modCount }
  }
}
