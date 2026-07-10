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
import { applyDivineAttention } from "@/game/world/divineAttentionRules";
import { triggerDivineGiftIfFull, type DivineGiftResult } from "@/game/world/divineGiftRules";
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
  feedback: string;
  state: EdenWorldState;
  rewards: ScenePuzzleRewardResult[];
  divineGift?: DivineGiftResult | null;
};

function clampMind(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function normalizePuzzleState(state: EdenWorldState): EdenWorldState {
  return {
    ...state,
    completedScenePuzzleIds: [...(state.completedScenePuzzleIds ?? [])],
    hasDismissedObjectiveHint: state.hasDismissedObjectiveHint ?? false,
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
    },
    unlockedAchievementIds: [...(state.unlockedAchievementIds ?? [])],
    usedItemIds: [...(state.usedItemIds ?? [])],
    sceneActionIds: [...(state.sceneActionIds ?? [])],
    pendingConsumableEffects: (state.pendingConsumableEffects ?? []).map((effect) => ({ ...effect })),
    resonanceUseHistory: (state.resonanceUseHistory ?? []).map((record) => ({ ...record })),
    divineGiftHistory: (state.divineGiftHistory ?? []).map((record) => ({ ...record })),
  });
}

export function isScenePuzzleCompleted(state: EdenWorldState, puzzleId: string): boolean {
  return (state.completedScenePuzzleIds ?? []).includes(puzzleId);
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

  const option = findPuzzleOption(puzzle, optionId);
  if (!option) {
    return {
      success: false,
      alreadyCompleted: false,
      selectedOptionId: optionId,
      feedback: "这个选择没有在园中留下痕迹。",
      state: normalizePuzzleState(state),
      rewards: [],
      divineGift: null,
    };
  }

  const next = cloneWorldStateForPuzzle(state);
  const alreadyCompleted = isScenePuzzleCompleted(next, puzzle.id);
  const success = isSuccessfulOption(puzzle, option);
  const rewards: ScenePuzzleRewardResult[] = [];
  let divineGift: DivineGiftResult | null = null;

  if (alreadyCompleted) {
    return {
      success,
      alreadyCompleted: true,
      selectedOptionId: option.id,
      feedback: "这个问题已经在本局留下答案，奖励不会再次出现。",
      state: next,
      rewards,
      divineGift,
    };
  }

  if (!success) {
    if (puzzle.failure.attentionDelta) {
      next.divineAttention = applyDivineAttention(next.divineAttention, puzzle.failure.attentionDelta);
      addReward(rewards, {
        type: "attention",
        title: `神的注视 +${puzzle.failure.attentionDelta}`,
      });
      divineGift = triggerDivineGiftIfFull(next);
    }

    return {
      success: false,
      alreadyCompleted: false,
      selectedOptionId: option.id,
      feedback: puzzle.failure.hint,
      state: next,
      rewards,
      divineGift,
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
    next.divineAttention = applyDivineAttention(next.divineAttention, puzzle.rewards.attentionDelta);
    addReward(rewards, {
      type: "attention",
      title: puzzle.rewards.attentionDelta > 0
        ? `神的注视 +${puzzle.rewards.attentionDelta}`
        : `神的注视 ${puzzle.rewards.attentionDelta}`,
    });
    divineGift = triggerDivineGiftIfFull(next);
  }

  next.completedScenePuzzleIds = [...next.completedScenePuzzleIds, puzzle.id];

  return {
    success: true,
    alreadyCompleted: false,
    selectedOptionId: option.id,
    feedback: puzzle.successFeedback,
    state: next,
    rewards,
    divineGift,
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
      divineGift: null,
    };
  }

  const grade = result?.grade ?? "wrong";
  const success = grade === "correct" || grade === "close";

  if (!success) {
    const hint = result?.feedback ?? puzzle.failure.hint;
    if (puzzle.failure.attentionDelta) {
      next.divineAttention = applyDivineAttention(next.divineAttention, puzzle.failure.attentionDelta);
    }
    return {
      success: false,
      alreadyCompleted: false,
      selectedOptionId: "",
      grade,
      feedback: hint,
      state: next,
      rewards: [],
      divineGift: null,
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
    divineGift: null,
  };
}

