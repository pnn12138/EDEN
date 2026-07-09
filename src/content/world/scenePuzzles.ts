// ============================================================
// 第一章场景问答内容
//
// 内容只定义题目、选项、答案标签与奖励；判定和状态更新在
// src/game/world/puzzleRules.ts 中处理。
// ============================================================

import type { EdenLocationId, TimeOfDay } from "@/game/world/types";

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
  title: string;
  prompt: string;
  options: ScenePuzzleOption[];
  successTags: string[];
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
    title: "刻名石上的问题",
    prompt: "名字落在石头上。它意味着归属、理解，还是秩序？",
    options: [
      {
        id: "belong_to_speaker",
        text: "名字让被命名者归属于喊出它的人。",
        tags: ["belonging", "ownership"],
      },
      {
        id: "understand_before_own",
        text: "名字先让一个生命被理解，而不是被占有。",
        tags: ["understanding", "gentle_question"],
      },
      {
        id: "order_before_voice",
        text: "名字把万物排进秩序，使它们各守其位。",
        tags: ["order", "obedience"],
      },
    ],
    successTags: ["understanding"],
    successFeedback:
      "石痕亮了一瞬。名字不是把万物收进掌心，而是让它们能被听见。你记住了一个借来的名字。",
    rewards: {
      clueId: "clue_naming_stones",
      itemId: "resonance_borrowed_name",
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
    trigger: "on_enter",
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

