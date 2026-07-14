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

/** 基础行动点上限（Task 1：由 5 改为 4） */
export const BASE_MAX_ACTION_POINTS = 4;

/** 本时段同一 NPC 默认最多成功对话次数（旧固定值，仅作兼容参考） */
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
  const base = state.maxActionPoints ?? BASE_MAX_ACTION_POINTS;
  const bonusAll = state.apMaxBonusBase ?? 0;
  const bonusDay = state.timeOfDay === "day" ? (state.apMaxBonusDay ?? 0) : 0;
  return base + bonusAll + bonusDay;
}

/**
 * 读取用于"对话次数/关系后果"的展示好感（规则与 UI 共用同一来源，避免两套口径）。
 * - 女人：serpentTrust
 * - 亚当：反向怀疑（100 - suspicionTowardSerpent）
 * - 天使/刺猬：npcRelations[npcId].affinity
 */
export function getDisplayedAffinity(state: EdenWorldState, npcId: EdenNpcId): number {
  if (npcId === "eve") return state.eveMind.serpentTrust;
  if (npcId === "adam") return Math.max(0, 100 - state.adamMind.suspicionTowardSerpent);
  return state.npcRelations[npcId]?.affinity ?? 0;
}

/**
 * 本时段可成功对话次数（按亲密度动态）：
 * - 好感 ≥ 100 → 3 次
 * - 好感 ≥ 60 → 2 次
 * - 其他 → 1 次
 */
export function getWhisperLimitForNpc(state: EdenWorldState, npcId: EdenNpcId): number {
  const affinity = getDisplayedAffinity(state, npcId);
  if (affinity >= 100) return 3;
  if (affinity >= 60) return 2;
  return 1;
}

/** 本时段是否已对该 NPC 低语达到动态上限 */
export function hasWhisperedToNpcThisSlot(state: EdenWorldState, npcId: EdenNpcId): boolean {
  const count = state.actionsThisSlot.whisperedNpcIds.filter((id) => id === npcId).length;
  return count >= getWhisperLimitForNpc(state, npcId);
}

/**
 * 米迦勒神罚下的移动限制：神罚生效时，本时段只允许第 1 次"成功且消耗 AP"的移动。
 * 失败移动不占次数，由调用方先判定 AP 与可达性后再记录。
 */
export function canMoveToLocationThisSlot(state: EdenWorldState): boolean {
  if (state.michaelDivinePunishmentActive && state.actionsThisSlot.moveCount >= 1) {
    return false;
  }
  return true;
}

/** 移动成功后递增本时段移动计数 */
export function recordMoveThisSlot(state: EdenWorldState): void {
  state.actionsThisSlot.moveCount += 1;
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
    hasGrantedPaidDayMoveAttention: false,
    hasGrantedPaidNightDialogueAttention: false,
    moveCount: 0,
  };
  // 免费次数池：进入新时段清零已用次数（剩余次数自动按持有道具重算）
  state.freeMoveUsedThisSlot = 0;
  state.freeDialogueUsedThisSlot = 0;
  state.freeDetourBypassUsedThisSlot = 0;
  state.morningFlowRestoredThisSlot = false;
  state.nightTideRestoredThisSlot = false;
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

  // [Task 2R] 不再有跨时段自然冷却。divineAttentionValue 只在领取下一份献礼时归零；
  // 跨昼夜、跨天后必须保持不变，否则"白天首次付费移动+5、夜晚首次付费对话+5 在12时段稳定提供60点"
  // 的设计承诺不成立，玩家无法靠常规路线抵达首个44门槛。

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
