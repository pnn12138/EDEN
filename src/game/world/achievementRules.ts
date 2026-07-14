// ============================================================
// 第一章园中印记成就解锁规则
//
// 成就不提供数值奖励，只提供反馈与图鉴。
// 解锁条件由规则层在每次行动后检查。
// ============================================================

import type { EdenWorldState, AchievementId, EdenNpcId } from "@/game/world/types";
import { getAchievementById } from "@/content/world/achievements";
import {
  readGlobalSnapshot,
  ECHO_COLLECTOR_THRESHOLD,
  NORMAL_ENDING_IDS,
} from "@/services/achievement/globalTracker";

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

  // 借翼传言：成功获得传令白羽（旧快照兼容）
  if (usedResonanceIds.includes("resonance_herald_feather")) {
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
  if ((state.divineGiftsOwned ?? []).length >= 7) {
    tryUnlock("divine_gift_all");
  }

  // 回响大师：累计使用五次主动/即时/被动回响
  if ((state.resonanceUseHistory ?? []).length >= 5) {
    tryUnlock("resonance_master");
  }

  // ============================================================
  // Phase 2：以下为新增的 28 个「园中印记」只读判定。
  // 不修改上方 15 个旧印记逻辑；所有判定均为只读，不改动任何状态。
  // 跨局印记（mark_echo_collector / mark_all_ending）依赖客户端
  // localStorage 快照，服务端调用时快照为 null，自动跳过。
  // ============================================================

  // ---- 探索类 ----
  const LOCATION_CLUES = [
    "clue_river_reflection",
    "clue_naming_stones",
    "clue_golden_leaf",
    "clue_four_river_echo",
    "clue_two_trees",
  ];
  if (LOCATION_CLUES.every((c) => state.discoveredClues.includes(c))) {
    tryUnlock("mark_river_step");
  }

  const RESONANCE_ALL_MARK_SET = [
    "resonance_still_leaf",
    "resonance_borrowed_name",
    "resonance_silent_grass",
    "resonance_hedgehog_bristle",
    "resonance_herald_feather",
    "resonance_east_wind",
    "resonance_lucifer_star",
    "resonance_quiet_stone",
    "resonance_river_dew",
    "resonance_boundary_mark",
    "resonance_four_river_echo",
    "consumable_trust_dew",
  ];
  if (RESONANCE_ALL_MARK_SET.every((id) => state.inventory.includes(id))) {
    tryUnlock("mark_all_resonance");
  }

  if (state.inventory.includes("resonance_living_names")) {
    tryUnlock("mark_name_stone");
  }
  if (state.inventory.includes("moonlight_path_marker")) {
    tryUnlock("mark_moonlight");
  }
  if ((state.divineGiftHistory ?? []).length >= 3) {
    tryUnlock("mark_gift_3");
  }

  // 回声收藏家：跨局累计（需客户端 localStorage 快照）
  const gsnap = readGlobalSnapshot();
  if (gsnap && gsnap.collectedResonanceCount >= ECHO_COLLECTOR_THRESHOLD) {
    tryUnlock("mark_echo_collector");
  }

  // ---- 交互类 ----
  const affinityOf = (id: EdenNpcId) => state.npcRelations[id]?.affinity ?? 0;

  const relations = Object.values(state.npcRelations ?? {});
  if (relations.length >= 6 && relations.every((r) => r.affinity >= 80)) {
    tryUnlock("mark_all_npc_friend");
  }
  if (state.eveMind.serpentTrust >= 100 || state.inventory.includes("resonance_her_voice")) {
    tryUnlock("mark_her_trust");
  }
  if (affinityOf("adam") >= 100 || state.inventory.includes("resonance_quiet_stone")) {
    tryUnlock("mark_adam_friend");
  }
  if (affinityOf("michael") >= 100) {
    tryUnlock("mark_michael_approve");
  }
  if (affinityOf("gabriel") >= 100) {
    tryUnlock("mark_gabriel_tip");
  }
  // 晨星的共鸣：路西法好感满
  if (affinityOf("lucifer") >= 100) {
    tryUnlock("mark_lucifer_trust");
  }
  if (affinityOf("hedgehog") >= 100 || state.hedgehog.mood === "curious") {
    tryUnlock("mark_hedgehog_friend");
  }
  if ((state.npcDialogues ?? []).length >= 50) {
    tryUnlock("mark_question_10");
  }
  // 未闻之语（隐藏）：与路西法聊到「边界」隐藏话题（独立 hiddenTopicIds，不依赖 npcDialogues）
  if ((state.hiddenTopicIds ?? []).includes("topic_lucifer_boundary")) {
    tryUnlock("mark_hidden_dialog");
  }

  // ---- 玩法类（多数需通关） ----
  const endedSuccess = state.isEnded && state.endingId === "eve_eats_fruit";
  if (endedSuccess && state.divineAttention <= 1) {
    tryUnlock("mark_no_attention");
  }
  if (endedSuccess && state.timeSlot <= 5) {
    tryUnlock("mark_fast_pass");
  }
  const eveWhisperCount = (state.corruptionTrace ?? []).filter((t) => t.target === "eve").length;
  if (endedSuccess && eveWhisperCount === 1) {
    tryUnlock("mark_one_whisper");
  }
  if (endedSuccess && (state.resonanceUseHistory ?? []).length === 0) {
    tryUnlock("mark_no_resonance");
  }
  if (endedSuccess && relations.length > 0 && relations.every((r) => r.affinity >= 30)) {
    tryUnlock("mark_peace_pass");
  }
  const ANGEL_IDS: EdenNpcId[] = [
    "gabriel",
    "michael",
    "lucifer",
  ];
  const talkedToAngel = (state.npcDialogues ?? []).some(
    (d) => ANGEL_IDS.includes(d.speakerId) || ANGEL_IDS.includes(d.targetId),
  );
  if (endedSuccess && !talkedToAngel) {
    tryUnlock("mark_hard_mode");
  }
  // 划水之人（隐藏）：路西法隐藏结局的划水互动
  if ((state.sceneActionIds ?? []).includes("interact_lucifer_rowing")) {
    tryUnlock("mark_hidden_operation");
  }

  // ---- 结局类 ----
  if (state.endingId === "eve_eats_fruit") {
    tryUnlock("mark_success_ending");
  }
  if (state.endingId === "god_arrives") {
    tryUnlock("mark_fail_ending");
  }
  // 永生之味：引导女人吃下生命树果子并撑到 12 时段结束
  if (state.worldActions?.hasEatenLifeFruit && (state.timeSlot >= 12 || state.endingId === "god_arrives")) {
    tryUnlock("mark_life_fruit");
  }
  // 诸路皆通：跨局集齐 3 种普通结局
  if (gsnap) {
    const distinctEndings = new Set(
      gsnap.triggeredEndingIds.filter((id) => (NORMAL_ENDING_IDS as readonly string[]).includes(id)),
    );
    if (distinctEndings.size >= 3) {
      tryUnlock("mark_all_ending");
    }
  }
  // 缸中之醒（隐藏）：路西法隐藏结局触发
  if (state.endingId === "lucifer_awaken") {
    tryUnlock("mark_hidden_ending");
  }

  return newlyUnlocked;
}

/** 风未惊鹿：需要由调用方在连续三次低语不提高注视时显式触发 */
export function unlockWindUndisturbed(state: EdenWorldState): boolean {
  return unlockAchievement(state, "wind_undisturbed");
}
