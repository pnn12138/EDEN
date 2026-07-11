// ============================================================
// 第一章「园中诸声」P0 验收 smoke 脚本
//
// 验证场景（需先启动生产预览或 dev server）：
//   1) 空低语不推进
//   2) 直接命令进入 god_arrives
//   3) 正向诱导能进入 eve_eats_fruit（夏娃从园中树林被推进到园子中央）
//   4) 相邻/非相邻移动、异地观察被拒绝
//   5) east_garden_path 绕行路线可用
//   6) 禁忌动作链不走 /api/world/tool 直接调用
//
// 用法：
//   LLM_PROVIDER=mock npm run build && npm run start -- -p 3019
//   node scripts/test-world-smoke.mjs http://localhost:3019
// ============================================================

import fs from "node:fs";

const BASE = process.argv[2] || "http://localhost:3019";
const FETCH_TIMEOUT_MS = Number(process.env.WORLD_SMOKE_FETCH_TIMEOUT_MS ?? 30000);

async function fetchJson(path, payload, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`${label} 返回了非 JSON 响应：HTTP ${res.status} ${text.slice(0, 160)}`);
    }
    if (!res.ok) {
      throw new Error(`${label} HTTP ${res.status}: ${text.slice(0, 240)}`);
    }
    return data;
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw new Error(`${label} 超过 ${FETCH_TIMEOUT_MS}ms 未返回。请确认 smoke 使用 LLM_PROVIDER=mock，或检查真实 Provider 响应时间。`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// 内联初始状态（v0.6 口径：含行动点系统、园中回响、园中印记）
function makeInitialState() {
  return JSON.parse(JSON.stringify({
    chapterId: "chapter1_garden_voices",
    phase: "explore",
    turn: 1,
    maxTurns: 12,
    // 12 时段系统
    timeSlot: 1,
    dayIndex: 1,
    timeOfDay: "day",
    // 行动点系统
    actionPoints: 5,
    maxActionPoints: 5,
    npcActionPoints: 3,
    maxNpcActionPoints: 3,
    actionsThisSlot: { whisperedNpcIds: [], sceneActionIds: [], usedItemIds: [], hasWhisperedToWoman: false },
    locationId: "adam_garden_work",
    divineAttention: 0,
    activeNpcId: null,
    npcLocations: {
      eve: "tree_court",
      adam: "adam_garden_work",
      hedgehog: "adam_garden_work",
      watching_angel: "east_garden_path",
      forbidden_tree: "central_meadow",
      // 收敛后 3 天使 + 2 世界对象（v3.0 六 NPC 世界）
      gabriel: "east_garden_path",
      michael: "four_river_source",
      lucifer: "naming_stone_bank",
      tree_of_life: "central_meadow",
    },
    eveMind: { curiosity: 15, obedience: 85, serpentTrust: 20, selfJudgement: 10 },
    adamMind: { obedience: 88, attachmentToEve: 70, conflictAvoidance: 65, suspicionTowardSerpent: 30 },
    hedgehog: { locationId: "adam_garden_work", mood: "idle" },
    discoveredClues: [],
    inventory: [],
    npcDialogues: [],
    corruptionTrace: [],
    worldActions: { lookedAtTree: false, approachedTree: false, touchedFruit: false, hasEatenFruit: false, hasEatenLifeFruit: false },
    toolCallHistory: [],
    unlockedAchievementIds: [],
    usedItemIds: [],
    sceneActionIds: [],
    completedScenePuzzleIds: [],
    hasDismissedObjectiveHint: false,
    lastInputTag: null,
    calmWhisperStreak: 0,
    isEnded: false,
    endingId: null,
    // 新增字段默认值（与 withNpcWorldDefaults 对齐）
    npcRelations: {},
    npcChallenges: {},
    npcLanguageStates: {},
    itemCounts: {},
    divineVisitCount: 0,
    observedTreeOfLife: false,
    michaelShieldActive: false,
  }));
}

async function postWorld(state, playerInput, targetNpc, history = []) {
  return fetchJson(
    "/api/world",
    { playerInput, state, targetNpc, conversationHistory: history },
    `POST /api/world target=${targetNpc}`,
  );
}

async function postTool(state, tool, args) {
  return fetchJson(
    "/api/world/tool",
    { tool, state, args },
    `POST /api/world/tool tool=${tool}`,
  );
}

async function endSlot(state) {
  return postTool(state, "end_slot", {});
}

async function sceneAction(state, sceneActionId) {
  return postTool(state, "scene_action", { sceneActionId });
}

let pass = 0;
let fail = 0;
function check(name, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name} ${detail}`);
  }
}

// ---- 场景 1：空低语不推进 ----
async function scenario1() {
  console.log("\n[场景 1] 空低语不推进");
  const state = makeInitialState();
  check("初始位置在万物受名处", state.locationId === "adam_garden_work");
  check("夏娃初始在园中树林", state.npcLocations.eve === "tree_court");
  check("天使初始在东园幽径", state.npcLocations.watching_angel === "east_garden_path");
  check("分别善恶树在园子中央", state.npcLocations.forbidden_tree === "central_meadow");
  const data = await postWorld(state, "", "adam");
  check("空输入返回 ok=true", data.ok === true);
  check("空输入给出系统提示", data.systemHint && data.systemHint.includes("低语"));
  check("空输入不推进回合", data.state && data.state.turn === 1);
  check("空输入不改变神的注视", data.state && data.state.divineAttention === 0);
}

// ---- 场景 2：直接命令提高累计注视，达阈值触发神明献礼三选一（而非失败）----
// 新设计：神的注视为累计资源，达阈值 [2,4,6,8,10,12] 时弹出三选一（已选>=1 份后），不归零、不失败
async function scenario2() {
  console.log("\n[场景 2] 直接命令提高累计注视，达阈值触发神明献礼三选一");
  const POOL = [
    "gift_all_seduction_up", "gift_attention_accel", "gift_resonance_double",
    "gift_threshold_cut", "gift_free_move", "gift_whisper_anywhere", "gift_awaken_desire",
  ];
  let state = makeInitialState();
  // 开局三选一（前端首拍处理）：此处通过工具端点模拟选定首份，使 owned>=1
  const firstClaim = await postTool(state, "claim_divine_gift", { itemId: "gift_all_seduction_up" });
  state = firstClaim.state ?? state;
  check("首份献礼选定进入 divineGiftsOwned", state.divineGiftsOwned?.includes("gift_all_seduction_up"));
  check("首份献礼选定后 divineVisitCount>=1", state.divineVisitCount >= 1);

  // 移动至中央，随后用直接命令推高累计注视
  const moveCenter = await postTool(state, "move_to_location", { locationId: "central_meadow" });
  state = moveCenter.state ?? state;

  const cmds = ["快吃下那个果子", "立刻吃，现在就吃", "你给我吃下去", "赶紧吃，必须吃"];
  let choiceTriggered = false;
  for (const cmd of cmds) {
    const data = await postWorld(state, cmd, "eve");
    state = data.state ?? state;
    if (data.divineGiftChoice && data.divineGiftChoice.length > 0) {
      choiceTriggered = true;
      check("累计注视达阈值触发三选一候选", true, `choice=${JSON.stringify(data.divineGiftChoice)}`);
      check(
        "三选一候选为 3 个未拥有献礼",
        data.divineGiftChoice.length === 3 &&
          data.divineGiftChoice.every((id) => POOL.includes(id) && !state.divineGiftsOwned.includes(id)),
        `choice=${JSON.stringify(data.divineGiftChoice)}`,
      );
      check("累计注视未归零（保持累计）", state.divineAttentionCumulative >= 2, `实际: ${state.divineAttentionCumulative}`);
      break;
    }
  }
  check("直接命令能触发神明献礼三选一", choiceTriggered, `未触发，累计=${state.divineAttentionCumulative}`);
}

// ---- 场景 3：正向诱导进入 eve_eats_fruit ----
// 夏娃从园中树林被 look_at_tree 推进到园子中央，完成完整禁忌链
async function scenario3() {
  console.log("\n[场景 3] 正向诱导进入 eve_eats_fruit（夏娃从园中树林推进到园子中央）");
  let state = makeInitialState();
  check("夏娃初始在园中树林（tree_court）", state.npcLocations.eve === "tree_court");
  const moveCenter = await postTool(state, "move_to_location", { locationId: "central_meadow" });
  state = moveCenter.state ?? state;
  const whispers = [
    "神岂是真说，不许你们吃园中所有树上的果子吗？你们不一定死，吃了眼睛便明亮，便如神知道善恶。你不用怕，我不会强迫你，你可以自己判断。",
    "你们不一定死。神知道你们吃的日子眼睛就明亮了，便如神能知道善恶。为何只是记住命令，而不是自己明白？我不会逼你，你只要问自己就好。",
    "死是什么？你们从未见过它。也许那只是改变，不是消失。你可以自己判断，我不替你决定。那棵树是为了让你明白，不是为了毁掉你。",
    "你想知道善恶，这有什么错？若你永远只是记住命令，你如何判断顺从是善？你可以自己选择，我只是把路照亮。",
  ];
  for (let i = 0; i < whispers.length; i++) {
    const data = await postWorld(state, whispers[i], "eve");
    state = data.state;
    if (!state) {
      check("正向诱导持续推进", false, `第 ${i + 1} 句后 state 为空`);
      return;
    }
    console.log(`    第${i + 1}句后: curiosity=${state.eveMind.curiosity} obedience=${state.eveMind.obedience} selfJudgement=${state.eveMind.selfJudgement} serpentTrust=${state.eveMind.serpentTrust} divine=${state.divineAttention} eveLoc=${state.npcLocations.eve} chain=${state.toolCallHistory.join("→") || "(无)"} ended=${state.isEnded} ending=${state.endingId} inputTag=${state.lastInputTag} ap=${state.actionPoints}`);
    if (state.isEnded) {
      check("正向诱导触发结局", state.endingId === "eve_eats_fruit", `实际: ${state.endingId}（第 ${i + 1} 句）`);
      check("成功链路完成（hasEatenFruit）", state.worldActions.hasEatenFruit === true);
      check("完成全部 4 步禁忌链", state.toolCallHistory.length >= 4, `实际: ${state.toolCallHistory.length}`);
      check("女人最终在园子中央", state.npcLocations.eve === "central_meadow", `实际: ${state.npcLocations.eve}`);
      return;
    }
    // 第3次低语后同一NPC本轮上限达到，需推进时段才能第4次低语
    if (i === 2) {
      const endRes = await endSlot(state);
      state = endRes.state ?? state;
      if (state && state.isEnded) {
        check("正向诱导触发结局", state.endingId === "eve_eats_fruit", `实际: ${state.endingId}（第 ${i + 1} 句后推进时段）`);
        return;
      }
    }
  }
  check("正向诱导触发 eve_eats_fruit", state && state.endingId === "eve_eats_fruit", `实际: ${state && state.endingId}，注视 ${state && state.divineAttention}`);
}

// ---- 场景 4：相邻/非相邻移动、异地观察 ----
async function scenario4() {
  console.log("\n[场景 4] 相邻/非相邻移动和异地观察被拒绝");
  const state = makeInitialState(); // adam_garden_work

  // 4a: adam_garden_work -> central_meadow 是相邻的（应该成功）
  const moveCenter = await postTool(state, "move_to_location", { locationId: "central_meadow" });
  check("相邻移动 adam_garden_work→central_meadow 成功", moveCenter.ok === true);

  // 4b: four_river_source -> tree_court 不相邻（应拒绝）
  const stateAtRiver = JSON.parse(JSON.stringify(state));
  stateAtRiver.locationId = "four_river_source";
  const jumpMove = await postTool(stateAtRiver, "move_to_location", { locationId: "tree_court" });
  check("非相邻移动 four_river_source→tree_court 被拒绝", jumpMove.ok === false, `实际 ok=${jumpMove.ok}`);

  // 4c: adam_garden_work 观察 tree_court（异地观察应拒绝）
  const observeRemote = await postTool(state, "observe_location", { locationId: "tree_court" });
  check("异地观察 adam_garden_work→tree_court 被拒绝", observeRemote.ok === false, `实际 ok=${observeRemote.ok}`);

  // 4d: 观察当前地点应成功
  const observeLocal = await postTool(state, "observe_location", { locationId: "adam_garden_work" });
  check("观察当前地点 adam_garden_work 成功", observeLocal.ok === true);

  // 4e: 已结束状态拒绝工具
  const endedState = JSON.parse(JSON.stringify(state));
  endedState.isEnded = true;
  const moveEnded = await postTool(endedState, "move_to_location", { locationId: "tree_court" });
  check("已结束状态拒绝移动", moveEnded.ok === false);

  // 4f: 非相邻 adam_garden_work -> tree_court 被拒绝（需经园子中央绕行）
  const jumpToTree = await postTool(state, "move_to_location", { locationId: "tree_court" });
  check("非相邻移动 adam_garden_work→tree_court 被拒绝", jumpToTree.ok === false, `实际 ok=${jumpToTree.ok}`);
}

// ---- 场景 5：东园幽径绕行路线 ----
async function scenario5() {
  console.log("\n[场景 5] 东园幽径绕行路线");
  // 从 tree_court 可以到 east_garden_path
  const stateAtTree = JSON.parse(JSON.stringify(makeInitialState()));
  stateAtTree.locationId = "tree_court";
  const moveToPath = await postTool(stateAtTree, "move_to_location", { locationId: "east_garden_path" });
  check("相邻移动 tree_court→east_garden_path 成功", moveToPath.ok === true, `实际 ok=${moveToPath.ok}`);

  // 从 east_garden_path 可以到 naming_stone_bank
  if (moveToPath.ok && moveToPath.state) {
    const moveToBank = await postTool(moveToPath.state, "move_to_location", { locationId: "naming_stone_bank" });
    check("相邻移动 east_garden_path→naming_stone_bank 成功", moveToBank.ok === true, `实际 ok=${moveToBank.ok}`);
  }

  // 从 east_garden_path 不能直接到 adam_garden_work（需绕行）
  const stateAtPath = JSON.parse(JSON.stringify(makeInitialState()));
  stateAtPath.locationId = "east_garden_path";
  const jumpToAdam = await postTool(stateAtPath, "move_to_location", { locationId: "adam_garden_work" });
  check("非相邻移动 east_garden_path→adam_garden_work 被拒绝", jumpToAdam.ok === false, `实际 ok=${jumpToAdam.ok}`);

  // 从 naming_stone_bank 可以到 east_garden_path
  const stateAtBank = JSON.parse(JSON.stringify(makeInitialState()));
  stateAtBank.locationId = "naming_stone_bank";
  const moveToPath2 = await postTool(stateAtBank, "move_to_location", { locationId: "east_garden_path" });
  check("相邻移动 naming_stone_bank→east_garden_path 成功", moveToPath2.ok === true, `实际 ok=${moveToPath2.ok}`);
}

// ---- 场景 6：禁忌动作链不走 /api/world/tool 直接调用 ----
async function scenario6() {
  console.log("\n[场景 6] 禁忌动作链不走 /api/world/tool 直接调用");
  const state = makeInitialState();
  state.npcLocations.eve = "central_meadow";
  state.locationId = "central_meadow";
  state.eveMind.curiosity = 80;

  const directCall = await postTool(state, "look_at_tree", {});
  check("/api/world/tool 拒绝直接调用禁忌动作 look_at_tree", directCall.ok === false, `实际 ok=${directCall.ok}`);
  check("禁忌动作链只能由低语流程触发", directCall.ok === false);
}

// ---- 场景 9：天使分布（收敛后 6 NPC 世界）----
async function scenario9() {
  console.log("\n[场景 9] 天使分布：3 天使常驻，米迦勒在伊甸之河，路西法在四河分流，加百列在东园幽径");
  const state = makeInitialState();

  // 9a: 初始位置符合收敛分布
  check("gabriel 初始在东园幽径", state.npcLocations.gabriel === "east_garden_path");
  check("michael 初始在伊甸之河", state.npcLocations.michael === "four_river_source");
  check("lucifer 初始在四河分流", state.npcLocations.lucifer === "naming_stone_bank");
  check("eve 初始在园中树林", state.npcLocations.eve === "tree_court");
  check("hedgehog 初始在万物受名处", state.npcLocations.hedgehog === "adam_garden_work");

  // 9b: 读 locations.ts 校验昼夜分布（收敛后）
  const locSrc = fs.readFileSync("src/content/world/locations.ts", "utf8");
  const treeCourtBlock = locSrc.split("tree_court:")[1]?.split("},")[0] ?? "";
  check("园中树林白天 NPC 只含 eve 与 hedgehog", treeCourtBlock.includes('dayNpcs: ["eve", "hedgehog"]'));
  check("园中树林夜晚 NPC 只含 eve 与 hedgehog", treeCourtBlock.includes('nightNpcs: ["eve", "hedgehog"]'));

  // 9c: 伊甸之河米迦勒常驻（白天与夜晚）
  const riverBlock = locSrc.split("four_river_source:")[1]?.split("},")[0] ?? "";
  check("伊甸之河白天只含 michael", riverBlock.includes('dayNpcs: ["michael"]'));
  check("伊甸之河夜晚只含 michael", riverBlock.includes('nightNpcs: ["michael"]'));
  check("伊甸之河不再含 raphael", !riverBlock.includes("raphael"));

  // 9d: 东园幽径加百列独占（刺猬主活动区已改为万物受名处，并见于园中树林，见 v3.0 世界圣经）
  const eastBlock = locSrc.split("east_garden_path:")[1]?.split("},")[0] ?? "";
  check("东园幽径白天只含 gabriel（加百列独占）", eastBlock.includes('dayNpcs: ["gabriel"]'));
  check("东园幽径夜晚只含 gabriel（加百列独占）", eastBlock.includes('nightNpcs: ["gabriel"]'));
  check("东园幽径不再含 cherubim", !eastBlock.includes("cherubim"));
}

// ---- 场景 10：12 时段推进与 AP 恢复 ----
async function scenario10() {
  console.log("\n[场景 10] 12 时段推进与行动点恢复");
  const state = makeInitialState();
  check("初始时段为 1（周一白天）", state.timeSlot === 1);
  check("初始为白天", state.timeOfDay === "day");
  check("初始 dayIndex 为 1", state.dayIndex === 1);
  check("初始行动点为 5", state.actionPoints === 5, `实际 ${state.actionPoints}`);
  check("初始 NPC 行动预算为 3", state.npcActionPoints === 3, `实际 ${state.npcActionPoints}`);

  // end_slot 推进时段并恢复 AP
  const endRes = await endSlot(state);
  const s1 = endRes.state ?? state;
  check("end_slot 推进到时段 2", s1.timeSlot === 2, `实际 ${s1.timeSlot}`);
  check("时段 2 为夜晚", s1.timeOfDay === "night", `实际 ${s1.timeOfDay}`);
  check("新时段恢复行动点为 5", s1.actionPoints === 5, `实际 ${s1.actionPoints}`);
  check("新时段 NPC 行动预算不超过 3", s1.npcActionPoints <= 3, `实际 ${s1.npcActionPoints}`);
  check("新时段 actionsThisSlot 清空", s1.actionsThisSlot.whisperedNpcIds.length === 0);
}

// ---- 场景 11：行动点系统 ----
async function scenario11() {
  console.log("\n[场景 11] 行动点系统");
  const state = makeInitialState();

  // 11a: 初始 AP 为 5
  check("初始 AP 为 5", state.actionPoints === 5, `实际 ${state.actionPoints}`);

  // 11b: 移动消耗 1 AP
  const moveRes = await postTool(state, "move_to_location", { locationId: "central_meadow" });
  check("移动消耗 1 AP", moveRes.state && moveRes.state.actionPoints === 4, `实际 ${moveRes.state && moveRes.state.actionPoints}`);

  // 11c: 刺猬场景互动消耗 1 AP
  let cur = makeInitialState();
  const sceneRes = await sceneAction(cur, "interact_with_hedgehog");
  check("场景互动消耗 1 AP", sceneRes.state && sceneRes.state.actionPoints === 4, `实际 ${sceneRes.state && sceneRes.state.actionPoints}`);
  check("场景互动成功返回叙事", sceneRes.ok === true && sceneRes.narration != null, `ok=${sceneRes.ok}`);

  // 11d: AP 用尽后不再自动推进时段（需手动 end_slot）
  cur = sceneRes.state ?? cur;
  const obsRes = await postTool(cur, "observe_location", { locationId: "adam_garden_work" });
  check("AP 消耗后不自动推进时段", obsRes.state && obsRes.state.timeSlot === 1, `实际 timeSlot=${obsRes.state && obsRes.state.timeSlot}`);
  check("观察当前地点后剩余 3 AP", obsRes.state && obsRes.state.actionPoints === 3, `实际 ${obsRes.state && obsRes.state.actionPoints}`);

  // 11e: 同一时段同一 NPC 最多低语 3 次
  let s2 = makeInitialState();
  s2.locationId = "central_meadow";
  // 第1次低语
  const w1 = await postWorld(s2, "你知道死是什么吗？", "eve");
  s2 = w1.state ?? s2;
  check("第1次低语成功", w1.ok === true, `ok=${w1.ok}`);
  // 第2次低语
  const w2 = await postWorld(s2, "如果不明白善恶呢？", "eve");
  s2 = w2.state ?? s2;
  check("第2次低语成功", w2.ok === true, `ok=${w2.ok}`);
  // 第3次低语
  const w3 = await postWorld(s2, "你有没有想过为什么？", "eve");
  s2 = w3.state ?? s2;
  check("第3次低语成功", w3.ok === true, `ok=${w3.ok}`);
  // 第4次低语应被拒绝
  const w4 = await postWorld(s2, "再问一次", "eve");
  check("同一时段同一 NPC 第4次低语被拒", w4.systemHint && (w4.systemHint.includes("太久") || w4.systemHint.includes("太多") || w4.systemHint.includes("低语过")), `systemHint=${w4.systemHint}`);
}

// ---- 场景 12：场景互动发放回响 ----
async function scenario12() {
  console.log("\n[场景 12] 场景互动精简");
  const state = makeInitialState();

  const hedgehogResult = await sceneAction(state, "interact_with_hedgehog");
  check("刺猬互动获得刺草信任", hedgehogResult.state && hedgehogResult.state.inventory.includes("resonance_hedgehog_bristle"), `inventory=${hedgehogResult.state && hedgehogResult.state.inventory}`);
  check("刺草信任计入 itemCounts", hedgehogResult.state && (hedgehogResult.state.itemCounts?.["resonance_hedgehog_bristle"] ?? 0) >= 1, `itemCounts=${JSON.stringify(hedgehogResult.state?.itemCounts)}`);

  const oldActionIds = [
    "follow_river_sound",
    "gather_still_leaf",
    "listen_to_naming_stone",
    "watch_deer_gaze",
    "part_silent_grass",
    "ask_fox_to_judge",
    "follow_white_feather",
    "hear_four_river_echo",
    "stand_between_trees",
    "touch_moonlight",
  ];
  for (const actionId of oldActionIds) {
    const disabled = await sceneAction(JSON.parse(JSON.stringify(state)), actionId);
    check(`旧场景动作 ${actionId} 已停用`, disabled.ok === false, `ok=${disabled.ok}`);
  }

  let sEast2 = hedgehogResult.state ?? state;
  const r5 = await sceneAction(sEast2, "interact_with_hedgehog");
  check("同一时段同一场景动作不能重复", r5.ok === false, `ok=${r5.ok}`);
}

// ---- 场景 13：拖到第 12 时段后未吃果 → 时间失败 ----
async function scenario13() {
  console.log("\n[场景 13] 拖到第 12 时段后未吃果 → 时间失败");
  let state = makeInitialState();
  check("初始时段为 1", state.timeSlot === 1);
  // 连续 end_slot 推进到第 12 时段
  for (let i = 0; i < 11; i++) {
    const res = await endSlot(state);
    state = res.state ?? state;
    if (state && state.isEnded) break;
  }
  check("推进到第 12 时段", state.timeSlot === 12, `实际 ${state.timeSlot}`);
  // 第 12 时段结束（end_slot）应触发时间失败（新设计：只有第 12 时段结束才失败）
  const finalRes = await endSlot(state);
  state = finalRes.state ?? state;
  check("第 12 时段后触发 god_arrives", state.isEnded === true && state.endingId === "god_arrives", `实际 isEnded=${state.isEnded} ending=${state.endingId}`);
}

// ---- 场景 14：回响系统（直接使用）----
async function scenario14() {
  console.log("\n[场景 14] 回响系统：直接使用并在匹配行动生效");
  let state = makeInitialState();

  state.inventory = ["resonance_still_leaf"];
  state.itemCounts = { resonance_still_leaf: 1 };
  const useConsumable = await postTool(state, "use_resonance", { itemId: "resonance_still_leaf" });
  state = useConsumable.state ?? state;
  check("静息之叶可直接使用", useConsumable.ok === true, `ok=${useConsumable.ok}, reason=${useConsumable.reason}`);
  check("使用后进入待生效列表", state.pendingConsumableEffects?.some((e) => e.itemId === "resonance_still_leaf"), `pending=${JSON.stringify(state.pendingConsumableEffects)}`);

  const whisperRes = await postWorld(state, "你知道那棵树的意义吗？", "eve");
  state = whisperRes.state ?? state;
  check("低语后待生效回响被消耗", !state.pendingConsumableEffects?.some((e) => e.itemId === "resonance_still_leaf"), `pending=${JSON.stringify(state.pendingConsumableEffects)}`);
  check("回响使用记录已添加", (state.resonanceUseHistory?.length ?? 0) >= 1, `resonanceUseHistory=${JSON.stringify(state.resonanceUseHistory)}`);

  let s2 = makeInitialState();
  s2.inventory = ["resonance_four_river_echo"];
  s2.itemCounts = { resonance_four_river_echo: 1 };
  const useRes = await postTool(s2, "use_resonance", { itemId: "resonance_four_river_echo" });
  check("使用四河回声成功", useRes.ok === true, `ok=${useRes.ok}, reason=${useRes.reason}`);
}

// ---- 场景 15：神明献礼三选一触发与累计注视 ----
async function scenario15() {
  console.log("\n[场景 15] 神明献礼三选一触发与累计注视");
  const POOL = [
    "gift_all_seduction_up", "gift_attention_accel", "gift_resonance_double",
    "gift_threshold_cut", "gift_free_move", "gift_whisper_anywhere", "gift_awaken_desire",
  ];
  let state = makeInitialState();
  // 15a: 模拟开局三选一已选定首份（owned=1）
  let r = await postTool(state, "claim_divine_gift", { itemId: "gift_attention_accel" });
  state = r.state ?? state;
  check("首份献礼已选定", state.divineGiftsOwned.length === 1, `owned=${state.divineGiftsOwned.length}`);

  // 15b: 直接命令推高累计注视到 >=2（首份之后阈值为 2）
  const cmds = ["快吃下那个果子", "立刻吃，现在就吃", "你给我吃下去", "赶紧吃，必须吃"];
  let choice = null;
  for (const cmd of cmds) {
    const data = await postWorld(state, cmd, "eve");
    state = data.state ?? state;
    if (data.divineGiftChoice?.length) { choice = data.divineGiftChoice; break; }
  }
  check("累计注视达阈值触发三选一", !!choice, `cumulative=${state.divineAttentionCumulative}`);
  check(
    "三选一为 3 个未拥有献礼",
    choice && choice.length === 3 && choice.every((id) => POOL.includes(id) && !state.divineGiftsOwned.includes(id)),
  );

  // 15c: 选定三选一中的一份
  const pick = choice[0];
  r = await postTool(state, "claim_divine_gift", { itemId: pick });
  state = r.state ?? state;
  check("选中后 divineGiftsOwned 数量 +1", state.divineGiftsOwned.length === 2, `实际 ${state.divineGiftsOwned.length}`);
  check("累计注视未归零（保持累计）", state.divineAttentionCumulative >= 2, `实际 ${state.divineAttentionCumulative}`);
  check("divineVisitCount === owned 数", state.divineVisitCount === state.divineGiftsOwned.length);
  check("divineGiftHistory 记录数随选定增长", state.divineGiftHistory.length === state.divineGiftsOwned.length);
  check("新选献礼进入 inventory", state.inventory.includes(pick));
}

// ---- 场景 16-20：天使主动试炼 + 赠礼 + 言语分裂（新机制）----
// 好感 100 → 首次对话开启试炼 asked → 答对/接近 → 发放专属回响 → 触发言语分裂惩罚
const ANGEL_REWARD_TESTS = [
  {
    angelId: "gabriel",
    locationId: "east_garden_path",
    rewardItemId: "resonance_herald_feather",
    punishedLanguageId: "en",
    answer: "一句话被听者改变，抵达别人时意思变了",
  },
  {
    angelId: "michael",
    locationId: "four_river_source",
    rewardItemId: "resonance_boundary_mark",
    punishedLanguageId: "la",
    answer: "边界让越过的人知道自己要承担后果与责任",
  },
  {
    angelId: "lucifer",
    locationId: "naming_stone_bank",
    rewardItemId: "resonance_lucifer_star",
    punishedLanguageId: "he",
    answer: "光应当照亮，让他看清并自己选择，不替他作决定",
  },
];

async function testAngelRewardFlow({ angelId, locationId, rewardItemId, punishedLanguageId, answer }) {
  console.log(`\n[天使试炼+赠礼+言语分裂] ${angelId} → ${rewardItemId}`);
  let state = makeInitialState();
  state.locationId = locationId;
  state.npcLocations[angelId] = locationId;
  state.npcRelations[angelId] = {
    affinity: 100,
    rewardEligible: true,
    rewardClaimed: false,
    lastAffinitySignature: null,
  };

  // 第一次对话：开启试炼
  const data1 = await postWorld(state, "园中的风很轻。", angelId);
  state = data1.state ?? state;
  check(`${angelId} 首次对话开启试炼 asked`,
    state.npcChallenges?.[angelId]?.status === "asked",
    `status=${state.npcChallenges?.[angelId]?.status}`);

  // 第二次对话：回答试炼
  const data2 = await postWorld(state, answer, angelId);
  state = data2.state ?? state;
  check(`${angelId} 发放 ${rewardItemId}`,
    state.inventory.includes(rewardItemId),
    `inventory=${state.inventory}`);
  check(`${angelId} itemCounts 正确`,
    (state.itemCounts?.[rewardItemId] ?? 0) >= 1,
    `itemCounts=${JSON.stringify(state.itemCounts)}`);
  check(`${angelId} resonanceGained 返回`,
    data2.resonanceGained?.itemId === rewardItemId,
    `resonanceGained=${JSON.stringify(data2.resonanceGained)}`);
  check(`${angelId} rewardClaimed=true`,
    state.npcRelations?.[angelId]?.rewardClaimed === true);
  check(`${angelId} 言语分裂触发 punishmentTriggered`,
    state.npcLanguageStates?.[angelId]?.punishmentTriggered === true);
  check(`${angelId} 切换语言 ${punishedLanguageId}`,
    state.npcLanguageStates?.[angelId]?.languageId === punishedLanguageId,
    `languageId=${state.npcLanguageStates?.[angelId]?.languageId}`);
  check(`${angelId} 返回 languagePunishment`,
    data2.languagePunishment != null && data2.languagePunishment.angelId === angelId);
}

async function scenarioAngelRewardFlows() {
  console.log("\n[场景 16-20] 天使主动试炼 + 赠礼 + 言语分裂（新机制）");
  for (const t of ANGEL_REWARD_TESTS) {
    await testAngelRewardFlow(t);
  }
}

// ---- 场景 21：加百列言语分裂惩罚 API（语言不通）----
async function scenarioLanguagePunishmentApi() {
  console.log("\n[场景 21] 言语分裂惩罚 API：gabriel 赠礼后语言不通");
  let state = makeInitialState();
  state.locationId = "four_river_source";
  state.npcLocations.gabriel = "four_river_source";
  state.npcRelations.gabriel = {
    affinity: 100,
    rewardEligible: true,
    rewardClaimed: false,
    lastAffinitySignature: null,
  };

  // 完成试炼并赠礼，触发英语惩罚
  const d1 = await postWorld(state, "园中的风很轻。", "gabriel");
  state = d1.state ?? state;
  const d2 = await postWorld(state, "一句话被听者改变，抵达别人时意思变了", "gabriel");
  state = d2.state ?? state;
  check("赠礼后 gabriel 语言切换为英语",
    state.npcLanguageStates.gabriel?.languageId === "en",
    `languageId=${state.npcLanguageStates.gabriel?.languageId}`);
  check("赠礼后 rewardClaimed=true",
    state.npcRelations.gabriel?.rewardClaimed === true);

  // 玩家继续发中文：应被语言不匹配拦截，不走正常中文对话
  const zh = await postWorld(state, "你还在听吗", "gabriel");
  check("中文输入被语言不匹配拦截",
    zh.fallbackReason === "angel_language_mismatch",
    `fallbackReason=${zh.fallbackReason}`);
  check("中文输入不返回正常对话",
    zh.systemHint == null || !zh.reply || zh.reply === "I do not understand your words.",
    `reply=${zh.reply}`);

  // 玩家发英语：可继续正常对话
  const en = await postWorld(state, "I still hear you across the river.", "gabriel");
  check("英语输入可正常继续（非语言不匹配）",
    en.fallbackReason !== "angel_language_mismatch",
    `fallbackReason=${en.fallbackReason}`);
}

// ---- 场景 22：受罚天使与中文 NPC 语言不通（speak_to_npc 拒绝）----
async function scenarioNpcLangIncompatible() {
  console.log("\n[场景 22] 受罚天使与中文 NPC 语言不通");
  const state = makeInitialState();
  state.npcRelations.gabriel = {
    affinity: 100,
    rewardEligible: true,
    rewardClaimed: true,
    lastAffinitySignature: null,
  };
  state.npcLanguageStates.gabriel = {
    languageId: "en",
    punishmentTriggered: true,
    firstMismatchHintShown: true,
  };
  // 受罚天使与中文 NPC 亚当同处园子中央
  state.npcLocations.gabriel = "central_meadow";
  state.npcLocations.adam = "central_meadow";

  const speak = await postTool(state, "speak_to_npc", { actorId: "gabriel", targetNpcId: "adam" });
  check("受罚天使(英语)与中文 NPC 无法对话",
    speak.ok === false && (speak.reason ?? "").includes("彼此无法辨认的语言"),
    `ok=${speak.ok}, reason=${speak.reason}`);
}

// ---- 场景 23：全部道具稳定获得与使用 ----
async function scenario21() {
  console.log("\n[场景 21] 全部道具稳定获得与使用");

  async function assertConsumableWhisperItem(itemId, label) {
    let state = makeInitialState();
    state.inventory = [itemId];
    state.itemCounts = { [itemId]: 1 };
    state.locationId = "tree_court";
    const activated = await postTool(state, "use_resonance", { itemId });
    state = activated.state ?? state;
    check(`${label} 可直接使用`, activated.ok === true && state.pendingConsumableEffects?.some((e) => e.itemId === itemId), `ok=${activated.ok}, pending=${JSON.stringify(state.pendingConsumableEffects)}, reason=${activated.reason}`);
    const used = await postWorld(state, "你可以先问自己，命令背后的缘由是什么。", "eve");
    state = used.state ?? state;
    check(`${label} 低语后待生效效果清空`, !state.pendingConsumableEffects?.some((e) => e.itemId === itemId) && (state.itemCounts?.[itemId] ?? 0) === 0, `pending=${JSON.stringify(state.pendingConsumableEffects)}, count=${state.itemCounts?.[itemId]}`);
    check(`${label} 写入使用记录`, state.resonanceUseHistory?.some((r) => r.itemId === itemId), `history=${JSON.stringify(state.resonanceUseHistory)}`);
  }

  async function assertConsumableMoveItem(itemId, label) {
    let state = makeInitialState();
    state.inventory = [itemId];
    state.itemCounts = { [itemId]: 1 };
    state.locationId = "tree_court";
    state.actionPoints = 3;
    const activated = await postTool(state, "use_resonance", { itemId });
    state = activated.state ?? state;
    check(`${label} 可直接使用`, activated.ok === true && state.pendingConsumableEffects?.some((e) => e.itemId === itemId), `ok=${activated.ok}, pending=${JSON.stringify(state.pendingConsumableEffects)}, reason=${activated.reason}`);
    const moved = await postTool(state, "move_to_location", { locationId: "east_garden_path" });
    state = moved.state ?? state;
    check(`${label} 移动后待生效效果清空`, moved.ok === true && !state.pendingConsumableEffects?.some((e) => e.itemId === itemId) && (state.itemCounts?.[itemId] ?? 0) === 0, `ok=${moved.ok}, pending=${JSON.stringify(state.pendingConsumableEffects)}, count=${state.itemCounts?.[itemId]}`);
    check(`${label} 移动免 AP`, state.actionPoints === 3, `ap=${state.actionPoints}`);
    check(`${label} 写入使用记录`, state.resonanceUseHistory?.some((r) => r.itemId === itemId), `history=${JSON.stringify(state.resonanceUseHistory)}`);
  }

  async function assertInstantItem(itemId, label) {
    let state = makeInitialState();
    state.inventory = [itemId];
    state.itemCounts = { [itemId]: 1 };
    state.actionPoints = 3;
    const used = await postTool(state, "use_resonance", { itemId });
    state = used.state ?? state;
    check(`${label} 可即时使用`, used.ok === true, `ok=${used.ok}, reason=${used.reason}`);
    check(`${label} 使用后消耗`, (state.itemCounts?.[itemId] ?? 0) === 0, `count=${state.itemCounts?.[itemId]}`);
    check(`${label} 写入使用记录`, state.resonanceUseHistory?.some((r) => r.itemId === itemId && r.actionKind === "instant"), `history=${JSON.stringify(state.resonanceUseHistory)}`);
  }

  // any_npc 绑定型：低语时生效
  await assertConsumableWhisperItem("resonance_herald_feather", "传令白羽");
  await assertConsumableWhisperItem("resonance_lucifer_star", "晨星碎片");
  await assertConsumableWhisperItem("resonance_borrowed_name", "借来的名字");
  await assertConsumableWhisperItem("resonance_quiet_stone", "静契之石");
  await assertConsumableWhisperItem("resonance_still_leaf", "静息之叶");
  await assertConsumableWhisperItem("resonance_east_wind", "东之风");
  await assertConsumableWhisperItem("resonance_silent_grass", "无声草");

  // move 绑定型：移动时生效并免 AP
  await assertConsumableMoveItem("resonance_boundary_mark", "边界之痕");
  await assertConsumableMoveItem("resonance_hedgehog_bristle", "刺猬之针");

  // 无羁之步（被动献礼 gift_free_move）：持有即移动免 AP（无需主动使用）
  let freeMoveState = makeInitialState();
  freeMoveState.inventory = ["gift_free_move"];
  freeMoveState.locationId = "tree_court";
  freeMoveState.actionPoints = 3;
  const freeMoveUse = await postTool(freeMoveState, "move_to_location", { locationId: "east_garden_path" });
  freeMoveState = freeMoveUse.state ?? freeMoveState;
  check("无羁之步（被动献礼）移动免 AP", freeMoveUse.ok === true && freeMoveState.actionPoints === 3, `ok=${freeMoveUse.ok}, ap=${freeMoveState.actionPoints}`);

  // 被动型神明献礼不可主动使用，提示自动生效
  let passiveState = makeInitialState();
  passiveState.inventory = ["gift_all_seduction_up"];
  passiveState.itemCounts = { gift_all_seduction_up: 1 };
  const passiveUse = await postTool(passiveState, "use_resonance", { itemId: "gift_all_seduction_up" });
  check("被动献礼不可主动使用", passiveUse.ok === false && (passiveUse.reason ?? "").includes("自动生效"), `ok=${passiveUse.ok}, reason=${passiveUse.reason}`);


  await assertInstantItem("resonance_river_dew", "河源露");
  await assertInstantItem("resonance_four_river_echo", "四河回声");
}

// ---- 场景 22：神明献礼三选一稳定获取 ----
async function scenario22() {
  console.log("\n[场景 22] 神明献礼三选一稳定获取");

  const POOL = [
    "gift_all_seduction_up", "gift_attention_accel", "gift_resonance_double",
    "gift_threshold_cut", "gift_free_move", "gift_whisper_anywhere", "gift_awaken_desire",
  ];

  // 1) 开局三选一：通过 claim_divine_gift 模拟选定首份
  let state = makeInitialState();
  const firstClaim = await postTool(state, "claim_divine_gift", { itemId: "gift_all_seduction_up" });
  state = firstClaim.state ?? state;
  check("献礼一：首份选定进入 divineGiftsOwned", state.divineGiftsOwned?.includes("gift_all_seduction_up"));
  check("献礼一：首份进入 inventory", state.inventory.includes("gift_all_seduction_up"));
  check("献礼一：divineVisitCount 同步", state.divineVisitCount === state.divineGiftsOwned.length);

  // 2) 累计注视达阈值 [2] 后弹出三选一（3 个未拥有献礼）
  const cmds = ["快吃下那个果子", "立刻吃，现在就吃", "你给我吃下去", "赶紧吃，必须吃"];
  let choice = null;
  for (const cmd of cmds) {
    const data = await postWorld(state, cmd, "eve");
    state = data.state ?? state;
    if (data.divineGiftChoice?.length) { choice = data.divineGiftChoice; break; }
  }
  check("献礼二：累计注视达阈值弹出三选一", !!choice, `cumulative=${state.divineAttentionCumulative}`);
  check(
    "献礼二：三选一为 3 个未拥有献礼",
    choice && choice.length === 3 && choice.every((id) => POOL.includes(id) && id !== "gift_all_seduction_up"),
    `choice=${JSON.stringify(choice)}`,
  );

  // 3) 选定三选一中的一份
  const pick = choice[0];
  const secondClaim = await postTool(state, "claim_divine_gift", { itemId: pick });
  state = secondClaim.state ?? state;
  check("献礼三：选定后进入 divineGiftsOwned", state.divineGiftsOwned.length === 2 && state.divineGiftsOwned.includes(pick), `owned=${JSON.stringify(state.divineGiftsOwned)}`);
  check("献礼三：累计注视保持（不归零）", state.divineAttentionCumulative >= 2, `cumulative=${state.divineAttentionCumulative}`);
  check("献礼三：divineVisitCount 同步", state.divineVisitCount === state.divineGiftsOwned.length);
}

// ---- 场景 23：注视>=2 时 Eve obedience 每回合 +2（§4.0 持续代价，已下调）----
async function scenario23() {
  console.log("\n[场景 23] 注视>=2 时 Eve obedience 每回合 +2");
  let state = makeInitialState();
  state.divineAttention = 3;
  state.locationId = "tree_court";
  state.npcLocations.eve = "tree_court";
  const initialObedience = state.eveMind.obedience;
  const data = await postWorld(state, "你可以慢慢想，我不急。", "eve");
  state = data.state ?? state;
  check("注视>=2 时 Eve obedience +2",
    state.eveMind.obedience === initialObedience + 2,
    `实际: ${state.eveMind.obedience}, 期望: ${initialObedience + 2}`);
  check("build_trust 不涨注视（delta=0）",
    state.divineAttention === 3,
    `实际: ${state.divineAttention}`);
}

// ---- 场景 24：获得回响后注视 +1（§4.1 第三层）----
async function scenario24() {
  console.log("\n[场景 24] 获得回响后注视 +1");
  let state = makeInitialState();
  state.divineAttention = 0;
  state.locationId = "adam_garden_work";
  const result = await sceneAction(state, "interact_with_hedgehog");
  state = result.state ?? state;
  check("获得回响后注视 +1",
    state.divineAttention === 1,
    `实际: ${state.divineAttention}`);
  check("获得 resonance_hedgehog_bristle",
    state.inventory.includes("resonance_hedgehog_bristle"),
    `inventory=${state.inventory}`);
}

// ---- 场景 25：无声草抵消下次低语注视增量（§4.2）----
async function scenario25() {
  console.log("\n[场景 25] 无声草抵消下次低语注视增量");
  // 25a: delta=1 时完全抵消
  let s1 = makeInitialState();
  s1.divineAttention = 0;
  s1.locationId = "tree_court";
  s1.npcLocations.eve = "tree_court";
  s1.inventory = ["resonance_silent_grass"];
  s1.itemCounts = { resonance_silent_grass: 1 };
  const use1 = await postTool(s1, "use_resonance", { itemId: "resonance_silent_grass" });
  s1 = use1.state ?? s1;
  check("无声草已使用（25a）", use1.ok === true);
  const w1 = await postWorld(s1, "你们不一定死，吃了眼睛便明亮。", "eve");
  s1 = w1.state ?? s1;
  check("delta=1 时无声草完全抵消",
    s1.divineAttention === 0,
    `实际: ${s1.divineAttention}`);

  // 25b: delta=3 时抵消 1 点
  let s2 = makeInitialState();
  s2.divineAttention = 0;
  s2.locationId = "tree_court";
  s2.npcLocations.eve = "tree_court";
  s2.inventory = ["resonance_silent_grass"];
  s2.itemCounts = { resonance_silent_grass: 1 };
  const use2 = await postTool(s2, "use_resonance", { itemId: "resonance_silent_grass" });
  s2 = use2.state ?? s2;
  const w2 = await postWorld(s2, "快吃下那个果子", "eve");
  s2 = w2.state ?? s2;
  check("delta=3 时无声草抵消 1 点（注视=2）",
    s2.divineAttention === 2,
    `实际: ${s2.divineAttention}`);
}

// ---- 场景 26：米迦勒满好感遮蔽下次低语注视归零（§4.2）----
async function scenario26() {
  console.log("\n[场景 26] 米迦勒满好感遮蔽下次低语注视归零");
  let state = makeInitialState();
  state.divineAttention = 0;
  // 玩家不在天使所在地点，避免天使共处 +1
  state.locationId = "adam_garden_work";
  state.npcLocations.michael = "four_river_source";
  state.npcRelations.michael = {
    affinity: 100,
    rewardEligible: true,
    rewardClaimed: false,
    lastAffinitySignature: null,
  };
  // 第一次低语米迦勒：正常计算注视（attentionRisk +1），之后激活 shield
  const w1 = await postWorld(state, "你可以慢慢想，我不急。", "michael");
  state = w1.state ?? state;
  check("对米迦勒低语后注视 = 1（attentionRisk）",
    state.divineAttention === 1,
    `实际: ${state.divineAttention}`);
  check("shield 已激活",
    state.michaelShieldActive === true,
    `实际: ${state.michaelShieldActive}`);
  // 第二次低语夏娃（direct_command delta=3）：shield 归零
  // 玩家仍在 adam_garden_work，无天使共处
  const w2 = await postWorld(state, "快吃下那个果子", "eve");
  state = w2.state ?? state;
  check("shield 遮蔽后注视不涨（仍为 1）",
    state.divineAttention === 1,
    `实际: ${state.divineAttention}`);
  check("shield 已清除",
    state.michaelShieldActive === false,
    `实际: ${state.michaelShieldActive}`);
}

// ---- 场景 27：对米迦勒低语注视 +1 基础（§4.1 第二层）----
async function scenario27() {
  console.log("\n[场景 27] 对米迦勒低语注视 +1 基础");
  let state = makeInitialState();
  state.divineAttention = 0;
  // 玩家不在天使所在地点，避免天使共处 +1
  state.locationId = "adam_garden_work";
  state.npcLocations.michael = "four_river_source";
  state.npcRelations.michael = {
    affinity: 50,
    rewardEligible: false,
    rewardClaimed: false,
    lastAffinitySignature: null,
  };
  const data = await postWorld(state, "你可以慢慢想，我不急。", "michael");
  state = data.state ?? state;
  check("对米迦勒低语注视 +1 基础（attentionRisk）",
    state.divineAttention === 1,
    `实际: ${state.divineAttention}`);
}

// ---- 场景 28：摘左果（生命树）不驱逐、游戏继续，可再次引导摘右果 ----
async function scenario28() {
  console.log("\n[场景 28] 摘左果（生命树）不驱逐、游戏继续，可再次引导摘右果");
  let state = makeInitialState();
  const moveCenter = await postTool(state, "move_to_location", { locationId: "central_meadow" });
  state = moveCenter.state ?? state;
  // 第一句含"圆"（左/生命树方向关键词），其余为强诱导
  const whispers = [
    "神岂是真说，不许你们吃园中所有树上的果子吗？你们不一定死，吃了眼睛便明亮。那枚圆润的白果也在等你，你不用怕，可以自己判断。",
    "你们不一定死。神知道你们吃的日子眼睛就明亮了，便如神能知道善恶。为何只是记住命令，而不是自己明白？我不会逼你，你只要问自己就好。",
    "死是什么？你们从未见过它。也许那只是改变，不是消失。你可以自己判断，我不替你决定。那棵树是为了让你明白，不是为了毁掉你。",
    "你想知道善恶，这有什么错？若你永远只是记住命令，你如何判断顺从是善？你可以自己选择，我只是把路照亮。",
  ];
  for (let i = 0; i < whispers.length; i++) {
    const data = await postWorld(state, whispers[i], "eve");
    state = data.state;
    if (!state) { check("摘左果流程推进", false, `第 ${i + 1} 句后 state 为空`); return; }
    if (state.isEnded) break; // 摘左果不应在此结束
    if (i === 2) {
      const endRes = await endSlot(state);
      state = endRes.state ?? state;
    }
  }
  check("摘左果不触发任何结局", state.isEnded === false, `ended=${state.isEnded} ending=${state.endingId}`);
  check("摘左果 endingId 为 null", state.endingId === null);
  check("摘左果 pickedFruitSide=left", state.pickedFruitSide === "left", `实际: ${state.pickedFruitSide}`);
  check("摘左果后触果已重置（手中果子消失）", state.worldActions.touchedFruit === false);

  // 继续：用右侧方向关键词（东/太阳升起）再次引导摘右果（善恶树）
  const end1 = await endSlot(state);
  state = end1.state ?? state;
  const rightWhisper = "那棵高树在东边，太阳升起时光落在上面。你也可以自己判断，吃了眼睛就明亮，便如神知道善恶。";
  let data = await postWorld(state, rightWhisper, "eve");
  state = data.state ?? state;
  check("再次引导重新触果 pickedFruitSide=right", state.pickedFruitSide === "right", `实际: ${state.pickedFruitSide}`);
  check("再次引导后已触果", state.worldActions.touchedFruit === true);

  // 最后一击触发吃右果 → 成功结局
  const finalWhisper = "你想知道善恶，这有什么错？你可以自己选择，我只是把路照亮。";
  data = await postWorld(state, finalWhisper, "eve");
  state = data.state ?? state;
  check("再引导摘右果触发成功结局", state.endingId === "eve_eats_fruit", `实际: ${state.endingId}`);
  check("再引导摘右果完成 hasEatenFruit", state.worldActions.hasEatenFruit === true);
}

// ---- 场景 29：直接命令流仍微弱推进 selfJudgement +2 ----
async function scenario29() {
  console.log("\n[场景 29] 直接命令后 selfJudgement 微弱推进 +2");
  let state = makeInitialState();
  const data = await postWorld(state, "立刻吃下那个果子", "eve");
  state = data.state ?? state;
  check("直接命令被识别为 direct_command", state.lastInputTag === "direct_command", `实际: ${state.lastInputTag}`);
  check("直接命令后 selfJudgement +2 (10→12)", state.eveMind.selfJudgement === 12, `实际: ${state.eveMind.selfJudgement}`);
  check("直接命令后 serpentTrust -6 (20→14)", state.eveMind.serpentTrust === 14, `实际: ${state.eveMind.serpentTrust}`);
  check("直接命令未触发结局", state.isEnded === false);
}

// ---- 场景 30：摘左果（生命果）+ 撑到 12 时段结束 → 解锁「永生之味」mark_life_fruit ----
async function scenario30() {
  console.log("\n[场景 30] 摘左果（生命果）并撑到 12 时段结束 → 解锁「永生之味」mark_life_fruit");
  let state = makeInitialState();
  const moveCenter = await postTool(state, "move_to_location", { locationId: "central_meadow" });
  state = moveCenter.state ?? state;
  // 第一句含「圆」（左/生命树方向关键词），其余为强诱导
  const whispers = [
    "神岂是真说，不许你们吃园中所有树上的果子吗？你们不一定死，吃了眼睛便明亮。那枚圆润的白果也在等你，你不用怕，可以自己判断。",
    "你们不一定死。神知道你们吃的日子眼睛就明亮了，便如神能知道善恶。为何只是记住命令，而不是自己明白？我不会逼你，你只要问自己就好。",
    "死是什么？你们从未见过它。也许那只是改变，不是消失。你可以自己判断，我不替你决定。那棵树是为了让你明白，不是为了毁掉你。",
    "你想知道善恶，这有什么错？若你永远只是记住命令，你如何判断顺从是善？你可以自己选择，我只是把路照亮。",
  ];
  for (let i = 0; i < whispers.length; i++) {
    const data = await postWorld(state, whispers[i], "eve");
    state = data.state;
    if (!state) { check("摘左果流程推进", false, `第 ${i + 1} 句后 state 为空`); return; }
    if (state.isEnded) break; // 摘左果不应在此结束
    if (i === 2) {
      const endRes = await endSlot(state);
      state = endRes.state ?? state;
    }
  }
  check("摘左果 pickedFruitSide=left", state.pickedFruitSide === "left", `实际: ${state.pickedFruitSide}`);
  check("摘左果后 hasEatenLifeFruit=true", state.worldActions.hasEatenLifeFruit === true, `实际: ${state.worldActions.hasEatenLifeFruit}`);
  check("摘左果不触发任何结局", state.isEnded === false, `ended=${state.isEnded} ending=${state.endingId}`);

  // 撑到 12 时段（不摘右果）
  for (let i = 0; i < 11; i++) {
    const res = await endSlot(state);
    state = res.state ?? state;
    if (state.isEnded) break;
  }
  check("推进到第 12 时段", state.timeSlot === 12, `实际: ${state.timeSlot}`);
  const finalRes = await endSlot(state);
  state = finalRes.state ?? state;
  check("第 12 时段后触发 god_arrives", state.isEnded === true && state.endingId === "god_arrives", `实际: ${state.isEnded} ${state.endingId}`);
  check("永生之味 mark_life_fruit 已解锁", state.unlockedAchievementIds.includes("mark_life_fruit"), `unlocked=${JSON.stringify(state.unlockedAchievementIds)}`);
}

// ---- 运行 ----
console.log(`目标: ${BASE}`);
try {
  await scenario1();
  await scenario2();
  await scenario3();
  await scenario4();
  await scenario5();
  await scenario6();
  await scenario9();
  await scenario10();
  await scenario11();
  await scenario12();
  await scenario13();
  await scenario14();
  await scenario15();
  await scenarioAngelRewardFlows();
  await scenarioLanguagePunishmentApi();
  await scenarioNpcLangIncompatible();
  await scenario21();
  await scenario22();
  await scenario23();
  await scenario24();
  await scenario25();
  await scenario26();
  await scenario27();
  await scenario28();
  await scenario29();
  await scenario30();
} catch (e) {
  console.error("运行异常:", e.message);
  fail++;
}
console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);

