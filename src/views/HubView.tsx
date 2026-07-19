import { FolderOpen, Lightning, Refresh, Search } from "@icon-park/react";
import type { ProjectInfo } from "../types";
import { formatTimeAgo } from "../lib/format";
import {
  bindProject,
  browseAndBindSingle,
  browseScanRoot,
  refreshScan,
  setFilterText,
  useProjectStore,
} from "../stores/projectStore";

/** 工程选择 Hub(对 hub.svg):左品牌栏 + 最近打开 + 扫描网格 + 搜索。 */
export default function HubView() {
  const s = useProjectStore();
  const kw = s.filterText.trim().toLowerCase();
  const match = (p: ProjectInfo) =>
    !kw || p.name.toLowerCase().includes(kw) || p.path.toLowerCase().includes(kw);
  const recentFiltered = s.recent.filter(match);
  const recentPaths = new Set(s.recent.map((p) => p.path));
  const scannedFiltered = s.scanned.filter((p) => !recentPaths.has(p.path)).filter(match);

  return (
    <div className="flex min-h-0 flex-1 gap-4 p-4">
      {/* 品牌栏 */}
      <aside className="flex w-[304px] shrink-0 flex-col rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-7 py-10">
        <div className="flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-[var(--accent)]">
            <AnvilGlyph className="h-9 w-9" />
          </div>
          <div className="mt-6 text-2xl font-bold text-[var(--text)]">ModForge</div>
          <div className="mt-1.5 text-[12px] text-[var(--text-3)]">桌游 Mod 开发工作台</div>
        </div>
        <div className="my-7 border-t border-[var(--border-soft)]" />
        <ul className="flex flex-col gap-3.5 text-[12px] text-[var(--text-2)]">
          <Bullet>一个 Mod = 一个 .dll 工程</Bullet>
          <Bullet>Behaviour = 挂载到桌游对象的 C# 类</Bullet>
          <Bullet>编译产物由 Unity 端热检测</Bullet>
        </ul>
        <div className="mt-8 flex flex-col gap-2.5">
          <button onClick={() => void browseAndBindSingle()} className="btn-ghost">
            <Lightning theme="outline" size="14" />
            打开单个工程…
          </button>
          <button onClick={() => void browseScanRoot()} className="btn-ghost">
            <FolderOpen theme="outline" size="14" />
            更换扫描根目录…
          </button>
        </div>
        <div className="mt-auto flex items-center gap-2.5 rounded-[10px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3">
          <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
          <span className="text-[11px] text-[var(--text-3)]">v2.0.0 · Tauri 2 · 就绪</span>
        </div>
      </aside>

      {/* 主区 */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto pr-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-bold text-[var(--text)]">选择桌游工程</h1>
            <p className="mt-1 text-[12px] text-[var(--text-3)]">
              绑定后,所有 Mod / Behaviour / 编译操作都发生在该工程的 ModBehaviourProject/ 目录下
            </p>
          </div>
          <label className="flex h-9 w-[296px] shrink-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 focus-within:border-[var(--focus-border)]">
            <Search theme="outline" size="14" className="text-[var(--text-faint)]" />
            <input
              value={s.filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="搜索工程名 / 路径…"
              className="w-full bg-transparent text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
            />
          </label>
        </div>

        {recentFiltered.length > 0 && (
          <section className="mt-6">
            <SectionLabel text="最近打开" count={recentFiltered.length} />
            <div className="mt-3 flex flex-col gap-2">
              {recentFiltered.map((p, i) => (
                <RecentRow key={p.path} project={p} highlighted={i === 0} />
              ))}
            </div>
          </section>
        )}

        <section className="mt-7 flex-1">
          <div className="flex items-baseline justify-between">
            <SectionLabel text="扫描到的桌游工程" count={scannedFiltered.length} />
            <span className="font-mono text-[11px] text-[var(--text-faint)]" style={{ fontFamily: "var(--mono-font)" }}>
              {s.scanRoot ? `扫描根:${s.scanRoot}` : "未设置扫描根 — 点左侧「更换扫描根目录…」"}
            </span>
          </div>
          {s.scanning ? (
            <div className="mt-10 text-center text-[12px] text-[var(--text-3)]">扫描中…</div>
          ) : scannedFiltered.length === 0 ? (
            <div className="mt-10 text-center text-[12px] text-[var(--text-3)]">
              {s.scanRoot ? "当前扫描根下没有桌游工程" : "设置扫描根目录后自动列出其下工程"}
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
              {scannedFiltered.map((p) => (
                <ProjectTile key={p.path} project={p} />
              ))}
            </div>
          )}
        </section>

        <footer className="mt-6 flex items-center justify-between border-t border-[var(--border-soft)] pt-4">
          <span className="text-[11px] text-[var(--text-faint)]">
            创建 Mod 时将在工程下生成 ModBehaviourProject/&lt;ModName&gt;/ · 支持命令行 --project &lt;path&gt; 直接拉起绑定
          </span>
          <button onClick={() => void refreshScan()} disabled={!s.scanRoot || s.scanning} className="btn-ghost shrink-0 disabled:opacity-50">
            <Refresh theme="outline" size="14" />
            重新扫描
          </button>
        </footer>
      </main>
    </div>
  );
}

function SectionLabel({ text, count }: { text: string; count: number }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="text-[11px] font-semibold tracking-[1.5px] text-[var(--text-3)]">{text}</span>
      <span className="text-[11px] text-[var(--text-faint)]">{count}</span>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
      {children}
    </li>
  );
}

function Avatar({ name, active }: { name: string; active: boolean }) {
  return (
    <div
      className={
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border text-lg font-bold " +
        (active
          ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
          : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-2)]")
      }
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function ModCountChip({ count }: { count: number }) {
  return count > 0 ? (
    <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--accent-text)]">
      {count} MOD
    </span>
  ) : (
    <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-0.5 text-[10px] text-[var(--text-faint)]">
      无 Mod
    </span>
  );
}

