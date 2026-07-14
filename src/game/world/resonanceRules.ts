// ============================================================
// 第一章园中回响规则层
//
// 职责：
// - 发放 / 使用 / 自动结算回响
// - 管理回响使用历史
// - 校验回响与行动的匹配
//
// 安全规则：
// - 没有 itemCounts[itemId] > 0 不能使用
// - instant 类型立即结算
// - consumable 类型使用后只在下一次匹配行动中生效
// - passive 类型不显示主动使用，获得后自动提供固定收益
// - 回响不能直接设置 worldActions 或 endingId
// ============================================================

import type {
  EdenWorldState,
  EdenNpcId,
  AngelNpcId,
  EdenLocationId,
  ResonanceActionKind,
  ResonanceUseRecord,
  AchievementId,
  DivineAttentionLevel,
} from "@/game/world/types";
import { getItemById } from "@/content/world/items";
import { getEffectiveMaxActionPoints } from "@/game/world/actionPointRules";
import { getFreeMoveRemaining, tryConsumeFreeMove } from "@/game/world/freeActionRules";
import { grantDivineAttention } from "@/game/world/divineAttentionRules";
import { ensureRelation } from "@/game/world/npcRelationRules";
import type { WorldItem } from "@/content/world/items";

const ANGEL_IDS: AngelNpcId[] = ["gabriel", "michael", "lucifer"];

// ---- 旧准备回响结果（兼容旧请求） ----
export type PrepareResonanceResult = {
  allowed: boolean;
  reason?: string;
};

// ---- 回响行动上下文 ----
export type ResonanceActionContext = {
  actionKind: ResonanceActionKind;
  targetNpc?: EdenNpcId;
  locationId?: EdenLocationId;
  playerInput?: string;
};

// ---- 回响效果 ----
export type ResonanceEffect = {
  /** 是否免除本次行动 AP 消耗 */
  freeApCost?: boolean;
  /** 上下文修正（影响心智判定） */
  contextModifier?: {
    /** 额外的愿倾听加成 */
    bonusSerpentTrust?: number;
    /** 额外自我判断加成 */
    bonusSelfJudgement?: number;
    /** 抵消神的注视上升 */
    silentGrassActive?: boolean;
    /** 东之风：下一次低语神的注视上升幅度减半（而非固定 -5） */
    eastWindActive?: boolean;
  };
  /** 回响生效的叙事描述 */
  narration?: string;
};

type PendingConsumableEffect = EdenWorldState["pendingConsumableEffects"][number];

function matchesAction(item: WorldItem | undefined, actionKind: ResonanceActionKind): boolean {
  if (!item || item.kind !== "consumable") return false;
  return item.bindTargets?.some((target) => {
    if (target === actionKind) return true;
    if (target === "any_npc" && (actionKind === "whisper" || actionKind === "dove_message")) return true;
    return false;
  }) ?? false;
}

function appendUseHistory(
  state: EdenWorldState,
  itemId: string,
  actionKind: ResonanceActionKind,
  result: string,
  targetId?: string,
): void {
  const useRecord: ResonanceUseRecord = {
    timeSlot: state.timeSlot,
    itemId,
    actionKind,
    targetId,
    result,
  };
  state.resonanceUseHistory.push(useRecord);

  if (!state.usedItemIds.includes(itemId)) {
    state.usedItemIds.push(itemId);
  }
  if (!state.actionsThisSlot.usedItemIds.includes(itemId)) {
    state.actionsThisSlot.usedItemIds.push(itemId);
  }
}

function maybeGrantSoftWhisperPassive(state: EdenWorldState): void {
  if (state.inventory.includes("passive_soft_whisper")) return;

  const activeUses = state.resonanceUseHistory.filter((record) => {
    const item = getItemById(record.itemId);
    return item?.kind === "consumable";
  });

  if (activeUses.length >= 3) {
    grantResonance(state, "passive_soft_whisper", 1);
  }
}

