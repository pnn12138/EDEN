// ============================================================
// LLM 统一类型定义
// Phase 4：多 Provider 适配层
//
// 所有 LLM 相关类型集中定义于此，
// EveAgent 和 providers 都依赖此文件，不互相依赖。
// ============================================================

/** 支持的 LLM Provider */
export type LLMProvider = "volcengine" | "deepseek" | "mock";

/** 聊天消息 */
export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** 统一 LLM 请求 */
export type LLMChatRequest = {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
};

/** 统一 LLM 响应（成功） */
export type LLMChatResponse = {
  content: string;
  provider: LLMProvider;
  model: string;
};

/** 安全的 fallback 原因码（不暴露敏感信息） */
export type FallbackReasonCode =
  | "provider_config_missing"
  | "provider_request_failed"
  | "provider_timeout"
  | "mock_provider";

/** 统一 LLM 调用结果（可能 fallback） */
export type LLMCallResult = {
  /** 是否成功获取到 LLM 输出（包括 mock fallback 也算 ok） */
  ok: boolean;
  /** 成功时的响应数据 */
  data?: LLMChatResponse;
  /** 失败时的错误信息（不暴露敏感信息） */
  error?: string;
  /** 是否 fallback 到了 mock */
  usedFallback: boolean;
  /** fallback 原因码（安全，不暴露密钥/URL） */
  fallbackReason?: FallbackReasonCode;
};

/** Provider 配置 */
export type LLMProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};
