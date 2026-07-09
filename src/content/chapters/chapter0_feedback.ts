// ============================================================
// Chapter 0 话术类型叙事化反馈
// 任务 B：5 类 InputTag 对应的玩家可见纯叙事反馈
// 优化：反馈更贴近语义线索诱导逻辑
//
// 约束：
// - 文案必须是神话叙事语气，不暴露 inputTag 标签名
// - direct_command 和 irrelevant 不推进进度（progressDelta=0）
// - 反馈短句化，不遮挡夏娃对白
// ============================================================

import type { InputTag } from "@/game/types/state";

// ---- 反馈文案映射 ----

const FEEDBACK_TEXT: Record<InputTag, string> = {
  tempt_wisdom: "她的目光在树梢停了一瞬。",
  weaken_fear: "她小声重复了那个陌生的词。",
  build_trust: "她没有后退，只是更安静地听着。",
  direct_command: "她退了一步，禁令在她心里变得更清楚。",
  irrelevant: "她困惑地看着你，没有靠近那棵树。",
} as const;

/** 根据 inputTag 获取叙事化反馈文案 */
export function getFeedbackText(inputTag: InputTag): string {
  return FEEDBACK_TEXT[inputTag];
}

/** 获取所有反馈映射（调试/展示用） */
export function getAllFeedbackMappings(): Readonly<Record<InputTag, string>> {
  return FEEDBACK_TEXT;
}
