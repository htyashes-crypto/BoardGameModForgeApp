import { useMemo, useState } from "react";
import { CloseSmall } from "@icon-park/react";
import type { ModLayer, ModListSnapshot } from "../types";
import { createMod, deriveModId } from "../lib/create";
import { useMaskDismiss } from "./ui/maskDismiss";
import { useEscClose } from "./ui/useEscClose";

const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const ID_PATTERN = /^[a-z][a-z0-9._-]+$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

const LAYERS: { value: ModLayer; title: string; desc: string; color: string }[] = [
  { value: "base", title: "base · 基础库", desc: "被其他 Mod 依赖的公共能力,不引用别的 Mod", color: "var(--success)" },
  { value: "mid", title: "mid · 中间层", desc: "在基础库之上组合领域逻辑,可被应用层引用", color: "var(--text-2)" },
  { value: "app", title: "app · 应用层", desc: "面向具体玩法,通常不被依赖(默认)", color: "var(--accent)" },
];

/** 新建 Mod 弹窗(对 modal-new-mod.svg;只建空骨架,绝不内嵌模板选择)。 */
export default function NewModModal({
  projectPath,
  projectName,
  snapshot,
  onClose,
  onCreated,
}: {
  projectPath: string;
  projectName: string;
  snapshot: ModListSnapshot;
  onClose: () => void;
  onCreated: (openInIde: boolean, modDirPath: string) => void;
}) {
  const [modName, setModName] = useState("");
  const [modId, setModId] = useState("");
  const [idTouched, setIdTouched] = useState(false);
  const [version, setVersion] = useState("1.0.0");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [layer, setLayer] = useState<ModLayer>("app");
  const [deps, setDeps] = useState<Set<string>>(new Set());
  const [openInIde, setOpenInIde] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const mask = useMaskDismiss(onClose);
  useEscClose(onClose);

  const effectiveId = idTouched ? modId : modName ? deriveModId(projectName, modName) : "";
  const existingMods = snapshot.mods.filter((m) => m.manifest);

  const liveErrors = useMemo(() => {
    const out: string[] = [];
    if (modName && !NAME_PATTERN.test(modName)) out.push("Mod 名要求 ^[A-Za-z][A-Za-z0-9_]*$(字母开头,无空格)");
    if (modName && snapshot.mods.some((m) => m.modDir === modName)) out.push(`已存在同名子目录:${modName}/`);
    if (effectiveId && !ID_PATTERN.test(effectiveId)) out.push("Mod Id 要求 ^[a-z][a-z0-9._-]+$");
    if (effectiveId && existingMods.some((m) => m.manifest!.id === effectiveId)) out.push(`Mod Id "${effectiveId}" 已被占用`);
    if (version && !VERSION_PATTERN.test(version)) out.push("版本要求 major.minor.patch");
    return out;
  }, [modName, effectiveId, version, snapshot.mods, existingMods]);

  const canSubmit = !!modName && !!effectiveId && !!version && liveErrors.length === 0 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrors([]);
    const result = await createMod({
      projectPath,
      modName,
      modId: effectiveId,
      version,
      description: description.trim() || undefined,
      author: author.trim() || undefined,
      dependencies: [...deps].map((id) => {
        const target = existingMods.find((m) => m.manifest!.id === id)!;
        return { id, versionRange: `^${target.manifest!.version}` };
      }),
      layer,
    });
    setSubmitting(false);
    if (result.success) onCreated(openInIde, result.modDirPath);
    else setErrors(result.errors);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45" {...mask}>
      <div
        className="flex max-h-[92vh] w-[860px] max-w-[94vw] flex-col overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--elevated)] p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text)]">新建 Mod</h2>
            <p className="mt-1 text-[11px] text-[var(--text-3)]">
              在 {projectName} 的 ModBehaviourProject/ 下生成空 Mod 骨架(不含任何 Behaviour)
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost h-8 w-8 px-0">
            <CloseSmall theme="outline" size="16" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-[10px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-2.5">
          <span className="text-[12px] text-[var(--text-2)]">🔒 目标工程:{projectName}(已绑定,不可改)</span>
          <span className="text-[10px] text-[var(--text-faint)]" style={{ fontFamily: "var(--mono-font)" }}>
            {projectPath}
          </span>
        </div>

        {/* 基础信息 */}
        <div className="mt-5 grid grid-cols-[260px_1fr_96px] gap-3">
          <Field label="Mod 名" hint="PascalCase,字母开头">
            <input value={modName} onChange={(e) => setModName(e.target.value)} placeholder="WeatherMod" className="input" autoFocus />
          </Field>
          <Field label="Mod Id" hint="由 Mod 名自动派生,可手改">
            <input
              value={effectiveId}
              onChange={(e) => {
                setIdTouched(true);
                setModId(e.target.value);
              }}
              placeholder="com.boardgame.<工程>.<mod>"
              className="input"
              style={{ fontFamily: "var(--mono-font)" }}
            />
          </Field>
          <Field label="版本">
            <input value={version} onChange={(e) => setVersion(e.target.value)} className="input" style={{ fontFamily: "var(--mono-font)" }} />
          </Field>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_260px] gap-3">
          <Field label="描述(可选)">
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="input" />
          </Field>
          <Field label="作者(可选)">
            <input value={author} onChange={(e) => setAuthor(e.target.value)} className="input" />
          </Field>
        </div>

        {/* 架构层级 */}
        <div className="mt-5">
          <div className="text-[11px] text-[var(--text-3)]">架构层级</div>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {LAYERS.map((l) => (
              <button
                key={l.value}
                onClick={() => setLayer(l.value)}
                className={
                  "relative rounded-xl border px-4 py-3.5 text-left transition-colors " +
                  (layer === l.value
                    ? "border-[var(--accent-border)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--surface-soft)] hover:bg-[var(--surface-hover)]")
                }
              >
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                  <span className="text-[12px] font-semibold text-[var(--text)]">{l.title}</span>
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--text-faint)]">{l.desc}</p>
                {layer === l.value && (
                  <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[9px] text-white">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 依赖多选 */}
        <div className="mt-5">
          <div className="text-[11px] text-[var(--text-3)]">依赖现有 Mod(可多选,将写入 mod.json 并生成 csproj 引用)</div>
          {existingMods.length === 0 ? (
            <div className="mt-2 text-[11px] text-[var(--text-faint)]">工程内暂无其他 Mod</div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2.5">
              {existingMods.map((m) => {
                const id = m.manifest!.id;
                const checked = deps.has(id);
                return (
                  <button
                    key={id}
                    onClick={() => {
                      const next = new Set(deps);
                      if (checked) next.delete(id);
                      else next.add(id);
                      setDeps(next);
                    }}
                    className={
                      "flex items-center gap-2.5 rounded-lg border px-3.5 py-2 text-[11px] transition-colors " +
                      (checked
                        ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--text)]"
                        : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-2)] hover:bg-[var(--surface-hover)]")
                    }
                  >
                    <span
                      className={
                        "flex h-3.5 w-3.5 items-center justify-center rounded border text-[9px] text-white " +
                        (checked ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--text-faint)]")
                      }
                    >
                      {checked ? "✓" : ""}
                    </span>
                    {id} <span className="text-[var(--text-faint)]">v{m.manifest!.version}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 骨架预览 */}
        <div className="mt-5">
          <div className="text-[11px] text-[var(--text-3)]">将生成的骨架</div>
          <pre className="mt-2 overflow-x-auto rounded-[10px] border border-[var(--border)] bg-[var(--term-bg)] px-5 py-4 text-[11px] leading-relaxed" style={{ fontFamily: "var(--mono-font)" }}>
            <span className="text-[var(--term-fg)]">ModBehaviourProject/{modName || "<Mod名>"}/</span>
            {`\n`}
            <span className="text-[var(--text-3)]">{`├─ ${modName || "<Mod名>"}.sln        ← IDE 入口(位于 Mod 根,窗口标题 = Mod 名)\n├─ mod.json              ← id / 版本 / 依赖 / 层级\n└─ src/${modName || "<Mod名>"}.csproj ← 编译输出 ${modName || "<Mod名>"}Behaviour.dll 到 Mod 根`}</span>
          </pre>
        </div>

        {/* 错误区 */}
        {(liveErrors.length > 0 || errors.length > 0) && (
          <ul className="mt-4 flex flex-col gap-1.5">
            {[...liveErrors, ...errors].map((e, i) => (
              <li key={i} className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-soft)] px-3.5 py-2 text-[11px] text-[var(--danger)]">
                {e}
              </li>
            ))}
          </ul>
        )}

        {/* footer */}
        <div className="mt-6 flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2.5 text-[12px] text-[var(--text-2)]">
            <button
              onClick={() => setOpenInIde(!openInIde)}
              className={
                "flex h-4 w-4 items-center justify-center rounded border text-[10px] text-white " +
                (openInIde ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--text-faint)]")
              }
            >
              {openInIde ? "✓" : ""}
            </button>
            创建后立即在 IDE 打开 src/
          </label>
          <div className="flex items-center gap-2.5">
            <button onClick={onClose} className="btn-ghost h-9">
              取消
            </button>
            <button onClick={() => void submit()} disabled={!canSubmit} className="btn-primary h-9">
              {submitting ? "创建中…" : `创建 Mod${deps.size > 0 ? `(含 ${deps.size} 依赖)` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-[var(--text-3)]">{label}</div>
      <div className="mt-1.5">{children}</div>
      {hint && <div className="mt-1 text-[10px] text-[var(--text-faint)]">{hint}</div>}
    </div>
  );
}
