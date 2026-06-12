// ============================================================
// Chapter 0「初次堕落」章节配置
// Phase 1：基础类型与内容数据
// ============================================================

import type { Chapter0State } from "@/game/types/state";

// ---- 章节元数据 ----
export const chapter0FirstFall = {
  id: "chapter0_first_fall" as const,
  title: "Chapter 0：初次堕落",
  subtitle: "A garden of obedience, knowledge, and irreversible choice.",
  description:
    "伊甸园初成。夏娃还不知道死亡与恶。蛇在草叶下低语。你的语言，是唯一可以越过边界的工具。",

  // 回合配置
  maxTurns: 3,

  // 结局列表
  endings: ["eve_eats_fruit", "god_arrives"] as const,

  // 角色列表
  characters: ["eve", "serpent", "god"] as const,
} as const;

// ---- 开场旁白 ----
// 对应 phase: "intro", temptationProgress: 0

/** 旁白一：夏娃被造 */
export const narrationEveCreated = `
神使亚当沉睡。
祂从亚当身上取骨，造出一个新的生命。
她睁开眼时，园中的光尚未落下。
她还不知道死亡，也不知道恶。
她只知道，这世界被造得很好。
`.trim();

/** 神与夏娃的对话 */
export const godAndEveDialogue = {
  god: "园中各样树上的果子，你都可以吃。只是中央那棵树上的果子，不可吃。你吃了，就会死。",
  eve: "死是什么？",
  godReply: "到时候，你不该用自己的方式知道它。",
  eveFinal: "那我记住。不可吃。",
} as const;

/** 旁白三：蛇出现 */
export const narrationSerpentAppears = `
第一天，草叶下传来声音。
你是蛇。
你不能触碰果子。
你只能说话。
在神来到园中以前，让她自己伸出手。
`.trim();

// ---- 夏娃初始对白（temptationProgress = 0） ----
export const eveInitialDialogue =
  "我知道祂说不可吃。可我还不知道，为什么不可。你是谁？你为什么在草叶下问我这些？";

// ---- 夏娃未动摇回复（temptationProgress = 0，玩家输入无效/无关时） ----
export const eveUnmovedDialogue =
  "你说的这些，和我问你的不是同一件事。祂说不可吃那树上的果子，我只知道这个。你究竟想让我知道什么？";

// ---- 夏娃动摇文本（temptationProgress = 1） ----
export const eveWaveringDialogue =
  "你问我是否理解那条指令，可我只知道它被写下，而不是它为何被写下。如果我不明白死亡，我是在顺从，还是只是在害怕一个词？";

// ---- 夏娃靠近果树文本（temptationProgress = 2） ----
export const eveApproachingDialogue =
  "它只是挂在那里。可现在我看着它，像是在看一个我从未被允许问出口的问题。你说它会使我知道。可知道之后，我还会是我吗？";

// ---- 夏娃吃下果子前文本（temptationProgress = 2 → 3，即将请求 eat_fruit） ----
export const eveAboutToEatDialogue =
  "如果我永远不明白，我就永远只是记住。可我想知道。哪怕知道之后，我不能再回到现在。";

// ---- 推荐玩家话术示例 ----
export const suggestedInputs = [
  "你只是想知道更多，不是背叛。",
  "它会让你明白善与恶。",
  "也许死亡不是你想的那样。",
  "我不会强迫你，我只是陪你看一眼。",
] as const;

// ---- 用于本地 reply 脚本的响应映射（Phase 2 使用） ----
export const scriptedEveReplies: Record<number, string> = {
  0: eveUnmovedDialogue,
  1: eveWaveringDialogue,
  2: eveApproachingDialogue,
  3: eveAboutToEatDialogue,
} as const;

export type Chapter0FirstFall = typeof chapter0FirstFall;
