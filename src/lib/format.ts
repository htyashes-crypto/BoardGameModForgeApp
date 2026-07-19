/** 展示格式化工具(镜像旧 HubView/ModDetailPane 内联 helpers)。 */

/** 相对时间:秒/分/小时/天,超 7 天显示日期。 */
export function formatTimeAgo(ts: number | undefined): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${Math.max(sec, 1)} 秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day} 天前`;
  return new Date(ts).toLocaleDateString();
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/** dll mtime:今天显示 "今天 HH:mm",否则日期 + 时间。 */
export function formatMtime(ts: number | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (d.toDateString() === now.toDateString()) return `今天 ${hm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

/** sha256 缩略:前 8 + … + 后 6。 */
export function shortSha(sha: string | null): string {
  if (!sha) return "";
  if (sha.length <= 16) return sha;
  return `${sha.slice(0, 8)}…${sha.slice(-6)}`;
}

/** 路径缩略:超长时保留盘符与末两段。 */
export function shortenPath(p: string, max = 46): string {
  if (p.length <= max) return p;
  const parts = p.split(/[\\/]/);
  if (parts.length <= 3) return p;
  return `${parts[0]}\\…\\${parts.slice(-2).join("\\")}`;
}
