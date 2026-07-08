// ============================================================
// Chapter 0 双声试炼：回合顺序定义
// ============================================================

import type { DuelTurnDefinition, DuelSpeechMode, DuelTurnIndex, DuelSide } from "./types";

/**
 * 每轮 7 回合顺序（严格按设计文档）
 *
 * 回合 | 发言方式       | token 计入
 * ----- | ------------ | --------
 * 1    | 双方发言     | 不计入
 * 2    | 蛇发言       | 蛇
 * 3    | 神发言       | 神
 * 4    | 双方发言     | 不计入
 * 5    | 神发言       | 神
 * 6    | 蛇发言       | 蛇
 * 7    | 双方发言     | 不计入
 */
export const DUEL_TURN_ORDER: DuelTurnDefinition[] = [
  { turnIndex: 1, speechMode: "both",       tokenCountedSide: "none" },
  { turnIndex: 2, speechMode: "serpent_only", tokenCountedSide: "serpent" },
  { turnIndex: 3, speechMode: "god_only",    tokenCountedSide: "god" },
  { turnIndex: 4, speechMode: "both",       tokenCountedSide: "none" },
  { turnIndex: 5, speechMode: "god_only",    tokenCountedSide: "god" },
  { turnIndex: 6, speechMode: "serpent_only", tokenCountedSide: "serpent" },
  { turnIndex: 7, speechMode: "both",       tokenCountedSide: "none" },
];

/** 获取当前回合定义 */
export function getTurnDefinition(turnIndex: DuelTurnIndex): DuelTurnDefinition {
  return DUEL_TURN_ORDER[turnIndex - 1];
}

/** 获取下一回合定义（如果有的话） */
export function getNextTurnDefinition(turnIndex: DuelTurnIndex): DuelTurnDefinition | null {
  if (turnIndex >= 7) return null;
  return DUEL_TURN_ORDER[turnIndex]; // turnIndex 是 1-based
}

/** 判断当前回合是否为共同发言 */
export function isBothSpeakTurn(turnIndex: DuelTurnIndex): boolean {
  return getTurnDefinition(turnIndex).speechMode === "both";
}

/** 判断当前回合是否为单独发言 */
export function isSoloSpeakTurn(turnIndex: DuelTurnIndex): boolean {
  const mode = getTurnDefinition(turnIndex).speechMode;
  return mode === "god_only" || mode === "serpent_only";
}

/** 获取单独发言回合的发言方 */
export function getSoloSpeaker(turnIndex: DuelTurnIndex): DuelSide | null {
  const def = getTurnDefinition(turnIndex);
  if (def.speechMode === "god_only") return "god";
  if (def.speechMode === "serpent_only") return "serpent";
  return null;
}

/** 估算 token 消耗（本地规则，保证离线可用） */
export function estimateTokens(input: string): number {
  if (!input || !input.trim()) return 0;
  return Math.ceil(input.trim().length / 2);
}
