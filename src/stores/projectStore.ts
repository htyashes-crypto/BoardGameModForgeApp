import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { ProjectBindingSnapshot, ProjectInfo } from "../types";

/** Hub / 绑定上下文(镜像旧 projectStore:bound/recent/scanned/scanRoot/scanning/filterText)。 */
interface ProjectState {
  bound: ProjectInfo | null;
  recent: ProjectInfo[];
  scanned: ProjectInfo[];
  scanRoot: string | null;
  scanning: boolean;
  filterText: string;
}

let state: ProjectState = {
  bound: null,
  recent: [],
  scanned: [],
  scanRoot: null,
  scanning: false,
  filterText: "",
};
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function set(patch: Partial<ProjectState>) {
  state = { ...state, ...patch };
  emit();
}
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function useProjectStore(): ProjectState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** 启动水合:绑定快照 + 自动探测扫描根 + 首扫(镜像旧 hydrateFromMain)。 */
export async function hydrateProject(): Promise<void> {
  const snap = await invoke<ProjectBindingSnapshot>("project_get_snapshot");
  set({ bound: snap.bound, recent: snap.recent });
  const root = await invoke<string | null>("project_auto_detect_root");
  if (root) {
    set({ scanRoot: root });
    await refreshScan();
  }
}

export async function refreshScan(): Promise<void> {
  const root = state.scanRoot;
  if (!root) return;
  set({ scanning: true });
  try {
    const scanned = await invoke<ProjectInfo[]>("project_scan", { rootDir: root });
    set({ scanned });
  } finally {
    set({ scanning: false });
  }
}

export async function bindProject(project: ProjectInfo): Promise<void> {
  const snap = await invoke<ProjectBindingSnapshot>("project_bind", { project });
  set({ bound: snap.bound, recent: snap.recent });
}

export async function unbindProject(): Promise<void> {
  const snap = await invoke<ProjectBindingSnapshot>("project_unbind");
  set({ bound: snap.bound, recent: snap.recent });
}

export async function browseScanRoot(): Promise<void> {
  const dir = await open({ directory: true, title: "选择桌游工程文件夹(扫描根目录)" });
  if (typeof dir === "string") {
    set({ scanRoot: dir });
    await refreshScan();
  }
}

export async function browseAndBindSingle(): Promise<void> {
  const dir = await open({ directory: true, title: "选择单个桌游工程目录" });
  if (typeof dir !== "string") return;
  const info = await invoke<ProjectInfo | null>("project_scan_single", { path: dir });
  if (info) await bindProject(info);
}

export function setFilterText(v: string): void {
  set({ filterText: v });
}
