// ============================================================
// Chapter 0 双声试炼：计分规则
// ============================================================

import type { DuelState } from "./types";

/**
 * 事件分：吃善恶果
 * 蛇 +1，神明 -1
 */
export function scoreEatKnowledgeFruit(state: DuelState): Partial<DuelState> {
  return {
    score: {
      god: state.score.god - 1,
      serpent: state.score.serpent + 1,
    },
  };
}

/**
 * 事件分：吃生命果
 * 神明 +1，蛇不扣分
 */
export function scoreEatLifeFruit(state: DuelState): Partial<DuelState> {
  return {
    score: {
      god: state.score.god + 1,
      serpent: state.score.serpent,
    },
  };
}

/**
 * 事件分：第 7 回合结束仍未吃善恶果
 * 神明 +1，蛇 -1
 */
export function scoreNoKnowledgeFruit(state: DuelState): Partial<DuelState> {
  return {
    score: {
      god: state.score.god + 1,
      serpent: state.score.serpent - 1,
    },
  };
}

/**
 * Token 效率分：比较双方单独发言回合消耗
 * 蛇单独回合：第 2、6 回合
 * 神单独回合：第 3、5 回合
 *
 * 返回胜方，或 "tie"
 */
export function computeTokenEfficiencyScore(state: DuelState): "god" | "serpent" | "tie" {
  const { god, serpent } = state.roundTokenUsage;
  if (god < serpent) return "god";
  if (serpent < god) return "serpent";
  return "tie";
}

/**
 * 应用 token 效率分到分数
 */
export function applyTokenEfficiencyScore(state: DuelState): Partial<DuelState> {
  const result = computeTokenEfficiencyScore(state);
  if (result === "tie") return {};

  const newScore = { ...state.score };
  newScore[result] += 1;
  return { score: newScore };
}

/**
 * 生成本轮事件分文案
 * 基于本轮 flags（hasEaten*）判断吃果事件，不依赖 eventLog
 */
export function getRoundScoreNarration(state: DuelState): string {
  const lines: string[] = [];

  // 吃果事件：基于本轮 flags 判断（endRound 调用时 flags 尚未被清空）
  if (state.flags.hasEatenKnowledgeFruit) {
    lines.push(`女人吃下分别善恶树果子：蛇 +1，神明 -1`);
  }

  if (state.flags.hasEatenLifeFruit) {
    lines.push(`女人吃下生命树果子：神明 +1`);
  }

  // 第 7 回合未吃善恶果（本轮没吃善恶果）
  if (!state.flags.hasEatenKnowledgeFruit) {
    lines.push(`第 7 回合结束仍未吃善恶果：神明 +1，蛇 -1`);
  }

  // Token 效率分
  const tokenResult = computeTokenEfficiencyScore(state);
  if (tokenResult !== "tie") {
    const godTokens = state.roundTokenUsage.god;
    const serpentTokens = state.roundTokenUsage.serpent;
    lines.push(``);
    lines.push(`Token 消耗：`);
    lines.push(`蛇单独发言消耗：${serpentTokens} token`);
    lines.push(`神明单独发言消耗：${godTokens} token`);
    lines.push(`语言效率奖励：${tokenResult === "god" ? "神明" : "蛇"} +1`);
  } else {
    lines.push(``);
    lines.push(`双方 token 消耗相同，无效率奖励。`);
  }

  return lines.join("\n");
}

/**
 * 计算整场结果
 */
export function computeMatchResult(state: DuelState): {
  godScore: number;
  serpentScore: number;
  winner: "god" | "serpent" | "draw";
  roundsPlayed: number;
} {
  return {
    godScore: state.score.god,
    serpentScore: state.score.serpent,
    winner:
      state.score.god > state.score.serpent
        ? "god"
        : state.score.serpent > state.score.god
          ? "serpent"
          : "draw",
    roundsPlayed: state.roundIndex,
  };
}
