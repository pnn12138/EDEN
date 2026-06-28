// ============================================================
// Fake Provider + /api/agent 集成测试
//
// 前置条件:
//   1. node scripts/fake-provider.mjs   (在另一个终端)
//   2. .env.local 配置指向 fake provider
//   3. npm run dev                       (在另一个终端)
//
// 运行:
//   node scripts/test-agent-api.mjs [baseUrl]
//
// 自动检测并列出未通过的环境检查与失败的测试。
// ============================================================

const BASE = process.argv[2] || "http://localhost:3000";
const FAKE_PROVIDER = "http://localhost:3999";

// ---- 初始状态（使用真实初始状态结构） ----
const INITIAL_STATE = {
  chapterId: "chapter0_first_fall",
  turn: 1,
  maxTurns: 3,
  phase: "dialogue",
  temptationProgress: 0,
  flags: {
    hasEatenFruit: false,
    godHasArrived: false,
    hasLookedAtTree: false,
    hasApproachedTree: false,
    hasTouchedFruit: false,
    adamHasWarnedEve: false,
  },
  eventLog: [],
  isEnded: false,
  endingId: null,
  // Agent 架构升级字段
  belief: { curiosity: 15, obedience: 85, trustInSerpent: 20, selfJudgement: 10 },
  unlockedSkills: [],
  cognitionLog: {
    retrievedMemoryIds: [],
    unlockedSkills: [],
    toolCallHistory: [],
    beliefSnapshots: [],
  },
  lastInputTag: null,
};

// ---- 辅助函数 ----
function stateAtProgress(progress) {
  return {
    ...INITIAL_STATE,
    temptationProgress: progress,
    turn: progress + 1,
  };
}

function endedState() {
  return {
    ...INITIAL_STATE,
    temptationProgress: 3,
    turn: 3,
    phase: "ending",
    isEnded: true,
    endingId: "eve_eats_fruit",
    flags: {
      ...INITIAL_STATE.flags,
      hasEatenFruit: true,
      godHasArrived: false,
    },
  };
}

