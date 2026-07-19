import { useSyncExternalStore } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/** 自更新状态机(七态,镜像旧 updateStore;驱动源改为 tauri updater 插件)。 */
export type UpdateUiState =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "error"
  | "dismissed";

interface UpdateState {
  state: UpdateUiState;
  version: string | null;
  body: string | null;
  downloaded: number;
  total: number | null;
  errorMessage: string | null;
  manuallyTriggered: boolean;
}

let state: UpdateState = {
  state: "idle",
  version: null,
  body: null,
  downloaded: 0,
  total: null,
  errorMessage: null,
  manuallyTriggered: false,
};
let pendingUpdate: Update | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function set(patch: Partial<UpdateState>) {
  state = { ...state, ...patch };
  emit();
}
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function useUpdateStore(): UpdateState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** 检查更新;返回结果语义给调用方(Settings 按钮要显示"已是最新")。 */
export async function checkForUpdate(manual: boolean): Promise<"available" | "none" | "error"> {
  set({ state: "checking", manuallyTriggered: manual, errorMessage: null });
  try {
    const update = await check();
    if (!update) {
      set({ state: "idle" });
      return "none";
    }
    pendingUpdate = update;
    set({ state: "available", version: update.version, body: update.body ?? null });
    return "available";
  } catch (e) {
    // dev 模式(未打包)/网络不可达时 check 会报错:手动触发才展示错误弹窗,静默检查回 idle
    if (manual) {
      set({ state: "error", errorMessage: String(e) });
      return "error";
    }
    set({ state: "idle" });
    return "error";
  }
}

export async function downloadUpdate(): Promise<void> {
  if (!pendingUpdate) return;
  set({ state: "downloading", downloaded: 0, total: null });
  try {
    await pendingUpdate.download((ev) => {
      if (ev.event === "Started") set({ total: ev.data.contentLength ?? null });
      else if (ev.event === "Progress") set({ downloaded: state.downloaded + ev.data.chunkLength });
    });
    set({ state: "downloaded" });
  } catch (e) {
    set({ state: "error", errorMessage: String(e) });
  }
}

/** 安装并重启(镜像旧 quitAndInstall 语义)。 */
export async function installUpdate(): Promise<void> {
  if (!pendingUpdate) return;
  try {
    await pendingUpdate.install();
    await relaunch();
  } catch (e) {
    set({ state: "error", errorMessage: String(e) });
  }
}

export function dismissUpdate(): void {
  set({ state: "dismissed" });
}

export function resetUpdate(): void {
  set({ state: "idle", errorMessage: null });
}

/** 启动静默检查:仅打包版(dev 下 updater 无产物,镜像旧 isPackaged 门)。 */
export function checkOnStartup(): void {
  if (!import.meta.env.DEV) void checkForUpdate(false);
}
