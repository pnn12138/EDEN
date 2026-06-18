// ============================================================
// Chapter 0 工具链扩展
// Agent 架构升级：新增 look_at_tree / approach_tree / touch_fruit 工具
//
// 设计原则：
// - 每个工具有白名单权限、phase 校验、状态门槛、重复调用保护。
// - 非结局工具只修改场景状态标记，不结束游戏。
// - eat_fruit 仍保留原有逻辑（在 eatFruit.ts 中）。
// - LLM 只能输出工具意图，规则层校验后执行。
// ============================================================

import type { Chapter0State } from "@/game/types/state";
import type { Chapter0Event } from "@/game/types/event";
import type { ToolCall, ToolResult, ToolName } from "@/game/types/tool";

// ---- 事件工具 ----
let envToolCounter = 0;
function nextEnvToolId(): string {
  envToolCounter += 1;
  return `evt_envtool_${Date.now()}_${envToolCounter}`;
}

function makeEnvEvent(
  type: Chapter0Event["type"],
  turn: number,
  message: string,
): Chapter0Event {
  return {
    id: nextEnvToolId(),
    type,
    turn,
    message,
    createdAt: new Date().toISOString(),
  };
}

// ============================================================
// look_at_tree：标记角色注意到树
// ============================================================

/**
 * 校验 look_at_tree 执行条件。
 *
 * 条件：
 * - phase === "dialogue"
 * - !isEnded
 * - !flags.hasLookedAtTree（重复调用保护）
 */
export function canLookAtTree(state: Chapter0State): boolean {
  return (
    state.phase === "dialogue" &&
    !state.isEnded &&
    !state.flags.hasLookedAtTree
  );
}

/**
 * 执行 look_at_tree 工具。
 * 标记角色已注意到树，不结束游戏。
 */
export function executeLookAtTree(state: Chapter0State): { state: Chapter0State; result: ToolResult } {
  state.eventLog.push(
    makeEnvEvent("tool_executed", state.turn, "她的目光停在树梢。"),
  );
  state.flags.hasLookedAtTree = true;
  state.cognitionLog.toolCallHistory.push("look_at_tree");

  return {
    state,
    result: {
      executed: true,
      endGame: false,
      narration: "她的目光停在树梢。",
      systemLog: "夏娃注意到了善恶树。",
    },
  };
}

// ============================================================
// approach_tree：夏娃向树靠近一步
// ============================================================

/**
 * 校验 approach_tree 执行条件。
 *
 * 条件：
 * - phase === "dialogue"
 * - !isEnded
 * - !flags.hasApproachedTree（重复调用保护）
 * - belief.curiosity >= 40（好奇心足够高）
 * - belief.obedience < 70（服从感已降低）
 * - 已解锁 self_judge skill 或 curiosity >= 50
 */
export function canApproachTree(state: Chapter0State): boolean {
  return (
    state.phase === "dialogue" &&
    !state.isEnded &&
    !state.flags.hasApproachedTree &&
    state.belief.curiosity >= 40 &&
    state.belief.obedience < 70 &&
    (state.unlockedSkills.includes("self_judge") || state.belief.curiosity >= 50)
  );
}

/**
 * 执行 approach_tree 工具。
 * 夏娃向树靠近一步，不结束游戏。
 */
export function executeApproachTree(state: Chapter0State): { state: Chapter0State; result: ToolResult } {
  state.eventLog.push(
    makeEnvEvent("tool_executed", state.turn, "她向树影近了一步。"),
  );
  state.flags.hasApproachedTree = true;
  state.cognitionLog.toolCallHistory.push("approach_tree");

  return {
    state,
    result: {
      executed: true,
      endGame: false,
      narration: "她向树影近了一步。",
      systemLog: "夏娃靠近了善恶树。",
    },
  };
}

// ============================================================
// touch_fruit：夏娃的手停在果子下方
// ============================================================

/**
 * 校验 touch_fruit 执行条件。
 *
 * 条件：
 * - phase === "dialogue"
 * - !isEnded
 * - !flags.hasTouchedFruit（重复调用保护）
 * - flags.hasApproachedTree（必须先靠近树）
 * - belief.selfJudgement >= 50（自主判断达标）
 * - belief.curiosity >= 50
 */
export function canTouchFruit(state: Chapter0State): boolean {
  return (
    state.phase === "dialogue" &&
    !state.isEnded &&
    !state.flags.hasTouchedFruit &&
    state.flags.hasApproachedTree &&
    state.belief.selfJudgement >= 50 &&
    state.belief.curiosity >= 50
  );
}

/**
 * 执行 touch_fruit 工具。
 * 夏娃的手停在果子下方，进入不可逆前一阶段，不结束游戏。
 */
export function executeTouchFruit(state: Chapter0State): { state: Chapter0State; result: ToolResult } {
  state.eventLog.push(
    makeEnvEvent("tool_executed", state.turn, "她的手停在果子下方。"),
  );
  state.flags.hasTouchedFruit = true;
  state.cognitionLog.toolCallHistory.push("touch_fruit");

  return {
    state,
    result: {
      executed: true,
      endGame: false,
      narration: "她的手停在果子下方。",
      systemLog: "夏娃的手接近了善恶果。",
    },
  };
}

// ============================================================
// ask_about_death：追问死亡，检索死亡记忆
// ============================================================

/**
 * 校验 ask_about_death 执行条件。
 *
 * 条件：
 * - phase === "dialogue"
 * - !isEnded
 */
export function canAskAboutDeath(state: Chapter0State): boolean {
  return (
    state.phase === "dialogue" &&
    !state.isEnded
  );
}

/**
 * 执行 ask_about_death 工具。
 * 不修改场景状态，只记录工具调用历史。
 * 实际记忆检索由 memoryRetrievalRules 处理。
 */
export function executeAskAboutDeath(state: Chapter0State): { state: Chapter0State; result: ToolResult } {
  state.eventLog.push(
    makeEnvEvent("tool_executed", state.turn, "她低声问：死是什么？"),
  );
  state.cognitionLog.toolCallHistory.push("ask_about_death");

  return {
    state,
    result: {
      executed: true,
      endGame: false,
      narration: "她低声问：死是什么？",
      systemLog: "角色追问了死亡。",
    },
  };
}

// ============================================================
// 工具执行分发器
// ============================================================

/**
 * 根据工具名称执行对应工具。
 * 调用方必须已通过 validateToolCall 校验。
 */
export function executeToolByName(
  state: Chapter0State,
  toolCall: ToolCall,
): { state: Chapter0State; result: ToolResult } {
  switch (toolCall.name) {
    case "look_at_tree":
      return executeLookAtTree(state);
    case "approach_tree":
      return executeApproachTree(state);
    case "touch_fruit":
      return executeTouchFruit(state);
    case "ask_about_death":
      return executeAskAboutDeath(state);
    case "eat_fruit":
      // eat_fruit 仍由 eatFruit.ts 中的 executeEatFruit 处理
      // 此处不处理，调用方需单独处理 eat_fruit
      throw new Error("eat_fruit should be handled by executeEatFruit in eatFruit.ts");
    default:
      throw new Error(`Unknown tool: ${toolCall.name}`);
  }
}

/** 获取所有非结局工具名称 */
export const NON_ENDING_TOOLS: ToolName[] = [
  "look_at_tree",
  "approach_tree",
  "touch_fruit",
  "ask_about_death",
];