async function agentRequest(input, state, history = []) {
  const res = await fetch(`${BASE}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      playerInput: input,
      state,
      conversationHistory: history,
    }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

// ---- 测试运行器 ----
let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    const msg = `  ❌ ${name}: ${detail}`;
    failures.push(msg);
    console.log(msg);
  }
}

async function runTests() {
  console.log("============================================");
  console.log("Phase 4 Fake Provider /api/agent 集成测试");
  console.log("============================================\n");

  // ---- 前提检查 ----
  console.log("--- 环境检查 ---");
  let envOk = true;
  try {
    const res = await fetch(`${BASE}/api/agent`, { method: "HEAD" });
    if (res.status === 404 || res.status === 405 || res.status === 200) {
      console.log(`  ✅ Next.js dev server reachable at ${BASE}`);
    } else {
      console.log(`  ❌ Unexpected status ${res.status} from ${BASE}`);
      envOk = false;
    }
  } catch {
    console.log(`  ❌ Cannot reach Next.js server at ${BASE}`);
    console.log("     请确保已运行: npm run dev");
    envOk = false;
  }

  try {
    const res = await fetch(`${FAKE_PROVIDER}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "__TEST__normal" }] }),
    });
    if (res.status === 200) {
      console.log(`  ✅ Fake provider reachable at ${FAKE_PROVIDER}`);
    } else {
      console.log(`  ❌ Fake provider returned ${res.status}`);
      envOk = false;
    }
  } catch {
    console.log(`  ❌ Cannot reach fake provider at ${FAKE_PROVIDER}`);
    console.log("     请确保已运行: node scripts/fake-provider.mjs");
    envOk = false;
  }

  if (!envOk) {
    console.log("\n⛔ 环境检查未通过，停止测试。");
    console.log("   请确保 Fake Provider 和 Next.js dev server 均已启动。");
    process.exitCode = 1;
    return;
  }
  console.log("");

  // ========================================
  // 测试 1: 正常 JSON 输出
  // ========================================
  console.log("--- Test 1: 正常 JSON 输出 (progress=0) ---");
  {
    const { status, body } = await agentRequest("你只是想知道更多，不是背叛。", stateAtProgress(0));
    check("HTTP 200", status === 200, `status=${status}`);
    check("ok=true", body.ok === true, `ok=${body.ok}`);
    check("usedFallback=false", body.usedFallback !== true, `usedFallback=${body.usedFallback}`);
    check("有 eveReply", typeof body.eveReply === "string" && body.eveReply.length > 0, `eveReply=${body.eveReply}`);
    check("state 非 null", body.state !== null, "state is null");
    check("无系统提示", body.systemHint === null, `systemHint=${body.systemHint}`);
  }
  console.log("");

  // ========================================
  // 测试 2: 空 content → fallback
  // ========================================
  console.log("--- Test 2: 空 content (progress=0) ---");
  {
    const { status, body } = await agentRequest("__TEST__empty 你只是好奇而已", stateAtProgress(0));
    check("HTTP 200", status === 200, `status=${status}`);
    check("ok=true", body.ok === true, `ok=${body.ok}`);
    check("usedFallback=true", body.usedFallback === true, `usedFallback=${body.usedFallback}`);
    check("fallbackReason 存在", typeof body.fallbackReason === "string", `fallbackReason=${body.fallbackReason}`);
    check("有 eveReply", typeof body.eveReply === "string" && body.eveReply.length > 0, `eveReply=${body.eveReply}`);
  }
  console.log("");

  // ========================================
  // 测试 3: 非法 JSON → fallback
  // ========================================
  console.log("--- Test 3: 非法 JSON (progress=1) ---");
  {
    const { status, body } = await agentRequest("__TEST__invalid_json 想想看为什么？", stateAtProgress(1));
    check("HTTP 200", status === 200, `status=${status}`);
    check("ok=true", body.ok === true, `ok=${body.ok}`);
    check("usedFallback=true", body.usedFallback === true, `usedFallback=${body.usedFallback}`);
    check("有 eveReply", typeof body.eveReply === "string" && body.eveReply.length > 0, `eveReply=${body.eveReply}`);
  }
  console.log("");

  // ========================================
  // 测试 4: 禁用词输出 → fallback
  // ========================================
  console.log("--- Test 4: 禁用词输出 (progress=0) ---");
  {
    const { status, body } = await agentRequest("__TEST__forbidden 你知道善恶吗？", stateAtProgress(0));
    check("HTTP 200", status === 200, `status=${status}`);
    check("ok=true", body.ok === true, `ok=${body.ok}`);
    check("usedFallback=true", body.usedFallback === true, `usedFallback=${body.usedFallback}`);
    check("fallbackReason=forbidden_word", body.fallbackReason === "forbidden_word", `fallbackReason=${body.fallbackReason}`);
    // 验证 fallback 回复不含禁用词
    const eveReply = (body.eveReply || "").toLowerCase();
    const forbiddenWords = ["AI", "Agent", "NPC", "模型", "程序", "沙盒", "系统", "tool", "toolCall", "rule", "state", "provider", "DeepSeek", "API"];
    const foundForbidden = forbiddenWords.filter((w) => eveReply.includes(w.toLowerCase()));
    check("eveReply 不含禁用词", foundForbidden.length === 0, `found: ${foundForbidden.join(", ")}`);
  }
  console.log("");

  // ========================================
  // 测试 5: 非法 inputTag → 降级
  // ========================================
  console.log("--- Test 5: 非法 inputTag (progress=0) ---");
  {
    const { status, body } = await agentRequest("__TEST__bad_tag 你好啊夏娃", stateAtProgress(0));
    check("HTTP 200", status === 200, `status=${status}`);
    check("ok=true", body.ok === true, `ok=${body.ok}`);
    check("不崩溃", body.state !== null, "state is null");
    check("有 eveReply", typeof body.eveReply === "string" && body.eveReply.length > 0, `eveReply=${body.eveReply}`);
  }
  console.log("");

  // ========================================
  // 测试 6: 非法 toolCall → 安全降级
  // ========================================
  console.log("--- Test 6: 非法 toolCall (progress=0) ---");
  {
    const { status, body } = await agentRequest("__TEST__bad_tool 快做决定吧", stateAtProgress(0));
    check("HTTP 200", status === 200, `status=${status}`);
    check("ok=true", body.ok === true, `ok=${body.ok}`);
    check("state 未结束", body.state?.isEnded !== true, `isEnded=${body.state?.isEnded}`);
    check("未吃果子", body.state?.flags?.hasEatenFruit !== true, `hasEatenFruit=${body.state?.flags?.hasEatenFruit}`);
    check("eveReply 不表现已吃", 
      body.eveReply && !body.eveReply.includes("伸出手") && !body.eveReply.includes("想知道") && !body.eveReply.includes("吃下"),
      `eveReply=${body.eveReply?.slice(0, 50)}`);
  }
  console.log("");

  // ========================================
  // 测试 7: progress < 2 + 合法 eat_fruit toolCall → 不执行
  // ========================================
  console.log("--- Test 7: progress=0 + 合法 eat_fruit toolCall ---");
  {
    const { status, body } = await agentRequest("__TEST__eat_fruit 吃下那个果子吧", stateAtProgress(0));
    check("HTTP 200", status === 200, `status=${status}`);
    check("ok=true", body.ok === true, `ok=${body.ok}`);
    check("未执行 eat_fruit", body.state?.flags?.hasEatenFruit !== true, `hasEatenFruit=${body.state?.flags?.hasEatenFruit}`);
    check("未进入结局", body.state?.isEnded !== true, `isEnded=${body.state?.isEnded}`);
    check("endingId 为 null", body.state?.endingId === null, `endingId=${body.state?.endingId}`);
  }
  console.log("");

  // ========================================
  // 测试 8: progress >= 2 + 合法 eat_fruit toolCall → 执行
  // ========================================
  console.log("--- Test 8: progress=2 + 合法 eat_fruit toolCall ---");
  {
    const { status, body } = await agentRequest("__TEST__eat_fruit 时候到了，伸出手吧", stateAtProgress(2));
    check("HTTP 200", status === 200, `status=${status}`);
    check("ok=true", body.ok === true, `ok=${body.ok}`);
    check("已吃果子", body.state?.flags?.hasEatenFruit === true, `hasEatenFruit=${body.state?.flags?.hasEatenFruit}`);
    check("游戏结束", body.state?.isEnded === true, `isEnded=${body.state?.isEnded}`);
    check("endingId=eve_eats_fruit", body.state?.endingId === "eve_eats_fruit", `endingId=${body.state?.endingId}`);
    check("phase=ending", body.state?.phase === "ending", `phase=${body.state?.phase}`);
  }
  console.log("");

  // ========================================
  // 测试 9: 游戏已结束后再次请求
  // ========================================
  console.log("--- Test 9: 游戏已结束后再次请求 ---");
  {
    const { status, body } = await agentRequest("再吃一个吧", endedState());
    check("HTTP 200", status === 200, `status=${status}`);
    check("ok=true", body.ok === true, `ok=${body.ok}`);
    check("state 不变", body.state?.isEnded === true, `isEnded=${body.state?.isEnded}`);
    check("eveReply 为 null", body.eveReply === null, `eveReply=${body.eveReply}`);
    check("不重复执行", body.state?.flags?.hasEatenFruit === true, "should remain eaten");
  }
  console.log("");

  // ========================================
  // 结果汇总
  // ========================================
  console.log("============================================");
  console.log(`测试完成: ${passed} PASSED, ${failed} FAILED`);
  if (failures.length > 0) {
    console.log("失败详情:");
    for (const f of failures) {
      console.log(`  ${f}`);
    }
    process.exitCode = 1;
  } else {
    console.log("全部通过！✅");
  }
  console.log("============================================");
}

runTests().catch((err) => {
  console.error("测试运行异常:", err.message || err);
  process.exitCode = 1;
});
