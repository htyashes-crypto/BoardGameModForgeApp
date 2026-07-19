import { useEffect, useState } from 'react'
import { HubView } from './views/HubView'
import { WorkspaceView } from './views/WorkspaceView'
import { UpdateModal } from './components/UpdateModal'
import { useProjectStore } from './store/projectStore'
import { useBuildStore } from './store/buildStore'
import { useUpdateStore } from './store/updateStore'

/**
 * 路由(主题群「Mod 开发环境作为独立引擎」Phase 5 单一模式回退):
 * - 未绑定桌游工程 → Hub 页(选/打开)
 * - 已绑定 → Workspace 主面板
 *
 * 切换工程 = 调 store.unbind() → 回 Hub。
 *
 * 原 mode 一级路由(原主题群 Phase 5 落地)已删除 — 用户已澄清 Player exe 内点 ModForge auto-bind 工程,
 * 不需要二选一模式区分;Mod SDK 路径配置走 SettingsModal(决策 2=B)。
 */
export function App() {
  const bound = useProjectStore((s) => s.bound)
  const hydrate = useProjectStore((s) => s.hydrateFromMain)
  const initBuildSubs = useBuildStore((s) => s.initSubscriptions)
  const initUpdateSubs = useUpdateStore((s) => s.initSubscriptions)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initBuildSubs()
    initUpdateSubs()
    hydrate().then(() => setReady(true))
  }, [hydrate, initBuildSubs, initUpdateSubs])

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center text-fg-mute font-mono text-2xs">
        ModForge initializing...
      </div>
    )
  }

  return (
    <>
      {bound ? <WorkspaceView /> : <HubView />}
      <UpdateModal />
    </>
  )
}
