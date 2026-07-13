// ============================================================
// 第一章「溯源之水」时间回溯规则层
//
// 玩家在四河分流选择「溯源之水」后，立即触发时间回溯：
// 将世界状态恢复为开局第一日清晨，但保留已获得的回响/道具、
// 神赐祝福、回响使用历史、已解锁印记、Token 统计与玩家名。
//
// 设计要点：
// - 用 initialEdenWorldState 深拷贝整体覆盖，保证完全重置。
// - 仅保留需求列出的字段；其余一律回到开局。
// - completedScenePuzzleIds 只保留当前问题 ID，防止反复触发回溯。
// - 回溯后回到 explore 阶段（不重播开场 intro）。
// ============================================================

import type { EdenWorldState } from "@/game/world/types";
import { initialEdenWorldState } from "@/game/world/types";
import { getEffectiveMaxActionPoints } from "@/game/world/actionPointRules";

/**
 * 时间回溯：恢复开局状态。
 * @param keepPuzzleId 当前四河分流场景问题 ID（回溯后仍保持已完成）
 */
export function applyTimeRewind(state: EdenWorldState, keepPuzzleId: string): void {
  // ---- 保留内容（不因回溯丢失） ----
  const keepInventory = [...state.inventory];
  const keepItemCounts = { ...state.itemCounts };
  const keepDivineGiftsOwned = [...state.divineGiftsOwned];
  const keepDivineGiftHistory = [...state.divineGiftHistory];
  const keepResonanceUseHistory = [...state.resonanceUseHistory];
  const keepUnlockedAchievementIds = [...state.unlockedAchievementIds];
  const keepTokenStats = { ...state.tokenStats };
  const keepPlayerName = state.playerName;
  const keepUnlockMapNpcLocations = state.unlockMapNpcLocations;
  const keepUnlockTreeNames = state.unlockTreeNames;
  const keepDivineAffinityMultiplier = state.divineAffinityMultiplier;
  const keepDivineThresholdModifier = state.divineThresholdModifier;
  const keepApMaxBonusBase = state.apMaxBonusBase;
  const keepApMaxBonusDay = state.apMaxBonusDay;
  const keepHasDismissedObjectiveHint = state.hasDismissedObjectiveHint;

  // ---- 全量重置为开局（深拷贝，避免与常量 initialEdenWorldState 共享引用） ----
  const fresh = JSON.parse(JSON.stringify(initialEdenWorldState)) as EdenWorldState;
  Object.assign(state, fresh);

  // 回溯后继续游玩，不重播开场引子
  state.phase = "explore";

  // ---- 恢复保留内容 ----
  state.inventory = keepInventory;
  state.itemCounts = keepItemCounts;
  state.divineGiftsOwned = keepDivineGiftsOwned;
  state.divineGiftHistory = keepDivineGiftHistory;
  state.resonanceUseHistory = keepResonanceUseHistory;
  state.unlockedAchievementIds = keepUnlockedAchievementIds;
  state.tokenStats = keepTokenStats;
  state.playerName = keepPlayerName;
  state.unlockMapNpcLocations = keepUnlockMapNpcLocations;
  state.unlockTreeNames = keepUnlockTreeNames;
  state.divineAffinityMultiplier = keepDivineAffinityMultiplier;
  state.divineThresholdModifier = keepDivineThresholdModifier;
  state.apMaxBonusBase = keepApMaxBonusBase;
  state.apMaxBonusDay = keepApMaxBonusDay;
  state.hasDismissedObjectiveHint = keepHasDismissedObjectiveHint;

  // 行动点恢复到当前有效上限
  state.actionPoints = getEffectiveMaxActionPoints(state);

  // 四河分流当前问题仍保持已完成（防止反复触发时间回溯）
  state.completedScenePuzzleIds = [keepPuzzleId];
}
