import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { DetectedIde } from "../types";

/** IDE 检测与偏好(镜像旧 ideStore;优先级 Cursor→Rider→VS→VSCode)。 */
interface IdeState {
  detected: DetectedIde[];
  preferredPath: string | null;
  loading: boolean;
}

let state: IdeState = { detected: [], preferredPath: null, loading: false };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function set(patch: Partial<IdeState>) {
  state = { ...state, ...patch };
  emit();
}
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function useIdeStore(): IdeState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export async function detectIdes(): Promise<void> {
  set({ loading: true });
  try {
    const [detected, preferredPath] = await Promise.all([
      invoke<DetectedIde[]>("ide_detect_all"),
      invoke<string | null>("ide_get_preferred"),
    ]);
    set({ detected, preferredPath });
  } finally {
    set({ loading: false });
  }
}

export async function setPreferredIde(path: string | null): Promise<void> {
  await invoke("ide_set_preferred", { path });
  set({ preferredPath: path });
}

/** 手动浏览 .exe 并设为偏好(镜像旧 browseManualAndSet)。 */
export async function browseManualIde(): Promise<void> {
  const file = await open({
    title: "选择 IDE 可执行文件",
    filters: [{ name: "可执行文件", extensions: ["exe"] }],
  });
  if (typeof file !== "string") return;
  await setPreferredIde(file);
  if (!state.detected.some((d) => d.path.toLowerCase() === file.toLowerCase())) {
    set({ detected: [...state.detected, { name: "Custom", path: file }] });
  }
}

const PRIORITY = ["Cursor", "Rider", "VS", "VSCode"];

/** 当前生效 IDE:偏好命中优先,否则按优先级取检测结果首个。 */
export function resolveActiveIde(s: IdeState): DetectedIde | null {
  if (s.preferredPath) {
    const hit = s.detected.find((d) => d.path.toLowerCase() === s.preferredPath!.toLowerCase());
    if (hit) return hit;
    return { name: "Custom", path: s.preferredPath };
  }
  for (const name of PRIORITY) {
    const hit = s.detected.find((d) => d.name === name);
    if (hit) return hit;
  }
  return s.detected[0] ?? null;
}

export async function launchIde(idePath: string, targetPath: string): Promise<void> {
  await invoke("ide_launch", { idePath, targetPath });
}
