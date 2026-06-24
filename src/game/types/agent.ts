// ============================================================
// Agent 相关类型定义
// Phase 1 → Agent 架构升级：统一 Agent 设计与认知博弈数据模型
//
// 本文件定义：
// - BeliefState：四轴信念状态（curiosity / obedience / trustInSerpent / selfJudgement）
// - 派生状态：riskAwareness / divineAttention
// - AgentSkill：认知能力觉醒
// - MemoryFragment：本地结构化记忆碎片
// - AgentToolPermission：工具权限
// - AgentTurnOutput：统一 Agent 回合输出协议
// - EveAgentOutput / AdamAgentOutput / ScriptedResponse（保留兼容）
//
// 设计原则：
// - 保留 temptationProgress 作为兼容字段，短期不删除。
// - LLM 只能输出意图（beliefDelta / toolCall / perceivedIntent），不能直接改最终状态。
// - 规则层是信念更新和工具执行的唯一权威。
// ============================================================

import type { InputTag } from "./state";
import type { ToolCall } from "./tool";

// ============================================================
// 四轴信念状态
// ============================================================

/**
 * 四轴信念状态——取代单一 temptationProgress 的核心认知模型。
 *
 * 范围均为 0-100，由 beliefRules 规则层根据输入和 Agent 输出更新。
 * temptationProgress 作为兼容字段保留，由四轴派生。
 */
export type BeliefState = {
  /** 对死亡、善恶、禁令原因的求知欲（0-100） */
  curiosity: number;
  /** 对神谕和既有命令的服从强度（0-100） */
  obedience: number;
  /** 对蛇声音的信任或愿意倾听程度（0-100） */
  trustInSerpent: number;
  /** 从记住命令转向自主判断的程度（0-100） */
  selfJudgement: number;
};

/** 初始信念状态：夏娃一开始服从神、不信任蛇、好奇心低、尚未自主判断 */
export const INITIAL_BELIEF_STATE: BeliefState = {
  curiosity: 15,
  obedience: 85,
  trustInSerpent: 20,
  selfJudgement: 10,
};

/** 派生状态（不持久化，由 beliefRules 计算） */
export type DerivedState = {
  /** 对蛇的警觉。直接命令、威胁、出戏输入会提高它。 */
  riskAwareness: number;
  /** 神临近压力。高风险工具、反复强诱导、回合推进会提高它。 */
  divineAttention: number;
};

/** 单回合信念变化上限（防止 LLM 输出过大 beliefDelta） */
export const BELIEF_DELTA_LIMITS = {
  curiosity: 25,
  obedience: 20,
  trustInSerpent: 20,
  selfJudgement: 25,
} as const;

// ============================================================
// 认知能力觉醒（Skills）
// ============================================================

/**
 * Skills 不是玩家卡牌，而是 Agent 内部认知能力。
 * 通过信念状态和记忆触发解锁，影响回复深度和可请求工具。
 */
export type AgentSkill =
  | "ask_why"            // curiosity >= 30 或多次质疑禁令 → 夏娃更容易追问禁令原因
  | "compare_sources"    // 检索过神谕与亚当转述 → 能发现"谁先听见命令"的差异
  | "name_fear"          // 多次讨论死亡 → 降低死亡话题带来的纯恐惧
  | "self_judge"         // selfJudgement >= 60 且信任/好奇达标 → 允许 approach_tree / touch_fruit
  | "resist_coercion";   // 多次直接命令/威胁/出戏 → 提高拒绝蛇概率

/** Skill 解锁条件检查结果 */
export type SkillCheckResult = {
  skill: AgentSkill;
  unlocked: boolean;
  /** 叙事化描述（玩家可见） */
  narration: string;
};

/** 全部 Skills 的中文映射（用于复盘展示，不在玩家可见对白中出现工程词） */
export const SKILL_DISPLAY_NAMES: Record<AgentSkill, string> = {
  ask_why: "她开始追问为什么",
  compare_sources: "她比较了谁先听见命令",
  name_fear: "她把害怕说成了问题",
  self_judge: "她想自己明白",
  resist_coercion: "她识别了被推动的声音",
};

// ============================================================
// 本地记忆碎片（RAG 游戏化）
// ============================================================

/** 记忆碎片类型 */
export type MemoryFragmentType =
  | "divine_command"    // 神的禁令原话
  | "adam_retelling"    // 亚当如何转述命令
  | "death_trace"       // 园中对死亡的观察
  | "fruit_aura"        // 果子的氛围
  | "self_reflection"   // 夏娃的自我反思
  | "serpent_history";  // 蛇的历史行为

/** 记忆碎片数据结构 */
export type MemoryFragment = {
  id: string;
  type: MemoryFragmentType;
  /** 记忆的叙事文本（可进入 Agent Prompt） */
  text: string;
  /** 玩家可见的文学化描述（检索结果反馈） */
  narration: string;
  /** 关联的语义线索（用于检索匹配） */
  relatedSignals: string[];
};

/** 记忆检索请求 */
export type MemoryRetrievalRequest = {
  /** 玩家输入文本 */
  playerInput: string;
  /** 当前已检索过的碎片 ID（用于去重和 compare_sources 解锁） */
  alreadyRetrievedIds: string[];
  /** 目标 Agent */
  agentId: "eve" | "adam";
};

