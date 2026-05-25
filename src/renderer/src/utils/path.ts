/**
 * 浏览器端轻量路径工具(主进程已有 node:path,renderer 没有)。
 * 仅实现 join + dirname + basename + Windows/POSIX 分隔符兼容,避免引入 path-browserify 依赖。
 */

const SEP = /[\\/]/

export function join(...parts: string[]): string {
  const filtered = parts.filter((p) => p && p.length > 0)
  if (filtered.length === 0) return ''
  // 用第一段的首字符判断风格;默认 Windows
  const first = filtered[0]
  const isWindows = first.includes('\\') || /^[a-zA-Z]:/.test(first)
  const sep = isWindows ? '\\' : '/'
  const segments: string[] = []
  for (const part of filtered) {
    for (const piece of part.split(SEP)) {
      if (piece.length > 0) segments.push(piece)
    }
  }
  // 保留 Windows 盘符
  const head = first.match(/^[a-zA-Z]:/)?.[0]
  if (head) {
    // 第一个 piece 已经是 "C:" 类的,继续拼
    return segments.join(sep)
  }
  return (isWindows ? '' : '/') + segments.join(sep)
}

export function basename(p: string): string {
  if (!p) return ''
  const parts = p.split(SEP)
  return parts[parts.length - 1] ?? ''
}

export function dirname(p: string): string {
  if (!p) return ''
  const parts = p.split(SEP)
  parts.pop()
  return parts.join(p.includes('\\') ? '\\' : '/')
}
