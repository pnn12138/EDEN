// ============================================================
// 第一章免费行动次数池（叠加规则）
//
// 改用"本时段免费次数池"替代单一布尔免费判断：
// - 免费次数由持有道具派生（getFreeMoveCharges / getFreeDialogueCharges）
// - 已用次数写入存档（freeMoveUsedThisSlot / freeDialogueUsedThisSlot）
// - 剩余次数 = 派生次数 − 已用次数
// - 进入新时段由 resetSlotActions 清零已用次数，剩余自动重算
//
// 设计点：
// - 无羁之步（gift_free_move）从"所有移动免费"降为"每时段第一次移动免费"（预期削弱）。
// - 一次性 consumable 仍走 pendingConsumableEffects，与永久次数叠加不覆盖。
// - 晨流回环 / 夜潮回声额外恢复 1 行动点用独立本时段标记防重复。
// ============================================================

import type { EdenWorldState } from "@/game/world/types";

/** 本时段免费移动次数（派生）：各永久道具贡献之和，但每时段最多 1 次（Task 4 Step 3） */
export function getFreeMoveCharges(state: EdenWorldState): number {
  let n = 0;
  if (state.inventory.includes("gift_free_move")) n += 1; // 无羁之步：每时段 1 次
  if (state.inventory.includes("passive_light_step")) n += 1; // 轻步印记：每时段 1 次
  if (state.inventory.includes("resonance_day_shade_step") && state.timeOfDay === "day") n += 1; // 昼荫轻步：仅白天 1 次
  // 晨流回环：仅白天 +1（且额外恢复 1AP，见 tool/route.ts）
  if (state.inventory.includes("resonance_morning_flow") && state.timeOfDay === "day") n += 1;
  // 每时段最多一次免费移动：多件免费道具不再叠加
  return Math.min(1, n);
}

/** 本时段免费对话次数（派生）：仅夜晚生效的永久道具贡献 */
export function getFreeDialogueCharges(state: EdenWorldState): number {
  let n = 0;
  // 夜露缄声：仅夜晚 +1
  if (state.inventory.includes("resonance_night_silence") && state.timeOfDay === "night") n += 1;
  // 夜潮回声：仅夜晚 +1（且额外恢复 1AP）
  if (state.inventory.includes("resonance_night_tide_echo") && state.timeOfDay === "night") n += 1;
  return n;
}

/** 本时段剩余免费移动次数 */
export function getFreeMoveRemaining(state: EdenWorldState): number {
  return Math.max(0, getFreeMoveCharges(state) - (state.freeMoveUsedThisSlot ?? 0));
}

/** 本时段剩余免费对话次数 */
export function getFreeDialogueRemaining(state: EdenWorldState): number {
  return Math.max(0, getFreeDialogueCharges(state) - (state.freeDialogueUsedThisSlot ?? 0));
}

// ---- 无视绕行次数池（月光道标派生） ----
// 月光道标从「每次非相邻移动消耗 1 枚（可囤货全程无视）」削弱为「每时段固定次数池」：
// 持有 1 枚=每时段 1 次无视绕行，2 枚=2 次。仅解除非相邻限制，不免行动点。
/** 本时段可无视绕行的次数（派生）：月光道标每枚贡献 1 次，上限 2 */
export function getFreeDetourBypassCharges(state: EdenWorldState): number {
  const owned = state.itemCounts?.["moonlight_path_marker"] ?? 0;
  return Math.min(2, Math.max(0, owned));
}

/** 本时段剩余可无视绕行的次数 */
export function getFreeDetourBypassRemaining(state: EdenWorldState): number {
  return Math.max(0, getFreeDetourBypassCharges(state) - (state.freeDetourBypassUsedThisSlot ?? 0));
}

/** 尝试消耗一次无视绕行；成功返回 true（调用方据此放行非相邻移动） */
export function tryConsumeFreeDetourBypass(state: EdenWorldState): boolean {
  if (getFreeDetourBypassRemaining(state) <= 0) return false;
  state.freeDetourBypassUsedThisSlot = (state.freeDetourBypassUsedThisSlot ?? 0) + 1;
  return true;
}

/** 尝试消耗一次免费移动；成功返回 true（调用方应将本次移动 cost 置 0） */
export function tryConsumeFreeMove(state: EdenWorldState): boolean {
  if (getFreeMoveRemaining(state) <= 0) return false;
  state.freeMoveUsedThisSlot = (state.freeMoveUsedThisSlot ?? 0) + 1;
  return true;
}

/** 尝试消耗一次免费对话；成功返回 true（调用方应将本次低语 cost 置 0） */
export function tryConsumeFreeDialogue(state: EdenWorldState): boolean {
  if (getFreeDialogueRemaining(state) <= 0) return false;
  state.freeDialogueUsedThisSlot = (state.freeDialogueUsedThisSlot ?? 0) + 1;
  return true;
}