function RecentRow({ project, highlighted }: { project: ProjectInfo; highlighted: boolean }) {
  return (
    <button
      onClick={() => void bindProject(project)}
      className={
        "group flex items-center gap-4 rounded-xl border px-4 py-3 text-left transition-colors " +
        (highlighted
          ? "border-[var(--accent-border)] bg-[var(--accent-soft)]"
          : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]")
      }
    >
      {highlighted && <span className="-ml-1 h-10 w-[3px] rounded-full bg-[var(--accent)]" />}
      <Avatar name={project.name} active={project.modCount > 0} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <span className="truncate text-[14px] font-semibold text-[var(--text)]">{project.name}</span>
          <ModCountChip count={project.modCount} />
        </div>
        <div className="mt-0.5 truncate text-[11px] text-[var(--text-faint)]" style={{ fontFamily: "var(--mono-font)" }}>
          {project.path}
        </div>
      </div>
      <span className="shrink-0 text-[11px] text-[var(--text-faint)]">{formatTimeAgo(project.lastOpenedAt)}</span>
      <span className="shrink-0 text-[12px] text-[var(--accent-text)] opacity-0 transition-opacity group-hover:opacity-100">
        进入 ›
      </span>
    </button>
  );
}

function ProjectTile({ project }: { project: ProjectInfo }) {
  return (
    <button
      onClick={() => void bindProject(project)}
      className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition-colors hover:border-[var(--accent-border)] hover:bg-[var(--surface-hover)]"
    >
      <div className="flex items-center gap-3">
        <Avatar name={project.name} active={project.modCount > 0} />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[var(--text)]">{project.name}</div>
          <div className="mt-1">
            <ModCountChip count={project.modCount} />
          </div>
        </div>
      </div>
      <div className="truncate text-[10px] text-[var(--text-faint)]" style={{ fontFamily: "var(--mono-font)" }}>
        {project.path}
      </div>
    </button>
  );
}

/** 品牌铁砧剪影(与应用图标 A 同母题)。 */
export function AnvilGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className}>
      <g fill="#ece8e1">
        <path d="M3 15.2 C6 13.4 8.6 12.6 10.6 12.5 L10.6 18.2 C8.9 18.1 6.6 17.4 3 16.6 Z" />
        <rect x="10" y="12" width="21" height="6.6" rx="1.6" />
        <rect x="16" y="18.6" width="7.4" height="4" />
        <path d="M13.4 22.6 L26 22.6 L28.8 27 L10.6 27 Z" />
      </g>
    </svg>
  );
}
