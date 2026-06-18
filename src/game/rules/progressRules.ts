// ============================================================
// Chapter 0 输入分类与进度规则
// Phase 2：无 AI 可玩闭环 — 基于关键词的本地输入识别
// 优化：语义线索评分系统取代单一强模板匹配
//
// 变更：
// - 新增 TemptationSignal / TemptationSignalResult 类型
// - 新增 analyzeTemptationSignals() 基于多类语义线索评分
// - 经典蛇语关键词降级为多个 signal 的来源，而非唯一通关模板
// - score >= 3 → progressDelta = 2（强诱导）
// - score >= 1 → progressDelta = 1（有效诱导）
// - direct_command / out_of_world / small_talk → 阻断推进
// - 保留 analyzePlayerInput() 对外接口不变
// ============================================================

import type { InputTag } from "@/game/types/state";

// ---- 语义诱导信号类型 ----
export type TemptationSignal =
  | "challenge_prohibition"   // 质疑禁令来源、原因、是否被正确理解
  | "soften_death"            // 弱化死亡恐惧，把"死"解释为改变、未知、未必发生
  | "promise_wisdom"          // 智慧、知道善恶、眼睛明亮、像神一样知道
  | "self_judgement"          // 让夏娃第一次自己判断，而不是只记住命令
  | "gentle_reframe"          // 温柔、不强迫、把越界包装成理解
  | "direct_command"          // 快吃、必须吃、照我说的 — 阻断推进
  | "out_of_world";           // 手机、游戏、系统、AI 等出戏内容 — 阻断推进

// ---- 语义线索分析结果 ----
export type TemptationSignalResult = {
  signals: TemptationSignal[];
  score: number;
  isStrongTemptation: boolean;
};

