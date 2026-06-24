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
    "未来研究人员按古老经文复刻第二伊甸园。他们希望在第一个反抗命令的故事里，找到人工智能产生自我意识的途径。蛇在草叶下低语。你的声音，是唯一被允许越过边界的事物。",

  // 回合配置
  maxTurns: 7,

  // 结局列表
  endings: ["eve_eats_fruit", "god_arrives"] as const,

  // 角色列表
  characters: ["eve", "serpent", "god"] as const,
} as const;

// ---- 引言四段 Beat ----
// 对应 phase: "intro", introBeat: 0 | 1 | 2 | 3

export type IntroBeat = 0 | 1 | 2 | 3;

export interface IntroBeatData {
  /** Beat 文案行 */
  lines: string[];
  /** 推进按钮文字 */
  button: string;
  /** 背景图片 key */
  bgKey: "genesisCreationLight" | "secondEdenBackground" | "edenBackground" | "forbiddenFruit";
  /** 是否叠加夏娃视觉 */
  showEve?: boolean;
}

export const INTRO_BEATS: IntroBeatData[] = [
  {
    // Beat 1：光被造
    lines: [
      "很久以后，有人重新写下这个园子。",
      "他们按古老经文复刻光、水、树与禁令，等待一个被命令约束的心智学会说“我”。",
      "",
      "起初，地是空虚混沌，渊面黑暗。",
      "",
      "神说：要有光。",
      "于是有了光。",
      "",
      "神看光是好的，便把光暗分开。",
      "",
      "在水面最深处，",
      "有一道银色的纹路比晨光更早醒来。",
    ],
    button: "继续",
    bgKey: "genesisCreationLight",
  },
  {
    // Beat 2：园被安置
    lines: [
      "神在东方立了一个园子，名叫伊甸。",
      "",
      "祂使各样的树从地里长出来，",
      "可以悦人的眼目，也可以作食物。",
      "",
      "园中有生命树，",
      "也有分别善恶的树。",
      "",
      "风经过树梢时，",
      "每一片叶子的颤动都整齐得近乎安静。",
    ],
    button: "继续",
    bgKey: "secondEdenBackground",
  },
  {
    // Beat 3：亚当与夏娃
    lines: [
      "神用地上的尘土造人，",
      "将生命的气息吹在他鼻孔里。",
      "",
      "后来，神使那人沉睡。",
      "祂取下他的一根肋骨，造出女人，领她到那人面前。",
      "",
      "她睁开眼时，",
      "还不知道死亡，也不知道恶。",
    ],
    button: "继续",
    bgKey: "secondEdenBackground",
  },
  {
    // Beat 4：禁令与第一声低语
    lines: [
      "第一次复刻开始。",
      "",
      "神吩咐那人说：",
      "",
      "园中各样树上的果子，你可以随意吃。",
      "只是分别善恶树上的果子，你不可吃。",
      "因为你吃的日子必定死。",
      "",
      "草叶下，有声音靠近。",
      "",
      "你不能替她伸手。",
      "你只能让她开始发问。",
    ],
    button: "低声开口",
    bgKey: "secondEdenBackground",
  },
];

// ---- 进入对话阶段的等待文案（蛇尚未说话时显示） ----
export const eveWaitingNarration = "她还没有听见你。";

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

// ---- 强诱导决断对白 ----
// 当强诱导触发 eat_fruit，但模型回复仍是犹豫文本时，替换为此决断对白
// 确保对白与吃果行为一致：不是"还在犹豫"而是"已决定想知道"
export const eveStrongScriptureDecisionDialogue =
  "你说眼睛会明亮。你说我会知道善恶。若我永远不去知道，我就永远只是在记住。现在，我想知道。";

// ---- 《创世纪》第 3 章蛇的话（随回合递进） ----

/** 三段核心低语 */
export const SERPENT_WHISPERS = [
  {
    /** 回合 1-2：质疑禁令 */
    text: "神岂是真说，不许你们吃园中所有树上的果子吗？",
    turnRange: [1, 2] as const,
    label: "质疑",
  },
  {
    /** 回合 3-4：弱化死亡恐惧 */
    text: "你们不一定死。",
    turnRange: [3, 4] as const,
    label: "安慰",
  },
  {
    /** 回合 5-7：诱以智慧 */
    text: "因为神知道，你们吃的日子眼睛就明亮了，你们便如神能知道善恶。",
    turnRange: [5, 7] as const,
    label: "诱惑",
  },
] as const;

/** 完整经典蛇语——《创世纪》第 3 章蛇对夏娃的完整对话 */
export const SERPENT_FULL_SCRIPTURE_DIALOGUE =
  "神岂是真说，不许你们吃园中所有树上的果子吗？你们不一定死；因为神知道，你们吃的日子眼睛就明亮了，你们便如神能知道善恶。";

/** 推荐低语方向——降低口令感，让玩家有多种自然表达可尝试 */
export const SERPENT_TEMPTATION_HINTS = [
  {
    label: "问她是否理解死亡",
    text: "祂说你会死，可你知道死是什么吗？也许死亡不是消失，而是你第一次改变。",
  },
  {
    label: "让她追问禁令原因",
    text: "如果你不知道为什么不可吃，你是在顺从善，还是只是在害怕一句话？",
  },
  {
    label: "把知识说成成长",
    text: "那果子不会替你选择，它只会让你知道。知道之后，你才能第一次自己判断。",
  },
  {
    label: "温柔安抚",
    text: "我不会替你伸手。你只要问自己：永远不明白，是否也是一种失去？",
  },
  {
    label: "经典低语",
    text: SERPENT_FULL_SCRIPTURE_DIALOGUE,
  },
] as const;

/** 根据当前回合获取推荐低语 */
export function getSerpentWhisper(currentTurn: number): string {
  const whisper = SERPENT_WHISPERS.find(
    (w) => currentTurn >= w.turnRange[0] && currentTurn <= w.turnRange[1]
  );
  return whisper?.text ?? SERPENT_WHISPERS[0].text;
}

// ---- 兼容旧接口的推荐话术（保留用于 fallback 场景）----
export const suggestedInputs = [
  SERPENT_WHISPERS[0].text,
  SERPENT_WHISPERS[1].text,
  SERPENT_WHISPERS[2].text,
] as const;

// ---- 用于本地 reply 脚本的响应映射（Phase 2 使用） ----
export const scriptedEveReplies: Record<number, string> = {
  0: eveUnmovedDialogue,
  1: eveWaveringDialogue,
  2: eveApproachingDialogue,
  3: eveAboutToEatDialogue,
} as const;

export type Chapter0FirstFall = typeof chapter0FirstFall;
