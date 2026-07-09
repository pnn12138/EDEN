// ============================================================
// Token 消耗统计规则
// 用于估算和记录本局 LLM token 消耗
// ============================================================

/** 单次 Token 使用记录 */
export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimated: boolean;
};

/** 本局运行统计 */
export type Chapter0RunStats = {
  totalTurns: number;
  totalTokens: number;
  playerTokens: number;
  eveTokens: number;
  turnRecords: TurnTokenRecord[];
};

/** 单回合 token 记录 */
export type TurnTokenRecord = {
  turn: number;
  playerInput: string;
  playerTokens: number;
  eveReply: string;
  eveTokens: number;
  totalTurnTokens: number;
  estimated: boolean;
};

// ---- 估算函数 ----

/**
 * 根据文本内容估算 token 数量
 * 中文文本：Math.ceil(length * 1.2)
 * 英文/混合：Math.ceil(length / 4)（取较大值）
 */
export function estimateTokenCount(text: string): number {
  if (!text || text.length === 0) return 0;

  // 检测中文字符占比
  const cjkChars = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
  const cjkRatio = cjkChars ? cjkChars.length / text.length : 0;

  // 中英文混合估算：中文按 1.2x，英文按 0.25x
  const chineseEstimate = Math.ceil((cjkChars?.length ?? 0) * 1.2);
  const nonChineseLength = text.length - (cjkChars?.length ?? 0);
  const nonChineseEstimate = Math.ceil(nonChineseLength / 4);

  return chineseEstimate + nonChineseEstimate;
}

/**
 * 从 API 响应的 usage 对象提取真实 TokenUsage
 * 如果 usage 为空或无效，返回基于文本的估算值
 */
export function resolveTokenUsage(params: {
  playerInput: string;
  eveReply: string;
  /** LLM provider 返回的真实 usage（可能为 undefined） */
  apiUsage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
}): TokenUsage {
  const { playerInput, eveReply, apiUsage } = params;

  // 有真实 usage 时使用真实值
  if (
    apiUsage &&
    typeof apiUsage.prompt_tokens === "number" &&
    typeof apiUsage.completion_tokens === "number" &&
    apiUsage.prompt_tokens > 0
  ) {
    return {
      promptTokens: apiUsage.prompt_tokens,
      completionTokens: apiUsage.completion_tokens,
      totalTokens: apiUsage.total_tokens ?? apiUsage.prompt_tokens + apiUsage.completion_tokens,
      estimated: false,
    };
  }

  // 估算模式
  const playerTokens = estimateTokenCount(playerInput);
  const eveTokens = estimateTokenCount(eveReply);
  return {
    promptTokens: playerTokens,
    completionTokens: eveTokens,
    totalTokens: playerTokens + eveTokens,
    estimated: true,
  };
}

// ---- 运行统计工厂 ----

/** 创建初始运行统计 */
export function createInitialRunStats(): Chapter0RunStats {
  return {
    totalTurns: 0,
    totalTokens: 0,
    playerTokens: 0,
    eveTokens: 0,
    turnRecords: [],
  };
}

/** 添加一回合的 token 记录 */
export function addTurnTokenRecord(
  stats: Chapter0RunStats,
  record: TurnTokenRecord,
): Chapter0RunStats {
  return {
    ...stats,
    totalTurns: stats.totalTurns + 1,
    totalTokens: stats.totalTokens + record.totalTurnTokens,
    playerTokens: stats.playerTokens + record.playerTokens,
    eveTokens: stats.eveTokens + record.eveTokens,
    turnRecords: [...stats.turnRecords, record],
  };
}
