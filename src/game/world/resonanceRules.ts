// ============================================================
// 第一章园中回响规则层
//
// 职责：
// - 发放 / 准备 / 绑定 / 消耗回响
// - 管理回响使用历史
// - 校验回响与行动的匹配
//
// 安全规则：
// - 没有 itemCounts[itemId] > 0 不能准备
// - instant 类型不能准备，只能即时使用
// - prepared 类型必须匹配 bindTargets 才会生效
// - 不匹配行动时不消耗道具
// - 换时段时取消 preparedResonanceId，不消耗
// - 回响不能直接设置 worldActions 或 endingId
// ============================================================

import type {
  EdenWorldState,
  EdenNpcId,
  EdenLocationId,
  ResonanceActionKind,
  ResonanceUseRecord,
  AchievementId,
} from "@/game/world/types";
import { getItemById } from "@/content/world/items";
import type { WorldItem, ResonanceBindTarget } from "@/content/world/items";

// ---- 准备回响结果 ----
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
  };
  /** 回响生效的叙事描述 */
  narration?: string;
};

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

  return true;
}

// ---- 准备回响 ----
export function prepareResonance(
  state: EdenWorldState,
  itemId: string,
): PrepareResonanceResult {
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

  // instant 类型不能准备
  if (item.kind === "instant") {
    return { allowed: false, reason: "这段回响只能即时使用，不能准备" };
  }

  // 设置准备中的回响
  state.preparedResonanceId = itemId;
  return { allowed: true };
}

// ---- 取消准备 ----
export function cancelPreparedResonance(state: EdenWorldState): void {
  state.preparedResonanceId = null;
}

// ---- 应用准备的回响到行动 —— 同时支持 prepared 和 consumable 类型 ----
export function applyPreparedResonanceToAction(
  state: EdenWorldState,
  context: ResonanceActionContext,
): ResonanceEffect {
  // 没有准备的回响
  if (!state.preparedResonanceId) {
    return {};
  }

  const itemId = state.preparedResonanceId;
  const item = getItemById(itemId);

  // consumable 类型也可以准备并应用
  if (!item || (item.kind !== "prepared" && item.kind !== "consumable")) {
    // 不是可准备类型，取消准备
    state.preparedResonanceId = null;
    return {};
  }

  // 检查是否匹配 bindTargets
  const matchesTarget = item.bindTargets?.includes(
    context.actionKind as unknown as ResonanceBindTarget,
  );

  if (!matchesTarget) {
    // 不匹配，不生效，不消耗
    return {};
  }

  // 匹配，返回效果
  const effect: ResonanceEffect = {};

  // 根据回响 ID 决定效果
  if (itemId === "resonance_morning_flame") {
    // 晨焰碎片：用于低语，提高自我判断
    effect.contextModifier = { bonusSelfJudgement: 4 };
    effect.narration = "晨焰的微光织入你的低语，让她心中的判断之火更明亮。";
  } else if (itemId === "resonance_borrowed_name") {
    // 借来的名字：用于低语，提高愿倾听
    effect.contextModifier = { bonusSerpentTrust: 4 };
    effect.narration = "那个名字像一把钥匙，轻轻转动了她心中的锁。";
  } else if (itemId === "resonance_east_gate_glow") {
    // 东门辉光：用于移动，免除 AP 消耗
    effect.freeApCost = true;
    effect.narration = "东门的辉光笼罩着你，这条路变得异常轻盈。";
  } else if (itemId === "resonance_silent_grass") {
    // 无声草：用于场景互动，免除 AP 消耗
    effect.freeApCost = true;
    effect.contextModifier = { silentGrassActive: true };
    effect.narration = "无声草在你脚下蔓延，连风都放轻了脚步。";
  } else if (itemId === "resonance_still_leaf") {
    // 静息之叶：用于低语，提高愿倾听
    effect.contextModifier = { bonusSerpentTrust: 5 };
    effect.narration = "静息之叶的露水沾在你的声音上，让它变得柔和。";
  } else if (itemId === "resonance_hedgehog_bristle") {
    // 刺草信任：用于低语，温和提高信任
    effect.contextModifier = { bonusSerpentTrust: 3 };
    effect.narration = "刺草的细软触感压低了你的声音，像草丛里安全的呼吸。";
  } else if (itemId === "resonance_deer_glance") {
    // 鹿目余光：用于低语，强化自我判断
    effect.contextModifier = { bonusSelfJudgement: 3 };
    effect.narration = "小鹿的余光掠过树影，让这句低语更像一个留给她自己的问题。";
  } else if (itemId === "resonance_fox_tail_note") {
    // 狐尾评语：用于低语，略增信任与好奇
    effect.contextModifier = { bonusSerpentTrust: 2, bonusSelfJudgement: 2 };
    effect.narration = "狐狸尾尖扫出的弯痕让话语避开直路，绕到她愿意思考的地方。";
  }

  return effect;
}

