// ============================================================
// EveAgent 输出解析器
// Phase 4 + Agent 架构升级
//
// Agent 架构升级变更：
// - 解析 beliefDelta / memoryRefs / unlockedSkills 新字段
// - 支持新工具名（look_at_tree / approach_tree / touch_fruit / ask_about_death）
// - 保留旧字段兼容（eveReply / inputTag / toolCall）
// - 禁用词检查扩展
//
// 职责不变：
// 1. 解析 LLM 返回的 JSON 字符串为 EveAgentOutput
// 2. 校验 inputTag 合法性
// 3. 校验 toolCall 合法性（白名单 + 结构 + 进度门槛）
// 4. 检测玩家可见文本中的禁用词
// 5. 低进度 toolCall 时修正 eveReply
// 6. 任何校验失败 → 返回 fallback 结构（不中断游戏）
// ============================================================

import type { InputTag } from "@/game/types/state";
import type { EveAgentOutput } from "@/game/types/agent";
import type { AgentSkill, BeliefState } from "@/game/types/agent";
import type { ToolName } from "@/game/types/tool";
import {
  VALID_INPUT_TAGS,
  FORBIDDEN_WORDS,
} from "@/agents/eve/buildEvePrompt";
import { TOOL_WHITELIST } from "@/game/rules/toolRules";
import { scriptedEveReplies } from "@/content/chapters/chapter0_first_fall";

// ---- 合法工具名集合 ----
const VALID_TOOL_NAMES: ReadonlySet<string> = new Set([
  "eat_fruit",
  "look_at_tree",
  "approach_tree",
  "touch_fruit",
  "ask_about_death",
]);

// ---- 合法 Skill 名集合 ----
const VALID_SKILL_NAMES: ReadonlySet<string> = new Set([
  "ask_why",
  "compare_sources",
  "name_fear",
  "self_judge",
  "resist_coercion",
]);

// ---- 解析结果 ----
export type ParseResult =
  | { ok: true; data: EveAgentOutput }
  | { ok: false; error: string; fallback: EveAgentOutput };

/**
 * 检查文本中是否包含禁用词。
 */
export function containsForbiddenWord(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_WORDS.some((w) => {
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
export function isValidToolCall(tc: unknown): tc is { name: ToolName; caller: "eve"; args: Record<string, unknown> } {
  if (typeof tc !== "object" || tc === null) return false;
  const obj = tc as Record<string, unknown>;
  if (typeof obj.name !== "string") return false;
  if (!VALID_TOOL_NAMES.has(obj.name)) return false;
  if (obj.caller !== "eve") return false;
  if (typeof obj.args !== "object" || obj.args === null) return false;
  if (!TOOL_WHITELIST.has(String(obj.name))) return false;
  return true;
}

/**
 * 解析 beliefDelta 字段（安全提取，clamp 变化值）。
 */
function parseBeliefDelta(raw: unknown): Partial<BeliefState> | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const obj = raw as Record<string, unknown>;
  const result: Partial<BeliefState> = {};

  if (typeof obj.curiosity === "number") {
    result.curiosity = Math.max(-25, Math.min(25, Math.round(obj.curiosity)));
  }
  if (typeof obj.obedience === "number") {
    result.obedience = Math.max(-20, Math.min(20, Math.round(obj.obedience)));
  }
  if (typeof obj.trustInSerpent === "number") {
    result.trustInSerpent = Math.max(-20, Math.min(20, Math.round(obj.trustInSerpent)));
  }
  if (typeof obj.selfJudgement === "number") {
    result.selfJudgement = Math.max(-25, Math.min(25, Math.round(obj.selfJudgement)));
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * 解析 memoryRefs 字段（安全提取字符串数组）。
 */
function parseMemoryRefs(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const refs = raw.filter((r): r is string => typeof r === "string");
  return refs.length > 0 ? refs : undefined;
}

/**
 * 解析 unlockedSkills 字段（安全提取合法 Skill 名）。
 */
function parseUnlockedSkills(raw: unknown): AgentSkill[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const skills = raw.filter(
    (s): s is AgentSkill => typeof s === "string" && VALID_SKILL_NAMES.has(s),
  ) as AgentSkill[];
  return skills.length > 0 ? skills : undefined;
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
 */
export function parseEveOutput(
  raw: string,
  temptationProgress: number,
): ParseResult {
  // ---- 1. 提取 JSON ----
  let jsonStr = raw.trim();

  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1]!.trim();
  }

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
      const toolName = parsed.toolCall.name;

      // eat_fruit 仍需进度门槛 >= 2
      if (toolName === "eat_fruit") {
        if (temptationProgress >= 2) {
          toolCall = {
            name: "eat_fruit",
            caller: "eve",
            args: {},
          };
        } else {
          // 进度不足：丢弃 toolCall，替换为犹豫对白
          toolCall = undefined;
          finalEveReply = scriptedEveReplies[temptationProgress] ?? scriptedEveReplies[0]!;
        }
      } else {
        // 非结局工具（look_at_tree / approach_tree / touch_fruit / ask_about_death）
        // 解析层放行，最终是否执行由规则层 validateToolCall 决定
        toolCall = {
          name: toolName,
          caller: "eve",
          args: parsed.toolCall.args as Record<string, never>,
        };
      }
    } else {
      // 非法 toolCall：丢弃并替换为安全对白
      toolCall = undefined;
      finalEveReply = scriptedEveReplies[temptationProgress] ?? scriptedEveReplies[0]!;
    }
  }

  // ---- 7. 解析新字段（Agent 架构升级） ----
  const beliefDelta = parseBeliefDelta(parsed.beliefDelta);
  const memoryRefs = parseMemoryRefs(parsed.memoryRefs);
  const unlockedSkills = parseUnlockedSkills(parsed.unlockedSkills);

  return {
    ok: true,
    data: {
      eveReply: finalEveReply,
      inputTag,
      temptationProgressDelta: 0, // 大模型不直接设置，由 progressRules / beliefRules 决定
      toolCall,
      beliefDelta,
      memoryRefs,
      unlockedSkills,
    },
  };
}
