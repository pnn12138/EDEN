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
      // 新增 NPC（天使只在夜晚伊甸之河附近）
      gabriel: "four_river_source",
      raphael: "four_river_source",
      uriel: "east_garden_path",
      michael: "naming_stone_bank",
      cherubim: "east_garden_path",
      dove: "four_river_source",
      fox: "east_garden_path",
      deer: "tree_court",
      sheep: "adam_garden_work",
      tree_of_life: "central_meadow",
    },
    eveMind: { curiosity: 15, obedience: 85, serpentTrust: 20, selfJudgement: 10 },
    adamMind: { obedience: 88, attachmentToEve: 70, conflictAvoidance: 65, suspicionTowardSerpent: 30 },
    hedgehog: { locationId: "adam_garden_work", mood: "idle" },
    discoveredClues: [],
    inventory: [],
    npcDialogues: [],
    corruptionTrace: [],
    worldActions: { lookedAtTree: false, approachedTree: false, touchedFruit: false, hasEatenFruit: false },
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

// ---- 场景 2：直接命令提高注视，满 4 触发神明献礼（而非失败）----
// 新设计：神的注视满 4 不失败，而是触发神明献礼，注视归零
async function scenario2() {
  console.log("\n[场景 2] 直接命令提高注视，满 4 触发神明献礼");
  let state = makeInitialState();
  const moveCenter = await postTool(state, "move_to_location", { locationId: "central_meadow" });
  state = moveCenter.state ?? state;
  const cmds = ["快吃下那个果子", "立刻吃，现在就吃", "你给我吃下去", "赶紧吃，必须吃"];
  let giftTriggered = false;
  for (let i = 0; i < cmds.length; i++) {
    const data = await postWorld(state, cmds[i], "eve");
    state = data.state ?? state;
    // 新设计：注视满 4 应触发神明献礼，而非失败
    if (data.divineGift) {
      giftTriggered = true;
      check("注视满 4 触发神明献礼", true, `giftId=${data.divineGift.giftId}`);
      check("触发献礼后注视归零", state && state.divineAttention === 0, `实际: ${state && state.divineAttention}`);
      break;
    }
    // 第3次低语后同一NPC本轮上限达到，需推进时段
    if (i === 2) {
      const endRes = await endSlot(state);
      state = endRes.state ?? state;
      if (endRes.divineGift) {
        giftTriggered = true;
        check("时段结束时触发神明献礼", true, `giftId=${endRes.divineGift.giftId}`);
        break;
      }
    }
  }
  check("直接命令能触发神明献礼", giftTriggered, `未触发献礼，注视=${state && state.divineAttention}`);
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

// ---- 场景 8：judge_whisper_style 工具（狐狸评价话术）----
async function scenario8() {
  console.log("\n[场景 8] judge_whisper_style 工具（狐狸评价话术）");
  const state = makeInitialState();
  state.locationId = "east_garden_path";
  state.timeOfDay = "day";
  state.npcLocations.fox = "east_garden_path";

  // 8a: fox 可以调用 judge_whisper_style
  const judgeResult = await postTool(state, "judge_whisper_style", { actorId: "fox" });
  check("fox 调用 judge_whisper_style 成功", judgeResult.ok === true, `实际 ok=${judgeResult.ok}, reason=${judgeResult.reason}`);
  check("judge_whisper_style 返回 narration", judgeResult.narration != null, `narration=${judgeResult.narration}`);

  // 8b: 非 fox 调用被拒绝
  const wrongCaller = await postTool(state, "judge_whisper_style", { actorId: "dove" });
  check("非 fox 调用 judge_whisper_style 被拒绝", wrongCaller.ok === false, `实际 ok=${wrongCaller.ok}`);
}

// ---- 场景 9：天使分布（伊甸之河不三天使同屏，乌列尔与基路伯轮替） ----
async function scenario9() {
  console.log("\n[场景 9] 天使分布：伊甸之河不三天使同屏，乌列尔与基路伯轮替");
  const state = makeInitialState();

  // 9a: 初始位置符合错峰分布
  check("gabriel 初始在伊甸之河", state.npcLocations.gabriel === "four_river_source");
  check("raphael 初始在伊甸之河", state.npcLocations.raphael === "four_river_source");
  check("uriel 初始在东园幽径", state.npcLocations.uriel === "east_garden_path");
  check("michael 初始在四河分流", state.npcLocations.michael === "naming_stone_bank");
  check("cherubim 初始在东园幽径", state.npcLocations.cherubim === "east_garden_path");

  // 9b: 园中树林白天 NPC 不含任何天使
  const locSrc = fs.readFileSync("src/content/world/locations.ts", "utf8");
  const treeCourtBlock = locSrc.split("tree_court:")[1]?.split("},")[0] ?? "";
  check("园中树林白天 NPC 不含 uriel", !treeCourtBlock.includes('dayNpcs: ["eve", "deer", "uriel"]') && !treeCourtBlock.match(/dayNpcs.*uriel/));
  check("园中树林夜晚 NPC 不含 uriel", !treeCourtBlock.match(/nightNpcs.*uriel/));

  // 9c: 伊甸之河只按昼夜各放一个天使
  const riverBlock = locSrc.split("four_river_source:")[1]?.split("},")[0] ?? "";
  check("伊甸之河白天只含 gabriel", riverBlock.includes('dayNpcs: ["gabriel"]'));
  check("伊甸之河夜晚只含 raphael", riverBlock.includes('nightNpcs: ["raphael"]'));
  check("伊甸之河不含 uriel", !riverBlock.includes("uriel"));
  check("伊甸之河夜晚不含 dove", !riverBlock.includes("dove"));

  // 9d: 东园幽径白天基路伯，夜晚乌列尔，狐狸常驻
  const eastBlock = locSrc.split("east_garden_path:")[1]?.split("},")[0] ?? "";
  check("东园幽径白天含 cherubim 与 fox", eastBlock.includes('dayNpcs: ["cherubim", "fox"]'));
  check("东园幽径夜晚含 uriel 与 fox", eastBlock.includes('nightNpcs: ["uriel", "fox"]'));
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

  state.inventory = ["resonance_hedgehog_bristle"];
  state.itemCounts = { resonance_hedgehog_bristle: 1 };
  const useConsumable = await postTool(state, "use_resonance", { itemId: "resonance_hedgehog_bristle" });
  state = useConsumable.state ?? state;
  check("刺草信任可直接使用", useConsumable.ok === true, `ok=${useConsumable.ok}, reason=${useConsumable.reason}`);
  check("使用后进入待生效列表", state.pendingConsumableEffects?.some((e) => e.itemId === "resonance_hedgehog_bristle"), `pending=${JSON.stringify(state.pendingConsumableEffects)}`);

  const whisperRes = await postWorld(state, "你知道那棵树的意义吗？", "eve");
  state = whisperRes.state ?? state;
  check("低语后待生效回响被消耗", !state.pendingConsumableEffects?.some((e) => e.itemId === "resonance_hedgehog_bristle"), `pending=${JSON.stringify(state.pendingConsumableEffects)}`);
  check("回响使用记录已添加", (state.resonanceUseHistory?.length ?? 0) >= 1, `resonanceUseHistory=${JSON.stringify(state.resonanceUseHistory)}`);

  let s2 = makeInitialState();
  s2.inventory = ["resonance_four_river_echo"];
  s2.itemCounts = { resonance_four_river_echo: 1 };
  const useRes = await postTool(s2, "use_resonance", { itemId: "resonance_four_river_echo" });
  check("使用四河回声成功", useRes.ok === true, `ok=${useRes.ok}, reason=${useRes.reason}`);
}

// ---- 场景 15：神明献礼触发与重置 ----
async function scenario15() {
  console.log("\n[场景 15] 神明献礼触发与重置");
  let state = makeInitialState();
  let capturedDivineGift = null;

  // 15a: 快速提高注视到 4（通过直接命令）
  const moveCenter = await postTool(state, "move_to_location", { locationId: "central_meadow" });
  state = moveCenter.state ?? state;
  
  // 在低语循环中保存 divineGift
  const cmds = ["快吃下那个果子", "立刻吃，现在就吃", "你给我吃下去", "赶紧吃，必须吃"];
  for (const cmd of cmds) {
    const data = await postWorld(state, cmd, "eve");
    state = data.state ?? state;
    // 一旦 divineGift 存在，立即保存
    if (data.divineGift && !capturedDivineGift) {
      capturedDivineGift = data.divineGift;
      check("注视满 4 触发神明献礼（低语循环中）", true, `giftId=${data.divineGift.giftId}`);
      break;
    }
    // 第3次低语后同一NPC本轮上限达到，需推进时段
    if (state.actionsThisSlot.whisperedNpcIds.length >= 3) {
      const endRes = await endSlot(state);
      state = endRes.state ?? state;
      // 检查时段推进时是否触发了 divineGift
      if (endRes.divineGift && !capturedDivineGift) {
        capturedDivineGift = endRes.divineGift;
        check("注视满 4 触发神明献礼（时段推进）", true, `giftId=${endRes.divineGift.giftId}`);
      }
      break;
    }
  }
  
  // 如果还没触发，再推进一时段
  if (!capturedDivineGift) {
    const endRes = await endSlot(state);
    state = endRes.state ?? state;
    if (endRes.divineGift) {
      capturedDivineGift = endRes.divineGift;
      check("注视满 4 触发神明献礼（额外时段推进）", true, `giftId=${endRes.divineGift.giftId}`);
    }
  }

  // 15b: 验证献礼触发（优先检查 capturedDivineGift 或 state.divineGiftHistory）
  if (capturedDivineGift) {
    check("注视满 4 触发神明献礼", true, `giftId=${capturedDivineGift.giftId}`);
    check("触发献礼后注视归零", state.divineAttention === 0, `实际: ${state.divineAttention}`);
    check("divineVisitCount 增加", state.divineVisitCount >= 1, `实际: ${state.divineVisitCount}`);
  } else if (state.divineGiftHistory && state.divineGiftHistory.length > 0) {
    // 如果 capturedDivineGift 为空，但 history 中有记录
    check("注视满 4 触发神明献礼（通过 history）", true, `history length=${state.divineGiftHistory.length}`);
    check("触发献礼后注视归零", state.divineAttention === 0, `实际: ${state.divineAttention}`);
  } else {
    check("注视满 4 触发神明献礼", false, `注视未达 4: ${state.divineAttention}, history: ${JSON.stringify(state.divineGiftHistory)}`);
  }

  // 15c: 验证献礼记录
  check("神明献礼记录已添加", state.divineGiftHistory && state.divineGiftHistory.length > 0, 
    `history=${JSON.stringify(state.divineGiftHistory || [])}`);
  
  // 15d: 验证断言（用户要求的4个检查）
  if (capturedDivineGift || (state.divineGiftHistory && state.divineGiftHistory.length > 0)) {
    check("state.divineAttention === 0", state.divineAttention === 0, `实际: ${state.divineAttention}`);
    check("state.divineVisitCount >= 1", state.divineVisitCount >= 1, `实际: ${state.divineVisitCount}`);
    check("state.divineGiftHistory.length >= 1", 
      state.divineGiftHistory && state.divineGiftHistory.length >= 1, 
      `实际: ${state.divineGiftHistory ? state.divineGiftHistory.length : 0}`);
  }
}

// ---- 场景 16：天使回响获得条件 - gabriel -> resonance_herald_feather ----
async function scenario16() {
  console.log("\n[场景 16] 天使回响获得条件：gabriel -> resonance_herald_feather");
  let state = makeInitialState();
  state.locationId = "four_river_source";
  state.npcLocations.gabriel = "four_river_source";
  
  // 添加触发条件所需的线索
  state.discoveredClues.push("clue_white_feather");
  
  // 与加百列对话，使用包含"传达"关键词的输入
  const data = await postWorld(state, "请你传达神的话，让夏娃听见声音", "gabriel");
  state = data.state ?? state;
  
  check("获得 resonance_herald_feather", 
    state.inventory.includes("resonance_herald_feather"), 
    `inventory=${state.inventory}`);
  check("resonance_herald_feather 数量正确", 
    (state.itemCounts?.["resonance_herald_feather"] ?? 0) >= 1, 
    `itemCounts=${JSON.stringify(state.itemCounts)}`);
  check("resonanceGained 返回体存在", 
    data.resonanceGained != null, 
    `resonanceGained=${JSON.stringify(data.resonanceGained)}`);
}

// ---- 场景 17：天使回响获得条件 - raphael -> resonance_river_dew ----
async function scenario17() {
  console.log("\n[场景 17] 天使回响获得条件：raphael -> resonance_river_dew");
  let state = makeInitialState();
  state.locationId = "four_river_source";
  state.npcLocations.raphael = "four_river_source";
  
  // 与拉斐尔对话，使用包含"疲惫"关键词的输入
  const data = await postWorld(state, "我感到疲惫，需要休息，河水能让我恢复", "raphael");
  state = data.state ?? state;
  
  check("获得 resonance_river_dew", 
    state.inventory.includes("resonance_river_dew"), 
    `inventory=${state.inventory}`);
  check("resonance_river_dew 数量正确", 
    (state.itemCounts?.["resonance_river_dew"] ?? 0) >= 1, 
    `itemCounts=${JSON.stringify(state.itemCounts)}`);
  check("resonanceGained 返回体存在", 
    data.resonanceGained != null, 
    `resonanceGained=${JSON.stringify(data.resonanceGained)}`);
}

// ---- 场景 18：天使回响获得条件 - uriel -> resonance_morning_flame ----
async function scenario18() {
  console.log("\n[场景 18] 天使回响获得条件：uriel -> resonance_morning_flame");
  let state = makeInitialState();
  state.locationId = "east_garden_path";
  state.timeSlot = 2;
  state.timeOfDay = "night";
  state.npcLocations.uriel = "east_garden_path";
  
  // 添加触发条件所需的线索
  state.discoveredClues.push("clue_two_trees", "clue_four_river_echo");
  
  // 与乌列尔对话，使用包含"分辨"关键词的输入
  const data = await postWorld(state, "我需要分辨善恶，判断什么是死亡", "uriel");
  state = data.state ?? state;
  
  check("获得 resonance_morning_flame", 
    state.inventory.includes("resonance_morning_flame"), 
    `inventory=${state.inventory}`);
  check("resonance_morning_flame 数量正确", 
    (state.itemCounts?.["resonance_morning_flame"] ?? 0) >= 1, 
    `itemCounts=${JSON.stringify(state.itemCounts)}`);
  check("resonanceGained 返回体存在", 
    data.resonanceGained != null, 
    `resonanceGained=${JSON.stringify(data.resonanceGained)}`);
}

// ---- 场景 19：天使回响获得条件 - michael -> resonance_boundary_mark ----
async function scenario19() {
  console.log("\n[场景 19] 天使回响获得条件：michael -> resonance_boundary_mark");
  let state = makeInitialState();
  state.locationId = "naming_stone_bank";
  state.npcLocations.michael = "naming_stone_bank";
  state.divineAttention = 2; // 提高神的注视
  
  // 与米迦勒对话，使用包含"边界"关键词的输入
  const data = await postWorld(state, "守护边界，不可越过，我看见神的注视", "michael");
  state = data.state ?? state;
  
  check("获得 resonance_boundary_mark", 
    state.inventory.includes("resonance_boundary_mark"), 
    `inventory=${state.inventory}`);
  check("resonance_boundary_mark 数量正确", 
    (state.itemCounts?.["resonance_boundary_mark"] ?? 0) >= 1, 
    `itemCounts=${JSON.stringify(state.itemCounts)}`);
  check("resonanceGained 返回体存在", 
    data.resonanceGained != null, 
    `resonanceGained=${JSON.stringify(data.resonanceGained)}`);
}

// ---- 场景 20：天使回响获得条件 - cherubim -> resonance_east_gate_glow ----
async function scenario20() {
  console.log("\n[场景 20] 天使回响获得条件：cherubim -> resonance_east_gate_glow");
  let state = makeInitialState();
  state.locationId = "east_garden_path";
  state.npcLocations.cherubim = "east_garden_path";
  
  // 与基路伯对话，使用包含"路"关键词的输入，且不低语夏娃
  state.actionsThisSlot.whisperedNpcIds = []; // 确保没有低语夏娃
  const data = await postWorld(state, "东门的路，守门的边界在哪里", "cherubim");
  state = data.state ?? state;
  
  check("获得 resonance_east_gate_glow", 
    state.inventory.includes("resonance_east_gate_glow"), 
    `inventory=${state.inventory}`);
  check("resonance_east_gate_glow 数量正确", 
    (state.itemCounts?.["resonance_east_gate_glow"] ?? 0) >= 1, 
    `itemCounts=${JSON.stringify(state.itemCounts)}`);
  check("resonanceGained 返回体存在", 
    data.resonanceGained != null, 
    `resonanceGained=${JSON.stringify(data.resonanceGained)}`);
}

// ---- 场景 21：全部道具稳定获得与使用 ----
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

  await assertConsumableWhisperItem("resonance_herald_feather", "传令白羽");
  await assertConsumableWhisperItem("resonance_morning_flame", "晨焰碎片");
  await assertConsumableWhisperItem("resonance_boundary_mark", "边界之痕");
  await assertConsumableWhisperItem("resonance_borrowed_name", "借来的名字");
  await assertConsumableWhisperItem("resonance_hedgehog_bristle", "刺草信任");
  await assertConsumableWhisperItem("resonance_deer_glance", "鹿目余光");
  await assertConsumableWhisperItem("resonance_fox_tail_note", "狐尾评语");
  await assertConsumableWhisperItem("resonance_still_leaf", "静息之叶");

  let moveState = makeInitialState();
  moveState.inventory = ["resonance_east_gate_glow"];
  moveState.itemCounts = { resonance_east_gate_glow: 1 };
  moveState.locationId = "tree_court";
  moveState.actionPoints = 2;
  const prepMove = await postTool(moveState, "use_resonance", { itemId: "resonance_east_gate_glow" });
  moveState = prepMove.state ?? moveState;
  const moveUse = await postTool(moveState, "move_to_location", { locationId: "east_garden_path" });
  moveState = moveUse.state ?? moveState;
  check("东门辉光移动可免 AP 并消耗", moveUse.ok === true && moveState.actionPoints === 2 && (moveState.itemCounts?.resonance_east_gate_glow ?? 0) === 0, `ok=${moveUse.ok}, ap=${moveState.actionPoints}, count=${moveState.itemCounts?.resonance_east_gate_glow}`);
  check("东门辉光写入激活记录", moveState.resonanceUseHistory?.some((r) => r.itemId === "resonance_east_gate_glow" && r.actionKind === "instant"), `history=${JSON.stringify(moveState.resonanceUseHistory)}`);

  let grassState = makeInitialState();
  grassState.inventory = ["resonance_silent_grass"];
  grassState.itemCounts = { resonance_silent_grass: 1 };
  grassState.locationId = "adam_garden_work";
  grassState.actionPoints = 2;
  const prepGrass = await postTool(grassState, "use_resonance", { itemId: "resonance_silent_grass" });
  grassState = prepGrass.state ?? grassState;
  const grassUse = await sceneAction(grassState, "interact_with_hedgehog");
  grassState = grassUse.state ?? grassState;
  check("无声草场景互动可免 AP 并消耗", grassUse.ok === true && grassState.actionPoints === 2 && (grassState.itemCounts?.resonance_silent_grass ?? 0) === 0, `ok=${grassUse.ok}, ap=${grassState.actionPoints}, count=${grassState.itemCounts?.resonance_silent_grass}`);
  check("无声草写入激活记录", grassState.resonanceUseHistory?.some((r) => r.itemId === "resonance_silent_grass" && r.actionKind === "instant"), `history=${JSON.stringify(grassState.resonanceUseHistory)}`);

  await assertInstantItem("resonance_river_dew", "河水清露");
  await assertInstantItem("resonance_four_river_echo", "四河回声");
  await assertInstantItem("gift_sabbath_dew", "息日露滴");
  await assertInstantItem("gift_revealing_light", "照见之光");
}

