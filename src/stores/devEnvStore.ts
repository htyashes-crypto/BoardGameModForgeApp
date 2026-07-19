import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { DevEnvSnapshot, DownloadResult, ValidationResult } from "../types";

type DownloadPhase = "idle" | "downloading" | "done" | "error";

/** ModSDK 开发环境(镜像旧 devEnvStore)。 */
interface DevEnvState {
  modSdkPath: string | null;
  validation: ValidationResult | null;
  downloadPhase: DownloadPhase;
  downloadLog: string[];
  downloadMessage: string | null;
}

let state: DevEnvState = {
  modSdkPath: null,
  validation: null,
  downloadPhase: "idle",
  downloadLog: [],
  downloadMessage: null,
};
const listeners = new Set<() => void>();
let subscribed = false;

function emit() {
  for (const l of listeners) l();
}
function set(patch: Partial<DevEnvState>) {
  state = { ...state, ...patch };
  emit();
}
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function useDevEnvStore(): DevEnvState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

function applySnapshot(snap: DevEnvSnapshot): void {
  set({ modSdkPath: snap.modSdkPath, validation: snap.validation });
}

export async function hydrateDevEnv(): Promise<void> {
  applySnapshot(await invoke<DevEnvSnapshot>("devenv_get_snapshot"));
}

/** 下载日志事件订阅(幂等;SettingsModal 挂载时调用)。 */
export async function subscribeDownloadLog(): Promise<() => void> {
  if (subscribed) return () => {};
  subscribed = true;
  const un = await listen<string>("devenv://download-log", (e) => {
    set({ downloadLog: [...state.downloadLog, e.payload] });
  });
  return () => {
    un();
    subscribed = false;
  };
}

export async function browseAndSetModSdkPath(): Promise<void> {
  const dir = await open({ directory: true, title: "选择 Mod 开发环境(ModSDK)目录" });
  if (typeof dir !== "string") return;
  applySnapshot(await invoke<DevEnvSnapshot>("devenv_set_mod_sdk_path", { path: dir }));
}

/** 选下载父目录 → 拼 <parent>\BoardGameModSDK → git clone/pull(镜像旧 downloadToBrowsedDir)。 */
export async function downloadToBrowsedDir(): Promise<void> {
  const parent = await open({
    directory: true,
    title: "选择 GitHub 仓库下载目标父目录(BoardGameModSDK 会作为子目录创建在其下)",
  });
  if (typeof parent !== "string") return;
  const targetDir = `${parent}\\BoardGameModSDK`;
  set({ downloadPhase: "downloading", downloadLog: [], downloadMessage: null });
  try {
    const result = await invoke<DownloadResult>("devenv_download_from_github", { targetDir });
    if (result.success) {
      set({ downloadPhase: "done", downloadMessage: "下载完成,已自动设为 ModSDK 路径" });
      await hydrateDevEnv();
    } else {
      set({ downloadPhase: "error", downloadMessage: result.error ?? "下载失败" });
    }
  } catch (e) {
    set({ downloadPhase: "error", downloadMessage: String(e) });
  }
}

export async function clearModSdkPath(): Promise<void> {
  applySnapshot(await invoke<DevEnvSnapshot>("devenv_set_mod_sdk_path", { path: null }));
}
