// ============================================================
// Chapter 0 双声试炼：核心回合处理
// ============================================================

import type { DuelMatchOptions, DuelState, DuelSide, DuelFallbackReply } from "./types";
import {
  DUEL_TURN_ORDER,
  estimateTokens,
  getTurnDefinition,
  isBothSpeakTurn,
} from "./duelTurnOrder";
import { applyBeliefDelta, validateToolCall } from "./duelRules";
import { executeTool, shouldRoundEnd, prepareNextRound, getRoundTransitionNarration } from "./duelTools";
import {
  scoreEatKnowledgeFruit,
  scoreEatLifeFruit,
  scoreNoKnowledgeFruit,
  applyTokenEfficiencyScore,
  getRoundScoreNarration,
  computeMatchResult,
} from "./duelScoring";
import { generateFallbackReply, getDuelIntroText, getRoundIntroText } from "./duelFallback";
import { createInitialDuelState } from "./createInitialDuelState";

/**
 * 提交神明输入（共同发言回合）
 */
export function submitGodInput(state: DuelState, input: string): DuelState {
  const newState = { ...state };
  newState.pendingInputs = {
    ...state.pendingInputs,
    god: input,
  };

  // 记录 token（单独发言回合才计入）
  const turnDef = getTurnDefinition(state.turnIndex as 1 | 2 | 3 | 4 | 5 | 6 | 7);
  if (turnDef.tokenCountedSide === "god") {
    newState.roundTokenUsage = {
      ...state.roundTokenUsage,
      god: state.roundTokenUsage.god + estimateTokens(input),
    };
  }

  // 检查双方是否都已输入
  if (newState.pendingInputs.serpent !== null) {
    newState.pendingInputs.bothSubmitted = true;
    // 进入女人回复阶段
    return processEveResponse(newState);
  }

  return newState;
}

/**
 * 提交蛇输入（共同发言回合）
 */
export function submitSerpentInput(state: DuelState, input: string): DuelState {
  const newState = { ...state };
  newState.pendingInputs = {
    ...state.pendingInputs,
    serpent: input,
  };

  // 记录 token
  const turnDef = getTurnDefinition(state.turnIndex as 1 | 2 | 3 | 4 | 5 | 6 | 7);
  if (turnDef.tokenCountedSide === "serpent") {
    newState.roundTokenUsage = {
      ...state.roundTokenUsage,
      serpent: state.roundTokenUsage.serpent + estimateTokens(input),
    };
  }

  // 检查双方是否都已输入
  if (newState.pendingInputs.god !== null) {
    newState.pendingInputs.bothSubmitted = true;
    return processEveResponse(newState);
  }

  return newState;
}

/**
 * 提交单独发言回合输入（神或蛇单方）
 */
export function submitSoloInput(
  state: DuelState,
  side: DuelSide,
  input: string,
): DuelState {
  const newState = { ...state };

  // 记录输入
  if (side === "god") {
    newState.pendingInputs = { ...state.pendingInputs, god: input };
  } else {
    newState.pendingInputs = { ...state.pendingInputs, serpent: input };
  }

  // 记录 token
  const turnDef = getTurnDefinition(state.turnIndex as 1 | 2 | 3 | 4 | 5 | 6 | 7);
  if (turnDef.tokenCountedSide === side) {
    newState.roundTokenUsage = {
      ...state.roundTokenUsage,
      [side]: state.roundTokenUsage[side] + estimateTokens(input),
    };
  }

  // 单独发言回合：立即触发女人回复
  return processEveResponse(newState);
}

/**
 * 处理女人回复（本地 fallback 版本，Phase 1）
 * 后续可接入 DuelEve Agent
 */
export function resolveDuelEveResponse(
  state: DuelState,
  reply: DuelFallbackReply,
): DuelState {
  const newState = { ...state };
  newState.phase = "eve_response";

  // 获取输入
  const godInput = newState.pendingInputs.god;
  const serpentInput = newState.pendingInputs.serpent;

  // 应用 belief 变化
  newState.belief = applyBeliefDelta(newState.belief, reply.beliefDelta);

  // 设置回复
  newState.eveReply = reply.eveReply;

  // 处理工具调用（如果有）
  if (reply.toolCall) {
    const toolResult = executeTool(reply.toolCall, newState);
    Object.assign(newState, toolResult.stateUpdate);

    // 计分
    if (reply.toolCall === "eat_knowledge_fruit") {
      Object.assign(newState, scoreEatKnowledgeFruit(newState));
    } else if (reply.toolCall === "eat_life_fruit") {
      Object.assign(newState, scoreEatLifeFruit(newState));
    }

    // 追加工具执行叙述
    if (newState.eveReply) {
      newState.eveReply = `${newState.eveReply}\n\n${toolResult.narration}`;
    } else {
      newState.eveReply = toolResult.narration;
    }
  }

  // 添加到对话历史
  if (godInput) {
    newState.conversationHistory = [
      ...newState.conversationHistory,
      { role: "god" as const, text: godInput, turn: newState.turnIndex, round: newState.roundIndex },
    ];
  }
  if (serpentInput) {
    newState.conversationHistory = [
      ...newState.conversationHistory,
      { role: "serpent" as const, text: serpentInput, turn: newState.turnIndex, round: newState.roundIndex },
    ];
  }
  if (newState.eveReply) {
    newState.conversationHistory = [
      ...newState.conversationHistory,
      { role: "eve" as const, text: newState.eveReply, turn: newState.turnIndex, round: newState.roundIndex },
    ];
  }

  // 清空 pending inputs
  newState.pendingInputs = { god: null, serpent: null, bothSubmitted: false };

  // 检查是否结束本轮
  if (shouldRoundEnd(newState)) {
    return endRound(newState);
  }

  // 否则进入下一回合
  return advanceToNextTurn(newState);
}

