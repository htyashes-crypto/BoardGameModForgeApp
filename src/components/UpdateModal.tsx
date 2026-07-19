import { formatBytes } from "../lib/format";
import {
  checkForUpdate,
  dismissUpdate,
  downloadUpdate,
  installUpdate,
  resetUpdate,
  useUpdateStore,
} from "../stores/updateStore";
import { useMaskDismiss } from "./ui/maskDismiss";

/** 自更新弹窗(七态状态机;idle / checking / dismissed 不渲染)。 */
export default function UpdateModal() {
  const u = useUpdateStore();
  const mask = useMaskDismiss(() => {
    if (u.state === "available" || u.state === "downloaded") dismissUpdate();
    else if (u.state === "error") resetUpdate();
  });

  if (u.state === "idle" || u.state === "checking" || u.state === "dismissed") return null;
  // 静默检查出的错不弹窗(updateStore 已回 idle);能走到这的 error 都是手动触发
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45" {...mask}>
      <div
        className="w-[560px] max-w-[92vw] rounded-2xl border border-[var(--border)] bg-[var(--elevated)] p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {u.state === "available" && (
          <>
            <h3 className="text-[15px] font-bold text-[var(--text)]">发现新版本 v{u.version}</h3>
            {u.body && (
              <pre
                className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-[10px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3 text-[11px] leading-relaxed text-[var(--text-2)]"
                style={{ fontFamily: "var(--app-font)" }}
              >
                {u.body}
              </pre>
            )}
            <div className="mt-5 flex justify-end gap-2.5">
              <button onClick={dismissUpdate} className="btn-ghost h-9">
                稍后
              </button>
              <button onClick={() => void downloadUpdate()} className="btn-primary h-9">
                立即更新
              </button>
            </div>
          </>
        )}

        {u.state === "downloading" && (
          <>
            <h3 className="text-[15px] font-bold text-[var(--text)]">正在下载 v{u.version}…</h3>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-[width]"
                style={{ width: u.total ? `${Math.min(100, (u.downloaded / u.total) * 100)}%` : "40%" }}
              />
            </div>
            <div className="mt-2 text-[11px] text-[var(--text-3)]" style={{ fontFamily: "var(--mono-font)" }}>
              {formatBytes(u.downloaded)}
              {u.total ? ` / ${formatBytes(u.total)} · ${Math.floor((u.downloaded / u.total) * 100)}%` : ""}
            </div>
          </>
        )}

        {u.state === "downloaded" && (
          <>
            <h3 className="text-[15px] font-bold text-[var(--text)]">v{u.version} 已下载完成</h3>
            <p className="mt-2 text-[12px] text-[var(--text-3)]">立即重启安装,或稍后退出应用时自动安装。</p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button onClick={dismissUpdate} className="btn-ghost h-9">
                稍后
              </button>
              <button onClick={() => void installUpdate()} className="btn-primary h-9">
                立即重启安装
              </button>
            </div>
          </>
        )}

        {u.state === "error" && (
          <>
            <h3 className="text-[15px] font-bold text-[var(--danger)]">更新检查失败</h3>
            <pre className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap break-all rounded-[10px] bg-[var(--danger-soft)] px-4 py-3 text-[11px] text-[var(--danger)]">
              {u.errorMessage}
            </pre>
            <p className="mt-2 text-[10px] text-[var(--text-faint)]">常见原因:网络不可达 / GitHub Releases 未发布 latest.json / dev 模式(未打包)不支持更新。</p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button onClick={resetUpdate} className="btn-ghost h-9">
                关闭
              </button>
              <button onClick={() => void checkForUpdate(true)} className="btn-primary h-9">
                重试
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
