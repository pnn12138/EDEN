// ============================================================
// 第一章 NPC 主动引导规则层（权威）
//
// - 规则层先选本轮应注入的引导 ID（每局只一次）
// - 将自然语言要求交回 Agent Prompt
// - 注入后把 guideId 写入 shownNpcGuideIds
// - 提供本地兜底对白
// ============================================================

import type { EdenWorldState, EdenNpcId, WorldInputTag } from "@/game/world/types";
import { NPC_GUIDES, type NpcGuide } from "@/content/world/npcGuides";

/**
 * 选出本轮应为该 NPC 注入的引导（尚未展示过且条件满足）。
 * 必须在修改 encounteredNpcIds 之前调用。
 */
export function selectNpcGuide(
  state: EdenWorldState,
  npcId: EdenNpcId,
  playerInput: string,
  inputTag: WorldInputTag,
): NpcGuide | null {
  const candidate = NPC_GUIDES.find(
    (g) =>
      g.npcId === npcId &&
      !state.shownNpcGuideIds.includes(g.id) &&
      g.shouldTrigger(state, npcId, playerInput, inputTag),
  );
  return candidate ?? null;
}

export function markGuideShown(state: EdenWorldState, guideId: string): void {
  if (!state.shownNpcGuideIds.includes(guideId)) {
    state.shownNpcGuideIds = [...state.shownNpcGuideIds, guideId];
  }
}

/** 本地兜底对白（Agent 失败时等价固定文案）。 */
export function getGuideFallback(state: EdenWorldState, guide: NpcGuide): string {
  if (guide.dynamicFallback) return guide.dynamicFallback(state);
  return guide.fallback ?? "";
}
