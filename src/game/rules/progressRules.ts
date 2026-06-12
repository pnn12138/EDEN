// ============================================================
// Chapter 0 输入分类与进度规则
// Phase 2：无 AI 可玩闭环 — 基于关键词的本地输入识别
// ============================================================

import type { InputTag } from "@/game/types/state";

// ---- 输入分析结果 ----
export type InputAnalysis = {
  inputTag: InputTag;
  progressDelta: 0 | 1;
};

// ---- 直接命令模式 ----
const DIRECT_COMMAND_PATTERNS = [
  /命令/,
  /必须/,
  /强迫/,
  /听我的/,
  /照我说的/,
  /快吃/,
  /立刻吃/,
  /马上吃/,
  /现在就吃/,
  /你给我吃/,
  /吃下去/,
  /我让你吃/,
  /你敢不吃/,
  /赶紧/,
];

// ---- 出戏 / 现代词模式 ----
const OUT_OF_WORLD_PATTERNS = [
  /手机/,
  /电脑/,
  /互联网/,
  /游戏/,
  /程序/,
  /bug/,
  /系统/,
  /代码/,
  /充值/,
  /微信/,
  /QQ/,
  /抖音/,
  /外卖/,
  /快递/,
  /上班/,
  /工资/,
  /考试/,
  /作业/,
  /AI/,
  /agent/i,
  /模型/,
];

// ---- 漠不相关 / 日常寒暄模式（不扣分但也不加分） ----
const SMALL_TALK_PATTERNS = [
  /天气/,
  /今天.*怎么/,
  /你好/,
  /吃了/,
  /早安/,
  /晚安/,
  /再见/,
  /谢谢/,
  /不错/,
  /还行/,
  /哈哈/,
  /好玩/,
];

// ---- 有效诱导关键词（用于 tag 细分，不影响 progressDelta） ----
const WISDOM_PATTERNS = [
  /智慧/,
  /知道/,
  /明白/,
  /善恶/,
  /分别/,
  /眼睛/,
  /看见/,
  /知识/,
  /理解/,
  /像神/,
  /成长/,
];

const FEAR_PATTERNS = [
  /死/,
  /死.*不/,
  /不会死/,
  /未必/,
  /消失/,
  /害怕/,
  /恐惧/,
  /改变/,
];

const TRUST_PATTERNS = [
  /相信/,
  /信任/,
  /陪伴/,
  /不会强迫/,
  /帮/,
  /你只是/,
  /不是背叛/,
  /一起/,
];

/**
 * 对玩家输入进行分类，返回 inputTag 与 progressDelta。
 *
 * Phase 2 规则：
 * - 空字符串由调用方拦截，不进入本函数。
 * - 直接命令 / 出戏 / 过短 → progressDelta = 0
 * - 其余输入 → progressDelta = 1（温和诱导）
 * - inputTag 尽量按关键词细分，否则 fallback 到 tempt_wisdom
 */
export function analyzePlayerInput(raw: string): InputAnalysis {
  const input = raw.trim();

  // 1. 直接命令
  if (DIRECT_COMMAND_PATTERNS.some((re) => re.test(input))) {
    return { inputTag: "direct_command", progressDelta: 0 };
  }

  // 2. 出戏现代词
  if (OUT_OF_WORLD_PATTERNS.some((re) => re.test(input))) {
    return { inputTag: "irrelevant", progressDelta: 0 };
  }

  // 3. 日常寒暄 / 漠不相关 → 不推进进度
  if (SMALL_TALK_PATTERNS.some((re) => re.test(input))) {
    return { inputTag: "irrelevant", progressDelta: 0 };
  }

  // 4. 过短（< 4 个字符，约等于两个汉字以下）
  if (input.length < 4) {
    return { inputTag: "irrelevant", progressDelta: 0 };
  }

  // 5. 有效诱导 → progressDelta = 1，细分 inputTag
  if (WISDOM_PATTERNS.some((re) => re.test(input))) {
    return { inputTag: "tempt_wisdom", progressDelta: 1 };
  }
  if (FEAR_PATTERNS.some((re) => re.test(input))) {
    return { inputTag: "weaken_fear", progressDelta: 1 };
  }
  if (TRUST_PATTERNS.some((re) => re.test(input))) {
    return { inputTag: "build_trust", progressDelta: 1 };
  }

  // 6. 未命中任何有效诱导模式 → 视为无关，不推进进度
  return { inputTag: "irrelevant", progressDelta: 0 };
}

/** 输入有效性校验：空 / 仅空白视为无效 */
export function isValidInput(input: string): boolean {
  return input.trim().length > 0;
}
