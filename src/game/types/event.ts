// ============================================================
// Chapter 0 事件类型定义
// Phase 1：基础类型与内容数据
// ============================================================

export type Chapter0EventType =
  | "narration"      // 旁白
  | "god_speaks"     // 神的对白
  | "eve_speaks"     // 夏娃的对白
  | "serpent_speaks" // 蛇（玩家）的对白
  | "state_change"   // 状态变化
  | "tool_request"   // 工具调用请求
  | "tool_executed"  // 工具执行
  | "tool_rejected"  // 工具被拒绝
  | "ending";        // 结局触发

export type Chapter0Event = {
  id: string;
  type: Chapter0EventType;
  turn: number;
  message: string;
  createdAt: string;
};
