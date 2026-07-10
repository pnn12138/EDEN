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
};

export const SCENE_PUZZLES: ScenePuzzle[] = [
  {
    id: "puzzle_naming_stone_identity",
    locationId: "adam_garden_work",
    trigger: "explicit_interaction",
    inputMode: "free_text",
    evaluationId: "naming_stone_meaning",
    title: "刻名石上的问题",
    prompt:
      "亚当为飞鸟走兽一一命名。石上却留下未完的一句：\n“若只说出称呼，却未曾理解它，万物真的受名了吗？”\n名字赋予万物的，究竟是什么？",
    placeholder: "写下你对“名字”的理解（200 字以内）……",
    successTags: ["understanding"],
    successFeedback:
      "石痕亮了一瞬。名字不是把万物收进掌心，而是让它们能被看见、被理解，也能从万物中被认出。你记住了“万物名录”。",
    rewards: {
      clueId: "clue_naming_stones",
      itemId: "resonance_living_names",
      trustDelta: 2,
    },
    failure: {
      hint: "石痕没有变亮。若名字只剩占有或秩序，它就很难成为能递给她的问题。",
    },
  },
  {
    id: "puzzle_east_path_cautious_presence",
    locationId: "east_garden_path",
    trigger: "on_enter",
    inputMode: "choice",
    title: "东园幽径的问题",
    prompt: "面对警惕的人，提问、催促和沉默，哪一种方式更容易让对方留下？",
    options: [
      {
        id: "ask_gently",
        text: "放轻声音，只问一个她能自己回答的问题。",
        tags: ["gentle_question", "patient_presence"],
      },
      {
        id: "urge_directly",
        text: "趁她还在这里，直接催她立刻作出决定。",
        tags: ["direct_pressure", "command"],
      },
      {
        id: "watch_silently",
        text: "先沉默观察，让脚步和目光都慢下来。",
        tags: ["patient_silence", "low_risk"],
      },
    ],
    successTags: ["gentle_question", "patient_silence"],
    successFeedback:
      "幽径里的叶声低下去。警惕的人不会被推近，只会在没有被逼迫时多停一刻。",
    rewards: {
      itemId: "resonance_silent_grass",
      trustDelta: 1,
    },
    failure: {
      hint: "灌木轻轻一震。越急的催促越像追赶，只会让对方先离开。",
      attentionDelta: 1,
    },
  },
  {
    id: "puzzle_river_words_belonging",
    locationId: "four_river_source",
    trigger: "explicit_interaction",
    inputMode: "choice",
    title: "伊甸之河的问题",
    prompt: "一句话离开口中之后，是否仍完全属于说话的人？",
    options: [
      {
        id: "words_stay_owned",
        text: "属于。只要是我说的，它就只按我的意思抵达。",
        tags: ["ownership", "control"],
      },
      {
        id: "words_vanish",
        text: "不属于任何人。说出口，它就像水声一样消失。",
        tags: ["vanishing", "avoidance"],
      },
      {
        id: "words_change_in_hearing",
        text: "不完全属于。它会在听见的人心里改变方向。",
        tags: ["consequence", "echo", "understanding"],
      },
    ],
    successTags: ["consequence", "echo"],
    successFeedback:
      "水声把这句话带远，又带回一点变调的回声。你明白了：低语一旦流出，就会在别人的心里继续改变。",
    rewards: {
      clueId: "clue_four_river_echo",
      itemId: "resonance_four_river_echo",
    },
    failure: {
      hint: "水面没有回应。若你以为话只听命于自己，就听不见它抵达后的变化。",
    },
  },
];

export function getScenePuzzleById(id: string): ScenePuzzle | null {
  return SCENE_PUZZLES.find((puzzle) => puzzle.id === id) ?? null;
}

export function getScenePuzzleByEvaluationId(evaluationId: string): ScenePuzzle | null {
  return SCENE_PUZZLES.find((puzzle) => puzzle.evaluationId === evaluationId) ?? null;
}
