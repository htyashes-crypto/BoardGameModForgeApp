import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { BrowserWindow } from 'electron'
import type { BuildLogChunk, BuildStatus, BuildTask, StartBuildInput } from '../types-build'
import type { ModScanService } from './ModScanService'
import type { ModListSnapshot } from '../types-mod'

const DOTNET_TIMEOUT_MS = 5 * 60 * 1000 // 单 Mod 最长 5 分钟

/**
 * Mod 编译调度。按依赖拓扑序串行编译:用户点 X → 编 X 的所有上游依赖 → 编 X 自身。
 * 单一并发(同时只允许一个 task);取消请求让当前 dotnet 进程完成后停止后续(决策 5)。
 */
export class ModBuildService {
  private currentTask: BuildTask | null = null
  private cancelRequested = false

  constructor(private scanService: ModScanService) {}

  getCurrentTask(): BuildTask | null {
    return this.currentTask
  }

  async startBuild(input: StartBuildInput): Promise<{ taskId: string; error?: string }> {
    if (this.currentTask && this.currentTask.status === 'running') {
      return { taskId: '', error: '已有编译任务进行中' }
    }

    // 重扫工程获取最新依赖图
    const snapshot = await this.scanService.scanProject(input.projectPath)
    if (snapshot.hasError) {
      return {
        taskId: '',
        error: `工程含错误,无法编译。manifest:${snapshot.manifestErrors.length} 条;依赖:${snapshot.dependencyErrors.length} 条`
      }
    }

    // 计算要编译的拓扑序(rootMod 的上游传递闭包)
    const buildOrder = this.computeBuildOrder(snapshot, input.modId)
    if (buildOrder.length === 0) {
      return { taskId: '', error: `Mod Id "${input.modId}" 不在工程内` }
    }

    const task: BuildTask = {
      id: randomUUID(),
      rootModId: input.modId,
      modIds: buildOrder,
      status: 'pending',
      completedCount: 0,
      currentModId: null,
      startedAt: Date.now(),
      endedAt: null,
      logs: [],
      failedAt: null,
      failureReason: null
    }
    this.currentTask = task
    this.cancelRequested = false

    this.emitLog(task, null, 'info', `按拓扑序编译 ${buildOrder.length} Mod:${buildOrder.join(' → ')}`)
    task.status = 'running'
    this.emitStateChanged(task)

    // 异步执行,不阻塞 IPC return
    this.runTask(task, input.projectPath, snapshot).catch((err) => {
      this.emitLog(task, null, 'err', `调度异常:${(err as Error).message}`)
      this.finishTask(task, 'failed', null, (err as Error).message)
    })

    return { taskId: task.id }
  }

  requestCancel(): void {
    if (this.currentTask?.status === 'running') {
      this.cancelRequested = true
      this.emitLog(this.currentTask, null, 'warn', '已请求取消;当前 Mod 编完后即停止后续。')
    }
  }

  /** 计算 rootMod 的传递依赖闭包(含自身),按拓扑序返回。 */
  private computeBuildOrder(snapshot: ModListSnapshot, rootModId: string): string[] {
    const idToMod = new Map<string, { dependencies: string[] }>()
    for (const m of snapshot.mods) {
      if (!m.manifest) continue
      idToMod.set(m.manifest.id, {
        dependencies: m.manifest.dependencies.map((d) => d.id)
      })
    }
    if (!idToMod.has(rootModId)) return []

    // BFS 收集所有上游
    const visited = new Set<string>()
    const queue: string[] = [rootModId]
    while (queue.length > 0) {
      const cur = queue.shift()!
      if (visited.has(cur)) continue
      visited.add(cur)
      const node = idToMod.get(cur)
      if (!node) continue
      for (const dep of node.dependencies) queue.push(dep)
    }

    // 按整工程拓扑序过滤
    return snapshot.topologyOrder.filter((id) => visited.has(id))
  }

