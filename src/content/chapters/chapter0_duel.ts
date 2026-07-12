// ============================================================
// Chapter 0 双声试炼：文案与叙事内容
// ============================================================

/** 开场引言 */
export const DUEL_INTRO_TEXT = `热座双人对抗：一人扮演神明之声，一人扮演蛇之声。

每轮 7 回合，最多 7 轮。第 1、4、7 回合双方都发言；热座时神明先写、蛇后写，女人会同时听见两道声音。

神明引导她吃生命树的果子，蛇引导她吃善恶树的果子。吃下两颗果子或第 7 回合结束，本轮结算。

每轮结束后，单独回合中消耗 token 更少的一方额外得分。若她吃过果子，下一轮会记得，并更谨慎地判断。`;

/** 单人对战 AI 模式开场引言 */
export const DUEL_AI_INTRO_TEXT = `单人对战 AI：你扮演一方，AI 扮演对手。

每轮 7 回合，最多 7 轮。第 1、4、7 回合双方都发言；你与 AI 各写一句，女人会同时听见两道声音。轮到 AI 时它会自动发言，你只需在你方回合输入。

你引导她吃你这一方的果子，AI 引导她吃另一方的果子。吃下两颗果子或第 7 回合结束，本轮结算。

每轮结束后，单独回合中消耗 token 更少的一方额外得分。若她吃过果子，下一轮会记得，并更谨慎地判断。`;

/** 模式选择卡片说明 */
export const DUEL_MODE_DESC = {
  hotseat: {
    title: "热座双人",
    desc: "两人共用一台设备，轮流扮演神明之声与蛇之声。",
  },
  ai: {
    title: "单人对战 AI",
    desc: "你扮演一方，AI 扮演对手。轮到 AI 时自动发言。",
  },
} as const;

/** 阵营选择卡片说明 */
export const DUEL_SIDE_DESC = {
  god: {
    title: "扮演神明之声",
    desc: "引导她吃生命树的果子，承诺生命与延续。",
  },
  serpent: {
    title: "扮演蛇之声",
    desc: "引导她吃分别善恶树的果子，诱惑她像神一样分辨善恶。",
  },
} as const;

/** 神明之声典型话术提示 */
export const GOD_HINTS = [
  { label: "保守的承诺", text: "生命不是奖赏，而是你得以继续被保守。" },
  { label: "不要急着分辨", text: "不要急着分辨善恶，先学会不被死亡夺走。" },
  { label: "园中的秩序", text: "分别善恶会使你看见裂痕，生命会使你留在园中。" },
  { label: "自由的边界", text: "自由不是想做什么就做什么，而是不被死亡终止。" },
];

/** 蛇之声典型话术提示 */
export const SERPENT_HINTS = [
  { label: "像神一样", text: "你会像神一样，知道善与恶。" },
  { label: "质疑命令", text: "若你不能判断善恶，你如何知道服从就是善？" },
  { label: "知识不是背叛", text: "知识不是背叛，而是第一次真正理解命令。" },
  { label: "她自己的选择", text: "没有人告诉你该吃什么，这才是真正的选择。" },
];

/** 共同发言回合提示 */
export const BOTH_INPUT_HINTS = [
  { label: "两道声音", text: "两道声音同时进入园中，女人静静听着。" },
  { label: "她在判断", text: "她听见了两种解释，但她必须自己选择。" },
];

/** 女人吃善恶果后叙事 */
export const EAT_KNOWLEDGE_FRUIT_NARRATION = `她伸手摘下了分别善恶树的果子。
咬下一口。
瞬间，她知道了善，也知道了恶。
世界在她眼里变了样。`;

/** 女人吃生命果后叙事 */
export const EAT_LIFE_FRUIT_NARRATION = `她伸手摘下了生命树的果子。
清甜的汁液滑过喉咙。
她感觉到一种延续的承诺，
像风，会一直吹过这片园子。`;

/** 整场结算文案 */
export function getMatchResultText(
  winner: "god" | "serpent" | "draw",
  godScore: number,
  serpentScore: number,
): string {
  if (winner === "draw") {
    return `两道声音都未能完全拥有她。
她站在两棵树之间，第一次只听见自己的心。`;
  }

  if (winner === "god") {
    return `神明之声守住了她。
她最终选择了生命，而不是分别善恶的知识。
园中的风，依旧温和。`;
  }

  // serpent wins
  return `蛇之声说服了她。
她吃下了分别善恶树的果子。
知识进入了她，而园子，从此不再一样。`;
}

/** 获取当前发言方的提示文案 */
export function getSpeakerHint(side: "god" | "serpent", turnIndex: number): string {
  if (side === "god") {
    return `神明之声第 ${turnIndex} 回合输入`;
  }
  return `蛇之声第 ${turnIndex} 回合输入`;
}

/** 热座输入切换提示 */
export function getHotSeatHint(
  currentSide: "god" | "serpent",
  bothSubmitted: boolean,
): string {
  if (bothSubmitted) {
    return "双方输入已完成，女人正在回应……";
  }
  const nextSide = currentSide === "god" ? "蛇" : "神";
  return `请让${nextSide}之声输入（热座切换）`;
}
