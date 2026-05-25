export type BehaviourTemplateKind = 'empty' | 'tick' | 'subscribe' | 'chain'

export interface BehaviourTemplateInput {
  /** 类名(含 Behaviour 后缀);如 `RollDiceBehaviour`。 */
  className: string
  /** Behaviour Id 全局唯一;如 `hellomod.RollDice`。 */
  behaviourId: string
  /** Inspector 显示名。 */
  displayName: string
  /** Category 路径;如 `Mods/HelloMod/Behaviour`。 */
  category: string
  /** csproj RootNamespace,通常 = modName。 */
  namespace: string
}

/**
 * 4 个起始模板。生成完整 .cs 文件文本(含 using / namespace / class / attribute)。
 * 用法:调 renderBehaviour(kind, input) 取文本,然后写文件。
 */
export function renderBehaviour(kind: BehaviourTemplateKind, input: BehaviourTemplateInput): string {
  switch (kind) {
    case 'empty':
      return renderEmpty(input)
    case 'tick':
      return renderTick(input)
    case 'subscribe':
      return renderSubscribe(input)
    case 'chain':
      return renderChain(input)
  }
}

function renderEmpty(i: BehaviourTemplateInput): string {
  return `using ActFramework.Modding.ModObjects;

namespace ${i.namespace}
{
    /// <summary>
    /// ${i.displayName} — 空 Behaviour 骨架。
    /// </summary>
    [ModObjectBehaviour("${i.behaviourId}",
        DisplayName = "${i.displayName}",
        Category = "${i.category}",
        Description = "TODO: 描述本 Behaviour 的用途。")]
    public class ${i.className} : ModObjectBehaviour
    {
        protected override void OnInitialize()
        {
            // TODO: 初始化逻辑;Subscribe 桌游事件 / 读字段配置等
        }
    }
}
`
}

function renderTick(i: BehaviourTemplateInput): string {
  return `using ActFramework.Modding.ModObjects;
using BoardGameRuntimeAtom;
using UnityEngine;

namespace ${i.namespace}
{
    /// <summary>
    /// ${i.displayName} — Tick 模板:OnUpdate 周期累计 + 周期输出日志。
    /// </summary>
    [ModObjectBehaviour("${i.behaviourId}",
        DisplayName = "${i.displayName}",
        Category = "${i.category}",
        Description = "周期性输出日志,演示 OnUpdate 钩子用法。")]
    public class ${i.className} : ModObjectBehaviour
    {
        [ModObjectVariable(DisplayName = "周期(秒)", Description = "<= 0 表示每帧输出")]
        public float intervalSec = 1.0f;

        private float m_acc;
        private float m_nextTime;

        protected override void OnInitialize()
        {
            m_acc = 0f;
            m_nextTime = intervalSec;
        }

        protected override void OnUpdate()
        {
            m_acc += Time.deltaTime;
            if (m_acc >= m_nextTime)
            {
                BgRichTextOps.WriteGameLog($"[${i.className}] tick at {m_acc:F1}s");
                m_nextTime = m_acc + intervalSec;
            }
        }
    }
}
`
}

function renderSubscribe(i: BehaviourTemplateInput): string {
  return `using ActFramework.Modding.ModObjects;
using BoardGameRuntimeAtom;

namespace ${i.namespace}
{
    /// <summary>
    /// ${i.displayName} — Subscribe 模板:订阅桌游事件并响应。
    /// </summary>
    [ModObjectBehaviour("${i.behaviourId}",
        DisplayName = "${i.displayName}",
        Category = "${i.category}",
        Description = "订阅 OnClickEntity / OnDragStart 等事件并响应。")]
    public class ${i.className} : ModObjectBehaviour
    {
        protected override void OnInitialize()
        {
            Subscribe(BoardGameEventNames.OnClickEntity, args =>
            {
                BgRichTextOps.WriteGameLog($"[${i.className}] OnClickEntity 被触发");
            });

            // 可继续订阅其他事件:
            // Subscribe(BoardGameEventNames.OnDragStart, args => { ... });
            // Subscribe(BoardGameEventNames.OnDragEnd,   args => { ... });
        }
    }
}
`
}

function renderChain(i: BehaviourTemplateInput): string {
  return `using System.Collections.Generic;
using ActFramework.Modding.ModObjects;
using BoardGameRuntimeAtom;

namespace ${i.namespace}
{
    /// <summary>
    /// ${i.displayName} — Chain 模板:订阅事件 → 调 Bg*Ops + 派发全局事件,演示蓝图 ↔ Mod 链式响应。
    /// </summary>
    [ModObjectBehaviour("${i.behaviourId}",
        DisplayName = "${i.displayName}",
        Category = "${i.category}",
        Description = "点击 → 调 Bg*Ops + BgGlobalEventOps.Send,蓝图侧 GlobalEvent/Listen 节点可接收。")]
    public class ${i.className} : ModObjectBehaviour
    {
        [ModObjectVariable(DisplayName = "派发的全局事件名")]
        public string globalEventName = "OnChainTriggered";

        protected override void OnInitialize()
        {
            Subscribe(BoardGameEventNames.OnClickEntity, args =>
            {
                BgRichTextOps.WriteGameLog($"[${i.className}] 触发 → 派发 {globalEventName}");
                BgGlobalEventOps.Send(globalEventName, new Dictionary<string, object>
                {
                    ["sourceId"] = Owner != null ? Owner.GetInstanceID() : 0
                });
            });
        }
    }
}
`
}
