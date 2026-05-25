import { useEffect, useMemo, useState } from 'react'
import { join as joinPath } from '../utils/path'
import { useProjectStore } from '../store/projectStore'
import { useModStore } from '../store/modStore'
import { useIdeStore } from '../store/ideStore'
import { useBuildStore } from '../store/buildStore'
import { ModListItem } from '../components/ModListItem'
import { ModDetailPane } from '../components/ModDetailPane'
import { NewModModal } from '../components/NewModModal'
import { NewBehaviourModal } from '../components/NewBehaviourModal'
import { BuildingPane } from '../components/BuildingPane'
import { ModDepsGraphModal } from '../components/ModDepsGraphModal'

/**
 * Workspace 主面板:绑定工程后的核心视图。
 * 对应 mockup `.claude/svg/modforge-workspace.svg`。
 */
export function WorkspaceView() {
  const bound = useProjectStore((s) => s.bound)
  const unbind = useProjectStore((s) => s.unbind)

  const snapshot = useModStore((s) => s.snapshot)
  const selectedModId = useModStore((s) => s.selectedModId)
  const scanning = useModStore((s) => s.scanning)
  const scan = useModStore((s) => s.scan)
  const selectMod = useModStore((s) => s.selectMod)
  const getSelectedMod = useModStore((s) => s.getSelectedMod)
  const getUsedBy = useModStore((s) => s.getUsedBy)

  const ideDetect = useIdeStore((s) => s.detect)
  const ideLaunchTarget = useIdeStore((s) => s.launchTarget)
  const activeIde = useIdeStore((s) => s.resolveActiveIde())

  const [isNewModOpen, setIsNewModOpen] = useState(false)
  const [isNewBehaviourOpen, setIsNewBehaviourOpen] = useState(false)
  const [isDepsGraphOpen, setIsDepsGraphOpen] = useState(false)

  const buildTask = useBuildStore((s) => s.task)
  const startBuild = useBuildStore((s) => s.startBuild)
  const isBuilding = buildTask?.status === 'running'

  // 绑定工程切换 → 自动扫 Mod;首次进入 → 扫 IDE
  useEffect(() => {
    if (bound?.path) scan(bound.path)
  }, [bound?.path, scan])

  useEffect(() => {
    ideDetect()
  }, [ideDetect])

  // 按拓扑序排列 Mod 列表(被依赖在前)
  const orderedMods = useMemo(() => {
    if (!snapshot) return []
    if (snapshot.topologyOrder.length === 0) return snapshot.mods
    const ordered = snapshot.topologyOrder
      .map((id) => snapshot.mods.find((m) => m.manifest?.id === id))
      .filter((m): m is NonNullable<typeof m> => !!m)
    // 把 manifest 错误的 Mod 追加到末尾
    const errored = snapshot.mods.filter((m) => !m.manifest)
    return [...ordered, ...errored]
  }, [snapshot])

  const selectedMod = getSelectedMod()
  const usedBy = selectedModId ? getUsedBy(selectedModId) : []
  const totalBehaviours = snapshot?.mods.reduce((sum, m) => sum + m.behaviours.length, 0) ?? 0
  const hasError = snapshot?.hasError ?? false

  if (!bound) return null

  return (
    <div className="h-full flex flex-col bg-bg-base">
      {/* ===== Title bar ===== */}
      <div className="h-10 bg-bg-titlebar border-b border-border-subtle flex items-center px-5 shrink-0">
        <div className="w-4 h-4 bg-brand-gradient rotate-45 rounded-sm" />
        <span className="ml-4 text-xs font-bold tracking-wider">ModForge</span>
        <span className="ml-3 text-xs text-fg-mute">
          · {bound.name}
          {selectedMod?.manifest && <span> › {selectedMod.manifest.name}</span>}
        </span>
      </div>

      {/* ===== Breadcrumb ===== */}
      <div className="h-[68px] mx-3.5 mt-3.5 bg-panel-gradient border border-border-frame rounded-xl flex items-center px-5 shrink-0">
        <div className="w-9 h-9 bg-bg-input border-[1.5px] border-brand-base rounded-lg grid place-items-center text-base font-extrabold text-brand-base">
          {bound.name.charAt(0).toUpperCase()}
        </div>
        <div className="ml-4 flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold tracking-wide">{bound.name}</span>
            <span className="px-1.5 h-4 inline-flex items-center text-3xs font-bold text-brand-bright bg-brand-base/20 rounded">
              当前绑定工程
            </span>
          </div>
          <div className="text-3xs font-mono text-fg-muteBright truncate mt-1">
            {bound.path} · {snapshot ? `${snapshot.mods.length} Mod · ${totalBehaviours} Behaviour` : '扫描中…'}
            {snapshot && snapshot.topologyOrder.length > 0 && ` · 拓扑序就绪`}
            {hasError && <span className="text-status-danger"> · ⚠ 含错误</span>}
          </div>
        </div>
        <button
          onClick={() => setIsDepsGraphOpen(true)}
          disabled={!snapshot || snapshot.mods.length === 0}
          className="h-8 px-3 rounded-lg text-2xs font-bold text-brand-base bg-brand-base/10 border border-brand-base/40 hover:bg-brand-base/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          🔗 查看依赖图
        </button>
        <button onClick={unbind} className="btn-ghost h-8 px-3 ml-2 rounded-lg text-2xs">
          🔄 切换工程
        </button>
        <button className="btn-ghost h-8 px-3 ml-2 rounded-lg text-2xs" title="设置">
          ⚙ 设置
        </button>
      </div>

      {/* ===== Body 双栏 ===== */}
      <div className="flex-1 min-h-0 m-3.5 mt-3 flex gap-3 overflow-hidden">
        {/* 左侧 Mod 列表 */}
        <aside className="w-72 bg-panel-gradient border border-border-frame rounded-xl flex flex-col overflow-hidden shrink-0">
          <div className="p-4 pb-3">
            <div className="flex items-center mb-3">
              <span className="block w-1 h-3.5 bg-brand-base" />
              <span className="ml-3 text-xs font-bold tracking-widest">MOD 列表</span>
              <span className="ml-auto text-2xs text-fg-muteBright">
                {snapshot ? `${snapshot.mods.length} Mod` : '...'}
              </span>
            </div>
            <button onClick={() => setIsNewModOpen(true)} className="btn-primary w-full h-9 rounded-lg text-sm">
              ＋ 新建 Mod
            </button>
          </div>

          <div className="border-t border-border-subtle px-4 py-3">
            <div className="text-3xs text-fg-muteBright">按拓扑序排列(顶层→应用层)</div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2.5">
            {scanning && <div className="text-center text-fg-mute text-2xs py-8">扫描中…</div>}
            {!scanning && orderedMods.length === 0 && (
              <div className="card p-6 text-center text-fg-mute text-2xs">
                工程下尚无 Mod
                <div className="mt-2 text-3xs text-fg-muteDim">
                  点击「＋ 新建 Mod」开始
                </div>
              </div>
            )}
            {!scanning &&
              orderedMods.map((mod) => {
                const id = mod.manifest?.id ?? mod.modDir
                const idx = mod.manifest ? snapshot!.topologyOrder.indexOf(id) : -1
                const total = snapshot!.topologyOrder.length
                let layer: 'base' | 'mid' | 'app' | undefined
                if (idx >= 0 && total > 0) {
                  if (idx === 0) layer = 'base'
                  else if (idx === total - 1 && total > 1) layer = 'app'
                  else layer = 'mid'
                }
                return (
                  <ModListItem
                    key={id}
                    mod={mod}
                    selected={selectedModId === mod.manifest?.id}
                    layer={layer}
                    onClick={() => mod.manifest && selectMod(mod.manifest.id)}
                  />
                )
              })}
          </div>
        </aside>

        {/* 右侧 详情 */}
        <main className="flex-1 bg-panel-gradient border border-border-frame rounded-xl overflow-hidden">
          {!snapshot || scanning ? (
            <div className="h-full grid place-items-center text-fg-mute text-2xs">
              {scanning ? '扫描中…' : '加载中…'}
            </div>
          ) : isBuilding && selectedMod && buildTask ? (
            <BuildingPane task={buildTask} selectedMod={selectedMod} allMods={snapshot.mods} />
          ) : selectedMod ? (
            <ModDetailPane
              mod={selectedMod}
              snapshot={snapshot}
              usedBy={usedBy}
              activeIdeName={activeIde?.name ?? null}
              onOpenInIde={() => {
                if (!selectedMod) return
                const slnPath = joinPath(selectedMod.modDirPath, 'src')
                ideLaunchTarget(slnPath)
              }}
              onBuild={() => {
                if (bound && selectedMod?.manifest) {
                  startBuild(bound.path, selectedMod.manifest.id)
                }
              }}
              onOpenFolder={() => {
                if (selectedMod) window.api.ide.openFolder(selectedMod.modDirPath)
              }}
              onNewBehaviour={() => setIsNewBehaviourOpen(true)}
            />
          ) : (
            <div className="h-full grid place-items-center text-fg-mute text-2xs">
              {snapshot.mods.length === 0 ? '工程下无 Mod' : '左侧选择一个 Mod 查看详情'}
            </div>
          )}
        </main>
      </div>

      {isDepsGraphOpen && snapshot && (
        <ModDepsGraphModal
          snapshot={snapshot}
          onClose={() => setIsDepsGraphOpen(false)}
          onBuildAll={() => {
            // 按图编译 = 用拓扑序最后一个 mod 触发(rootMod = 应用层,会编译所有上游)
            if (bound && snapshot.topologyOrder.length > 0) {
              const root = snapshot.topologyOrder[snapshot.topologyOrder.length - 1]
              setIsDepsGraphOpen(false)
              startBuild(bound.path, root)
            }
          }}
        />
      )}

      {isNewBehaviourOpen && bound && selectedMod && (
        <NewBehaviourModal
          projectPath={bound.path}
          mod={selectedMod}
          onClose={() => setIsNewBehaviourOpen(false)}
          onCreated={async (filePath, openInIde) => {
            setIsNewBehaviourOpen(false)
            await scan(bound.path)
            if (openInIde) ideLaunchTarget(filePath)
          }}
        />
      )}

      {isNewModOpen && bound && snapshot && (
        <NewModModal
          projectPath={bound.path}
          projectName={bound.name}
          existingMods={snapshot.mods}
          onClose={() => setIsNewModOpen(false)}
          onCreated={async (modDirPath, modId, openInIde) => {
            setIsNewModOpen(false)
            // 重扫 + 选中新 Mod
            await scan(bound.path)
            selectMod(modId)
            if (openInIde) {
              const srcDir = joinPath(modDirPath, 'src')
              ideLaunchTarget(srcDir)
            }
          }}
        />
      )}
    </div>
  )
}
