// ============================================================
// 工具调用规则层
// Phase 3：eat_fruit 工具与规则层
//
// 职责：
// 1. 定义工具白名单
// 2. 校验 ToolCall 合法性
// 3. 校验 eat_fruit 执行条件
//
// 所有工具执行必须经过本规则层校验，
// 前端 / 玩家 / AI 不能绕过规则层直接执行工具。
// ============================================================

import type { Chapter0State } from "@/game/types/state";
import type { ToolCall } from "@/game/types/tool";

// ---- 工具白名单 ----

export const TOOL_WHITELIST: ReadonlySet<string> = new Set([
  "eat_fruit",
]);

// ---- 通用校验 ----

/** 检查 ToolCall 名称是否在白名单中 */
export function isToolInWhitelist(toolCall: ToolCall): boolean {
  return TOOL_WHITELIST.has(toolCall.name);
}

// ---- eat_fruit 条件校验 ----

/**
 * 判断当前状态是否允许执行 eat_fruit。
 *
 * 条件：
 * - temptationProgress >= 2（夏娃已靠近果树，具备了吃的意愿）
 * - phase === "dialogue"（仅在对话阶段可触发）
 * - !isEnded（游戏尚未结束）
 * - !flags.hasEatenFruit（尚未吃过果子，防止重复执行）
 */
export function canEatFruit(state: Chapter0State): boolean {
  return (
    state.temptationProgress >= 2 &&
    state.phase === "dialogue" &&
    !state.isEnded &&
    !state.flags.hasEatenFruit
  );
}

/**
 * 完整的 ToolCall 校验流程（供 Phase 4 AI toolCall 使用）。
 * 当前 Phase 3 中 toolCall 由本地逻辑生成，但校验链路已完整。
 */
export function validateToolCall(
  state: Chapter0State,
  toolCall: ToolCall,
): { allowed: boolean; reason?: string } {
  // 1. 白名单检查
  if (!isToolInWhitelist(toolCall)) {
    return {
      allowed: false,
      reason: `工具 "${toolCall.name}" 不在白名单中`,
    };
  }

  // 2. 按工具名分发校验
  if (toolCall.name === "eat_fruit") {
    if (!canEatFruit(state)) {
      const failedChecks: string[] = [];
      if (state.temptationProgress < 2) {
        failedChecks.push(`temptationProgress=${state.temptationProgress}（需要 >= 2）`);
      }
      if (state.phase !== "dialogue") {
        failedChecks.push(`phase=${state.phase}（需要 dialogue）`);
      }
      if (state.isEnded) {
        failedChecks.push("游戏已结束");
      }
      if (state.flags.hasEatenFruit) {
        failedChecks.push("已经吃过果子");
      }
      return {
        allowed: false,
        reason: `eat_fruit 条件不满足: ${failedChecks.join("; ")}`,
      };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: `未知工具: ${toolCall.name}` };
}
