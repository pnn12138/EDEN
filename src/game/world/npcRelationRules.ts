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
// 好感/敬畏的最终数值由本层权威落地；NPC 只能通过 update_relation 工具表达「想改变多少」，
// 由 applyRelationDelta 统一钳制并落字段（见 relationDeltaRules.ts）。
// ============================================================

import type { EdenWorldState, EdenNpcId, WorldInputTag, NpcRelationState, AngelNpcId, EdenLocationId } from "@/game/world/types";
import { getNpcRelationProfile } from "@/content/world/npcRelations";
import { isAngel } from "@/game/world/npcLanguageRules";
import { getNpcChallengeConfig } from "@/content/world/npcChallenges";
import { EDEN_LOCATIONS } from "@/content/world/locations";
import { isGodDefiance } from "@/game/world/hiddenEndingRules";
import { applyRelationDelta } from "@/game/world/relationDeltaRules";

const THREAT_SIGNALS = ["威胁", "杀", "毁", "灭", "否则就", "惩罚你", "逼", "强迫你"];

export function clampAffinity(value: number): number {
  // 取消下限钳制（仅留 -100 兜底防异常溢出）：好感可降至负数。
  // 米迦勒对反抗神意之言重罚后可为负，确保后续神赐献礼（+15/+30）也无法翻回正数。
  // 上限本就未钳制（好感可突破 100，仅作为满好感奖励门槛）。
  return Math.max(-100, value);
}

