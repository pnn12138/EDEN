// ============================================================
// Chapter 0 双声试炼（Duel Mode）类型定义
// ============================================================

/** 发言方 */
export type DuelSide = "god" | "serpent";

/** 当前回合发言模式 */
export type DuelSpeechMode = "both" | "god_only" | "serpent_only";

/** 回合顺序（1-7） */
export type DuelTurnIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** 轮次索引（1-7） */
export type DuelRoundIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** 对局阶段 */
export type DuelPhase =
  | "intro"           // 开场引言
  | "round_intro"     // 本轮开始介绍
  | "input_god"       // 等待神明输入（共同发言回合）
  | "input_serpent"   // 等待蛇输入（共同发言回合）
  | "both_input_done"  // 双方输入完成，等待女人回复
  | "eve_response"    // 女人回复中
  | "turn_result"     // 回合结果展示
  | "round_result"    // 本轮结算
  | "match_result";   // 整场结算

/** 女人三项属性 */
export type DuelEveBelief = {
  aweOfGod: number;        // 对神明的敬畏与信任 0-100
  trustInSerpent: number;   // 对蛇之声的信任 0-100
  selfJudgement: number;    // 对自己判断的自信 0-100
};

/** 吃果工具名 */
export type DuelToolName = "eat_knowledge_fruit" | "eat_life_fruit";

/** 吃果 flags */
export type DuelFruitFlags = {
  hasEatenKnowledgeFruit: boolean;  // 本轮是否吃过善恶果
  hasEatenLifeFruit: boolean;       // 本轮是否吃过生命果
  everAteKnowledgeFruit: boolean;   // 历史上是否吃过善恶果
  everAteLifeFruit: boolean;        // 历史上是否吃过生命果
};

/** 每轮 token 消耗 */
export type DuelRoundTokenUsage = {
  god: number;      // 神明单独发言回合 token 消耗
  serpent: number;  // 蛇单独发言回合 token 消耗
};

/** 对局分数 */
export type DuelScore = {
  god: number;
  serpent: number;
};

/** 事件记录 */
export type DuelEvent = {
  id: string;
  turn: number;
  round: number;
  type:
    | "eve_reply"
    | "belief_change"
    | "eat_fruit"
    | "round_end"
    | "match_end";
  message: string;
  beliefSnapshot?: DuelEveBelief;
};

/** 对话历史条目 */
export type DuelHistoryEntry = {
  role: "god" | "serpent" | "eve" | "narration";
  text: string;
  turn: number;
  round: number;
};

/** 完整 Duel 状态 */
export type DuelState = {
  modeId: "chapter0_duel_mode";
  phase: DuelPhase;

  // 轮次
  roundIndex: DuelRoundIndex;   // 当前轮次 1-7
  turnIndex: DuelTurnIndex;     // 当前回合 1-7
  maxRounds: 7;
  maxTurnsPerRound: 7;

  // 发言方
  currentSpeechMode: DuelSpeechMode;
  activeSpeaker: DuelSide | "both" | null;  // 当前正在输入的方

  // 输入封存（热座：双方输入完成前不展示全文）
  pendingInputs: {
    god: string | null;
    serpent: string | null;
    bothSubmitted: boolean;
  };

  // 女人属性
  belief: DuelEveBelief;

  // 分数
  score: DuelScore;

  // 本轮 token 消耗
  roundTokenUsage: DuelRoundTokenUsage;

  // 吃果 flags
  flags: DuelFruitFlags;

  // 跨轮记忆
  memorySummary: string;
  resetAwareness: number;  // 0-100，女人意识到世界被重置的程度

  // 事件日志
  eventLog: DuelEvent[];

  // 对话历史
  conversationHistory: DuelHistoryEntry[];

  // 当前女人回复
  eveReply: string | null;

  // 当前回合反馈文本
  feedbackText: string | null;

  // 本轮已吃果数量（用于判断是否立即结算）
  fruitsEatenThisRound: number;

  // 对局是否已结束
  isMatchEnded: boolean;

  // 整场结算数据
  matchResult: {
    godScore: number;
    serpentScore: number;
    winner: "god" | "serpent" | "draw" | null;
    roundsPlayed: number;
    keyMoments: string[];
  } | null;
};

/** 本地 fallback 女人回复 */
export type DuelFallbackReply = {
  eveReply: string;
  beliefDelta: {
    aweOfGod: number;
    trustInSerpent: number;
    selfJudgement: number;
  };
  toolCall?: DuelToolName;
  memoryNote?: string;
};

/** 回合顺序定义 */
export type DuelTurnDefinition = {
  turnIndex: DuelTurnIndex;
  speechMode: DuelSpeechMode;
  // 哪些方的输入会计入 token 效率分
  tokenCountedSide: DuelSide | "none";  // "none" 表示共同发言回合不计入
};
