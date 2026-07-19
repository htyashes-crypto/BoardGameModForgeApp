import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import semver from 'semver'
import type { ModDependency, ModManifestJs } from '../types-mod'

const ID_PATTERN = /^[a-z][a-z0-9._-]+$/

/**
 * 读取 mod 子目录下的 mod.json 并解析。JS 镜像 C# 端 `ModManifestParser`(同 schema 同必填规则)。
 * 用 `semver.validRange` 校验版本范围;为兼容 C# 端的 ", " 分隔多约束,
 * 将逗号 normalize 为空格(npm semver 标准用空格)。
 */
export class ModManifestReader {
  async read(modDir: string): Promise<{ manifest: ModManifestJs | null; errors: string[] }> {
    const errors: string[] = []
    const manifestPath = join(modDir, 'mod.json')

    let text: string
    try {
      text = await fs.readFile(manifestPath, 'utf-8')
    } catch {
      errors.push(`未找到 mod.json:${manifestPath}`)
      return { manifest: null, errors }
    }

    let json: Record<string, unknown>
    try {
      json = JSON.parse(text)
    } catch (e) {
      errors.push(`JSON 语法非法:${(e as Error).message}`)
      return { manifest: null, errors }
    }

    const id = readString(json, 'id')
    const name = readString(json, 'name')
    const version = readString(json, 'version')

    if (!id) errors.push("缺字段 'id'(必填)")
    else if (!ID_PATTERN.test(id)) errors.push(`字段 'id' 格式非法:"${id}";要求 ^[a-z][a-z0-9._-]+$`)

    if (!name) errors.push("缺字段 'name'(必填)")

    if (!version) errors.push("缺字段 'version'(必填)")
    else if (!semver.valid(version)) errors.push(`字段 'version' 非合法 semver:"${version}";要求 major.minor.patch`)

    const dependencies: ModDependency[] = []
    if (json.dependencies !== undefined && json.dependencies !== null) {
      if (!Array.isArray(json.dependencies)) {
        errors.push("字段 'dependencies' 必须是 array")
      } else {
        for (let i = 0; i < json.dependencies.length; i++) {
          const raw = json.dependencies[i]
          if (!raw || typeof raw !== 'object') {
            errors.push(`dependencies[${i}] 非对象`)
            continue
          }
          const depJson = raw as Record<string, unknown>
          const depId = readString(depJson, 'id')
          const depRange = readString(depJson, 'version')
          if (!depId) {
            errors.push(`dependencies[${i}] 缺字段 'id'`)
            continue
          }
          if (!depRange) {
            errors.push(`dependencies[${i}](id=${depId})缺字段 'version'(版本范围)`)
            continue
          }
          if (!semver.validRange(depRange.replace(/,/g, ' '))) {
            errors.push(`dependencies[${i}](id=${depId})'version' 非合法范围 "${depRange}"`)
            continue
          }
          dependencies.push({ id: depId, versionRange: depRange })
        }
      }
    }

    if (errors.length > 0) return { manifest: null, errors }

    return {
      manifest: {
        id: id!,
        name: name!,
        version: version!,
        description: readString(json, 'description') ?? undefined,
        author: readString(json, 'author') ?? undefined,
        behaviourIdPrefix: readString(json, 'behaviourIdPrefix') ?? undefined,
        dependencies,
        layer: readLayer(json)
      },
      errors: []
    }
  }
}

function readLayer(obj: Record<string, unknown>): 'base' | 'mid' | 'app' | undefined {
  const v = obj['layer']
  if (v === 'base' || v === 'mid' || v === 'app') return v
  return undefined
}

function readString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key]
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  return trimmed.length > 0 ? trimmed : null
}
