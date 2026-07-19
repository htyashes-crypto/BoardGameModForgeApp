import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import WindowControls from "./components/WindowControls";
import UpdateModal from "./components/UpdateModal";
import HubView, { AnvilGlyph } from "./views/HubView";
import WorkspaceView from "./views/WorkspaceView";
import { hydrateProject, useProjectStore } from "./stores/projectStore";
import { useModStore, getSelectedMod } from "./stores/modStore";
import { initBuildSubscriptions } from "./stores/buildStore";
import { checkOnStartup } from "./stores/updateStore";

interface AppInfo {
  name: string;
  version: string;
  argv: string[];
}

/** 根路由:未绑定 → Hub,已绑定 → Workspace;标题栏(拖拽 + 面包屑 + 窗控)全局唯一。 */
export default function App() {
  const project = useProjectStore();
  const modState = useModStore();
  const [version, setVersion] = useState("");

  useEffect(() => {
    let unBuild: (() => void) | undefined;
    void invoke<AppInfo>("get_app_info").then((info) => setVersion(info.version));
    void hydrateProject();
    void initBuildSubscriptions().then((u) => {
      unBuild = u;
    });
    checkOnStartup();
    return () => unBuild?.();
  }, []);

  const selected = getSelectedMod(modState);

  return (
    <div className="flex h-full flex-col bg-[var(--bg)]">
      <div
        data-tauri-drag-region
        className="flex h-10 shrink-0 items-center border-b border-[var(--border)] bg-[var(--surface)]"
      >
        <div data-tauri-drag-region className="flex min-w-0 flex-1 items-center gap-2 pl-3.5">
          <span className="pointer-events-none flex h-5 w-5 items-center justify-center rounded-md bg-[var(--accent)]">
            <AnvilGlyph className="h-3.5 w-3.5" />
          </span>
          <span className="pointer-events-none text-[13px] font-semibold text-[var(--text-2)]">ModForge</span>
          {project.bound && (
            <span className="pointer-events-none truncate text-[12px] text-[var(--text-faint)]">
              ·&nbsp;&nbsp;{project.bound.name}
              {selected?.manifest ? `  ›  ${selected.manifest.name}` : ""}
            </span>
          )}
        </div>
        <WindowControls />
      </div>

      {project.bound ? <WorkspaceView appVersion={version} /> : <HubView />}
      <UpdateModal />
    </div>
  );
}
