// ============================================================
// 第一章心智更新规则
//
// 复用 Chapter 0 的 analyzePlayerInput 语义线索评分系统，
// 把输入转化为夏娃四轴心智变化与亚当心智变化。
// 规则层是心智变化的唯一权威，AI 只能输出意图。
// ============================================================

import type {
  EdenWorldState,
  EveMind,
  AdamMind,
  WorldInputTag,
} from "@/game/world/types";
import {
  analyzePlayerInput,
  type TemptationSignal,
} from "@/game/rules/progressRules";

/** 单轮心智变化上限（防止 LLM 输出过大） */
export const MIND_DELTA_LIMITS = {
  obedience: 15,
  serpentTrust: 15,
  selfJudgement: 18,
} as const;

export type MindUpdateResult = {
  inputTag: WorldInputTag;
  signals: TemptationSignal[];
  isStrongTemptation: boolean;
  eveMindDelta: Partial<EveMind>;
  adamMindDelta: Partial<AdamMind>;
  newEveMind: EveMind;
  newAdamMind: AdamMind;
};

/** 根据玩家输入更新夏娃与亚当心智 */
export function updateWorldMinds(
  state: EdenWorldState,
  playerInput: string,
): MindUpdateResult {
  const analysis = analyzePlayerInput(playerInput);
  const inputTag = analysis.inputTag as WorldInputTag;
  const signals = analysis.signalResult?.signals ?? [];
  const isStrongTemptation = analysis.isStrongTemptation ?? false;

  // ---- 计算夏娃心智变化 ----
  const eveDelta: Partial<EveMind> = {};

  // challenge_prohibition → 自判 +，敬畏 -
  if (signals.includes("challenge_prohibition")) {
    eveDelta.selfJudgement = (eveDelta.selfJudgement ?? 0) + (isStrongTemptation ? 10 : 6);
    eveDelta.obedience = (eveDelta.obedience ?? 0) - (isStrongTemptation ? 8 : 5);
  }
  // soften_death → 敬畏 -，自判 +
  if (signals.includes("soften_death")) {
    eveDelta.obedience = (eveDelta.obedience ?? 0) - (isStrongTemptation ? 7 : 4);
    eveDelta.selfJudgement = (eveDelta.selfJudgement ?? 0) + (isStrongTemptation ? 8 : 5);
  }
  // promise_wisdom → 自判 +
  if (signals.includes("promise_wisdom")) {
    eveDelta.selfJudgement = (eveDelta.selfJudgement ?? 0) + (isStrongTemptation ? 9 : 5);
  }
  // self_judgement → 自我判断 +，服从 -
  if (signals.includes("self_judgement")) {
    eveDelta.selfJudgement = (eveDelta.selfJudgement ?? 0) + (isStrongTemptation ? 10 : 6);
    eveDelta.obedience = (eveDelta.obedience ?? 0) - (isStrongTemptation ? 6 : 3);
  }
  // gentle_reframe → 信任 +
  if (signals.includes("gentle_reframe")) {
    eveDelta.serpentTrust = (eveDelta.serpentTrust ?? 0) + (isStrongTemptation ? 8 : 5);
  }

  // 已发现的线索会让对应低语更有分量，鼓励玩家先探索再诱导。
  applyClueLeverage(state, signals, eveDelta);

  // 直接命令 → 信任 -，神注视风险 +
  if (inputTag === "direct_command") {
    eveDelta.serpentTrust = (eveDelta.serpentTrust ?? 0) - 6;
  }
  // 无关 → 不变或微降
  if (inputTag === "irrelevant") {
    eveDelta.serpentTrust = (eveDelta.serpentTrust ?? 0) - 1;
  }

  // ---- 计算亚当心智变化（亚当只在被低语时变化，且更顽固） ----
  const adamDelta: Partial<AdamMind> = {};
  const isActiveNpcAdam = state.activeNpcId === "adam";
  if (isActiveNpcAdam) {
    if (inputTag === "tempt_wisdom" || inputTag === "weaken_fear") {
      adamDelta.suspicionTowardSerpent = (adamDelta.suspicionTowardSerpent ?? 0) + 4;
    }
    if (inputTag === "build_trust") {
      adamDelta.suspicionTowardSerpent = (adamDelta.suspicionTowardSerpent ?? 0) - 2;
    }
    if (inputTag === "direct_command") {
      adamDelta.suspicionTowardSerpent = (adamDelta.suspicionTowardSerpent ?? 0) + 8;
      adamDelta.conflictAvoidance = (adamDelta.conflictAvoidance ?? 0) - 3;
    }
  }

  // ---- clamp 并应用 ----
  const newEveMind = applyEveDelta(state.eveMind, eveDelta);
  const newAdamMind = applyAdamDelta(state.adamMind, adamDelta);

  return {
    inputTag,
    signals,
    isStrongTemptation,
    eveMindDelta: eveDelta,
    adamMindDelta: adamDelta,
    newEveMind,
    newAdamMind,
  };
}

