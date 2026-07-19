import { invoke } from "@tauri-apps/api/core";
import type { ModInfo, ModListSnapshot, ModRawInfo } from "../types";
import { parseManifest } from "./manifest";
import { buildDepGraph } from "./depGraph";

/**
 * 工程 Mod 扫描:Rust 原始扫描(IO/sha256/Behaviour 提取)→ TS 端 manifest 校验 +
 * 依赖图 → 组装 ModListSnapshot(镜像旧 ModScanService.scanModRoot 的组装语义)。
 */
export async function scanProject(projectPath: string): Promise<ModListSnapshot> {
  const raw = await invoke<ModRawInfo[]>("mod_scan_project_raw", { projectPath });

  const mods: ModInfo[] = raw.map((r) => {
    const { manifest, errors } = parseManifest(r.modJsonText, r.manifestPath);
    return {
      modDir: r.modDir,
      modDirPath: r.modDirPath,
      manifest,
      manifestErrors: errors,
      hasDll: r.hasDll,
      dllPath: r.dllPath,
      dllSize: r.dllSize,
      dllSha256: r.dllSha256,
      dllMtime: r.dllMtime,
      behaviours: r.behaviours,
    };
  });

  const graph = buildDepGraph(mods);
  const snapshot: ModListSnapshot = {
    mods,
    topologyOrder: graph.topologyOrder,
    manifestErrors: graph.manifestErrors,
    dependencyErrors: graph.dependencyErrors,
    hasError: graph.manifestErrors.length > 0 || graph.dependencyErrors.length > 0,
  };
  return snapshot;
}
