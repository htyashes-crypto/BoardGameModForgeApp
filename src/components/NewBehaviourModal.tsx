import { useMemo, useState } from "react";
import { CloseSmall } from "@icon-park/react";
import type { ModInfo, ModListSnapshot } from "../types";
import type { BehaviourTemplateKind } from "../lib/templates/behaviourTemplate";
import { createBehaviour, deriveBehaviourIdPrefix, ensureBehaviourSuffix } from "../lib/create";
import { useMaskDismiss } from "./ui/maskDismiss";
import { useEscClose } from "./ui/useEscClose";

const CLASS_NAME_PATTERN = /^[A-Z][A-Za-z0-9_]*$/;

const TEMPLATES: { kind: BehaviourTemplateKind; icon: string; title: string; desc: string }[] = [
  { kind: "empty", icon: "○", title: "Empty · 空骨架", desc: "仅 OnInitialize 空实现,最干净的起点" },
  { kind: "tick", icon: "⟳", title: "Tick · 周期驱动", desc: "重写 OnUpdate,按 intervalSec 周期执行,演示 [ModObjectVariable] 可配变量" },
  { kind: "subscribe", icon: "⚡", title: "Subscribe · 事件订阅", desc: "OnInitialize 内 Subscribe 桌游事件(如 OnClickEntity)并响应" },
  { kind: "chain", icon: "⛓", title: "Chain · 链式派发", desc: "订阅事件 → 调 Bg*Ops → 派发全局事件,联动蓝图侧 GlobalEvent / Listen" },
];

