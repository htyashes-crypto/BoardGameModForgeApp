import type { ModInfo, ModLayer } from "../types";

/** 层级色(mockup 约定:base=success 绿 / mid=中性 / app=陶土橙)。 */
export function layerColor(layer: ModLayer): string {
  if (layer === "base") return "var(--success)";
  if (layer === "mid") return "var(--text-2)";
  return "var(--accent)";
}

/** 缺 layer 声明时按拓扑位置推断:首=base、末=app、中=mid(镜像旧行为)。 */
export function effectiveLayer(mod: ModInfo, topologyOrder: string[]): ModLayer {
  if (mod.manifest?.layer) return mod.manifest.layer;
  const id = mod.manifest?.id;
  const idx = id ? topologyOrder.indexOf(id) : -1;
  if (idx < 0 || topologyOrder.length <= 1) return "app";
  if (idx === 0) return "base";
  if (idx === topologyOrder.length - 1) return "app";
  return "mid";
}

/** 左栏 Mod 卡片(对 workspace.svg 列表项)。 */
export default function ModListItem({
  mod,
  layer,
  selected,
  onSelect,
}: {
  mod: ModInfo;
  layer: ModLayer;
  selected: boolean;
  onSelect: () => void;
}) {
  const color = layerColor(layer);
  const broken = !mod.manifest;
  return (
    <button
      onClick={onSelect}
      className={
        "relative flex flex-col gap-2 rounded-[10px] border px-4 py-3 text-left transition-colors " +
        (selected
          ? "border-[var(--accent-border)] bg-[var(--accent-soft)]"
          : "border-[var(--border-soft)] bg-[var(--surface-soft)] hover:bg-[var(--surface-hover)]")
      }
    >
      {selected && <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-[var(--accent)]" />}
      <div className="flex items-center gap-2.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--text)]">
          {mod.manifest?.name ?? mod.modDir}
        </span>
        {mod.manifest && (
          <span className="text-[10px] text-[var(--text-faint)]" style={{ fontFamily: "var(--mono-font)" }}>
            v{mod.manifest.version}
          </span>
        )}
      </div>
      {broken ? (
        <div className="truncate text-[10px] text-[var(--danger)]">{mod.manifestErrors[0] ?? "manifest 解析失败"}</div>
      ) : (
        <div className="flex items-center gap-2.5 pl-[18px] text-[10px]">
          <span
            className="rounded-full px-2 py-px font-semibold"
            style={{ color, background: "color-mix(in srgb, currentColor 14%, transparent)" }}
          >
            {layer}
          </span>
          <span className="text-[var(--text-faint)]">{mod.behaviours.length} Behaviour</span>
          <span className="ml-auto" style={{ color: mod.hasDll ? "var(--success)" : "var(--warn)" }}>
            {mod.hasDll ? "✓ 已编译" : "⚠ 未编译"}
          </span>
        </div>
      )}
    </button>
  );
}