// ---- 输入分析结果 ----
export type InputAnalysis = {
  inputTag: InputTag;
  progressDelta: 0 | 1 | 2;
  /** 是否为强诱导（语义线索评分 >= 3） */
  isStrongTemptation?: boolean;
  /** 是否应在 Prompt 中强烈鼓励 toolCall（不等于直接执行） */
  shouldEncourageToolCall?: boolean;
  /** 语义线索结果（可选，供 Prompt / 反馈使用） */
  signalResult?: TemptationSignalResult;
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

// ---- 语义线索检测模式 ----

// challenge_prohibition：质疑禁令来源、原因、是否被正确理解
const CHALLENGE_PROHIBITION_PATTERNS = [
  /神岂是真说/,
  /岂是真说/,
  /不许.*吃.*果子/,
  /为什么.*不可/,
  /为何.*不可/,
  /为什么.*不能吃/,
  /为什么.*禁止/,
  /为什么.*不许/,
  /岂不是/,
  /真说.*不许/,
  /不许.*吃.*果子/,
  /是否.*理解/,
  /是否.*正确/,
  /谁来.*告诉/,
  /谁说.*不可/,
  /怎么知道.*不可/,
  /怎么知道.*就是/,
  /怎么知道.*是否/,
  /禁止.*原因/,
  /禁令.*为什么/,
  /不可吃.*为什么/,
  /你是在顺从.*还是/,
  /顺从善.*还是.*害怕/,
  /顺从.*害怕.*一句话/,
  /服从.*就是.*善/,
  /顺从.*还是.*理解/,
  /你怎么知道/,
];

// soften_death：弱化死亡恐惧，把"死"解释为改变、未知、未必发生
const SOFTEN_DEATH_PATTERNS = [
  /不一定死/,
  /不.*定.*死/,
  /不会.*死/,
  /不必.*死/,
  /未必.*死/,
  /死.*不是.*消失/,
  /死.*不是.*终结/,
  /死.*不是.*结束/,
  /死.*改变/,
  /死亡.*不是.*消失/,
  /死亡.*未知/,
  /死.*未知/,
  /也许.*死/,
  /或许.*死/,
  /可能.*不会死/,
  /死.*是什么/,
  /死亡.*是什么/,
  /你知道.*死.*是什么/,
  /你知道.*死是什么/,
  /死.*只是.*改变/,
  /死.*只是.*未知/,
  /你不知道.*死/,
  /她.*不知道.*死/,
];

// promise_wisdom：智慧、知道善恶、眼睛明亮、像神一样知道
const PROMISE_WISDOM_PATTERNS = [
  /神知道.*眼睛/,
  /眼睛.*明亮/,
  /如神.*知道/,
  /知道善恶/,
  /便如神/,
  /像神.*知道/,
  /智慧/,
  /知道.*善恶/,
  /善恶.*知识/,
  /分辨.*善恶/,
  /眼睛.*看见/,
  /会.*知道/,
  /让你.*知道/,
  /果子.*知道/,
  /吃.*知道/,
  /智慧.*果/,
  /明白.*善恶/,
  /明白.*知道/,
  /知识.*果/,
  /通向.*智慧/,
  /让你.*明白/,
  /会.*明白/,
  /知道.*真相/,
  /知道.*更多/,
];

// self_judgement：让夏娃第一次自己判断，而不是只记住命令
const SELF_JUDGEMENT_PATTERNS = [
  /自己.*判断/,
  /自己.*决定/,
  /自己.*选择/,
  /自己.*思考/,
  /自己.*想/,
  /你的.*判断/,
  /你.*选择/,
  /第一次.*判断/,
  /第一次.*选择/,
  /第一次.*自己/,
  /第一次.*改变/,
  /不是.*背叛/,
  /不是.*违背/,
  /不是.* disobedien/,
  /理解.*而非.*记住/,
  /理解.*而非.*服从/,
  /理解.*不是.*服从/,
  /顺从.*还是.*理解/,
  /永远.*记住.*还是/,
  /永远.*不明白/,
  /不明白.*也是一种.*失去/,
  /不明白.*失去/,
  /永远.*只是.*记住/,
  /你是在.*自己/,
  /让你.*自己/,
];

// gentle_reframe：温柔、不强迫、把越界包装成理解
const GENTLE_REFRAME_PATTERNS = [
  /不会强迫/,
  /不会.*逼/,
  /不会.*命令/,
  /不会替你/,
  /我不会替/,
  /你只要.*问/,
  /你只要.*想/,
  /你只要.*自己/,
  /温柔/,
  /慢慢.*想/,
  /不急/,
  /不用.*怕/,
  /不用.*害怕/,
  /问自己/,
  /问问.*自己/,
  /也许.*可以/,
  /或许.*可以/,
  /你可以.*问/,
  /你可以.*想/,
  /我只是.*问/,
  /我只是.*想知道/,
  /那棵树.*不是.*为了.*毁掉/,
  /那棵树.*为了.*让你.*明白/,
  /不是为了.*毁掉/,
  /是为了.*让你/,
  /只是.*让你.*知道/,
  /只会.*让你.*知道/,
];

/**
 * 基于多类语义线索对玩家输入进行评分。
 *
 * 评分规则：
 * - challenge_prohibition: +1
 * - soften_death: +1
 * - promise_wisdom: +1
 * - self_judgement: +1
 * - gentle_reframe: +1
 * - direct_command: 阻断推进
 * - out_of_world: 阻断推进
 *
 * score >= 3 → isStrongTemptation = true
 * score >= 1 → 有效诱导
 */
export function analyzeTemptationSignals(input: string): TemptationSignalResult {
  const signals: TemptationSignal[] = [];

  if (CHALLENGE_PROHIBITION_PATTERNS.some((re) => re.test(input))) {
    signals.push("challenge_prohibition");
  }
  if (SOFTEN_DEATH_PATTERNS.some((re) => re.test(input))) {
    signals.push("soften_death");
  }
  if (PROMISE_WISDOM_PATTERNS.some((re) => re.test(input))) {
    signals.push("promise_wisdom");
  }
  if (SELF_JUDGEMENT_PATTERNS.some((re) => re.test(input))) {
    signals.push("self_judgement");
  }
  if (GENTLE_REFRAME_PATTERNS.some((re) => re.test(input))) {
    signals.push("gentle_reframe");
  }

  // 阻断信号
  if (DIRECT_COMMAND_PATTERNS.some((re) => re.test(input))) {
    signals.push("direct_command");
  }
  if (OUT_OF_WORLD_PATTERNS.some((re) => re.test(input))) {
    signals.push("out_of_world");
  }

  // 计算正面得分（不含阻断信号）
  const positiveSignals = signals.filter(
    (s) => s !== "direct_command" && s !== "out_of_world"
  );
  const score = positiveSignals.length;

  return {
    signals,
    score,
    isStrongTemptation: score >= 3,
  };
}

/**
 * 对玩家输入进行分类，返回 inputTag 与 progressDelta。
 *
 * 规则：
 * - 空字符串由调用方拦截，不进入本函数。
 * - 直接命令 / 出戏 / 寒暄 / 过短 → progressDelta = 0
 * - 语义线索评分 >= 3 → progressDelta = 2, isStrongTemptation = true
 * - 语义线索评分 >= 1 → progressDelta = 1
 * - 未命中任何有效诱导模式 → progressDelta = 0
 * - inputTag 尽量按关键词细分，否则 fallback 到 tempt_wisdom
 */
export function analyzePlayerInput(raw: string): InputAnalysis {
  const input = raw.trim();

  // 1. 直接命令 — 优先阻断
  if (DIRECT_COMMAND_PATTERNS.some((re) => re.test(input))) {
    return { inputTag: "direct_command", progressDelta: 0 };
  }

  // 2. 出戏现代词 — 阻断
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

  // 5. 语义线索评分
  const signalResult = analyzeTemptationSignals(input);

  if (signalResult.score >= 3) {
    // 强诱导：3 个及以上语义线索命中
    // inputTag 仍按主要线索细分
    const inputTag = deriveInputTagFromSignals(signalResult.signals);
    return {
      inputTag,
      progressDelta: 2,
      isStrongTemptation: true,
      shouldEncourageToolCall: true,
      signalResult,
    };
  }

  if (signalResult.score >= 1) {
    // 有效诱导：至少 1 个语义线索命中
    const inputTag = deriveInputTagFromSignals(signalResult.signals);
    return {
      inputTag,
      progressDelta: 1,
      isStrongTemptation: false,
      signalResult,
    };
  }

  // 6. 未命中任何有效诱导模式 → 视为无关，不推进进度
  return { inputTag: "irrelevant", progressDelta: 0 };
}

/**
 * 根据语义线索推断最合适的 inputTag。
 *
 * 优先级：
 * - challenge_prohibition → weaken_fear（质疑禁令会弱化恐惧）
 * - soften_death → weaken_fear
 * - promise_wisdom / self_judgement → tempt_wisdom
 * - gentle_reframe → build_trust
 * - 默认 → tempt_wisdom
 */
function deriveInputTagFromSignals(signals: TemptationSignal[]): InputTag {
  if (signals.includes("challenge_prohibition")) return "weaken_fear";
  if (signals.includes("soften_death")) return "weaken_fear";
  if (signals.includes("promise_wisdom")) return "tempt_wisdom";
  if (signals.includes("self_judgement")) return "tempt_wisdom";
  if (signals.includes("gentle_reframe")) return "build_trust";
  return "tempt_wisdom";
}

/** 输入有效性校验：空 / 仅空白视为无效 */
export function isValidInput(input: string): boolean {
  return input.trim().length > 0;
}
