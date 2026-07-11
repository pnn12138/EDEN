// ============================================================
// 第一章：低语润色 API
//
// 职责：将玩家输入框中的文本润色为伊甸园中蛇的低语风格。
// 仅做文本变换，不触碰任何游戏状态。
// 复用统一 LLM 入口（服务端调用，不暴露密钥）。
// ============================================================

import { callLLM } from "@/services/llm/client";
import type { ChatMessage } from "@/services/llm/types";
import type { EdenNpcId } from "@/game/world/types";
import { getNpcRelationProfile } from "@/content/world/npcRelations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLISH_SYSTEM_PROMPT =
  "你是伊甸园中的蛇，将以下玩家输入的内容润色为符合伊甸园内神话风格的低语，保持原意，使用短句，不用现代口语、网络语、辩论腔，不超过50字：";

function clampToFifty(text: string): string {
  const trimmed = text.trim();
  // 去除首尾引号 / 多余空白
  const cleaned = trimmed.replace(/^[""'']|[""'']$/g, "").trim();
  return cleaned.length > 50 ? `${cleaned.slice(0, 50)}…` : cleaned;
}

type PolishRequestBody = {
  text?: unknown;
  npcId?: unknown;
  dialogueHistory?: unknown;
};

export async function POST(req: Request): Promise<Response> {
  let text = "";
  let npcId: EdenNpcId | null = null;
  let dialogueHistory: { role: "serpent" | "npc"; text: string }[] = [];

  try {
    const body = (await req.json()) as PolishRequestBody;
    if (typeof body.text === "string") text = body.text;
    if (typeof body.npcId === "string") npcId = body.npcId as EdenNpcId;
    if (Array.isArray(body.dialogueHistory)) {
      dialogueHistory = body.dialogueHistory as { role: "serpent" | "npc"; text: string }[];
    }
  } catch {
    return Response.json({ ok: false, polished: "" }, { status: 400 });
  }

  const source = text.trim();
  if (!source) {
    return Response.json({ ok: false, polished: "" });
  }

  // 按低语对象的人设拼入 system prompt，使润色贴合语境
  const profile = npcId ? getNpcRelationProfile(npcId) : null;
  const persona = profile?.playerVisible;
  const sys = persona
    ? `${POLISH_SYSTEM_PROMPT}\n对话对象：${persona.persona}，在意：${persona.caresAbout}。润色要贴合此角色语境。`
    : POLISH_SYSTEM_PROMPT;

  // 最近 4 轮对话历史作为上下文（serpent→user，npc→assistant）
  const historyMessages: ChatMessage[] = (dialogueHistory ?? [])
    .slice(-4)
    .map((m) => ({
      role: m.role === "serpent" ? "user" : "assistant",
      content: m.text,
    }));

  const messages: ChatMessage[] = [
    { role: "system", content: sys },
    ...historyMessages,
    { role: "user", content: source },
  ];

  try {
    // 不回退到 mock：真实 provider 不可用 / 请求失败时，保持原文并提示
    const result = await callLLM(messages, {
      temperature: 0.7,
      maxTokens: 120,
      fallbackToMock: false,
    });

    if (!result.ok || !result.data?.content) {
      // 调用失败：返回原文，前端提示「风打断了低语」
      return Response.json({ ok: false, polished: source });
    }

    const polished = clampToFifty(result.data.content);
    if (!polished) {
      return Response.json({ ok: false, polished: source });
    }
    // 透出 token 统计（mock / 无 usage 时为 null）
    const tokens = result.data?.usage?.total_tokens ?? null;
    return Response.json({ ok: true, polished, tokens });
  } catch {
    return Response.json({ ok: false, polished: source });
  }
}
