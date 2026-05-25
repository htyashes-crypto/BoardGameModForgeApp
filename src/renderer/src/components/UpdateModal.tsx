import { useUpdateStore, normalizeReleaseNotes } from '../store/updateStore'

/**
 * 自动更新弹窗。根据 updateStore.state 渲染 available / downloading / downloaded / error。
 * 风格:ModForge 黑+橙金,与 SettingsModal 一致。
 */
export function UpdateModal() {
  const state = useUpdateStore((s) => s.state)
  const info = useUpdateStore((s) => s.info)
  const progress = useUpdateStore((s) => s.progress)
  const errorMessage = useUpdateStore((s) => s.errorMessage)
  const download = useUpdateStore((s) => s.download)
  const install = useUpdateStore((s) => s.install)
  const dismiss = useUpdateStore((s) => s.dismiss)
  const checkNow = useUpdateStore((s) => s.checkNow)

  if (state === 'idle' || state === 'checking' || state === 'dismissed') return null

  const version = info?.version ?? '?'
  const notes = normalizeReleaseNotes(info?.releaseNotes ?? null)
  const releaseDate = info?.releaseDate ? new Date(info.releaseDate).toLocaleDateString('zh-CN') : ''

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 grid place-items-center">
      <div className="w-[640px] max-h-[80vh] bg-panel-gradient border border-border-frame rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <header className="px-6 py-4 border-b border-border-subtle flex items-center gap-3">
          <span className="text-2xl">{state === 'error' ? '⚠' : '🚀'}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold tracking-wide">
              {state === 'available' && '检测到新版本'}
              {state === 'downloading' && '正在下载更新…'}
              {state === 'downloaded' && '更新已下载完成'}
              {state === 'error' && '更新检查失败'}
            </div>
            {state !== 'error' && (
              <div className="text-2xs font-mono text-fg-muteBright mt-1">
                v{version}
                {releaseDate ? ` · ${releaseDate}` : ''}
              </div>
            )}
          </div>
          <button onClick={dismiss} className="w-7 h-7 bg-bg-input border border-border-frame rounded text-fg-mute hover:text-fg-base">
            ✕
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {state === 'available' && (
            <>
              <div className="text-2xs text-fg-muteBright mb-2">本次更新内容:</div>
              <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words font-ui bg-bg-input rounded-lg p-3 border border-border-frame">
                {notes || '(GitHub Release 未提供更新说明)'}
              </pre>
            </>
          )}

          {state === 'downloading' && progress && (
            <div className="space-y-3">
              <div className="text-2xs text-fg-muteBright">正在从 GitHub 下载新版本,请稍候…</div>
              <div className="h-3 bg-bg-input rounded overflow-hidden">
                <div
                  className="h-full bg-brand-gradient transition-all duration-200"
                  style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }}
                />
              </div>
              <div className="flex justify-between text-3xs text-fg-muteBright font-mono">
                <span>{progress.percent.toFixed(1)}%</span>
                <span>
                  {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
                </span>
                <span>{formatBytes(progress.bytesPerSecond)}/s</span>
              </div>
            </div>
          )}

          {state === 'downloaded' && (
            <div className="space-y-3">
              <div className="text-sm text-fg-base">
                v{version} 已下载完成。点「立即重启」完成安装。
              </div>
              <div className="text-2xs text-fg-muteBright">
                也可选「稍后」,应用退出时自动安装。
              </div>
              {notes && (
                <details className="mt-3">
                  <summary className="text-2xs text-fg-muteBright cursor-pointer hover:text-fg-base">
                    查看更新内容
                  </summary>
                  <pre className="mt-2 text-xs leading-relaxed whitespace-pre-wrap break-words font-ui bg-bg-input rounded-lg p-3 border border-border-frame max-h-48 overflow-y-auto">
                    {notes}
                  </pre>
                </details>
              )}
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-3">
              <div className="text-status-danger text-xs font-mono whitespace-pre-wrap break-words">
                {errorMessage || '(无错误详情)'}
              </div>
              <div className="text-2xs text-fg-muteBright">
                常见原因:网络不通 / GitHub API 限流 / Release 还没发布 / 本地已是最新。
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 py-4 border-t border-border-subtle flex items-center gap-2">
          <div className="flex-1 text-3xs text-fg-muteBright">
            {state === 'available' && '更新会从 GitHub Releases 拉取,需要网络'}
            {state === 'downloading' && (progress && progress.percent > 99 ? '即将完成…' : '下载完成后会提示重启')}
            {state === 'downloaded' && '安装会关闭当前应用'}
          </div>

          {state === 'available' && (
            <>
              <button onClick={dismiss} className="btn-ghost h-8 px-3 rounded text-2xs">稍后</button>
              <button onClick={download} className="btn-primary h-8 px-4 rounded text-2xs font-bold">立即更新</button>
            </>
          )}

          {state === 'downloading' && (
            <button onClick={dismiss} className="btn-ghost h-8 px-3 rounded text-2xs">后台下载</button>
          )}

          {state === 'downloaded' && (
            <>
              <button onClick={dismiss} className="btn-ghost h-8 px-3 rounded text-2xs">稍后</button>
              <button onClick={install} className="btn-primary h-8 px-4 rounded text-2xs font-bold">立即重启安装</button>
            </>
          )}

          {state === 'error' && (
            <>
              <button onClick={dismiss} className="btn-ghost h-8 px-3 rounded text-2xs">关闭</button>
              <button onClick={() => checkNow(true)} className="btn-primary h-8 px-4 rounded text-2xs font-bold">重试</button>
            </>
          )}
        </footer>
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