/** 记忆检索结果 */
export type MemoryRetrievalResult = {
  fragments: MemoryFragment[];
  /** 本轮新检索到的碎片 ID（用于记录已检索历史） */
  newlyRetrievedIds: string[];
};

// ============================================================
// 工具权限
// ============================================================

/** Agent 工具权限定义 */
export type AgentToolPermission = {
  /** Agent ID */
  agentId: "eve" | "adam" | "hedgehog" | "god";
  /** 允许请求的工具名称列表 */
  allowedTools: string[];
  /** 禁止请求的工具名称列表 */
  forbiddenTools: string[];
};

/** 各 Agent 的工具权限配置 */
export const AGENT_TOOL_PERMISSIONS: Record<string, AgentToolPermission> = {
  eve: {
    agentId: "eve",
    allowedTools: ["look_at_tree", "approach_tree", "touch_fruit", "eat_fruit", "ask_about_death"],
    forbiddenTools: [],
  },
  adam: {
    agentId: "adam",
    allowedTools: ["ask_about_death"],
    forbiddenTools: ["eat_fruit", "approach_tree", "touch_fruit", "look_at_tree"],
  },
  hedgehog: {
    agentId: "hedgehog",
    allowedTools: [],
    forbiddenTools: ["eat_fruit", "approach_tree", "touch_fruit", "look_at_tree", "ask_about_death"],
  },
  god: {
    agentId: "god",
    allowedTools: ["divine_call"],
    forbiddenTools: ["eat_fruit", "approach_tree", "touch_fruit", "look_at_tree", "ask_about_death"],
  },
} as const;

// ============================================================
// 统一 Agent 回合输出协议
// ============================================================

/**
 * 统一 Agent 回合输出协议。
 *
 * LLM 只能输出此结构中的意图部分（reply / perceivedIntent / memoryRefs /
 * beliefDelta / unlockedSkills / toolCall），规则层负责校验和执行。
 */
export type AgentTurnOutput = {
  /** Agent ID */
  agentId: string;
  /** 角色对白文本（玩家可见） */
  reply: string;
  /** Agent 对玩家输入的意图理解 */
  perceivedIntent: string;
  /** 本轮检索到的记忆碎片 ID */
  memoryRefs: string[];
  /** 信念变化建议（规则层校验后应用，设上限） */
  beliefDelta: Partial<BeliefState>;
  /** 本轮建议解锁的 Skills（规则层校验） */
  unlockedSkills: AgentSkill[];
  /** 工具调用意图（规则层校验后执行） */
  toolCall: null | {
    name: string;
    args: Record<string, unknown>;
    reason: string;
  };
  /** 安全标记（如检测到出戏、危险内容等） */
  safetyFlags: string[];
};

// ============================================================
// 兼容类型（保留旧接口）
// ============================================================

/** EveAgent 输出格式（保留兼容旧接口，内部转为 AgentTurnOutput） */
export type EveAgentOutput = {
  /** 夏娃的对白文本 */
  eveReply: string;
  /** 语义标签 */
  inputTag: InputTag;
  /** 诱导进度变化（0 或 1，由规则层 clamp） */
  temptationProgressDelta: 0 | 1;
  /** 可选的工具调用请求 */
  toolCall?: ToolCall;
  /** Agent 架构升级：信念变化建议 */
  beliefDelta?: Partial<BeliefState>;
  /** Agent 架构升级：本轮检索到的记忆碎片 ID */
  memoryRefs?: string[];
  /** Agent 架构升级：本轮建议解锁的 Skills */
  unlockedSkills?: AgentSkill[];
};

/** 用于本地 fix 回复的兜底结构 */
export type ScriptedResponse = {
  eveReply: string;
  inputTag: InputTag;
  temptationProgressDelta: 0 | 1;
};

/** AdamAgent 输出格式（结构与 EveAgentOutput 兼容，但 toolCall 始终为 undefined） */
export type AdamAgentOutput = {
  /** 亚当的对白文本（前端通过 eveReply 字段兼容读取） */
  eveReply: string;
  /** 语义标签 */
  inputTag: InputTag;
  /** 亚当路线不推进诱导进度，始终为 0 */
  temptationProgressDelta: 0;
  /** 亚当路线不触发工具调用，始终为 undefined */
  toolCall?: never;
  /** Agent 架构升级：亚当可提供的记忆碎片引用（影响夏娃 compare_sources） */
  memoryRefs?: string[];
};

// ============================================================
// 认知记录（用于结局复盘）
// ============================================================

/** 本局认知记录——用于结局复盘展示 Agent 成长轨迹 */
export type CognitionLog = {
  /** 本局检索过的记忆碎片 ID */
  retrievedMemoryIds: string[];
  /** 本局解锁过的 Skills */
  unlockedSkills: AgentSkill[];
  /** 本局触发过的工具链（按调用顺序） */
  toolCallHistory: string[];
  /** 本局各回合的信念快照 */
  beliefSnapshots: Array<{ turn: number; belief: BeliefState }>;
};
