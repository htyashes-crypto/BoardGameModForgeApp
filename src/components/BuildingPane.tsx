import { useEffect, useRef } from "react";
import { CloseSmall } from "@icon-park/react";
import type { BuildLogChunk, BuildStatus, BuildTask } from "../types";
import { cancelBuild, clearBuildTask } from "../stores/buildStore";

const BADGE: Record<BuildStatus, { text: string; color: string }> = {
  pending: { text: "… PENDING", color: "var(--text-3)" },
  running: { text: "⚡ BUILDING", color: "var(--accent-text)" },
  success: { text: "✓ SUCCESS", color: "var(--success)" },
  failed: { text: "✗ FAILED", color: "var(--danger)" },
  cancelled: { text: "⏹ CANCELLED", color: "var(--warn)" },
};

const LEVEL_COLOR: Record<BuildLogChunk["level"], string> = {
  info: "var(--term-fg)",
  ok: "var(--success)",
  warn: "var(--warn)",
  err: "var(--danger)",
  prompt: "var(--accent-text)",
};

/** 编译进行/终态视图(对 workspace-building.svg:徽标 + 步进条 + 实时日志)。 */
export default function BuildingPane({ task, logs }: { task: BuildTask; logs: BuildLogChunk[] }) {
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [logs.length]);

  const badge = BADGE[task.status];
  const steps = [...task.modIds, "通知 Unity"];
  const elapsed = Math.floor(((task.endedAt ?? Date.now()) - task.startedAt) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  const subtitle =
    task.status === "running"
      ? `依赖闭包 ${task.modIds.length} 个 Mod · 正在编译第 ${Math.min(task.completedCount + 1, task.modIds.length)} / ${task.modIds.length} 个${task.currentModId ? `:${task.currentModId}` : ""} · 已用时 ${mm}:${ss}`
      : task.status === "success"
        ? `全部 ${task.modIds.length} 个 Mod 编译+部署完成 · 用时 ${mm}:${ss}`
        : task.status === "cancelled"
          ? "已取消(已完成 Mod 的 dll 保留)"
          : (task.failureReason ?? "编译失败");

  return (
    <div className="flex min-h-0 flex-1 flex-col p-7">
      <div className="flex items-start justify-between gap-6">
        <div>
          <span
            className="rounded-full px-3 py-1 text-[11px] font-bold"
            style={{ color: badge.color, background: "color-mix(in srgb, currentColor 14%, transparent)" }}
          >
            {badge.text}
          </span>
          <h2 className="mt-3 text-xl font-bold text-[var(--text)]">编译并部署:{task.rootModId}</h2>
          <p className="mt-1.5 text-[12px] text-[var(--text-3)]">{subtitle}</p>
        </div>
        {task.status === "running" ? (
          <button
            onClick={() => void cancelBuild()}
            className="shrink-0 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-soft)] px-4 py-2 text-[12px] text-[var(--danger)] hover:border-[var(--danger)]"
          >
            ⏹ 取消编译
          </button>
        ) : (
          <button onClick={clearBuildTask} className="btn-ghost shrink-0">
            <CloseSmall theme="outline" size="14" />
            关闭日志面板
          </button>
        )}
      </div>

      {/* 步进条 */}
      <div className="mt-7 flex items-start px-4">
        {steps.map((step, i) => {
          const isNotify = i === task.modIds.length;
          const done = task.status === "success" ? true : i < task.completedCount;
          const active =
            task.status === "running" && (isNotify ? task.completedCount === task.modIds.length : task.currentModId === step);
          return (
            <div key={step} className="flex min-w-0 flex-1 items-start last:flex-none">
              <div className="flex w-24 shrink-0 flex-col items-center">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-semibold"
                  style={
                    done
                      ? { color: "var(--success)", borderColor: "var(--success)", background: "var(--success-soft)" }
                      : active
                        ? { color: "var(--accent-text)", borderColor: "var(--accent)", background: "var(--accent-soft)", borderWidth: 2 }
                        : { color: "var(--text-faint)", borderColor: "var(--border)", background: "var(--surface-soft)" }
                  }
                >
                  {done ? "✓" : active ? "⚡" : i + 1}
                </span>
                <span className={"mt-2 max-w-full truncate text-[10.5px] " + (active ? "font-semibold text-[var(--text)]" : "text-[var(--text-3)]")}>
                  {step}
                </span>
              </div>
              {i < steps.length - 1 && (
                <span className="mt-4 h-[2px] min-w-4 flex-1" style={{ background: done ? "var(--success)" : "var(--border)" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* 实时日志 */}
      <div className="mt-6 flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--border)] bg-[var(--term-bg)]">
        <div ref={logRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {logs.map((c, i) => (
            <div
              key={i}
              className="whitespace-pre-wrap break-all text-[12px] leading-[1.9]"
              style={{ color: LEVEL_COLOR[c.level], fontFamily: "var(--mono-font)" }}
            >
              {c.text}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-[var(--border-soft)] px-5 py-2.5">
          <span className="text-[10px] text-[var(--text-faint)]" style={{ fontFamily: "var(--mono-font)" }}>
            {logs.length} 行 · 自动滚动到底部
          </span>
          {task.status === "running" && (
            <span className="flex items-center gap-2 text-[10px] text-[var(--text-faint)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
              流式输出中
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
