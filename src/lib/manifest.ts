import semver from "semver";
import type { ModDependency, ModManifestJs } from "../types";

const ID_PATTERN = /^[a-z][a-z0-9._-]+$/;

/**
 * 解析 mod.json 文本(逐字移植旧主进程 ModManifestReader.read;JS 镜像 C# 端
 * `ModManifestParser`,同 schema 同必填规则)。输入改为 Rust 原始扫描交来的
 * modJsonText(null = 读取失败)与 manifestPath(错误文案用);校验语义与错误
 * 文案与旧版逐字一致(同 V8 引擎,JSON 语法错误消息也一致)。
 */
export function parseManifest(
  modJsonText: string | null,
  manifestPath: string,
): { manifest: ModManifestJs | null; errors: string[] } {
  const errors: string[] = [];

  if (modJsonText === null) {
    errors.push(`未找到 mod.json:${manifestPath}`);
    return { manifest: null, errors };
  }

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(modJsonText);
  } catch (e) {
    errors.push(`JSON 语法非法:${(e as Error).message}`);
    return { manifest: null, errors };
  }

  const id = readString(json, "id");
  const name = readString(json, "name");
  const version = readString(json, "version");

  if (!id) errors.push("缺字段 'id'(必填)");
  else if (!ID_PATTERN.test(id)) errors.push(`字段 'id' 格式非法:"${id}";要求 ^[a-z][a-z0-9._-]+$`);

  if (!name) errors.push("缺字段 'name'(必填)");

  if (!version) errors.push("缺字段 'version'(必填)");
  else if (!semver.valid(version)) errors.push(`字段 'version' 非合法 semver:"${version}";要求 major.minor.patch`);

  const dependencies: ModDependency[] = [];
  if (json.dependencies !== undefined && json.dependencies !== null) {
    if (!Array.isArray(json.dependencies)) {
      errors.push("字段 'dependencies' 必须是 array");
    } else {
      for (let i = 0; i < json.dependencies.length; i++) {
        const raw = json.dependencies[i];
        if (!raw || typeof raw !== "object") {
          errors.push(`dependencies[${i}] 非对象`);
          continue;
        }
        const depJson = raw as Record<string, unknown>;
        const depId = readString(depJson, "id");
        const depRange = readString(depJson, "version");
        if (!depId) {
          errors.push(`dependencies[${i}] 缺字段 'id'`);
          continue;
        }
        if (!depRange) {
          errors.push(`dependencies[${i}](id=${depId})缺字段 'version'(版本范围)`);
          continue;
        }
        if (!semver.validRange(depRange.replace(/,/g, " "))) {
          errors.push(`dependencies[${i}](id=${depId})'version' 非合法范围 "${depRange}"`);
          continue;
        }
        dependencies.push({ id: depId, versionRange: depRange });
      }
    }
  }

  if (errors.length > 0) return { manifest: null, errors };

  return {
    manifest: {
      id: id!,
      name: name!,
      version: version!,
      description: readString(json, "description") ?? undefined,
      author: readString(json, "author") ?? undefined,
      behaviourIdPrefix: readString(json, "behaviourIdPrefix") ?? undefined,
      dependencies,
      layer: readLayer(json),
    },
    errors: [],
  };
}

function readLayer(obj: Record<string, unknown>): "base" | "mid" | "app" | undefined {
  const v = obj["layer"];
  if (v === "base" || v === "mid" || v === "app") return v;
  return undefined;
}

function readString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}
