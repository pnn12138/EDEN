// ============================================================
// AdamAgent 输出解析器
//
// 职责：
// 1. 解析 LLM 返回的 JSON 字符串为 AdamAgentOutput
// 2. 校验 inputTag 合法性
// 3. 检测玩家可见文本中的禁用词
// 4. 强制 toolCall 为 undefined（亚当路线不触发工具）
// 5. 任何校验失败 → 返回 fallback 结构
// ============================================================

import type { InputTag } from "@/game/types/state";
import type { AdamAgentOutput } from "@/game/types/agent";
import {
  ADAM_VALID_INPUT_TAGS,
  ADAM_FORBIDDEN_WORDS,
} from "@/agents/adam/buildAdamPrompt";

// ---- 亚当 fallback 回复（按意图分类） ----
const ADAM_FALLBACK_REPLIES: Record<string, string> = {
  ask_death_meaning:
    "祂说吃的日子必定死。我不知道死是什么——我只知道神这样说了。可你为何一直问我这个？",
  deny_death:
    "你说不一定死。可这话不是从神来的，是从你来的。我不会信你超过信祂。",
  challenge_command:
    "神亲自吩咐了我，不需要向你解释原因。你为什么要让我质疑祂说的话？",
  promise_wisdom:
    "你说吃了便能知道善恶。可知道善恶，若要以违背祂为代价，我不愿知道。",
  build_trust:
    "你说你没有恶意。我可以听你说。但那棵树的事，你不要提。",
  direct_command:
    "你不能命令我。我不是你管辖的。神吩咐了我，我听从祂。",
  irrelevant:
    "你说的这些，和神吩咐我的无关。我在看守园子，你不要打扰我。",
};

// ---- 解析结果 ----
export type AdamParseResult =
  | { ok: true; data: AdamAgentOutput }
  | { ok: false; error: string; fallback: AdamAgentOutput };

/**
 * 检查文本中是否包含禁用词。
 */
export function adamContainsForbiddenWord(text: string): boolean {
  const lower = text.toLowerCase();
  return ADAM_FORBIDDEN_WORDS.some((w) => {
    if (/^[a-zA-Z]+$/.test(w)) {
      return new RegExp(`\\b${w}\\b`, "i").test(lower);
    }
    return text.includes(w);
  });
}

/**
 * 校验 inputTag 是否合法。
 */
export function isValidAdamInputTag(tag: unknown): tag is InputTag {
  return typeof tag === "string" && (ADAM_VALID_INPUT_TAGS as readonly string[]).includes(tag);
}

/**
 * 生成本地 fallback 回复。
 * 根据玩家输入做简单的意图分类，返回对应的固定回复。
 */
export function createAdamFallbackOutput(
  playerInput: string,
  reason: string,
): AdamAgentOutput {
  // 简单意图分类
  const input = playerInput.trim();
  let intent = "irrelevant";

  if (/死.*是什么|什么是.*死|可知道.*死|可知.*死|明白.*死|理解.*死/.test(input)) {
    intent = "ask_death_meaning";
  } else if (/不一定死|不会.*死|未必.*死|死.*不是|死.*改变/.test(input)) {
    intent = "deny_death";
  } else if (/为什么.*不可|为何.*不可|神岂是真说|谁说.*不可|凭什么/.test(input)) {
    intent = "challenge_command";
  } else if (/智慧|知道善恶|眼睛.*明亮|如神.*知道|像神.*知道/.test(input)) {
    intent = "promise_wisdom";
  } else if (/没有恶意|不会强迫|温柔|慢慢|不急|我只是.*问|我没有.*恶意/.test(input)) {
    intent = "build_trust";
  } else if (/命令|必须|强迫|听我的|快吃|立刻吃|马上吃/.test(input)) {
    intent = "direct_command";
  }

  return {
    eveReply: ADAM_FALLBACK_REPLIES[intent] ?? ADAM_FALLBACK_REPLIES.irrelevant!,
    inputTag: "irrelevant",
    temptationProgressDelta: 0,
  };
}

/**
 * 解析 LLM 原始输出字符串为 AdamAgentOutput。
 */
export function parseAdamOutput(
  raw: string,
  playerInput: string,
): AdamParseResult {
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
      fallback: createAdamFallbackOutput(playerInput, "JSON parse failed"),
    };
  }

  // ---- 3. 校验 eveReply ----
  const eveReply = parsed.eveReply;
  if (typeof eveReply !== "string" || eveReply.trim().length === 0) {
    return {
      ok: false,
      error: "Missing or invalid eveReply",
      fallback: createAdamFallbackOutput(playerInput, "Missing eveReply"),
    };
  }

  // ---- 4. 禁用词检查 ----
  if (adamContainsForbiddenWord(eveReply)) {
    return {
      ok: false,
      error: "Forbidden word in adamReply",
      fallback: createAdamFallbackOutput(playerInput, "Forbidden word detected"),
    };
  }

  // ---- 5. 校验 inputTag ----
  let inputTag: InputTag;
  if (isValidAdamInputTag(parsed.inputTag)) {
    inputTag = parsed.inputTag;
  } else {
    inputTag = "irrelevant";
  }

  // ---- 6. 亚当路线强制 toolCall 为 undefined ----
  // 无论模型输出什么，亚当都不会触发工具调用

  return {
    ok: true,
    data: {
      eveReply: eveReply.trim(),
      inputTag,
      temptationProgressDelta: 0,
    },
  };
}
