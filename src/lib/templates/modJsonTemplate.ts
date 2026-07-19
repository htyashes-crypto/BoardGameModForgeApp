import type { ModDependency, ModLayer } from "../../types";

/**
 * Mod 编译期绑定的 SDK 版本印章。运行时 Loader 与 Player 内嵌 SDK 比对,
 * 不一致时通过 TerminalLog 警告(主题群「Mod 开发环境作为独立引擎」收尾补完)。
 */
export interface ModSdkBindings {
  sdkVersion?: string;
  contentHash?: string;
}

export interface ModJsonInput {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  behaviourIdPrefix?: string;
  dependencies: ModDependency[];
  /** Mod 编译期绑定的 SDK 版本印章(创建流程从 devenv_get_sdk_bindings 读取注入)。 */
  sdkBindings?: ModSdkBindings;
  /** 开发者声明的架构层级(可选;空值时 ModForge 列表降级到拓扑序推断)。 */
  layer?: ModLayer;
}

/**
 * 生成 mod.json 文件内容(逐字移植旧模板)。与 C# 端 ModManifest schema 严格对齐:
 * id / name / version 必填;dependencies 数组(空时也写 `[]`);可选字段缺省省略。
 */
export function renderModJson(input: ModJsonInput): string {
  const obj: Record<string, unknown> = {
    id: input.id,
    name: input.name,
    version: input.version,
  };
  if (input.description) obj.description = input.description;
  if (input.author) obj.author = input.author;
  if (input.behaviourIdPrefix) obj.behaviourIdPrefix = input.behaviourIdPrefix;
  if (input.layer) obj.layer = input.layer;
  obj.dependencies = input.dependencies.map((d) => ({
    id: d.id,
    version: d.versionRange,
  }));
  if (input.sdkBindings && (input.sdkBindings.sdkVersion || input.sdkBindings.contentHash)) {
    const sb: Record<string, string> = {};
    if (input.sdkBindings.sdkVersion) sb.sdkVersion = input.sdkBindings.sdkVersion;
    if (input.sdkBindings.contentHash) sb.contentHash = input.sdkBindings.contentHash;
    obj.sdkBindings = sb;
  }
  return JSON.stringify(obj, null, 4) + "\n";
}