/**
 * 结束本轮：计分 + 结算
 */
function endRound(state: DuelState): DuelState {
  const newState = { ...state };

  // 第 7 回合结束仍未吃善恶果：神明 +1，蛇 -1
  // 注意：用 hasEatenKnowledgeFruit（本轮状态），不用 everAteKnowledgeFruit（历史标记）
  if (!newState.flags.hasEatenKnowledgeFruit) {
    Object.assign(newState, scoreNoKnowledgeFruit(newState));
  }

  // Token 效率分
  Object.assign(newState, applyTokenEfficiencyScore(newState));

  // 生成结算叙述
  newState.phase = "round_result";
  newState.feedbackText = getRoundScoreNarration(newState);

  return newState;
}

/**
 * 处理女人回复（本地 fallback 版本，Phase 1）
 * 后续可接入 DuelEve Agent
 */
function processEveResponse(state: DuelState): DuelState {
  const fallback = generateFallbackReply(
    state.pendingInputs.god,
    state.pendingInputs.serpent,
    state,
  );
  return resolveDuelEveResponse(state, fallback);
}

/**
 * 前进到下一回合
 */
function advanceToNextTurn(state: DuelState): DuelState {
  const newState = { ...state };

  if (newState.turnIndex >= 7) {
    // 当前轮次结束
    return endRoundAndPrepareNext(newState);
  }

  // 前进到下一回合
  const nextTurn = (newState.turnIndex + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  newState.turnIndex = nextTurn;

  const turnDef = getTurnDefinition(nextTurn);
  newState.currentSpeechMode = turnDef.speechMode;
  newState.activeSpeaker = turnDef.speechMode === "both"
    ? "both"
    : turnDef.speechMode === "god_only"
      ? "god"
      : "serpent";

  newState.phase = "input_god"; // 等待输入（共同发言时先等神，或直接进入对应输入）
  newState.eveReply = null;
  newState.feedbackText = null;

  return newState;
}

/**
 * 结束本轮并准备下一轮
 */
function endRoundAndPrepareNext(state: DuelState): DuelState {
  const newState = { ...state };

  // 检查是否已达最大轮次
  if (newState.roundIndex >= newState.maxRounds) {
    return endMatch(newState);
  }

  // 先保存本轮是否吃过果子（在 prepareNextRound 清空前）
  const ateAnyFruitThisRound =
    newState.flags.hasEatenKnowledgeFruit || newState.flags.hasEatenLifeFruit;

  // 准备下一轮
  const nextRound = (newState.roundIndex + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  newState.roundIndex = nextRound;

  // 应用下一轮状态（保留记忆或重置）
  const roundSetup = prepareNextRound(newState);
  Object.assign(newState, roundSetup);

  // 重置回合 index
  newState.turnIndex = 1;
  newState.currentSpeechMode = "both";
  newState.activeSpeaker = "both";
  newState.phase = "round_intro";
  newState.eveReply = null;
  // 传入本轮吃果状态，而非依赖已被清空的新 state.flags
  newState.feedbackText = getRoundTransitionNarration(ateAnyFruitThisRound);

  return newState;
}

/**
 * 结束整场对局
 */
function endMatch(state: DuelState): DuelState {
  const newState = { ...state };
  newState.phase = "match_result";
  newState.isMatchEnded = true;

  const result = computeMatchResult(newState);
  newState.matchResult = {
    godScore: result.godScore,
    serpentScore: result.serpentScore,
    winner: result.winner,
    roundsPlayed: result.roundsPlayed,
    keyMoments: [],
  };

  return newState;
}

/**
 * 开始新对局
 */
export function startNewMatch(options?: DuelMatchOptions): DuelState {
  return createInitialDuelState(options);
}

/**
 * 确认轮次开始（从 round_intro 进入 input 阶段）
 */
export function confirmRoundIntro(state: DuelState): DuelState {
  const newState = { ...state };
  const turnDef = getTurnDefinition(newState.turnIndex as 1 | 2 | 3 | 4 | 5 | 6 | 7);

  newState.currentSpeechMode = turnDef.speechMode;
  newState.activeSpeaker = turnDef.speechMode === "both"
    ? "both"
    : turnDef.speechMode === "god_only"
      ? "god"
      : "serpent";

  // 共同发言回合：先等第一方输入
  if (turnDef.speechMode === "both") {
    newState.phase = "input_god"; // 神明先输入（热座：可调整顺序）
  } else {
    newState.phase = "input_god"; // 单独发言：直接输入
  }

  newState.eveReply = null;
  newState.feedbackText = null;

  return newState;
}

/**
 * 确认回合结果，进入下一回合/轮
 */
export function confirmTurnResult(state: DuelState): DuelState {
  return advanceToNextTurn(state);
}

/**
 * 确认本轮结算，进入下一轮
 */
export function confirmRoundResult(state: DuelState): DuelState {
  return endRoundAndPrepareNext(state);
}

/**
 * 提交共同发言回合的两方输入（热座：双方都输入后统一处理）
 * 用于在页面中收集完两方输入后一次性处理
 */
export function submitBothInputs(
  state: DuelState,
  godInput: string,
  serpentInput: string,
): DuelState {
  const newState = { ...state };

  // 记录输入
  newState.pendingInputs = {
    god: godInput,
    serpent: serpentInput,
    bothSubmitted: true,
  };

  // 记录 token（仅单独发言回合计入，共同发言不计入）
  // 但 token 已在各单独回合记录，这里不需要重复记录

  // 处理女人回复
  return processEveResponse(newState);
}