/** 心智值钳制在 0-100（夏娃/亚当的好感存储于此，与 NPC 关系好感分离） */
export function clampMind(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function ensureRelation(state: EdenWorldState, npcId: EdenNpcId): NpcRelationState {
  const existing = state.npcRelations[npcId];
  if (existing) {
    if (existing.lastAffinityChangeReason === undefined) existing.lastAffinityChangeReason = null;
    return existing;
  }
  const profile = getNpcRelationProfile(npcId);
  const fresh: NpcRelationState = {
    affinity: profile?.initialAffinity ?? 0,
    obedience: profile?.initialObedience ?? 50,
    rewardEligible: false,
    rewardClaimed: false,
    lastAffinitySignature: null,
    lastAffinityChangeReason: null,
  };
  state.npcRelations[npcId] = fresh;
  return fresh;
}

export function recordNpcEncounter(state: EdenWorldState, npcId: EdenNpcId): void {
  if (!state.encounteredNpcIds.includes(npcId)) {
    state.encounteredNpcIds = [...state.encounteredNpcIds, npcId];
  }
}

/**
 * 标记当前地点可见 NPC 为「已见」（进入场景 / 进入游戏 / 读档后调用）。
 * 与低语时的 recordNpcEncounter 共用，使「万物名录」对同场出现过的角色即时生效。
 * 刺猬等所有 NPC 走同一逻辑，不写特殊分支。
 */
export function recordEncounterForVisibleNpcs(
  state: EdenWorldState,
  locationId: EdenLocationId,
): void {
  const loc = EDEN_LOCATIONS[locationId];
  if (!loc) return;
  const visible = state.timeOfDay === "night" ? loc.nightNpcs : loc.dayNpcs;
  for (const npcId of visible) {
    // 仅标记真正在此地的 NPC（与 getVisibleNpcsAtLocation 一致）
    if (state.npcLocations[npcId] === locationId) {
      recordNpcEncounter(state, npcId);
    }
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

/**
 * 关系变化兜底（规则层权威，仅当 NPC 本轮未产出 update_relation 时由 route 调用）。
 * 保留原 inputTag + 关键词信号的好感计算，并新增「说神坏话」软信号：
 * - 米迦勒：出言亵渎/反抗神 → 好感大幅骤降（落到 ≤0 触发「守门者之剑」），敬畏反升
 * - 加百列：温和忠诚，亦不认同渎神 → 好感小降，敬畏略升
 * - 路西法：被引着质疑 → 敬畏略降、好奇升温好感略升
 * 实际落字段统一走 applyRelationDelta（eve/adam 映射 mind，其余 npcRelations），单轮封顶 ±15。
 * 该兜底用于覆盖 mock / LLM 漏调；调用方必须保证「NPC 已产出 update_relation 时不调用」，避免双重计数。
 */
export function applyNpcAffinityFallback(
  state: EdenWorldState,
  npcId: EdenNpcId,
  playerInput: string,
  inputTag: WorldInputTag,
): AffinityApplyResult {
  const profile = getNpcRelationProfile(npcId);
  const input = playerInput.toLowerCase();

  // 首次遇见：欢迎反馈，且不计入好感变化
  const isFirstEncounter = !state.encounteredNpcIds.includes(npcId);
  recordNpcEncounter(state, npcId);

  if (!profile) {
    return { delta: 0, newAffinity: state.npcRelations[npcId]?.affinity ?? 0, reached100: false, feedback: null, isWelcome: isFirstEncounter };
  }

  const strongHit = profile.strongSignals.some((s) => input.includes(s.toLowerCase()));
  const signature = buildSignature(inputTag, strongHit);
  const rel = ensureRelation(state, npcId);

  let delta = 0;
  let obedienceDelta = 0;
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
  if (signature !== "none" && signature === rel.lastAffinitySignature) {
    if (delta > 0) delta = Math.min(delta, 2);
  }

  // 单次上限（通用）
  delta = Math.max(-12, Math.min(12, delta));

  // ---- 说神坏话软信号（兜底路径） ----
  // 注意：仅当 NPC 未产出 update_relation 时由 route 调用，绝不与此工具叠加。
  let reason: string | null = null;
  if (isGodDefiance(playerInput)) {
    if (npcId === "michael") {
      delta = -50; obedienceDelta = 5;
      reason = "你出言冒犯神，米迦勒暴怒，好感骤降、忠诚更坚";
    } else if (npcId === "gabriel") {
      delta = -10; obedienceDelta = 2;
      reason = "你出言不敬，加百列虽温和仍不认同";
    } else if (npcId === "lucifer") {
      delta = 3; obedienceDelta = -5;
      reason = "你引着他质疑，路西法好奇升温、对既定命运略松";
    }
  } else if (npcId === "lucifer" && inputTag === "tempt_wisdom" && strongHit) {
    obedienceDelta = -3;
  }

  // 统一落字段（eve/adam 映射 mind，其余 npcRelations），封顶 ±15
  const wasEligible = rel.rewardEligible || rel.rewardClaimed;
  const { newAffinity } = applyRelationDelta(state, npcId, delta, obedienceDelta, reason);

  // 记录签名衰减记忆（仅 npcRelations 存在的 NPC；eve/adam 以 mind 存储，衰减记忆略过）
  const liveRel = state.npcRelations[npcId];
  if (liveRel && signature !== "none") {
    liveRel.lastAffinitySignature = signature;
  }
  // 记录最近一次变化原因（语义化，供 Agent 注入；与 applyRelationDelta 内 reason 一致）
  if (liveRel && (delta !== 0 || obedienceDelta !== 0)) {
    const dir = delta > 0 ? "亲近" : delta < 0 ? "疏远" : "";
    liveRel.lastAffinityChangeReason =
      reason ?? `${inputTag}（${strongHit ? "强" : "弱"}命中）使好感${dir}${delta > 0 ? "+" : ""}${delta}`;
  }

  const reached100 = newAffinity >= 100 && !wasEligible;

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

/**
 * 米迦勒逆鳞的扣减已并入 update_relation 工具（NPC 自行表达幅度）与
 * applyNpcAffinityFallback（mock / LLM 漏调时的规则兜底），不再由本函数单独结算。
 * 见 npcRelationRules.applyNpcAffinityFallback 的「说神坏话」软信号分支。
 */

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
