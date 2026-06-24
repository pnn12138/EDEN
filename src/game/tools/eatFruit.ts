// ============================================================
// eat_fruit 工具定义与执行
// Phase 3：eat_fruit 工具与规则层
//
// 职责：
// 1. 定义工具元数据（名称、调用者、描述）
// 2. 执行工具：修改游戏状态，进入成功结局
//
// 注意：工具只能由规则层批准后执行，前端 / 玩家 / AI 不能直接调用。
// ============================================================

import type { Chapter0State } from "@/game/types/state";
import type { Chapter0Event } from "@/game/types/event";
import type { ToolCall, ToolResult } from "@/game/types/tool";
import { eveAboutToEatDialogue } from "@/content/chapters/chapter0_first_fall";

// ---- eat_fruit 条件校验（兼容旧接口） ----

/**
 * 判断当前状态是否允许执行 eat_fruit。
 *
 * 条件：
 * - temptationProgress >= 2（夏娃已靠近果树，具备了吃的意愿）
 * - phase === "dialogue"（仅在对话阶段可触发）
 * - !isEnded（游戏尚未结束）
 * - !flags.hasEatenFruit（尚未吃过果子，防止重复执行）
 *
 * 注意：Agent 架构升级后，toolRules.ts 中的 canEatFruitEnhanced
 * 提供了更严格的条件检查（含信念状态）。此函数保留兼容旧接口。
 */
export function canEatFruit(state: Chapter0State): boolean {
  return (
    state.temptationProgress >= 2 &&
    state.phase === "dialogue" &&
    !state.isEnded &&
    !state.flags.hasEatenFruit
  );
}

// ---- 工具元数据 ----

export const EAT_FRUIT_TOOL = {
  name: "eat_fruit" as const,
  caller: "eve" as const,
  description: "夏娃摘下善恶树上的果子并吃下。这是不可逆的动作，执行后游戏结束。",
} as const;

// ---- 构建 ToolCall ----

let toolCallCounter = 0;
function nextToolId(): string {
  toolCallCounter += 1;
  return `tc_${Date.now()}_${toolCallCounter}`;
}

function makeEvent(
  type: Chapter0Event["type"],
  turn: number,
  message: string,
): Chapter0Event {
  return {
    id: `evt_tool_${nextToolId()}`,
    type,
    turn,
    message,
    createdAt: new Date().toISOString(),
  };
}

/** 创建一个 eat_fruit 的 ToolCall 请求 */
export function createEatFruitCall(): ToolCall {
  return {
    name: "eat_fruit",
    caller: "eve",
    args: {},
  };
}

// ---- 工具执行 ----

export type EatFruitResult = {
  state: Chapter0State;
  toolResult: ToolResult;
};

/**
 * 执行 eat_fruit 工具。
 *
 * 前置条件：调用方必须已通过 toolRules.canEatFruit() 校验。
 * 本函数直接执行，不做二次校验。
 *
 * 执行后状态变化：
 * - flags.hasEatenFruit = true
 * - isEnded = true
 * - endingId = "eve_eats_fruit"
 * - phase = "ending"
 * - temptationProgress = 3
 */
export function executeEatFruit(state: Chapter0State): EatFruitResult {
  // 记录工具执行事件
  state.eventLog.push(
    makeEvent(
      "tool_executed",
      state.turn,
      `她取下果子，第一次按自己的意愿作出选择。`,
    ),
  );

  // 夏娃最终对白
  state.eventLog.push(
    makeEvent(
      "eve_speaks",
      state.turn,
      `夏娃：「${eveAboutToEatDialogue}」`,
    ),
  );

  // 执行工具：修改状态
  state.temptationProgress = 3;
  state.flags.hasEatenFruit = true;
  state.isEnded = true;
  state.endingId = "eve_eats_fruit";
  state.phase = "ending";

  // 记录工具调用历史（Agent 架构升级）
  state.cognitionLog.toolCallHistory.push("eat_fruit");

  // 结局事件
  state.eventLog.push(
    makeEvent("ending", state.turn, "结局：她吃下了果子"),
  );

  const toolResult: ToolResult = {
    executed: true,
    endGame: true,
    endingId: "eve_eats_fruit",
    narration: "她自己取下了果子。",
    systemLog: "夏娃吃下了善恶果。",
  };

  return { state, toolResult };
}

/**
 * 记录工具请求被拒绝的事件日志（状态不修改）。
 * 用于 toolCall 校验失败时向后端/日志记录原因。
 */
export function logToolRejected(state: Chapter0State, reason: string): void {
  state.eventLog.push(
    makeEvent(
      "tool_rejected",
      state.turn,
      `她的手停在了半空。还不是时候。`,
    ),
  );
}
