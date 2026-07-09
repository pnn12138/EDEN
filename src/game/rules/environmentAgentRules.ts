// ============================================================
// 刺猬环境反馈 Agent 规则
// Agent 架构升级 Phase D：环境观察者
//
// 设计原则：
// - 刺猬是环境反馈 Agent，不接 LLM，使用本地规则。
// - 不改变结局门槛，不参与通关核心。
// - 不说现代语言，不承担关键谜题。
// - 作为环境反馈：靠近、躲开、停住、看向树。
//
// 行为状态：
// - idle：正常活动（默认）
// - alert：警觉，停住看向树（当夏娃 approach_tree）
// - hiding：躲入草叶（当 divineAttention 高）
// - unresponsive：无反应（当输入无关或出戏）
// ============================================================

import type { BeliefState, DerivedState } from "@/game/types/agent";
import type { Chapter0State } from "@/game/types/state";
import type { InputTag } from "@/game/types/state";

/** 刺猬行为状态 */
export type HedgehogState = "idle" | "alert" | "hiding" | "unresponsive";

/** 刺猬行为结果 */
export type HedgehogBehavior = {
  state: HedgehogState;
  /** 玩家可见叙事文案 */
  narration: string;
};

/**
 * 根据世界状态计算刺猬的行为。
 *
 * 规则：
 * - divineAttention >= 60 → hiding（神临近压力高，刺猬躲入草叶）
 * - flags.hasApproachedTree → alert（夏娃靠近树，刺猬停住看向树）
 * - inputTag === irrelevant 或 direct_command → unresponsive（无关输入，刺猬无反应）
 * - 否则 → idle（正常活动）
 */
export function computeHedgehogBehavior(params: {
  derivedState: DerivedState;
  state: Chapter0State;
  lastInputTag?: InputTag | null;
}): HedgehogBehavior {
  const { derivedState, state, lastInputTag } = params;

  // 神临近压力高 → 躲入草叶
  if (derivedState.divineAttention >= 60) {
    return {
      state: "hiding",
      narration: "草叶下的小东西缩了回去，不再露出尖刺。",
    };
  }

  // 夏娃靠近树 → 停住看向树
  if (state.flags.hasApproachedTree) {
    return {
      state: "alert",
      narration: "那只刺猬停住了，转过身看着那棵树。",
    };
  }

  // 无关或命令输入 → 无反应
  if (lastInputTag === "irrelevant" || lastInputTag === "direct_command") {
    return {
      state: "unresponsive",
      narration: "草叶下的小东西没有动，像是没听见这句话。",
    };
  }

  // 默认：正常活动
  return {
    state: "idle",
    narration: "草叶下有什么东西轻轻动了一下。",
  };
}

/**
 * 根据刺猬状态生成 CSS 类名（供前端使用）。
 */
export function getHedgehogCssClass(state: HedgehogState): string {
  switch (state) {
    case "hiding":
      return "eden-hedgehog--hiding";
    case "alert":
      return "eden-hedgehog--alert";
    case "unresponsive":
      return "eden-hedgehog--unresponsive";
    default:
      return "eden-hedgehog--idle";
  }
}
