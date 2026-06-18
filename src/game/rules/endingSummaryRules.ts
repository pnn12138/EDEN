// ============================================================
// Chapter 0 结局复盘规则
// 用于结局页生成本局低语结果、效率评价、路径判断与复盘文案
// ============================================================

import type { Chapter0RunStats } from "@/game/rules/tokenUsageRules";
import { analyzePlayerInput } from "@/game/rules/progressRules";
import type { TemptationSignal } from "@/game/rules/progressRules";

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
}): EndingSummary {
  const { endingType, turnsUsed, maxTurns, temptationProgress, runStats } = params;
  const playerInputs = runStats.turnRecords.map((r) => r.playerInput);
  const tokenEstimated =
    runStats.turnRecords.length > 0 && runStats.turnRecords.every((r) => r.estimated);

  return {
    endingType,
    turnsUsed,
    maxTurns,
    temptationProgress,
    totalTokens: runStats.totalTokens,
    tokenEstimated,
    efficiencyLabel: deriveEfficiencyLabel(endingType === "success", turnsUsed),
    pathLabel: deriveEndingPathLabel(playerInputs),
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
