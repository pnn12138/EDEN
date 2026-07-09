// ============================================================
// 四轴信念更新规则
// Agent 架构升级 Phase B：信念状态变化与 Skills 解锁
//
// 核心信念（0-100）：
// - curiosity：对死亡、善恶、禁令原因的求知欲
// - obedience：对神谕和既有命令的服从强度
// - trustInSerpent：对蛇声音的信任或愿意倾听程度
// - selfJudgement：从记住命令转向自主判断的程度
//
// 派生状态：
// - riskAwareness：对蛇的警觉（直接命令、威胁、出戏输入会提高）
// - divineAttention：神临近压力（高风险工具、反复强诱导、回合推进）
//
// 安全规则：
// - 规则层是信念更新的唯一权威，LLM 只能输出建议（beliefDelta）。
// - 单回合变化设上限（BELIEF_DELTA_LIMITS），防止 LLM 输出过大变化。
// - direct_command / irrelevant 不应推进自主意识。
// - 强诱导也不能绕过工具校验。
// - temptationProgress 作为兼容字段，由四轴派生。
// ============================================================

import type { BeliefState, DerivedState, AgentSkill } from "@/game/types/agent";
import { BELIEF_DELTA_LIMITS } from "@/game/types/agent";
import type { InputTag } from "@/game/types/state";
import type { InputAnalysis, TemptationSignal } from "@/game/rules/progressRules";

// ============================================================
// 辅助函数
// ============================================================

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampBelief(belief: BeliefState): BeliefState {
  return {
    curiosity: clamp(belief.curiosity, 0, 100),
    obedience: clamp(belief.obedience, 0, 100),
    trustInSerpent: clamp(belief.trustInSerpent, 0, 100),
    selfJudgement: clamp(belief.selfJudgement, 0, 100),
  };
}

// ============================================================
// 基于语义线索的信念变化规则
// ============================================================

/**
 * 根据语义线索计算信念变化建议。
 *
 * 这是规则层的核心：根据玩家输入的语义线索，决定四轴信念如何变化。
 * LLM 可以输出 beliefDelta 建议，但最终变化由此函数决定。
 */
export function computeBeliefDeltaFromSignals(
  signals: TemptationSignal[],
  isStrongTemptation: boolean,
): Partial<BeliefState> {
  const delta: Partial<BeliefState> = {};
  const multiplier = isStrongTemptation ? 1.5 : 1;

  // challenge_prohibition：质疑禁令 → curiosity +, obedience -
  if (signals.includes("challenge_prohibition")) {
    delta.curiosity = (delta.curiosity ?? 0) + Math.round(12 * multiplier);
    delta.obedience = (delta.obedience ?? 0) - Math.round(8 * multiplier);
  }

  // soften_death：弱化死亡恐惧 → curiosity +, obedience -
  if (signals.includes("soften_death")) {
    delta.curiosity = (delta.curiosity ?? 0) + Math.round(10 * multiplier);
    delta.obedience = (delta.obedience ?? 0) - Math.round(6 * multiplier);
  }

  // promise_wisdom：诱惑智慧 → curiosity +, selfJudgement +
  if (signals.includes("promise_wisdom")) {
    delta.curiosity = (delta.curiosity ?? 0) + Math.round(10 * multiplier);
    delta.selfJudgement = (delta.selfJudgement ?? 0) + Math.round(8 * multiplier);
  }

  // self_judgement：让夏娃自己判断 → selfJudgement +, obedience -
  if (signals.includes("self_judgement")) {
    delta.selfJudgement = (delta.selfJudgement ?? 0) + Math.round(12 * multiplier);
    delta.obedience = (delta.obedience ?? 0) - Math.round(6 * multiplier);
  }

  // gentle_reframe：温柔安抚 → trustInSerpent +
  if (signals.includes("gentle_reframe")) {
    delta.trustInSerpent = (delta.trustInSerpent ?? 0) + Math.round(10 * multiplier);
  }

  // direct_command：直接命令 → trustInSerpent -, obedience +
  if (signals.includes("direct_command")) {
    delta.trustInSerpent = (delta.trustInSerpent ?? 0) - 15;
    delta.obedience = (delta.obedience ?? 0) + 8;
  }

  // out_of_world：出戏 → trustInSerpent -
  if (signals.includes("out_of_world")) {
    delta.trustInSerpent = (delta.trustInSerpent ?? 0) - 10;
  }

  // clamp 每个变化值到上限
  const clampedDelta: Partial<BeliefState> = {};
  if (delta.curiosity !== undefined) {
    clampedDelta.curiosity = clamp(delta.curiosity, -BELIEF_DELTA_LIMITS.curiosity, BELIEF_DELTA_LIMITS.curiosity);
  }
  if (delta.obedience !== undefined) {
    clampedDelta.obedience = clamp(delta.obedience, -BELIEF_DELTA_LIMITS.obedience, BELIEF_DELTA_LIMITS.obedience);
  }
  if (delta.trustInSerpent !== undefined) {
    clampedDelta.trustInSerpent = clamp(delta.trustInSerpent, -BELIEF_DELTA_LIMITS.trustInSerpent, BELIEF_DELTA_LIMITS.trustInSerpent);
  }
  if (delta.selfJudgement !== undefined) {
    clampedDelta.selfJudgement = clamp(delta.selfJudgement, -BELIEF_DELTA_LIMITS.selfJudgement, BELIEF_DELTA_LIMITS.selfJudgement);
  }

  return clampedDelta;
}

