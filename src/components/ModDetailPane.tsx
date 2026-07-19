import { Delete, FolderOpen, Lightning, Plus } from "@icon-park/react";
import { openPath } from "@tauri-apps/plugin-opener";
import type { ModInfo, ModLayer } from "../types";
import { formatBytes, formatMtime, shortSha } from "../lib/format";
import { layerColor } from "./ModListItem";
import DependencyStrip from "./DependencyStrip";
import BehaviourCard from "./BehaviourCard";

const LAYER_LABEL: Record<ModLayer, string> = { base: "base · 基础库", mid: "mid · 中间层", app: "app · 应用层" };

/** Mod 详情主面板(对 workspace.svg 右区)。manifest 解析失败时整面显示错误列表。 */
export default function ModDetailPane({
  mod,
  layer,
  ideName,
  topologyOrder,
  dependsOn,
  usedBy,
  onOpenInIde,
  onBuild,
  onDelete,
  onNewBehaviour,
  building,
}: {
  mod: ModInfo;
  layer: ModLayer;
  ideName: string | null;
  topologyOrder: string[];
  dependsOn: { id: string; versionRange: string; resolved: boolean }[];
  usedBy: string[];
  onOpenInIde: () => void;
  onBuild: () => void;
  onDelete: () => void;
  onNewBehaviour: () => void;
  building: boolean;
}) {
  if (!mod.manifest) {
    return (
      <div className="flex min-h-0 flex-1 flex-col p-7">
        <h2 className="text-xl font-bold text-[var(--danger)]">mod.json 解析失败:{mod.modDir}</h2>
        <ul className="mt-4 flex flex-col gap-2">
          {mod.manifestErrors.map((e, i) => (
            <li key={i} className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-soft)] px-4 py-2.5 text-[12px] text-[var(--danger)]">
              {e}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12px] text-[var(--text-3)]">
          修复 {mod.modDirPath}\mod.json 后点左上角「依赖图」旁的刷新,或重新选中本 Mod。
        </p>
      </div>
    );
  }

  const m = mod.manifest;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-7">
      {/* 头部 */}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold text-[var(--text)]">{m.name}</h2>
            <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2.5 py-0.5 text-[10px] text-[var(--text-2)]" style={{ fontFamily: "var(--mono-font)" }}>
              v{m.version}
            </span>
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
              style={{ color: layerColor(layer), background: "color-mix(in srgb, currentColor 14%, transparent)" }}
            >
              {LAYER_LABEL[layer]}
            </span>
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
              style={{
                color: mod.hasDll ? "var(--success)" : "var(--warn)",
                background: "color-mix(in srgb, currentColor 14%, transparent)",
              }}
            >
              {mod.hasDll ? "✓ 已编译" : "⚠ 未编译"}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-[var(--text-faint)]" style={{ fontFamily: "var(--mono-font)" }}>
            {m.id} · {mod.behaviours.length} Behaviour{m.author ? ` · by ${m.author}` : ""}
          </div>
          {m.description && <p className="mt-2 text-[12px] text-[var(--text-3)]">{m.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <button onClick={onOpenInIde} disabled={!ideName} title={ideName ? undefined : "未检测到 IDE,去设置配置"} className="btn-ghost">
            <Lightning theme="outline" size="14" />
            在 {ideName ?? "IDE"} 中打开
          </button>
          <button onClick={onBuild} disabled={building} className="btn-primary">
            编译并部署
          </button>
          <button onClick={() => void openPath(mod.modDirPath)} title="在资源管理器中打开" className="btn-ghost w-10 px-0">
            <FolderOpen theme="outline" size="15" />
          </button>
          <button onClick={onDelete} title="删除 Mod(移入回收站)" className="btn-ghost w-10 px-0 text-[var(--danger)]">
            <Delete theme="outline" size="15" />
          </button>
        </div>
      </div>

      {/* 依赖条 */}
      <div className="mt-6">
        <DependencyStrip provides={mod.behaviours.length} dependsOn={dependsOn} usedBy={usedBy} topologyOrder={topologyOrder} selfId={m.id} />
      </div>

      {/* 主体两列:Behaviour 列表 + 元信息 */}
      <div className="mt-6 grid min-h-0 flex-1 grid-cols-[1fr_320px] gap-6">
        <section className="min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2.5">
              <span className="text-[11px] font-semibold tracking-[1.5px] text-[var(--text-3)]">BEHAVIOUR</span>
              <span className="text-[11px] text-[var(--text-faint)]">{mod.behaviours.length}</span>
            </div>
            <button onClick={onNewBehaviour} className="btn-ghost h-8">
              <Plus theme="outline" size="13" />
              新建 Behaviour
            </button>
          </div>
          {mod.behaviours.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] px-6 py-10 text-center text-[12px] text-[var(--text-3)]">
              尚无 Behaviour — 点右上「新建 Behaviour」生成第一个 C# 类
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2.5">
              {mod.behaviours.map((b) => (
                <BehaviourCard key={b.sourceFile + b.className} behaviour={b} />
              ))}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4">
            <div className="text-[11px] font-semibold tracking-[1.5px] text-[var(--text-3)]">元信息</div>
            <MetaRow label="MOD ID" mono value={m.id} />
            <MetaRow label="VERSION" mono value={m.version} />
            <MetaRow label="CSPROJ" mono value={`src\\${mod.modDir}.csproj`} />
            <div className="mt-3.5">
              <div className="text-[10px] text-[var(--text-faint)]">OUTPUT DLL</div>
              {mod.hasDll ? (
                <>
                  <div className="mt-1 break-all text-[10.5px] text-[var(--text)]" style={{ fontFamily: "var(--mono-font)" }}>
                    {mod.modDir}Behaviour.dll · {formatBytes(mod.dllSize)}
                  </div>
                  <div className="mt-0.5 text-[9px] text-[var(--text-faint)]" style={{ fontFamily: "var(--mono-font)" }}>
                    {formatMtime(mod.dllMtime)}{mod.dllSha256 ? ` · sha256 ${shortSha(mod.dllSha256)}` : ""}
                  </div>
                </>
              ) : (
                <div className="mt-1 text-[11px] text-[var(--warn)]">未编译 — 点「编译并部署」产出</div>
              )}
            </div>
            {m.author && <MetaRow label="AUTHOR" value={m.author} />}
            <div className="mt-4 border-t border-[var(--border-soft)] pt-3 text-[9.5px] leading-relaxed text-[var(--text-faint)]">
              dll 输出到 Mod 根,Unity 端热检测 hash 变化
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3.5 text-[10px] leading-relaxed text-[var(--text-3)]">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
            <span>编译会自动带上依赖闭包并按拓扑序串行执行</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="mt-3.5">
      <div className="text-[10px] text-[var(--text-faint)]">{label}</div>
      <div
        className="mt-1 break-all text-[10.5px] text-[var(--text)]"
        style={mono ? { fontFamily: "var(--mono-font)" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