function buildConsumableEffect(itemId: string, item: WorldItem): PendingConsumableEffect {
  const effect: PendingConsumableEffect = {
    itemId,
    narration: item.description,
    bonusSerpentTrust: 0,
    bonusSelfJudgement: 0,
    bonusObedience: 0,
    freeApCost: false,
    silentGrassActive: false,
  };

  if (itemId === "resonance_borrowed_name") {
    effect.bonusSerpentTrust = 3;
  } else if (itemId === "resonance_hedgehog_bristle") {
    effect.freeApCost = true;
  } else if (itemId === "resonance_still_leaf") {
    effect.bonusSerpentTrust = 5;
  } else if (itemId === "resonance_silent_grass") {
    effect.silentGrassActive = true;
  } else if (itemId === "resonance_herald_feather") {
    effect.bonusSerpentTrust = 4;
    effect.bonusObedience = -3;
  } else if (itemId === "resonance_east_wind") {
    effect.eastWindActive = true;
  } else if (itemId === "resonance_lucifer_star") {
    effect.bonusSelfJudgement = 8;
    effect.luciferStarActive = true;
  } else if (itemId === "consumable_trust_dew") {
    effect.bonusSerpentTrust = 8;
  } else if (itemId === "consumable_gentle_voice") {
    effect.silentGrassActive = true;
    effect.bonusSerpentTrust = 3;
  } else if (itemId === "resonance_quiet_stone") {
    effect.bonusSerpentTrust = 8;
  }

  return effect;
}

function consumePendingForAction(
  state: EdenWorldState,
  actionKind: ResonanceActionKind,
): { effects: PendingConsumableEffect[]; narrations: string[] } {
  const matched: PendingConsumableEffect[] = [];
  const remaining: PendingConsumableEffect[] = [];

  for (const effect of state.pendingConsumableEffects ?? []) {
    const item = getItemById(effect.itemId);
    if (matchesAction(item, actionKind)) {
      matched.push(effect);
    } else {
      remaining.push(effect);
    }
  }

  state.pendingConsumableEffects = remaining;

  const narrations = matched
    .map((effect) => effect.narration)
    .filter((n): n is string => Boolean(n));

  return { effects: matched, narrations };
}

// ---- 发放回响 ----
export function grantResonance(
  state: EdenWorldState,
  itemId: string,
  count = 1,
): boolean {
  const item = getItemById(itemId);
  if (!item) return false;

  // 确保 itemCounts 已初始化（兼容旧状态）
  if (!state.itemCounts) {
    state.itemCounts = {};
  }

  // 检查是否已拥有（不可重复且已拥有）
  if (!item.repeatable && state.inventory.includes(itemId)) {
    return false;
  }

  // 增加次数
  state.itemCounts[itemId] = (state.itemCounts[itemId] ?? 0) + count;

  // 首次获得时加入 inventory
  if (!state.inventory.includes(itemId)) {
    state.inventory.push(itemId);
  }

  // §4.1 第三层被动累积：每获得一个回响（非神明献礼、非被动印记），神的注视 +5（十倍刻度）
  // 主题"在园中积累越多，越被注视"——统一经 grantDivineAttention 单一入口结算。
  if (!itemId.startsWith("gift_") && !itemId.startsWith("passive_")) {
    grantDivineAttention(state, {
      amount: 5,
      source: "item",
      isHighRisk: false,
    });
  }

  return true;
}

// ---- 旧准备回响入口（兼容旧请求） ----
export function prepareResonance(
  state: EdenWorldState,
  itemId: string,
): PrepareResonanceResult {
  // 准备机制已废弃：保留入口只为兼容旧前端/旧存档。
  if (state.isEnded) {
    return { allowed: false, reason: "园中已归于寂静" };
  }
  state.preparedResonanceId = null;
  return { allowed: false, reason: "回响现在无需准备，请直接使用。" };
}

// ---- 旧取消准备入口（兼容旧请求） ----
export function cancelPreparedResonance(state: EdenWorldState): void {
  state.preparedResonanceId = null;
}

// ---- 兼容旧准备态：不再产生任何效果 ----
export function applyPreparedResonanceToAction(
  state: EdenWorldState,
  context: ResonanceActionContext,
): ResonanceEffect {
  void context;
  state.preparedResonanceId = null;
  return {};
}

