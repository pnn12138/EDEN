// ============================================================
// Chapter 0 事件类型定义
// Phase 1 → Agent 架构升级：新增记忆检索与工具链事件
// ============================================================

export type Chapter0EventType =
  | "narration"        // 旁白
  | "god_speaks"       // 神的对白
  | "eve_speaks"       // 夏娃的对白
  | "serpent_speaks"   // 蛇（玩家）的对白
  | "adam_speaks"      // 亚当的对白
  | "state_change"     // 状态变化
  | "tool_request"     // 工具调用请求
  | "tool_executed"    // 工具执行
  | "tool_rejected"    // 工具被拒绝
  | "memory_retrieved" // 记忆碎片被检索
  | "skill_unlocked"   // 认知能力觉醒
  | "belief_change"    // 信念状态变化
  | "ending";          // 结局触发

export type Chapter0Event = {
  id: string;
  type: Chapter0EventType;
  turn: number;
  message: string;
  createdAt: string;
};
