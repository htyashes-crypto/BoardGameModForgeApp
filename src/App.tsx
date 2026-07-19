import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import WindowControls from "./components/WindowControls";

interface AppInfo {
  name: string;
  version: string;
  argv: string[];
}

/** 壳阶段 App:标题栏(拖拽 + 窗控)+ get_app_info 联通展示。主区由 plan-4 重建为 Hub/Workspace。 */
export default function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    invoke<AppInfo>("get_app_info").then(setInfo).catch(() => {});
  }, []);

  return (
    <div className="flex h-full flex-col bg-[var(--bg)]">
      <div
        data-tauri-drag-region
        className="flex h-10 shrink-0 items-center border-b border-[var(--border)] bg-[var(--surface)]"
      >
        <div data-tauri-drag-region className="flex flex-1 items-center gap-2 pl-3.5">
          <AnvilMark />
          <span className="pointer-events-none text-[13px] font-semibold text-[var(--text-2)]">ModForge</span>
        </div>
        <WindowControls />
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-8 py-6 text-center">
          <div className="text-lg font-bold text-[var(--text)]">
            {info ? `${info.name} v${info.version}` : "加载中…"}
          </div>
          <div className="mt-2 text-[12px] text-[var(--text-3)]">Tauri 2 脚手架就绪</div>
          {info && info.argv.length > 0 && (
            <div className="mt-2 text-[11px] text-[var(--text-faint)]" style={{ fontFamily: "var(--mono-font)" }}>
              argv: {info.argv.join(" ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 标题栏 20px 小铁砧(与应用图标 A 同母题,陶土底 + 奶油剪影)。 */
function AnvilMark() {
  return (
    <svg className="pointer-events-none h-5 w-5" viewBox="0 0 20 20">
      <rect width="20" height="20" rx="6" fill="var(--accent)" />
      <path d="M3.5 7.5 L6 6.6 L6 9.4 C5 9.3 4.3 9 3.5 8.7 Z" fill="#ece8e1" />
      <rect x="5.6" y="6.2" width="10.5" height="3.4" rx="1" fill="#ece8e1" />
      <rect x="8.7" y="9.6" width="3.6" height="2" fill="#ece8e1" />
      <path d="M7.6 11.6 L13.4 11.6 L14.8 13.6 L6.2 13.6 Z" fill="#ece8e1" />
    </svg>
  );
}
