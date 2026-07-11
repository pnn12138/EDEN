// ============================================================
// 第一章道具 / 园中回响
//
// 道具不是装备，也不是数值药水。它们是"园中回响"：
// 玩家借由环境、NPC 和记忆获得的一次性上下文优势。
// 道具不能直接触发禁忌动作，不能绕过心智门槛，不能让玩家控制女人。
// 必须经过规则层发放和消耗。
//
// 世界圣经 v3.0：回响共 19 个（14 个可收集回响 + 5 个被动回响），
// 依据 RESONANCE_FULL_DESIGN.md v1.0。废弃旧道具见该文档第五节。
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
  // ---- 天使回响（consumable / instant 类型） ----
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
    title: "河源露",
    description: "米迦勒从水面捞起的一滴露珠，握着它，一次行动会变得轻盈。",
    obtainLocation: "four_river_source",
    kind: "instant",
    repeatable: true,
    sourceType: "angel",
    sourceName: "米迦勒",
    shortEffect: "即时使用，恢复 1 点行动点。",
    icon: "💧",
  },
  {
    id: "resonance_boundary_mark",
    title: "边界之痕",
    description: "米迦勒守卫的边界痕迹，触碰时会感到轻微的震颤。",
    obtainLocation: "naming_stone_bank",
    kind: "consumable",
    bindTargets: ["move"],
    repeatable: false,
    sourceType: "angel",
    sourceName: "米迦勒",
    shortEffect: "使用后消耗，下一次移动不需要消耗行动点，并让对方更愿意思考边界。",
    icon: "🪨",
  },
  {
    id: "resonance_east_wind",
    title: "东之风",
    description: "加百列拂过东园的风，带着消息与方向的余温。",
    obtainLocation: "east_garden_path",
    kind: "consumable",
    bindTargets: ["any_npc"],
    repeatable: false,
    sourceType: "angel",
    sourceName: "加百列",
    shortEffect: "使用后消耗，下一次低语使神的注视上升幅度减半。",
    icon: "🌬️",
  },
  {
    id: "resonance_lucifer_star",
    title: "晨星碎片",
    description: "路西法留在水面的光屑，握着它，下一次低语会带着分辨的温度。",
    obtainLocation: "naming_stone_bank",
    kind: "consumable",
    bindTargets: ["any_npc"],
    repeatable: false,
    sourceType: "angel",
    sourceName: "路西法",
    shortEffect: "使用后消耗，下一次对女人低语时引导自我判断的效果翻倍。",
    icon: "🌟",
  },

  // ---- 通用消耗品（场景 / 角色） ----
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
    shortEffect: "使用后消耗，下一次对话时对方初始好感额外提升。",
    icon: "📝",
  },
  {
    id: "resonance_hedgehog_bristle",
    title: "刺猬之针",
    description: "刺猬从草丛里拱出一根柔软的细刺。它不锋利，只提醒你把脚步放轻。",
    obtainLocation: "adam_garden_work",
    kind: "consumable",
    bindTargets: ["move"],
    repeatable: false,
    sourceType: "character",
    sourceName: "刺猬",
    shortEffect: "使用后消耗，下一次移动不需要消耗行动点。",
    icon: "🦔",
  },
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
    shortEffect: "使用后消耗，下一次对女人低语时她的警惕降低，更愿倾听。",
    icon: "🍃",
  },
  {
    id: "resonance_silent_grass",
    title: "无声草",
    description: "踩上去没有声音的草，连风都绕开它。含在嘴里，下一次低语会轻得不会被听见。",
    obtainLocation: "east_garden_path",
    kind: "consumable",
    bindTargets: ["any_npc"],
    repeatable: false,
    sourceType: "scene",
    sourceName: "东园幽径",
    shortEffect: "使用后消耗，抵消下一次低语带来的轻度神注视上升。",
    icon: "🌿",
  },

  // ---- 即时型场景回响 ----
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

  // ---- 被动型回响（获得后永久生效，无需主动使用） ----
  {
    id: "resonance_living_names",
    title: "万物名录",
    description: "石痕没有替你列出答案，只让你开始看见每个生命不同的性情。",
    obtainLocation: "adam_garden_work",
    kind: "passive",
    repeatable: false,
    sourceType: "scene",
    sourceName: "刻名石",
    shortEffect: "在属性页解锁已见角色的精确数值、性格和相处提示。",
    icon: "◫",
  },
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
    shortEffect: "永久被动：每个时段第一次轻度惊动神的低语会被压低 1 点注视。",
    icon: "🤫",
  },
  {
    id: "resonance_her_voice",
    title: "她自己的声音",
    description: "夏娃第一次主动向你说起她真正的疑问。那声音不属于命令，只属于她自己。",
    obtainLocation: "tree_court",
    kind: "passive",
    repeatable: false,
    sourceType: "character",
    sourceName: "夏娃",
    shortEffect: "永久被动：夏娃更愿主动说出自己的疑问，也更容易走向自我判断。",
    icon: "🗣️",
  },
  {
    id: "resonance_quiet_stone",
    title: "静契之石",
    description: "亚当刻着两人名字的石子。它不命令，只提醒你们之间有过安静的约定。",
    obtainLocation: "adam_garden_work",
    kind: "consumable",
    bindTargets: ["any_npc"],
    repeatable: false,
    sourceType: "character",
    sourceName: "亚当",
    shortEffect: "使用后消耗，下一次对任意NPC的低语更温和、更被信任。",
    icon: "🪨",
  },

  // ---- 新道具：月光道标（被动） ----
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

  // ---- 神明献礼（T6：7 献礼，三选一获得后作为被动回响永久生效） ----
  {
    id: "gift_all_seduction_up",
    title: "低语之诱",
    description: "神使你的话语更柔软动人，低语更易打动听者。",
    obtainLocation: "central_meadow",
    kind: "passive",
    repeatable: false,
    sourceType: "divine",
    sourceName: "神",
    shortEffect: "低语效果系数 ×1.35。",
    icon: "🗨️",
  },
  {
    id: "gift_attention_accel",
    title: "注视加速",
    description: "神更留意园中的动静，你的每一次试探都更被看见。",
    obtainLocation: "central_meadow",
    kind: "passive",
    repeatable: false,
    sourceType: "divine",
    sourceName: "神",
    shortEffect: "神的注视增量 ×1.5。",
    icon: "👁️",
  },
  {
    id: "gift_resonance_double",
    title: "回响倍涌",
    description: "你拾得的回响更浓，效果翻倍。",
    obtainLocation: "central_meadow",
    kind: "passive",
    repeatable: false,
    sourceType: "divine",
    sourceName: "神",
    shortEffect: "回响效果 ×2。",
    icon: "🌊",
  },
  {
    id: "gift_threshold_cut",
    title: "界限松弛",
    description: "神在夏娃心中松动了一道界限，她更易走向自己的判断。",
    obtainLocation: "central_meadow",
    kind: "passive",
    repeatable: false,
    sourceType: "divine",
    sourceName: "神",
    shortEffect: "夏娃提示词注入：更愿自我判断。",
    icon: "✂️",
  },
  {
    id: "gift_free_move",
    title: "无羁之步",
    description: "神准你自由穿行园中，移动不再消耗行动。",
    obtainLocation: "central_meadow",
    kind: "passive",
    repeatable: false,
    sourceType: "divine",
    sourceName: "神",
    shortEffect: "移动不消耗行动点。",
    icon: "👣",
  },
  {
    id: "gift_whisper_anywhere",
    title: "随处低语",
    description: "你的声音能越过距离，同场景的校验被放宽。",
    obtainLocation: "central_meadow",
    kind: "passive",
    repeatable: false,
    sourceType: "divine",
    sourceName: "神",
    shortEffect: "低语同场景校验放行。",
    icon: "🌀",
  },
  {
    id: "gift_awaken_desire",
    title: "渴望苏醒",
    description: "神在夏娃心里点起一丝对知识的渴望。",
    obtainLocation: "central_meadow",
    kind: "passive",
    repeatable: false,
    sourceType: "divine",
    sourceName: "神",
    shortEffect: "夏娃提示词注入：更想了解善恶。",
    icon: "🔥",
  },
];

/** 根据 ID 获取道具 */
export function getItemById(id: string): WorldItem | undefined {
  return EDEN_ITEMS.find((i) => i.id === id);
}