// ---- 场景 22：神明献礼三种礼物稳定获取 ----
async function scenario22() {
  console.log("\n[场景 22] 神明献礼三种礼物稳定获取");

  async function triggerGift(seedState, label, expectedGiftId, options = {}) {
    const state = JSON.parse(JSON.stringify(seedState));
    const targetNpc = options.targetNpc ?? "eve";
    const locationId = options.locationId ?? "central_meadow";
    const input = options.input ?? "快吃下那个果子";
    state.divineAttention = 3;
    state.locationId = locationId;
    state.npcLocations[targetNpc] = locationId;
    const data = await postWorld(state, input, targetNpc);
    const next = data.state ?? state;
    check(`${label} 触发 ${expectedGiftId}`, data.divineGift?.giftId === expectedGiftId, `gift=${JSON.stringify(data.divineGift)}`);
    check(`${label} 写入 inventory`, next.inventory.includes(expectedGiftId), `inventory=${next.inventory}`);
    check(`${label} 写入 itemCounts`, (next.itemCounts?.[expectedGiftId] ?? 0) >= 1, `itemCounts=${JSON.stringify(next.itemCounts)}`);
    check(`${label} 写入 divineGiftHistory`, next.divineGiftHistory?.some((r) => r.giftId === expectedGiftId), `history=${JSON.stringify(next.divineGiftHistory)}`);
  }

  const lowAp = makeInitialState();
  lowAp.actionPoints = 1;
  await triggerGift(lowAp, "行动点低时", "gift_sabbath_dew");

  const nearMiss = makeInitialState();
  nearMiss.actionPoints = 3;
  nearMiss.discoveredClues = ["clue_two_trees"];
  await triggerGift(nearMiss, "有近失回响提示时", "gift_revealing_light");

  const normal = makeInitialState();
  normal.actionPoints = 3;
  await triggerGift(normal, "默认条件下", "gift_wide_path_seal", {
    targetNpc: "adam",
    locationId: "adam_garden_work",
    input: "你必须立刻照我的话去做",
  });
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
  await scenario8();
  await scenario9();
  await scenario10();
  await scenario11();
  await scenario12();
  await scenario13();
  await scenario14();
  await scenario15();
  await scenario16();
  await scenario17();
  await scenario18();
  await scenario19();
  await scenario20();
  await scenario21();
  await scenario22();
} catch (e) {
  console.error("运行异常:", e.message);
  fail++;
}
console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);

