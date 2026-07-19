import { useSyncExternalStore } from "react";
import type { ModInfo, ModListSnapshot } from "../types";
import { scanProject } from "../lib/scan";

/** Mod 快照 + 选中(镜像旧 modStore)。 */
interface ModState {
  snapshot: ModListSnapshot | null;
  selectedModId: string | null;
  scanning: boolean;
}

let state: ModState = { snapshot: null, selectedModId: null, scanning: false };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function set(patch: Partial<ModState>) {
  state = { ...state, ...patch };
  emit();
}
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function useModStore(): ModState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function getModSnapshot(): ModListSnapshot | null {
  return state.snapshot;
}

/** 扫描绑定工程;选中项仍存在则保持,否则默认选拓扑序最后一项(应用层,镜像旧行为)。 */
export async function scanMods(projectPath: string): Promise<ModListSnapshot> {
  set({ scanning: true });
  try {
    const snapshot = await scanProject(projectPath);
    const stillThere =
      state.selectedModId !== null &&
      snapshot.mods.some((m) => m.manifest?.id === state.selectedModId);
    const fallback = snapshot.topologyOrder.length
      ? snapshot.topologyOrder[snapshot.topologyOrder.length - 1]
      : null;
    set({ snapshot, selectedModId: stillThere ? state.selectedModId : fallback });
    return snapshot;
  } finally {
    set({ scanning: false });
  }
}

export function selectMod(modId: string | null): void {
  set({ selectedModId: modId });
}

export function getSelectedMod(s: ModState): ModInfo | null {
  if (!s.snapshot || !s.selectedModId) return null;
  return s.snapshot.mods.find((m) => m.manifest?.id === s.selectedModId) ?? null;
}

/** 选中 Mod 的依赖项(带"是否已解析"= 目标 id 在工程内存在)。 */
export function getDependsOn(s: ModState): { id: string; versionRange: string; resolved: boolean }[] {
  const mod = getSelectedMod(s);
  if (!mod?.manifest || !s.snapshot) return [];
  const ids = new Set(s.snapshot.mods.map((m) => m.manifest?.id).filter(Boolean));
  return mod.manifest.dependencies.map((d) => ({
    id: d.id,
    versionRange: d.versionRange,
    resolved: ids.has(d.id),
  }));
}

/** 谁依赖选中 Mod(Used By)。 */
export function getUsedBy(s: ModState): string[] {
  const mod = getSelectedMod(s);
  if (!mod?.manifest || !s.snapshot) return [];
  const id = mod.manifest.id;
  return s.snapshot.mods
    .filter((m) => m.manifest && m.manifest.id !== id && m.manifest.dependencies.some((d) => d.id === id))
    .map((m) => m.manifest!.id);
}