/** 新建 Behaviour 弹窗(对 modal-new-behaviour.svg)。 */
export default function NewBehaviourModal({
  projectPath,
  mod,
  snapshot,
  onClose,
  onCreated,
}: {
  projectPath: string;
  mod: ModInfo;
  snapshot: ModListSnapshot;
  onClose: () => void;
  onCreated: (jumpInIde: boolean, filePath: string) => void;
}) {
  const [rawName, setRawName] = useState("");
  const [behaviourId, setBehaviourId] = useState("");
  const [idTouched, setIdTouched] = useState(false);
  const [template, setTemplate] = useState<BehaviourTemplateKind>("empty");
  const [jumpInIde, setJumpInIde] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const mask = useMaskDismiss(onClose);
  useEscClose(onClose);

  const className = rawName.trim() ? ensureBehaviourSuffix(rawName.trim()) : "";
  const prefix = mod.manifest?.behaviourIdPrefix ?? deriveBehaviourIdPrefix(mod.manifest?.id ?? mod.modDir);
  const classRoot = className.replace(/Behaviour$/, "");
  const effectiveId = idTouched ? behaviourId : classRoot ? `${prefix}.${classRoot.toLowerCase()}` : "";

  const liveErrors = useMemo(() => {
    const out: string[] = [];
    if (className && !CLASS_NAME_PATTERN.test(className)) out.push("类名要求 ^[A-Z][A-Za-z0-9_]*$(大写字母开头)");
    if (className && mod.behaviours.some((b) => b.className === className)) out.push(`同名文件已存在:${className}.cs`);
    if (effectiveId) {
      for (const m of snapshot.mods) {
        const hit = m.behaviours.find((b) => b.behaviourId === effectiveId);
        if (hit) {
          out.push(`BehaviourId 已被占用:"${effectiveId}"(在 ${m.modDir}/${hit.sourceFile})`);
          break;
        }
      }
    }
    return out;
  }, [className, effectiveId, mod.behaviours, snapshot.mods]);

  const canSubmit = !!className && !!effectiveId && liveErrors.length === 0 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrors([]);
    const result = await createBehaviour({
      projectPath,
      modDir: mod.modDir,
      className,
      behaviourId: effectiveId,
      template,
    });
    setSubmitting(false);
    if (result.success) onCreated(jumpInIde, result.filePath);
    else setErrors(result.errors);
  }

  const previewAttr = `[ModObjectBehaviour("${effectiveId || "<id>"}",\n    DisplayName = "${classRoot || "<名>"}", Category = "Mods/${mod.modDir}/Behaviour")]`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45" {...mask}>
      <div
        className="flex max-h-[92vh] w-[860px] max-w-[94vw] flex-col overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--elevated)] p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text)]">新建 Behaviour</h2>
            <p className="mt-1 text-[11px] text-[var(--text-3)]">
              在 {mod.manifest?.name ?? mod.modDir} 内生成一个挂载 [ModObjectBehaviour] 特性的 C# 类
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost h-8 w-8 px-0">
            <CloseSmall theme="outline" size="16" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-[10px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-2.5">
          <span className="text-[12px] text-[var(--text-2)]">🔒 所属 Mod:{mod.manifest?.name ?? mod.modDir}</span>
          <span className="text-[10px] text-[var(--text-faint)]" style={{ fontFamily: "var(--mono-font)" }}>
            {mod.manifest?.id}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] text-[var(--text-3)]">类名</div>
            <input value={rawName} onChange={(e) => setRawName(e.target.value)} placeholder="RainTick" className="input mt-1.5" autoFocus />
            <div className="mt-1 text-[10px] text-[var(--accent-text)]" style={{ fontFamily: "var(--mono-font)" }}>
              → 将生成 src/{className || "<类名>Behaviour"}.cs(自动补 Behaviour 后缀)
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[var(--text-3)]">Behaviour Id</div>
            <input
              value={effectiveId}
              onChange={(e) => {
                setIdTouched(true);
                setBehaviourId(e.target.value);
              }}
              className="input mt-1.5"
              style={{ fontFamily: "var(--mono-font)" }}
            />
            <div className="mt-1 text-[10px] text-[var(--text-faint)]">默认 &lt;前缀&gt;.&lt;类名小写&gt;,全工程唯一,可手改</div>
          </div>
        </div>

        {/* 起始模板 */}
        <div className="mt-5">
          <div className="text-[11px] text-[var(--text-3)]">起始模板(仅决定初始代码,创建后可任意改)</div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.kind}
                onClick={() => setTemplate(t.kind)}
                className={
                  "relative rounded-xl border px-5 py-4 text-left transition-colors " +
                  (template === t.kind
                    ? "border-[var(--accent-border)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--surface-soft)] hover:bg-[var(--surface-hover)]")
                }
              >
                <div className="text-[12px] font-semibold text-[var(--text)]">
                  {t.icon} {t.title}
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--text-faint)]">{t.desc}</p>
                {template === t.kind && (
                  <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[9px] text-white">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 生成文件预览 */}
        <div className="mt-5">
          <div className="text-[11px] text-[var(--text-3)]">
            生成文件预览 · <span style={{ fontFamily: "var(--mono-font)" }}>src/{className || "<类名>Behaviour"}.cs</span>
          </div>
          <pre className="mt-2 overflow-x-auto rounded-[10px] border border-[var(--border)] bg-[var(--term-bg)] px-5 py-4 text-[11px] leading-relaxed" style={{ fontFamily: "var(--mono-font)" }}>
            <span className="text-[var(--accent-text)]">{previewAttr}</span>
            {"\n"}
            <span className="text-[var(--term-fg)]">{`public class ${className || "<类名>Behaviour"} : ModObjectBehaviour`}</span>
            {"\n"}
            <span className="text-[var(--text-3)]">{"{\n    // " + TEMPLATES.find((t) => t.kind === template)!.desc + "\n}"}</span>
          </pre>
        </div>

        {(liveErrors.length > 0 || errors.length > 0) && (
          <ul className="mt-4 flex flex-col gap-1.5">
            {[...liveErrors, ...errors].map((e, i) => (
              <li key={i} className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-soft)] px-3.5 py-2 text-[11px] text-[var(--danger)]">
                {e}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2.5 text-[12px] text-[var(--text-2)]">
            <button
              onClick={() => setJumpInIde(!jumpInIde)}
              className={
                "flex h-4 w-4 items-center justify-center rounded border text-[10px] text-white " +
                (jumpInIde ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--text-faint)]")
              }
            >
              {jumpInIde ? "✓" : ""}
            </button>
            创建后立即在 IDE 跳转到该文件
          </label>
          <div className="flex items-center gap-2.5">
            <button onClick={onClose} className="btn-ghost h-9">
              取消
            </button>
            <button onClick={() => void submit()} disabled={!canSubmit} className="btn-primary h-9">
              {submitting ? "创建中…" : "创建 Behaviour"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
