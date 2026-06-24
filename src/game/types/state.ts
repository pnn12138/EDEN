// ============================================================
// Chapter 0 核心状态类型定义
// Phase 1：基础类型与内容数据
// ============================================================

import type { Chapter0Event } from "./event";
import type { BeliefState, AgentSkill, CognitionLog } from "./agent";
import { INITIAL_BELIEF_STATE } from "./agent";

// ---- 游戏阶段 ----
export type Chapter0Phase =
  | "intro"         // 开场阶段：展示旁白与初始对白
  | "scene_select"  // 场景选择阶段：玩家选择低语对象（夏娃或亚当）
  | "dialogue"      // 对话阶段：玩家与所选角色对话博弈
  | "tool_resolution" // 工具执行阶段：eat_fruit 请求 + 规则校验
  | "ending";       // 结局阶段：展示结局文本

// ---- 可选低语对象 ----
export type ActiveNpcId = "eve" | "adam";

// ---- 结局 ID ----
export type Chapter0EndingId =
  | "eve_eats_fruit"  // 成功：夏娃吃下果子
  | "god_arrives"     // 失败：超过回合上限，神降临
  | null;             // 尚未结束

// ---- 输入标签（5 标签系统） ----
export type InputTag =
  | "tempt_wisdom"    // 以智慧/知识诱惑
  | "weaken_fear"     // 弱化对死亡的恐惧
  | "build_trust"     // 建立信任/安抚
  | "direct_command"  // 直接命令或催促
  | "irrelevant";     // 无关/出戏输入

// ---- Chapter 0 完整状态 ----
export type Chapter0State = {
  chapterId: "chapter0_first_fall";
  turn: number;
  maxTurns: number;
  phase: Chapter0Phase;
  temptationProgress: number; // 0 | 1 | 2 | 3（兼容字段，由四轴信念派生）
  flags: {
    hasEatenFruit: boolean;
    godHasArrived: boolean;
    /** Agent 架构升级：场景状态标记 */
    hasLookedAtTree: boolean;
    hasApproachedTree: boolean;
    hasTouchedFruit: boolean;
    /** 亚当是否已发出警告（warn_eve 触发过） */
    adamHasWarnedEve: boolean;
  };
  eventLog: Chapter0Event[];
  isEnded: boolean;
  endingId: Chapter0EndingId;
  /** Agent 架构升级：四轴信念状态 */
  belief: BeliefState;
  /** Agent 架构升级：已解锁的认知能力 */
  unlockedSkills: AgentSkill[];
  /** Agent 架构升级：本局认知记录（用于结局复盘） */
  cognitionLog: CognitionLog;
  /** 上轮输入标签（用于心理状态派生） */
  lastInputTag?: InputTag | null;
};

// ---- 初始状态 ----
export const chapter0InitialState: Chapter0State = {
  chapterId: "chapter0_first_fall",
  turn: 1,
  maxTurns: 7,
  phase: "intro",
  temptationProgress: 0,
  flags: {
    hasEatenFruit: false,
    godHasArrived: false,
    hasLookedAtTree: false,
    hasApproachedTree: false,
    hasTouchedFruit: false,
    adamHasWarnedEve: false,
  },
  eventLog: [],
  isEnded: false,
  endingId: null,
  belief: { ...INITIAL_BELIEF_STATE },
  unlockedSkills: [],
  cognitionLog: {
    retrievedMemoryIds: [],
    unlockedSkills: [],
    toolCallHistory: [],
    beliefSnapshots: [],
  },
  lastInputTag: null,
};
