import { useMemo } from "react";
import { ArrowLeft } from "@icon-park/react";
import type { ModListSnapshot } from "../types";
import { buildDepGraph } from "../lib/depGraph";
import { layerColor, effectiveLayer } from "./ModListItem";
import { useEscClose } from "./ui/useEscClose";

interface NodePos {
  id: string;
  x: number;
  y: number;
  layerCol: string;
  version: string;
  layerName: string;
}

const NODE_W = 180;
const NODE_H = 64;
const ROW_GAP = 170;
const CANVAS_W = 1200;

/** 依赖图全屏(对 modal-deps-graph.svg):统计/图例/拓扑序 + 分层 DAG 画布。 */
export default function ModDepsGraphModal({
  snapshot,
  currentModId,
  onClose,
  onBuildAll,
  building,
}: {
  snapshot: ModListSnapshot;
  currentModId: string | null;
  onClose: () => void;
  onBuildAll: () => void;
  building: boolean;
}) {
  useEscClose(onClose);

  const { nodes, edges, canvasH, edgeCount } = useMemo(() => {
    const graph = buildDepGraph(snapshot.mods);
    const adj = graph.adjacency;
    const ids = snapshot.topologyOrder.length ? snapshot.topologyOrder : Object.keys(adj);

    // 深度 = 最长依赖链(基础层 0 在下,应用层在上)
    const depth = new Map<string, number>();
    const calc = (id: string): number => {
      if (depth.has(id)) return depth.get(id)!;
      const deps = adj[id] ?? [];
      const d = deps.length === 0 ? 0 : 1 + Math.max(...deps.map(calc));
      depth.set(id, d);
      return d;
    };
    ids.forEach(calc);
    const maxDepth = Math.max(0, ...[...depth.values()]);

    const rows = new Map<number, string[]>();
    for (const id of ids) {
      const d = depth.get(id) ?? 0;
      rows.set(d, [...(rows.get(d) ?? []), id]);
    }

    const canvasH = Math.max(560, (maxDepth + 1) * ROW_GAP + 160);
    const nodes: NodePos[] = [];
    const byId = new Map(snapshot.mods.filter((m) => m.manifest).map((m) => [m.manifest!.id, m]));
    for (const [d, rowIds] of rows) {
      const y = canvasH - 120 - d * ROW_GAP;
      rowIds.forEach((id, i) => {
        const x = (CANVAS_W / (rowIds.length + 1)) * (i + 1) - NODE_W / 2;
        const mod = byId.get(id);
        const layer = mod ? effectiveLayer(mod, snapshot.topologyOrder) : "app";
        nodes.push({
          id,
          x,
          y,
          layerCol: layerColor(layer),
          version: mod?.manifest?.version ?? "?",
          layerName: layer,
        });
      });
    }

    const posOf = new Map(nodes.map((n) => [n.id, n]));
    const edges: { from: NodePos; to: NodePos; range: string }[] = [];
    let edgeCount = 0;
    for (const mod of snapshot.mods) {
      if (!mod.manifest) continue;
      for (const dep of mod.manifest.dependencies) {
        const from = posOf.get(mod.manifest.id);
        const to = posOf.get(dep.id);
        if (from && to) {
          edges.push({ from, to, range: dep.versionRange });
          edgeCount++;
        }
      }
    }
    return { nodes, edges, canvasH, edgeCount };
  }, [snapshot]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[var(--bg)] pt-10">
      {/* 工具栏 */}
      <div className="flex h-14 shrink-0 items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-4">
        <button onClick={onClose} className="btn-ghost h-8">
          <ArrowLeft theme="outline" size="14" />
          返回工作区
        </button>
        <span className="text-[15px] font-semibold text-[var(--text)]">Mod 依赖图</span>
        <span className="text-[11px] text-[var(--text-faint)]">
          {nodes.length} 节点 · {edgeCount} 依赖边 · {snapshot.hasError ? "含错误" : "拓扑序就绪"}
        </span>
        <button onClick={onBuildAll} disabled={building || snapshot.hasError || nodes.length === 0} className="btn-primary ml-auto h-8">
          按图编译(全量)
        </button>
      </div>

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        {/* 左侧统计 / 图例 / 拓扑序 */}
        <aside className="flex w-[260px] shrink-0 flex-col gap-5 overflow-y-auto rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <section>
            <div className="text-[11px] font-semibold tracking-[1.5px] text-[var(--text-3)]">统计</div>
            <div className="mt-2.5 flex flex-col gap-2 rounded-[10px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3.5">
              <StatRow label="Mod 总数" value={String(nodes.length)} />
              <StatRow label="依赖边" value={String(edgeCount)} />
              <StatRow label="拓扑序" value={snapshot.hasError ? "不可用" : "就绪"} />
            </div>
          </section>
          <section>
            <div className="text-[11px] font-semibold tracking-[1.5px] text-[var(--text-3)]">图例</div>
            <div className="mt-2.5 flex flex-col gap-2 text-[11px] text-[var(--text-2)]">
              <Legend color="var(--success)" text="base · 基础库" />
              <Legend color="var(--text-2)" text="mid · 中间层" />
              <Legend color="var(--accent)" text="app · 应用层" />
            </div>
          </section>
          <section>
            <div className="text-[11px] font-semibold tracking-[1.5px] text-[var(--text-3)]">拓扑加载序</div>
            <ol className="mt-2.5 flex flex-col gap-1.5">
              {snapshot.topologyOrder.map((id, i) => (
                <li key={id} className="flex items-baseline gap-3 text-[12px]">
                  <span className="w-4 text-right text-[11px] text-[var(--text-faint)]" style={{ fontFamily: "var(--mono-font)" }}>
                    {i + 1}
                  </span>
                  <span className={id === currentModId ? "text-[var(--accent-text)]" : "text-[var(--text)]"}>{id}</span>
                </li>
              ))}
            </ol>
          </section>
          <section>
            <div className="text-[11px] font-semibold tracking-[1.5px] text-[var(--text-3)]">工程错误</div>
            {snapshot.hasError ? (
              <ul className="mt-2.5 flex flex-col gap-1.5">
                {[...snapshot.manifestErrors, ...snapshot.dependencyErrors].map((e, i) => (
                  <li key={i} className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-[10px] text-[var(--danger)]">
                    {e}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2.5 text-[11px] text-[var(--success)]">无错误 ✓</div>
            )}
          </section>
          <div className="mt-auto text-[10px] leading-relaxed text-[var(--text-faint)]">
            箭头方向:依赖方 → 被依赖方
            <br />
            边标签 = mod.json 声明的版本范围
          </div>
        </aside>

        {/* DAG 画布 */}
        <div className="min-w-0 flex-1 overflow-auto rounded-[14px] border border-[var(--border)] bg-[var(--term-bg)]">
          {nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[12px] text-[var(--text-3)]">工程内暂无可解析的 Mod</div>
          ) : (
            <svg viewBox={`0 0 ${CANVAS_W} ${canvasH}`} className="mx-auto block h-auto w-full max-w-[1200px]">
              <defs>
                <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.2" fill="var(--surface-soft)" />
                </pattern>
                <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0 0 L10 5 L0 10 Z" fill="var(--text-3)" />
                </marker>
              </defs>
              <rect width={CANVAS_W} height={canvasH} fill="url(#dots)" />
              {edges.map((e, i) => {
                const x1 = e.from.x + NODE_W / 2;
                const y1 = e.from.y + NODE_H;
                const x2 = e.to.x + NODE_W / 2;
                const y2 = e.to.y;
                const my = (y1 + y2) / 2;
                return (
                  <g key={i}>
                    <path
                      d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2 - 3}`}
                      fill="none"
                      stroke="var(--text-3)"
                      strokeWidth="1.5"
                      markerEnd="url(#arr)"
                    />
                    <g transform={`translate(${(x1 + x2) / 2 - 28}, ${my - 9})`}>
                      <rect width="56" height="18" rx="9" fill="var(--surface)" stroke="var(--border)" />
                      <text x="28" y="13" textAnchor="middle" fontSize="9" fill="var(--text-3)" style={{ fontFamily: "var(--mono-font)" }}>
                        {e.range}
                      </text>
                    </g>
                  </g>
                );
              })}
              {nodes.map((n) => (
                <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx="12"
                    fill={n.id === currentModId ? "var(--accent-soft)" : "var(--surface)"}
                    stroke={n.id === currentModId ? "var(--accent)" : n.layerCol}
                    strokeWidth={n.id === currentModId ? 2 : 1.5}
                  />
                  <text x={NODE_W / 2} y="28" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--text)">
                    {n.id}
                  </text>
                  <text x={NODE_W / 2} y="48" textAnchor="middle" fontSize="10" fill="var(--text-3)" style={{ fontFamily: "var(--mono-font)" }}>
                    v{n.version} · {n.layerName}
                  </text>
                </g>
              ))}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[11px] text-[var(--text-faint)]">{label}</span>
      <span className="text-[13px] font-semibold text-[var(--text)]">{value}</span>
    </div>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {text}
    </div>
  );
}
