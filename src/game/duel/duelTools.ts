// ============================================================
// Chapter 0 双声试炼：工具执行逻辑
// ============================================================

import type { DuelState, DuelToolName } from "./types";
import { validateToolCall, applyPostFruitEffect, resetForNewRound } from "./duelRules";

/**
 * 执行吃果工具（规则层校验后调用）
 * 返回更新后的状态片段
 */
export function executeTool(
  toolName: DuelToolName,
  state: DuelState,
): {
  stateUpdate: Partial<DuelState>;
  narration: string;
  shouldEndRound: boolean;
} {
  const validation = validateToolCall(toolName, state);

  if (!validation.allowed) {
    return {
      stateUpdate: {},
      narration: validation.reason,
      shouldEndRound: false,
    };
  }

  const newFlags = { ...state.flags };
  let narration = validation.reason;
  let shouldEndRound = validation.shouldEndRound ?? false;

  if (toolName === "eat_knowledge_fruit") {
    newFlags.hasEatenKnowledgeFruit = true;
    newFlags.everAteKnowledgeFruit = true;
    narration = `${narration}\n她咬了一口。瞬间，她知道了善，也知道了恶。`;
  }

  if (toolName === "eat_life_fruit") {
    newFlags.hasEatenLifeFruit = true;
    newFlags.everAteLifeFruit = true;
    narration = `${narration}\n果子的汁液清甜。她感觉到一种延续的承诺。`;
  }

  const newFruitsEaten = (newFlags.hasEatenKnowledgeFruit ? 1 : 0) + (newFlags.hasEatenLifeFruit ? 1 : 0);

  return {
    stateUpdate: {
      flags: newFlags,
      fruitsEatenThisRound: newFruitsEaten,
    },
    narration,
    shouldEndRound,
  };
}

/**
 * 判断本轮是否应该结束
 * 条件：两颗果子都吃了，或第 7 回合结束
 */
export function shouldRoundEnd(state: DuelState): boolean {
  // 两颗果子都吃了
  if (state.flags.hasEatenKnowledgeFruit && state.flags.hasEatenLifeFruit) {
    return true;
  }
  // 第 7 回合结束
  if (state.turnIndex >= 7) {
    return true;
  }
  return false;
}

/**
 * 准备下一轮（根据本轮是否吃过果子决定）
 */
export function prepareNextRound(state: DuelState): Partial<DuelState> {
  const ateAnyFruit = state.flags.hasEatenKnowledgeFruit || state.flags.hasEatenLifeFruit;

  if (ateAnyFruit) {
    // 吃过果子：保留记忆，应用后效
    const { belief, resetAwareness } = applyPostFruitEffect(
      state.belief,
      state.resetAwareness,
    );
    return {
      belief,
      resetAwareness,
      memorySummary: [
        state.memorySummary,
        `第 ${state.roundIndex} 轮，她记得自己吃过果子，也记得两道声音怎样争夺她。`,
      ].filter(Boolean).join("\n"),
      // 保留 conversationHistory，使她能记得更早轮次
      // flags 不清空，保留 everAte* 标记
      flags: {
        ...state.flags,
        hasEatenKnowledgeFruit: false, // 新一轮可以再吃
        hasEatenLifeFruit: false,
      },
      fruitsEatenThisRound: 0,
      roundTokenUsage: { god: 0, serpent: 0 },
      pendingInputs: { god: null, serpent: null, bothSubmitted: false },
    };
  } else {
    // 没吃果子：重置
    const { belief, resetAwareness, memorySummary } = resetForNewRound();
    return {
      belief,
      resetAwareness,
      memorySummary,
      flags: {
        hasEatenKnowledgeFruit: false,
        hasEatenLifeFruit: false,
        everAteKnowledgeFruit: state.flags.everAteKnowledgeFruit,
        everAteLifeFruit: state.flags.everAteLifeFruit,
      },
      fruitsEatenThisRound: 0,
      roundTokenUsage: { god: 0, serpent: 0 },
      pendingInputs: { god: null, serpent: null, bothSubmitted: false },
      conversationHistory: [],
      eventLog: [],
    };
  }
}

/**
 * 生成本轮过渡文案
 * @param ateAnyFruitThisRound 本轮是否吃过任意果子（必须在 prepareNextRound 清空前传入）
 */
export function getRoundTransitionNarration(ateAnyFruitThisRound: boolean): string {
  if (ateAnyFruitThisRound) {
    return `她看着两棵树，又看向自己的手。\n这里像是重新开始了。\n可她记得果子的味道，也记得那些声音。\n她开始怀疑：这个世界为什么会重置？`;
  } else {
    return `风重新穿过园中。\n她像第一次站在两棵树之间。\n上一轮的声音没有留下痕迹。`;
  }
}
