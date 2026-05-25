import type { ModInfo } from '../types/api'

interface ModListItemProps {
  mod: ModInfo
  selected: boolean
  /** 拓扑层级标签:base / mid / app。无层级时省略颜色边。 */
  layer?: 'base' | 'mid' | 'app'
  onClick(): void
}

const layerColor: Record<NonNullable<ModListItemProps['layer']>, string> = {
  base: 'bg-status-ok',
  mid: 'bg-fg-accentInfo',
  app: 'bg-brand-base'
}

const layerLabel: Record<NonNullable<ModListItemProps['layer']>, string> = {
  base: '基础库',
  mid: '中间层',
  app: '应用层'
}

/**
 * Mod 列表项卡片(左侧栏)。
 * - 选中态:card-selected + 橙发光 + 左侧橙竖条
 * - 未选中:card + 拓扑层颜色竖条(基础/中间/应用)
 * - 显示 Mod 名 + 版本 + Behaviour 数 + dll 状态
 */
export function ModListItem({ mod, selected, layer, onClick }: ModListItemProps) {
  const manifest = mod.manifest
  const containerCls = selected
    ? 'card-selected'
    : 'card hover:brightness-110 transition-[filter] duration-100'
  const stripeCls = selected
    ? 'bg-brand-base'
    : layer
      ? layerColor[layer]
      : 'bg-border-frame'

  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left rounded-xl ${containerCls} p-3 pl-4`}
    >
      <span className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${stripeCls}`} />
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-bold tracking-wide">{manifest?.name ?? mod.modDir}</span>
        {manifest && <span className="text-2xs font-mono text-fg-muteBright">v{manifest.version}</span>}
        {layer && (
          <span className={`ml-auto px-1.5 h-4 inline-flex items-center text-3xs font-bold tracking-wider rounded ${layerColor[layer]}/20 text-fg-base`}>
            {layerLabel[layer]}
          </span>
        )}
      </div>
      <div className="text-3xs text-fg-muteBright">
        {mod.hasDll ? '📦 ' : '⚠ 未编译 · '}
        {mod.behaviours.length} Behaviour · {mod.manifest?.dependencies.length ?? 0} 依赖
      </div>
      {!manifest && (
        <div className="text-3xs text-status-danger mt-1">
          ⚠ manifest 错误:{mod.manifestErrors[0]}
        </div>
      )}
    </button>
  )
}
