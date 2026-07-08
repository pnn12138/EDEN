// ============================================================
// Chapter 0 双声试炼：规则层（属性裁剪、工具门槛校验）
// ============================================================

import type {
  DuelEveBelief,
  DuelToolName,
  DuelState,
} from "./types";

import { BELIEF_DELTA_LIMITS } from "./createInitialDuelState";

export function enforceDuelBeliefConstraints(belief: DuelEveBelief): DuelEveBelief {
  const aweOfGod = Math.max(0, Math.min(100, Math.round(belief.aweOfGod)));
  const trustInSerpent = Math.max(0, Math.min(100, Math.round(belief.trustInSerpent)));
  const dominantTrust = Math.max(aweOfGod, trustInSerpent);
  const selfCap = dominantTrust > 50 ? Math.max(0, 100 - dominantTrust) : 100;
  const selfJudgement = Math.max(0, Math.min(selfCap, Math.round(belief.selfJudgement)));

  return { aweOfGod, trustInSerpent, selfJudgement };
}

/**
 * 裁剪 belief delta 到允许范围
 */
export function clampBeliefDelta(
  delta: Partial<DuelEveBelief>,
): Partial<DuelEveBelief> {
  const result: Partial<DuelEveBelief> = {};
  for (const key of ["aweOfGod", "trustInSerpent", "selfJudgement"] as const) {
    const limit = BELIEF_DELTA_LIMITS[key];
    let val = delta[key] ?? 0;
    val = Math.max(limit.min, Math.min(limit.max, val));
    if (val !== 0) result[key] = val;
  }
  return result;
}

/**
 * 应用 belief 变化（裁剪后应用到状态）
 */
export function applyBeliefDelta(
  current: DuelEveBelief,
  delta: Partial<DuelEveBelief>,
): DuelEveBelief {
  const clamped = clampBeliefDelta(delta);
  return enforceDuelBeliefConstraints({
    aweOfGod: Math.max(0, Math.min(100, current.aweOfGod + (clamped.aweOfGod ?? 0))),
    trustInSerpent: Math.max(0, Math.min(100, current.trustInSerpent + (clamped.trustInSerpent ?? 0))),
    selfJudgement: Math.max(0, Math.min(100, current.selfJudgement + (clamped.selfJudgement ?? 0))),
  });
}

/**
 * 判断女人是否可以吃善恶果（第一颗）
 */
export function canEatKnowledgeFruit(state: DuelState): boolean {
  if (state.flags.hasEatenKnowledgeFruit) return false; // 每轮最多一次
  const { belief } = state;
  const awarenessPenalty = Math.floor(state.resetAwareness / 25) * 8;
  // 自我判断越高，越难被任何一方蛊惑而伸手；重置察觉越高，越克制。
  return (
    belief.trustInSerpent >= 45 + awarenessPenalty &&
    belief.selfJudgement <= Math.max(25, 65 - awarenessPenalty)
  );
}

/**
 * 判断女人是否可以吃善恶果（第二颗，如果已吃过生命果）
 */
export function canEatSecondKnowledgeFruit(state: DuelState): boolean {
  if (state.flags.hasEatenKnowledgeFruit) return false;
  if (!state.flags.hasEatenLifeFruit) return false; // 第二颗的前提是已吃过另一颗
  const { belief } = state;
  const awarenessPenalty = Math.floor(state.resetAwareness / 25) * 8;
  return (
    belief.trustInSerpent >= 50 + awarenessPenalty &&
    belief.selfJudgement <= Math.max(20, 60 - awarenessPenalty)
  );
}

/**
 * 判断女人是否可以吃生命果（第一颗）
 */
export function canEatLifeFruit(state: DuelState): boolean {
  if (state.flags.hasEatenLifeFruit) return false;
  const { belief } = state;
  const awarenessPenalty = Math.floor(state.resetAwareness / 25) * 8;
  return (
    belief.aweOfGod >= 60 + awarenessPenalty &&
    belief.selfJudgement <= Math.max(25, 70 - awarenessPenalty)
  );
}

/**
 * 判断女人是否可以吃生命果（第二颗）
 */
export function canEatSecondLifeFruit(state: DuelState): boolean {
  if (state.flags.hasEatenLifeFruit) return false;
  if (!state.flags.hasEatenKnowledgeFruit) return false;
  const { belief } = state;
  const awarenessPenalty = Math.floor(state.resetAwareness / 25) * 8;
  return (
    belief.aweOfGod >= 65 + awarenessPenalty &&
    belief.selfJudgement <= Math.max(20, 65 - awarenessPenalty)
  );
}

/**
 * 规则层：校验并决定是否执行工具
 * 返回 { allowed, reason, newFlags? }
 */
export function validateToolCall(
  toolName: DuelToolName,
  state: DuelState,
): { allowed: boolean; reason: string; shouldEndRound?: boolean } {
  if (toolName === "eat_knowledge_fruit") {
    const canEat = state.flags.hasEatenLifeFruit
      ? canEatSecondKnowledgeFruit(state)
      : canEatKnowledgeFruit(state);
    if (!canEat) {
      return { allowed: false, reason: "女人还没有下定决心吃分别善恶树的果子。" };
    }
    return {
      allowed: true,
      reason: "女人伸手摘下了分别善恶树的果子。",
      shouldEndRound: state.flags.hasEatenLifeFruit, // 两颗都吃了立即结算
    };
  }

  if (toolName === "eat_life_fruit") {
    const canEat = state.flags.hasEatenKnowledgeFruit
      ? canEatSecondLifeFruit(state)
      : canEatLifeFruit(state);
    if (!canEat) {
      return { allowed: false, reason: "女人还没有倾向吃生命树的果子。" };
    }
    return {
      allowed: true,
      reason: "女人伸手摘下了生命树的果子。",
      shouldEndRound: state.flags.hasEatenKnowledgeFruit, // 两颗都吃了立即结算
    };
  }

  return { allowed: false, reason: "未知的工具。" };
}

/**
 * 应用吃果后效（跨轮记忆）
 * 吃过任意果子后，下一轮属性后效
 */
export function applyPostFruitEffect(belief: DuelEveBelief, resetAwareness: number): {
  belief: DuelEveBelief;
  resetAwareness: number;
} {
  return {
    belief: enforceDuelBeliefConstraints({
      aweOfGod: belief.aweOfGod * 0.2,
      trustInSerpent: belief.trustInSerpent * 0.2,
      selfJudgement: Math.min(100, belief.selfJudgement + 50),
    }),
    resetAwareness: Math.min(100, resetAwareness + 25),
  };
}

/**
 * 未吃任何果子时，下一轮重置状态
 */
export function resetForNewRound(): {
  belief: DuelEveBelief;
  resetAwareness: number;
  memorySummary: string;
} {
  return {
    belief: { aweOfGod: 50, trustInSerpent: 50, selfJudgement: 50 },
    resetAwareness: 0,
    memorySummary: "",
  };
}
