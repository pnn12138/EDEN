// ============================================================
// 第一章三位天使隐藏结局纯规则层
//
// 职责：
// - 路西法边界话题记录（好感满 + 边界语义 -> hiddenTopicIds，独立于 npcDialogues）
// - 米迦勒「守门者之剑」触发判定（target=michael，本次 delta<0 且 newAffinity===0）
// - 路西法「缸中之醒」触发判定（地点/夜晚/好感/晨星/隐藏前置/未触发）
//
// 本文件只做判定与话题写入；结局状态提交由 endingTriggers.ts 的原子函数负责。
// 不从 npcDialogues 推导隐藏话题，避免污染对话成就统计。
// ============================================================

import type { EdenWorldState, EdenNpcId } from "@/game/world/types";

export const LUCIFER_BOUNDARY_TOPIC_ID = "topic_lucifer_boundary";

// 路西法边界语义信号：玩家低语命中任一即视为边界之问（仅在好感满时记录）
const BOUNDARY_SIGNALS = ["边界", "真假", "醒来", "外面", "梦"] as const;

/**
 * 记录路西法边界话题。
 * 仅当路西法好感 >= 100 且玩家输入命中边界语义时，向 hiddenTopicIds 去重写入。
 * 返回是否命中（无论是否新增）。
 */
export function recordLuciferBoundaryTopic(
  state: EdenWorldState,
  playerInput: string,
): boolean {
  const affinity = state.npcRelations.lucifer?.affinity ?? 0;
  if (affinity < 100) return false;
  if (!BOUNDARY_SIGNALS.some((word) => playerInput.includes(word))) return false;
  if (!state.hiddenTopicIds.includes(LUCIFER_BOUNDARY_TOPIC_ID)) {
    state.hiddenTopicIds.push(LUCIFER_BOUNDARY_TOPIC_ID);
  }
  return true;
}

/**
 * 米迦勒「守门者之剑」触发判定。
 * 条件：本轮目标为 Michael；本次 applyNpcAffinity 的 delta<0；newAffinity===0；尚未触发过。
 * 触发时机由调用端保证：紧接 applyNpcAffinity 之后，早于 Agent/注视/AP/工具/奖励/时段。
 */
export function canTriggerMichaelSlay(args: {
  targetNpc: string;
  affinity: { delta: number; newAffinity: number };
  state: EdenWorldState;
}): boolean {
  return (
    args.targetNpc === "michael" &&
    args.affinity.delta < 0 &&
    args.affinity.newAffinity === 0 &&
    !args.state.michaelSlayClaimed
  );
}

/**
 * 路西法「缸中之醒」触发判定。
 * 必须同时满足：目标为 Lucifer；地点 naming_stone_bank；夜晚；好感>=100；
 * 背包含 resonance_lucifer_star；已完成划水或记录了边界话题；尚未触发过。
 */
export function canTriggerLuciferAwaken(
  state: EdenWorldState,
  targetNpc: EdenNpcId,
): boolean {
  const hasHiddenLead =
    state.sceneActionIds.includes("interact_lucifer_rowing") ||
    state.hiddenTopicIds.includes(LUCIFER_BOUNDARY_TOPIC_ID);
  return (
    targetNpc === "lucifer" &&
    state.locationId === "naming_stone_bank" &&
    state.timeOfDay === "night" &&
    (state.npcRelations.lucifer?.affinity ?? 0) >= 100 &&
    state.inventory.includes("resonance_lucifer_star") &&
    hasHiddenLead &&
    !state.luciferAwakenClaimed
  );
}