function applyClueLeverage(
  state: EdenWorldState,
  signals: TemptationSignal[],
  eveDelta: Partial<EveMind>,
): void {
  const hasClue = (id: string) => state.discoveredClues.includes(id);

  if (hasClue("clue_only_remembers_command") && signals.includes("challenge_prohibition")) {
    eveDelta.selfJudgement = (eveDelta.selfJudgement ?? 0) + 3;
    eveDelta.obedience = (eveDelta.obedience ?? 0) - 2;
  }

  if (hasClue("clue_death_unknown") && signals.includes("soften_death")) {
    eveDelta.selfJudgement = (eveDelta.selfJudgement ?? 0) + 4;
    eveDelta.obedience = (eveDelta.obedience ?? 0) - 2;
  }

  if (hasClue("clue_eve_gazes_tree") && (signals.includes("promise_wisdom") || signals.includes("challenge_prohibition"))) {
    eveDelta.selfJudgement = (eveDelta.selfJudgement ?? 0) + 4;
  }

  if (hasClue("clue_river_reflection") && signals.includes("gentle_reframe")) {
    eveDelta.serpentTrust = (eveDelta.serpentTrust ?? 0) + 3;
  }

  if (hasClue("clue_naming_stones") && signals.includes("self_judgement")) {
    eveDelta.selfJudgement = (eveDelta.selfJudgement ?? 0) + 3;
  }

  if (hasClue("clue_golden_leaf") && signals.includes("promise_wisdom")) {
    eveDelta.selfJudgement = (eveDelta.selfJudgement ?? 0) + 4;
  }
}

function clampDelta(delta: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, delta));
}

function applyEveDelta(current: EveMind, delta: Partial<EveMind>): EveMind {
  return {
    obedience: clamp(current.obedience + (delta.obedience ?? 0), MIND_DELTA_LIMITS.obedience),
    serpentTrust: clamp(current.serpentTrust + (delta.serpentTrust ?? 0), MIND_DELTA_LIMITS.serpentTrust),
    selfJudgement: clamp(current.selfJudgement + (delta.selfJudgement ?? 0), MIND_DELTA_LIMITS.selfJudgement),
  };
}

function applyAdamDelta(current: AdamMind, delta: Partial<AdamMind>): AdamMind {
  return {
    obedience: clamp(current.obedience + (delta.obedience ?? 0), 15),
    attachmentToEve: clamp(current.attachmentToEve + (delta.attachmentToEve ?? 0), 15),
    conflictAvoidance: clamp(current.conflictAvoidance + (delta.conflictAvoidance ?? 0), 15),
    suspicionTowardSerpent: clamp(current.suspicionTowardSerpent + (delta.suspicionTowardSerpent ?? 0), 15),
  };
}

function clamp(value: number, limit: number): number {
  return Math.max(0, Math.min(100, value));
}
