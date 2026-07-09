// ============================================================
// 第一章场景互动内容表
//
// 本轮只保留刺猬作为 scene_action。刻名石已迁移到 scenePuzzles.ts，
// 其他旧隐藏热点停用，避免重复点击和透明点击区域。
// ============================================================

import type { EdenLocationId, TimeOfDay } from "@/game/world/types";

export type SceneAction = {
  id: string;
  locationId: EdenLocationId;
  /** 玩家可见动作名 */
  label: string;
  /** 玩家可见描述 */
  description: string;
  apCost: number;
  availability: {
    timeOfDay?: TimeOfDay;
    minTimeSlot?: number;
    maxTimeSlot?: number;
    maxDivineAttention?: number;
  };
  rewards: {
    clueIds?: string[];
    itemIds?: string[];
    /** 玩家可见叙事反馈 */
    narration: string;
  };
};

export const SCENE_ACTIONS: SceneAction[] = [
  // ---- 万物受名处 ----
  {
    id: "interact_with_hedgehog",
    locationId: "adam_garden_work",
    label: "观察刺猬",
    description: "刺猬在草边。连续点击刺猬2次，安静地观察它，或许能获得它的信任。",
    apCost: 1,
    availability: {},
    rewards: {
      itemIds: ["resonance_hedgehog_bristle"],
      narration:
        "你安静地观察刺猬。它从草边拱出一小段柔软的刺草，像是在提醒你把声音放轻。",
    },
  },
];

/** 按地点获取可用场景互动 */
export function getSceneActionsByLocation(
  locationId: EdenLocationId,
  timeOfDay: TimeOfDay,
  timeSlot: number,
  divineAttention: number,
): SceneAction[] {
  return SCENE_ACTIONS.filter((a) => {
    if (a.locationId !== locationId) return false;
    const av = a.availability;
    if (av.timeOfDay && av.timeOfDay !== timeOfDay) return false;
    if (av.minTimeSlot && timeSlot < av.minTimeSlot) return false;
    if (av.maxTimeSlot && timeSlot > av.maxTimeSlot) return false;
    if (av.maxDivineAttention !== undefined && divineAttention > av.maxDivineAttention) return false;
    return true;
  });
}

/** 按 ID 获取场景互动 */
export function getSceneActionById(id: string): SceneAction | undefined {
  return SCENE_ACTIONS.find((a) => a.id === id);
}
