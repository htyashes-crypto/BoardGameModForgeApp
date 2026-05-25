import type { ModInfo, ModListSnapshot } from '../types/api'

interface DependencyStripProps {
  mod: ModInfo
  snapshot: ModListSnapshot
  usedBy: string[]
}

/**
 * Mod 详情顶部依赖关系 strip:
 * - Provides:本 Mod 提供的 Behaviour 数
 * - Depends On:本 Mod 依赖的 Mod 列表(带版本范围 + 解析状态)
 * - Used By:被谁依赖
 * - 加载顺序:拓扑序内位置(N / total)
 */
export function DependencyStrip({ mod, snapshot, usedBy }: DependencyStripProps) {
  const manifest = mod.manifest
  if (!manifest) return null

  const topoIndex = snapshot.topologyOrder.indexOf(manifest.id)
  const topoTotal = snapshot.topologyOrder.length

  return (
    <div className="bg-bg-input border border-brand-base/50 rounded-xl p-4 flex gap-4">
      {/* Provides */}
      <section className="flex-1 min-w-0">
        <SectionLabel>⬇ PROVIDES</SectionLabel>
        <div className="text-2xs text-fg-muteBright mt-2">{mod.behaviours.length} 个 Behaviour 类</div>
        <span className="inline-block mt-1 px-2 h-5 bg-brand-base/10 rounded text-3xs font-bold text-brand-bright">
          {mod.behaviours.length} BEHAVIOUR
        </span>
      </section>

      <div className="w-px bg-border-frame" />

      {/* Depends On */}
      <section className="flex-1 min-w-0">
        <SectionLabel>⬆ DEPENDS ON</SectionLabel>
        {manifest.dependencies.length === 0 ? (
          <div className="text-2xs text-fg-muteDim italic mt-2">无依赖 · 顶层 Mod</div>
        ) : (
          <div className="mt-2 space-y-1.5">
            {manifest.dependencies.map((dep) => {
              const target = snapshot.mods.find((m) => m.manifest?.id === dep.id)
              const resolved = !!target
              return (
                <div
                  key={dep.id}
                  className={`flex items-center gap-2 px-2 py-1 rounded text-3xs ${
                    resolved
                      ? 'bg-status-ok/15 border border-status-ok/40'
                      : 'bg-status-danger/15 border border-status-danger/40'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      resolved ? 'bg-status-ok' : 'bg-status-danger'
                    }`}
                  />
                  <span className="font-mono font-bold text-fg-base truncate">{dep.id}</span>
                  <span className="font-mono text-fg-mute">{dep.versionRange}</span>
                  <span className={`ml-auto ${resolved ? 'text-status-ok' : 'text-status-danger'}`}>
                    {resolved ? '✓ 已解析' : '✗ 未解析'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div className="w-px bg-border-frame" />

      {/* Used By */}
      <section className="flex-1 min-w-0">
        <SectionLabel>↩ USED BY</SectionLabel>
        {usedBy.length === 0 ? (
          <div className="text-2xs text-fg-muteDim italic mt-2">无 · 本 Mod 为叶子节点</div>
        ) : (
          <div className="mt-2 space-y-1">
            {usedBy.map((id) => (
              <div key={id} className="text-3xs font-mono text-fg-mute truncate">
                {id}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="w-px bg-border-frame" />

      {/* Load order */}
      <section className="w-36 shrink-0">
        <SectionLabel>⚡ 加载顺序</SectionLabel>
        <div className="text-2xs font-mono text-fg-mute mt-2">
          拓扑序:{topoIndex >= 0 ? topoIndex + 1 : '?'} / {topoTotal}
        </div>
        <div className="text-3xs text-fg-muteBright mt-1 truncate">
          {snapshot.topologyOrder.join(' → ')}
        </div>
      </section>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center">
      <span className="block w-1 h-3 bg-brand-base" />
      <span className="ml-2 text-3xs font-bold text-fg-muteBright tracking-wider">{children}</span>
    </div>
  )
}