// ---- 消耗准备的回响（行动后）—— 同时支持 prepared 和 consumable 类型 ----
export function consumePreparedResonanceAfterAction(
  state: EdenWorldState,
  context: ResonanceActionContext,
  result: string,
): void {
  if (!state.preparedResonanceId) return;

  const itemId = state.preparedResonanceId;
  const item = getItemById(itemId);

  // consumable 类型也可以准备并消耗
  if (!item || (item.kind !== "prepared" && item.kind !== "consumable")) {
    state.preparedResonanceId = null;
    return;
  }

  // 检查是否匹配 bindTargets
  const matchesTarget = item.bindTargets?.includes(
    context.actionKind as unknown as ResonanceBindTarget,
  );

  if (!matchesTarget) {
    // 不匹配，不消耗，但保留准备状态
    return;
  }

  // 匹配，消耗次数
  if (state.itemCounts[itemId] && state.itemCounts[itemId] > 0) {
    state.itemCounts[itemId] -= 1;
  }

  // 记录使用历史
  const useRecord: ResonanceUseRecord = {
    timeSlot: state.timeSlot,
    itemId,
    actionKind: context.actionKind,
    targetId: context.targetNpc ?? context.locationId ?? undefined,
    result,
  };
  state.resonanceUseHistory.push(useRecord);

  // 清除准备状态
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

  // 必须是 instant 类型
  if (item.kind !== "instant") {
    return { allowed: false, reason: "这段回响不能即时使用，需要准备" };
  }

  // 根据回响 ID 执行效果
  if (itemId === "gift_sabbath_dew") {
    // 息日露滴：恢复 1 点 AP
    state.actionPoints = Math.min(state.maxActionPoints, state.actionPoints + 1);
  } else if (itemId === "gift_revealing_light") {
    // 照见之光：获得一条关于回响获得的提示（暂不实现具体效果）
    // 暂时返回提示叙事
  } else if (itemId === "moonlight_path_marker") {
    // 月光道标：已持有，下次移动到不可达地点时自动消耗
    // 即时使用只是告知玩家道标已生效
  } else if (itemId === "gift_wide_path_seal") {
    // 宽行之印：免除一次移动或场景互动的 AP 消耗（需要准备，但 gift 是 instant）
    // 直接恢复 1 点 AP 作为替代效果
    state.actionPoints = Math.min(state.maxActionPoints, state.actionPoints + 1);
  }

  // 消耗次数
  if (state.itemCounts[itemId] && state.itemCounts[itemId] > 0) {
    state.itemCounts[itemId] -= 1;
  }

  // 记录使用历史
  const useRecord: ResonanceUseRecord = {
    timeSlot: state.timeSlot,
    itemId,
    actionKind: "instant",
    result: `即时使用了 ${item.title}`,
  };
  state.resonanceUseHistory.push(useRecord);

  return {
    allowed: true,
    narration: item.description,
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

  // 消耗品可以叠加使用
  // 消耗次数
  if (state.itemCounts[itemId] && state.itemCounts[itemId] > 0) {
    state.itemCounts[itemId] -= 1;
  }

  // 根据回响 ID 设置待生效效果
  const effect = {
    itemId,
    narration: item.description,
    bonusSerpentTrust: 0,
    bonusSelfJudgement: 0,
    bonusObedience: 0,
    freeApCost: false,
    silentGrassActive: false,
  };

  if (itemId === "resonance_borrowed_name") {
    effect.bonusSerpentTrust = 6;
  } else if (itemId === "resonance_hedgehog_bristle") {
    effect.bonusSerpentTrust = 3;
    effect.silentGrassActive = true;
  } else if (itemId === "resonance_deer_glance") {
    effect.bonusSelfJudgement = 3;
    effect.bonusSerpentTrust = 2;
  } else if (itemId === "resonance_fox_tail_note") {
    effect.bonusSelfJudgement = 3;
    effect.bonusSerpentTrust = 2;
  } else if (itemId === "resonance_still_leaf") {
    effect.bonusSerpentTrust = 5;
  } else if (itemId === "resonance_silent_grass") {
    effect.freeApCost = true;
    effect.silentGrassActive = true;
  } else if (itemId === "resonance_morning_flame") {
    effect.bonusSelfJudgement = 5;
  } else if (itemId === "resonance_boundary_mark") {
    effect.bonusObedience = -4;
    effect.bonusSelfJudgement = 3;
  } else if (itemId === "resonance_herald_feather") {
    effect.bonusSerpentTrust = 4;
    effect.bonusObedience = -3;
  } else if (itemId === "resonance_east_gate_glow") {
    effect.freeApCost = true;
  } else if (itemId === "consumable_trust_dew") {
    effect.bonusSerpentTrust = 8;
  } else if (itemId === "consumable_gentle_voice") {
    effect.silentGrassActive = true;
    effect.bonusSerpentTrust = 3;
  } else if (itemId === "consumable_first_whisper_free") {
    // 首语印记：免除下一次低语AP消耗
    effect.freeApCost = true;
    effect.bonusSerpentTrust = 2;
  }

  state.pendingConsumableEffects.push(effect);

  // 记录使用历史
  const useRecord: ResonanceUseRecord = {
    timeSlot: state.timeSlot,
    itemId,
    actionKind: "instant",
    result: `使用了消耗品 ${item.title}`,
  };
  state.resonanceUseHistory.push(useRecord);

  return {
    allowed: true,
    narration: `你使用了「${item.title}」。${item.description} 它将在你下一次行动时悄然生效。`,
  };
}

// ---- 应用待生效的消耗品效果到低语（聚合所有待生效效果） ----
export function applyPendingConsumableToWhisper(
  state: EdenWorldState,
): {
  bonusSerpentTrust: number;
  bonusSelfJudgement: number;
  bonusObedience: number;
  silentGrassActive: boolean;
  narrations: string[];
} {
  const effects = state.pendingConsumableEffects;
  if (effects.length === 0) {
    return {
      bonusSerpentTrust: 0,
      bonusSelfJudgement: 0,
      bonusObedience: 0,
      silentGrassActive: false,
      narrations: [],
    };
  }

  let bonusSerpentTrust = 0;
  let bonusSelfJudgement = 0;
  let bonusObedience = 0;
  let silentGrassActive = false;
  const narrations: string[] = [];

  for (const e of effects) {
    bonusSerpentTrust += e.bonusSerpentTrust ?? 0;
    bonusSelfJudgement += e.bonusSelfJudgement ?? 0;
    bonusObedience += e.bonusObedience ?? 0;
    if (e.silentGrassActive) silentGrassActive = true;
    if (e.narration) narrations.push(e.narration);
  }

  // 清空所有消耗品效果
  state.pendingConsumableEffects = [];

  return {
    bonusSerpentTrust,
    bonusSelfJudgement,
    bonusObedience,
    silentGrassActive,
    narrations,
  };
}

// ---- 应用待生效的消耗品效果到移动（免除AP等） ----
export function applyPendingConsumableToMove(
  state: EdenWorldState,
): { freeApCost: boolean; narrations: string[] } {
  const effects = state.pendingConsumableEffects;
  let freeApCost = false;
  const narrations: string[] = [];
  const remaining: typeof effects = [];

  for (const e of effects) {
    if (e.freeApCost) {
      freeApCost = true;
      if (e.narration) narrations.push(e.narration);
    } else {
      remaining.push(e);
    }
  }

  state.pendingConsumableEffects = remaining;
  return { freeApCost, narrations };
}

// ---- 换时段时取消准备的回响 ----
export function cancelPreparedResonanceOnSlotAdvance(
  state: EdenWorldState,
): void {
  if (state.preparedResonanceId) {
    // 不消耗，只是取消准备
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
