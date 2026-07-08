// ============================================================
// 第一章场景互动内容表
//
// 玩家界面显示具体叙事动作（循水声 / 查看刻名石 / 顺着小鹿视线停留 …），
// 不再只显示"观察地点"。内部由规则层统一执行，发放线索、信物与叙事。
// 每个地点至少 1 个可用场景互动。
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
  // ---- 伊甸之河 ----
  {
    id: "follow_river_sound",
    locationId: "four_river_source",
    label: "循水声",
    description: "顺着河水的声音走向源头，让水声盖过你的脚步。",
    apCost: 1,
    availability: {},
    rewards: {
      clueIds: ["clue_river_reflection"],
      itemIds: ["consumable_gentle_voice"],
      narration:
        "你循着水声走到源头。清泉从石缝间涌出，水面映着天光，倒影短暂地缺失了一瞬，像水记得什么，又忘了。河声入耳，比命令更轻，却更深。你也记住了一种更柔的发声方式。",
    },
  },
  {
    id: "gather_still_leaf",
    locationId: "four_river_source",
    label: "拾起静水旁的叶",
    description: "水边有一片沾着露水的叶子，安静得像没被听过的话。",
    apCost: 1,
    availability: {},
    rewards: {
      itemIds: ["resonance_still_leaf"],
      narration:
        "你拾起那片叶。它凉而静，像是被水声洗过。握着它时，你想说的话也会不自觉地变轻。",
    },
  },
  // ---- 万物受名处 ----
  {
    id: "listen_to_naming_stone",
    locationId: "adam_garden_work",
    label: "查看刻名石",
    description: "几块石头上刻着动物的名字。靠近查看，或许能记下一个可借用的名字。",
    apCost: 1,
    availability: {},
    rewards: {
      clueIds: ["clue_naming_stones"],
      itemIds: ["resonance_borrowed_name"],
      narration:
        "你查看刻名石。名字落在石头上，比露水还轻。你记住了其中一个，它不属于你，但可以借给她。",
    },
  },
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
  // ---- 园中树林 ----
  {
    id: "watch_deer_gaze",
    locationId: "tree_court",
    label: "顺着小鹿视线停留",
    description: "小鹿在林间停下，望向某个方向。顺着它的视线停留片刻。",
    apCost: 1,
    availability: {},
    rewards: {
      clueIds: ["clue_golden_leaf"],
      itemIds: ["resonance_deer_glance"],
      narration:
        "你顺着小鹿的视线停留。它望向林子深处，那里落着一片金色的叶子，像是从那棵树上飘下来的。小鹿没有出声，却把那一眼留给了你：那个女人在这里比在别处更放松。",
    },
  },
  // ---- 东园幽径 ----
  {
    id: "part_silent_grass",
    locationId: "east_garden_path",
    label: "拨开落叶",
    description: "灌木下的落叶堆里有什么在动。拨开它，看看是什么。",
    apCost: 1,
    availability: {},
    rewards: {
      itemIds: ["resonance_silent_grass"],
      narration:
        "你拨开落叶。下面是一小撮无声草，踩上去没有声音，连风都绕开它。把它带在身边，或许能消去一次轻微的风变。",
    },
  },
  {
    id: "ask_fox_to_judge",
    locationId: "east_garden_path",
    label: "让狐狸听一句低语",
    description: "狐狸藏在树影里。让它听你说的一句低语，看它如何评断。",
    apCost: 1,
    availability: {},
    rewards: {
      itemIds: ["resonance_fox_tail_note"],
      narration:
        "狐狸在树影里停下，望向你。它听完，尾巴在草丛里轻轻扫了一下。「你刚才那句话，是提问，还是推她？她会感觉到的。」它没有给答案，只留下一道弯弯的尾痕。",
    },
  },
  // ---- 四河分流 ----
  {
    id: "follow_white_feather",
    locationId: "naming_stone_bank",
    label: "追随白羽落点",
    description: "一根白羽从空中飘落，顺着水流的方向。追随它的落点。",
    apCost: 1,
    availability: { timeOfDay: "night" },
    rewards: {
      itemIds: ["resonance_white_feather_echo"],
      narration:
        "你追随白羽的落点。它落在分流的河面上，没有沉，反而泛起一圈银光。鸽子在低枝上看着你。这枚回声可以让她在夜里听见一句温和的话。",
    },
  },
  {
    id: "hear_four_river_echo",
    locationId: "naming_stone_bank",
    label: "聆听分流的水声",
    description: "四道水流在这里分开。停下来听水声，也许能听见一句被水带回来的低语。",
    apCost: 1,
    availability: {},
    rewards: {
      clueIds: ["clue_four_river_echo"],
      itemIds: ["resonance_four_river_echo"],
      narration:
        "你聆听分流的水声。每道水流都像是一个选择，一旦流出就不回头。回声里有一句你说过的话，但变了调——你开始明白，话一旦说出口，就不再完全属于你。",
    },
  },
  // ---- 园子中央 ----
  {
    id: "stand_between_trees",
    locationId: "central_meadow",
    label: "停在两树之间",
    description: "生命树与分别善恶树相距不远。停在两树之间，感受这片草地的静。",
    apCost: 1,
    availability: {},
    rewards: {
      clueIds: ["clue_two_trees"],
      itemIds: ["consumable_trust_dew", "consumable_first_whisper_free"],
      narration:
        "你停在两树之间。一棵像丰盛的应许，一棵因命令而显得更安静。果子在枝叶间低垂。这里的静，比别处的静更重。草尖留下信任之露，晨光也在叶面压下一枚首语印记。",
    },
  },
  {
    id: "touch_moonlight",
    locationId: "central_meadow",
    label: "触摸月光",
    description: "夜晚的月亮洒落银光，触摸它可能获得神秘的道标。",
    apCost: 0,
    availability: { timeOfDay: "night" },
    rewards: {
      itemIds: ["moonlight_path_marker"],
      narration:
        "你伸手触摸月光，银辉在你指尖凝聚成一枚神秘道标。有了它，你在园中行走可以选择捷径，无需绕行。",
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
