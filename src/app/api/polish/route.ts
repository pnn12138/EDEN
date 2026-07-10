// ============================================================
// 第一章：低语润色 API
//
// 职责：将玩家输入框中的文本润色为伊甸园中蛇的低语风格。
// 仅做文本变换，不触碰任何游戏状态。
// 复用统一 LLM 入口（服务端调用，不暴露密钥）。
// ============================================================

import { callLLM } from "@/services/llm/client";
import type { ChatMessage } from "@/services/llm/types";

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

export async function POST(req: Request): Promise<Response> {
  let text = "";
  try {
    const body = (await req.json()) as { text?: unknown };
    if (typeof body.text === "string") text = body.text;
  } catch {
    return Response.json({ ok: false, polished: "" }, { status: 400 });
  }

  const source = text.trim();
  if (!source) {
    return Response.json({ ok: false, polished: "" });
  }

  const messages: ChatMessage[] = [
    { role: "system", content: POLISH_SYSTEM_PROMPT },
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
    return Response.json({ ok: true, polished });
  } catch {
    return Response.json({ ok: false, polished: source });
  }
}
