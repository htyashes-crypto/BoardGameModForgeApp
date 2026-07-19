import Store from 'electron-store'
import { promises as fs } from 'node:fs'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join } from 'node:path'

/**
 * Mod 开发环境(ModSDK)路径 + GitHub 仓库下载管理。
 *
 * 主题群「Mod 开发环境作为独立引擎」Phase 5 用户反馈补完落地。
 *
 * 用户场景:
 * - **桌游开发者本机**:本机有 Unity Editor + 桌游编辑器源工程,可不配 ModSdk(csproj 走 fallback `$(UnityProjectRoot)Library\ScriptAssemblies\` + Warning)
 * - **Mod 开发者本机**(无 Unity):必须配 ModSdk 路径才能 build Mod。可通过 [从 GitHub 下载] 按钮直接 git clone 到本机任意目录
 */

export const GITHUB_REPO_URL = 'https://github.com/htyashes-crypto/BoardGameModSDK.git'
export const GITHUB_BROWSE_URL = 'https://github.com/htyashes-crypto/BoardGameModSDK'

export type ValidationCode =
  | 'OK'
  | 'PATH_NOT_FOUND'
  | 'PATH_NOT_DIR'
  | 'MISSING_MANIFEST'
  | 'INVALID_MANIFEST'
  | 'MISSING_LIB'

export interface ValidationResult {
  ok: boolean
  code: ValidationCode
  message: string
  /** 解析出的 SDK 版本号(若 manifest 可读)。 */
  sdkVersion?: string
  /** 解析出的内容 hash(若 manifest 可读)。 */
  contentHash?: string
}

export interface DevEnvSnapshot {
  modSdkPath: string | null
  validation: ValidationResult | null
}

interface DevEnvStoreShape {
  modSdkPath: string | null
}

/**
 * Mod SDK 路径管理 + GitHub 下载。
 */
export class ModDevEnvService {
  private store: Store<DevEnvStoreShape>

  constructor() {
    this.store = new Store<DevEnvStoreShape>({
      name: 'modforge-devenv',
      defaults: { modSdkPath: null }
    })
  }

  getModSdkPath(): string | null {
    return this.store.get('modSdkPath')
  }

  /**
   * 读当前配置 ModSdk 路径下 manifest.json 内的 sdkVersion + sourceContentHash 印章。
   * 给 ModCreationService 用于把这两个值写入新建 Mod 的 mod.json.sdkBindings。
   * 失败(未配置 / 文件不存在 / JSON 解析失败)→ 返 null 让上层不写 sdkBindings 字段。
   */
  getSdkBindings(): { sdkVersion?: string; contentHash?: string } | null {
    const path = this.getModSdkPath()
    if (!path) return null
    const manifestPath = join(path, 'manifest.json')
    if (!existsSync(manifestPath)) return null
    try {
      const text = require('node:fs').readFileSync(manifestPath, 'utf-8') as string
      const m = JSON.parse(text) as { sdkVersion?: string; sourceContentHash?: string }
      return {
        sdkVersion: m.sdkVersion,
        contentHash: m.sourceContentHash
      }
    } catch {
      return null
    }
  }

  setModSdkPath(path: string | null): void {
    this.store.set('modSdkPath', path)
  }

  async getSnapshot(): Promise<DevEnvSnapshot> {
    const modSdkPath = this.getModSdkPath()
    const validation = modSdkPath ? await this.validateModSdkPath(modSdkPath) : null
    return { modSdkPath, validation }
  }

  /**
   * 校验给定路径是否是有效的 ModSDK 目录(含 manifest.json 与 Lib/)。
   */
  async validateModSdkPath(path: string): Promise<ValidationResult> {
    if (!path) return { ok: false, code: 'PATH_NOT_FOUND', message: '路径为空' }
    if (!existsSync(path))
      return { ok: false, code: 'PATH_NOT_FOUND', message: `路径不存在:${path}` }

    const stat = await fs.stat(path).catch(() => null)
    if (!stat || !stat.isDirectory())
      return { ok: false, code: 'PATH_NOT_DIR', message: `不是目录:${path}` }

    const manifestPath = join(path, 'manifest.json')
    if (!existsSync(manifestPath))
      return {
        ok: false,
        code: 'MISSING_MANIFEST',
        message: `manifest.json 不存在:${manifestPath}(确认这是 BoardGameModSDK 目录,不是包含它的父目录)`
      }

    const libDir = join(path, 'Lib')
    if (!existsSync(libDir))
      return { ok: false, code: 'MISSING_LIB', message: `Lib/ 目录不存在:${libDir}` }

    let sdkVersion: string | undefined
    let contentHash: string | undefined
    try {
      const text = await fs.readFile(manifestPath, 'utf-8')
      const manifest = JSON.parse(text) as {
        sdkVersion?: string
        sourceContentHash?: string
      }
      sdkVersion = manifest.sdkVersion
      contentHash = manifest.sourceContentHash
    } catch (e) {
      return {
        ok: false,
        code: 'INVALID_MANIFEST',
        message: `manifest.json 解析失败:${(e as Error).message}`
      }
    }

    return {
      ok: true,
      code: 'OK',
      message: `ModSDK 路径有效${sdkVersion ? `(v${sdkVersion})` : ''}`,
      sdkVersion,
      contentHash
    }
  }

