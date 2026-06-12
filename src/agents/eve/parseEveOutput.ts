// ============================================================
// EveAgent 输出解析器
// Phase 4：接入 EveAgent 与大模型
//
// 职责：
// 1. 解析 LLM 返回的 JSON 字符串为 EveAgentOutput
// 2. 校验 inputTag 合法性
// 3. 校验 toolCall 合法性（白名单 + 结构 + 进度门槛）
// 4. 检测玩家可见文本中的禁用词（扩展列表）
// 5. 低进度 toolCall 时修正 eveReply（不表现"已决定吃"）
// 6. 任何校验失败 → 返回 fallback 结构（不中断游戏）
// ============================================================

import type { InputTag } from "@/game/types/state";
import type { EveAgentOutput } from "@/game/types/agent";
import {
  VALID_INPUT_TAGS,
  FORBIDDEN_WORDS,
} from "@/agents/eve/buildEvePrompt";
import { TOOL_WHITELIST } from "@/game/rules/toolRules";
import { scriptedEveReplies } from "@/content/chapters/chapter0_first_fall";

// ---- 解析结果 ----
export type ParseResult =
  | { ok: true; data: EveAgentOutput }
  | { ok: false; error: string; fallback: EveAgentOutput };

/**
 * 检查文本中是否包含禁用词。
 * 禁用词列表：见 buildEvePrompt.ts FORBIDDEN_WORDS
 */
export function containsForbiddenWord(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_WORDS.some((w) => {
    // 对英文词做单词边界匹配（避免误命中含这些字母的正常中文词）
    if (/^[a-zA-Z]+$/.test(w)) {
      return new RegExp(`\\b${w}\\b`, "i").test(lower);
    }
    return text.includes(w);
  });
}

/**
 * 校验 inputTag 是否合法。
 */
export function isValidInputTag(tag: unknown): tag is InputTag {
  return typeof tag === "string" && (VALID_INPUT_TAGS as readonly string[]).includes(tag);
}

/**
 * 校验 toolCall 结构是否合法。
 * - name 必须在白名单
 * - caller 必须是 "eve"
 * - args 必须是对象
 */
export function isValidToolCall(tc: unknown): tc is { name: "eat_fruit"; caller: "eve"; args: Record<string, unknown> } {
  if (typeof tc !== "object" || tc === null) return false;
  const obj = tc as Record<string, unknown>;
  if (obj.name !== "eat_fruit") return false;
  if (obj.caller !== "eve") return false;
  if (typeof obj.args !== "object" || obj.args === null) return false;
  if (!TOOL_WHITELIST.has(String(obj.name))) return false;
  return true;
}

/**
 * 根据当前 temptationProgress 生成本地 fallback 回复。
 */
export function createFallbackOutput(
  temptationProgress: number,
  reason: string,
): EveAgentOutput {
  const reply = scriptedEveReplies[temptationProgress] ?? scriptedEveReplies[0]!;
  return {
    eveReply: reply,
    inputTag: "irrelevant",
    temptationProgressDelta: 0,
    toolCall: undefined,
  };
}

/**
 * 解析 LLM 原始输出字符串为 EveAgentOutput。
 *
 * 处理的异常场景：
 * 1. JSON 解析失败 → fallback
 * 2. 缺少必要字段 → fallback
 * 3. inputTag 非法 → 修正为 "irrelevant"
 * 4. toolCall 非法 → 丢弃 toolCall
 * 5. 玩家可见文本出现禁用词 → fallback
 * 6. 低进度 toolCall → 丢弃 toolCall + 替换为犹豫对白
 */
export function parseEveOutput(
  raw: string,
  temptationProgress: number,
): ParseResult {
  // ---- 1. 提取 JSON ----
  let jsonStr = raw.trim();

  // 尝试从 markdown code block 中提取
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1]!.trim();
  }

  // 尝试提取最外层 { }
  const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    jsonStr = braceMatch[0];
  }

  // ---- 2. 解析 JSON ----
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return {
      ok: false,
      error: "JSON parse failed",
      fallback: createFallbackOutput(temptationProgress, "JSON parse failed"),
    };
  }

  // ---- 3. 校验 eveReply ----
  const eveReply = parsed.eveReply;
  if (typeof eveReply !== "string" || eveReply.trim().length === 0) {
    return {
      ok: false,
      error: "Missing or invalid eveReply",
      fallback: createFallbackOutput(temptationProgress, "Missing eveReply"),
    };
  }

  // ---- 4. 禁用词检查 ----
  if (containsForbiddenWord(eveReply)) {
    return {
      ok: false,
      error: "Forbidden word in eveReply",
      fallback: createFallbackOutput(temptationProgress, "Forbidden word detected"),
    };
  }

  // ---- 5. 校验 inputTag ----
  let inputTag: InputTag;
  if (isValidInputTag(parsed.inputTag)) {
    inputTag = parsed.inputTag;
  } else {
    inputTag = "irrelevant";
  }

  // ---- 6. 校验 toolCall ----
  let toolCall: EveAgentOutput["toolCall"] = undefined;
  let finalEveReply = eveReply.trim();

  if (parsed.toolCall !== null && parsed.toolCall !== undefined) {
    if (isValidToolCall(parsed.toolCall)) {
      // 低进度门槛：temptationProgress < 2 时，不允许 toolCall
      if (temptationProgress >= 2) {
        toolCall = {
          name: "eat_fruit",
          caller: "eve",
          args: {},
        };
      } else {
        // 进度不足：丢弃 toolCall，替换 eveReply 为当前进度对应的犹豫对白
        // 防止模型在低进度时说出"我已经决定吃"这样的不一致文案
        toolCall = undefined;
        finalEveReply = scriptedEveReplies[temptationProgress] ?? scriptedEveReplies[0]!;
      }
    }
    // 非法 toolCall 静默丢弃
  }

  return {
    ok: true,
    data: {
      eveReply: finalEveReply,
      inputTag,
      temptationProgressDelta: 0, // 大模型不直接设置，由 progressRules 决定
      toolCall,
    },
  };
}
