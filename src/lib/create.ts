import { invoke } from "@tauri-apps/api/core";
import type { DevEnvSnapshot, ModDependency, ModLayer, ModListSnapshot, SdkBindings } from "../types";
import { scanProject } from "./scan";
import { renderModJson } from "./templates/modJsonTemplate";
import { renderCsproj, type SiblingModRef } from "./templates/csprojTemplate";
import { renderSln } from "./templates/slnTemplate";
import { renderBehaviour, type BehaviourTemplateKind } from "./templates/behaviourTemplate";

const ID_PATTERN = /^[a-z][a-z0-9._-]+$/;
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const CLASS_NAME_PATTERN = /^[A-Z][A-Za-z0-9_]*$/;
const BEHAVIOUR_SUFFIX = "Behaviour";

export interface CreateModInput {
  projectPath: string;
  modName: string;
  modId: string;
  version: string;
  description?: string;
  author?: string;
  behaviourIdPrefix?: string;
  dependencies: ModDependency[];
  layer?: ModLayer;
}

export interface CreateModResult {
  success: boolean;
  modDirPath: string;
  errors: string[];
}

/** 从 modId 末段派生 BehaviourIdPrefix(镜像旧 deriveBehaviourIdPrefix)。 */
export function deriveBehaviourIdPrefix(modId: string): string {
  const parts = modId.split(".");
  const last = parts[parts.length - 1] ?? modId;
  return last.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** 默认 Mod Id 派生:com.boardgame.<工程名小写>.<mod名小写>(镜像旧 NewModModal 行为)。 */
export function deriveModId(projectName: string, modName: string): string {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `com.boardgame.${clean(projectName)}.${clean(modName)}`;
}

/**
 * 创建 Mod(镜像旧 ModCreationService.create:字段/重名/依赖校验文案逐字;
 * 模板 TS 渲染 → Rust 受约束落盘)。
 */
export async function createMod(input: CreateModInput): Promise<CreateModResult> {
  const errors: string[] = [];
  const modDirPath = `${input.projectPath}\\ModBehaviourProject\\${input.modName}`;

  if (!NAME_PATTERN.test(input.modName)) {
    errors.push(`Mod 名格式非法:"${input.modName}";要求 ^[A-Za-z][A-Za-z0-9_]*$`);
  }
  if (!ID_PATTERN.test(input.modId)) {
    errors.push(`Mod Id 格式非法:"${input.modId}";要求 ^[a-z][a-z0-9._-]+$`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(input.version)) {
    errors.push(`版本格式非法:"${input.version}";要求 major.minor.patch`);
  }
  if (errors.length > 0) return { success: false, modDirPath, errors };

  const snapshot = await scanProject(input.projectPath);
  if (snapshot.mods.some((m) => m.modDir === input.modName)) {
    errors.push(`已存在同名子目录:ModBehaviourProject/${input.modName}/`);
  }
  const idCollision = snapshot.mods.find((m) => m.manifest?.id === input.modId);
  if (idCollision) {
    errors.push(`已存在同名 Mod Id "${input.modId}"(在目录 ${idCollision.modDir})`);
  }
  if (errors.length > 0) return { success: false, modDirPath, errors };

  const idToMod = new Map(snapshot.mods.filter((m) => m.manifest).map((m) => [m.manifest!.id, m]));
  const siblingRefs: SiblingModRef[] = [];
  for (const dep of input.dependencies) {
    const target = idToMod.get(dep.id);
    if (!target) {
      errors.push(`依赖 "${dep.id}" 在当前工程内不存在(需先创建被依赖 Mod)`);
      continue;
    }
    siblingRefs.push({ modDirName: target.modDir, assemblyName: `${target.modDir}Behaviour` });
  }
  if (errors.length > 0) return { success: false, modDirPath, errors };

  const behaviourIdPrefix = input.behaviourIdPrefix ?? deriveBehaviourIdPrefix(input.modId);
  const sdkBindings = (await invoke<SdkBindings | null>("devenv_get_sdk_bindings")) ?? undefined;
  const devEnv = await invoke<DevEnvSnapshot>("devenv_get_snapshot");

  const modJsonText = renderModJson({
    id: input.modId,
    name: input.modName,
    version: input.version,
    description: input.description,
    author: input.author,
    behaviourIdPrefix,
    dependencies: input.dependencies,
    sdkBindings,
    layer: input.layer,
  });
  const csprojText = renderCsproj({
    modName: input.modName,
    siblingMods: siblingRefs,
    modSdkPath: devEnv.modSdkPath ?? undefined,
  });
  const slnText = renderSln(input.modName);

  try {
    const written = await invoke<string>("mod_create_write", {
      projectPath: input.projectPath,
      modName: input.modName,
      modJsonText,
      csprojText,
      slnText,
    });
    return { success: true, modDirPath: written, errors: [] };
  } catch (e) {
    return { success: false, modDirPath, errors: [String(e)] };
  }
}

export interface CreateBehaviourInput {
  projectPath: string;
  modDir: string;
  className: string;
  behaviourId: string;
  displayName?: string;
  category?: string;
  template: BehaviourTemplateKind;
}

export interface CreateBehaviourResult {
  success: boolean;
  filePath: string;
  errors: string[];
}

export function ensureBehaviourSuffix(name: string): string {
  return name.endsWith(BEHAVIOUR_SUFFIX) ? name : name + BEHAVIOUR_SUFFIX;
}

/**
 * 创建 Behaviour(镜像旧 BehaviourCreationService.create:后缀补全/格式/Id 全工程唯一
 * 校验文案逐字;src 存在与同名文件检查由 Rust 落盘命令承担)。
 */
export async function createBehaviour(input: CreateBehaviourInput): Promise<CreateBehaviourResult> {
  const errors: string[] = [];
  const className = ensureBehaviourSuffix(input.className.trim());
  const filePath = `${input.projectPath}\\ModBehaviourProject\\${input.modDir}\\src\\${className}.cs`;

  if (!CLASS_NAME_PATTERN.test(className)) {
    errors.push(`类名格式非法:"${className}";要求 ^[A-Z][A-Za-z0-9_]*$`);
  }
  if (!input.behaviourId || input.behaviourId.length === 0) {
    errors.push("Behaviour Id 为空");
  }
  if (errors.length > 0) return { success: false, filePath, errors };

  const snap = await scanProject(input.projectPath);
  for (const m of snap.mods) {
    for (const b of m.behaviours) {
      if (b.behaviourId && b.behaviourId === input.behaviourId) {
        errors.push(`BehaviourId 已被占用:"${input.behaviourId}"(在 ${m.modDir}/${b.sourceFile})`);
        return { success: false, filePath, errors };
      }
    }
  }

  const displayName = input.displayName?.trim() || className.replace(/Behaviour$/, "");
  const category = input.category?.trim() || `Mods/${input.modDir}/Behaviour`;
  const text = renderBehaviour(input.template, {
    className,
    behaviourId: input.behaviourId,
    displayName,
    category,
    namespace: input.modDir,
  });

  try {
    const written = await invoke<string>("behaviour_create_write", {
      projectPath: input.projectPath,
      modDir: input.modDir,
      className,
      csText: text,
    });
    return { success: true, filePath: written, errors: [] };
  } catch (e) {
    return { success: false, filePath, errors: [String(e)] };
  }
}

/** 反向依赖清单(删除确认弹窗展示;镜像旧 ModDeletionService 的反向扫描)。 */
export function computeReverseDeps(snapshot: ModListSnapshot, modId: string): string[] {
  const out: string[] = [];
  for (const mod of snapshot.mods) {
    if (!mod.manifest || mod.manifest.id === modId) continue;
    if (mod.manifest.dependencies.some((d) => d.id === modId)) out.push(mod.manifest.id);
  }
  return out;
}

/** 删除 Mod(移入回收站;确认已由 ConfirmModal 完成)。 */
export async function deleteMod(projectPath: string, modDirName: string): Promise<void> {
  await invoke("mod_delete", { projectPath, modDirName });
}
