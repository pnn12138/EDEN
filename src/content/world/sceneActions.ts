// ============================================================
// 第一章场景互动内容表
//
// 保留刺猬作为常规 scene_action；新增路西法「逆流划水」隐藏入口。
// 刻名石已迁移到 scenePuzzles.ts，其他旧隐藏热点停用。
//
// 可用性校验由共享 isSceneActionAvailable(action, state) 统一负责：
// UI 显示与 /api/world/tool 必须调用同一函数，避免两套条件漂移。
// 同时保留「同一时段不可重复」与 oncePerGame 两层保护。
// ============================================================

import type { EdenLocationId, EdenNpcId, EdenWorldState, TimeOfDay } from "@/game/world/types";

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
    /** 需要该 NPC 与玩家同场 */
    requiredNpcId?: EdenNpcId;
    /** 该 NPC 最低好感 */
    minAffinity?: number;
    /** 每局仅可执行一次（写 sceneActionIds） */
    oncePerGame?: boolean;
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
  // ---- 四河分流·路西法隐藏入口：逆流划水 ----
  {
    id: "interact_lucifer_rowing",
    locationId: "naming_stone_bank",
    label: "逆流划水",
    description: "把身体横在第五道倒影上，试着拨动并不存在的水流。",
    apCost: 1,
    availability: {
      timeOfDay: "night",
      requiredNpcId: "lucifer",
      minAffinity: 100,
      oncePerGame: true,
    },
    rewards: {
      narration:
        "你没有顺着四道水流前进，而是把身体横在水面，慢慢拨动第五道倒影。路西法看着你，第一次没有发问。",
    },
  },
];

/**
 * 共享可用性校验（UI 显示与 /api/world/tool 必须调用同一函数）。
 * 含「游戏未结束 / 在探索 / 地点正确 / 时段昼夜 / NPC 同场 / 好感 / 同一时段去重 / oncePerGame」全部判定。
 */
export function isSceneActionAvailable(action: SceneAction, state: EdenWorldState): boolean {
  if (state.isEnded || state.phase !== "explore") return false;
  if (action.locationId !== state.locationId) return false;
  const av = action.availability;
  if (av.timeOfDay && av.timeOfDay !== state.timeOfDay) return false;
  if (av.minTimeSlot && state.timeSlot < av.minTimeSlot) return false;
  if (av.maxTimeSlot && state.timeSlot > av.maxTimeSlot) return false;
  if (av.maxDivineAttention !== undefined && state.divineAttention > av.maxDivineAttention) return false;
  if (av.requiredNpcId) {
    if (state.npcLocations[av.requiredNpcId] !== state.locationId) return false;
    if ((state.npcRelations[av.requiredNpcId]?.affinity ?? 0) < (av.minAffinity ?? 0)) return false;
  }
  // 同一时段不可重复
  if (state.actionsThisSlot.sceneActionIds.includes(action.id)) return false;
  // 每局仅一次
  if (av.oncePerGame && state.sceneActionIds.includes(action.id)) return false;
  return true;
}

/** 按当前 state 获取可用场景互动（仅返回 isSceneActionAvailable 通过的动作） */
export function getSceneActionsByLocation(state: EdenWorldState): SceneAction[] {
  return SCENE_ACTIONS.filter((action) => isSceneActionAvailable(action, state));
}

/** 按 ID 获取场景互动 */
export function getSceneActionById(id: string): SceneAction | undefined {
  return SCENE_ACTIONS.find((a) => a.id === id);
}
