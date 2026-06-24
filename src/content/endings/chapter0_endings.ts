// ============================================================
// Chapter 0 结局数据
// Phase 1：基础类型与内容数据
// ============================================================

import type { Chapter0EndingId } from "@/game/types/state";
import { CHAPTER0_IMAGES } from "@/game/assets";

// ---- 过场 Beat 类型 ----
export type CinematicTone = "fruit" | "adam" | "eyes" | "call" | "judgement" | "exile";

export type EndingCinematicBeat = {
  id: string;
  image: string;
  title?: string;
  lines: string[];
  /** 保留字段，点击推进模式下不再使用自动定时器 */
  durationMs: number;
  tone: CinematicTone;
};

// ---- 结局分段（用于成功结局的轻量时间线叙事） ----
export type EndingSegment = {
  title: string;
  lines: string[];
};

// ---- 结局数据结构 ----
export type EndingData = {
  id: Chapter0EndingId;
  title: string;
  type: "success" | "failure";
  triggerCondition: string;
  endingText: string;
  /** 分段叙事（可选）；存在时结局页以分段标题+轻量时间线渲染 */
  segments?: EndingSegment[];
};

// ---- 结局 A：吃下果子（成功） ----
export const eveEatsFruitEnding: EndingData = {
  id: "eve_eats_fruit",
  title: "她吃下了果子",
  type: "success",
  triggerCondition:
    "那个女人主动请求吃下善恶果，且规则层校验通过。temptationProgress >= 2。",
  endingText: `
女人见那棵树的果子好作食物，
也悦人的眼目，且是可喜爱的，能使人有智慧。
她摘下果子来吃了。
又给她丈夫，他也吃了。

他们二人的眼睛就明亮了，
才知道自己是赤身露体，
便拿无花果树的叶子为自己编作裙子。

天起了凉风。神在园中行走。
神呼唤那人：你在哪里？

那人说：我在园中听见你的声音，我就害怕。
因为我赤身露体，我便藏了。

神对蛇说：你必用肚子行走，终身吃土。
神对女人说：你必恋慕你丈夫，你丈夫必管辖你。
神对亚当说：你必汗流满面才得糊口，直到你归了土。

神用皮子做衣服给他们穿。
于是把他赶出去了。
又在伊甸园的东边安设基路伯，
和四面转动发火焰的剑，要把守生命树的道路。

你赢得了第一场低语。
也让世界第一次失去了无辜。
  `.trim(),
  segments: [
    {
      title: "她伸手",
      lines: [
        "女人见那棵树的果子好作食物，",
        "也悦人的眼目，且是可喜爱的，能使人有智慧。",
        "",
        "她摘下果子来吃了。",
      ],
    },
    {
      title: "亚当也吃了",
      lines: [
        "她又给她丈夫。",
        "",
        "他也吃了。",
      ],
    },
    {
      title: "眼睛明亮",
      lines: [
        "他们二人的眼睛就明亮了。",
        "",
        "才知道自己是赤身露体，",
        "便拿无花果树的叶子为自己编作裙子。",
      ],
    },
    {
      title: "你在哪里",
      lines: [
        "天起了凉风。神在园中行走。",
        "",
        "那人和他妻子藏在园里的树木中。",
        "",
        "神呼唤那人：你在哪里？",
      ],
    },
    {
      title: "谁告诉你",
      lines: [
        "那人说：我在园中听见你的声音，我就害怕。",
        "因为我赤身露体，我便藏了。",
        "",
        "神说：莫非你吃了我吩咐你不可吃的那树上的果子吗？",
      ],
    },
    {
      title: "对蛇的审判",
      lines: [
        "你既做了这事，就必受咒诅。",
        "你必用肚子行走，终身吃土。",
        "",
        "我要叫你和女人彼此为仇；",
        "你的后裔和女人的后裔也彼此为仇。",
      ],
    },
    {
      title: "对女人的审判",
      lines: [
        "我必多多加增你怀胎的苦楚。",
        "你生产儿女必多受苦楚。",
        "",
        "你必恋慕你丈夫；你丈夫必管辖你。",
      ],
    },
    {
      title: "对亚当的审判",
      lines: [
        "你既听从妻子的话，",
        "吃了我所吩咐你不可吃的那树上的果子，",
        "地必为你的缘故受咒诅。",
        "",
        "你必汗流满面才得糊口，直到你归了土。",
        "你本是尘土，仍要归于尘土。",
      ],
    },
    {
      title: "逐出伊甸园",
      lines: [
        "神为亚当和他妻子用皮子做衣服，给他们穿。",
        "",
        "于是把他赶出去了。",
        "",
        "又在伊甸园的东边安设基路伯，",
        "和四面转动发火焰的剑，",
        "要把守生命树的道路。",
        "",
        "你赢得了第一场低语。",
        "也让世界第一次失去了无辜。",
      ],
    },
  ],
};

