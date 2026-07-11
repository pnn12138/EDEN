// ============================================================
// 第一章通用 NPC 好感规则层（权威）
//
// 职责：
// - 确保好感状态存在（缺省用内容表初始值）
// - 根据 inputTag + 关键词信号计算好感增减
// - 重复相同语义签名时正向收益衰减
// - clamp 0-100
// - 好感首次达到 100 时置 rewardEligible（不静默发奖）
// - 记录已遇见 NPC（属性页情报解锁）
//
// 不允许直接使用 Agent 返回的 affinityDelta。
// ============================================================

import type { EdenWorldState, EdenNpcId, WorldInputTag, NpcRelationState, AngelNpcId } from "@/game/world/types";
import { getNpcRelationProfile } from "@/content/world/npcRelations";
import { isAngel } from "@/game/world/npcLanguageRules";
import { getNpcChallengeConfig } from "@/content/world/npcChallenges";

const THREAT_SIGNALS = ["威胁", "杀", "毁", "灭", "否则就", "惩罚你", "逼", "强迫你"];

function clampAffinity(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function ensureRelation(state: EdenWorldState, npcId: EdenNpcId): NpcRelationState {
  const existing = state.npcRelations[npcId];
  if (existing) return existing;
  const profile = getNpcRelationProfile(npcId);
  const fresh: NpcRelationState = {
    affinity: profile?.initialAffinity ?? 0,
    obedience: profile?.initialObedience ?? 50,
    rewardEligible: false,
    rewardClaimed: false,
    lastAffinitySignature: null,
  };
  state.npcRelations[npcId] = fresh;
  return fresh;
}

export function recordNpcEncounter(state: EdenWorldState, npcId: EdenNpcId): void {
  if (!state.encounteredNpcIds.includes(npcId)) {
    state.encounteredNpcIds = [...state.encounteredNpcIds, npcId];
  }
}

function buildSignature(inputTag: WorldInputTag, strongHit: boolean): string {
  if (inputTag === "irrelevant") return "none";
  return `${inputTag}:${strongHit ? "strong" : "normal"}`;
}

export type AffinityApplyResult = {
  delta: number;
  newAffinity: number;
  reached100: boolean;
  feedback: string | null;
  isWelcome: boolean;
};

export function applyNpcAffinity(
  state: EdenWorldState,
  npcId: EdenNpcId,
  playerInput: string,
  inputTag: WorldInputTag,
): AffinityApplyResult {
  const profile = getNpcRelationProfile(npcId);
  const relation = ensureRelation(state, npcId);
  const input = playerInput.toLowerCase();

  // 首次遇见：欢迎反馈，且不计入好感变化
  const isFirstEncounter = !state.encounteredNpcIds.includes(npcId);
  recordNpcEncounter(state, npcId);

  if (!profile) {
    return { delta: 0, newAffinity: relation.affinity, reached100: false, feedback: null, isWelcome: isFirstEncounter };
  }

  const strongHit = profile.strongSignals.some((s) => input.includes(s.toLowerCase()));
  const signature = buildSignature(inputTag, strongHit);

  let delta = 0;
  let isThreat = false;
  if (profile.dislikedInputTags.includes(inputTag)) {
    isThreat = THREAT_SIGNALS.some((s) => playerInput.includes(s));
    delta = isThreat ? -10 : -6;
  } else if (profile.likedInputTags.includes(inputTag)) {
    delta = strongHit ? 10 : 6;
  } else {
    // 相关但中性 / 无关：维持近 0（tempt_wisdom 略微正向）
    delta = inputTag === "tempt_wisdom" ? 2 : 0;
  }

  // 重复相同语义签名：正向收益最多 +2
  if (signature !== "none" && signature === relation.lastAffinitySignature) {
    if (delta > 0) delta = Math.min(delta, 2);
  }

  // 单次上限
  delta = Math.max(-12, Math.min(12, delta));

  const newAffinity = clampAffinity(relation.affinity + delta);
  const reached100 = newAffinity >= 100 && !relation.rewardEligible && !relation.rewardClaimed;

  relation.affinity = newAffinity;
  // 路西法对质疑禁令信号（tempt_wisdom 强命中）的信仰微调：被诱导质疑时信仰略降
  if (npcId === "lucifer" && inputTag === "tempt_wisdom" && strongHit) {
    relation.obedience = Math.max(0, relation.obedience - 3);
  }
  relation.lastAffinitySignature = signature === "none" ? relation.lastAffinitySignature : signature;
  if (reached100) {
    relation.rewardEligible = true;
  }

  // 反馈文案（自然，不显示数值）
  let feedback: string | null = null;
  if (isFirstEncounter) {
    feedback = pick(profile.feedback.welcome);
  } else if (delta > 0) {
    feedback = pick(profile.feedback.up);
  } else if (delta < 0) {
    feedback = pick(profile.feedback.down);
  }

  return { delta, newAffinity, reached100, feedback, isWelcome: isFirstEncounter };
}

function pick(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)] ?? list[0] ?? "";
}

export function getRelation(state: EdenWorldState, npcId: EdenNpcId): NpcRelationState | null {
  const rel = state.npcRelations[npcId];
  if (!rel) return null;
  return rel;
}

export function isRewardClaimed(state: EdenWorldState, npcId: EdenNpcId): boolean {
  return state.npcRelations[npcId]?.rewardClaimed ?? false;
}

/**
 * 关系赠礼校验（规则层权威）：
 * - 好感必须 100
 * - 必须具有赠礼资格（rewardEligible）
 * - 尚未领取（rewardClaimed=false）
 * - itemId 必须与该 NPC 配置匹配
 * - 天使：挑战必须已通过（passed），且 caller 必须等于当前对话 NPC
 */
export function validateRelationGrant(
  state: EdenWorldState,
  npcId: EdenNpcId,
  itemId: string,
): { allowed: boolean; reason?: string } {
  if (npcId !== state.activeNpcId) {
    return { allowed: false, reason: "回响只能由正在与你交谈的他给出" };
  }
  const relation = state.npcRelations[npcId];
  if (!relation) {
    return { allowed: false, reason: "还不到赠礼的时候" };
  }
  if (relation.affinity < 100) {
    return { allowed: false, reason: "你们的关系还没到那份上" };
  }
  if (!relation.rewardEligible) {
    return { allowed: false, reason: "还不到赠礼的时候" };
  }
  if (relation.rewardClaimed) {
    return { allowed: false, reason: "那份回响已经给过了" };
  }

  let expected: string | null | undefined;
  if (isAngel(npcId as AngelNpcId)) {
    const config = getNpcChallengeConfig(npcId as AngelNpcId);
    if (!config) {
      return { allowed: false, reason: "他还没有问你那个问题" };
    }
    expected = config.rewardItemId; // 守望天使为 null：只给情报
    const challenge = state.npcChallenges[npcId];
    if (!challenge || challenge.status !== "passed") {
      return { allowed: false, reason: "他还没有问你那个问题" };
    }
  } else {
    const profile = getNpcRelationProfile(npcId);
    expected = profile?.rewardItemId ?? null;
  }

  // 非天使必须有对应 itemId；天使 itemId 为 null 时只发情报不校验 item
  if (expected) {
    if (itemId !== expected) {
      return { allowed: false, reason: "那不是他愿给的回响" };
    }
  } else if (itemId) {
    // 守望天使：不应携带 itemId
    return { allowed: false, reason: "他手中没有什么可交给你" };
  }

  return { allowed: true };
}
