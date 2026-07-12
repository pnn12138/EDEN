// ============================================================
// 第一章行动点系统规则层
//
// 职责：
// - 校验 AP 是否足够
// - 消耗 AP（移动 / 低语 / 场景互动 / 主动信物）
// - 记录本时段行动（同一时段同一 NPC 最多低语 3 次）
// - 时段推进：仅玩家主动调用 end_slot 时推进
// - 新时段恢复 AP 并清空 actionsThisSlot
//
// 安全规则：
// - 前端不得直接改 AP 或推进时段，必须由规则层/API 返回新状态
// - 第 12 时段结束仍未吃果 → 失败结局
// ============================================================

import type {
  EdenWorldState,
  EdenNpcId,
  TimeSlot,
  DayIndex,
  DivineAttentionLevel,
} from "@/game/world/types";
import { resolveNpcSlotBehaviors } from "@/game/world/npcScheduleRules";
import { checkAndUnlockAchievements } from "@/game/world/achievementRules";
import { grantResonance } from "@/game/world/resonanceRules";

export const AP_COST_WHISPER = 1;
export const AP_COST_MOVE = 1;
export const AP_COST_SCENE_ACTION = 1;

/** 每轮同一 NPC 最多成功对话次数 */
export const MAX_WHISPER_PER_NPC_PER_SLOT = 3;

/** 校验是否有足够 AP */
export function canAffordAction(state: EdenWorldState, cost: number): boolean {
  return state.actionPoints >= cost && !state.isEnded;
}

/** 消耗 AP（不推进时段） */
export function consumeActionPoints(state: EdenWorldState, cost: number): void {
  state.actionPoints = Math.max(0, state.actionPoints - cost);
}

/** 有效行动点上限 = 基础上限 + 全时段加成 + 当前时段加成（白天才计白天加成） */
export function getEffectiveMaxActionPoints(state: EdenWorldState): number {
  const base = state.maxActionPoints ?? 5;
  const bonusAll = state.apMaxBonusBase ?? 0;
  const bonusDay = state.timeOfDay === "day" ? (state.apMaxBonusDay ?? 0) : 0;
  return base + bonusAll + bonusDay;
}

/** 本时段是否已对该 NPC 低语达到上限 */
export function hasWhisperedToNpcThisSlot(state: EdenWorldState, npcId: EdenNpcId): boolean {
  const count = state.actionsThisSlot.whisperedNpcIds.filter((id) => id === npcId).length;
  return count >= MAX_WHISPER_PER_NPC_PER_SLOT;
}

/** 本时段已对该 NPC 低语的次数 */
export function getWhisperCountThisSlot(state: EdenWorldState, npcId: EdenNpcId): number {
  return state.actionsThisSlot.whisperedNpcIds.filter((id) => id === npcId).length;
}

/** 记录本时段低语 */
export function recordWhisperThisSlot(state: EdenWorldState, npcId: EdenNpcId): void {
  state.actionsThisSlot.whisperedNpcIds.push(npcId);
  if (npcId === "eve") {
    state.actionsThisSlot.hasWhisperedToWoman = true;
  }
}

/** 记录本时段场景互动 */
export function recordSceneActionThisSlot(state: EdenWorldState, actionId: string): void {
  if (!state.actionsThisSlot.sceneActionIds.includes(actionId)) {
    state.actionsThisSlot.sceneActionIds.push(actionId);
  }
  if (!state.sceneActionIds.includes(actionId)) {
    state.sceneActionIds.push(actionId);
  }
}

/** 记录本时段信物使用 */
export function recordItemUseThisSlot(state: EdenWorldState, itemId: string): void {
  if (!state.actionsThisSlot.usedItemIds.includes(itemId)) {
    state.actionsThisSlot.usedItemIds.push(itemId);
  }
}

/** 重置本时段行动记录 */
function resetSlotActions(state: EdenWorldState): void {
  state.actionsThisSlot = {
    whisperedNpcIds: [],
    sceneActionIds: [],
    usedItemIds: [],
    hasWhisperedToWoman: false,
  };
}

/** 恢复 AP 到有效上限 */
function restoreActionPoints(state: EdenWorldState): void {
  state.actionPoints = getEffectiveMaxActionPoints(state);
  state.npcActionPoints = state.maxNpcActionPoints;
}

/**
 * 推进到下一时段。
 * - 若当前已是第 12 时段：触发时间失败（神降临），返回 true 表示失败。
 * - 否则：timeSlot++，重算 day/timeOfDay，恢复 AP，
 *   先按上一时段 actionsThisSlot 结算 NPC 行为，再清空行动记录，检查成就。
 *
 * 返回新触发的 NPC 结算叙事列表（供 API 返回给前端）。
 */
