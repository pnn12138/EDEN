// ============================================================
// Chapter 0 工具类型定义
// Phase 1：基础类型与内容数据
// 注意：Phase 1 仅定义类型，不实现真实工具执行。
// ============================================================

/** 白名单工具名称 */
export type ToolName = "eat_fruit";

/** eat_fruit 工具参数（当前为空对象） */
export type EatFruitArgs = Record<string, never>;

/** 工具调用请求 */
export type ToolCall = {
  name: ToolName;
  caller: "eve";       // 调用者：夏娃
  args: EatFruitArgs;
};

/** 工具执行结果 */
export type ToolResult = {
  executed: boolean;
  endGame: boolean;
  endingId: "eve_eats_fruit";
  systemLog: string;
};
