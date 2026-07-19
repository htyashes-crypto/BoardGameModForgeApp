import { useEffect, useRef, useState } from "react";
import { CloseSmall, FolderOpen, Refresh } from "@icon-park/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import type { GithubUrls } from "../types";
import {
  browseAndSetModSdkPath,
  clearModSdkPath,
  downloadToBrowsedDir,
  hydrateDevEnv,
  subscribeDownloadLog,
  useDevEnvStore,
} from "../stores/devEnvStore";
import { browseManualIde, detectIdes, setPreferredIde, useIdeStore } from "../stores/ideStore";
import { checkForUpdate, useUpdateStore } from "../stores/updateStore";
import ConfirmModal from "./ui/ConfirmModal";
import { useMaskDismiss } from "./ui/maskDismiss";
import { useEscClose } from "./ui/useEscClose";

/** 设置弹窗(对 settings.svg:ModSDK / IDE 偏好 / 自动更新 / 关于;v2 起仅深色,无主题区)。 */
export default function SettingsModal({ appVersion, onClose }: { appVersion: string; onClose: () => void }) {
  const devEnv = useDevEnvStore();
  const ide = useIdeStore();
  const update = useUpdateStore();
  const [confirmClearSdk, setConfirmClearSdk] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const logRef = useRef<HTMLPreElement>(null);
  const mask = useMaskDismiss(onClose);
  useEscClose(onClose);

  useEffect(() => {
    void hydrateDevEnv();
    void detectIdes();
    let un: (() => void) | undefined;
    void subscribeDownloadLog().then((u) => {
      un = u;
    });
    return () => un?.();
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [devEnv.downloadLog.length]);

  async function openRepo() {
    const urls = await invoke<GithubUrls>("devenv_get_github_urls");
    await openUrl(urls.browseUrl);
  }

  async function onCheckUpdate() {
    setCheckResult(null);
    const r = await checkForUpdate(true);
    setCheckResult(r === "none" ? "已是最新版本" : r === "available" ? `发现新版本 v${update.version ?? ""}` : null);
  }

  const v = devEnv.validation;
  const downloading = devEnv.downloadPhase === "downloading";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45" {...mask}>
      <div
        className="flex max-h-[92vh] w-[800px] max-w-[94vw] flex-col overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--elevated)] p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold text-[var(--text)]">设置</h2>
          <button onClick={onClose} className="btn-ghost h-8 w-8 px-0">
            <CloseSmall theme="outline" size="16" />
          </button>
        </div>

        {/* MOD 开发环境(ModSDK) */}
        <section className="mt-5">
          <div className="text-[11px] font-semibold tracking-[1.5px] text-[var(--text-3)]">MOD 开发环境(MODSDK)</div>
          {devEnv.modSdkPath ? (
            <div
              className="mt-3 rounded-[10px] border px-4 py-3"
              style={
                v?.ok
                  ? { borderColor: "color-mix(in srgb, var(--success) 35%, transparent)", background: "var(--success-soft)" }
                  : { borderColor: "color-mix(in srgb, var(--danger) 40%, transparent)", background: "var(--danger-soft)" }
              }
            >
              <div className="text-[12px]" style={{ color: v?.ok ? "var(--text)" : "var(--danger)" }}>
                {v?.ok ? "✓ " : "✗ "}
                {v?.message}
                {!v?.ok && v?.code ? `(${v.code})` : ""}
              </div>
              <div className="mt-1 text-[10px] text-[var(--text-faint)]" style={{ fontFamily: "var(--mono-font)" }}>
                {devEnv.modSdkPath}
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-[10px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3 text-[12px] text-[var(--text-3)]">
              未配置 — 桌游开发者本机可不配(csproj 自动 fallback 本工程路径);纯 Mod 开发机必须配置或从 GitHub 下载
            </div>
          )}
          <div className="mt-3 flex items-center gap-2.5">
            <button onClick={() => void browseAndSetModSdkPath()} disabled={downloading} className="btn-ghost h-8">
              <FolderOpen theme="outline" size="13" />
              浏览目录…
            </button>
            <button onClick={() => void downloadToBrowsedDir()} disabled={downloading} className="btn-ghost h-8">
              {downloading ? "下载中…" : "从 GitHub 下载"}
            </button>
            {devEnv.modSdkPath && (
              <button onClick={() => setConfirmClearSdk(true)} disabled={downloading} className="btn-ghost h-8 text-[var(--danger)]">
                清除配置
              </button>
            )}
            <button onClick={() => void openRepo()} className="ml-auto text-[10px] text-[var(--accent-text)] hover:underline">
              BoardGameModSDK 仓库 ↗
            </button>
          </div>
          {(devEnv.downloadLog.length > 0 || devEnv.downloadMessage) && (
            <div className="mt-3">
              <pre
                ref={logRef}
                className="max-h-40 overflow-y-auto whitespace-pre-wrap break-all rounded-[10px] border border-[var(--border)] bg-[var(--term-bg)] px-4 py-3 text-[10.5px] leading-relaxed text-[var(--term-fg)]"
                style={{ fontFamily: "var(--mono-font)" }}
              >
                {devEnv.downloadLog.join("\n")}
              </pre>
              {devEnv.downloadMessage && (
                <div
                  className="mt-2 text-[11px]"
                  style={{ color: devEnv.downloadPhase === "error" ? "var(--danger)" : "var(--success)" }}
                >
                  {devEnv.downloadMessage}
                </div>
              )}
            </div>
          )}
        </section>

        <div className="my-6 border-t border-[var(--border-soft)]" />

        {/* IDE 偏好 */}
        <section>
          <div className="text-[11px] font-semibold tracking-[1.5px] text-[var(--text-3)]">IDE 偏好</div>
          {ide.detected.length === 0 && !ide.loading && (
            <div className="mt-3 rounded-[10px] border px-4 py-3 text-[12px] text-[var(--warn)]" style={{ borderColor: "color-mix(in srgb, var(--warn) 35%, transparent)", background: "var(--warn-soft)" }}>
              未检测到 IDE — 点「重新检测」,或「浏览 .exe」手动指定
            </div>
          )}
          <div className="mt-3 flex flex-col gap-2">
            {ide.detected.map((d) => {
              const active = ide.preferredPath
                ? ide.preferredPath.toLowerCase() === d.path.toLowerCase()
                : false;
              return (
                <button
                  key={d.path}
                  onClick={() => void setPreferredIde(d.path)}
                  className={
                    "flex items-center gap-3.5 rounded-[10px] border px-4 py-2.5 text-left transition-colors " +
                    (active
                      ? "border-[var(--accent-border)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] bg-[var(--surface-soft)] hover:bg-[var(--surface-hover)]")
                  }
                >
                  <span
                    className={
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border " +
                      (active ? "border-[var(--accent)]" : "border-[var(--text-faint)]")
                    }
                  >
                    {active && <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-[var(--text)]">{d.name}</div>
                    <div className="truncate text-[9.5px] text-[var(--text-faint)]" style={{ fontFamily: "var(--mono-font)" }}>
                      {d.path}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2.5">
            <button onClick={() => void detectIdes()} disabled={ide.loading} className="btn-ghost h-8">
              <Refresh theme="outline" size="13" />
              {ide.loading ? "检测中…" : "重新检测"}
            </button>
            <button onClick={() => void browseManualIde()} className="btn-ghost h-8">
              浏览 .exe(手动指定)…
            </button>
            {ide.preferredPath && (
              <button onClick={() => void setPreferredIde(null)} className="btn-ghost h-8">
                清除偏好(回到自动检测)
              </button>
            )}
          </div>
        </section>

        <div className="my-6 border-t border-[var(--border-soft)]" />

        {/* 自动更新 */}
        <section className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[11px] font-semibold tracking-[1.5px] text-[var(--text-3)]">自动更新</div>
            <p className="mt-2.5 text-[12px] text-[var(--text-2)]">当前版本 v{appVersion} — 启动时静默检查更新(仅安装版生效)</p>
            <p className="mt-1 text-[10px] text-[var(--text-faint)]">下载完成后可立即重启安装,或退出应用时自动安装</p>
            {checkResult && <p className="mt-1.5 text-[11px] text-[var(--success)]">{checkResult}</p>}
            {update.state === "error" && update.errorMessage && (
              <p className="mt-1.5 break-all text-[10px] text-[var(--danger)]">{update.errorMessage}</p>
            )}
          </div>
          <button onClick={() => void onCheckUpdate()} disabled={update.state === "checking"} className="btn-ghost mt-5 shrink-0">
            {update.state === "checking" ? "检查中…" : "检查更新"}
          </button>
        </section>

        <div className="my-6 border-t border-[var(--border-soft)]" />

        {/* 关于 */}
        <section className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]">
            <svg viewBox="0 0 36 36" className="h-6 w-6">
              <g fill="#ece8e1">
                <path d="M3 15.2 C6 13.4 8.6 12.6 10.6 12.5 L10.6 18.2 C8.9 18.1 6.6 17.4 3 16.6 Z" />
                <rect x="10" y="12" width="21" height="6.6" rx="1.6" />
                <rect x="16" y="18.6" width="7.4" height="4" />
                <path d="M13.4 22.6 L26 22.6 L28.8 27 L10.6 27 Z" />
              </g>
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-[var(--text)]">ModForge · 桌游 Mod 开发 IDE</div>
            <div className="mt-0.5 text-[11px] text-[var(--text-faint)]">Tauri 2 · React 19 · Rust 后端 · 深色主题(v2 起仅深色)</div>
          </div>
          <button
            onClick={() => void openUrl("https://github.com/htyashes-crypto/BoardGameModForgeApp")}
            className="shrink-0 text-[10px] text-[var(--accent-text)] hover:underline"
            style={{ fontFamily: "var(--mono-font)" }}
          >
            github.com/htyashes-crypto/BoardGameModForgeApp ↗
          </button>
        </section>
      </div>
      {confirmClearSdk && (
        <ConfirmModal
          title="清除 ModSDK 配置"
          message="仅清除路径配置,不删除磁盘上的 SDK 文件。"
          confirmText="清除"
          onConfirm={() => void clearModSdkPath()}
          onClose={() => setConfirmClearSdk(false)}
        />
      )}
    </div>
  );
}
