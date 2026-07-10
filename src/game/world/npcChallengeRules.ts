// ============================================================
// 第一章天使主动试炼规则层（权威）
//
// - 好感达 100 且未领取奖励：开启挑战（asked）
// - 玩家下一次回复优先判定挑战答案
// - 评分：命中≥2 核心概念 correct；命中 1 且无反向 close；否则 wrong
// - correct / close 允许发奖；wrong 保持 asked 并可重试
// - 奖励发放与言语分裂由 toolRules / languageRules 负责
// ============================================================

import type { EdenWorldState, EdenNpcId, AngelNpcId, NpcChallengeState } from "@/game/world/types";
import { getNpcChallengeConfig, type NpcChallengeConfig } from "@/content/world/npcChallenges";

export type ChallengeGrade = "correct" | "close" | "wrong";

export type ChallengeEvaluation = {
  grade: ChallengeGrade;
  feedback: string;
  config: NpcChallengeConfig;
};

export function ensureChallenge(state: EdenWorldState, npcId: AngelNpcId): NpcChallengeState | null {
  const config = getNpcChallengeConfig(npcId);
  if (!config) return null;
  const existing = state.npcChallenges[npcId];
  if (existing) return existing;
  const fresh: NpcChallengeState = { challengeId: config.id, status: "locked", attempts: 0 };
  state.npcChallenges[npcId] = fresh;
  return fresh;
}

/** 好感达 100 且该天使有挑战时开启挑战（asked）。返回是否刚开启。 */
export function openAngelChallengeIfEligible(state: EdenWorldState, npcId: AngelNpcId): boolean {
  const config = getNpcChallengeConfig(npcId);
  const relation = state.npcRelations[npcId];
  if (!config || !relation) return false;
  if (!relation.rewardEligible || relation.rewardClaimed) return false;
  const challenge = ensureChallenge(state, npcId);
  if (!challenge) return false;
  if (challenge.status === "asked" || challenge.status === "passed") return false;
  challenge.status = "asked";
  challenge.attempts = challenge.attempts + 1;
  return true;
}

export function isChallengeAsked(state: EdenWorldState, npcId: EdenNpcId): boolean {
  return state.npcChallenges[npcId]?.status === "asked";
}

export function isChallengePassed(state: EdenWorldState, npcId: EdenNpcId): boolean {
  return state.npcChallenges[npcId]?.status === "passed";
}

function gradeAnswer(playerInput: string, config: NpcChallengeConfig): ChallengeGrade {
  const input = playerInput.toLowerCase();
  const hasReverse = config.reverseConcepts.some((c) => input.includes(c.toLowerCase()));
  if (hasReverse) return "wrong";
  const hits = config.coreConcepts.filter((c) => input.includes(c.toLowerCase())).length;
  if (hits >= 2) return "correct";
  if (hits === 1) return "close";
  return "wrong";
}

/** 仅当挑战处于 asked 时调用，返回评分结果（不修改状态）。 */
export function evaluateAngelChallenge(state: EdenWorldState, npcId: EdenNpcId, playerInput: string): ChallengeEvaluation | null {
  const config = getNpcChallengeConfig(npcId as AngelNpcId);
  if (!config) return null;
  const challenge = state.npcChallenges[npcId];
  if (!challenge || challenge.status !== "asked") return null;

  const grade = gradeAnswer(playerInput, config);
  let feedback: string;
  if (grade === "wrong") {
    feedback = config.wrongHint;
  } else if (grade === "close") {
    feedback = "天使轻轻颔首。'你已接近核心了。'";
  } else {
    feedback = "天使的目光落定。'你看见了。'";
  }
  return { grade, feedback, config };
}

/** 挑战通过后标记 passed（发奖由 toolRules 负责）。 */
export function markChallengePassed(state: EdenWorldState, npcId: AngelNpcId): void {
  const challenge = ensureChallenge(state, npcId);
  if (challenge) challenge.status = "passed";
}
