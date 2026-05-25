import { promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** 检测到的 IDE 条目。 */
export interface DetectedIde {
  /** 名称:Cursor / Rider / VS / VSCode / Custom。 */
  name: string
  /** 可执行文件绝对路径。 */
  path: string
}

/** 候选 IDE 名 → 多个绝对路径(用环境变量函数式生成,避免硬编码盘符)。 */
type IdeCandidates = Record<string, () => string[]>

/**
 * IDE 安装路径探测。优先级:Cursor → Rider → VS → VSCode。
 * Windows 平台扫常见 user/system 安装位置;失败返回空列表 → UI 引导手动选 .exe。
 */
export class IdeDetectionService {
  private readonly candidates: IdeCandidates = {
    Cursor: () => {
      const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
      return [
        join(localAppData, 'Programs', 'cursor', 'Cursor.exe'),
        join(localAppData, 'Programs', 'Cursor', 'Cursor.exe')
      ]
    },
    Rider: () => {
      const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
      const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files'
      const out: string[] = []
      // Toolbox 安装(版本路径含 <version>,扫不到具体版本则在 runtime 内 scanDir 处理)
      out.push(join(localAppData, 'JetBrains', 'Toolbox', 'scripts', 'rider.cmd'))
      // 独立安装 — 占位常见路径
      out.push(join(programFiles, 'JetBrains', 'Rider', 'bin', 'rider64.exe'))
      return out
    },
    VS: () => {
      const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files'
      const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
      const editions = ['Community', 'Professional', 'Enterprise']
      const years = ['2022', '2019']
      const out: string[] = []
      for (const root of [programFiles, programFilesX86]) {
        for (const year of years) {
          for (const ed of editions) {
            out.push(join(root, 'Microsoft Visual Studio', year, ed, 'Common7', 'IDE', 'devenv.exe'))
          }
        }
      }
      return out
    },
    VSCode: () => {
      const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
      const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files'
      return [
        join(localAppData, 'Programs', 'Microsoft VS Code', 'Code.exe'),
        join(programFiles, 'Microsoft VS Code', 'Code.exe')
      ]
    }
  }

  /**
   * 检测所有候选 IDE,返回所有 hit 的条目(可能多个 IDE 都装了);未 hit 任何 IDE 返空数组。
   */
  async detectAll(): Promise<DetectedIde[]> {
    const found: DetectedIde[] = []
    for (const [name, getPaths] of Object.entries(this.candidates)) {
      const candidatePaths = getPaths()
      for (const p of candidatePaths) {
        try {
          const st = await fs.stat(p)
          if (st.isFile()) {
            found.push({ name, path: p })
            break // 同 IDE 只取首个 hit
          }
        } catch {
          // continue
        }
      }
    }
    // 额外扫 JetBrains Toolbox apps/ 子目录找最新版 Rider(独立安装路径若没找到)
    if (!found.some((f) => f.name === 'Rider')) {
      const riderViaToolbox = await this.tryFindRiderInToolbox()
      if (riderViaToolbox) found.push({ name: 'Rider', path: riderViaToolbox })
    }
    return found
  }

  /** 尝试在 JetBrains Toolbox apps/Rider/ch-0/<version>/bin/rider64.exe 找最新版。 */
  private async tryFindRiderInToolbox(): Promise<string | null> {
    const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
    const root = join(localAppData, 'JetBrains', 'Toolbox', 'apps', 'Rider', 'ch-0')
    let versions: string[]
    try {
      versions = await fs.readdir(root)
    } catch {
      return null
    }
    // 取字典序最大版本(简化:Rider 版本号字典序近似于发布时间)
    versions.sort().reverse()
    for (const v of versions) {
      const candidate = join(root, v, 'bin', 'rider64.exe')
      try {
        const st = await fs.stat(candidate)
        if (st.isFile()) return candidate
      } catch {
        // continue
      }
    }
    return null
  }
}
