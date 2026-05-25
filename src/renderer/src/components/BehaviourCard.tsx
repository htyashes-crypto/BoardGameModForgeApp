import type { BehaviourMeta } from '../types/api'

/**
 * 一个 [ModObjectBehaviour] 类的展示卡。
 * 显示类名 / behaviourId / DisplayName / Category / 源文件。
 */
export function BehaviourCard({ behaviour }: { behaviour: BehaviourMeta }) {
  return (
    <div className="card p-3 flex items-start gap-3">
      <div className="w-11 h-11 bg-bg-input border border-border-frame rounded-lg grid place-items-center text-xl shrink-0">
        ⚒
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold font-mono text-brand-base truncate">
            {behaviour.className}
          </span>
          {behaviour.displayName && (
            <span className="text-2xs text-fg-mute">· {behaviour.displayName}</span>
          )}
        </div>
        {behaviour.category && (
          <div className="inline-block px-1.5 h-4 bg-brand-base/10 rounded text-3xs font-semibold text-brand-bright tracking-wide mb-1">
            {behaviour.category}
          </div>
        )}
        <div className="text-3xs font-mono text-fg-muteBright">
          {behaviour.behaviourId ? `id = ${behaviour.behaviourId}` : <span className="text-status-warn">⚠ 缺 Id attribute</span>}
        </div>
        <div className="text-3xs font-mono text-fg-muteDim truncate">src/{behaviour.sourceFile}</div>
      </div>
    </div>
  )
}
