import { useEffect, useMemo, useState } from 'react'
import type { CreateModInput, ModDependency, ModInfo } from '../types/api'

const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/
const ID_PATTERN = /^[a-z][a-z0-9._-]+$/

interface NewModModalProps {
  projectPath: string
  projectName: string
  /** 当前工程已有 Mod 列表(用于依赖多选 + 重名校验)。 */
  existingMods: ModInfo[]
  onClose(): void
  /** 创建成功回调,传 modDirPath 让 caller 触发刷新 + 跳转打开 IDE。 */
  onCreated(modDirPath: string, modId: string, openInIde: boolean): void
}

/**
 * 新建 Mod 弹窗 — 对应 mockup `.claude/svg/modforge-modal-new-mod.svg`。
 * 严格"空骨架":只生成 mod.json + csproj + sln,不内嵌任何 Behaviour 类。
 */
export function NewModModal({ projectPath, projectName, existingMods, onClose, onCreated }: NewModModalProps) {
  const [modName, setModName] = useState('')
  const [modId, setModId] = useState('')
  const [modIdEdited, setModIdEdited] = useState(false)
  const [version, setVersion] = useState('1.0.0')
  const [description, setDescription] = useState('')
  const [author, setAuthor] = useState('')
  const [selectedDeps, setSelectedDeps] = useState<Record<string, boolean>>({})
  const [openInIde, setOpenInIde] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitErrors, setSubmitErrors] = useState<string[]>([])

  // modName 改变时自动派生 modId(用户未手改时)
  useEffect(() => {
    if (!modIdEdited && modName) {
      const lower = modName.toLowerCase().replace(/[^a-z0-9]/g, '')
      const derived = `com.boardgame.${projectName.toLowerCase().replace(/[^a-z0-9]/g, '')}.${lower}`
      setModId(derived)
    }
  }, [modName, modIdEdited, projectName])

  // ESC 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const existingIds = useMemo(
    () => new Set(existingMods.map((m) => m.manifest?.id).filter((id): id is string => !!id)),
    [existingMods]
  )
  const existingNames = useMemo(() => new Set(existingMods.map((m) => m.modDir)), [existingMods])

  // 实时校验
  const nameError = useMemo(() => {
    if (!modName) return null
    if (!NAME_PATTERN.test(modName)) return `要求 ^[A-Za-z][A-Za-z0-9_]*$`
    if (existingNames.has(modName)) return `已存在同名目录`
    return null
  }, [modName, existingNames])

  const idError = useMemo(() => {
    if (!modId) return null
    if (!ID_PATTERN.test(modId)) return `要求 ^[a-z][a-z0-9._-]+$`
    if (existingIds.has(modId)) return `已存在同名 Mod Id`
    return null
  }, [modId, existingIds])

  const versionError = useMemo(() => {
    if (!version) return null
    if (!/^\d+\.\d+\.\d+$/.test(version)) return `要求 major.minor.patch`
    return null
  }, [version])

  const canSubmit =
    modName.length > 0 &&
    !nameError &&
    modId.length > 0 &&
    !idError &&
    version.length > 0 &&
    !versionError &&
    !submitting

  const selectedDepRefs: ModDependency[] = useMemo(() => {
    return existingMods
      .filter((m) => m.manifest && selectedDeps[m.manifest.id])
      .map((m) => ({ id: m.manifest!.id, versionRange: `>=${m.manifest!.version}` }))
  }, [existingMods, selectedDeps])

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitErrors([])
    const input: CreateModInput = {
      projectPath,
      modName,
      modId,
      version,
      description: description.trim() || undefined,
      author: author.trim() || undefined,
      dependencies: selectedDepRefs
    }
    try {
      const result = await window.api.mod.create(input)
      if (result.success) {
        onCreated(result.modDirPath, modId, openInIde)
      } else {
        setSubmitErrors(result.errors)
        setSubmitting(false)
      }
    } catch (err) {
      setSubmitErrors([(err as Error).message])
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 grid place-items-center"
      onClick={onClose}
    >
      <div
        className="w-[840px] max-h-[92vh] bg-panel-gradient border border-border-frame rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-7 pt-7 pb-5 flex items-start gap-4 border-b border-border-subtle">
          <div className="w-4 h-4 bg-brand-gradient rotate-45 rounded-sm mt-2 shrink-0" />
          <div className="flex-1">
            <h2 className="text-2xl font-extrabold tracking-wide">新建 Mod</h2>
            <p className="text-2xs text-fg-muteBright mt-1.5">
              创建空 Mod 工程骨架 · 一个 Mod = 一个 .dll = 内含 N 个 Behaviour 类
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-bg-input border border-border-frame rounded-lg grid place-items-center text-fg-mute hover:text-fg-base"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">
          {/* Target project */}
          <section>
            <FieldLabel>▸ 目标桌游工程</FieldLabel>
            <div className="mt-3 bg-bg-input border border-border-frame rounded-lg px-3 py-2.5 flex items-center gap-3">
              <div className="w-7 h-7 bg-bg-input border-[1.5px] border-brand-base rounded-md grid place-items-center text-xs font-bold text-brand-base">
                {projectName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold">{projectName}</div>
                <div className="text-3xs font-mono text-fg-muteBright truncate">{projectPath}</div>
              </div>
              <span className="px-2 h-5 inline-flex items-center text-3xs font-bold text-brand-bright bg-brand-base/15 rounded-full">
                🔒 已绑定
              </span>
            </div>
          </section>

          {/* Mod basic */}
          <section>
            <FieldLabel>▸ MOD 基础信息</FieldLabel>
            <div className="mt-3 grid grid-cols-[1fr_1fr_120px] gap-3">
              <InputBlock
                hint="Mod 名 (英文 / 无空格)"
                value={modName}
                onChange={setModName}
                placeholder="CABOGameLogic"
                error={nameError}
                focusGlow
              />
              <InputBlock
                hint="Mod Id (自动派生 · 可手改)"
                value={modId}
                onChange={(v) => {
                  setModId(v)
                  setModIdEdited(true)
                }}
                placeholder="com.boardgame.cabo.gamelogic"
                error={idError}
                mono
              />
              <InputBlock hint="版本" value={version} onChange={setVersion} placeholder="1.0.0" error={versionError} mono />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <InputBlock hint="描述(可选)" value={description} onChange={setDescription} placeholder="" />
              <InputBlock hint="作者(可选)" value={author} onChange={setAuthor} placeholder="" />
            </div>
          </section>

          {/* Dependencies */}
          <section>
            <FieldLabel>▸ 依赖现有 MOD (可选 · 类比 Minecraft 前置)</FieldLabel>
            <div className="mt-3 bg-[#0d0d0d] border border-border-frame rounded-xl p-3">
              {existingMods.length === 0 ? (
                <div className="text-2xs text-fg-muteBright italic text-center py-4">
                  当前工程暂无其他 Mod 可依赖
                </div>
              ) : (
                <div className="space-y-2">
                  {existingMods.map((mod) => {
                    if (!mod.manifest) return null
                    const id = mod.manifest.id
                    const checked = !!selectedDeps[id]
                    return (
                      <label
                        key={id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer ${
                          checked ? 'card-selected border-status-ok' : 'card'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setSelectedDeps({ ...selectedDeps, [id]: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{mod.manifest.name}</span>
                            <span className="text-2xs font-mono text-status-ok">v{mod.manifest.version}</span>
                          </div>
                          <div className="text-3xs text-fg-muteBright mt-0.5">
                            {mod.behaviours.length} Behaviour · {mod.manifest.dependencies.length} 自身依赖
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Preview */}
          <section>
            <FieldLabel>▸ 将生成的工程骨架</FieldLabel>
            <div className="mt-3 bg-[#0d0d0d] border border-border-frame rounded-xl p-4 font-mono text-2xs text-fg-mute leading-relaxed">
              <div className="text-status-warn">📂 ModBehaviourProject/</div>
              <div>└─ <span className="text-status-ok">📂 {modName || '<ModName>'}/</span></div>
              <div>    ├─ <span className="text-status-ok">📄 mod.json</span> <span className="text-fg-muteDim">// id+version+deps[{selectedDepRefs.length}]</span></div>
              <div>    └─ <span className="text-status-ok">📂 src/</span></div>
              <div>        ├─ <span className="text-status-ok">📄 {modName || '<ModName>'}.csproj</span> {selectedDepRefs.length > 0 && (<span className="text-brand-bright">// 含 {selectedDepRefs.length} 个 sibling Reference</span>)}</div>
              <div>        └─ <span className="text-status-ok">📄 {modName || '<ModName>'}.sln</span></div>
            </div>
          </section>

          {submitErrors.length > 0 && (
            <section className="bg-status-danger/10 border border-status-danger/50 rounded-xl p-4">
              <div className="text-2xs font-bold text-status-danger mb-2">⚠ 创建失败:</div>
              {submitErrors.map((e, i) => (
                <div key={i} className="text-3xs font-mono text-fg-base">
                  · {e}
                </div>
              ))}
            </section>
          )}
        </div>

        {/* Footer */}
        <footer className="px-7 py-5 border-t border-border-subtle flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={openInIde}
              onChange={(e) => setOpenInIde(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-2xs text-fg-muteBright">创建后立即在 IDE 打开 src/</span>
          </label>
          <div className="ml-auto flex items-center gap-3">
            <button onClick={onClose} className="btn-ghost h-10 px-5 rounded-lg text-sm">
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="btn-primary h-10 px-6 rounded-lg text-sm font-extrabold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? '创建中…' : `✨ 创建 Mod${selectedDepRefs.length > 0 ? ` (含 ${selectedDepRefs.length} 依赖)` : ''}`}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-3xs font-bold tracking-widest text-brand-base">{children}</div>
}

function InputBlock({
  hint,
  value,
  onChange,
  placeholder,
  error,
  mono,
  focusGlow
}: {
  hint: string
  value: string
  onChange(v: string): void
  placeholder: string
  error?: string | null
  mono?: boolean
  focusGlow?: boolean
}) {
  return (
    <div>
      <div className="text-3xs text-fg-muteBright mb-1.5">{hint}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full h-10 px-3 bg-bg-input border rounded-lg text-sm focus:outline-none ${
          error ? 'border-status-danger' : focusGlow ? 'border-brand-base brand-glow' : 'border-border-frame focus:border-brand-base'
        } ${mono ? 'font-mono' : ''}`}
      />
      {error && <div className="text-3xs text-status-danger mt-1">{error}</div>}
    </div>
  )
}
