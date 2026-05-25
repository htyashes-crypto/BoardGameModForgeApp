import { useEffect, useMemo } from 'react'
import type { ModInfo, ModListSnapshot } from '../types/api'

interface ModDepsGraphModalProps {
  snapshot: ModListSnapshot
  onClose(): void
  onBuildAll?(): void
}

interface LayoutNode {
  modId: string
  mod: ModInfo
  layer: number          // 0 = 基础层(被依赖最多),max = 应用层(叶子)
  x: number              // 中心 x
  y: number              // 顶部 y
  width: number
  height: number
}

interface LayoutEdge {
  from: LayoutNode
  to: LayoutNode
  versionRange: string
}

const NODE_WIDTH = 220
const NODE_HEIGHT = 86
const LAYER_GAP_Y = 150
const NODE_GAP_X = 36
const CANVAS_PADDING = 50

/**
 * Mod 依赖图可视化(全屏 modal)。对应 mockup `.claude/svg/modforge-modal-mod-deps.svg`。
 * 用拓扑分层布局:基础层在下,应用层在上;边箭头从依赖者(上)指向被依赖(下)。
 */
export function ModDepsGraphModal({ snapshot, onClose, onBuildAll }: ModDepsGraphModalProps) {
  // ESC 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const { nodes, edges, canvasWidth, canvasHeight } = useMemo(
    () => computeLayout(snapshot),
    [snapshot]
  )

  return (
    <div className="fixed inset-0 z-40 bg-bg-base flex flex-col" onClick={(e) => e.stopPropagation()}>
      {/* Title bar */}
      <div className="h-10 bg-bg-titlebar border-b border-border-subtle flex items-center px-5 shrink-0">
        <div className="w-4 h-4 bg-brand-gradient rotate-45 rounded-sm" />
        <span className="ml-4 text-xs font-bold tracking-wider">ModForge</span>
        <span className="ml-3 text-xs text-fg-mute">· 依赖图视图</span>
      </div>

      {/* Toolbar */}
      <div className="m-3 p-4 bg-panel-gradient border border-border-frame rounded-xl flex items-center gap-4 shrink-0">
        <button onClick={onClose} className="btn-ghost h-9 px-4 rounded-lg text-sm">
          ← 返回工作区
        </button>
        <div className="ml-2">
          <div className="text-xl font-extrabold">Mod 依赖图</div>
          <div className="text-2xs text-fg-muteBright">
            {snapshot.mods.length} 节点 · {edges.length} 边 ·{' '}
            {snapshot.topologyOrder.length > 0 ? '拓扑序就绪 · 无循环' : '⚠ 含错误'}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {onBuildAll && snapshot.topologyOrder.length > 0 && (
            <button onClick={onBuildAll} className="btn-primary h-9 px-4 rounded-lg text-sm">
              🔨 按图编译
            </button>
          )}
        </div>
      </div>

      {/* Body: 左 panel + 右 canvas */}
      <div className="flex-1 flex gap-3 m-3 mt-0 overflow-hidden">
        {/* 左:统计 + 图例 + 拓扑序 */}
        <aside className="w-60 bg-panel-gradient border border-border-frame rounded-xl p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
          <section>
            <SectionLabel>统计</SectionLabel>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Stat number={snapshot.mods.length} label="MOD 节点" />
              <Stat number={edges.length} label="依赖边" />
            </div>
          </section>

          <section>
            <SectionLabel>节点图例</SectionLabel>
            <div className="mt-3 space-y-2">
              <LegendRow color="border-status-ok bg-status-ok/10" label="基础库" sub="无依赖 · 顶层 Mod" />
              <LegendRow color="border-fg-accentInfo bg-fg-accentInfo/10" label="中间层" sub="依赖基础库" />
              <LegendRow color="border-brand-base bg-brand-base/10" label="应用层" sub="叶子 · 依赖中/底层" />
            </div>
          </section>

          {snapshot.topologyOrder.length > 0 && (
            <section>
              <SectionLabel>拓扑加载序</SectionLabel>
              <div className="mt-3 space-y-1.5">
                {snapshot.topologyOrder.map((id, i) => {
                  const mod = snapshot.mods.find((m) => m.manifest?.id === id)
                  return (
                    <div key={id} className="flex items-center gap-2 text-2xs">
                      <span className="font-mono font-bold text-brand-base w-5">{i + 1}</span>
                      <span className="font-mono text-fg-base truncate">{mod?.manifest?.name ?? id}</span>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {(snapshot.manifestErrors.length > 0 || snapshot.dependencyErrors.length > 0) && (
            <section className="bg-status-danger/10 border border-status-danger/40 rounded-lg p-3">
              <div className="text-2xs font-bold text-status-danger mb-2">⚠ 工程含错误</div>
              {snapshot.manifestErrors.map((e, i) => (
                <div key={`m${i}`} className="text-3xs font-mono text-fg-mute mb-1">
                  · {e}
                </div>
              ))}
              {snapshot.dependencyErrors.map((e, i) => (
                <div key={`d${i}`} className="text-3xs font-mono text-fg-mute mb-1">
                  · {e}
                </div>
              ))}
            </section>
          )}
        </aside>

        {/* 右:canvas */}
        <main className="flex-1 bg-panel-gradient border border-border-frame rounded-xl overflow-hidden">
          <div className="h-full overflow-auto board-grid" onClick={onClose}>
            <svg width={canvasWidth} height={canvasHeight} className="block">
              <defs>
                <marker id="arrow-brand" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#f5a623" />
                </marker>
              </defs>

              {/* Edges */}
              {edges.map((edge, i) => (
                <EdgePath key={i} edge={edge} />
              ))}

              {/* Nodes */}
              {nodes.map((node) => (
                <NodeBox key={node.modId} node={node} maxLayer={Math.max(...nodes.map((n) => n.layer))} />
              ))}
            </svg>
          </div>
        </main>
      </div>
    </div>
  )
}

function computeLayout(snapshot: ModListSnapshot): {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  canvasWidth: number
  canvasHeight: number
} {
  const idToMod = new Map<string, ModInfo>()
  for (const m of snapshot.mods) {
    if (m.manifest) idToMod.set(m.manifest.id, m)
  }

  // 计算每个 mod 的"最长依赖链深度":depth(X) = 1 + max(depth(deps));叶子 = 0
  const depthCache = new Map<string, number>()
  function depthOf(id: string, visiting = new Set<string>()): number {
    if (depthCache.has(id)) return depthCache.get(id)!
    if (visiting.has(id)) return 0 // 循环兜底
    visiting.add(id)
    const mod = idToMod.get(id)
    if (!mod?.manifest || mod.manifest.dependencies.length === 0) {
      depthCache.set(id, 0)
      return 0
    }
    let max = 0
    for (const dep of mod.manifest.dependencies) {
      const d = depthOf(dep.id, visiting) + 1
      if (d > max) max = d
    }
    visiting.delete(id)
    depthCache.set(id, max)
    return max
  }

  const depths: Record<string, number> = {}
  for (const id of idToMod.keys()) depths[id] = depthOf(id)
  const maxDepth = Math.max(0, ...Object.values(depths))

  // layer 翻转:depth 大 = 应用层(在上),depth 0 = 基础层(在下)→ y 由 layer 决定,layer 0 在底
  // 但 mockup 是应用层在上,所以 layer = depths[id]
  const layers: string[][] = Array.from({ length: maxDepth + 1 }, () => [])
  for (const id of idToMod.keys()) layers[depths[id]].push(id)
  for (const arr of layers) arr.sort()

  // 每层水平居中排列
  const widestLayerCount = Math.max(1, ...layers.map((l) => l.length))
  const canvasWidth = Math.max(800, CANVAS_PADDING * 2 + widestLayerCount * (NODE_WIDTH + NODE_GAP_X) - NODE_GAP_X)
  const canvasHeight = CANVAS_PADDING * 2 + (maxDepth + 1) * LAYER_GAP_Y

  const nodes: LayoutNode[] = []
  for (let layerIdx = 0; layerIdx <= maxDepth; layerIdx++) {
    const ids = layers[layerIdx]
    const layerWidth = ids.length * (NODE_WIDTH + NODE_GAP_X) - NODE_GAP_X
    const startX = (canvasWidth - layerWidth) / 2
    // y:layerIdx 大 = depth 大 = 应用层在上(小 y)
    const y = CANVAS_PADDING + (maxDepth - layerIdx) * LAYER_GAP_Y
    for (let i = 0; i < ids.length; i++) {
      const mod = idToMod.get(ids[i])
      if (!mod) continue
      nodes.push({
        modId: ids[i],
        mod,
        layer: layerIdx,
        x: startX + i * (NODE_WIDTH + NODE_GAP_X),
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT
      })
    }
  }

  const nodeMap = new Map(nodes.map((n) => [n.modId, n]))
  const edges: LayoutEdge[] = []
  for (const node of nodes) {
    for (const dep of node.mod.manifest!.dependencies) {
      const to = nodeMap.get(dep.id)
      if (!to) continue
      edges.push({ from: node, to, versionRange: dep.versionRange })
    }
  }

  return { nodes, edges, canvasWidth, canvasHeight }
}

function NodeBox({ node, maxLayer }: { node: LayoutNode; maxLayer: number }) {
  const manifest = node.mod.manifest!
  const isBase = node.layer === 0
  const isApp = node.layer === maxLayer && maxLayer > 0
  const borderClass = isBase ? 'stroke-status-ok' : isApp ? 'stroke-brand-base' : 'stroke-fg-accentInfo'
  const fillClass = isBase ? '#1a3a24' : isApp ? '#3a2a14' : '#1f3a4a'
  const labelClass = isBase ? '#6bcb77' : isApp ? '#ffb84d' : '#9cdcfe'

  return (
    <g transform={`translate(${node.x}, ${node.y})`}>
      <rect width={node.width} height={node.height} rx={12} fill={fillClass} />
      <rect width={node.width} height={node.height} rx={12} fill="none" strokeWidth={2} className={borderClass} />
      <circle cx={14} cy={20} r={5} fill={labelClass} />
      <text x={26} y={24} fontSize={11} fontWeight={700} fill={labelClass}>
        {isBase ? '基础库' : isApp ? '应用层' : '中间层'}
      </text>
      <text x={14} y={48} fontSize={14} fontWeight={800} fill="#e8e8e8" fontFamily="'PingFang SC', sans-serif">
        {manifest.name}
      </text>
      <text x={14} y={66} fontSize={11} fill="#aaa" fontFamily="Consolas, monospace">
        v{manifest.version} · {node.mod.behaviours.length} Behaviour
      </text>
      <text x={node.width - 14} y={20} fontSize={10} fontWeight={700} fill={node.mod.hasDll ? '#6bcb77' : '#ffb700'} textAnchor="end">
        {node.mod.hasDll ? '✓ 已编' : '⚠ 未编'}
      </text>
    </g>
  )
}

function EdgePath({ edge }: { edge: LayoutEdge }) {
  // 起点:依赖者(上方)底部中心;终点:被依赖(下方)顶部中心
  const x1 = edge.from.x + edge.from.width / 2
  const y1 = edge.from.y + edge.from.height
  const x2 = edge.to.x + edge.to.width / 2
  const y2 = edge.to.y
  const dx = x2 - x1
  const dy = y2 - y1
  // 贝塞尔控制点:在中间偏向源
  const cp1y = y1 + dy * 0.5
  const cp2y = y2 - dy * 0.3
  const labelX = (x1 + x2) / 2
  const labelY = (y1 + y2) / 2

  return (
    <g>
      <path
        d={`M ${x1} ${y1} C ${x1} ${cp1y}, ${x2} ${cp2y}, ${x2} ${y2}`}
        stroke="#f5a623"
        strokeWidth={2}
        fill="none"
        markerEnd="url(#arrow-brand)"
      />
      <rect x={labelX - 32} y={labelY - 10} width={64} height={20} rx={3} fill="#0d0d0d" stroke="#3a3a3a" />
      <text x={labelX} y={labelY + 4} fontSize={10} fontWeight={700} fill="#ffb84d" textAnchor="middle" fontFamily="Consolas, monospace">
        {edge.versionRange}
      </text>
    </g>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center">
      <span className="block w-1 h-3 bg-brand-base" />
      <span className="ml-2 text-3xs font-bold text-brand-base tracking-wider">{children}</span>
    </div>
  )
}

function Stat({ number, label }: { number: number; label: string }) {
  return (
    <div className="bg-bg-input border border-border-frame rounded-lg p-2 text-center">
      <div className="text-2xl font-extrabold text-brand-base">{number}</div>
      <div className="text-3xs text-fg-muteBright tracking-wider">{label}</div>
    </div>
  )
}

function LegendRow({ color, label, sub }: { color: string; label: string; sub: string }) {
  return (
    <div className={`px-2 py-1.5 rounded-lg border ${color}`}>
      <div className="text-2xs font-bold text-fg-base">{label}</div>
      <div className="text-3xs text-fg-muteBright">{sub}</div>
    </div>
  )
}
