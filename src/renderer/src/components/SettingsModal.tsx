import { useEffect, useState } from 'react'
import { useIdeStore } from '../store/ideStore'

interface SettingsModalProps {
  onClose(): void
}

/**
 * 设置弹窗 v1:暂时只含 IDE 偏好配置(后续可加 Mod 工程根 / 自动更新等)。
 * 自动检测列表 + 手动浏览 .exe 兜底,解决"未检测到 Cursor"的场景。
 */
export function SettingsModal({ onClose }: SettingsModalProps) {
  const detected = useIdeStore((s) => s.detected)
  const preferredPath = useIdeStore((s) => s.preferredPath)
  const setPreferred = useIdeStore((s) => s.setPreferred)
  const browseManualAndSet = useIdeStore((s) => s.browseManualAndSet)
  const detect = useIdeStore((s) => s.detect)
  const loading = useIdeStore((s) => s.loading)
  const resolveActiveIde = useIdeStore((s) => s.resolveActiveIde)

  const [redetecting, setRedetecting] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleRedetect() {
    setRedetecting(true)
    await detect()
    setRedetecting(false)
  }

  const active = resolveActiveIde()
  // 手动选过但不在自动检测列表里的 IDE,作 Custom 显示
  const showCustom = preferredPath && !detected.some((d) => d.path === preferredPath)

  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center" onClick={onClose}>
      <div
        className="w-[720px] max-h-[90vh] bg-panel-gradient border border-border-frame rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-7 pt-7 pb-5 flex items-start gap-4 border-b border-border-subtle">
          <div className="w-4 h-4 bg-brand-gradient rotate-45 rounded-sm mt-2 shrink-0" />
          <div className="flex-1">
            <h2 className="text-2xl font-extrabold tracking-wide">设置</h2>
            <p className="text-2xs text-fg-muteBright mt-1.5">ModForge 全局配置</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-bg-input border border-border-frame rounded-lg grid place-items-center text-fg-mute hover:text-fg-base"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">
          {/* IDE 偏好 */}
          <section>
            <div className="flex items-center mb-3">
              <span className="block w-1 h-3.5 bg-brand-base" />
              <span className="ml-3 text-xs font-bold tracking-widest">IDE 偏好</span>
              <button
                onClick={handleRedetect}
                disabled={redetecting || loading}
                className="ml-auto px-3 h-7 rounded-lg text-2xs btn-ghost disabled:opacity-50"
              >
                {redetecting ? '检测中…' : '🔄 重新检测'}
              </button>
            </div>

            <div className="text-2xs text-fg-muteBright mb-3">
              ModForge 用此 IDE 打开 Mod 工程的 src/。点击"⚡ 在 X 中打开"按钮时,以下列偏好为准。
            </div>

            {detected.length === 0 && !showCustom && (
              <div className="bg-status-warn/10 border border-status-warn/40 rounded-xl p-4 text-2xs text-fg-base">
                ⚠ 未自动检测到任何 IDE。请用下方「📂 浏览 .exe」手动指定。
                <div className="mt-2 text-3xs text-fg-muteBright">
                  自动扫描路径:Cursor / Rider(独立 + Toolbox)/ VS / VSCode 的标准安装位置。
                  若 Cursor 装在非默认目录(如 D 盘),自动检测会失败。
                </div>
              </div>
            )}

            <div className="space-y-2">
              {detected.map((ide) => {
                const selected = preferredPath === ide.path || (!preferredPath && active?.path === ide.path)
                return (
                  <label
                    key={ide.path}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer ${
                      selected ? 'card-selected' : 'card hover:brightness-110'
                    }`}
                  >
                    <input
                      type="radio"
                      name="ide-pref"
                      checked={selected}
                      onChange={() => setPreferred(ide.path)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{ide.name}</span>
                        {!preferredPath && active?.path === ide.path && (
                          <span className="px-1.5 h-4 inline-flex items-center text-3xs font-bold text-brand-bright bg-brand-base/15 rounded">
                            自动选中(优先级最高)
                          </span>
                        )}
                      </div>
                      <div className="text-3xs font-mono text-fg-muteBright truncate mt-0.5">
                        {ide.path}
                      </div>
                    </div>
                  </label>
                )
              })}

              {showCustom && preferredPath && (
                <label className="flex items-center gap-3 p-3 rounded-xl card-selected cursor-pointer">
                  <input type="radio" name="ide-pref" checked readOnly className="w-4 h-4" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">Custom</span>
                      <span className="px-1.5 h-4 inline-flex items-center text-3xs font-bold text-brand-bright bg-brand-base/15 rounded">
                        手动指定
                      </span>
                    </div>
                    <div className="text-3xs font-mono text-fg-muteBright truncate mt-0.5">
                      {preferredPath}
                    </div>
                  </div>
                </label>
              )}
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button onClick={browseManualAndSet} className="btn-ghost h-9 px-4 rounded-lg text-sm">
                📂 浏览 .exe(手动指定)
              </button>
              {(preferredPath || detected.length > 0) && (
                <button
                  onClick={() => setPreferred(null)}
                  className="text-2xs text-fg-muteBright hover:text-status-danger"
                >
                  清除偏好(回到自动检测)
                </button>
              )}
            </div>
          </section>

          {/* About */}
          <section>
            <div className="flex items-center mb-3">
              <span className="block w-1 h-3.5 bg-brand-base" />
              <span className="ml-3 text-xs font-bold tracking-widest">关于</span>
            </div>
            <div className="card p-4 text-2xs text-fg-mute space-y-1">
              <div>
                <span className="font-bold text-fg-base">ModForge</span> v0.1.0
              </div>
              <div>BoardGameEditor 桌游工程的 Mod 开发 IDE 环境创建器</div>
              <div className="font-mono text-3xs text-fg-muteBright mt-2">
                Electron + React + Tailwind · 阶段 2 完工 2026-05-25
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="px-7 py-4 border-t border-border-subtle flex items-center justify-end">
          <button onClick={onClose} className="btn-primary h-10 px-6 rounded-lg text-sm font-bold">
            完成
          </button>
        </footer>
      </div>
    </div>
  )
}
