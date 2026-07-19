import { useEffect, useRef } from 'react'
import type { BuildLogChunk, BuildTask, ModInfo } from '../types/api'
import { useBuildStore } from '../store/buildStore'

interface BuildingPaneProps {
  task: BuildTask
  /** 当前选中 Mod(用于 Header 显示)。 */
  selectedMod: ModInfo
  /** 全工程 Mod Id → ModInfo 映射,用于 stepper 显示名/版本。 */
  allMods: ModInfo[]
  /** 终态时关闭日志面板,回到 ModDetailPane。 */
  onClose(): void
}

/**
 * 编译进行中视图。覆盖 ModDetailPane,展示 stepper + 实时日志。
 * 对应 mockup `.claude/svg/modforge-workspace-building.svg`。
 */
export function BuildingPane({ task, selectedMod, allMods, onClose }: BuildingPaneProps) {
  const cancelBuild = useBuildStore((s) => s.cancelBuild)
  const logs = useBuildStore((s) => s.logs)
  const logEnd = useRef<HTMLDivElement | null>(null)

  // 自动滚到日志底部
  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [logs.length])

  const isRunning = task.status === 'running'
  const isSuccess = task.status === 'success'
  const isFailed = task.status === 'failed'
  const isCancelled = task.status === 'cancelled'

  const statusBadge = (() => {
    if (isRunning) return { text: '⚡ BUILDING', cls: 'text-brand-bright bg-brand-base/20 border-brand-base' }
    if (isSuccess) return { text: '✓ SUCCESS', cls: 'text-status-ok bg-status-ok/20 border-status-ok' }
    if (isFailed) return { text: '✗ FAILED', cls: 'text-status-danger bg-status-danger/20 border-status-danger' }
    if (isCancelled) return { text: '⏹ CANCELLED', cls: 'text-fg-mute bg-fg-mute/20 border-fg-mute' }
    return { text: '…', cls: 'text-fg-mute bg-fg-mute/20 border-fg-mute' }
  })()

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="p-7 pb-4 flex items-start gap-4 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-wide">{selectedMod.manifest?.name ?? selectedMod.modDir}</h1>
            <span className="text-sm font-mono text-brand-base">v{selectedMod.manifest?.version ?? '?'}</span>
            <span className={`px-2 h-6 inline-flex items-center text-2xs font-bold rounded-full border ${statusBadge.cls}`}>
              {statusBadge.text}
            </span>
          </div>
          <div className="text-2xs text-fg-muteBright mt-1.5">
            {isRunning
              ? `正在编译第 ${task.completedCount + 1} 个 Mod(${task.modIds.length} 总数)· dotnet build -c Release`
              : isSuccess
                ? `全部 ${task.modIds.length} Mod 编译完成 · 用时 ${formatDuration(task.endedAt! - task.startedAt)}`
                : isFailed
                  ? `编译失败 · ${task.failureReason ?? ''}`
                  : '已取消'}
          </div>
        </div>
        <div className="ml-auto">
          {isRunning ? (
            <button
              onClick={cancelBuild}
              className="h-10 px-4 rounded-lg text-sm font-bold text-status-danger bg-status-danger/10 border border-border-danger hover:bg-status-danger/20"
            >
              ⏹ 取消编译
            </button>
          ) : (
            <button onClick={onClose} className="btn-ghost h-10 px-4 rounded-lg text-sm">
              ✕ 关闭日志面板
            </button>
          )}
        </div>
      </header>

      {/* Stepper */}
      <section className="px-7 py-5 border-b border-border-subtle">
        <div className="flex items-center mb-3">
          <span className="block w-1 h-3.5 bg-brand-base" />
          <span className="ml-3 text-xs font-bold tracking-widest">编译进度 · 拓扑序</span>
          <span className="ml-auto text-2xs text-fg-muteBright">
            {task.completedCount} / {task.modIds.length} 完成
          </span>
        </div>
        <Stepper task={task} allMods={allMods} />
      </section>

      {/* Live log */}
      <section className="flex-1 flex flex-col min-h-0 px-7 py-4">
        <div className="flex items-center mb-3 shrink-0">
          <span className="block w-1 h-3.5 bg-brand-base" />
          <span className="ml-3 text-xs font-bold tracking-widest">实时输出</span>
          <span className="ml-auto text-2xs text-fg-muteBright">
            tail -f · 自动滚动 · {logs.length} 行
          </span>
        </div>
        <div className="flex-1 bg-bg-deepest border border-border-frame rounded-xl p-4 overflow-y-auto font-mono text-2xs leading-relaxed">
          {logs.map((chunk, i) => (
            <LogLine key={i} chunk={chunk} />
          ))}
          <div ref={logEnd} />
        </div>
      </section>
    </div>
  )
}

/** 多阶段 stepper(N 个 Mod + 部署 + 通知 Unity)。 */
function Stepper({ task, allMods }: { task: BuildTask; allMods: ModInfo[] }) {
  const idToMod = new Map(allMods.map((m) => [m.manifest?.id ?? m.modDir, m]))
  const totalSteps = task.modIds.length + 1 // +1 通知 Unity
  const completedSteps = task.completedCount + (task.status === 'success' ? 1 : 0)

  return (
    <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
      {task.modIds.map((modId, i) => {
        const mod = idToMod.get(modId)
        const state: 'done' | 'active' | 'pending' =
          i < task.completedCount ? 'done' : i === task.completedCount && task.status === 'running' ? 'active' : 'pending'
        return <Step key={modId} index={i + 1} label={mod?.manifest?.name ?? modId} sub={mod?.manifest ? `v${mod.manifest.version}` : ''} state={state} />
      })}
      <Step
        index={task.modIds.length + 1}
        label="通知 Unity"
        sub="DLL hash"
        state={task.status === 'success' ? 'done' : task.status === 'running' && task.completedCount === task.modIds.length ? 'active' : 'pending'}
      />
    </div>
  )
}

function Step({ index, label, sub, state }: { index: number; label: string; sub: string; state: 'done' | 'active' | 'pending' }) {
  return (
    <div className="flex flex-col items-center min-w-20 px-1">
      <div
        className={`w-10 h-10 rounded-full grid place-items-center text-sm font-extrabold ${
          state === 'done'
            ? 'bg-status-ok text-bg-base'
            : state === 'active'
              ? 'bg-bg-base border-2 border-brand-base text-brand-base'
              : 'bg-bg-base border-2 border-border-frame text-fg-muteDim'
        }`}
      >
        {state === 'done' ? '✓' : state === 'active' ? '⚡' : index}
      </div>
      <div className={`mt-2 text-2xs font-bold text-center ${state === 'done' ? 'text-status-ok' : state === 'active' ? 'text-brand-base' : 'text-fg-muteDim'}`}>
        {label}
      </div>
      <div className="text-3xs text-fg-muteBright">{sub}</div>
    </div>
  )
}

function LogLine({ chunk }: { chunk: BuildLogChunk }) {
  const colorClass = {
    info: 'text-fg-mute',
    ok: 'text-status-ok',
    warn: 'text-status-warn',
    err: 'text-status-danger',
    prompt: 'text-brand-bright'
  }[chunk.level]
  const prefix = chunk.modId ? `[${chunk.modId}] ` : ''
  return <div className={colorClass}>{prefix}{chunk.text}</div>
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  return `${m}m ${(s - m * 60).toFixed(0)}s`
}
