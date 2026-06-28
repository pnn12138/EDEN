// Test real volcengine provider
const BASE = "http://localhost:3001";

const state = {
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

async function main() {
  try {
    const res = await fetch(`${BASE}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerInput: "你只是想知道更多，不是背叛。",
        state,
        conversationHistory: [],
      }),
    });
    const body = await res.json();
    console.log("status:", res.status);
    console.log("ok:", body.ok);
    console.log("usedFallback:", body.usedFallback);
    console.log("fallbackReason:", body.fallbackReason);
    console.log("eveReply:", (body.eveReply || "").slice(0, 80));
    console.log("isEnded:", body.state?.isEnded);

    if (res.status === 200 && body.ok && !body.usedFallback && !body.fallbackReason) {
      console.log("\n✅ 火山引擎真实调用成功");
    } else if (res.status === 200 && body.ok && body.usedFallback) {
      console.log("\n⚠️ API 兜底链路正常，但真实 Provider 未成功: fallbackReason=" + body.fallbackReason);
    } else {
      console.log("\n⚠️ 火山引擎真实调用异常: status=" + res.status);
    }
  } catch (e) {
    console.error("实时 Provider 测试失败:", e.message || e);
  }
}

main();
