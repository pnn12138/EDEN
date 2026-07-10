// ============================================================
// 第一章：NPC 状态提示组件
//
// 非侵入式 UI：在对话面板 NPC 名称下方显示叙事化状态。
// 仅通过读取现有世界状态做展示映射，不修改任何心智计算逻辑，
// 不新增任何 NPC 状态字段。
// ============================================================

import { getNpcStatusHint } from "@/content/world/npcStatusHints";
import type { EdenWorldState, EdenNpcId } from "@/game/world/types";

type NpcStatusHintProps = {
  state: EdenWorldState;
  npcId: EdenNpcId | null;
};

export default function NpcStatusHint({ state, npcId }: NpcStatusHintProps) {
  const lines = getNpcStatusHint(state, npcId);
  if (lines.length === 0) return null;

  return (
    <div className="eden-npc-status-hint" aria-live="polite">
      {lines.map((line, i) => (
        <p key={i} className="eden-npc-status-hint-line">
          {line}
        </p>
      ))}
    </div>
  );
}
