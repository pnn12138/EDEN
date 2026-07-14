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
    description: "米迦勒守卫的边界痕迹，拂过时会感到轻微的震颤——它会在下一次回响结算时，预示未来三次注视的走向。",
    obtainLocation: "naming_stone_bank",
    kind: "consumable",
    bindTargets: ["move"],
    repeatable: false,
    sourceType: "angel",
    sourceName: "米迦勒",
    shortEffect: "激活后由下一次回响结算揭示未来三次注视变化（仅确定性来源）。",
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
    shortEffect: "洞察道具之一：拥有任意 1 件洞察即可在属性页看清已见 NPC 的精确数值（2 件加性格，3 件看全）。",
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
    shortEffect: "永久被动：每个时段第一次轻度惊动神的低语会被压低 5 点注视。",
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

  // ---- 东园幽径·众生回声（per_option，三个永久加成） ----
  {
    id: "resonance_echo_of_beings",
    title: "众生回声",
    description: "即使看不见他们，你仍能从园中的回声里分辨出每个人的位置。",
    obtainLocation: "east_garden_path",
    kind: "passive",
    repeatable: false,
    sourceType: "scene",
    sourceName: "东园幽径",
    shortEffect: "地图上显示每个 NPC 当前所在的场景。",
    icon: "👂",
  },
  {
    id: "resonance_sober_eye",
    title: "清醒之眼",
    description: "你开始注意到光影与时间之间细微的不协调。",
    obtainLocation: "east_garden_path",
    kind: "passive",
    repeatable: false,
    sourceType: "scene",
    sourceName: "东园幽径",
    shortEffect: "白天行动点上限 +1（本局永久）。",
    icon: "👁️",
  },
  {
    id: "resonance_twin_tree_memory",
    title: "双树残识",
    description: "两棵树的轮廓逐渐在你的记忆中变得清晰。",
    obtainLocation: "east_garden_path",
    kind: "passive",
    repeatable: false,
    sourceType: "scene",
    sourceName: "东园幽径",
    shortEffect: "可分辨园子中央左侧（生命树）与右侧（分别善恶树）的真实名称。",
    icon: "🌳",
  },

  // ---- 伊甸之河·水声回响（per_option，四变体） ----
  {
    id: "resonance_water_echo_revive",
    title: "水声回响·复苏",
    description: "水声洗去了你的疲惫。",
    obtainLocation: "four_river_source",
    kind: "instant",
    repeatable: true,
    sourceType: "scene",
    sourceName: "伊甸之河",
    shortEffect: "当前行动点立即回复至上限。",
    icon: "💧",
  },
  {
    id: "resonance_water_echo_abundant",
    title: "水声回响·丰沛",
    description: "河流拓宽了你所能抵达的边界。",
    obtainLocation: "four_river_source",
    kind: "passive",
    repeatable: false,
    sourceType: "scene",
    sourceName: "伊甸之河",
    shortEffect: "白天与夜晚行动点上限各 +1（本局永久）。",
    icon: "🌊",
  },
  {
    id: "resonance_water_echo_attract",
    title: "水声回响·引目",
    description: "伊甸四河的水声在你掌心回荡。可主动引动，让一道清流回涌，恢复 1 点行动点。",
    obtainLocation: "four_river_source",
    kind: "instant",
    repeatable: true,
    sourceType: "scene",
    sourceName: "伊甸之河",
    shortEffect: "主动使用：恢复 1 点行动点（本局可重复使用）。",
    icon: "✨",
  },
  {
    id: "resonance_water_echo_conceal",
    title: "水声回响·藏目",
    description: "水声暂时盖过了那道注视。",
    obtainLocation: "four_river_source",
    kind: "passive",
    repeatable: false,
    sourceType: "scene",
    sourceName: "伊甸之河",
    shortEffect: "所有神明献礼门槛永久 -1（不低于 1）。",
    icon: "🌫️",
  },

  // ---- 新道具：月光道标（被动，每时段绕行次数池） ----
  {
    id: "moonlight_path_marker",
    title: "月光道标",
    description: "双树间落下的一缕月光凝成的道标，能让蛇走看不见的近路。可重复拾取，最多 2 枚。",
    obtainLocation: "central_meadow",
    kind: "passive",
    repeatable: true,
    sourceType: "scene",
    sourceName: "园心双树",
    shortEffect: "每时段无视绕行次数：持有 1 枚=1 次，2 枚=2 次（仅解除非相邻限制，不免行动点）。",
    icon: "🌙",
  },

  // ---- 园心双树谜题奖励 ----
  {
    id: "resonance_life_fruit_taste",
    title: "生命之味",
    description: "左侧生命树的果子留下的甜意。气力被拓宽了一道边界。",
    obtainLocation: "central_meadow",
    kind: "passive",
    repeatable: false,
    sourceType: "scene",
    sourceName: "生命树",
    shortEffect: "行动点上限永久 +1（本局）。",
    icon: "🌱",
  },
  {
    id: "resonance_discernment_fruit",
    title: "分辨之果",
    description: "右侧分别善恶树的果子。善恶的轮廓在你眼里变得清晰，能看见每个已见角色的性情。",
    obtainLocation: "central_meadow",
    kind: "passive",
    repeatable: false,
    sourceType: "scene",
    sourceName: "分别善恶树",
    shortEffect: "洞察道具之一：集齐 2 件洞察即可在属性页看清已见 NPC 的性格。",
    icon: "🍎",
  },
  {
    id: "resonance_angel_feather",
    title: "传令残羽",
    description: "加百列羽翼下飘落的一截羽梢。「这道命令由谁亲耳听见？」——只可在下一次天使对话中抛出，对目标天使降低其顺服、抬升本阶注视；对女人或亚当无任何直接效果。",
    obtainLocation: "east_garden_path",
    kind: "consumable",
    repeatable: false,
    sourceType: "angel",
    sourceName: "天使",
    shortEffect: "下一次天使对话：路西法顺服-8/注视+10；加百列-5/+20；米迦勒-2/+20，均受下限；对象不合法不消耗。",
    icon: "🪶",
  },
  {
    id: "resonance_bond_insight",
    title: "相处之鉴",
    description: "四河分流的倒影里浮现的相处之道。它记得每个角色愿意被靠近、又会在何处起戒备。",
    obtainLocation: "naming_stone_bank",
    kind: "passive",
    repeatable: false,
    sourceType: "scene",
    sourceName: "四河分流",
    shortEffect: "洞察道具之一：集齐 3 件洞察即可在属性页看清已见 NPC 的相处提醒。",
    icon: "🪞",
  },

  // ---- 第四轮新增回响（园中树林 / 四河分流 / 加百列） ----
  {
    id: "resonance_uplight_mark",
    title: "仰光之痕",
    description: "叶缝间的目光落在你身上，园中似乎更留意你的存在。可主动迎上那道目光，让它更清晰一分。",
    obtainLocation: "tree_court",
    kind: "instant",
    repeatable: true,
    sourceType: "scene",
    sourceName: "园中树林",
    shortEffect: "神明注视度 +10（即时使用）。",
    icon: "🌟",
  },
  {
    id: "resonance_grace_prism",
    title: "恩泽棱镜",
    description: "一片映着数道光芒的叶子，它把神恩折射成更浓的回响。",
    obtainLocation: "tree_court",
    kind: "passive",
    repeatable: false,
    sourceType: "scene",
    sourceName: "园中树林",
    shortEffect: "神赐祝福带来的正向好感度加成翻倍。",
    icon: "💠",
  },
  {
    id: "resonance_day_shade_step",
    title: "昼荫轻步",
    description: "白日树荫最深处的痕迹，踩上去脚步轻得不会被听见。",
    obtainLocation: "tree_court",
    kind: "passive",
    repeatable: false,
    sourceType: "scene",
    sourceName: "园中树林",
    shortEffect: "每个白天时段第一次移动不消耗行动点。",
    icon: "🌿",
  },
  {
    id: "resonance_night_silence",
    title: "夜露缄声",
    description: "尚未落下的夜色里藏着一句话，说出时惊不动任何人。",
    obtainLocation: "tree_court",
    kind: "passive",
    repeatable: false,
    sourceType: "scene",
    sourceName: "园中树林",
    shortEffect: "每个夜晚时段第一次与 NPC 对话不消耗行动点。",
    icon: "🌙",
  },
  {
    id: "resonance_morning_flow",
    title: "晨流回环",
    description: "带着晨光的水声，第一次移动时也随之把气力送回你身上。",
    obtainLocation: "naming_stone_bank",
    kind: "passive",
    repeatable: false,
    sourceType: "scene",
    sourceName: "四河分流",
    shortEffect: "每个白天时段第一次移动不消耗行动点，并恢复1点行动点。",
    icon: "🌅",
  },
  {
    id: "resonance_night_tide_echo",
    title: "夜潮回声",
    description: "藏在夜色下的水声，第一次低语时把一口气息还给你。",
    obtainLocation: "naming_stone_bank",
    kind: "passive",
    repeatable: false,
    sourceType: "scene",
    sourceName: "四河分流",
    shortEffect: "每个夜晚时段第一次与NPC对话不消耗行动点，并恢复1点行动点。",
    icon: "🌊",
  },
  {
    id: "resonance_flaming_sword",
    title: "旋转的火焰剑",
    description: "一道没有持剑者的火焰在空中缓慢旋转。剑锋所过之处，光与影都会短暂分开。加百列没有说明它守护着什么，只说它能够斩开不属于真实世界的帷幕。",
    obtainLocation: "east_garden_path",
    kind: "passive",
    repeatable: false,
    sourceType: "angel",
    sourceName: "加百列",
    shortEffect: "能够破除幻境。",
    icon: "🔥",
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
    description: "神准你每个时段第一次自由穿行，但其余移动仍要消耗行动。",
    obtainLocation: "central_meadow",
    kind: "passive",
    repeatable: false,
    sourceType: "divine",
    sourceName: "神",
    shortEffect: "每个时段第一次移动不消耗行动点。",
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
