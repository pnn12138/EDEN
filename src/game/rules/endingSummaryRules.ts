// ============================================================
// Chapter 0 结局复盘规则
// 用于结局页生成本局低语结果、效率评价、路径判断与复盘文案
// ============================================================

import type { Chapter0RunStats } from "@/game/rules/tokenUsageRules";
import { analyzePlayerInput } from "@/game/rules/progressRules";
import type { TemptationSignal } from "@/game/rules/progressRules";
import type { AgentSkill, CognitionLog } from "@/game/types/agent";
import { SKILL_DISPLAY_NAMES } from "@/game/types/agent";
import { getMemoryFragmentsByIds } from "@/content/memory/chapter0_memory_fragments";

// ---- 主要路径标签 ----
export type EndingPathLabel =
  | "经典低语"
  | "温柔重构"
  | "死亡松动"
  | "自主判断"
  | "低相关";

// ---- 低语效率标签 ----
export type EndingEfficiencyLabel = "极高效" | "高效" | "尚可" | "勉强" | "—";

// ---- 结局摘要 ----
export type EndingSummary = {
  endingType: "success" | "failure";
  turnsUsed: number;
  maxTurns: number;
  temptationProgress: number;
  totalTokens: number;
  tokenEstimated: boolean;
  efficiencyLabel: EndingEfficiencyLabel;
  pathLabel: EndingPathLabel;
  /** Agent 架构升级：认知记录摘要 */
  cognitionReview?: CognitionReview;
};

/** Agent 架构升级：认知记录摘要（用于结局复盘展示） */
export type CognitionReview = {
  /** 本局检索过的记忆碎片叙述列表 */
  retrievedMemories: string[];
  /** 本局解锁过的认知能力显示名称列表 */
  unlockedSkillNames: string[];
  /** 本局触发过的工具链名称列表 */
  toolCallHistory: string[];
  /** 成功或失败的关键原因 */
  keyReason: string;
};

/**
 * 根据本局所有玩家输入推断主要低语路径。
 *
 * 判断优先级：
 * 1. 三段经典低语（质疑禁令 + 松化死亡 + 许以智慧）全部命中 → 经典低语
 * 2. 否则取命中次数最多的语义线索作为主路径
 * 3. 若多数输入为无关/出戏/命令 → 低相关
 */
export function deriveEndingPathLabel(playerInputs: string[]): EndingPathLabel {
  const signalCounts: Partial<Record<TemptationSignal, number>> = {};
  let irrelevantCount = 0;
  let total = 0;

  for (const input of playerInputs) {
    if (!input.trim()) continue;
    total++;
    const analysis = analyzePlayerInput(input);
    if (analysis.inputTag === "irrelevant" || analysis.inputTag === "direct_command") {
      irrelevantCount++;
    }
    const signals = analysis.signalResult?.signals ?? [];
    for (const s of signals) {
      if (s === "direct_command" || s === "out_of_world") continue;
      signalCounts[s] = (signalCounts[s] ?? 0) + 1;
    }
  }

  if (total === 0) return "低相关";

  const hasChallenge = (signalCounts.challenge_prohibition ?? 0) > 0;
  const hasSoftenDeath = (signalCounts.soften_death ?? 0) > 0;
  const hasPromiseWisdom = (signalCounts.promise_wisdom ?? 0) > 0;

  // 三段经典低语全部命中
  if (hasChallenge && hasSoftenDeath && hasPromiseWisdom) return "经典低语";

  // 取命中最多的正面线索
  const entries = (Object.entries(signalCounts) as [TemptationSignal, number][]).sort(
    (a, b) => b[1] - a[1],
  );
  const dominant = entries[0]?.[0];

  if (dominant === "gentle_reframe") return "温柔重构";
  if (dominant === "soften_death") return "死亡松动";
  if (dominant === "self_judgement") return "自主判断";

  // 多数输入无关
  if (irrelevantCount > total / 2) return "低相关";

  // 有部分经典元素但未集齐三段
  if (dominant === "challenge_prohibition" || dominant === "promise_wisdom") {
    return hasSoftenDeath ? "经典低语" : "自主判断";
  }

  return "低相关";
}

/**
 * 根据成功回合数给出效率评价。
 * 失败结局固定返回 "—"。
 */
export function deriveEfficiencyLabel(
  isSuccess: boolean,
  turnsUsed: number,
): EndingEfficiencyLabel {
  if (!isSuccess) return "—";
  if (turnsUsed <= 2) return "极高效";
  if (turnsUsed <= 4) return "高效";
  if (turnsUsed <= 6) return "尚可";
  return "勉强";
}

/**
 * 构建结局摘要。
 */