export function advanceToNextSlot(state: EdenWorldState): {
  slotNarrations: string[];
  triggeredTimeFailure: boolean;
} {
  // 第 12 时段结束仍未吃果 → 失败
  if (state.timeSlot >= 12) {
    state.isEnded = true;
    state.endingId = "god_arrives";
    state.phase = "ending";
    return { slotNarrations: ["第十二个时段过去了。园中起了凉风，那是神行走的声音。"], triggeredTimeFailure: true };
  }

  // 注意：用有效上限（基础 + 全时段加成 + 白天加成）计算本时段花费，
  // 否则拥有 AP 上限加成道具（丰沛/清醒之眼）的玩家会少算花费、错过轻步印记授予。
  const spentThisSlot = Math.max(0, getEffectiveMaxActionPoints(state) - state.actionPoints);
  const passiveNarrations: string[] = [];
  if (spentThisSlot >= 3 && !state.inventory.includes("passive_light_step")) {
    const granted = grantResonance(state, "passive_light_step", 1);
    if (granted) {
      passiveNarrations.push("你在一个时段里穿过多处草叶，园中留下了「轻步印记」。之后每个时段第一次移动不再消耗行动点。");
    }
  }

  const nextSlot = (state.timeSlot + 1) as TimeSlot;
  state.timeSlot = nextSlot;
  if (nextSlot % 2 === 1) {
    state.timeOfDay = "day";
    state.dayIndex = Math.ceil(nextSlot / 2) as DayIndex;
  } else {
    state.timeOfDay = "night";
    state.dayIndex = (nextSlot / 2) as DayIndex;
  }

  // §4.2 注视降低：进入下一时段自然冷却 -1（最低 0）
  // §4.1 第三层：每跨一天（偶数→奇数时段，即进入新的一天）被动累积 +1
  // 净效果：日内 -1 降温；日界 -1+1=0 持平（对齐 INTERACTION_LOGIC §五）
  const isNewDay = nextSlot % 2 === 1 && nextSlot > 1;
  let attentionDelta = -1;
  if (isNewDay) attentionDelta += 1;
  state.divineAttention = Math.max(
    0,
    Math.min(4, state.divineAttention + attentionDelta),
  ) as DivineAttentionLevel;

  // §2.3 第一层：死因内化提示（无感知）
  // 第 6 时段仍未看向禁树：刺猬轻推，不显式说"你卡住了"。
  // 第 9 时段仍未靠近禁树：亚当轻推。提示走园内叙事语言，仅触发一次。
  const deathCauseHints: string[] = [];
  if (state.timeSlot === 6 && !state.worldActions.lookedAtTree) {
    deathCauseHints.push(
      "草叶下的小东西探出头，轻轻嗅了嗅：「她还没真正望向那棵树呢。你是不是还没和她聊够？」",
    );
  }
  if (state.timeSlot === 9 && !state.worldActions.approachedTree) {
    deathCauseHints.push(
      "不远处的亚当望向那棵树的方向，低声说：「她好像总在想那棵树的事。你要不要引她再近一些？」",
    );
  }

  // 恢复 AP，并用上一时段行动记录结算 NPC 行为。
  restoreActionPoints(state);
  const resolutions = resolveNpcSlotBehaviors(state);
  const slotNarrations = [
    ...passiveNarrations,
    ...deathCauseHints,
    ...resolutions.map((r) => r.narration),
  ];

  // NPC 已根据上一时段行动完成结算，现在清空记录，进入新时段。
  resetSlotActions(state);

  // 检查成就
  checkAndUnlockAchievements(state);

  return { slotNarrations, triggeredTimeFailure: false };
}

/**
 * 在一次行动消耗 AP 后调用。
 * 新规则：AP 用尽不再自动推进时段，玩家需主动调用 end_slot 进入下一轮。
 * 仍检查成就解锁。
 */
export function maybeAdvanceSlotAfterAction(state: EdenWorldState): {
  slotNarrations: string[];
  triggeredTimeFailure: boolean;
  slotAdvanced: boolean;
} {
  if (state.isEnded) {
    return { slotNarrations: [], triggeredTimeFailure: false, slotAdvanced: false };
  }
  // AP 用尽不再自动推进，玩家需主动点击"进入下一轮"
  // 仍检查一次成就（场景互动/低语可能解锁印记）
  checkAndUnlockAchievements(state);
  return { slotNarrations: [], triggeredTimeFailure: false, slotAdvanced: false };
}