// ---- 兼容旧准备态：只清空，不消耗 ----
export function consumePreparedResonanceAfterAction(
  state: EdenWorldState,
  context: ResonanceActionContext,
  result: string,
): void {
  void context;
  void result;
  state.preparedResonanceId = null;
}

// ---- 即时使用回响 ----
export function executeInstantResonance(
  state: EdenWorldState,
  itemId: string,
): { allowed: boolean; narration?: string; reason?: string } {
  // 检查游戏是否已结束
  if (state.isEnded) {
    return { allowed: false, reason: "园中已归于寂静" };
  }

  // 检查是否持有该回响
  if (!state.inventory.includes(itemId)) {
    return { allowed: false, reason: "你没有这段回响" };
  }

  // 检查次数是否 > 0
  if (!state.itemCounts[itemId] || state.itemCounts[itemId] <= 0) {
    return { allowed: false, reason: "这段回响已用完" };
  }

  const item = getItemById(itemId);
  if (!item) {
    return { allowed: false, reason: "未知回响" };
  }

  if (item.kind !== "instant") {
    return {
      allowed: false,
      reason: item.kind === "passive"
        ? "这段回响会自动生效，不需要主动使用"
        : "这段回响会在使用后等待下一次匹配行动生效",
    };
  }

  let narration = item.description;

  // 根据回响 ID 执行效果
  if (itemId === "resonance_river_dew") {
    state.actionPoints = Math.min(getEffectiveMaxActionPoints(state), state.actionPoints + 1);
    narration = `${item.description} 你恢复了 1 点行动点。`;
  } else if (itemId === "resonance_four_river_echo") {
    narration = `${item.description} 这段回声会留到结局复盘中，让因果链更清楚。`;
  } else if (itemId === "resonance_water_echo_attract") {
    // 引目：与仰光之痕（固定 +10 注视）差异化定位为"清水回涌"，恢复 1 点行动点。
    state.actionPoints = Math.min(getEffectiveMaxActionPoints(state), state.actionPoints + 1);
    narration = `${item.description} 一道清流回涌，你恢复了 1 点行动点。`;
  } else if (itemId === "resonance_uplight_mark") {
    // 仰光之痕：十倍刻度下主动引动一道注视（+10），解锁"园中律则·scene_uplight"。
    grantDivineAttention(state, {
      amount: 10,
      ruleId: "scene_uplight",
      source: "item",
      isHighRisk: false,
    });
    narration = `${item.description} 那道目光随之攀高了一截（神明注视 +10）。`;
  }

  // 消耗次数
  if (state.itemCounts[itemId] && state.itemCounts[itemId] > 0) {
    state.itemCounts[itemId] -= 1;
  }

  appendUseHistory(state, itemId, "instant", `即时使用了 ${item.title}`);

  return {
    allowed: true,
    narration,
  };
}

// ---- 使用消耗品回响（consumable 类型） ----
export function executeConsumableResonance(
  state: EdenWorldState,
  itemId: string,
): { allowed: boolean; narration?: string; reason?: string } {
  // 检查游戏是否已结束
  if (state.isEnded) {
    return { allowed: false, reason: "园中已归于寂静" };
  }

  // 检查是否持有该回响
  if (!state.inventory.includes(itemId)) {
    return { allowed: false, reason: "你没有这段回响" };
  }

  // 检查次数是否 > 0
  if (!state.itemCounts[itemId] || state.itemCounts[itemId] <= 0) {
    return { allowed: false, reason: "这段回响已用完" };
  }

  const item = getItemById(itemId);
  if (!item) {
    return { allowed: false, reason: "未知回响" };
  }

  // 必须是 consumable 类型
  if (item.kind !== "consumable") {
    return { allowed: false, reason: "这段回响不能作为消耗品使用" };
  }

  // [Task 4 Step 3] 边界之痕：不进入待生效池，激活后由下次回响结算揭示未来三次注视走向
  if (itemId === "resonance_boundary_mark") {
    if (state.itemCounts[itemId] && state.itemCounts[itemId] > 0) {
      state.itemCounts[itemId] -= 1;
    }
    state.boundaryMarkForecastActive = true;
    appendUseHistory(state, itemId, "instant", `激活了 ${item.title}`);
    maybeGrantSoftWhisperPassive(state);
    return {
      allowed: true,
      narration: `你拂过「${item.title}」。边界在掌心震颤——未来三次注视的走向此刻浮现于你眼前。`,
    };
  }

  // 消耗次数
  if (state.itemCounts[itemId] && state.itemCounts[itemId] > 0) {
    state.itemCounts[itemId] -= 1;
  }

  const effect = buildConsumableEffect(itemId, item);
  state.pendingConsumableEffects.push(effect);

  appendUseHistory(state, itemId, "instant", `激活了 ${item.title}`);
  maybeGrantSoftWhisperPassive(state);

  return {
    allowed: true,
    narration: `你使用了「${item.title}」。${item.description} 它将在下一次匹配行动时生效。`,
  };
}

