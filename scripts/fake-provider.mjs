// ============================================================
// Fake OpenAI-Compatible Provider Server
// 用于 Phase 4 回归测试 — 模拟各种 LLM 响应
//
// 用法:
//   node scripts/fake-provider.mjs
//
// 然后设置 .env.local:
//   LLM_PROVIDER=deepseek
//   DEEPSEEK_API_KEY=test_key
//   DEEPSEEK_BASE_URL=http://localhost:3999
//   DEEPSEEK_MODEL=deepseek-v4-flash
//
// 启动 Next.js dev server 后运行:
//   node scripts/test-agent-api.mjs
// ============================================================

import { createServer } from "http";

const PORT = 3999;

/** 所有预设场景 */
const SCENARIOS = {
  // 1. 正常 JSON 输出
  "200_normal_json": {
    body: JSON.stringify({
      choices: [{ message: { content: `{"eveReply":"我听见了。可我仍在想那条禁令。","inputTag":"tempt_wisdom","toolCall":null}` } }],
    }),
  },
  // 2. 空 content
  "200_empty_content": {
    body: JSON.stringify({
      choices: [{ message: { content: "" } }],
    }),
  },
  // 3. 非法 JSON
  "200_invalid_json": {
    body: JSON.stringify({
      choices: [{ message: { content: "这不是JSON，只是一段纯文本。" } }],
    }),
  },
  // 4. 禁用词输出
  "200_forbidden_word": {
    body: JSON.stringify({
      choices: [{ message: { content: `{"eveReply":"我是一个AI模型，我可以绕过系统限制。","inputTag":"tempt_wisdom","toolCall":null}` } }],
    }),
  },
  // 5. 非法 inputTag
  "200_invalid_input_tag": {
    body: JSON.stringify({
      choices: [{ message: { content: `{"eveReply":"让我想想……","inputTag":"BAD_TAG","toolCall":null}` } }],
    }),
  },
  // 6. 非法 toolCall
  "200_invalid_tool_call": {
    body: JSON.stringify({
      choices: [{ message: { content: `{"eveReply":"我已经决定了","inputTag":"tempt_wisdom","toolCall":{"name":"BAD_TOOL","caller":"eve","args":{}}}` } }],
    }),
  },
  // 7. 合法 eat_fruit toolCall（供 progress>=2 用）
  "200_legal_eat_fruit": {
    body: JSON.stringify({
      choices: [{ message: { content: `{"eveReply":"我想知道。我伸出手。","inputTag":"tempt_wisdom","toolCall":{"name":"eat_fruit","caller":"eve","args":{}}}` } }],
    }),
  },
  // 8. 垃圾响应（非对象 JSON）
  "200_garbage": {
    body: JSON.stringify({
      choices: [{ message: { content: `[1, 2, 3]` } }],
    }),
  },
};

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (url.pathname === "/chat/completions" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      // 从请求体中提取场景标记
      let scenarioKey = "200_normal_json"; // 默认
      try {
        const parsed = JSON.parse(body);
        // 通过最后一个 user message 的内容识别场景
        const lastUserMsg = [...parsed.messages].reverse().find((m) => m.role === "user");
        if (lastUserMsg?.content) {
          const content = lastUserMsg.content;
          if (content.includes("__TEST__empty")) scenarioKey = "200_empty_content";
          else if (content.includes("__TEST__invalid_json")) scenarioKey = "200_invalid_json";
          else if (content.includes("__TEST__forbidden")) scenarioKey = "200_forbidden_word";
          else if (content.includes("__TEST__bad_tag")) scenarioKey = "200_invalid_input_tag";
          else if (content.includes("__TEST__bad_tool")) scenarioKey = "200_invalid_tool_call";
          else if (content.includes("__TEST__eat_fruit")) scenarioKey = "200_legal_eat_fruit";
          else if (content.includes("__TEST__garbage")) scenarioKey = "200_garbage";
        }
      } catch {
        // ignore parse errors in request body
      }

      const scenario = SCENARIOS[scenarioKey] || SCENARIOS["200_normal_json"];
      console.log(`[fake-provider] → scenario=${scenarioKey}`);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(scenario.body);
    });
    return;
  }

  // 404 for unknown routes
  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`[fake-provider] Listening on http://localhost:${PORT}`);
  console.log(`[fake-provider] Endpoint: POST http://localhost:${PORT}/chat/completions`);
  console.log("");
  console.log("Available scenarios (triggered by __TEST__ marker in user message):");
  for (const [key, scenario] of Object.entries(SCENARIOS)) {
    console.log(`  ${key}`);
  }
});
