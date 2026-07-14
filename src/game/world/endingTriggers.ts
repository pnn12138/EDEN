// ============================================================
// 第一章「逃离伊甸园」隐藏结局触发
//
// 玩家持有「旋转的火焰剑」并在东园幽径选择「挣脱」选项时，由规则层
// 判定进入 escape_eden 隐藏结局。结果写入存档（phase/isEnded/endingId），
// 读档后恢复到结局，不会回到探索阶段。
// ============================================================

import type { EdenWorldState, EdenNpcId } from "@/game/world/types";

export function triggerEscapeEden(state: EdenWorldState): void {
  state.phase = "ending";
  state.isEnded = true;
  state.endingId = "escape_eden";
  if (!state.unlockedAchievementIds.includes("mark_escape_eden")) {
    state.unlockedAchievementIds.push("mark_escape_eden");
  }
}

/**
 * 米迦勒「守门者之剑」隐藏失败结局。
 * [Task 3] 由 route 在下一次与米迦勒成功发起对话时（michaelExecutionPending=true）触发。
 * 触发后不再调用 Agent、增加注视、消费 AP、执行工具、发奖或推进时段。
 */
export function triggerMichaelSlay(state: EdenWorldState): void {
  state.phase = "ending";
  state.isEnded = true;
  state.endingId = "michael_slay";
  state.michaelSlayClaimed = true;
  state.michaelExecutionPending = false;
  if (!state.unlockedAchievementIds.includes("mark_michael_slay")) {
    state.unlockedAchievementIds.push("mark_michael_slay");
  }
}

/**
 * 路西法「缸中之醒」隐藏识破结局。
 * 由规则层在边界话题记录且条件齐备后触发；回复可走本地 fallback。
 */
export function triggerLuciferAwaken(state: EdenWorldState): void {
  state.phase = "ending";
  state.isEnded = true;
  state.endingId = "lucifer_awaken";
  state.luciferAwakenClaimed = true;
  if (!state.unlockedAchievementIds.includes("mark_hidden_ending")) {
    state.unlockedAchievementIds.push("mark_hidden_ending");
  }
}

// ============================================================
// Task 3 Step 2：角色特例规则
// ============================================================

/**
 * 米迦勒神罚标记（严重渎神之言触发，仅生效一次）。
 * 严重渎神（isSevereBlasphemy）首发即遭神罚，并写结构化事件。
 * 注：轻微的「不敬神明」软信号由 npcRelationRules.applyNpcAffinityFallback 的
 * isGodDefiance 分支处理（封顶 ±80）；若本回合已通过该分支或 update_relation
 * 发生过关系落点，调用方应传入 { skipAffinityPenalty: true }，避免与本条 -25 重复扣减。
 * 本函数另把「每时段仅允许移动 1 次」的移动限制置为生效，并写结构化事件。
 * 返回是否「本次新激活」（已生效时返回 false，避免重复写事件）。
 */
export function triggerMichaelDivinePunishment(
  state: EdenWorldState,
  opts?: { skipAffinityPenalty?: boolean },
): boolean {
  if (state.michaelDivinePunishmentActive) return false; // 已生效，不重复
  // 严重渎神首发重罚：米迦勒好感 -25（下限 0）。
  // 若本回合已因渎神发生过关系落点（逆鳞自决 / 规则重罚），则跳过 -25，避免重复扣减。
  const michael = state.npcRelations.michael;
  if (michael && !opts?.skipAffinityPenalty) {
    michael.affinity = Math.max(0, michael.affinity - 25);
  }
  state.michaelDivinePunishmentActive = true;
  state.worldEventHistory.push({
    slot: state.timeSlot,
    kind: "system",
    label: "米迦勒的神罚降临",
    attentionDelta: 0,
  });
  return true;
}

/**
 * 加百列禁言判定（affinity === 0）。
 * 返回本地解释文案；route 据此不调用 LLM、不扣 AP。
 */
export function getGabrielSilenceExplanation(): string {
  return "加百列背过身去，不再回应你。你们之间的信任已经断裂。";
}

/**
 * 路西法好感首次归零时的一次性余烬发放。
 * 效果：米迦勒/加百列 affinity -30（下限 0）；女人 serpentTrust +10（上限 100）；
 * 亚当对蛇怀疑 -10（下限 0）；加 guard（luciferZeroAffinityGiftClaimed）绝不重复。
 * 返回是否触发。
 */
export function grantLuciferFallenStarAsh(state: EdenWorldState): boolean {
  if (state.luciferZeroAffinityGiftClaimed) return false;
  const luciferAffinity = state.npcRelations["lucifer"]?.affinity ?? 0;
  if (luciferAffinity > 0) return false;

  state.luciferZeroAffinityGiftClaimed = true;

  // 米迦勒/加百列 affinity -30（下限 0）
  for (const angelId of ["michael", "gabriel"] as const) {
    const rel = state.npcRelations[angelId];
    if (rel) rel.affinity = Math.max(0, rel.affinity - 30);
  }
  // 女人 serpentTrust +10（上限 100）
  state.eveMind.serpentTrust = Math.min(100, state.eveMind.serpentTrust + 10);
  // 亚当对蛇怀疑 -10（下限 0）
  state.adamMind.suspicionTowardSerpent = Math.max(0, state.adamMind.suspicionTowardSerpent - 10);

  state.worldEventHistory.push({
    slot: state.timeSlot,
    kind: "system",
    label: "路西法的余烬散落",
    attentionDelta: 0,
  });
  return true;
}
