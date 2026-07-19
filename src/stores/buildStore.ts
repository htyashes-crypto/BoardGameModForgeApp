import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { BuildLogChunk, BuildModRef, BuildTask, ModListSnapshot, StartBuildReply } from "../types";
import { scanMods } from "./modStore";

const MAX_LOGS = 2000;

/** 编译任务 + 日志流(镜像旧 buildStore;logs 最多 2000 条环形裁剪)。 */
interface BuildState {
  task: BuildTask | null;
  logs: BuildLogChunk[];
}

let state: BuildState = { task: null, logs: [] };
const listeners = new Set<() => void>();
let subscribed = false;

function emit() {
  for (const l of listeners) l();
}
function set(patch: Partial<BuildState>) {
  state = { ...state, ...patch };
  emit();
}
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function useBuildStore(): BuildState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** App 挂载时调用一次:订阅事件 + 取当前任务重放(幂等)。返回清理函数。 */
export async function initBuildSubscriptions(): Promise<() => void> {
  if (subscribed) return () => {};
  subscribed = true;
  const un1 = await listen<BuildLogChunk>("build://log-chunk", (e) => {
    const logs = [...state.logs, e.payload];
    set({ logs: logs.length > MAX_LOGS ? logs.slice(logs.length - MAX_LOGS) : logs });
  });
  const un2 = await listen<BuildTask>("build://state-changed", (e) => {
    set({ task: e.payload });
  });
  const current = await invoke<BuildTask | null>("build_get_current_task");
  if (current) set({ task: current, logs: current.logs.slice(-MAX_LOGS) });
  return () => {
    un1();
    un2();
    subscribed = false;
  };
}

/** 合成本地 failed 任务:早退错误(工程含错/后端拒绝)也要在 BuildingPane 可见(镜像旧行为)。 */
function synthFailedTask(rootModId: string, reason: string): void {
  const now = Date.now();
  const chunk: BuildLogChunk = { ts: now, modId: null, level: "err", text: reason };
  set({
    task: {
      id: `local-${now}`,
      rootModId,
      modIds: [],
      status: "failed",
      completedCount: 0,
      currentModId: null,
      startedAt: now,
      endedAt: now,
      logs: [chunk],
      failedAt: null,
      failureReason: reason,
    },
    logs: [...state.logs, chunk],
  });
}

/** 计算 rootMod 的传递依赖闭包(含自身),按整工程拓扑序过滤(镜像旧 computeBuildOrder)。 */
export function computeBuildOrder(snapshot: ModListSnapshot, rootModId: string): string[] {
  const idToDeps = new Map<string, string[]>();
  for (const m of snapshot.mods) {
    if (!m.manifest) continue;
    idToDeps.set(m.manifest.id, m.manifest.dependencies.map((d) => d.id));
  }
  if (!idToDeps.has(rootModId)) return [];
  const visited = new Set<string>();
  const queue: string[] = [rootModId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const dep of idToDeps.get(cur) ?? []) queue.push(dep);
  }
  return snapshot.topologyOrder.filter((id) => visited.has(id));
}

/**
 * 启动编译(镜像旧 startBuild 前置链:重扫 → hasError 拒编 → 闭包序 → 交后端;
 * 早退错误合成本地 failed 任务保证 UI 可见)。
 */
export async function startBuild(projectPath: string, modId: string): Promise<void> {
  const snapshot = await scanMods(projectPath);
  if (snapshot.hasError) {
    synthFailedTask(
      modId,
      `工程含错误,无法编译。manifest:${snapshot.manifestErrors.length} 条;依赖:${snapshot.dependencyErrors.length} 条`,
    );
    return;
  }
  const order = computeBuildOrder(snapshot, modId);
  if (order.length === 0) {
    synthFailedTask(modId, `Mod Id "${modId}" 不在工程内`);
    return;
  }
  const byId = new Map(snapshot.mods.filter((m) => m.manifest).map((m) => [m.manifest!.id, m]));
  const mods: BuildModRef[] = order.map((id) => {
    const m = byId.get(id)!;
    return { modId: id, modDir: m.modDir, modDirPath: m.modDirPath };
  });
  const reply = await invoke<StartBuildReply>("build_start", { rootModId: modId, mods });
  if (reply.error) synthFailedTask(modId, reply.error);
}

export async function cancelBuild(): Promise<void> {
  await invoke("build_cancel");
}

export function clearBuildTask(): void {
  set({ task: null });
}

