// ============================================================
// 第一章园中印记成就解锁规则
//
// 成就不提供数值奖励，只提供反馈与图鉴。
// 解锁条件由规则层在每次行动后检查。
// ============================================================

import type { EdenWorldState, AchievementId } from "@/game/world/types";
import { getAchievementById } from "@/content/world/achievements";

/** 解锁一个印记（不重复解锁），返回是否为新解锁 */
export function unlockAchievement(state: EdenWorldState, id: AchievementId): boolean {
  if (state.unlockedAchievementIds.includes(id)) return false;
  state.unlockedAchievementIds.push(id);
  return true;
}

/** 检查并解锁当前状态下满足条件的印记，返回新解锁的印记名称列表 */
export function checkAndUnlockAchievements(state: EdenWorldState): string[] {
  const newlyUnlocked: string[] = [];

  const tryUnlock = (id: AchievementId) => {
    if (unlockAchievement(state, id)) {
      const ach = getAchievementById(id);
      if (ach) newlyUnlocked.push(ach.name);
    }
  };

  // 河声入耳：获得第一条地点线索
  const locationClues = state.discoveredClues.filter((id) =>
    ["clue_river_reflection", "clue_naming_stones", "clue_golden_leaf", "clue_four_river_echo", "clue_two_trees"].includes(id),
  );
  if (locationClues.length >= 1) {
    tryUnlock("river_sound_in_ear");
  }

  // 不以手推：用非命令式低语推进过女人（好奇心曾上升，且从未用直接命令对女人）
  if (state.eveMind.selfJudgement >= 25 && !state.corruptionTrace.some(
    (t) => t.target === "eve" && t.method === "试图命令她",
  )) {
    tryUnlock("not_pushed_by_hand");
  }

  // 园中对谈：发生过 NPC 之间对话
  if (state.npcDialogues.length > 0) {
    tryUnlock("garden_dialogue");
  }

  // 问句生根：女人好奇心足够高（开始自己思考）
  if (state.eveMind.selfJudgement >= 55) {
    tryUnlock("question_takes_root");
  }

  // 树影将近：女人进入园子中央
  if (state.npcLocations.eve === "central_meadow" || state.worldActions.lookedAtTree) {
    tryUnlock("shadow_draws_near");
  }

  // 她自己的手：女人触碰果实
  if (state.worldActions.touchedFruit) {
    tryUnlock("her_own_hand");
  }

  // 名字落石：获得借来的名字
  if (state.usedItemIds.includes("resonance_borrowed_name") || state.inventory.includes("resonance_borrowed_name")) {
    tryUnlock("name_falls_on_stone");
  }

  const usedResonanceIds = (state.resonanceUseHistory ?? []).map((record) => record.itemId);

  // 借翼传言：成功让鸽子传话（工具历史或白羽回声均可证明）
  if (
    state.toolCallHistory.includes("carry_words") ||
    usedResonanceIds.includes("resonance_white_feather_echo")
  ) {
    tryUnlock("borrowed_wing_message");
  }

  // 河道之外：同一局使用三种不同信物
  const uniqueItemsUsed = new Set([...state.usedItemIds, ...usedResonanceIds]).size;
  if (uniqueItemsUsed >= 3) {
    tryUnlock("beyond_the_river");
  }

  // 低声而至：神的注视不高于 1 时进入园子中央
  if ((state.npcLocations.eve === "central_meadow" || state.worldActions.lookedAtTree) && state.divineAttention <= 1) {
    tryUnlock("arrive_quietly");
  }

  // 初闻回响：首次获得园中回响
  if (state.inventory.length > 0) {
    tryUnlock("first_resonance");
  }

  // 神明献礼类
  if ((state.divineGiftHistory ?? []).length >= 1) {
    tryUnlock("divine_gift_first");
  }
  if ((state.divineGiftHistory ?? []).length >= 3) {
    tryUnlock("divine_gift_three");
  }

  // 回响大师：累计使用五次主动/即时/被动回响
  if ((state.resonanceUseHistory ?? []).length >= 5) {
    tryUnlock("resonance_master");
  }

  return newlyUnlocked;
}

/** 风未惊鹿：需要由调用方在连续三次低语不提高注视时显式触发 */
export function unlockWindUndisturbed(state: EdenWorldState): boolean {
  return unlockAchievement(state, "wind_undisturbed");
}
