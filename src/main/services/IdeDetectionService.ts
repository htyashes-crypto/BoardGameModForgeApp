import { spawn } from 'node:child_process'
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

interface StartAppEntry {
  Name: string
  AppID: string
}

/**
 * IDE 安装路径探测。
 *
 * **主链路:`Get-StartApps`**(Windows 开始菜单注册表查询)
 * - 覆盖几乎所有 GUI 装的应用,无需穷举硬编码路径
 * - 输出含 Name + AppID(可执行文件绝对路径或 UWP appid)
 * - 实测能找到 `D:\JetBrains Rider X.Y.Z\bin\rider64.exe` 等非标准路径
 *
 * **降级链路:硬编码标准路径扫描**
 * - 用于 Get-StartApps 不可用 / 应用未注册到开始菜单的兜底
 * - 覆盖 `%ProgramFiles%\cursor\` / Toolbox apps/Rider/ch-0/... 等标准位置
 *
 * 两路结果按 path 去重合并。
 */
export class IdeDetectionService {
  async detectAll(): Promise<DetectedIde[]> {
    const found: DetectedIde[] = []

    // 主链路
    const viaStartApps = await this.detectViaStartApps()
    found.push(...viaStartApps)

    // 降级链路(去重)
    const viaPaths = await this.detectViaHardcodedPaths()
    for (const ide of viaPaths) {
      const dupe = found.some((f) => f.path.toLowerCase() === ide.path.toLowerCase())
      if (!dupe) found.push(ide)
    }

    return found
  }

  /**
   * 通过 PowerShell `Get-StartApps` 查询开始菜单已注册的应用。
   * 返回所有名字 / AppID 含 IDE 关键字的条目。失败时返空数组(不阻塞 fallback)。
   */
  private async detectViaStartApps(): Promise<DetectedIde[]> {
    return new Promise((resolve) => {
      const child = spawn(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          'Get-StartApps | ConvertTo-Json -Compress'
        ],
        { windowsHide: true }
      )

      let stdout = ''
      let settled = false
      child.stdout?.on('data', (d) => (stdout += d.toString()))
      child.on('error', () => {
        if (!settled) {
          settled = true
          resolve([])
        }
      })
      child.on('exit', (code) => {
        if (settled) return
        settled = true
        if (code !== 0 || !stdout.trim()) {
          resolve([])
          return
        }
        try {
          const parsed = JSON.parse(stdout) as StartAppEntry | StartAppEntry[]
          const list = Array.isArray(parsed) ? parsed : [parsed]
          const results: DetectedIde[] = []
          for (const app of list) {
            if (!app || typeof app.Name !== 'string' || typeof app.AppID !== 'string') continue
            // 只接 .exe 形式的 AppID(过滤 UWP appid 如 `OpenAI.Codex_2p2nqsd0c76g0!App`)
            if (!app.AppID.toLowerCase().endsWith('.exe')) continue
            const name = this.classifyIdeName(app.Name, app.AppID)
            if (!name) continue
            results.push({ name, path: app.AppID })
          }
          resolve(results)
        } catch {
          resolve([])
        }
      })

      // 5 秒超时兜底
      setTimeout(() => {
        if (settled) return
        settled = true
        try {
          child.kill()
        } catch {
          // ignore
        }
        resolve([])
      }, 5000)
    })
  }

  /** 按 Name + AppID 关键字识别 IDE 类型。返 null 表示非已知 IDE。 */
  private classifyIdeName(name: string, appId: string): string | null {
    const lower = (name + ' ' + appId).toLowerCase()
    if (lower.includes('cursor')) return 'Cursor'
    if (lower.includes('rider')) return 'Rider'
    // 优先 VS Code 判定(它名字含 "visual studio code"),再判 VS
    if (lower.includes('visual studio code') || lower.includes('vscode')) return 'VSCode'
    if (lower.includes('visual studio') && !lower.includes('code')) return 'VS'
    return null
  }

  /** 硬编码标准路径扫描(降级链路)。 */
  private async detectViaHardcodedPaths(): Promise<DetectedIde[]> {
    const found: DetectedIde[] = []

    const cursorPaths = this.cursorCandidates()
    for (const p of cursorPaths) {
      if (await this.isFile(p)) {
        found.push({ name: 'Cursor', path: p })
        break
      }
    }

    const riderPath = await this.findRiderInToolbox()
    if (riderPath) found.push({ name: 'Rider', path: riderPath })
    else {
      const riderStandalone = this.riderStandaloneCandidates()
      for (const p of riderStandalone) {
        if (await this.isFile(p)) {
          found.push({ name: 'Rider', path: p })
          break
        }
      }
    }

    const vsPaths = this.vsCandidates()
    for (const p of vsPaths) {
      if (await this.isFile(p)) {
        found.push({ name: 'VS', path: p })
        break
      }
    }

    const vscodePaths = this.vscodeCandidates()
    for (const p of vscodePaths) {
      if (await this.isFile(p)) {
        found.push({ name: 'VSCode', path: p })
        break
      }
    }

    return found
  }

  private cursorCandidates(): string[] {
    const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
    const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files'
    const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
    return [
      join(programFiles, 'cursor', 'Cursor.exe'),
      join(programFiles, 'Cursor', 'Cursor.exe'),
      join(programFilesX86, 'cursor', 'Cursor.exe'),
      join(localAppData, 'Programs', 'cursor', 'Cursor.exe'),
      join(localAppData, 'Programs', 'Cursor', 'Cursor.exe')
    ]
  }

  private riderStandaloneCandidates(): string[] {
    const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files'
    const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
    return [
      join(programFiles, 'JetBrains', 'Rider', 'bin', 'rider64.exe'),
      join(programFilesX86, 'JetBrains', 'Rider', 'bin', 'rider64.exe')
    ]
  }

  private vsCandidates(): string[] {
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
  }

  private vscodeCandidates(): string[] {
    const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
    const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files'
    return [
      join(localAppData, 'Programs', 'Microsoft VS Code', 'Code.exe'),
      join(programFiles, 'Microsoft VS Code', 'Code.exe')
    ]
  }

  /** 在 JetBrains Toolbox apps/Rider/ch-0/<version>/bin/rider64.exe 找最新版。 */
  private async findRiderInToolbox(): Promise<string | null> {
    const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
    const root = join(localAppData, 'JetBrains', 'Toolbox', 'apps', 'Rider', 'ch-0')
    let versions: string[]
    try {
      versions = await fs.readdir(root)
    } catch {
      return null
    }
    versions.sort().reverse()
    for (const v of versions) {
      const candidate = join(root, v, 'bin', 'rider64.exe')
      if (await this.isFile(candidate)) return candidate
    }
    return null
  }

  private async isFile(p: string): Promise<boolean> {
    try {
      const st = await fs.stat(p)
      return st.isFile()
    } catch {
      return false
    }
  }
}
