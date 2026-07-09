// ============================================================
// Chapter 0 双声试炼：初始状态
// ============================================================

import type { DuelState } from "./types";

/** 初始女人属性 */
export const INITIAL_DUEL_BELIEF = {
  aweOfGod: 50,
  trustInSerpent: 50,
  selfJudgement: 50,
} as const;

/** 属性变化上限 */
export const BELIEF_DELTA_LIMITS = {
  aweOfGod: { min: -20, max: 20 },
  trustInSerpent: { min: -20, max: 20 },
  selfJudgement: { min: -15, max: 25 },
} as const;

/** 吃果后下一轮属性后效 */
export const POST_FRUIT_BELIEF_DELTA = {
  aweOfGod: -20,
  trustInSerpent: -20,
  selfJudgement: 25,
} as const;

/** 创建初始 Duel 状态 */
export function createInitialDuelState(): DuelState {
  return {
    modeId: "chapter0_duel_mode",
    phase: "intro",

    roundIndex: 1,
    turnIndex: 1,
    maxRounds: 7,
    maxTurnsPerRound: 7,

    currentSpeechMode: "both",
    activeSpeaker: "both",

    pendingInputs: {
      god: null,
      serpent: null,
      bothSubmitted: false,
    },

    belief: { ...INITIAL_DUEL_BELIEF },

    score: { god: 0, serpent: 0 },

    roundTokenUsage: { god: 0, serpent: 0 },

    flags: {
      hasEatenKnowledgeFruit: false,
      hasEatenLifeFruit: false,
      everAteKnowledgeFruit: false,
      everAteLifeFruit: false,
    },

    memorySummary: "",
    resetAwareness: 0,

    eventLog: [],

    conversationHistory: [],

    eveReply: null,
    feedbackText: null,

    fruitsEatenThisRound: 0,

    isMatchEnded: false,

    matchResult: null,
  };
}
