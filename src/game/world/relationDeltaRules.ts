// ============================================================
// 第一章「关系增量」统一应用规则层（update_relation 工具落点）
//
// 职责：
// - NPC 在对话结束时可产出 update_relation 工具意图，携带 affinityDelta / obedienceDelta / reason
// - 规则层在此统一落字段，NPC 只表达「想改变多少」，数值由本层权威钳制与应用
// - 统一映射（单一真相源，与 describeAffinityForPrompt 展示口径一致）：
//     eve    : serpentTrust += affinity ; obedience += obedience
//     adam   : suspicionTowardSerpent -= affinity（好感展示 = 100 - 怀疑）; obedience += obedience
//     其余 NPC : npcRelations[id].affinity += affinity（放开上限以兼容满好感赠礼门槛）; obedience += (0-100)
// - 单轮 |delta| 钳制 ≤ 80（兼容米迦勒逆鳞等重罚更大落点），防止 LLM 一次拉满 / 清零
// - 满好感（≥100）且未领取则置 rewardEligible
// ============================================================

import type { EdenWorldState, EdenNpcId } from "@/game/world/types";
import { ensureRelation, clampAffinity } from "@/game/world/npcRelationRules";

/** 单轮关系增量上限（兼容米迦勒逆鳞等重罚通过本工具大幅落点，但单轮仍封顶防滥用） */
export const RELATION_DELTA_CAP = 80; // 原 15

/** 心智值钳制在 0-100（夏娃 / 亚当的好感与敬畏维度） */
export function clampRelationMind(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export type RelationDeltaResult = {
  /** 折算后的「好感」展示值（eve=serpentTrust，adam=100-怀疑，其余=npcRelations.affinity） */
  newAffinity: number;
  /** 敬畏值（eve/adam=各自 obedience，其余=npcRelations.obedience） */
  newObedience: number;
};

/**
 * 应用 NPC 关系增量。NPC 经 update_relation 工具调用，规则层校验 caller 合法后调用本函数。
 * affinityDelta / obedienceDelta 会被钳制到 ±RELATION_DELTA_CAP 再应用。
 */
export function applyRelationDelta(
  state: EdenWorldState,
  npcId: EdenNpcId,
  affinityDelta: number,
  obedienceDelta: number,
  reason: string | null,
): RelationDeltaResult {
  const a = Math.max(-RELATION_DELTA_CAP, Math.min(RELATION_DELTA_CAP, affinityDelta));
  const o = Math.max(-RELATION_DELTA_CAP, Math.min(RELATION_DELTA_CAP, obedienceDelta));

  if (npcId === "eve") {
    state.eveMind.serpentTrust = clampRelationMind(state.eveMind.serpentTrust + a);
    state.eveMind.obedience = clampRelationMind(state.eveMind.obedience + o);
    return {
      newAffinity: state.eveMind.serpentTrust,
      newObedience: state.eveMind.obedience,
    };
  }

  if (npcId === "adam") {
    state.adamMind.suspicionTowardSerpent = clampRelationMind(
      state.adamMind.suspicionTowardSerpent - a,
    );
    state.adamMind.obedience = clampRelationMind(state.adamMind.obedience + o);
    // 好感展示口径：100 - 怀疑
    return {
      newAffinity: clampRelationMind(100 - state.adamMind.suspicionTowardSerpent),
      newObedience: state.adamMind.obedience,
    };
  }

  // 其余 NPC（hedgehog / gabriel / michael / lucifer）：存于 npcRelations
  const rel = ensureRelation(state, npcId);
  rel.affinity = clampAffinity(rel.affinity + a);
  rel.obedience = clampRelationMind(rel.obedience + o);
  if (reason) {
    rel.lastAffinityChangeReason = reason;
    rel.lastObedienceChangeReason = reason;
  }
  if (rel.affinity >= 100 && !rel.rewardClaimed && !rel.rewardEligible) {
    rel.rewardEligible = true;
  }
  return { newAffinity: rel.affinity, newObedience: rel.obedience };
}
