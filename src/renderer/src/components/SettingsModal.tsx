import { useEffect, useState } from 'react'
import { useIdeStore } from '../store/ideStore'
import { useUpdateStore } from '../store/updateStore'
import { useDevEnvStore } from '../store/devEnvStore'
import { useThemeStore, type ThemeMode } from '../store/themeStore'

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
    <div className="fixed inset-0 z-50 bg-overlay/70 grid place-items-center" onClick={onClose}>
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

        <div className="flex-1 overflow-y-auto px-7 py-5 space-y-6">
          {/* 外观 / 主题 — dark/light 双主题切换(themeStore + localStorage,即时生效) */}
          <section>
            <div className="flex items-center mb-3">
              <span className="block w-1 h-3.5 bg-brand-base" />
              <span className="ml-3 text-xs font-bold tracking-widest">外观</span>
            </div>
            <div className="text-2xs text-fg-muteBright mb-3">切换 ModForge 明暗主题,选择即时生效并记住。</div>
            <div className="grid grid-cols-2 gap-3">
              <ThemeOption mode="dark" icon="🌙" label="黑夜" desc="深色背景 + 橙金(默认)" />
              <ThemeOption mode="light" icon="☀" label="白天" desc="浅色背景 + 橙金" />
            </div>
          </section>

          {/* Mod 开发环境(ModSDK)路径 — 主题群「Mod 开发环境作为独立引擎」Phase 5 真机补完 */}
          <ModDevEnvSection />

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

          {/* 自动更新 */}
          <section>
            <div className="flex items-center mb-3">
              <span className="block w-1 h-3.5 bg-brand-base" />
              <span className="ml-3 text-xs font-bold tracking-widest">自动更新</span>
            </div>
            <div className="card p-4 text-2xs text-fg-mute space-y-3">
              <div>
                ModForge 从 GitHub Releases 自动拉取更新。dev 模式下检查不工作(只在打包安装版生效)。
              </div>
              <CheckUpdateButton />
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
                Electron + React + Tailwind · 阶段 2-3 完工 2026-05-25
              </div>
              <div className="font-mono text-3xs text-fg-muteBright">
                <a
                  href="https://github.com/htyashes-crypto/BoardGameModForgeApp"
                  className="text-fg-accentInfo hover:underline"
                  onClick={(e) => {
                    e.preventDefault()
                    // 外部链接走 shell.openExternal(主进程已暴露);此处先用默认行为
                    window.open('https://github.com/htyashes-crypto/BoardGameModForgeApp', '_blank')
                  }}
                >
                  htyashes-crypto/BoardGameModForgeApp
                </a>
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

/**
 * Mod 开发环境(ModSDK)路径配置 Section。
 *
 * 三种状态:
 * - 未配置:显示「浏览本机目录」+「从 GitHub 下载」二选一引导
 * - 已配置但校验失败:显示错误 + 「重选」+「重下」
 * - 已配置 + 校验通过:显示路径 + sdkVersion + 「重选」+「重新下载更新」+「清除」
 */
