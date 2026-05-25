import type { ModDependency } from '../types-mod'

export interface ModJsonInput {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  behaviourIdPrefix?: string
  dependencies: ModDependency[]
}

/**
 * 生成 mod.json 文件内容。与 C# 端 ModManifest schema 严格对齐:
 * id / name / version 必填;dependencies 数组(空时也写 `[]`);可选字段缺省省略。
 */
export function renderModJson(input: ModJsonInput): string {
  const obj: Record<string, unknown> = {
    id: input.id,
    name: input.name,
    version: input.version
  }
  if (input.description) obj.description = input.description
  if (input.author) obj.author = input.author
  if (input.behaviourIdPrefix) obj.behaviourIdPrefix = input.behaviourIdPrefix
  obj.dependencies = input.dependencies.map((d) => ({
    id: d.id,
    version: d.versionRange
  }))
  return JSON.stringify(obj, null, 4) + '\n'
}
