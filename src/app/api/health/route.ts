// GET /api/health — 安全运行状态端点
// 不返回 Key、Base URL、模型配置、请求内容或用户数据

export const dynamic = "force-dynamic";

export async function GET() {
  const provider = process.env.LLM_PROVIDER ?? "mock";
  const hasKey =
    !!process.env.VOLCENGINE_API_KEY ||
    !!process.env.DEEPSEEK_API_KEY;

  return Response.json({
    ok: true,
    version: "0.1.0",
    chapter: "chapter1_garden_voices",
    provider: provider === "mock" ? "mock" : "configured",
    hasProviderKey: hasKey,
    timestamp: Date.now(),
  });
}
