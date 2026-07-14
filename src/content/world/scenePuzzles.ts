// ============================================================
// 第一章场景问答内容
//
// 内容只定义题目、选项、答案标签与奖励；判定和状态更新在
// src/game/world/puzzleRules.ts 与 src/game/world/puzzleAnswerRules.ts 中处理。
//
// 支持两种输入模式：
// - choice：选项式（东园幽径、伊甸之河）
// - free_text：自由文本（刻名石"万物受名"）
// ============================================================

import type { EdenLocationId, TimeOfDay } from "@/game/world/types";

export type ScenePuzzleInputMode = "choice" | "free_text";

export type ScenePuzzleOption = {
  id: string;
  text: string;
  tags: string[];
  /** per_option 模式下：本选项独立结算的效果 */
  effect?: ScenePuzzleOptionEffect;
  /** 本选项可重复选取的次数（默认 1）。>1 时：授予后若道具未达上限则不锁死谜题，可再来；拿满或改选其它选项才锁死。用于月光道标叠加至 2 次/时段。 */
  maxStacks?: number;
};

/** 每选项独立奖励（per_option 模式） */
export type ScenePuzzleOptionEffect = {
  /** 结果反馈正文 */
  feedback: string;
  /** 结果弹窗标题（如"徒劳的挣扎"） */
  resultTitle?: string;
  /** 获得道具 */
  itemId?: string;
  /** 额外一并授予的道具（用于保留旧有依赖，如水声回响旧道具） */
  additionalItemId?: string;
  /** 额外一并授予的线索（用于保留旧有依赖，如四河回声线索） */
  clueId?: string;
  /** 当前行动点归零 */
  zeroActionPoints?: boolean;
  /** 当前行动点回复至有效上限 */
  restoreActionPointsToMax?: boolean;
  /** 基础行动点上限永久 +N */
  apMaxBonusBase?: number;
  /** 白天行动点上限永久 +N */
  apMaxBonusDay?: number;
  /** 神明注视值（累计）+N */
  divineAttentionDelta?: number;
  /** 献礼门槛永久修正（负值=降低） */
  divineThresholdModifier?: number;
  /** 解锁地图 NPC 所在场景 */
  unlockMapNpcLocations?: boolean;
  /** 解锁双树真实名称 */
  unlockTreeNames?: boolean;
  /** 触发时间回溯（溯源之水）：重置除保留项外的全部状态 */
  triggerTimeRewind?: boolean;
  /** 触发逃离判定：持有火焰剑则进入 escape_eden 隐藏结局，否则维持失败反馈 */
  triggerEscapeCheck?: boolean;
  /** 夏娃对神的敬畏/顺从 ±N（天使残羽：透露神与天使都吃过此树，动摇敬仰） */
  eveObedienceDelta?: number;
  /** 亚当对神的顺从 ±N */
  adamObedienceDelta?: number;
  /** 加百列好感 ±N（东园越界惩罚：东风逆行 / 无影东行各 -5，下限 0） */
  gabrielAffinityDelta?: number;
};

export type ScenePuzzleReward = {
  clueId?: string;
  itemId?: string;
  trustDelta?: number;
  attentionDelta?: number;
};

export type ScenePuzzle = {
  id: string;
  locationId: EdenLocationId;
  timeOfDay?: TimeOfDay;
  trigger: "on_enter" | "explicit_interaction";
  inputMode: ScenePuzzleInputMode;
  /** 自由文本评估器 ID（free_text 时使用） */
  evaluationId?: string;
  title: string;
  prompt: string;
  /** 自由文本占位符 */
  placeholder?: string;
  options?: ScenePuzzleOption[];
  /** 自由文本判定成功标签（仅用于兼容展示，规则真相在 puzzleAnswerRules） */
  successTags?: string[];
  successFeedback: string;
  rewards: ScenePuzzleReward;
  failure: {
    hint: string;
    attentionDelta?: number;
  };
  // ---- 新增（可选）：单行输入 + 两步弹窗，仅刻名石使用 ----
  /** free_text 模式下渲染为单行 <input>（默认多行 textarea） */
  singleLine?: boolean;
  /** free_text 提交按钮文案（默认「刻下回答」） */
  submitText?: string;
  /** 成功后展示第二步弹窗（标题 / 正文模板 / 确认按钮文案） */
  secondStep?: {
    title: string;
    /** 正文模板，支持 {name} 占位符，替换为玩家提交文本 */
    promptTemplate: string;
    confirmText?: string;
  };
  /** 解析模式："success_failure"（默认，二元判定）| "per_option"（每选项独立结算） */
  resolutionMode?: "success_failure" | "per_option";
};