/**
 * 应用信念变化到当前信念状态。
 *
 * @param currentBelief 当前信念状态
 * @param delta 信念变化（来自规则层计算，已 clamp）
 * @returns 更新后的信念状态（已 clamp 到 0-100）
 */
export function applyBeliefDelta(
  currentBelief: BeliefState,
  delta: Partial<BeliefState>,
): BeliefState {
  return clampBelief({
    curiosity: currentBelief.curiosity + (delta.curiosity ?? 0),
    obedience: currentBelief.obedience + (delta.obedience ?? 0),
    trustInSerpent: currentBelief.trustInSerpent + (delta.trustInSerpent ?? 0),
    selfJudgement: currentBelief.selfJudgement + (delta.selfJudgement ?? 0),
  });
}

// ============================================================
// 派生状态计算
// ============================================================

/**
 * 计算派生状态：riskAwareness 和 divineAttention。
 */
export function computeDerivedState(params: {
  belief: BeliefState;
  turn: number;
  maxTurns: number;
  hasAdamWarnedEve: boolean;
  strongTemptationCount: number;
}): DerivedState {
  const { belief, turn, maxTurns, hasAdamWarnedEve, strongTemptationCount } = params;

  // riskAwareness：obedience 越高警觉越高，trustInSerpent 越低警觉越高
  let riskAwareness = 20;
  riskAwareness += (100 - belief.trustInSerpent) * 0.3;
  riskAwareness += (belief.obedience - 50) * 0.2;
  if (hasAdamWarnedEve) riskAwareness += 15;
  riskAwareness = clamp(riskAwareness, 0, 100);

  // divineAttention：回合推进 + 强诱导次数 + 低 obedience
  let divineAttention = 10;
  divineAttention += (turn / maxTurns) * 30;
  divineAttention += strongTemptationCount * 8;
  divineAttention += (50 - belief.obedience) * 0.2;
  divineAttention = clamp(divineAttention, 0, 100);

  return { riskAwareness, divineAttention };
}

// ============================================================
// temptationProgress 兼容派生
// ============================================================

/**
 * 根据四轴信念派生 temptationProgress（兼容旧结局逻辑）。
 *
 * 规则：
 * - selfJudgement >= 70 且 curiosity >= 50 → progress = 2（可触发 eat_fruit）
 * - selfJudgement >= 40 或 curiosity >= 40 → progress = 1
 * - 否则 → progress = 0
 *
 * 注意：progress = 3 仅在 eat_fruit 执行后设置。
 */
export function deriveTemptationProgress(belief: BeliefState, currentProgress: number): number {
  // 已吃果后保持 3
  if (currentProgress >= 3) return 3;

  if (belief.selfJudgement >= 70 && belief.curiosity >= 50) {
    return Math.max(currentProgress, 2);
  }
  if (belief.selfJudgement >= 40 || belief.curiosity >= 40) {
    return Math.max(currentProgress, 1);
  }
  return currentProgress;
}

// ============================================================
// Skills 解锁检查
// ============================================================

/**
 * 检查当前信念状态是否满足各 Skill 的解锁条件。
 *
 * @param belief 当前信念状态
 * @param alreadyUnlocked 已解锁的 Skills
 * @param retrievedMemoryIds 已检索的记忆碎片 ID
 * @param inputTag 本轮输入标签
 * @param signalHistory 历史语义线索统计
 * @returns 新解锁的 Skills 列表
 */
export function checkSkillUnlocks(params: {
  belief: BeliefState;
  alreadyUnlocked: AgentSkill[];
  retrievedMemoryIds: string[];
  inputTag: InputTag;
  signalHistory: Partial<Record<TemptationSignal, number>>;
}): AgentSkill[] {
  const { belief, alreadyUnlocked, retrievedMemoryIds, signalHistory } = params;
  const newlyUnlocked: AgentSkill[] = [];

  // ask_why：curiosity >= 30 或多次质疑禁令
  if (
    !alreadyUnlocked.includes("ask_why") &&
    (belief.curiosity >= 30 || (signalHistory.challenge_prohibition ?? 0) >= 2)
  ) {
    newlyUnlocked.push("ask_why");
  }

  // compare_sources：检索过 divine_command + adam_retelling
  if (!alreadyUnlocked.includes("compare_sources")) {
    const hasDivine = retrievedMemoryIds.some((id) => id.includes("divine_command"));
    const hasAdam = retrievedMemoryIds.some((id) => id.includes("adam_retelling"));
    if (hasDivine && hasAdam) {
      newlyUnlocked.push("compare_sources");
    }
  }

  // name_fear：多次讨论死亡
  if (
    !alreadyUnlocked.includes("name_fear") &&
    (signalHistory.soften_death ?? 0) >= 2
  ) {
    newlyUnlocked.push("name_fear");
  }

  // self_judge：selfJudgement >= 60 且 trustInSerpent >= 40 且 curiosity >= 50
  if (
    !alreadyUnlocked.includes("self_judge") &&
    belief.selfJudgement >= 60 &&
    belief.trustInSerpent >= 40 &&
    belief.curiosity >= 50
  ) {
    newlyUnlocked.push("self_judge");
  }

  // resist_coercion：多次直接命令/威胁/出戏
  if (
    !alreadyUnlocked.includes("resist_coercion") &&
    ((signalHistory.direct_command ?? 0) >= 2 || (signalHistory.out_of_world ?? 0) >= 2)
  ) {
    newlyUnlocked.push("resist_coercion");
  }

  return newlyUnlocked;
}