function ModDevEnvSection() {
  const modSdkPath = useDevEnvStore((s) => s.modSdkPath)
  const validation = useDevEnvStore((s) => s.validation)
  const downloadPhase = useDevEnvStore((s) => s.downloadPhase)
  const downloadLog = useDevEnvStore((s) => s.downloadLog)
  const downloadMessage = useDevEnvStore((s) => s.downloadMessage)
  const hydrate = useDevEnvStore((s) => s.hydrateFromMain)
  const browseAndSet = useDevEnvStore((s) => s.browseAndSetModSdkPath)
  const downloadToBrowsedDir = useDevEnvStore((s) => s.downloadToBrowsedDir)
  const unset = useDevEnvStore((s) => s.unset)
  const subscribeToDownloadLog = useDevEnvStore((s) => s.subscribeToDownloadLog)

  useEffect(() => {
    hydrate()
    const unsubscribe = subscribeToDownloadLog()
    return unsubscribe
  }, [hydrate, subscribeToDownloadLog])

  const isConfigured = !!modSdkPath
  const isValid = validation?.ok ?? false
  const isDownloading = downloadPhase === 'downloading'

  const onBrowse = async (): Promise<void> => {
    await browseAndSet()
  }

  const onDownload = async (): Promise<void> => {
    await downloadToBrowsedDir()
  }

  const onUnset = async (): Promise<void> => {
    if (window.confirm('确认清除 Mod 开发环境路径配置?\n后续新建 Mod 时 csproj 会走 fallback 路径 + Warning。')) {
      await unset()
    }
  }

  const onOpenGitHub = async (): Promise<void> => {
    await window.api.devEnv.openGitHubUrl()
  }

  return (
    <section>
      <div className="flex items-center mb-3">
        <span className="block w-1 h-3.5 bg-brand-base rounded-sm" />
        <span className="ml-3 text-xs font-bold tracking-widest">MOD 开发环境(ModSDK)</span>
      </div>

      <div className="text-2xs text-fg-muteBright mb-3 leading-relaxed">
        Mod SDK 路径配好后,新建 Mod 时 csproj 内 <code className="bg-bg-input px-1 rounded text-fg-base">&lt;ModSdkRoot&gt;</code> 自动硬写为该绝对路径,Mod 工程可独立 build(无 Unity)。{' '}
        <button
          onClick={onOpenGitHub}
          className="text-brand-base hover:text-brand-bright underline underline-offset-2 transition-soft duration-150"
        >
          BoardGameModSDK GitHub
        </button>
      </div>

      {/* 状态显示 */}
      {!isConfigured && (
        <div className="bg-bg-input border border-border-frame rounded-xl p-4 text-2xs text-fg-base mb-3">
          <div className="text-fg-mute">⚠ 未配置 — 新建 Mod 后 csproj 走 fallback 路径(本工程 Library/ScriptAssemblies/)+ MSBuild Warning。</div>
          <div className="mt-2 text-3xs text-fg-muteBright">两种配置方式:</div>
          <ol className="mt-1 ml-4 list-decimal text-3xs text-fg-muteBright space-y-0.5">
            <li>本机已有 BoardGameModSDK 目录 → 点 [浏览选目录]</li>
            <li>本机没有 → 点 [从 GitHub 下载] 一键 clone</li>
          </ol>
        </div>
      )}

      {isConfigured && validation && (
        <div
          className={`rounded-xl p-4 text-2xs mb-3 border ${
            isValid
              ? 'bg-status-ok/10 border-status-ok/40 text-fg-base'
              : 'bg-status-danger/10 border-status-danger/40 text-fg-base'
          }`}
        >
          <div className="flex items-start gap-2">
            <span className="mt-0.5">{isValid ? '✓' : '⚠'}</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold">
                {isValid ? `已配置(${validation.sdkVersion ? `v${validation.sdkVersion}` : '未知版本'})` : `校验失败:${validation.code}`}
              </div>
              <div className="text-3xs font-mono text-fg-muteBright break-all mt-1">{modSdkPath}</div>
              {!isValid && (
                <div className="text-3xs text-fg-mute mt-1">{validation.message}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onBrowse}
          disabled={isDownloading}
          className="h-9 px-4 bg-bg-input border border-border-frame hover:border-brand-base hover:bg-bg-card rounded-lg text-2xs transition-soft duration-150 disabled:opacity-50"
        >
          📂 浏览选目录
        </button>
        <button
          onClick={onDownload}
          disabled={isDownloading}
          className="h-9 px-4 bg-brand-base hover:bg-brand-bright text-bg-base font-bold rounded-lg text-2xs transition-soft duration-150 disabled:opacity-50"
        >
          {isDownloading ? '⏳ 下载中…' : '⬇ 从 GitHub 下载'}
        </button>
        {isConfigured && (
          <button
            onClick={onUnset}
            disabled={isDownloading}
            className="ml-auto text-2xs text-fg-muteBright hover:text-status-danger transition-soft duration-150"
          >
            清除配置
          </button>
        )}
      </div>

      {/* 下载日志输出 */}
      {(downloadPhase !== 'idle' || downloadLog) && (
        <div className="mt-3 bg-bg-input border border-border-subtle rounded-lg overflow-hidden">
          {downloadMessage && (
            <div
              className={`px-3 py-2 text-2xs ${
                downloadPhase === 'success'
                  ? 'bg-status-ok/15 text-fg-base'
                  : downloadPhase === 'failed'
                    ? 'bg-status-danger/15 text-fg-base'
                    : 'bg-bg-card text-fg-mute'
              }`}
            >
              {downloadMessage}
            </div>
          )}
          {downloadLog && (
            <pre className="px-3 py-2 max-h-40 overflow-auto text-3xs font-mono text-fg-muteBright whitespace-pre-wrap">
              {downloadLog}
            </pre>
          )}
        </div>
      )}
    </section>
  )
}

function CheckUpdateButton() {
  const state = useUpdateStore((s) => s.state)
  const checkNow = useUpdateStore((s) => s.checkNow)
  return (
    <button
      onClick={() => checkNow(true)}
      disabled={state === 'checking' || state === 'downloading'}
      className="btn-ghost h-8 px-3 rounded text-2xs disabled:opacity-50"
    >
      {state === 'checking' ? '🔄 检查中…' : state === 'downloading' ? '⬇ 下载中…' : '🔄 检查更新'}
    </button>
  )
}

/** 单个主题选项卡片(黑夜 / 白天),点击即调 themeStore.setTheme。 */
function ThemeOption({ mode, icon, label, desc }: { mode: ThemeMode; icon: string; label: string; desc: string }) {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const selected = theme === mode
  return (
    <button
      onClick={() => setTheme(mode)}
      className={`flex items-center gap-3 p-3 rounded-xl text-left transition-soft duration-150 ${
        selected ? 'card-selected' : 'card hover:brightness-110'
      }`}
    >
      <span className="text-2xl shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{label}</span>
          {selected && (
            <span className="px-1.5 h-4 inline-flex items-center text-3xs font-bold text-brand-bright bg-brand-base/15 rounded">
              当前
            </span>
          )}
        </div>
        <div className="text-3xs text-fg-muteBright mt-0.5">{desc}</div>
      </div>
    </button>
  )
}
