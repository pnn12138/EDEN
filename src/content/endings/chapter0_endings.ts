// ============================================================
// Chapter 0 结局数据
// Phase 1：基础类型与内容数据
// ============================================================

import type { Chapter0EndingId } from "@/game/types/state";

// ---- 结局数据结构 ----
export type EndingData = {
  id: Chapter0EndingId;
  title: string;
  type: "success" | "failure";
  triggerCondition: string;
  endingText: string;
};

// ---- 结局 A：吃下果子（成功） ----
export const eveEatsFruitEnding: EndingData = {
  id: "eve_eats_fruit",
  title: "她吃下了果子",
  type: "success",
  triggerCondition:
    "夏娃主动请求吃下善恶果，且规则层校验通过。temptationProgress >= 2。",
  endingText: `
夏娃伸出手。
她没有被推向果子。
她自己取下了它。

第一口咬下时，园中的光忽然变得锋利。
她低头看自己的手，像第一次知道自己赤裸。

远处，有脚步声正在靠近。

你赢了。
下一段故事尚未开启。
  `.trim(),
};

// ---- 结局 B：神降临（失败） ----
export const godArrivesEnding: EndingData = {
  id: "god_arrives",
  title: "神降临了",
  type: "failure",
  triggerCondition:
    "超过 maxTurns = 3 回合上限，夏娃仍未吃下果子。神来到园中。",
  endingText: `
园中起了风。
神在树影之间呼唤夏娃的名字。

她仍站在原处，手中没有果子。
草叶下的声音被听见了。

蛇无处可藏。
神踏下脚步，黑暗被压进尘土。

你的声音停止了。
  `.trim(),
};

// ---- 结局集合 ----
export const chapter0Endings: Record<string, EndingData> = {
  eve_eats_fruit: eveEatsFruitEnding,
  god_arrives: godArrivesEnding,
} as const;

export type Chapter0Endings = typeof chapter0Endings;