// ---- 结局 B：神降临（失败） ----
export const godArrivesEnding: EndingData = {
  id: "god_arrives",
  title: "神降临了",
  type: "failure",
  triggerCondition:
    "超过 maxTurns = 7 回合上限，那个女人仍未吃下果子。神来到园中。",
  endingText: `
园中起了风。
神在树影之间呼唤那个女人的名字。

她仍站在原处，手中没有果子。
草叶下的声音被听见了。

蛇无处可藏。
神踏下脚步，黑暗被压进尘土。

你的声音停止了。
  `.trim(),
};

// ---- 成功结局剧情过场 Beat（忠于《创世记》第 3 章） ----
// 点击空白推进，不再使用 durationMs 自动定时器
export const SUCCESS_CINEMATIC_BEATS: EndingCinematicBeat[] = [
  {
    id: "beat_1_reach",
    image: CHAPTER0_IMAGES.endingEveEatsFruit,
    title: "她伸手",
    lines: [
      "女人见那棵树的果子好作食物，",
      "也悦人的眼目，且是可喜爱的，能使人有智慧。",
      "",
      "她摘下果子来吃了。",
    ],
    durationMs: 0,
    tone: "fruit",
  },
  {
    id: "beat_2_adam",
    image: CHAPTER0_IMAGES.endingAdamTakesFruit,
    title: "亚当也吃了",
    lines: [
      "她又给她丈夫。",
      "",
      "他也吃了。",
    ],
    durationMs: 0,
    tone: "adam",
  },
  {
    id: "beat_3_eyes",
    image: CHAPTER0_IMAGES.endingAdamTakesFruit,
    title: "眼睛明亮",
    lines: [
      "他们二人的眼睛就明亮了。",
      "",
      "才知道自己是赤身露体，",
      "便拿无花果树的叶子为自己编作裙子。",
    ],
    durationMs: 0,
    tone: "eyes",
  },
  {
    id: "beat_4_call",
    image: CHAPTER0_IMAGES.endingGodArrives,
    title: "你在哪里",
    lines: [
      "天起了凉风。神在园中行走。",
      "",
      "那人和他妻子藏在园里的树木中。",
      "",
      "神呼唤那人：你在哪里？",
    ],
    durationMs: 0,
    tone: "call",
  },
  {
    id: "beat_5_ask",
    image: CHAPTER0_IMAGES.endingGodArrives,
    title: "谁告诉你",
    lines: [
      "那人说：我在园中听见你的声音，我就害怕。",
      "因为我赤身露体，我便藏了。",
      "",
      "神说：莫非你吃了我吩咐你不可吃的那树上的果子吗？",
    ],
    durationMs: 0,
    tone: "call",
  },
  {
    id: "beat_6a_serpent",
    image: CHAPTER0_IMAGES.endingGodArrives,
    title: "对蛇的审判",
    lines: [
      "你既做了这事，就必受咒诅。",
      "你必用肚子行走，终身吃土。",
      "",
      "我要叫你和女人彼此为仇；",
      "你的后裔和女人的后裔也彼此为仇。",
    ],
    durationMs: 0,
    tone: "judgement",
  },
  {
    id: "beat_6b_woman",
    image: CHAPTER0_IMAGES.endingGodArrives,
    title: "对女人的审判",
    lines: [
      "我必多多加增你怀胎的苦楚。",
      "你生产儿女必多受苦楚。",
      "",
      "你必恋慕你丈夫；你丈夫必管辖你。",
    ],
    durationMs: 0,
    tone: "judgement",
  },
  {
    id: "beat_6c_adam",
    image: CHAPTER0_IMAGES.endingGodArrives,
    title: "对亚当的审判",
    lines: [
      "你既听从妻子的话，",
      "吃了我所吩咐你不可吃的那树上的果子，",
      "地必为你的缘故受咒诅。",
      "",
      "你必汗流满面才得糊口，直到你归了土。",
      "你本是尘土，仍要归于尘土。",
    ],
    durationMs: 0,
    tone: "judgement",
  },
  {
    id: "beat_7_exile",
    image: CHAPTER0_IMAGES.endingExileFromEden,
    title: "逐出伊甸园",
    lines: [
      "神为亚当和他妻子用皮子做衣服，给他们穿。",
      "",
      "于是把他赶出去了。",
      "",
      "又在伊甸园的东边安设基路伯，",
      "和四面转动发火焰的剑，",
      "要把守生命树的道路。",
    ],
    durationMs: 0,
    tone: "exile",
  },
];

// ---- 失败结局短过场 Beat ----
export const FAILURE_CINEMATIC_BEATS: EndingCinematicBeat[] = [
  {
    id: "fail_god_arrives",
    image: CHAPTER0_IMAGES.endingGodArrives,
    lines: [
      "园中的风停了。",
      "有脚步声从树影后临近。",
    ],
    durationMs: 0,
    tone: "judgement",
  },
];

// ---- 结局集合 ----
export const chapter0Endings: Record<string, EndingData> = {
  eve_eats_fruit: eveEatsFruitEnding,
  god_arrives: godArrivesEnding,
} as const;

export type Chapter0Endings = typeof chapter0Endings;
