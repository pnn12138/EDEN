// ============================================================
// 第一章道具 / 园中回响
//
// 道具不是装备，也不是数值药水。它们是"园中回响"：
// 玩家借由环境、NPC 和记忆获得的一次性上下文优势。
// 道具不能直接触发禁忌动作，不能绕过心智门槛，不能让玩家控制女人。
// 必须经过规则层发放和消耗。
// ============================================================

import type { EdenItem } from "@/game/world/types";

// ---- 回响类型 ----
// instant：点击后立即结算。
// consumable：点击后激活，只在下一次匹配行动中生效。
// passive：获得后自动提供固定收益，不显示主动使用入口。
export type WorldItemKind = "instant" | "passive" | "consumable";

// ---- 回响可绑定的行动类型 ----
export type ResonanceBindTarget =
  | "whisper"
  | "move"
  | "scene_action"
  | "dove_message"
  | "any_npc";     // consumable: 对任意 NPC 的下一次低语/传话生效

// ---- 回响来源类型 ----
export type ResonanceSourceType = "angel" | "character" | "scene" | "divine";

// ---- 扩展的道具类型 ----
export type WorldItem = EdenItem & {
  kind: WorldItemKind;
  /** 可生效的行动类型（consumable 类型需要） */
  bindTargets?: ResonanceBindTarget[];
  /** 是否可重复获得 */
  repeatable?: boolean;
  /** 来源类型 */
  sourceType: ResonanceSourceType;
  /** 来源名称（天使名/角色名/地点名） */
  sourceName: string;
  /** 关联的印记 ID */
  achievementId?: string;
  /** 玩家可见短说明（不显示公式） */
  shortEffect: string;
  /** 道具图标（Emoji） */
  icon?: string;
};

