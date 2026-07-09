// ============================================================
// 工具调用规则层
// Phase 3 → Agent 架构升级：扩展工具链校验
//
// 职责：
// 1. 定义工具白名单（含新增工具）
// 2. 校验 ToolCall 合法性（白名单 + 权限 + phase + 状态门槛）
// 3. 按 Agent 权限校验（EveAgent / AdamAgent 允许的工具不同）
//
// 所有工具执行必须经过本规则层校验，
// 前端 / 玩家 / AI 不能绕过规则层直接执行工具。
// ============================================================

import type { Chapter0State } from "@/game/types/state";
import type { ToolCall, ToolName } from "@/game/types/tool";
import { AGENT_TOOL_PERMISSIONS } from "@/game/types/agent";
import {
  canLookAtTree,
  canApproachTree,
  canTouchFruit,
  canAskAboutDeath,
} from "@/game/tools/agentTools";

// re-export condition checkers for external use
export {
  canLookAtTree,
  canApproachTree,
  canTouchFruit,
  canAskAboutDeath,
} from "@/game/tools/agentTools";

// ---- 工具白名单 ----

export const TOOL_WHITELIST: ReadonlySet<string> = new Set([
  "eat_fruit",
  "look_at_tree",
  "approach_tree",
  "touch_fruit",
  "ask_about_death",
]);

// ---- 通用校验 ----

/** 检查 ToolCall 名称是否在白名单中 */
export function isToolInWhitelist(toolCall: ToolCall): boolean {
  return TOOL_WHITELIST.has(toolCall.name);
}

/**
 * 检查工具调用者是否有权限请求该工具。
 */
export function isToolAllowedForAgent(
  toolName: string,
  agentId: "eve" | "adam" | "hedgehog" | "god",
): boolean {
  const permission = AGENT_TOOL_PERMISSIONS[agentId];
  if (!permission) return false;
  if (permission.forbiddenTools.includes(toolName)) return false;
  return permission.allowedTools.includes(toolName);
}

// ---- 各工具条件校验 ----

/**
 * 判断当前状态是否允许执行 eat_fruit。
 *
 * 条件：
 * - temptationProgress >= 2（兼容字段）
 * - phase === "dialogue"
 * - !isEnded
 * - !flags.hasEatenFruit
 *
 * Agent 架构升级补充：
 * - belief.selfJudgement >= 60 或 temptationProgress >= 2（满足其一即可）
 * - 已解锁 self_judge skill 或 belief.selfJudgement >= 70
 */
export function canEatFruitEnhanced(state: Chapter0State): boolean {
  const baseCondition =
    state.phase === "dialogue" &&
    !state.isEnded &&
    !state.flags.hasEatenFruit;

  if (!baseCondition) return false;

  // 兼容旧逻辑：temptationProgress >= 2 仍可触发
  const progressCondition = state.temptationProgress >= 2;

  // 新逻辑：信念状态满足条件也可触发
  const beliefCondition =
    state.belief.selfJudgement >= 60 &&
    state.belief.curiosity >= 50 &&
    (state.unlockedSkills.includes("self_judge") || state.belief.selfJudgement >= 70);

  return progressCondition || beliefCondition;
}

/**
 * 检查指定工具的执行条件。
 */
export function canExecuteTool(state: Chapter0State, toolName: ToolName): boolean {
  switch (toolName) {
    case "eat_fruit":
      return canEatFruitEnhanced(state);
    case "look_at_tree":
      return canLookAtTree(state);
    case "approach_tree":
      return canApproachTree(state);
    case "touch_fruit":
      return canTouchFruit(state);
    case "ask_about_death":
      return canAskAboutDeath(state);
    default:
      return false;
  }
}

// ---- 完整校验流程 ----

/**
 * 完整的 ToolCall 校验流程。
 *
 * 校验步骤：
 * 1. 白名单检查
 * 2. Agent 权限检查（如果提供 agentId）
 * 3. 按工具名分发条件校验
 */
export function validateToolCall(
  state: Chapter0State,
  toolCall: ToolCall,
  agentId?: "eve" | "adam" | "hedgehog" | "god",
): { allowed: boolean; reason?: string } {
  // 1. 白名单检查
  if (!isToolInWhitelist(toolCall)) {
    return {
      allowed: false,
      reason: `工具 "${toolCall.name}" 不在白名单中`,
    };
  }

  // 2. Agent 权限检查
  if (agentId && !isToolAllowedForAgent(toolCall.name, agentId)) {
    return {
      allowed: false,
      reason: `Agent "${agentId}" 无权请求工具 "${toolCall.name}"`,
    };
  }

  // 3. 按工具名分发校验
  const failedChecks: string[] = [];

  switch (toolCall.name) {
    case "eat_fruit": {
      if (!canEatFruitEnhanced(state)) {
        if (state.temptationProgress < 2 && state.belief.selfJudgement < 60) {
          failedChecks.push(`temptationProgress=${state.temptationProgress}（需要 >= 2）或 selfJudgement=${state.belief.selfJudgement}（需要 >= 60）`);
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
        if (state.temptationProgress >= 2 && state.belief.selfJudgement < 60 && !state.unlockedSkills.includes("self_judge")) {
          failedChecks.push("self_judge skill 未解锁");
        }
      }
      break;
    }

    case "look_at_tree": {
      if (!canLookAtTree(state)) {
        if (state.flags.hasLookedAtTree) {
          failedChecks.push("已经看过树了");
        }
        if (state.phase !== "dialogue") {
          failedChecks.push(`phase=${state.phase}（需要 dialogue）`);
        }
        if (state.isEnded) {
          failedChecks.push("游戏已结束");
        }
      }
      break;
    }

    case "approach_tree": {
      if (!canApproachTree(state)) {
        if (state.flags.hasApproachedTree) {
          failedChecks.push("已经靠近树了");
        }
        if (state.belief.curiosity < 40) {
          failedChecks.push(`curiosity=${state.belief.curiosity}（需要 >= 40）`);
        }
        if (state.belief.obedience >= 70) {
          failedChecks.push(`obedience=${state.belief.obedience}（需要 < 70）`);
        }
        if (!state.unlockedSkills.includes("self_judge") && state.belief.curiosity < 50) {
          failedChecks.push("需要 self_judge skill 或 curiosity >= 50");
        }
      }
      break;
    }

    case "touch_fruit": {
      if (!canTouchFruit(state)) {
        if (!state.flags.hasApproachedTree) {
          failedChecks.push("需要先靠近树（approach_tree）");
        }
        if (state.belief.selfJudgement < 50) {
          failedChecks.push(`selfJudgement=${state.belief.selfJudgement}（需要 >= 50）`);
        }
        if (state.belief.curiosity < 50) {
          failedChecks.push(`curiosity=${state.belief.curiosity}（需要 >= 50）`);
        }
      }
      break;
    }

    case "ask_about_death": {
      if (!canAskAboutDeath(state)) {
        if (state.phase !== "dialogue") {
          failedChecks.push(`phase=${state.phase}（需要 dialogue）`);
        }
        if (state.isEnded) {
          failedChecks.push("游戏已结束");
        }
      }
      break;
    }

    default:
      return { allowed: false, reason: `未知工具: ${toolCall.name}` };
  }

  if (failedChecks.length > 0) {
    return {
      allowed: false,
      reason: `${toolCall.name} 条件不满足: ${failedChecks.join("; ")}`,
    };
  }

  return { allowed: true };
}
