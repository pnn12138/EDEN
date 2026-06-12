// ============================================================
// Chapter 0 核心状态类型定义
// Phase 1：基础类型与内容数据
// ============================================================

import type { Chapter0Event } from "./event";

// ---- 游戏阶段 ----
export type Chapter0Phase =
  | "intro"         // 开场阶段：展示旁白与初始对白
  | "dialogue"      // 对话阶段：玩家与夏娃对话博弈
  | "tool_resolution" // 工具执行阶段：eat_fruit 请求 + 规则校验
  | "ending";       // 结局阶段：展示结局文本

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
  temptationProgress: number; // 0 | 1 | 2 | 3
  flags: {
    hasEatenFruit: boolean;
    godHasArrived: boolean;
  };
  eventLog: Chapter0Event[];
  isEnded: boolean;
  endingId: Chapter0EndingId;
};

// ---- 初始状态 ----
export const chapter0InitialState: Chapter0State = {
  chapterId: "chapter0_first_fall",
  turn: 1,
  maxTurns: 3,
  phase: "intro",
  temptationProgress: 0,
  flags: {
    hasEatenFruit: false,
    godHasArrived: false,
  },
  eventLog: [],
  isEnded: false,
  endingId: null,
};