export const SCENE_PUZZLES: ScenePuzzle[] = [
  {
    id: "puzzle_naming_stone_identity",
    locationId: "adam_garden_work",
    trigger: "explicit_interaction",
    inputMode: "free_text",
    evaluationId: "naming_stone_meaning",
    title: "刻名石",
    prompt:
      "蛇望向石面。原本空白的石面上，缓缓浮现出一行字：「来者，留下你的名姓。」\n名字么……我叫什么来着？哦，我是——",
    placeholder: "输入你的名字",
    singleLine: true,
    submitText: "留下名字",
    secondStep: {
      title: "仅是一个念头",
      promptTemplate:
        "石面上浮现出：{name}。仅是一瞬，文字便消失了，石面重新归于空白。",
      confirmText: "离开",
    },
    successTags: ["understanding"],
    successFeedback:
      "石上的字一闪而逝，归于空白。但那一瞬你看见了——名字让一个生命被看见、被理解。你记住了「万物名录」。",
    rewards: {
      clueId: "clue_naming_stones",
      itemId: "resonance_living_names",
      trustDelta: 2,
    },
    failure: {
      hint: "石面没有回应。先说出你想被记住的名字。",
    },
  },
  {
    id: "puzzle_east_path_cautious_presence_day",
    locationId: "east_garden_path",
    timeOfDay: "day",
    trigger: "explicit_interaction",
    inputMode: "choice",
    resolutionMode: "per_option",
    title: "东风所传",
    prompt:
      "加百列立在东侧高石，晨光从他的羽翼下穿过，沿幽径朝园心投去。远处两棵树的影子尚未分明；风里却同时带着众生的声息与一段被反复传递的命令。\n你准备怎么做？",
    options: [
      {
        id: "echo_of_beings",
        text: "伏地辨认园中每一道声音落向何处。",
        tags: ["echo", "presence"],
        effect: {
          itemId: "resonance_echo_of_beings",
          unlockMapNpcLocations: true,
          feedback:
            "你伏下身，远处的声音一一落下位置。即使看不见他们，你也能从回声里分辨出每个人所在的地方。",
        },
      },
      {
        id: "calibrate_east_light",
        text: "顺着晨光校准向园心的方向。",
        tags: ["observation", "clarity"],
        effect: {
          itemId: "resonance_sober_eye",
          apMaxBonusDay: 1,
          feedback:
            "光影与时间之间细微的不协调，开始在你眼里显形。白天的行动点上限永久 +1（全局白天上限奖励最多生效一次）。",
        },
      },
      {
        id: "ask_gabriel_command",
        text: "问加百列：「被传来的命令，是否也要由听见的人亲自明白？」",
        tags: ["feather", "question"],
        effect: {
          itemId: "resonance_angel_feather",
          resultTitle: "传令残羽",
          feedback:
            "加百列迟疑了一瞬，落下一片羽梢。你得到了「传令残羽」——一道只可在下一次天使对话中抛出的试探，不在获得时动摇任何人的敬仰。",
        },
      },
      {
        id: "east_wind_reverse",
        text: "试着令东风逆行，碰触守望线以外的地方。",
        tags: ["reverse", "overstep"],
        effect: {
          zeroActionPoints: true,
          gabrielAffinityDelta: -5,
          divineAttentionDelta: 20,
          resultTitle: "东风逆行",
          feedback:
            "你逆着东风推了一把。守望线外的风骤然回卷——加百列皱起眉，本时段的力气被抽空，一道更高的注视落了下来。这并非逃离的入口。",
        },
      },
    ],
    // per_option 模式不使用以下字段，仅为满足类型占位
    successFeedback: "",
    rewards: {},
    failure: { hint: "" },
  },
  {
    id: "puzzle_east_path_cautious_presence_night",
    locationId: "east_garden_path",
    timeOfDay: "night",
    trigger: "explicit_interaction",
    inputMode: "choice",
    resolutionMode: "per_option",
    title: "羽下月路",
    prompt:
      "月光把由东门通往园心的路照得很窄。加百列的羽影落在石上，中央两棵树在更远处投下不同的暗影；蛇可选择辨认、藏匿、主动被看见，或向东侧的无影处越界。\n你准备怎么做？",
    options: [
      {
        id: "twin_tree_memory",
        text: "等月光把两棵树的影子分开。",
        tags: ["memory", "trees"],
        effect: {
          itemId: "resonance_twin_tree_memory",
          unlockTreeNames: true,
          feedback: "两棵树的轮廓在月光下渐渐分开。你终于能分清左侧的生命树与右侧的分别善恶树。",
        },
      },
      {
        id: "take_silent_grass",
        text: "从守望石旁取一片无声草。",
        tags: ["grass", "conceal"],
        effect: {
          itemId: "resonance_silent_grass",
          resultTitle: "无声草",
          feedback: "你拈起一片草叶。它能在下一次轻度神注视增长时，替你遮去一些声响。",
        },
      },
      {
        id: "active_expose",
        text: "将鳞片置于月光最明处，等待东风把你的存在带走。",
        tags: ["expose", "attention"],
        effect: {
          divineAttentionDelta: 10,
          resultTitle: "主动引目",
          feedback:
            "你把鳞片亮在月光最盛处。东风认得你——一道可预期的注视攀了上来，对应的一段「园中律则」随之显形。",
        },
      },
      {
        id: "shadowless_east",
        text: "沿没有月影的方向滑向东边。",
        tags: ["shadowless", "overstep"],
        effect: {
          zeroActionPoints: true,
          gabrielAffinityDelta: -5,
          divineAttentionDelta: 50,
          triggerEscapeCheck: true,
          resultTitle: "无影之东",
          feedback:
            "你沿着没有月影的方向滑去。守望线在身后合拢——本时段力气抽空，加百列的脸色沉了下去，极高的注视落了下来。若你怀中藏着火焰剑，此刻便是逃离的入口。",
        },
      },
    ],
    // per_option 模式不使用以下字段，仅为满足类型占位
    successFeedback: "",
    rewards: {},
    failure: { hint: "" },
  },
  {
    id: "puzzle_river_words_belonging",
    locationId: "four_river_source",
    trigger: "explicit_interaction",
    inputMode: "choice",
    resolutionMode: "per_option",
    title: "伊甸之河的问题",
    prompt:
      "水声不断重复，却没有一次完全相同。\n你听得越久，周围的景象便越显得遥远，仿佛意识正漂向某个即将醒来的清晨。水流愿意留下一道回响，你准备听取哪一种？",
    options: [
      {
        id: "revive",
        text: "让疲惫随着水流离开。",
        tags: ["revive", "rest"],
        effect: {
          itemId: "resonance_water_echo_revive",
          restoreActionPointsToMax: true,
          clueId: "clue_four_river_echo",
          additionalItemId: "resonance_four_river_echo",
          feedback: "水声洗去了你的疲惫。",
        },
      },
      {
        id: "abundant",
        text: "让河流拓宽我所能抵达的边界。",
        tags: ["abundant", "boundary"],
        effect: {
          itemId: "resonance_water_echo_abundant",
          apMaxBonusBase: 1,
          clueId: "clue_four_river_echo",
          additionalItemId: "resonance_four_river_echo",
          feedback: "河流在你身后拓宽了一道边界。",
        },
      },
      {
        id: "attract",
        text: "让这道声音传到更高的地方。",
        tags: ["attract", "attention"],
        effect: {
          itemId: "resonance_water_echo_attract",
          divineAttentionDelta: 10,
          clueId: "clue_four_river_echo",
          additionalItemId: "resonance_four_river_echo",
          feedback: "那道声音顺着水流攀向更高的地方，引起了一阵注视。",
        },
      },
      {
        id: "conceal",
        text: "让水声暂时盖过那道注视。",
        tags: ["conceal", "threshold"],
        effect: {
          itemId: "resonance_water_echo_conceal",
          divineThresholdModifier: -1,
          clueId: "clue_four_river_echo",
          additionalItemId: "resonance_four_river_echo",
          feedback: "水声暂时盖过了那道注视，门槛随之松弛。",
        },
      },
    ],
    // per_option 模式不使用以下字段，仅为满足类型占位
    successFeedback: "",
    rewards: {},
    failure: { hint: "" },
  },
  {
    id: "puzzle_tree_court_shadow",
    locationId: "tree_court",
    trigger: "explicit_interaction",
    inputMode: "choice",
    resolutionMode: "per_option",
    title: "树影留下的问题",
    prompt:
      "树叶将光切成细碎的形状，风从林间经过，却有几片叶子始终停在原处。\n你忽然觉得，这片树林正在等待你带走某种痕迹。\n你准备触碰哪一道痕迹？",
    options: [
      {
        id: "look_up",
        text: "抬起头，让叶缝间的目光落在身上",
        tags: ["light", "attention"],
        effect: {
          itemId: "resonance_uplight_mark",
          divineAttentionDelta: 10,
          resultTitle: "仰光之痕",
          feedback:
            "你抬起头，细碎的光落在肩头。某种被注视的感觉，比刚才更清晰了一些。",
        },
      },
      {
        id: "prism_leaf",
        text: "拾起那片映着数道光芒的叶子",
        tags: ["prism", "grace"],
        effect: {
          itemId: "resonance_grace_prism",
          resultTitle: "恩泽棱镜",
          feedback:
            "你拾起那片映着数道光芒的叶子。它把神恩折射成更浓的回响——以后每一份祝福带来的亲近，都会翻倍。",
        },
      },
      {
        id: "day_shade",
        text: "沿着白日树荫最深的地方滑行",
        tags: ["shade", "move"],
        effect: {
          itemId: "resonance_day_shade_step",
          resultTitle: "昼荫轻步",
          feedback:
            "你沿着白日树荫最深的地方滑行，脚步轻得不会被听见。白天的第一次移动，从此不必消耗你的气力。",
        },
      },
      {
        id: "night_silence",
        text: "把下一句话藏进尚未落下的夜色",
        tags: ["silence", "night"],
        effect: {
          itemId: "resonance_night_silence",
          resultTitle: "夜露缄声",
          feedback:
            "你把下一句话藏进尚未落下的夜色。夜里第一次与谁交谈，都不会再惊动你的脚步。",
        },
      },
    ],
    // per_option 模式不使用以下字段，仅为满足类型占位
    successFeedback: "",
    rewards: {},
    failure: { hint: "" },
  },
  {
    id: "puzzle_naming_stone_bank_fifth_reflection",
    locationId: "naming_stone_bank",
    trigger: "explicit_interaction",
    inputMode: "choice",
    resolutionMode: "per_option",
    title: "分流之外的问题",
    prompt:
      "四道水流向不同方向奔去。\n你低头时，却在水中的倒影里看见了第五道水流。它没有流向远方，而是逆着时间，流回园子最初醒来的清晨。\n你准备听取哪一道水声？",
    options: [
      {
        id: "morning_flow",
        text: "听取带着晨光的水声",
        tags: ["morning", "flow"],
        effect: {
          itemId: "resonance_morning_flow",
          resultTitle: "晨流回环",
          feedback:
            "带着晨光的水声落进你心里。白天的第一次移动不再消耗气力，还会把一口力气送回你身上。",
        },
      },
      {
        id: "night_tide",
        text: "听取藏在夜色下的水声",
        tags: ["night", "tide"],
        effect: {
          itemId: "resonance_night_tide_echo",
          resultTitle: "夜潮回声",
          feedback:
            "藏在夜色下的水声低低应和。夜里第一次与谁交谈不再消耗气力，并悄悄补回一口气息。",
        },
      },
      {
        id: "trace_source",
        text: "触碰那道流回最初的倒影",
        tags: ["rewind", "time"],
        effect: {
          resultTitle: "溯源之水",
          triggerTimeRewind: true,
          feedback:
            "水中的倒影忽然倒转。说过的话退回唇边，走过的道路重新被露水覆盖。\n当你再次睁眼时，园子正停在第一日的清晨。只有怀中的回响证明，那些事情曾经发生过。",
        },
      },
      {
        id: "bond_insight",
        text: "凝望倒影里每个人愿意被靠近的方式",
        tags: ["bond", "relation"],
        effect: {
          itemId: "resonance_bond_insight",
          resultTitle: "相处之鉴",
          feedback:
            "倒影里浮现出每个人愿意被靠近、又会在何处起戒备的样子。你记住了「相处之鉴」--集齐洞察，便能看清与每个已见角色相处的门道。",
        },
      },
    ],
    // per_option 模式不使用以下字段，仅为满足类型占位
    successFeedback: "",
    rewards: {},
    failure: { hint: "" },
  },
  {
    id: "puzzle_central_twin_trees",
    locationId: "central_meadow",
    trigger: "explicit_interaction",
    inputMode: "choice",
    resolutionMode: "per_option",
    title: "园心双树的问题",
    prompt:
      "园子中央并立着两棵树--左侧是生命树，右侧是分别善恶树。风从两树之间穿过，果子在枝叶间低垂，仿佛在等你带走某一种痕迹。\n你准备从双树之间带走什么？",
    options: [
      {
        id: "pick_life_fruit",
        text: "采摘左侧·生命树的果子",
        tags: ["life", "vitality"],
        effect: {
          itemId: "resonance_life_fruit_taste",
          apMaxBonusBase: 1,
          resultTitle: "生命之味",
          feedback:
            "你摘下左侧的果子咬了一口。甜意落进身体，气力仿佛被拓宽了一道边界--此后你的行动点上限永久 +1。",
        },
      },
      {
        id: "pick_knowledge_fruit",
        text: "采摘右侧·分别善恶树的果子",
        tags: ["knowledge", "discernment"],
        effect: {
          itemId: "resonance_discernment_fruit",
          resultTitle: "分辨之味",
          feedback:
            "你摘下右侧的果子。善恶的轮廓在你眼里变得清晰，你开始能看见每个已见角色底里的性情。",
        },
      },
      {
        id: "take_angel_feather",
        text: "拾起天使掉落的一根翅膀羽毛",
        tags: ["feather", "revelation"],
        effect: {
          itemId: "resonance_angel_feather",
          resultTitle: "传令残羽",
          feedback:
            "你拾起那根羽梢。它不再诉说神与天使的故事——它只是「传令残羽」，一道只可在下一次天使对话中抛出的试探。",
        },
      },
      {
        id: "take_moonlight",
        text: "拾起双树间一缕落下的月光",
        tags: ["moonlight", "shortcut"],
        maxStacks: 2,
        effect: {
          itemId: "moonlight_path_marker",
          resultTitle: "月光道标",
          feedback:
            "你把那缕月光拢在掌心，它凝成一枚道标。此后每当时段初醒，你都能借它走一条看不见的近路--持有 1 枚每时段可无视绕行 1 次，2 枚则 2 次。",
        },
      },
    ],
    // per_option 模式不使用以下字段，仅为满足类型占位
    successFeedback: "",
    rewards: {},
    failure: { hint: "" },
  },
];

export function getScenePuzzleById(id: string): ScenePuzzle | null {
  return SCENE_PUZZLES.find((puzzle) => puzzle.id === id) ?? null;
}

export function getScenePuzzleByEvaluationId(evaluationId: string): ScenePuzzle | null {
  return SCENE_PUZZLES.find((puzzle) => puzzle.evaluationId === evaluationId) ?? null;
}