export const EDEN_ITEMS: WorldItem[] = [
  // ---- 天使回响（consumable 或 instant 类型） ----
  {
    id: "resonance_herald_feather",
    title: "传令白羽",
    description: "加百列留下的白羽，握着它，下一次低语会变得温和而坚定。",
    obtainLocation: "four_river_source",
    kind: "consumable",
    bindTargets: ["any_npc"],
    repeatable: false,
    sourceType: "angel",
    sourceName: "加百列",
    shortEffect: "使用后消耗，下一次对任意NPC的低语提高对方信任。",
    icon: "🪶",
  },
  {
    id: "resonance_river_dew",
    title: "河水清露",
    description: "拉斐尔留下的露滴，握着它，一次行动会变得轻盈。",
    obtainLocation: "four_river_source",
    kind: "instant",
    repeatable: true,
    sourceType: "angel",
    sourceName: "拉斐尔",
    shortEffect: "即时使用，恢复 1 点行动点。",
    icon: "💧",
  },
  {
    id: "resonance_morning_flame",
    title: "晨焰碎片",
    description: "乌列尔留下的光屑，握着它，下一次低语会带着分辨的温度。",
    obtainLocation: "four_river_source",
    kind: "consumable",
    bindTargets: ["any_npc"],
    repeatable: false,
    sourceType: "angel",
    sourceName: "乌列尔",
    shortEffect: "使用后消耗，下一次低语让听者更愿意思考问题。",
    icon: "🔥",
  },
  {
    id: "resonance_boundary_mark",
    title: "边界之痕",
    description: "米迦勒守卫的边界痕迹，触碰时会感到轻微的震颤。",
    obtainLocation: "naming_stone_bank",
    kind: "consumable",
    bindTargets: ["any_npc"],
    repeatable: false,
    sourceType: "angel",
    sourceName: "米迦勒",
    shortEffect: "使用后消耗，下一次低语让对方更愿意思考边界与选择。",
    icon: "🪨",
  },
  {
    id: "resonance_east_gate_glow",
    title: "东门辉光",
    description: "基路伯守卫的东门辉光，能让一次移动变得异常轻盈。",
    obtainLocation: "east_garden_path",
    kind: "consumable",
    bindTargets: ["move"],
    repeatable: false,
    sourceType: "angel",
    sourceName: "基路伯",
    shortEffect: "使用后消耗，免除下一次移动的行动点消耗。",
    icon: "🚪",
  },

  // ---- 通用消耗品（新增） ----
  {
    id: "consumable_first_whisper_free",
    title: "首语印记",
    description: "园中第一缕晨光在草叶上留下的印记。它让新时段的第一句话不消耗气力。",
    obtainLocation: "central_meadow",
    kind: "consumable",
    bindTargets: ["any_npc"],
    repeatable: true,
    sourceType: "scene",
    sourceName: "园中风韵",
    shortEffect: "使用后消耗，本时段下一次低语不消耗行动点。",
    icon: "🌅",
  },
  {
    id: "consumable_trust_dew",
    title: "信任之露",
    description: "一滴透亮的露水，带着园中草木的温和气息。下一次低语时，它会悄然融化。",
    obtainLocation: "central_meadow",
    kind: "consumable",
    bindTargets: ["any_npc"],
    repeatable: true,
    sourceType: "scene",
    sourceName: "园中风韵",
    shortEffect: "使用后消耗，下一次对任意NPC的低语大幅提高对方对你的信任。",
    icon: "💧",
  },
  {
    id: "consumable_gentle_voice",
    title: "柔声印记",
    description: "一阵极轻的风在草叶间留下的印记。它记得温和低语的方式。",
    obtainLocation: "four_river_source",
    kind: "consumable",
    bindTargets: ["any_npc"],
    repeatable: true,
    sourceType: "scene",
    sourceName: "伊甸之河",
    shortEffect: "使用后消耗，下一次低语降低引起神的注视的可能。",
    icon: "🌬️",
  },

  // ---- 角色回响（consumable：使用即消耗，效果在下一次对应行动中生效） ----
  {
    id: "resonance_borrowed_name",
    title: "借来的名字",
    description: "从命名石痕上记下的一个名字。它不属于你，但可以在下一次低语时借给任何人。",
    obtainLocation: "adam_garden_work",
    kind: "consumable",
    bindTargets: ["any_npc"],
    repeatable: false,
    sourceType: "character",
    sourceName: "亚当",
    shortEffect: "使用后消耗，下一次对任意NPC的低语将提高对方对你的信任。",
    icon: "📝",
  },
  {
    id: "resonance_hedgehog_bristle",
    title: "刺草信任",
    description: "刺猬从草丛里拱出一小段柔软的刺草。它不锋利，只提醒你把声音放轻。",
    obtainLocation: "adam_garden_work",
    kind: "consumable",
    bindTargets: ["any_npc"],
    repeatable: false,
    sourceType: "character",
    sourceName: "刺猬",
    shortEffect: "使用后消耗，下一次低语更温和，降低引起对方警觉的可能。",
    icon: "🦔",
  },
  {
    id: "resonance_deer_glance",
    title: "鹿目余光",
    description: "小鹿停在树影边，回头看了你一眼。那一眼里没有命令，只有安静的观察。",
    obtainLocation: "tree_court",
    kind: "consumable",
    bindTargets: ["any_npc"],
    repeatable: false,
    sourceType: "character",
    sourceName: "小鹿",
    shortEffect: "使用后消耗，让下一次低语更像提问而非命令，降低冒犯可能。",
    icon: "🦌",
  },
  {
    id: "resonance_fox_tail_note",
    title: "狐尾评语",
    description: "狐狸用尾尖在尘土里扫出一道弯痕，像是在提醒你避开太直白的催促。",
    obtainLocation: "east_garden_path",
    kind: "consumable",
    bindTargets: ["any_npc"],
    repeatable: false,
    sourceType: "character",
    sourceName: "狐狸",
    shortEffect: "使用后消耗，下一次低语更迂回，让对方更难察觉你的意图。",
    icon: "🦊",
  },

  // ---- 场景回响（consumable 或 instant 类型） ----
  {
    id: "resonance_still_leaf",
    title: "静息之叶",
    description: "一片沾着河水露水的叶。握着它，下一次低语会不自觉地变轻。",
    obtainLocation: "four_river_source",
    kind: "consumable",
    bindTargets: ["any_npc"],
    repeatable: false,
    sourceType: "scene",
    sourceName: "伊甸之河",
    shortEffect: "使用后消耗，下一次低语让对方更愿倾听。",
    icon: "🍃",
  },
  {
    id: "resonance_silent_grass",
    title: "无声草",
    description: "踩上去没有声音的草，连风都绕开它。",
    obtainLocation: "east_garden_path",
    kind: "consumable",
    bindTargets: ["scene_action"],
    repeatable: false,
    sourceType: "scene",
    sourceName: "东园幽径",
    shortEffect: "使用后消耗，免除下一次场景互动的行动点消耗。",
    icon: "🌿",
  },
  {
    id: "resonance_white_feather_echo",
    title: "白羽回声",
    description: "一根白羽在河面泛起的银光。它能让鸽子在夜里带走一句温和的话。",
    obtainLocation: "naming_stone_bank",
    kind: "consumable",
    bindTargets: ["dove_message"],
    repeatable: true,
    sourceType: "scene",
    sourceName: "四河分流",
    shortEffect: "使用后消耗，下一次鸽子传话会更温和，并提高女人愿意倾听的程度。",
    icon: "🕊️",
  },
  {
    id: "resonance_four_river_echo",
    title: "四河回声",
    description: "分流的水声里藏着一句你说过的话，但变了调。",
    obtainLocation: "naming_stone_bank",
    kind: "instant",
    repeatable: true,
    sourceType: "scene",
    sourceName: "四河分流",
    shortEffect: "即时使用，结局复盘显示更完整的关键因果。",
    icon: "🌊",
  },

  // ---- 神明献礼（instant 类型） ----
  {
    id: "gift_sabbath_dew",
    title: "息日露滴",
    description: "神留下的露滴，能恢复一点行动的余地。",
    obtainLocation: "four_river_source",
    kind: "instant",
    repeatable: true,
    sourceType: "divine",
    sourceName: "神",
    shortEffect: "即时使用，恢复 1 点行动点。",
  },
  {
    id: "gift_revealing_light",
    title: "照见之光",
    description: "神留下的光，能短暂显明一条尚未走完的路。",
    obtainLocation: "four_river_source",
    kind: "instant",
    repeatable: true,
    sourceType: "divine",
    sourceName: "神",
    shortEffect: "即时使用，获得一条关于回响获得的提示。",
    icon: "💡",
  },
  {
    id: "gift_wide_path_seal",
    title: "宽行之印",
    description: "神留下的印，能让一条路暂时被宽恕。",
    obtainLocation: "east_garden_path",
    kind: "consumable",
    bindTargets: ["move", "scene_action"],
    repeatable: true,
    sourceType: "divine",
    sourceName: "神",
    shortEffect: "使用后消耗，免除下一次移动或场景互动的行动点消耗。",
    icon: "✨",
  },

  // ---- 被动道具（固定收益，永久生效） ----
  {
    id: "passive_light_step",
    title: "轻步印记",
    description: "在一个回合内消耗3点以上行动点后获得的祝福，让后续移动更轻盈。",
    obtainLocation: "central_meadow",
    kind: "passive",
    repeatable: false,
    sourceType: "scene",
    sourceName: "园中风韵",
    shortEffect: "永久被动：每个时段第一次移动不消耗行动点。",
    icon: "👣",
  },
  {
    id: "passive_soft_whisper",
    title: "细语印记",
    description: "使用3次消耗类道具后获得的祝福，让低语更不容易惊动神。",
    obtainLocation: "central_meadow",
    kind: "passive",
    repeatable: false,
    sourceType: "character",
    sourceName: "回响回忆",
    shortEffect: "永久被动：每个时段第一次轻微惊动神的低语会被压低 1 点注视。",
    icon: "🤫",
  },

  // ---- 新道具：月光道标 ----
  {
    id: "moonlight_path_marker",
    title: "月光道标",
    description: "夜晚在园子中央点击月亮获得的神秘道标，能让蛇走捷径。",
    obtainLocation: "central_meadow",
    kind: "passive",
    repeatable: true,
    sourceType: "scene",
    sourceName: "月亮",
    shortEffect: "自动生效：下一次前往非相邻地点时消耗一枚，直接走月光捷径。",
    icon: "🌙",
  },
];

/** 根据 ID 获取道具 */
export function getItemById(id: string): WorldItem | undefined {
  return EDEN_ITEMS.find((i) => i.id === id);
}