  /**
   * 从 GitHub clone BoardGameModSDK 到 targetDir。
   *
   * - 如果 targetDir 已存在 + `.git/` 已初始化:执行 `git pull`(增量更新)
   * - 否则:执行 `git clone https://github.com/htyashes-crypto/BoardGameModSDK.git <targetDir>`
   *
   * 返回最终 ModSDK 路径(成功时)。
   */
  async downloadFromGitHub(
    targetDir: string,
    onLog?: (line: string) => void
  ): Promise<{ success: boolean; modSdkPath?: string; error?: string; output: string }> {
    if (!targetDir)
      return { success: false, error: 'targetDir 为空', output: '' }

    const outputBuf: string[] = []
    const log = (line: string): void => {
      outputBuf.push(line)
      onLog?.(line)
    }

    // 检测 git 是否可用
    log('> 检测 git 可用性...')
    const gitCheck = await this.runCommand('git', ['--version'], { cwd: process.cwd() })
    if (!gitCheck.success) {
      return {
        success: false,
        error:
          '本机未检测到 git。请先安装 Git for Windows(https://git-scm.com/download/win),装完重启 ModForge。',
        output: outputBuf.join('\n')
      }
    }
    log(gitCheck.stdout.trim())

    const targetGitDir = join(targetDir, '.git')
    if (existsSync(targetDir) && existsSync(targetGitDir)) {
      // 已存在 git 仓库 → git pull 增量更新
      log(`> 检测到已有 git 仓库:${targetDir}`)
      log('> 执行 git pull(增量更新)...')
      const pullResult = await this.runCommand('git', ['pull'], { cwd: targetDir })
      log(pullResult.stdout)
      log(pullResult.stderr)
      if (!pullResult.success) {
        return {
          success: false,
          error: `git pull 失败(exit ${pullResult.exitCode})`,
          output: outputBuf.join('\n')
        }
      }
      log('> 增量更新完成')
      return { success: true, modSdkPath: targetDir, output: outputBuf.join('\n') }
    }

    // 全新 clone
    if (existsSync(targetDir)) {
      // 目录已存在但不是 git 仓库 — 拒绝(避免覆盖用户已有内容)
      return {
        success: false,
        error: `目标目录已存在但不是 git 仓库:${targetDir}。请选空目录或删除后重试。`,
        output: outputBuf.join('\n')
      }
    }

    log(`> 执行 git clone ${GITHUB_REPO_URL} ${targetDir}`)
    const cloneResult = await this.runCommand(
      'git',
      ['clone', GITHUB_REPO_URL, targetDir],
      { cwd: process.cwd() }
    )
    log(cloneResult.stdout)
    log(cloneResult.stderr)
    if (!cloneResult.success) {
      return {
        success: false,
        error: `git clone 失败(exit ${cloneResult.exitCode})`,
        output: outputBuf.join('\n')
      }
    }
    log('> Clone 完成')
    return { success: true, modSdkPath: targetDir, output: outputBuf.join('\n') }
  }

  /** 同步阻塞跑外部命令(spawn + 收 stdout/stderr;30 分钟兜底超时,git clone 大仓库可能慢)。 */
  private runCommand(
    cmd: string,
    args: string[],
    opts: { cwd: string }
  ): Promise<{ success: boolean; exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const stdoutBuf: string[] = []
      const stderrBuf: string[] = []
      let resolved = false

      const proc = spawn(cmd, args, {
        cwd: opts.cwd,
        windowsHide: true,
        shell: false
      })

      const timer = setTimeout(
        () => {
          if (resolved) return
          resolved = true
          try {
            proc.kill()
          } catch {
            /* ignore */
          }
          resolve({
            success: false,
            exitCode: -1,
            stdout: stdoutBuf.join(''),
            stderr: stderrBuf.join('') + '\n[超时 30 分钟,已 kill]'
          })
        },
        30 * 60 * 1000
      )

      proc.stdout.on('data', (chunk: Buffer) => stdoutBuf.push(chunk.toString('utf-8')))
      proc.stderr.on('data', (chunk: Buffer) => stderrBuf.push(chunk.toString('utf-8')))

      proc.on('error', (err) => {
        if (resolved) return
        resolved = true
        clearTimeout(timer)
        resolve({
          success: false,
          exitCode: -1,
          stdout: stdoutBuf.join(''),
          stderr: stderrBuf.join('') + '\n' + err.message
        })
      })

      proc.on('exit', (code) => {
        if (resolved) return
        resolved = true
        clearTimeout(timer)
        resolve({
          success: code === 0,
          exitCode: code ?? -1,
          stdout: stdoutBuf.join(''),
          stderr: stderrBuf.join('')
        })
      })
    })
  }
}
