import semver from 'semver'
import type { ModInfo } from '../types-mod'

/**
 * Mod 依赖图构建 + 拓扑排序结果。
 */
export interface DepGraphResult {
  /** adjacency[modId] = 该 Mod 依赖的 modId 列表。 */
  adjacency: Record<string, string[]>
  /** Kahn 拓扑序(被依赖 Mod 在前)。失败时空。 */
  topologyOrder: string[]
  /** manifest 缺失/解析错误(带 [modDir] 前缀)。 */
  manifestErrors: string[]
  /** 依赖错误:缺失 / 版本不匹配 / 循环 / Id 重复。 */
  dependencyErrors: string[]
}

/**
 * JS 镜像 C# 端 `ModDependencyResolver + ModTopologySorter`,在 renderer 端实时显示依赖关系
 * 不依赖 Unity 启动。算法严格对齐 C# 端:Kahn + 字典序保证可重现。
 */
export class ModDependencyGraphService {
  build(mods: ModInfo[]): DepGraphResult {
    const result: DepGraphResult = {
      adjacency: {},
      topologyOrder: [],
      manifestErrors: [],
      dependencyErrors: []
    }

    // 收集合法 manifest;manifest 错误的 Mod 累积到 manifestErrors
    const idToMod: Record<string, ModInfo> = {}
    for (const mod of mods) {
      if (!mod.manifest) {
        for (const err of mod.manifestErrors) {
          result.manifestErrors.push(`[${mod.modDir}] ${err}`)
        }
        continue
      }
      const id = mod.manifest.id
      if (idToMod[id]) {
        result.dependencyErrors.push(
          `Mod Id 冲突:"${id}" 同时被目录 "${idToMod[id].modDir}" 与 "${mod.modDir}" 使用`
        )
        continue
      }
      idToMod[id] = mod
    }

    if (result.manifestErrors.length > 0 || result.dependencyErrors.length > 0) return result

    // 构建邻接表 + 校验依赖完整性 + 版本兼容
    const adj: Record<string, string[]> = {}
    for (const id of Object.keys(idToMod)) adj[id] = []

    for (const id of Object.keys(idToMod)) {
      const mod = idToMod[id]
      for (const dep of mod.manifest!.dependencies) {
        const depMod = idToMod[dep.id]
        if (!depMod) {
          result.dependencyErrors.push(
            `Mod "${id}" 声明依赖 "${dep.id}",但当前工程内不存在该 Mod`
          )
          continue
        }
        const normalizedRange = dep.versionRange.replace(/,/g, ' ')
        if (!semver.satisfies(depMod.manifest!.version, normalizedRange)) {
          result.dependencyErrors.push(
            `Mod "${id}" 声明依赖 "${dep.id} ${dep.versionRange}",实际版本 "${depMod.manifest!.version}" 不满足范围`
          )
          continue
        }
        adj[id].push(dep.id)
      }
    }

    if (result.dependencyErrors.length > 0) return result

    result.adjacency = adj

    // Kahn 拓扑排序
    const inDegree: Record<string, number> = {}
    const reverse: Record<string, string[]> = {}
    for (const id of Object.keys(adj)) {
      inDegree[id] = adj[id].length
      reverse[id] = []
    }
    for (const id of Object.keys(adj)) {
      for (const depId of adj[id]) {
        if (!reverse[depId]) reverse[depId] = []
        reverse[depId].push(id)
      }
    }

    const queue: string[] = []
    for (const id of Object.keys(inDegree).sort()) {
      if (inDegree[id] === 0) queue.push(id)
    }

    const order: string[] = []
    while (queue.length > 0) {
      const cur = queue.shift()!
      order.push(cur)
      const successors = (reverse[cur] ?? []).slice().sort()
      for (const s of successors) {
        inDegree[s]--
        if (inDegree[s] === 0) queue.push(s)
      }
    }

    if (order.length !== Object.keys(adj).length) {
      const cycle = Object.entries(inDegree)
        .filter(([, d]) => d > 0)
        .map(([k]) => k)
        .sort()
      result.dependencyErrors.push(`检测到循环依赖,涉及 Mod:${cycle.join(' → ')}`)
      return result
    }

    result.topologyOrder = order
    return result
  }

  /** 由 adjacency 反向计算"被谁依赖"。供 Workspace 的 Used By 段使用。 */
  buildReverseAdjacency(adjacency: Record<string, string[]>): Record<string, string[]> {
    const reverse: Record<string, string[]> = {}
    for (const id of Object.keys(adjacency)) reverse[id] = []
    for (const id of Object.keys(adjacency)) {
      for (const depId of adjacency[id]) {
        if (!reverse[depId]) reverse[depId] = []
        reverse[depId].push(id)
      }
    }
    return reverse
  }
}
