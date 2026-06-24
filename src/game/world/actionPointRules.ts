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
} from "@/game/world/types";
import { resolveNpcSlotBehaviors } from "@/game/world/npcScheduleRules";
import { checkAndUnlockAchievements } from "@/game/world/achievementRules";

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

/** 恢复 AP 到上限 */
function restoreActionPoints(state: EdenWorldState): void {
  state.actionPoints = state.maxActionPoints;
  state.npcActionPoints = state.maxNpcActionPoints;
}

/**
 * 推进到下一时段。
 * - 若当前已是第 12 时段：触发时间失败（神降临），返回 true 表示失败。
 * - 否则：timeSlot++，重算 day/timeOfDay，恢复 AP，清空 actionsThisSlot，
 *   结算 NPC 时段行为，检查成就。
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

  const nextSlot = (state.timeSlot + 1) as TimeSlot;
  state.timeSlot = nextSlot;
  if (nextSlot % 2 === 1) {
    state.timeOfDay = "day";
    state.dayIndex = Math.ceil(nextSlot / 2) as DayIndex;
  } else {
    state.timeOfDay = "night";
    state.dayIndex = (nextSlot / 2) as DayIndex;
  }

  // 恢复 AP 并清空本时段行动
  restoreActionPoints(state);
  resetSlotActions(state);

  // 结算 NPC 时段行为
  const resolutions = resolveNpcSlotBehaviors(state);
  const slotNarrations = resolutions.map((r) => r.narration);

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