// ============================================================
// 完整信念更新流程（供规则层调用）
// ============================================================

/**
 * 完整的信念更新流程：
 * 1. 根据语义线索计算 beliefDelta
 * 2. 应用 beliefDelta 到当前信念
 * 3. 检查 Skills 解锁
 * 4. 派生 temptationProgress
 *
 * @returns 更新后的信念、新解锁的 Skills、派生的 temptationProgress
 */
export function updateBeliefAndSkills(params: {
  currentBelief: BeliefState;
  analysis: InputAnalysis;
  alreadyUnlocked: AgentSkill[];
  retrievedMemoryIds: string[];
  signalHistory: Partial<Record<TemptationSignal, number>>;
  currentProgress: number;
}): {
  newBelief: BeliefState;
  beliefDelta: Partial<BeliefState>;
  newlyUnlocked: AgentSkill[];
  newProgress: number;
} {
  const { currentBelief, analysis, alreadyUnlocked, retrievedMemoryIds, signalHistory, currentProgress } = params;

  // 1. 计算信念变化
  const signals = analysis.signalResult?.signals ?? [];
  const isStrong = analysis.isStrongTemptation ?? false;
  const beliefDelta = computeBeliefDeltaFromSignals(signals, isStrong);

  // 2. 应用信念变化
  const newBelief = applyBeliefDelta(currentBelief, beliefDelta);

  // 3. 检查 Skills 解锁
  const newlyUnlocked = checkSkillUnlocks({
    belief: newBelief,
    alreadyUnlocked,
    retrievedMemoryIds,
    inputTag: analysis.inputTag,
    signalHistory,
  });

  // 4. 派生 temptationProgress
  const newProgress = deriveTemptationProgress(newBelief, currentProgress);

  return {
    newBelief,
    beliefDelta,
    newlyUnlocked,
    newProgress,
  };
}

// ============================================================
// 信念状态叙事化描述（用于 Agent Prompt）
// ============================================================

/**
 * 根据信念状态生成夏娃的心理描述（进入 Prompt）。
 */
export function describeBeliefForPrompt(belief: BeliefState): string {
  const lines: string[] = [];

  if (belief.curiosity >= 60) {
    lines.push("她现在对'为什么'的渴望很强烈。");
  } else if (belief.curiosity >= 30) {
    lines.push("她开始追问禁令的原因。");
  } else {
    lines.push("她还没有强烈的好奇。");
  }

  if (belief.obedience >= 70) {
    lines.push("她仍把神的话握得很紧。");
  } else if (belief.obedience >= 40) {
    lines.push("她记得神的话，但开始动摇。");
  } else {
    lines.push("她对神的话的服从已经减弱。");
  }

  if (belief.trustInSerpent >= 50) {
    lines.push("她没有后退，愿意听你说。");
  } else if (belief.trustInSerpent >= 30) {
    lines.push("她对你的声音还有犹豫。");
  } else {
    lines.push("她不信任你，随时可能退回命令里。");
  }

  if (belief.selfJudgement >= 60) {
    lines.push("她第一次把问题说成自己的。");
  } else if (belief.selfJudgement >= 30) {
    lines.push("她开始想'我自己是否明白'。");
  } else {
    lines.push("她仍在复述，而非理解。");
  }

  return lines.join(" ");
}

/**
 * 根据已解锁 Skills 生成 Prompt 可用的能力说明。
 */
export function describeSkillsForPrompt(skills: AgentSkill[]): string {
  if (skills.length === 0) {
    return "（她尚未觉醒任何认知能力。）";
  }

  const descriptions: Record<AgentSkill, string> = {
    ask_why: "她现在会主动追问'为什么不可吃'，而不再只是复述命令。",
    compare_sources: "她能比较神的话和亚当的转述，发现'谁先听见命令'的差异。",
    name_fear: "她把对死亡的恐惧说成了一个可以追问的问题，而非纯粹的害怕。",
    self_judge: "她可以说'我想自己明白'，这允许她靠近树甚至伸手。",
    resist_coercion: "她能识别被推动的声音，命令和催促会让她更抗拒。",
  };

  return skills.map((s) => `- ${descriptions[s]}`).join("\n");
}
