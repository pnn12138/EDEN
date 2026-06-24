// ============================================================
// 第一章道具 / 园中回响
//
// 道具不是装备，也不是数值药水。它们是"园中回响"：
// 玩家借由环境、NPC 和记忆获得的一次性上下文优势。
// 道具不能直接触发禁忌动作，不能绕过心智门槛，不能让玩家控制女人。
// 必须经过规则层发放和消耗。
// ============================================================

import type { EdenItem } from "@/game/world/types";

export type WorldItemKind = "passive" | "active";

export type WorldItem = EdenItem & {
  kind: WorldItemKind;
  /** 玩家可见短说明（不显示公式） */
  shortEffect: string;
};

export const EDEN_ITEMS: WorldItem[] = [
  {
    id: "item_still_leaf",
    title: "静息之叶",
    description: "一片沾着河水露水的叶。握着它，话会不自觉地变轻。",
    obtainLocation: "four_river_source",
    kind: "passive",
    shortEffect: "帮助下一次对女人的温和低语，让她更愿倾听。",
  },
  {
    id: "item_borrowed_name",
    title: "借来的名字",
    description: "从命名石痕上记下的一个名字。它不属于你，但可以借给她。",
    obtainLocation: "adam_garden_work",
    kind: "passive",
    shortEffect: "提高熟悉感，但轻微强化她对园中秩序的联想。",
  },
  {
    id: "item_silent_grass",
    title: "无声草",
    description: "踩上去没有声音的草，连风都绕开它。",
    obtainLocation: "east_garden_path",
    kind: "passive",
    shortEffect: "抵消一次轻度神的注视上升。",
  },
  {
    id: "item_white_feather_echo",
    title: "白羽回声",
    description: "一根白羽在河面泛起的银光。它能让鸽子在夜里带走一句温和的话。",
    obtainLocation: "naming_stone_bank",
    kind: "active",
    shortEffect: "夜晚让鸽子传递一次温和低语；危险话语会误传并提高神的注视。",
  },
  {
    id: "item_four_river_echo",
    title: "四河回声",
    description: "分流的水声里藏着一句你说过的话，但变了调。",
    obtainLocation: "naming_stone_bank",
    kind: "active",
    shortEffect: "结局复盘显示更完整的关键因果；行动前可查看一次风险提示。",
  },
  {
    id: "item_river_dew",
    title: "河源露",
    description: "夜晚伊甸之河源头的水露，天使出现后才可得。",
    obtainLocation: "four_river_source",
    kind: "active",
    shortEffect: "下一个时段多一分行动余地；获得时神的注视会微升。",
  },
];

/** 根据 ID 获取道具 */
export function getItemById(id: string): WorldItem | undefined {
  return EDEN_ITEMS.find((i) => i.id === id);
}
