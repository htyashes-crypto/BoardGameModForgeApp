import { useEffect, useState } from "react";
import { FolderOpen, Plus, SettingTwo, Undo } from "@icon-park/react";
import { openPath } from "@tauri-apps/plugin-opener";
import { unbindProject, useProjectStore } from "../stores/projectStore";
import {
  getDependsOn,
  getSelectedMod,
  getUsedBy,
  scanMods,
  selectMod,
  useModStore,
} from "../stores/modStore";
import { startBuild, useBuildStore } from "../stores/buildStore";
import { detectIdes, launchIde, resolveActiveIde, useIdeStore } from "../stores/ideStore";
import { computeReverseDeps, deleteMod } from "../lib/create";
import ModListItem, { effectiveLayer } from "../components/ModListItem";
import ModDetailPane from "../components/ModDetailPane";
import BuildingPane from "../components/BuildingPane";
import NewModModal from "../components/NewModModal";
import NewBehaviourModal from "../components/NewBehaviourModal";
import ModDepsGraphModal from "../components/ModDepsGraphModal";
import SettingsModal from "../components/SettingsModal";
import ConfirmModal from "../components/ui/ConfirmModal";

/** 绑定工程后的核心工作区(对 workspace.svg)。 */
export default function WorkspaceView({ appVersion }: { appVersion: string }) {
  const project = useProjectStore();
  const modState = useModStore();
  const build = useBuildStore();
  const ide = useIdeStore();

  const [showNewMod, setShowNewMod] = useState(false);
  const [showNewBehaviour, setShowNewBehaviour] = useState(false);
  const [showDeps, setShowDeps] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const bound = project.bound!;
  const snapshot = modState.snapshot;
  const selected = getSelectedMod(modState);
  const activeIde = resolveActiveIde(ide);
  const building = build.task?.status === "running";
  const showBuildPane = !!build.task && build.task.rootModId === modState.selectedModId;

  useEffect(() => {
    void scanMods(bound.path);
    void detectIdes();
  }, [bound.path]);

  const behaviourTotal = snapshot?.mods.reduce((n, m) => n + m.behaviours.length, 0) ?? 0;

  async function openInIde(target: string) {
    if (!activeIde) return;
    await launchIde(activeIde.path, target);
  }

  async function doDelete() {
    if (!selected?.manifest) return;
    await deleteMod(bound.path, selected.modDir);
    selectMod(null);
    await scanMods(bound.path);
  }

  async function buildMod(modId: string) {
    selectMod(modId);
    await startBuild(bound.path, modId);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 工具栏 */}
      <div className="flex h-14 shrink-0 items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[14px] font-bold text-[var(--accent-text)]">
          {bound.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="truncate text-[13px] font-semibold text-[var(--text)]">{bound.name}</span>
            <span className="rounded-full bg-[var(--success-soft)] px-2 py-px text-[10px] text-[var(--success)]">已绑定</span>
          </div>
          <div className="text-[10.5px] text-[var(--text-faint)]">
            {snapshot ? `${snapshot.mods.length} Mod · ${behaviourTotal} Behaviour · ${snapshot.hasError ? "⚠ 含错误" : "拓扑序就绪"}` : "扫描中…"}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <button onClick={() => setShowDeps(true)} disabled={!snapshot || snapshot.mods.length === 0} className="btn-ghost h-8">
            依赖图
          </button>
          <button onClick={() => void openPath(bound.path)} className="btn-ghost h-8">
            <FolderOpen theme="outline" size="13" />
            目录
          </button>
          <button onClick={() => setShowSettings(true)} className="btn-ghost h-8">
            <SettingTwo theme="outline" size="13" />
            设置
          </button>
          <button onClick={() => void unbindProject()} className="btn-ghost h-8">
            <Undo theme="outline" size="13" />
            返回
          </button>
        </div>
      </div>

      {/* 主体双栏 */}
      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <aside className="flex w-[280px] shrink-0 flex-col rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-semibold tracking-[1.5px] text-[var(--text-3)]">MOD 列表</span>
            <span className="text-[11px] text-[var(--text-faint)]">{snapshot?.mods.length ?? 0}</span>
          </div>
          <button onClick={() => setShowNewMod(true)} disabled={building || !snapshot} className="btn-primary mt-3 w-full">
            <Plus theme="outline" size="13" />
            新建 Mod
          </button>
          <div className="mt-2.5 text-[10px] text-[var(--text-faint)]">按拓扑加载序排列(基础层 → 应用层)</div>
          <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
            {modState.scanning && !snapshot ? (
              <div className="mt-8 text-center text-[12px] text-[var(--text-3)]">扫描中…</div>
            ) : !snapshot || snapshot.mods.length === 0 ? (
              <div className="mt-8 px-4 text-center text-[12px] leading-relaxed text-[var(--text-3)]">
                工程下尚无 Mod
                <br />
                点击「＋ 新建 Mod」开始
              </div>
            ) : (
              sortedMods(snapshot.mods, snapshot.topologyOrder).map((mod) => (
                <ModListItem
                  key={mod.modDir}
                  mod={mod}
                  layer={effectiveLayer(mod, snapshot.topologyOrder)}
                  selected={!!mod.manifest && mod.manifest.id === modState.selectedModId}
                  onSelect={() => selectMod(mod.manifest?.id ?? null)}
                />
              ))
            )}
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col rounded-[14px] border border-[var(--border)] bg-[var(--surface)]">
          {showBuildPane && build.task ? (
            <BuildingPane task={build.task} logs={build.logs.slice(-500)} />
          ) : modState.scanning && !snapshot ? (
            <Empty text="扫描中…" />
          ) : selected ? (
            <ModDetailPane
              mod={selected}
              layer={effectiveLayer(selected, snapshot!.topologyOrder)}
              ideName={activeIde?.name ?? null}
              topologyOrder={snapshot!.topologyOrder}
              dependsOn={getDependsOn(modState)}
              usedBy={getUsedBy(modState)}
              onOpenInIde={() => void openInIde(selected.modDirPath)}
              onBuild={() => void buildMod(selected.manifest!.id)}
              onDelete={() => setConfirmDelete(true)}
              onNewBehaviour={() => setShowNewBehaviour(true)}
              building={building}
            />
          ) : (
            <Empty text={snapshot && snapshot.mods.length > 0 ? "左侧选择一个 Mod 查看详情" : "工程下无 Mod — 左侧「＋ 新建 Mod」开始"} />
          )}
        </main>
      </div>

      {/* 弹窗挂载 */}
      {showNewMod && snapshot && (
        <NewModModal
          projectPath={bound.path}
          projectName={bound.name}
          snapshot={snapshot}
          onClose={() => setShowNewMod(false)}
          onCreated={(openIde, modDirPath) => {
            setShowNewMod(false);
            void scanMods(bound.path);
            if (openIde) void openInIde(modDirPath);
          }}
        />
      )}
      {showNewBehaviour && snapshot && selected && (
        <NewBehaviourModal
          projectPath={bound.path}
          mod={selected}
          snapshot={snapshot}
          onClose={() => setShowNewBehaviour(false)}
          onCreated={(jump, filePath) => {
            setShowNewBehaviour(false);
            void scanMods(bound.path);
            if (jump) void openInIde(filePath);
          }}
        />
      )}
      {showDeps && snapshot && (
        <ModDepsGraphModal
          snapshot={snapshot}
          currentModId={modState.selectedModId}
          building={building}
          onClose={() => setShowDeps(false)}
          onBuildAll={() => {
            const last = snapshot.topologyOrder[snapshot.topologyOrder.length - 1];
            if (last) {
              setShowDeps(false);
              void buildMod(last);
            }
          }}
        />
      )}
      {showSettings && <SettingsModal appVersion={appVersion} onClose={() => setShowSettings(false)} />}
      {confirmDelete && selected?.manifest && snapshot && (
        <ConfirmModal
          title={`删除 Mod "${selected.manifest.id}"`}
          message={<DeleteMessage modDirPath={selected.modDirPath} reverseDeps={computeReverseDeps(snapshot, selected.manifest.id)} />}
          confirmText="移入回收站"
          onConfirm={() => void doDelete()}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="flex flex-1 items-center justify-center text-[12px] text-[var(--text-3)]">{text}</div>;
}

function DeleteMessage({ modDirPath, reverseDeps }: { modDirPath: string; reverseDeps: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <span style={{ fontFamily: "var(--mono-font)" }} className="break-all text-[10.5px]">
        {modDirPath}
      </span>
      <span>整个 Mod 目录(源码 .cs + 编译产物 .dll + mod.json)将移入回收站。</span>
      {reverseDeps.length > 0 && (
        <span className="text-[var(--warn)]">
          ⚠ 以下 Mod 声明依赖本 Mod,删除后它们将无法加载:{reverseDeps.join("、")}
        </span>
      )}
    </div>
  );
}

/** 列表按拓扑序排(manifest 损坏的 Mod 排最后)。 */
function sortedMods(mods: import("../types").ModInfo[], topo: string[]) {
  const orderOf = (m: import("../types").ModInfo) => {
    const id = m.manifest?.id;
    const idx = id ? topo.indexOf(id) : -1;
    return idx < 0 ? Number.MAX_SAFE_INTEGER : idx;
  };
  return [...mods].sort((a, b) => orderOf(a) - orderOf(b));
}
