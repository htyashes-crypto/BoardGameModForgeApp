import type { ModInfo, ModListSnapshot } from '../types/api'
import { BehaviourCard } from './BehaviourCard'
import { DependencyStrip } from './DependencyStrip'

interface ModDetailPaneProps {
  mod: ModInfo
  snapshot: ModListSnapshot
  usedBy: string[]
  /** 当前可用 IDE 名(Cursor/Rider/VS/VSCode/Custom);null 表示未检测到 IDE。 */
  activeIdeName: string | null
  onOpenInIde(): void
  onBuild(): void
  onOpenFolder(): void
  onNewBehaviour(): void
}

/**
 * Mod 详情主面板(右侧)。整合标题/操作按钮/依赖 strip/Behaviour 列表/元信息卡。
 */
export function ModDetailPane({ mod, snapshot, usedBy, activeIdeName, onOpenInIde, onBuild, onOpenFolder, onNewBehaviour }: ModDetailPaneProps) {
  const manifest = mod.manifest
  if (!manifest) {
    return (
      <div className="p-7">
        <div className="text-status-danger text-sm font-bold">⚠ 该 Mod manifest 解析失败</div>
        <div className="mt-3 space-y-1">
          {mod.manifestErrors.map((err, i) => (
            <div key={i} className="text-2xs text-fg-mute font-mono">{err}</div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ===== Header ===== */}
      <header className="p-7 pb-4 flex items-start gap-4 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-wide">{manifest.name}</h1>
            <span className="text-sm font-mono text-fg-muteBright">v{manifest.version}</span>
            {mod.hasDll ? (
              <span className="px-2 h-5 inline-flex items-center text-3xs font-bold text-status-ok bg-status-ok/15 border border-status-ok/50 rounded-full">
                ✓ 已编译
              </span>
            ) : (
              <span className="px-2 h-5 inline-flex items-center text-3xs font-bold text-status-warn bg-status-warn/15 border border-status-warn/50 rounded-full">
                ⚠ 未编译
              </span>
            )}
          </div>
          <div className="text-2xs text-fg-muteBright mt-1.5 font-mono">
            {manifest.id} · {mod.behaviours.length} Behaviour 类
            {manifest.description && (
              <span className="ml-2 font-sans text-fg-mute">· {manifest.description}</span>
            )}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onOpenInIde}
            disabled={!activeIdeName}
            className="btn-primary h-10 px-4 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title={activeIdeName ? `用 ${activeIdeName} 打开 src/` : '未检测到 IDE,请到设置手动指定'}
          >
            ⚡ 在 {activeIdeName ?? '?'} 中打开
          </button>
          <button onClick={onBuild} className="btn-ghost h-10 px-4 rounded-lg text-sm">
            🔨 编译并部署
          </button>
          <button onClick={onOpenFolder} className="btn-ghost h-10 w-10 rounded-lg text-base grid place-items-center">
            📂
          </button>
          <button className="btn-ghost h-10 w-10 rounded-lg text-base grid place-items-center" title="更多">
            ⋯
          </button>
        </div>
      </header>

      {/* ===== Body 双列 ===== */}
      <div className="flex-1 overflow-hidden p-6 grid grid-cols-[1fr_320px] gap-5">
        {/* 左列:依赖 strip + Behaviour 列表 */}
        <div className="flex flex-col gap-5 overflow-hidden">
          <DependencyStrip mod={mod} snapshot={snapshot} usedBy={usedBy} />

          <section className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center mb-3">
              <span className="block w-1 h-3.5 bg-brand-base" />
              <span className="ml-3 text-xs font-bold tracking-widest">Mod 内 BEHAVIOUR 类</span>
              <span className="ml-auto text-2xs text-fg-muteBright">共 {mod.behaviours.length} 类</span>
              <button
                onClick={onNewBehaviour}
                className="ml-3 px-3 h-7 rounded-lg border border-brand-base/60 bg-brand-base/10 text-2xs font-bold text-brand-base hover:bg-brand-base/20"
              >
                ＋ 新建 Behaviour
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {mod.behaviours.length === 0 ? (
                <div className="card p-8 text-center text-fg-mute text-2xs">
                  尚无 Behaviour 类 · 点「＋ 新建 Behaviour」开始
                </div>
              ) : (
                mod.behaviours.map((b) => <BehaviourCard key={b.className} behaviour={b} />)
              )}
            </div>
          </section>
        </div>

        {/* 右列:Meta 卡 */}
        <aside className="flex flex-col gap-5 overflow-hidden">
          <section>
            <div className="flex items-center mb-3">
              <span className="block w-1 h-3.5 bg-brand-base" />
              <span className="ml-3 text-xs font-bold tracking-widest">Mod 元信息</span>
            </div>
            <div className="card p-4 space-y-3 text-2xs">
              <MetaRow label="MOD ID · VERSION">
                <div className="font-mono">{manifest.id}</div>
                <div className="font-mono text-brand-base mt-1">v{manifest.version}</div>
              </MetaRow>
              <div className="border-t border-border-subtle" />
              <MetaRow label={`CSPROJ · 含 ${mod.behaviours.length} 个 .cs`}>
                <div className="font-mono text-fg-mute truncate">{mod.modDir}/src/</div>
              </MetaRow>
              <div className="border-t border-border-subtle" />
              <MetaRow label="OUTPUT DLL">
                {mod.hasDll ? (
                  <>
                    <div className="font-mono text-fg-base truncate">{shortenPath(mod.dllPath)}</div>
                    <div className="font-mono text-fg-mute mt-1">
                      {formatBytes(mod.dllSize)} · {formatTime(mod.dllMtime)}
                    </div>
                    {mod.dllSha256 && (
                      <div className="font-mono text-fg-muteDim text-3xs mt-1">
                        sha256: {mod.dllSha256.slice(0, 12)}…{mod.dllSha256.slice(-8)}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-status-warn">尚未编译,点「🔨 编译并部署」</div>
                )}
              </MetaRow>
              {manifest.author && (
                <>
                  <div className="border-t border-border-subtle" />
                  <MetaRow label="AUTHOR">
                    <div className="text-fg-base">{manifest.author}</div>
                  </MetaRow>
                </>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-3xs font-bold tracking-wider text-fg-muteBright">{label}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function shortenPath(p: string | null): string {
  if (!p) return ''
  const parts = p.split(/[\\/]/)
  if (parts.length <= 3) return p
  return `…/${parts.slice(-3).join('/')}`
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function formatTime(ms: number | null): string {
  if (!ms) return ''
  return new Date(ms).toLocaleString('zh-CN', { hour12: false })
}
