/** Mod 详情顶部依赖关系条(对 workspace.svg 四段:PROVIDES / DEPENDS ON / USED BY / 加载顺序)。 */
export default function DependencyStrip({
  provides,
  dependsOn,
  usedBy,
  topologyOrder,
  selfId,
}: {
  provides: number;
  dependsOn: { id: string; versionRange: string; resolved: boolean }[];
  usedBy: string[];
  topologyOrder: string[];
  selfId: string;
}) {
  const pos = topologyOrder.indexOf(selfId);
  return (
    <div className="grid grid-cols-4 divide-x divide-[var(--border-soft)] rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] py-4">
      <Seg label="PROVIDES">
        <span className="text-[13px] text-[var(--text)]">{provides} 个 Behaviour</span>
      </Seg>
      <Seg label="DEPENDS ON">
        {dependsOn.length === 0 ? (
          <span className="text-[12px] text-[var(--text-3)]">无依赖</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {dependsOn.map((d) => (
              <span
                key={d.id}
                title={`${d.id} ${d.versionRange}`}
                className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                style={{
                  color: d.resolved ? "var(--success)" : "var(--danger)",
                  background: "color-mix(in srgb, currentColor 14%, transparent)",
                }}
              >
                {d.id} {d.resolved ? "✓" : "✗"}
              </span>
            ))}
          </div>
        )}
      </Seg>
      <Seg label="USED BY">
        {usedBy.length === 0 ? (
          <span className="text-[12px] text-[var(--text-3)]">无(叶子 Mod)</span>
        ) : (
          <span className="text-[12px] text-[var(--text)]">{usedBy.join("、")}</span>
        )}
      </Seg>
      <Seg label="加载顺序">
        <div className="text-[14px] font-semibold text-[var(--text)]">
          {pos >= 0 ? `${pos + 1} / ${topologyOrder.length}` : "—"}
        </div>
        <div className="mt-1 truncate text-[9px] text-[var(--text-faint)]" style={{ fontFamily: "var(--mono-font)" }}>
          {topologyOrder.map((id, i) => (
            <span key={id} className={id === selfId ? "text-[var(--accent-text)]" : undefined}>
              {i > 0 && " → "}
              {id}
            </span>
          ))}
        </div>
      </Seg>
    </div>
  );
}

function Seg({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-5">
      <div className="text-[10px] tracking-[1px] text-[var(--text-faint)]">{label}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}
