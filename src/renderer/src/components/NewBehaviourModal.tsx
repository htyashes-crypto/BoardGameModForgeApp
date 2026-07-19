import { useEffect, useMemo, useState } from 'react'
import type { BehaviourTemplateKind, CreateBehaviourInput, ModInfo } from '../types/api'

const CLASS_NAME_PATTERN = /^[A-Z][A-Za-z0-9_]*$/

interface NewBehaviourModalProps {
  projectPath: string
  /** 目标 Mod(当前选中)。 */
  mod: ModInfo
  onClose(): void
  /** 创建成功:返 .cs 文件绝对路径 + 是否需要在 IDE 打开。 */
  onCreated(filePath: string, openInIde: boolean): void
}

const TEMPLATES: { kind: BehaviourTemplateKind; emoji: string; title: string; desc: string[] }[] = [
  { kind: 'empty', emoji: '📄', title: 'Empty', desc: ['空 Behaviour 骨架', '仅 OnInitialize', '最干净起点'] },
  { kind: 'tick', emoji: '⏱', title: 'Tick', desc: ['重写 OnUpdate', '周期任务调度', 'Bg*Ops 周期调用'] },
  { kind: 'subscribe', emoji: '📡', title: 'Subscribe', desc: ['订阅 OnClickEntity', '/ OnDragStart 等', '桌游事件处理'] },
  { kind: 'chain', emoji: '🔗', title: 'Chain', desc: ['调 BgEntityOps', '+ 派 GlobalEvent', '蓝图 ↔ Mod 链'] }
]

/**
 * 在已选中 Mod 内新建 Behaviour 类的弹窗。对应 mockup `.claude/svg/modforge-modal-new-behaviour.svg`。
 */