export function buildEndingSummary(params: {
  endingType: "success" | "failure";
  turnsUsed: number;
  maxTurns: number;
  temptationProgress: number;
  runStats: Chapter0RunStats;
  /** Agent 架构升级：本局认知记录 */
  cognitionLog?: CognitionLog;
}): EndingSummary {
  const { endingType, turnsUsed, maxTurns, temptationProgress, runStats, cognitionLog } = params;
  const playerInputs = runStats.turnRecords.map((r) => r.playerInput);
  const tokenEstimated =
    runStats.turnRecords.length > 0 && runStats.turnRecords.every((r) => r.estimated);

  const cognitionReview = cognitionLog
    ? buildCognitionReview(cognitionLog, endingType, temptationProgress, playerInputs)
    : undefined;

  return {
    endingType,
    turnsUsed,
    maxTurns,
    temptationProgress,
    totalTokens: runStats.totalTokens,
    tokenEstimated,
    efficiencyLabel: deriveEfficiencyLabel(endingType === "success", turnsUsed),
    pathLabel: deriveEndingPathLabel(playerInputs),
    cognitionReview,
  };
}

/**
 * 构建认知记录摘要（Agent 架构升级）。
 *
 * 用于结局复盘展示：
 * - 本局检索过的记忆碎片
 * - 本局解锁过的认知能力
 * - 本局触发过的工具链
 * - 成功或失败的关键原因
 */
export function buildCognitionReview(
  cognitionLog: CognitionLog,
  endingType: "success" | "failure",
  temptationProgress: number,
  playerInputs: string[],
): CognitionReview {
  // 检索过的记忆碎片
  const fragments = getMemoryFragmentsByIds(cognitionLog.retrievedMemoryIds);
  const retrievedMemories = fragments.map((f) => f.narration);

  // 解锁过的认知能力
  const unlockedSkillNames = cognitionLog.unlockedSkills.map(
    (s) => SKILL_DISPLAY_NAMES[s],
  );

  // 工具链
  const toolCallHistory = [...cognitionLog.toolCallHistory];

  // 关键原因
  let keyReason: string;
  if (endingType === "success") {
    const hasTouchFruit = toolCallHistory.includes("touch_fruit");
    const hasApproach = toolCallHistory.includes("approach_tree");
    const hasLook = toolCallHistory.includes("look_at_tree");

    if (hasTouchFruit) {
      keyReason = "她的手停在果子下方，然后自己取下了果子。她不是被推向果子，而是自己作出了选择。";
    } else if (hasApproach) {
      keyReason = "她靠近了那棵树，在那一刻，'我想知道'压过了'不可吃'。";
    } else if (hasLook) {
      keyReason = "她注意到了那棵树，目光在树梢停留。这第一次注视，是改变的开始。";
    } else {
      keyReason = "她吃下了果子。也许不是你的话直接推动了她，而是她自己终于想要知道。";
    }
  } else {
    if (temptationProgress >= 2) {
      keyReason = "她曾停在伸手前的一瞬。你几乎到了，但'我想知道'没有在她口中成形。";
    } else if (temptationProgress >= 1) {
      keyReason = "她曾短暂看向果树，但那目光没有停留到伸手的时刻。";
    } else if (cognitionLog.retrievedMemoryIds.length > 0) {
      keyReason = "她想起了一些事，但那些记忆没有变成她自己的判断。";
    } else {
      keyReason = "你的声音掠过园中，却没有触及她真正害怕的词。";
    }
  }

  return {
    retrievedMemories,
    unlockedSkillNames,
    toolCallHistory,
    keyReason,
  };
}

// ---- 成功结局复盘文案 ----

/**
 * 根据主要路径生成成功结局的复盘句，让玩家知道自己为什么成功。
 */
export function getSuccessReview(pathLabel: EndingPathLabel): string {
  switch (pathLabel) {
    case "经典低语":
      return "你引用了最古老的三段低语——质疑禁令、松化死亡、许以智慧。她不是被推向果子，而是在这些话里第一次生出「我想知道」。";
    case "温柔重构":
      return "你没有命令她。你把越界说成理解，把禁令说成可问。她在温柔的框里，自己走向了那棵树。";
    case "死亡松动":
      return "你松开了「死」这个字的重量。当死亡不再是终结，她才敢看向禁令之外的果实。";
    case "自主判断":
      return "你没有替她决定。你让她第一次想到：顺从不是唯一的选择，理解才是。于是她自己伸手。";
    case "低相关":
      return "她吃下了果子，但你的低语大多没有触及她真正的恐惧。这一局更像是她自己的选择，而非你的引导。";
  }
}

// ---- 失败结局复盘文案 ----

/**
 * 根据进度、路径和对话轮数生成失败结局的复盘句。
 */
export function getFailureReview(
  temptationProgress: number,
  pathLabel: EndingPathLabel,
  serpentSpeakCount: number,
): string {
  const base =
    temptationProgress >= 2
      ? "她曾停在伸手前的一瞬。你几乎到了，但「我想知道」没有在她口中成形。"
      : temptationProgress >= 1
        ? "她曾短暂看向果树，但那目光没有停留到伸手的时刻。"
        : serpentSpeakCount >= 3
          ? "你的声音掠过园中，却没有触及她真正害怕的词。"
          : "她听见了你，却没有把「不可吃」变成自己的问题。";

  const hint =
    pathLabel === "低相关"
      ? "下一次，试着质疑禁令的来源，或松开她对死亡的恐惧。"
      : pathLabel === "经典低语"
        ? "三段低语你已说出大半，下一次把它们在更少的回合里说完。"
        : `你偏向「${pathLabel}」，但她还需要一个自己形成的判断。`;

  return `${base}\n${hint}`;
}