// ---- 边界之痕：预示未来三次注视变化（Task 4 Step 3） ----
// 仅基于确定性的"每时段一次 +5"来源（白天首次付费移动 / 夜晚首次付费成功对话），
// 按当前时段起向后枚举，最多返回 count 条。不依赖玩家未知的未来选择，安全可展示。
export type AttentionForecastEntry = {
  slot: number;
  timeOfDay: "day" | "night";
  ruleId: "paid_day_move" | "paid_night_dialogue";
  amount: number;
  note: string;
};

export function predictNextAttentionChanges(
  state: EdenWorldState,
  count = 3,
): AttentionForecastEntry[] {
  const out: AttentionForecastEntry[] = [];
  let slot = state.timeSlot;
  while (out.length < count && slot <= 12) {
    const isNight = slot % 2 === 0;
    if (isNight) {
      const already =
        slot === state.timeSlot &&
        state.actionsThisSlot.hasGrantedPaidNightDialogueAttention;
      if (!already) {
        out.push({
          slot,
          timeOfDay: "night",
          ruleId: "paid_night_dialogue",
          amount: 5,
          note: "夜晚首次付费成功对话",
        });
      }
    } else {
      const already =
        slot === state.timeSlot &&
        state.actionsThisSlot.hasGrantedPaidDayMoveAttention;
      if (!already) {
        out.push({
          slot,
          timeOfDay: "day",
          ruleId: "paid_day_move",
          amount: 5,
          note: "白天首次付费移动",
        });
      }
    }
    slot += 1;
  }
  return out.slice(0, count);
}

// ---- 应用待生效的消耗品效果到低语（聚合所有待生效效果） ----
export function applyPendingConsumableToWhisper(
  state: EdenWorldState,
): {
  bonusSerpentTrust: number;
  bonusSelfJudgement: number;
  bonusObedience: number;
  silentGrassActive: boolean;
  eastWindActive: boolean;
  luciferStarActive: boolean;
  narrations: string[];
} {
  const { effects, narrations } = consumePendingForAction(state, "whisper");
  if (effects.length === 0) {
    return {
      bonusSerpentTrust: 0,
      bonusSelfJudgement: 0,
      bonusObedience: 0,
      silentGrassActive: false,
      eastWindActive: false,
      luciferStarActive: false,
      narrations: [],
    };
  }

  const giftDouble = state.inventory.includes("gift_resonance_double") ? 2 : 1;
  let bonusSerpentTrust = 0;
  let bonusSelfJudgement = 0;
  let bonusObedience = 0;
  let silentGrassActive = false;
  let eastWindActive = false;
  let luciferStarActive = false;

  for (const e of effects) {
    bonusSerpentTrust += (e.bonusSerpentTrust ?? 0) * giftDouble;
    bonusSelfJudgement += (e.bonusSelfJudgement ?? 0) * giftDouble;
    bonusObedience += (e.bonusObedience ?? 0) * giftDouble;
    if (e.silentGrassActive) silentGrassActive = true;
    if (e.eastWindActive) eastWindActive = true;
    if (e.luciferStarActive) luciferStarActive = true;
  }

  return {
    bonusSerpentTrust,
    bonusSelfJudgement,
    bonusObedience,
    silentGrassActive,
    eastWindActive,
    luciferStarActive,
    narrations,
  };
}

