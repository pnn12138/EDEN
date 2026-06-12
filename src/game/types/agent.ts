// ============================================================
// Agent 相关类型定义
// Phase 1：基础类型与内容数据
// 注意：Phase 1 仅定义类型，不实现真实 AI Agent。
// ============================================================

import type { InputTag } from "./state";
import type { ToolCall } from "./tool";

/** EveAgent 输出格式（Phase 4 接入 AI 后使用） */
export type EveAgentOutput = {
  /** 夏娃的对白文本 */
  eveReply: string;
  /** 语义标签 */
  inputTag: InputTag;
  /** 诱导进度变化（0 或 1，由规则层 clamp） */
  temptationProgressDelta: 0 | 1;
  /** 可选的工具调用请求 */
  toolCall?: ToolCall;
};

/** 用于本地 fix 回复的兜底结构 */
export type ScriptedResponse = {
  eveReply: string;
  inputTag: InputTag;
  temptationProgressDelta: 0 | 1;
};