export function NewBehaviourModal({ projectPath, mod, onClose, onCreated }: NewBehaviourModalProps) {
  const [classRoot, setClassRoot] = useState('')
  const [behaviourId, setBehaviourId] = useState('')
  const [behaviourIdEdited, setBehaviourIdEdited] = useState(false)
  const [template, setTemplate] = useState<BehaviourTemplateKind>('empty')
  const [openInIde, setOpenInIde] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitErrors, setSubmitErrors] = useState<string[]>([])

  const prefix = mod.manifest?.behaviourIdPrefix ?? deriveBehaviourIdPrefix(mod.manifest?.id ?? mod.modDir)

  const fullClassName = classRoot ? `${classRoot}Behaviour` : ''

  // 默认 behaviour Id = <prefix>.<classRoot>
  useEffect(() => {
    if (!behaviourIdEdited && classRoot) {
      setBehaviourId(`${prefix}.${classRoot}`)
    } else if (!behaviourIdEdited && !classRoot) {
      setBehaviourId('')
    }
  }, [classRoot, prefix, behaviourIdEdited])

  // ESC 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const existingClassNames = useMemo(() => new Set(mod.behaviours.map((b) => b.className)), [mod.behaviours])
  const existingIds = useMemo(
    () => new Set(mod.behaviours.map((b) => b.behaviourId).filter((id): id is string => !!id)),
    [mod.behaviours]
  )

  const classError = useMemo(() => {
    if (!fullClassName) return null
    if (!CLASS_NAME_PATTERN.test(fullClassName)) return `要求 ^[A-Z][A-Za-z0-9_]*$`
    if (existingClassNames.has(fullClassName)) return `Mod 内已存在同名类`
    return null
  }, [fullClassName, existingClassNames])

  const idError = useMemo(() => {
    if (!behaviourId) return null
    if (existingIds.has(behaviourId)) return `已被同 Mod 内 Behaviour 占用`
    return null
  }, [behaviourId, existingIds])

  const canSubmit =
    classRoot.length > 0 && !classError && behaviourId.length > 0 && !idError && !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitErrors([])
    const input: CreateBehaviourInput = {
      projectPath,
      modDir: mod.modDir,
      className: fullClassName,
      behaviourId,
      template
    }
    try {
      const result = await window.api.behaviour.create(input)
      if (result.success) {
        onCreated(result.filePath, openInIde)
      } else {
        setSubmitErrors(result.errors)
        setSubmitting(false)
      }
    } catch (err) {
      setSubmitErrors([(err as Error).message])
      setSubmitting(false)
    }
  }

  if (!mod.manifest) return null

  return (
    <div className="fixed inset-0 z-50 bg-overlay/70 grid place-items-center" onClick={onClose}>
      <div
        className="w-[840px] max-h-[92vh] bg-panel-gradient border border-border-frame rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-7 pt-7 pb-5 flex items-start gap-4 border-b border-border-subtle">
          <div className="w-4 h-4 bg-brand-gradient rotate-45 rounded-sm mt-2 shrink-0" />
          <div className="flex-1">
            <h2 className="text-2xl font-extrabold tracking-wide">在 Mod 内新建 Behaviour</h2>
            <p className="text-2xs text-fg-muteBright mt-1.5">
              在 <span className="font-bold text-brand-base">{mod.manifest.name}</span> 的 src/ 下生成一个 [ModObjectBehaviour] 标记的 .cs 类
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
          {/* Owning Mod */}
          <section>
            <FieldLabel>▸ 所属 MOD</FieldLabel>
            <div className="mt-3 bg-bg-input border border-border-frame rounded-lg px-3 py-2.5 flex items-center gap-3">
              <div className="w-7 h-7 bg-bg-input border-[1.5px] border-brand-base rounded-md grid place-items-center text-xs font-bold text-brand-base">
                M
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold">{mod.manifest.name}</div>
                <div className="text-3xs font-mono text-fg-muteBright truncate">
                  {mod.modDirPath}
                </div>
              </div>
              <span className="px-2 h-5 inline-flex items-center text-3xs font-bold text-brand-bright bg-brand-base/15 rounded-full">
                现有 {mod.behaviours.length} 类
              </span>
            </div>
          </section>

          {/* Class name + Behaviour Id */}
          <section>
            <FieldLabel>▸ 类名 + BEHAVIOUR ID</FieldLabel>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-3xs text-fg-muteBright mb-1.5">
                  类名 (自动加 <span className="font-mono">Behaviour</span> 后缀)
                </div>
                <div className={`flex h-10 bg-bg-input border rounded-lg overflow-hidden ${classError ? 'border-status-danger' : 'border-brand-base brand-glow'}`}>
                  <input
                    value={classRoot}
                    onChange={(e) => setClassRoot(e.target.value)}
                    placeholder="TickCounter"
                    className="flex-1 px-3 bg-transparent text-sm font-mono focus:outline-none"
                  />
                  <span className="self-center pr-3 text-sm font-mono text-fg-muteDim">Behaviour</span>
                </div>
                {classError ? (
                  <div className="text-3xs text-status-danger mt-1">{classError}</div>
                ) : fullClassName ? (
                  <div className="text-3xs text-status-ok mt-1">
                    ✓ 文件:<span className="font-mono text-fg-mute">src/{fullClassName}.cs</span>
                  </div>
                ) : null}
              </div>
              <div>
                <div className="text-3xs text-fg-muteBright mb-1.5">Behaviour Id (自动派生)</div>
                <input
                  value={behaviourId}
                  onChange={(e) => {
                    setBehaviourId(e.target.value)
                    setBehaviourIdEdited(true)
                  }}
                  placeholder={`${prefix}.<ClassName>`}
                  className={`w-full h-10 px-3 bg-bg-input border rounded-lg text-sm font-mono focus:outline-none ${
                    idError ? 'border-status-danger' : 'border-border-frame focus:border-brand-base'
                  }`}
                />
                {idError ? (
                  <div className="text-3xs text-status-danger mt-1">{idError}</div>
                ) : (
                  <div className="text-3xs text-fg-muteBright mt-1">用作 [ModObjectBehaviour(Id=…)] 全局唯一 Id</div>
                )}
              </div>
            </div>
          </section>

          {/* Template selection */}
          <section>
            <FieldLabel>▸ 起始模板</FieldLabel>
            <div className="mt-3 grid grid-cols-4 gap-3">
              {TEMPLATES.map((t) => {
                const selected = template === t.kind
                return (
                  <button
                    key={t.kind}
                    onClick={() => setTemplate(t.kind)}
                    className={`relative p-4 rounded-xl text-left transition-[filter] duration-100 ${
                      selected ? 'card-selected' : 'card hover:brightness-110'
                    }`}
                  >
                    {selected && (
                      <span className="absolute top-3 right-3 w-3 h-3 rounded-full bg-brand-base ring-2 ring-bg-base" />
                    )}
                    <div className="text-2xl">{t.emoji}</div>
                    <div className={`mt-3 text-sm font-bold tracking-wide ${selected ? 'text-brand-base' : ''}`}>
                      {t.title}
                    </div>
                    {t.desc.map((d, i) => (
                      <div key={i} className="text-3xs text-fg-muteBright mt-0.5">
                        {d}
                      </div>
                    ))}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Preview */}
          <section>
            <FieldLabel>▸ 将生成的文件</FieldLabel>
            <div className="mt-3 bg-bg-deepest border border-border-frame rounded-xl p-4 font-mono text-2xs leading-relaxed">
              <div className="text-status-ok">
                ＋ ModBehaviourProject/{mod.modDir}/src/{fullClassName || '<ClassName>'}.cs{' '}
                <span className="text-fg-muteBright">({TEMPLATES.find((t) => t.kind === template)?.title} 模板)</span>
              </div>
              <div className="text-fg-muteBright mt-1">
                // {mod.modDir}.csproj 自动扫 src/ 收录,无需手改 csproj
              </div>
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
            <span className="text-2xs text-fg-muteBright">创建后立即在 IDE 跳转到该文件</span>
          </label>
          <div className="ml-auto flex items-center gap-3">
            <button onClick={onClose} className="btn-ghost h-10 px-5 rounded-lg text-sm">
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="btn-primary h-10 px-6 rounded-lg text-sm font-extrabold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '创建中…' : '⚒  创建 Behaviour'}
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

function deriveBehaviourIdPrefix(modId: string): string {
  const parts = modId.split('.')
  const last = parts[parts.length - 1] ?? modId
  return last.toLowerCase().replace(/[^a-z0-9]/g, '')
}