// ---- 应用待生效的消耗品效果到移动（免除AP等） ----
export function applyPendingConsumableToMove(
  state: EdenWorldState,
): { freeApCost: boolean; narrations: string[] } {
  const { effects, narrations } = consumePendingForAction(state, "move");
  let freeApCost = false;

  for (const e of effects) {
    if (e.freeApCost) {
      freeApCost = true;
    }
  }

  return { freeApCost, narrations };
}

// ---- 应用待生效的消耗品效果到场景互动 ----
export function applyPendingConsumableToSceneAction(
  state: EdenWorldState,
): { freeApCost: boolean; silentGrassActive: boolean; narrations: string[] } {
  const { effects, narrations } = consumePendingForAction(state, "scene_action");
  let freeApCost = false;
  let silentGrassActive = false;

  for (const e of effects) {
    if (e.freeApCost) freeApCost = true;
    if (e.silentGrassActive) silentGrassActive = true;
  }

  return { freeApCost, silentGrassActive, narrations };
}

// ---- 应用待生效的消耗品效果到鸽子传话 ----
export function applyPendingConsumableToDoveMessage(
  state: EdenWorldState,
): { bonusSerpentTrust: number; silentGrassActive: boolean; narrations: string[] } {
  const { effects, narrations } = consumePendingForAction(state, "dove_message");
  const giftDouble = state.inventory.includes("gift_resonance_double") ? 2 : 1;
  let bonusSerpentTrust = 0;
  let silentGrassActive = false;

  for (const e of effects) {
    bonusSerpentTrust += (e.bonusSerpentTrust ?? 0) * giftDouble;
    if (e.silentGrassActive) silentGrassActive = true;
  }

  if (bonusSerpentTrust !== 0) {
    // 对蛇信任不钳制，可正可负（可突破 100，也可为负）
    state.eveMind.serpentTrust = state.eveMind.serpentTrust + bonusSerpentTrust;
  }

  return { bonusSerpentTrust, silentGrassActive, narrations };
}

export function hasPendingFreeApForAction(
  state: EdenWorldState,
  actionKind: ResonanceActionKind,
): boolean {
  return (state.pendingConsumableEffects ?? []).some((effect) => {
    if (!effect.freeApCost) return false;
    return matchesAction(getItemById(effect.itemId), actionKind);
  });
}

export function hasPassiveLightStepForMove(state: EdenWorldState): boolean {
  return state.inventory.includes("passive_light_step") &&
    !state.actionsThisSlot.usedItemIds.includes("passive_light_step");
}

export function applyPassiveLightStepToMove(state: EdenWorldState): { freeApCost: boolean; narration?: string } {
  if (!state.inventory.includes("passive_light_step")) {
    return { freeApCost: false };
  }
  // 轻步印记与统一免费次数池共享：每时段最多 1 次免费移动（Task 4 Step 3）
  if (getFreeMoveRemaining(state) <= 0) {
    return { freeApCost: false };
  }
  tryConsumeFreeMove(state); // 消耗共享免费次数（与无羁之步等合并为每时段 1 次）

  return {
    freeApCost: true,
    narration: "轻步印记让你的第一次移动落在草叶上，没有消耗行动点。",
  };
}

export function applyPassiveSoftWhisperToAttention(
  state: EdenWorldState,
  attentionDelta: number,
): { attentionDelta: number; narration?: string } {
  if (
    attentionDelta <= 0 ||
    !state.inventory.includes("passive_soft_whisper") ||
    state.actionsThisSlot.usedItemIds.includes("passive_soft_whisper")
  ) {
    return { attentionDelta };
  }

  state.actionsThisSlot.usedItemIds.push("passive_soft_whisper");
  appendUseHistory(state, "passive_soft_whisper", "whisper", "细语印记压低了本时段第一次轻微升起的神的注视");

  return {
    attentionDelta: Math.max(0, attentionDelta - 5),
    narration: "细语印记让这句低语更轻，神的注视被压低了一截。",
  };
}

