import { useMemo } from 'react'
import type { ProjectInfo } from '../types/api'
import { useProjectStore } from '../store/projectStore'

/**
 * Hub 启动页 — 桌游工程选择 / 最近列表 / 工程文件夹扫描 grid。
 * 对应设计 mockup `.claude/svg/modforge-home.svg`。
 */
export function HubView() {
  const recent = useProjectStore((s) => s.recent)
  const scanned = useProjectStore((s) => s.scanned)
  const scanRoot = useProjectStore((s) => s.scanRoot)
  const scanning = useProjectStore((s) => s.scanning)
  const filterText = useProjectStore((s) => s.filterText)
  const setFilterText = useProjectStore((s) => s.setFilterText)
  const bind = useProjectStore((s) => s.bind)
  const refreshScan = useProjectStore((s) => s.refreshScan)
  const browseScanRoot = useProjectStore((s) => s.browseScanRoot)
  const browseAndBindSingle = useProjectStore((s) => s.browseAndBindSingle)

  // 去重:scanned 内已存在的工程从 recent 移除避免重复展示
  const recentFiltered = useMemo(() => {
    const text = filterText.trim().toLowerCase()
    return recent.filter((p) => !text || p.name.toLowerCase().includes(text) || p.path.toLowerCase().includes(text))
  }, [recent, filterText])

  const scannedFiltered = useMemo(() => {
    const text = filterText.trim().toLowerCase()
    const recentPaths = new Set(recent.map((p) => p.path))
    return scanned
      .filter((p) => !recentPaths.has(p.path))
      .filter((p) => !text || p.name.toLowerCase().includes(text) || p.path.toLowerCase().includes(text))
  }, [scanned, recent, filterText])

  return (
    <div className="h-full w-full flex bg-bg-base">
      {/* ===== Title bar ===== */}
      <div className="absolute top-0 left-0 right-0 h-10 bg-bg-titlebar border-b border-border-subtle flex items-center px-5">
        <div className="w-4 h-4 bg-brand-gradient rotate-45 rounded-sm" />
        <span className="ml-4 text-xs font-bold tracking-wider">ModForge</span>
        <span className="ml-3 text-xs text-fg-mute">· BoardGameEditor Mod 开发环境</span>
      </div>

      {/* ===== Left brand sidebar ===== */}
      <aside className="w-[372px] h-full pt-12 pb-4 px-4 flex flex-col bg-panel-gradient border-r border-border-subtle">
        <div className="flex flex-col items-center mt-12">
          <div className="relative w-28 h-28 mb-8">
            <div
              className="absolute inset-0 bg-brand-gradient rounded-2xl rotate-45 brand-glow"
              style={{ boxShadow: '0 0 20px rgb(var(--brand-base) / 0.6)' }}
            />
            <div className="absolute inset-7 bg-bg-base rounded-lg rotate-45 grid place-items-center">
              <span className="-rotate-45 text-3xl font-bold text-brand-base">MF</span>
            </div>
          </div>
          <div className="text-4xl font-bold text-brand-base tracking-widest">ModForge</div>
          <div className="text-xs text-fg-muteBright tracking-widest mt-2">FOR BOARDGAME EDITOR</div>

          <div className="my-6 flex items-center gap-2">
            <span className="block w-16 h-px bg-border-frame" />
            <span className="block w-3 h-2 bg-brand-base" />
            <span className="block w-16 h-px bg-border-frame" />
          </div>

          <div className="text-2xs text-fg-muteBright text-center leading-relaxed">
            为每一个桌游工程
            <br />
            独立创建 Mod 开发 IDE 环境
          </div>
        </div>

        <div className="mt-auto space-y-2">
          <div className="bg-bg-input border border-border-frame rounded-lg p-3 text-2xs">
            <div className="text-brand-base font-bold mb-1">⚒ 一个 Mod = 一个 .dll = N Behaviour 类</div>
            <div className="text-fg-mute">类比 Minecraft 模组生态:</div>
            <div className="font-mono text-fg-mute">基础库 ← 中间层 ← 应用层</div>
          </div>
          <div className="bg-bg-input border border-border-frame rounded-lg p-3 flex items-center text-2xs">
            <span className="w-2 h-2 rounded-full bg-status-ok mr-2" />
            <span className="flex-1">v0.1.0</span>
          </div>
        </div>
      </aside>

      {/* ===== Right main area ===== */}
      <main className="flex-1 h-full pt-10 flex flex-col">
        <div className="flex-1 bg-panel-gradient flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-7 pb-5 flex items-end justify-between border-b border-border-subtle">
            <div>
              <div className="text-2xl font-bold tracking-wide">选择桌游工程</div>
              <div className="text-2xs text-fg-muteBright mt-1.5">
                绑定一个工程开始 Mod 开发 — 所有功能都在该工程上下文内运行
              </div>
            </div>
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="🔍  搜索工程名 / 路径"
              className="w-72 h-9 px-3 bg-bg-input border border-border-frame rounded-lg text-xs placeholder:text-fg-muteDim focus:outline-none focus:border-brand-base"
            />
          </div>

          {/* Recent section */}
          {recentFiltered.length > 0 && (
            <section className="px-7 pt-5">
              <div className="flex items-center mb-3">
                <span className="block w-1 h-3.5 bg-brand-base" />
                <span className="ml-3 text-xs font-bold tracking-widest">最近打开</span>
                <span className="ml-auto text-2xs text-fg-muteBright">{recentFiltered.length} 个工程</span>
              </div>
              <div className="space-y-2.5">
                {recentFiltered.map((p, i) => (
                  <ProjectRow key={p.path} project={p} highlighted={i === 0} onClick={() => bind(p)} />
                ))}
              </div>
            </section>
          )}

          {/* Scanned section */}
          <section className="px-7 mt-5 flex-1 flex flex-col min-h-0">
            <div className="flex items-center mb-3">
              <span className="block w-1 h-3.5 bg-brand-base" />
              <span className="ml-3 text-xs font-bold tracking-widest">扫描到的桌游工程</span>
              <span className="ml-auto text-2xs text-fg-muteBright">
                {scanRoot ? <span className="font-mono">{scanRoot}</span> : '未设置扫描根'} · 共 {scannedFiltered.length} 个
              </span>
            </div>
            <div className="flex-1 board-grid bg-bg-deepest border border-border-frame rounded-xl p-4 overflow-y-auto">
              {scanning && (
                <div className="h-full grid place-items-center text-fg-mute text-2xs">扫描中…</div>
              )}
              {!scanning && scannedFiltered.length === 0 && (
                <div className="h-full grid place-items-center text-fg-mute text-2xs">
                  {scanRoot ? '当前扫描根下没有桌游工程' : '点击「浏览工程文件夹」选扫描根'}
                </div>
              )}
              {!scanning && scannedFiltered.length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                  {scannedFiltered.map((p) => (
                    <ProjectTile key={p.path} project={p} onClick={() => bind(p)} />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Bottom actions */}
          <div className="px-7 py-5 border-t border-border-subtle flex items-center gap-3">
            <button
              onClick={browseScanRoot}
              className="btn-primary h-10 px-5 rounded-lg text-sm flex items-center gap-2 shrink-0"
            >
              📂  浏览工程文件夹...
            </button>
            <button
              onClick={() => refreshScan()}
              className="btn-ghost h-10 px-5 rounded-lg text-sm shrink-0"
              disabled={!scanRoot || scanning}
            >
              🔄  重新扫描
            </button>
            <button
              onClick={browseAndBindSingle}
              className="btn-ghost h-10 px-5 rounded-lg text-sm shrink-0"
            >
              ⚡  打开单个工程
            </button>
            <span className="ml-auto pl-3 min-w-0 truncate text-2xs text-fg-muteBright">
              💡 工具会在选定工程下创建 ModBehaviourProject/&lt;ModName&gt; 子目录
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}

/* ===== Row & Tile 组件 ===== */

function ProjectRow({
  project,
  highlighted,
  onClick
}: {
  project: ProjectInfo
  highlighted?: boolean
  onClick: () => void
}) {
  const lastTime = project.lastOpenedAt ? formatTimeAgo(project.lastOpenedAt) : null
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3.5 rounded-xl flex items-center gap-4 transition-[filter] duration-100 ${
        highlighted ? 'card-selected' : 'card hover:brightness-110'
      }`}
    >
      <div
        className={`w-10 h-10 rounded-lg grid place-items-center text-base font-bold ${
          highlighted ? 'bg-bg-input border-[1.5px] border-brand-base text-brand-base' : 'bg-bg-input border border-border-frame text-fg-mute'
        }`}
      >
        {project.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold tracking-wide truncate">{project.name}</span>
          {project.hasModBehaviourProject && project.modCount > 0 && (
            <BadgeBrand>{project.modCount} MOD</BadgeBrand>
          )}
          {!project.hasModBehaviourProject && <BadgeMute>无 Mod</BadgeMute>}
        </div>
        <div className="text-2xs font-mono text-fg-muteBright truncate mt-1">{project.path}</div>
      </div>
      <div className="text-right shrink-0">
        {lastTime && <div className="text-2xs text-fg-muteBright">{lastTime}</div>}
        <div className="text-2xs text-brand-base font-bold mt-1">点击进入 →</div>
      </div>
    </button>
  )
}

function ProjectTile({ project, onClick }: { project: ProjectInfo; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="card hover:brightness-110 p-3 text-left transition-[filter] duration-100"
    >
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-md bg-bg-input border border-border-frame grid place-items-center text-xs font-bold text-fg-mute shrink-0">
          {project.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold truncate">{project.name}</div>
          <div className="text-3xs text-fg-muteBright mt-0.5">
            {project.modCount > 0 ? `${project.modCount} Mod` : '无 Mod · 待初始化'}
          </div>
        </div>
      </div>
      <div className="border-t border-border-subtle mt-3 pt-2">
        <div className="text-3xs font-mono text-fg-muteBright truncate">{project.name}/</div>
      </div>
    </button>
  )
}

function BadgeBrand({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 h-4 inline-flex items-center text-3xs font-bold tracking-wider text-brand-bright bg-brand-base/20 border border-brand-base/40 rounded-md">
      {children}
    </span>
  )
}

function BadgeMute({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 h-4 inline-flex items-center text-3xs font-bold text-fg-mute bg-bg-input rounded-md">
      {children}
    </span>
  )
}

function formatTimeAgo(ts: number): string {
  const diffSec = Math.max(0, (Date.now() - ts) / 1000)
  if (diffSec < 60) return `${Math.floor(diffSec)} 秒前`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)} 天前`
  return new Date(ts).toLocaleDateString('zh-CN')
}
