import type { BehaviourMeta } from "../types";

/** 单个 [ModObjectBehaviour] 类卡片(对 workspace.svg 行为卡)。 */
export default function BehaviourCard({ behaviour }: { behaviour: BehaviourMeta }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--accent-soft)]">
        <HammerGlyph />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <span className="truncate text-[14px] text-[var(--accent-text)]" style={{ fontFamily: "var(--mono-font)" }}>
            {behaviour.className}
          </span>
          <span
            className="ml-auto shrink-0 text-[10px] text-[var(--text-faint)]"
            style={{ fontFamily: "var(--mono-font)" }}
          >
            src/{behaviour.sourceFile}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2.5 text-[11px]">
          {behaviour.displayName && <span className="text-[var(--text-2)]">{behaviour.displayName}</span>}
          {behaviour.category && (
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-px text-[9px] text-[var(--text-3)]">
              {behaviour.category}
            </span>
          )}
          {behaviour.behaviourId ? (
            <span className="text-[10px] text-[var(--text-faint)]" style={{ fontFamily: "var(--mono-font)" }}>
              id = {behaviour.behaviourId}
            </span>
          ) : (
            <span className="text-[10px] text-[var(--danger)]">⚠ 缺 Id attribute</span>
          )}
        </div>
      </div>
    </div>
  );
}

function HammerGlyph() {
  return (
    <svg viewBox="0 0 18 18" className="h-4.5 w-4.5">
      <rect x="3" y="4.5" width="8" height="4" rx="1.2" fill="var(--accent-text)" />
      <rect x="6" y="8.5" width="2.4" height="6" rx="1.2" fill="var(--text-3)" />
    </svg>
  );
}