// ---- 换时段时清理旧准备态 ----
export function cancelPreparedResonanceOnSlotAdvance(
  state: EdenWorldState,
): void {
  if (state.preparedResonanceId) {
    state.preparedResonanceId = null;
  }
}

// ---- 赐予回响（条件满足时由规则层调用） ----
export function bestowResonance(
  state: EdenWorldState,
  sourceNpcId: EdenNpcId,
  itemId: string,
): { granted: boolean; narration?: string; reason?: string } {
  const item = getItemById(itemId);
  if (!item) return { granted: false, reason: "未知回响" };

  // 检查是否已拥有（不可重复道具）
  if (!item.repeatable && state.inventory.includes(itemId)) {
    return { granted: false, reason: "这段回响已在你身边" };
  }

  // 发放回响
  const granted = grantResonance(state, itemId, 1);
  if (!granted) return { granted: false, reason: "发放失败" };

  // 首次获得时解锁对应印记
  if (item.achievementId && !state.unlockedAchievementIds.includes(item.achievementId as AchievementId)) {
    state.unlockedAchievementIds.push(item.achievementId as AchievementId);
  }

  return {
    granted: true,
    narration: `你获得了一段回响：${item.title}。`,
  };
}

// ---- 传令残羽（Task 4 Step 2）：只可在下一次天使对话中抛出 ----
// 对目标天使降低顺服、抬升本阶注视；对象不合法、已到下限或没有残羽时不消耗。
const ANGEL_FEATHER_EFFECTS: Record<AngelNpcId, { obedienceDelta: number; attentionDelta: number }> = {
  lucifer: { obedienceDelta: -8, attentionDelta: 10 },
  gabriel: { obedienceDelta: -5, attentionDelta: 20 },
  michael: { obedienceDelta: -2, attentionDelta: 20 },
};

export type AngelFeatherResult = {
  applied: boolean;
  narration?: string;
  reason?: string;
  attentionDelta?: number;
  obedienceDelta?: number;
};

export function consumeAngelFeather(
  state: EdenWorldState,
  angelId: EdenNpcId,
): AngelFeatherResult {
  if (!state.inventory.includes("resonance_angel_feather")) {
    return { applied: false, reason: "没有传令残羽" };
  }
  if (!ANGEL_IDS.includes(angelId as AngelNpcId)) {
    return { applied: false, reason: "对象不合法：传令残羽只对天使生效" };
  }
  const cfg = ANGEL_FEATHER_EFFECTS[angelId as AngelNpcId];
  const rel = ensureRelation(state, angelId);
  // 已到下限不消耗
  if (rel.obedience <= 0) {
    return { applied: false, reason: "对方顺服已到下限，残羽未能落下" };
  }
  // 消耗道具
  state.inventory = state.inventory.filter((id) => id !== "resonance_angel_feather");
  state.usedItemIds = [...(state.usedItemIds ?? []), "resonance_angel_feather"];
  // 顺服降低（下限 0）
  const before = rel.obedience;
  rel.obedience = Math.max(0, rel.obedience + cfg.obedienceDelta);
  const realObedienceDelta = rel.obedience - before;
  // 本阶注视提升（经单一入口）
  grantDivineAttention(state, {
    amount: cfg.attentionDelta,
    ruleId: "angel_feather",
    source: "dialogue",
    isHighRisk: true,
  });
  appendUseHistory(state, "resonance_angel_feather", "whisper", `传令残羽落在${angelId}身上，顺服${realObedienceDelta}，注视+${cfg.attentionDelta}`);
  return {
    applied: true,
    narration: `你将传令残羽抛向${angelId}。那道命令由他亲耳听见——他的顺服松动了，一道注视随之攀起。`,
    attentionDelta: cfg.attentionDelta,
    obedienceDelta: realObedienceDelta,
  };
}
