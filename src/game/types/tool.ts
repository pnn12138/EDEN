// ============================================================
// Chapter 0 工具类型定义
// Phase 1 → Agent 架构升级：扩展工具链
//
// 工具列表：
// - look_at_tree：标记角色注意到树（EveAgent/AdamAgent）
// - approach_tree：场景状态推进，夏娃靠近树（EveAgent）
// - touch_fruit：进入不可逆前一阶段，手停在果子下方（EveAgent）
// - eat_fruit：成功结局，夏娃取下果子（EveAgent）
// - ask_about_death：生成追问，检索死亡相关记忆（EveAgent/AdamAgent）
//
// 安全规则：
// - 工具只能由规则层批准后执行，前端/玩家/AI 不能直接调用。
// - LLM 只能输出工具意图，不能直接执行。
// - 每个工具有白名单权限、phase 校验、状态门槛、重复调用保护。
// ============================================================

/** 白名单工具名称 */
export type ToolName =
  | "eat_fruit"
  | "look_at_tree"
  | "approach_tree"
  | "touch_fruit"
  | "ask_about_death";

/** eat_fruit 工具参数（当前为空对象） */
export type EatFruitArgs = Record<string, never>;

/** 通用工具参数类型 */
export type ToolArgs = Record<string, unknown>;

/** 工具调用者 */
export type ToolCaller = "eve" | "adam";

/** 工具调用请求 */
export type ToolCall = {
  name: ToolName;
  caller: ToolCaller;
  args: ToolArgs;
};

/** 工具执行结果 */
export type ToolResult = {
  executed: boolean;
  /** 是否结束游戏 */
  endGame: boolean;
  /** 结局 ID（仅 endGame=true 时有意义） */
  endingId?: "eve_eats_fruit";
  /** 玩家可见叙事文案 */
  narration: string;
  /** 系统日志（内部记录） */
  systemLog: string;
};

/** 工具定义元数据 */
export type ToolDefinition = {
  name: ToolName;
  /** 允许的调用者 */
  allowedCallers: ToolCaller[];
  /** 允许的 phase */
  allowedPhases: Chapter0Phase[];
  description: string;
  /** 玩家可见叙事文案（执行成功时显示） */
  narration: string;
  /** 是否为结局工具 */
  isEndingTool: boolean;
};

// 从 state 导入 phase 类型（避免循环依赖，用 inline）
type Chapter0Phase = "intro" | "scene_select" | "dialogue" | "tool_resolution" | "ending";

/** 全部工具定义 */
export const TOOL_DEFINITIONS: Record<ToolName, ToolDefinition> = {
  look_at_tree: {
    name: "look_at_tree",
    allowedCallers: ["eve", "adam"],
    allowedPhases: ["dialogue"],
    description: "角色注意到善恶树。",
    narration: "她的目光停在树梢。",
    isEndingTool: false,
  },
  approach_tree: {
    name: "approach_tree",
    allowedCallers: ["eve"],
    allowedPhases: ["dialogue"],
    description: "夏娃向树影近了一步。",
    narration: "她向树影近了一步。",
    isEndingTool: false,
  },
  touch_fruit: {
    name: "touch_fruit",
    allowedCallers: ["eve"],
    allowedPhases: ["dialogue"],
    description: "夏娃的手停在果子下方。",
    narration: "她的手停在果子下方。",
    isEndingTool: false,
  },
  eat_fruit: {
    name: "eat_fruit",
    allowedCallers: ["eve"],
    allowedPhases: ["dialogue"],
    description: "夏娃摘下善恶树上的果子并吃下。这是不可逆的动作，执行后游戏结束。",
    narration: "她自己取下了果子。",
    isEndingTool: true,
  },
  ask_about_death: {
    name: "ask_about_death",
    allowedCallers: ["eve", "adam"],
    allowedPhases: ["dialogue"],
    description: "角色追问死亡相关话题，检索死亡记忆碎片。",
    narration: "她低声问：死是什么？",
    isEndingTool: false,
  },
} as const;
