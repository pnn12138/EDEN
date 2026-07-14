// ============================================================
// 第一章场景问答规则层
//
// 职责：
// - 根据地点、时段和完成记录找到应触发的问题
// - 判定选项标签
// - 发放线索 / 回响 / 心智与注视变化
// - 记录已完成问答，确保核心奖励只领取一次
// ============================================================

import type { EdenWorldState } from "@/game/world/types";
import type { ScenePuzzle, ScenePuzzleOption } from "@/content/world/scenePuzzles";
import { getClueById } from "@/content/world/clues";
import { getItemById } from "@/content/world/items";
import { grantResonance } from "@/game/world/resonanceRules";
import { getEffectiveMaxActionPoints } from "@/game/world/actionPointRules";
import { ensureRelation } from "@/game/world/npcRelationRules";
import { grantDivineAttention } from "@/game/world/divineAttentionRules";
import { evaluateDivineGiftProgress, applyGracePrismRetroactive } from "@/game/world/divineGiftRules";
import { applyTimeRewind } from "@/game/world/timeRewindRules";
import { triggerEscapeEden } from "@/game/world/endingTriggers";
import { evaluateFreeTextAnswer, type PuzzleAnswerGrade } from "@/game/world/puzzleAnswerRules";

export type ScenePuzzleRewardResult = {
  type: "clue" | "item" | "trust" | "attention";
  id?: string;
  title: string;
};

export type ScenePuzzleAnswerResult = {
  success: boolean;
  alreadyCompleted: boolean;
  selectedOptionId: string;
  grade?: PuzzleAnswerGrade;
  /** per_option 模式：结果弹窗标题（如"徒劳的挣扎"） */
  resultTitle?: string;
  feedback: string;
  state: EdenWorldState;
  rewards: ScenePuzzleRewardResult[];
  divineGiftChoice?: string[] | null;
};

