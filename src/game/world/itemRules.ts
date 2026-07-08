// ============================================================
// 第一章园中回响道具规则层
//
// 职责：
// - 发放 / 消耗信物
// - 应用被动信物效果（影响下一次低语的上下文）
// - 校验主动信物可用性
//
// 安全规则：
// - 道具不能直接触发禁忌动作链
// - 道具不能绕过心智门槛
// - 道具不能让玩家直接控制女人
// - 所有发放和消耗必须经规则层
//
// 迁移说明（P0）：
// - 保留兼容导出（grantWorldItem / consumeWorldItem / hasWorldItem / canUseWorldItem）
// - 内部改为调用 resonanceRules.ts 中的新函数
// - computePassiveItemModifiers 和 consumePassiveItemsAfterWhisper 暂不删除，
//   但 /api/world 不再调用它们，主动/被动效果由 resonanceRules.ts 统一处理。
// ============================================================

import type { EdenWorldState, EdenNpcId } from "@/game/world/types";
import { getItemById } from "@/content/world/items";
import { grantResonance, executeInstantResonance } from "./resonanceRules";

/** 发放信物（兼容旧接口，内部调用 grantResonance） */
export function grantWorldItem(state: EdenWorldState, itemId: string): boolean {
  return grantResonance(state, itemId, 1);
}

/** 消耗信物（兼容旧接口，内部使用 itemCounts） */
export function consumeWorldItem(state: EdenWorldState, itemId: string): boolean {
  if (!state.itemCounts[itemId] || state.itemCounts[itemId] <= 0) return false;
  state.itemCounts[itemId] -= 1;
  if (!state.usedItemIds.includes(itemId)) {
    state.usedItemIds.push(itemId);
  }
  return true;
}

/** 检查是否持有信物 */
export function hasWorldItem(state: EdenWorldState, itemId: string): boolean {
  return state.inventory.includes(itemId);
}

export type ItemUseContext = {
  targetNpc: EdenNpcId;
  /** 玩家本次低语文本 */
  playerInput: string;
  /** 是否在夜晚 */
  isNight: boolean;
};

/** 检查主动信物是否可在当前上下文使用（兼容旧接口） */
export function canUseWorldItem(
  state: EdenWorldState,
  itemId: string,
  context: ItemUseContext,
): { allowed: boolean; reason?: string } {
  if (state.isEnded) return { allowed: false, reason: "园中已归于寂静" };
  if (!hasWorldItem(state, itemId)) return { allowed: false, reason: "你没有这件回响" };

  const item = getItemById(itemId);
  if (!item) return { allowed: false, reason: "未知回响" };
  if (item.kind === "passive") return { allowed: false, reason: "这件回响会自动生效，不需要主动使用" };

  // 白羽回声：夜晚才能让鸽子传话
  if (itemId === "resonance_white_feather_echo" && !context.isNight) {
    return { allowed: false, reason: "白羽回声只在夜里才能让鸽子传话" };
  }
  // 河源露：使用后下一时段 +1 AP，无额外限制
  // 四河回声：用于风险提示/复盘，无使用限制
  return { allowed: true };
}

/**
 * 计算被动信物对下一次低语的影响上下文。
 * 返回一个"低语修正"对象，由 mindRules / divineAttentionRules 在结算时读取。
 * 不直接修改心智，只提供上下文方向。
 */
export type WhisperContextModifier = {
  /** 额外的愿倾听加成（来自静息之叶） */
  bonusSerpentTrust?: number;
  /** 额外熟悉感加成（来自借来的名字） */
  bonusFamiliarity?: number;
  /** 轻微强化秩序联想（借来的名字的代价） */
  bonusObedience?: number;
  /** 本次低语是否由白羽回声/鸽子传递（影响神的注视判定） */
  carriedByDove?: boolean;
  /** 是否抵消一次轻度神的注视上升（无声草） */
  silentGrassActive?: boolean;
};

/** 根据当前持有的被动信物，计算下一次低语的上下文修正 */
export function computePassiveItemModifiers(
  state: EdenWorldState,
  targetNpc: EdenNpcId,
): WhisperContextModifier {
  const mod: WhisperContextModifier = {};

  // 静息之叶：对女人的温和低语额外提高愿倾听
  if (targetNpc === "eve" && hasWorldItem(state, "resonance_still_leaf")) {
    mod.bonusSerpentTrust = 5;
  }

  // 借来的名字：提高熟悉感，但轻微强化秩序联想
  if (targetNpc === "eve" && hasWorldItem(state, "resonance_borrowed_name")) {
    mod.bonusFamiliarity = 4;
    mod.bonusObedience = 3;
  }

  // 无声草：抵消一次轻度神的注视上升（在 divineAttentionRules 读取后消耗）
  if (hasWorldItem(state, "resonance_silent_grass")) {
    mod.silentGrassActive = true;
  }

  return mod;
}

/**
 * 在低语结算后，消耗本次生效的一次性被动信物。
 * 静息之叶 / 借来的名字 在对女人低语后消耗；无声草在抵消一次注视后消耗。
 */
export function consumePassiveItemsAfterWhisper(
  state: EdenWorldState,
  targetNpc: EdenNpcId,
  modifier: WhisperContextModifier,
  divineAttentionDelta: number,
): void {
  // 静息之叶：对女人低语后消耗
  if (targetNpc === "eve" && modifier.bonusSerpentTrust) {
    consumeWorldItem(state, "resonance_still_leaf");
  }
  // 借来的名字：对女人低语后消耗
  if (targetNpc === "eve" && modifier.bonusFamiliarity) {
    consumeWorldItem(state, "resonance_borrowed_name");
  }
  // 无声草：若本次产生了轻度注视上升（delta > 0 且 <= 1），抵消并消耗
  if (modifier.silentGrassActive && divineAttentionDelta > 0 && divineAttentionDelta <= 1) {
    consumeWorldItem(state, "resonance_silent_grass");
  }
}
