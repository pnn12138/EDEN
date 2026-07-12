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
    title: "幽径尽头的问题",
    prompt:
      "白天的小道在这里戛然而止。前方没有墙，也没有树木阻挡，但无论怎样凝望，都看不见更远的地方。\n四周安静得有些不自然，仿佛只要做出某个选择，眼前的一切就会发生变化。你准备怎么做？",
    options: [
      {
        id: "echo_of_beings",
        text: "闭上眼睛，记住远处传来的每一道声音。",
        tags: ["echo", "presence"],
        effect: {
          itemId: "resonance_echo_of_beings",
          unlockMapNpcLocations: true,
          feedback:
            "你闭上眼，远处的声音一一落下位置。即使看不见他们，你也能从回声里分辨出每个人所在的地方。",
        },
      },
      {
        id: "sober_eye",
        text: "睁大眼睛，尝试看清那些不自然的细节。",
        tags: ["observation", "clarity"],
        effect: {
          itemId: "resonance_sober_eye",
          apMaxBonusDay: 1,
          feedback: "光影与时间之间细微的不协调，开始在你眼里显形。",
        },
      },
      {
        id: "twin_tree_memory",
        text: "回想园子中央那两棵始终看不真切的树。",
        tags: ["memory", "trees"],
        effect: {
          itemId: "resonance_twin_tree_memory",
          unlockTreeNames: true,
          feedback: "两棵树的轮廓逐渐在你的记忆中变得清晰，你终于能分清左侧与右侧。",
        },
      },
      {
        id: "futile_struggle",
        text: "不顾一切地向前冲去，试图撞破眼前的一切。",
        tags: ["struggle", "force"],
        effect: {
          zeroActionPoints: true,
          resultTitle: "徒劳的挣扎",
          feedback:
            "你向前冲去，却像撞进了一片无形的深水。等你重新站稳时，眼前的景象没有任何改变，力气却已经消耗殆尽。",
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
    title: "幽径尽头的问题",
    prompt:
      "夜晚的小道在这里戛然而止。月光下前方没有墙，也没有树木阻挡，但无论怎样凝望，都看不见更远的地方。\n四周安静得有些不自然，仿佛只要做出某个选择，眼前的一切就会发生变化。你准备怎么做？",
    options: [
      {
        id: "echo_of_beings",
        text: "闭上眼睛，记住远处传来的每一道声音。",
        tags: ["echo", "presence"],
        effect: {
          itemId: "resonance_echo_of_beings",
          unlockMapNpcLocations: true,
          feedback:
            "你闭上眼，远处的声音一一落下位置。即使看不见他们，你也能从回声里分辨出每个人所在的地方。",
        },
      },
      {
        id: "sober_eye",
        text: "睁大眼睛，尝试看清那些不自然的细节。",
        tags: ["observation", "clarity"],
        effect: {
          itemId: "resonance_sober_eye",
          apMaxBonusDay: 1,
          feedback: "光影与时间之间细微的不协调，开始在你眼里显形。",
        },
      },
      {
        id: "twin_tree_memory",
        text: "回想园子中央那两棵始终看不真切的树。",
        tags: ["memory", "trees"],
        effect: {
          itemId: "resonance_twin_tree_memory",
          unlockTreeNames: true,
          feedback: "两棵树的轮廓逐渐在你的记忆中变得清晰，你终于能分清左侧与右侧。",
        },
      },
      {
        id: "futile_struggle",
        text: "不顾一切地向前冲去，试图撞破眼前的一切。",
        tags: ["struggle", "force"],
        effect: {
          zeroActionPoints: true,
          resultTitle: "徒劳的挣扎",
          feedback:
            "你向前冲去，却像撞进了一片无形的深水。等你重新站稳时，眼前的景象没有任何改变，力气却已经消耗殆尽。",
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
          divineAttentionDelta: 1,
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
];

export function getScenePuzzleById(id: string): ScenePuzzle | null {
  return SCENE_PUZZLES.find((puzzle) => puzzle.id === id) ?? null;
}

export function getScenePuzzleByEvaluationId(evaluationId: string): ScenePuzzle | null {
  return SCENE_PUZZLES.find((puzzle) => puzzle.evaluationId === evaluationId) ?? null;
}