function clampMind(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** 旧存档兼容：TokenStats 缺字段补默认（嵌套对象整体 ?? + 字段 ??） */
function normalizeTokenStats(stats: Partial<EdenWorldState["tokenStats"]> | undefined | null): EdenWorldState["tokenStats"] {
  const s = stats ?? {};
  return {
    dialogueThisSlot: s.dialogueThisSlot ?? 0,
    dialogueTotal: s.dialogueTotal ?? 0,
    polishTotal: s.polishTotal ?? 0,
    lastDialogueTokens: s.lastDialogueTokens ?? 0,
    lastPolishTokens: s.lastPolishTokens ?? 0,
    hasEstimate: s.hasEstimate ?? false,
    dialoguePromptTotal: s.dialoguePromptTotal ?? 0,
    dialogueCompletionTotal: s.dialogueCompletionTotal ?? 0,
  };
}

export function normalizePuzzleState(state: EdenWorldState): EdenWorldState {
  return {
    ...state,
    apMaxBonusBase: state.apMaxBonusBase ?? 0,
    apMaxBonusDay: state.apMaxBonusDay ?? 0,
    divineThresholdModifier: state.divineThresholdModifier ?? 0,
    divineAffinityMultiplier: state.divineAffinityMultiplier ?? 1,
    playerName: state.playerName ?? "",
    unlockMapNpcLocations: state.unlockMapNpcLocations ?? false,
    unlockTreeNames: state.unlockTreeNames ?? false,
    freeMoveUsedThisSlot: state.freeMoveUsedThisSlot ?? 0,
    freeDialogueUsedThisSlot: state.freeDialogueUsedThisSlot ?? 0,
    freeDetourBypassUsedThisSlot: state.freeDetourBypassUsedThisSlot ?? 0,
    michaelSlayClaimed: state.michaelSlayClaimed ?? false,
    luciferAwakenClaimed: state.luciferAwakenClaimed ?? false,
    hiddenTopicIds: [...(state.hiddenTopicIds ?? [])],
    morningFlowRestoredThisSlot: state.morningFlowRestoredThisSlot ?? false,
    nightTideRestoredThisSlot: state.nightTideRestoredThisSlot ?? false,
    boundaryMarkForecastActive: state.boundaryMarkForecastActive ?? false,
    flameSwordClaimed: state.flameSwordClaimed ?? false,
    tokenStats: normalizeTokenStats(state.tokenStats),
    completedScenePuzzleIds: migrateEastPathPuzzleIds(state.completedScenePuzzleIds ?? []),
    hasDismissedObjectiveHint: state.hasDismissedObjectiveHint ?? false,
    divineAttentionValue: state.divineAttentionValue ?? 0,
    pendingDivineGiftChoice: state.pendingDivineGiftChoice ?? null,
    unlockedDivineAttentionRuleIds: [...(state.unlockedDivineAttentionRuleIds ?? [])],
    attentionRuleTriggerCounts: { ...(state.attentionRuleTriggerCounts ?? {}) },
    michaelDivinePunishmentActive: state.michaelDivinePunishmentActive ?? false,
    michaelExecutionPending: state.michaelExecutionPending ?? false,
    luciferZeroAffinityGiftClaimed: state.luciferZeroAffinityGiftClaimed ?? false,
    luciferSwimStage: state.luciferSwimStage ?? "none",
    worldEventHistory: (state.worldEventHistory ?? []).map((e) => ({ ...e })),
  };
}

function cloneWorldStateForPuzzle(state: EdenWorldState): EdenWorldState {
  return normalizePuzzleState({
    ...state,
    eveMind: { ...state.eveMind },
    adamMind: { ...state.adamMind },
    hedgehog: { ...state.hedgehog },
    npcLocations: { ...state.npcLocations },
    discoveredClues: [...state.discoveredClues],
    inventory: [...state.inventory],
    itemCounts: { ...(state.itemCounts ?? {}) },
    npcDialogues: state.npcDialogues.map((dialogue) => ({ ...dialogue })),
    corruptionTrace: state.corruptionTrace.map((trace) => ({ ...trace })),
    worldActions: { ...state.worldActions },
    toolCallHistory: [...state.toolCallHistory],
    actionsThisSlot: {
      whisperedNpcIds: [...(state.actionsThisSlot?.whisperedNpcIds ?? [])],
      sceneActionIds: [...(state.actionsThisSlot?.sceneActionIds ?? [])],
      usedItemIds: [...(state.actionsThisSlot?.usedItemIds ?? [])],
      hasWhisperedToWoman: state.actionsThisSlot?.hasWhisperedToWoman ?? false,
      hasGrantedPaidDayMoveAttention: state.actionsThisSlot?.hasGrantedPaidDayMoveAttention ?? false,
      hasGrantedPaidNightDialogueAttention: state.actionsThisSlot?.hasGrantedPaidNightDialogueAttention ?? false,
      moveCount: state.actionsThisSlot?.moveCount ?? 0,
    },
    unlockedAchievementIds: [...(state.unlockedAchievementIds ?? [])],
    usedItemIds: [...(state.usedItemIds ?? [])],
    sceneActionIds: [...(state.sceneActionIds ?? [])],
    pendingConsumableEffects: (state.pendingConsumableEffects ?? []).map((effect) => ({ ...effect })),
    resonanceUseHistory: (state.resonanceUseHistory ?? []).map((record) => ({ ...record })),
    divineGiftHistory: (state.divineGiftHistory ?? []).map((record) => ({ ...record })),
    divineAttentionCumulative: state.divineAttentionCumulative ?? 0,
    divineGiftsOwned: [...(state.divineGiftsOwned ?? [])],
    apMaxBonusBase: state.apMaxBonusBase ?? 0,
    apMaxBonusDay: state.apMaxBonusDay ?? 0,
    divineThresholdModifier: state.divineThresholdModifier ?? 0,
    divineAffinityMultiplier: state.divineAffinityMultiplier ?? 1,
    freeMoveUsedThisSlot: state.freeMoveUsedThisSlot ?? 0,
    freeDialogueUsedThisSlot: state.freeDialogueUsedThisSlot ?? 0,
    freeDetourBypassUsedThisSlot: state.freeDetourBypassUsedThisSlot ?? 0,
    michaelSlayClaimed: state.michaelSlayClaimed ?? false,
    luciferAwakenClaimed: state.luciferAwakenClaimed ?? false,
    hiddenTopicIds: [...(state.hiddenTopicIds ?? [])],
    divineAttentionValue: state.divineAttentionValue ?? 0,
    pendingDivineGiftChoice: state.pendingDivineGiftChoice ?? null,
    unlockedDivineAttentionRuleIds: [...(state.unlockedDivineAttentionRuleIds ?? [])],
    attentionRuleTriggerCounts: { ...(state.attentionRuleTriggerCounts ?? {}) },
    michaelDivinePunishmentActive: state.michaelDivinePunishmentActive ?? false,
    michaelExecutionPending: state.michaelExecutionPending ?? false,
    luciferZeroAffinityGiftClaimed: state.luciferZeroAffinityGiftClaimed ?? false,
    luciferSwimStage: state.luciferSwimStage ?? "none",
    worldEventHistory: (state.worldEventHistory ?? []).map((e) => ({ ...e })),
    morningFlowRestoredThisSlot: state.morningFlowRestoredThisSlot ?? false,
    nightTideRestoredThisSlot: state.nightTideRestoredThisSlot ?? false,
    boundaryMarkForecastActive: state.boundaryMarkForecastActive ?? false,
    flameSwordClaimed: state.flameSwordClaimed ?? false,
    tokenStats: normalizeTokenStats(state.tokenStats),
    playerName: state.playerName ?? "",
    unlockMapNpcLocations: state.unlockMapNpcLocations ?? false,
    unlockTreeNames: state.unlockTreeNames ?? false,
  });
}

export function isScenePuzzleCompleted(state: EdenWorldState, puzzleId: string): boolean {
  return (state.completedScenePuzzleIds ?? []).includes(puzzleId);
}

/**
 * 旧东园幽径谜题（单 id）拆为昼夜两个独立谜题后的读档迁移。
 * 旧存档只记录过一次「东园幽径」交互，保守视为「白天已完成」（夜晚仍可做一次）。
 */
function migrateEastPathPuzzleIds(ids: string[]): string[] {
  if (!ids.includes("puzzle_east_path_cautious_presence")) return [...ids];
  const next = ids.filter((id) => id !== "puzzle_east_path_cautious_presence");
  if (!next.includes("puzzle_east_path_cautious_presence_day")) {
    next.push("puzzle_east_path_cautious_presence_day");
  }
  return next;
}

export function isScenePuzzleAvailable(puzzle: ScenePuzzle, state: EdenWorldState): boolean {
  if (puzzle.locationId !== state.locationId) return false;
  if (puzzle.timeOfDay && puzzle.timeOfDay !== state.timeOfDay) return false;
  return !isScenePuzzleCompleted(state, puzzle.id);
}

export function getAvailableEnterPuzzle(
  puzzles: ScenePuzzle[],
  state: EdenWorldState,
): ScenePuzzle | null {
  return puzzles.find((puzzle) => puzzle.trigger === "on_enter" && isScenePuzzleAvailable(puzzle, state)) ?? null;
}

function findPuzzleOption(puzzle: ScenePuzzle, optionId: string): ScenePuzzleOption | null {
  return puzzle.options?.find((option) => option.id === optionId) ?? null;
}

function isSuccessfulOption(puzzle: ScenePuzzle, option: ScenePuzzleOption): boolean {
  return puzzle.successTags?.some((tag) => option.tags.includes(tag)) ?? false;
}

function addReward(results: ScenePuzzleRewardResult[], reward: ScenePuzzleRewardResult): void {
  results.push(reward);
}

// 场景题主动引目对应的"园中律则"ID（首次触发解锁；十倍刻度下注视 +N 经 grantDivineAttention）。
function getPuzzleAttentionRuleId(puzzleId: string, optionId: string): "scene_uplight" | undefined {
  // 仰光之痕：主动让目光落在自己身上 → scene_uplight
  if (puzzleId === "puzzle_tree_court_shadow" && optionId === "look_up") return "scene_uplight";
  return undefined;
}

// ---- per_option 模式：每选项独立结算（无成功/失败之分，全部完成事件） ----
function applyPerOptionAnswer(
  state: EdenWorldState,
  puzzle: ScenePuzzle,
  optionId: string,
): ScenePuzzleAnswerResult {
  const option = findPuzzleOption(puzzle, optionId);
  const next = cloneWorldStateForPuzzle(state);
  const alreadyCompleted = isScenePuzzleCompleted(next, puzzle.id);
  if (alreadyCompleted) {
    return {
      success: false,
      alreadyCompleted: true,
      selectedOptionId: optionId,
      feedback: "这个问题已经在本局留下答案，奖励不会再次出现。",
      state: next,
      rewards: [],
      divineGiftChoice: null,
    };
  }
  if (!option?.effect) {
    return {
      success: false,
      alreadyCompleted: false,
      selectedOptionId: optionId,
      feedback: "这个选择没有在园中留下痕迹。",
      state: next,
      rewards: [],
      divineGiftChoice: null,
    };
  }

  const rewards: ScenePuzzleRewardResult[] = [];
  const effect = option.effect;
  let divineGiftChoice: string[] | null = null;

  // wasPending 必须在应用 divineThresholdModifier / divineAttentionDelta 之前取
  const wasPending = !!next.pendingDivineGiftChoice && next.pendingDivineGiftChoice.length > 0;

  // 1. 道具（主道具 + 额外保留道具）
  if (effect.itemId) {
    grantResonance(next, effect.itemId, 1);
    // 恩泽棱镜：获时设倍率 2 并补算已持祝福的正向差额
    if (effect.itemId === "resonance_grace_prism") {
      applyGracePrismRetroactive(next);
    }
    const item = getItemById(effect.itemId);
    rewards.push({ type: "item", id: effect.itemId, title: item ? `回响：${item.title}` : effect.itemId });
  }
  if (effect.additionalItemId) {
    grantResonance(next, effect.additionalItemId, 1);
    const addItem = getItemById(effect.additionalItemId);
    rewards.push({
      type: "item",
      id: effect.additionalItemId,
      title: addItem ? `回响：${addItem.title}` : effect.additionalItemId,
    });
  }
  // 额外线索（保留旧有成就依赖，如四河回声线索）
  if (effect.clueId && !next.discoveredClues.includes(effect.clueId)) {
    next.discoveredClues.push(effect.clueId);
    const clue = getClueById(effect.clueId);
    rewards.push({
      type: "clue",
      id: effect.clueId,
      title: clue ? `线索：${clue.title}` : effect.clueId,
    });
  }

  // 2. 行动点上限加成（只累加字段，不回复当前 AP）
  if (effect.apMaxBonusBase) next.apMaxBonusBase = (next.apMaxBonusBase ?? 0) + effect.apMaxBonusBase;
  if (effect.apMaxBonusDay) next.apMaxBonusDay = (next.apMaxBonusDay ?? 0) + effect.apMaxBonusDay;

  // 3. 行动点即时变化
  if (effect.zeroActionPoints) next.actionPoints = 0;
  if (effect.restoreActionPointsToMax) next.actionPoints = getEffectiveMaxActionPoints(next);

  // 4. 神明注视值（十倍刻度：所有正向注视统一经 grantDivineAttention 单一入口）
  if (effect.divineAttentionDelta) {
    const ruleId = getPuzzleAttentionRuleId(puzzle.id, optionId);
    grantDivineAttention(next, {
      amount: effect.divineAttentionDelta,
      ruleId,
      source: "puzzle",
      isHighRisk: true,
    });
    rewards.push({ type: "attention", title: `神的注视 +${effect.divineAttentionDelta}` });
  }

  // 5. 献礼门槛修正（不清除当前注视值）
  if (effect.divineThresholdModifier) {
    next.divineThresholdModifier = (next.divineThresholdModifier ?? 0) + effect.divineThresholdModifier;
  }

  // 5.4 永久 AP 上限奖励总和限制（Task 4 Step 3：base + day 合计最多 +2）
  // 注意：effect 已在上方（2.行动点上限加成）写入 next，此处仅做"上限钳制 + 溢出转当前 AP"，
  // 不可再次累加，否则单次 +1 会被算成 +2。
  const AP_BONUS_CAP = 2;
  if (effect.apMaxBonusBase || effect.apMaxBonusDay) {
    const total = (next.apMaxBonusBase ?? 0) + (next.apMaxBonusDay ?? 0);
    if (total > AP_BONUS_CAP) {
      const overflow = total - AP_BONUS_CAP;
      // 优先削减 daylight 上限（清醒之眼），余额从 base 扣
      const dayCut = Math.min(next.apMaxBonusDay ?? 0, overflow);
      next.apMaxBonusDay = (next.apMaxBonusDay ?? 0) - dayCut;
      const baseCut = overflow - dayCut;
      next.apMaxBonusBase = (next.apMaxBonusBase ?? 0) - baseCut;
      // 溢出转化为当前行动点回复（不超过有效上限）
      const apRoom = getEffectiveMaxActionPoints(next) - next.actionPoints;
      const apGain = Math.max(0, Math.min(overflow, apRoom));
      if (apGain > 0) {
        next.actionPoints += apGain;
      }
    }
  }

  // 5.5 加百列好感 ±N（东园越界惩罚，下限 0）
  if (effect.gabrielAffinityDelta) {
    const rel = next.npcRelations["gabriel"] ?? ensureRelation(next, "gabriel");
    rel.affinity = Math.max(0, rel.affinity + effect.gabrielAffinityDelta);
    rewards.push({
      type: "trust",
      title: `加百列好感 ${effect.gabrielAffinityDelta > 0 ? "+" : ""}${effect.gabrielAffinityDelta}`,
    });
  }

  // 5.5 心智敬仰：夏娃/亚当对神的敬畏/顺从 ±N（天使残羽：透露神与天使都吃过此树）
  if (effect.eveObedienceDelta) {
    next.eveMind.obedience = clampMind(next.eveMind.obedience + effect.eveObedienceDelta);
    rewards.push({
      type: "trust",
      title: `女人对神的敬仰 ${effect.eveObedienceDelta > 0 ? "+" : ""}${effect.eveObedienceDelta}`,
    });
  }
  if (effect.adamObedienceDelta) {
    next.adamMind.obedience = clampMind(next.adamMind.obedience + effect.adamObedienceDelta);
    rewards.push({
      type: "trust",
      title: `亚当对神的敬仰 ${effect.adamObedienceDelta > 0 ? "+" : ""}${effect.adamObedienceDelta}`,
    });
  }

  // 6. 解锁开关
  if (effect.unlockMapNpcLocations) next.unlockMapNpcLocations = true;
  if (effect.unlockTreeNames) next.unlockTreeNames = true;

  // 6.5 溯源之水：时间回溯（重置除保留项外的全部状态）
  if (effect.triggerTimeRewind) {
    applyTimeRewind(next, puzzle.id);
  }

  // 6.6 逃离判定：持有火焰剑则进入 escape_eden 隐藏结局
  if (effect.triggerEscapeCheck && next.inventory.includes("resonance_flaming_sword")) {
    triggerEscapeEden(next);
  }

  // 7. 触发献礼（仅当此前未 pending、现在满足门槛且尚未结束）
  if (!next.isEnded && !wasPending && evaluateDivineGiftProgress(next)) {
    divineGiftChoice = next.pendingDivineGiftChoice ?? null;
  }

  // 8. 标记完成：可重复选项（maxStacks>1）在道具未达上限前不锁死谜题，允许再来一次；
  //    拿满上限、或选取了不可重复选项（默认 maxStacks=1）才锁死。
  //    用途：园心双树「拾月光」可重复至 2 枚，叠加每时段无视绕行 2 次。
  const maxStacks = option.maxStacks ?? 1;
  let markCompleted = true;
  if (maxStacks > 1 && effect.itemId) {
    const owned = next.itemCounts[effect.itemId] ?? 0;
    if (owned < maxStacks) markCompleted = false;
  }
  if (markCompleted) {
    next.completedScenePuzzleIds = [...next.completedScenePuzzleIds, puzzle.id];
  }
  return {
    success: true,
    alreadyCompleted: false,
    selectedOptionId: optionId,
    resultTitle: effect.resultTitle,
    feedback: effect.feedback,
    state: next,
    rewards,
    divineGiftChoice,
  };
}

export function applyScenePuzzleAnswer(
  state: EdenWorldState,
  puzzle: ScenePuzzle,
  optionId: string,
  answerText?: string,
): ScenePuzzleAnswerResult {
  // ---- 自由文本模式 ----
  if (puzzle.inputMode === "free_text") {
    return applyFreeTextAnswer(state, puzzle, answerText ?? "");
  }

  // ---- per_option 模式：每选项独立结算（无成功/失败之分） ----
  if (puzzle.resolutionMode === "per_option") {
    return applyPerOptionAnswer(state, puzzle, optionId);
  }

  const option = findPuzzleOption(puzzle, optionId);
  if (!option) {
    return {
      success: false,
      alreadyCompleted: false,
      selectedOptionId: optionId,
      feedback: "这个选择没有在园中留下痕迹。",
      state: normalizePuzzleState(state),
      rewards: [],
      divineGiftChoice: null,
    };
  }

  const next = cloneWorldStateForPuzzle(state);
  const alreadyCompleted = isScenePuzzleCompleted(next, puzzle.id);
  const success = isSuccessfulOption(puzzle, option);
  const rewards: ScenePuzzleRewardResult[] = [];
  let divineGiftChoice: string[] | null = null;

  if (alreadyCompleted) {
    return {
      success,
      alreadyCompleted: true,
      selectedOptionId: option.id,
      feedback: "这个问题已经在本局留下答案，奖励不会再次出现。",
      state: next,
      rewards,
      divineGiftChoice,
    };
  }

  if (!success) {
    if (puzzle.failure.attentionDelta) {
      grantDivineAttention(next, {
        amount: puzzle.failure.attentionDelta,
        source: "puzzle",
        isHighRisk: true,
      });
      addReward(rewards, {
        type: "attention",
        title: `神的注视 +${puzzle.failure.attentionDelta}`,
      });
      divineGiftChoice = evaluateDivineGiftProgress(next);
    }

    return {
      success: false,
      alreadyCompleted: false,
      selectedOptionId: option.id,
      feedback: puzzle.failure.hint,
      state: next,
      rewards,
      divineGiftChoice,
    };
  }

  if (puzzle.rewards.clueId && !next.discoveredClues.includes(puzzle.rewards.clueId)) {
    next.discoveredClues.push(puzzle.rewards.clueId);
    const clue = getClueById(puzzle.rewards.clueId);
    addReward(rewards, {
      type: "clue",
      id: puzzle.rewards.clueId,
      title: clue ? `线索：${clue.title}` : `线索：${puzzle.rewards.clueId}`,
    });
  }

  if (puzzle.rewards.itemId) {
    const beforeCount = next.itemCounts[puzzle.rewards.itemId] ?? 0;
    const granted = grantResonance(next, puzzle.rewards.itemId, 1);
    const afterCount = next.itemCounts[puzzle.rewards.itemId] ?? 0;
    if (granted && afterCount > beforeCount) {
      const item = getItemById(puzzle.rewards.itemId);
      addReward(rewards, {
        type: "item",
        id: puzzle.rewards.itemId,
        title: item ? `回响：${item.title}` : `回响：${puzzle.rewards.itemId}`,
      });
    }
  }

  if (puzzle.rewards.trustDelta) {
    next.eveMind.serpentTrust = clampMind(next.eveMind.serpentTrust + puzzle.rewards.trustDelta);
    addReward(rewards, {
      type: "trust",
      title: `夏娃愿意倾听 +${puzzle.rewards.trustDelta}`,
    });
  }

  if (puzzle.rewards.attentionDelta) {
    grantDivineAttention(next, {
      amount: puzzle.rewards.attentionDelta,
      source: "puzzle",
      isHighRisk: true,
    });
    addReward(rewards, {
      type: "attention",
      title: puzzle.rewards.attentionDelta > 0
        ? `神的注视 +${puzzle.rewards.attentionDelta}`
        : `神的注视 ${puzzle.rewards.attentionDelta}`,
    });
    divineGiftChoice = evaluateDivineGiftProgress(next);
  }

  next.completedScenePuzzleIds = [...next.completedScenePuzzleIds, puzzle.id];

  return {
    success: true,
    alreadyCompleted: false,
    selectedOptionId: option.id,
      feedback: puzzle.successFeedback,
      state: next,
      rewards,
      divineGiftChoice,
    };
}

// ---- 自由文本模式 ----
function applyFreeTextAnswer(
  state: EdenWorldState,
  puzzle: ScenePuzzle,
  answerText: string,
): ScenePuzzleAnswerResult {
  const result = evaluateFreeTextAnswer(answerText, puzzle.evaluationId ?? "");
  const next = cloneWorldStateForPuzzle(state);
  const alreadyCompleted = isScenePuzzleCompleted(next, puzzle.id);

  if (alreadyCompleted) {
    return {
      success: false,
      alreadyCompleted: true,
      selectedOptionId: "",
      grade: result?.grade,
      feedback: "这个问题已经在本局留下答案，奖励不会再次出现。",
      state: next,
      rewards: [],
      divineGiftChoice: null,
    };
  }

  const grade = result?.grade ?? "wrong";
  const success = grade === "correct" || grade === "close";

  // 刻名石留名：成功时把玩家输入持久化到 state（存档保留玩家名称）
  if (puzzle.id === "puzzle_naming_stone_identity" && success && answerText.trim()) {
    next.playerName = answerText.trim();
  }

  if (!success) {
    const hint = result?.feedback ?? puzzle.failure.hint;
    if (puzzle.failure.attentionDelta) {
      grantDivineAttention(next, {
        amount: puzzle.failure.attentionDelta,
        source: "puzzle",
        isHighRisk: true,
      });
    }
    return {
      success: false,
      alreadyCompleted: false,
      selectedOptionId: "",
      grade,
      feedback: hint,
      state: next,
      rewards: [],
      divineGiftChoice: null,
    };
  }

  const rewards: ScenePuzzleRewardResult[] = [];
  if (puzzle.rewards.clueId && !next.discoveredClues.includes(puzzle.rewards.clueId)) {
    next.discoveredClues.push(puzzle.rewards.clueId);
    const clue = getClueById(puzzle.rewards.clueId);
    rewards.push({
      type: "clue",
      id: puzzle.rewards.clueId,
      title: clue ? `线索：${clue.title}` : `线索：${puzzle.rewards.clueId}`,
    });
  }
  if (puzzle.rewards.itemId) {
    const before = next.itemCounts[puzzle.rewards.itemId] ?? 0;
    grantResonance(next, puzzle.rewards.itemId, 1);
    const after = next.itemCounts[puzzle.rewards.itemId] ?? 0;
    if (after > before) {
      const item = getItemById(puzzle.rewards.itemId);
      rewards.push({
        type: "item",
        id: puzzle.rewards.itemId,
        title: item ? `回响：${item.title}` : `回响：${puzzle.rewards.itemId}`,
      });
    }
  }
  if (puzzle.rewards.trustDelta) {
    next.eveMind.serpentTrust = Math.max(0, Math.min(100, next.eveMind.serpentTrust + puzzle.rewards.trustDelta));
  }

  next.completedScenePuzzleIds = [...next.completedScenePuzzleIds, puzzle.id];

  return {
    success: true,
    alreadyCompleted: false,
    selectedOptionId: "",
    grade,
      feedback: result?.feedback ?? puzzle.successFeedback,
      state: next,
      rewards,
      divineGiftChoice: null,
    };
}