  private async runTask(task: BuildTask, projectPath: string, snapshot: ModListSnapshot): Promise<void> {
    for (let i = 0; i < task.modIds.length; i++) {
      if (this.cancelRequested) {
        this.emitLog(task, null, 'warn', '编译已取消(已完成 Mod 的 dll 保留)')
        this.finishTask(task, 'cancelled', null, '用户取消')
        return
      }

      const modId = task.modIds[i]
      task.currentModId = modId
      this.emitStateChanged(task)

      const mod = snapshot.mods.find((m) => m.manifest?.id === modId)
      if (!mod) {
        this.emitLog(task, modId, 'err', `Mod ${modId} 已不在工程内,跳过`)
        this.finishTask(task, 'failed', modId, 'Mod 不在工程内')
        return
      }

      this.emitLog(task, modId, 'prompt', `[${i + 1}/${task.modIds.length}] 编译 ${modId}(${mod.modDir})...`)

      const success = await this.compileSingleMod(task, mod.modDirPath, mod.modDir)
      if (!success) {
        this.finishTask(task, 'failed', modId, 'dotnet build 失败')
        return
      }

      // 拷贝 dll:bin/Release/netstandard2.1/<modDir>Behaviour.dll → <modDir>/<modDir>Behaviour.dll
      const dllName = `${mod.modDir}Behaviour.dll`
      const sourceDll = join(mod.modDirPath, 'src', 'bin', 'Release', 'netstandard2.1', dllName)
      const targetDll = join(mod.modDirPath, dllName)
      try {
        await fs.copyFile(sourceDll, targetDll)
        const stats = await fs.stat(targetDll)
        this.emitLog(task, modId, 'ok', `✓ 部署 ${dllName}(${formatBytes(stats.size)})`)
      } catch (e) {
        this.emitLog(task, modId, 'err', `部署 dll 失败:${(e as Error).message}`)
        this.finishTask(task, 'failed', modId, '部署 dll 失败')
        return
      }

      task.completedCount = i + 1
      this.emitStateChanged(task)
    }

    this.emitLog(task, null, 'ok', `✓ 全部 ${task.modIds.length} Mod 编译+部署完成`)
    this.emitLog(task, null, 'prompt', `Unity 端 ModBehaviourProjectSession 会检测 dll hash 变化并弹「请重启」提示`)
    this.finishTask(task, 'success', null, null)
  }

  /** 单 Mod 编译。stdout/stderr 流式推到 renderer。 */
  private async compileSingleMod(task: BuildTask, modDirPath: string, modDir: string): Promise<boolean> {
    return new Promise((resolve) => {
      const csprojPath = join(modDirPath, 'src', `${modDir}.csproj`)
      const args = ['build', csprojPath, '-c', 'Release', '--nologo']
      const child = spawn('dotnet', args, {
        cwd: join(modDirPath, 'src'),
        env: process.env,
        windowsHide: true,
        shell: false
      })

      const timeout = setTimeout(() => {
        this.emitLog(task, task.currentModId, 'err', `编译超时(${DOTNET_TIMEOUT_MS / 1000}s),kill 进程`)
        child.kill()
      }, DOTNET_TIMEOUT_MS)

      const onStdout = (data: Buffer) => {
        const text = data.toString().trim()
        if (text) this.emitLog(task, task.currentModId, classifyLogLevel(text), text)
      }
      const onStderr = (data: Buffer) => {
        const text = data.toString().trim()
        if (text) this.emitLog(task, task.currentModId, 'err', text)
      }
      child.stdout?.on('data', onStdout)
      child.stderr?.on('data', onStderr)
      child.on('error', (err) => {
        clearTimeout(timeout)
        this.emitLog(task, task.currentModId, 'err', `spawn dotnet 失败:${err.message}(请确认 PATH 中含 dotnet)`)
        resolve(false)
      })
      child.on('exit', (code) => {
        clearTimeout(timeout)
        if (code === 0) {
          this.emitLog(task, task.currentModId, 'ok', `✓ dotnet build exit 0`)
          resolve(true)
        } else {
          this.emitLog(task, task.currentModId, 'err', `✗ dotnet build exit ${code}`)
          resolve(false)
        }
      })
    })
  }

  private emitLog(task: BuildTask, modId: string | null, level: BuildLogChunk['level'], text: string): void {
    const chunk: BuildLogChunk = { ts: Date.now(), modId, level, text }
    task.logs.push(chunk)
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('build:log-chunk', chunk)
    }
  }

  private emitStateChanged(task: BuildTask): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('build:state-changed', task)
    }
  }

  private finishTask(task: BuildTask, status: BuildStatus, failedAt: string | null, reason: string | null): void {
    task.status = status
    task.endedAt = Date.now()
    task.currentModId = null
    task.failedAt = failedAt
    task.failureReason = reason
    this.emitStateChanged(task)
    this.cancelRequested = false
  }
}

function classifyLogLevel(text: string): BuildLogChunk['level'] {
  const lower = text.toLowerCase()
  if (lower.includes('error')) return 'err'
  if (lower.includes('warning')) return 'warn'
  if (lower.includes('build succeeded') || lower.includes('compile complete')) return 'ok'
  return 'info'
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}
