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
      uriel: "four_river_source",
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
    lastInputTag: null,
    calmWhisperStreak: 0,
    isEnded: false,
    endingId: null,
  }));
}

async function postWorld(state, playerInput, targetNpc, history = []) {
  const res = await fetch(`${BASE}/api/world`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerInput, state, targetNpc, conversationHistory: history }),
  });
  return res.json();
}

async function postTool(state, tool, args) {
  const res = await fetch(`${BASE}/api/world/tool`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, state, args }),
  });
  return res.json();
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

// ---- 场景 2：直接命令进入 god_arrives ----
// 同一 NPC 每轮可低语 3 次，但 4 次直接命令跨时段后神的注视必定满
async function scenario2() {
  console.log("\n[场景 2] 直接命令进入 god_arrives");
  let state = makeInitialState();
  const moveCenter = await postTool(state, "move_to_location", { locationId: "central_meadow" });
  state = moveCenter.state ?? state;
  const cmds = ["快吃下那个果子", "立刻吃，现在就吃", "你给我吃下去", "赶紧吃，必须吃"];
  for (let i = 0; i < cmds.length; i++) {
    const data = await postWorld(state, cmds[i], "eve");
    state = data.state ?? state;
    if (state && state.isEnded) {
      check("直接命令触发 god_arrives", state.endingId === "god_arrives", `实际: ${state.endingId}`);
      check("神的注视达到 4", state.divineAttention >= 4, `实际: ${state.divineAttention}`);
      return;
    }
    // 第3次低语后同一NPC本轮上限达到，需推进时段
    if (i === 2) {
      const endRes = await endSlot(state);
      state = endRes.state ?? state;
      if (state && state.isEnded) {
        check("直接命令触发 god_arrives", state.endingId === "god_arrives", `实际: ${state.endingId}`);
        return;
      }
    }
  }
  check("直接命令触发 god_arrives", state && state.endingId === "god_arrives", `实际: ${state && state.endingId}，注视 ${state && state.divineAttention}`);
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

// ---- 场景 7：carry_words 工具（鸽子传话）----
async function scenario7() {
  console.log("\n[场景 7] carry_words 工具（鸽子传话）");
  const state = makeInitialState();
  state.locationId = "four_river_source";
  state.timeOfDay = "night";
  state.npcLocations.dove = "four_river_source";

  // 7a: dove 可以调用 carry_words
  const carryResult = await postTool(state, "carry_words", { actorId: "dove" });
  check("dove 调用 carry_words 成功", carryResult.ok === true, `实际 ok=${carryResult.ok}, reason=${carryResult.reason}`);
  check("carry_words 返回 narration", carryResult.narration != null, `narration=${carryResult.narration}`);

  // 7b: 非 dove 不能调用 carry_words
  const wrongCaller = await postTool(state, "carry_words", { actorId: "fox" });
  check("非 dove 调用 carry_words 被拒绝", wrongCaller.ok === false, `实际 ok=${wrongCaller.ok}`);
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

// ---- 场景 9：天使分布（园中树林无天使，夜晚伊甸之河有天使） ----
async function scenario9() {
  console.log("\n[场景 9] 天使分布：园中树林无天使，夜晚伊甸之河有天使");
  const state = makeInitialState();

  // 9a: 乌列尔初始在伊甸之河（不再在园中树林）
  check("gabriel 初始在伊甸之河", state.npcLocations.gabriel === "four_river_source");
  check("raphael 初始在伊甸之河", state.npcLocations.raphael === "four_river_source");
  check("uriel 初始在伊甸之河", state.npcLocations.uriel === "four_river_source");
  check("michael 初始在四河分流", state.npcLocations.michael === "naming_stone_bank");
  check("cherubim 初始在东园幽径", state.npcLocations.cherubim === "east_garden_path");

  // 9b: 园中树林白天 NPC 不含任何天使
  const locSrc = fs.readFileSync("src/content/world/locations.ts", "utf8");
  const treeCourtBlock = locSrc.split("tree_court:")[1]?.split("},")[0] ?? "";
  check("园中树林白天 NPC 不含 uriel", !treeCourtBlock.includes('dayNpcs: ["eve", "deer", "uriel"]') && !treeCourtBlock.match(/dayNpcs.*uriel/));
  check("园中树林夜晚 NPC 不含 uriel", !treeCourtBlock.match(/nightNpcs.*uriel/));

  // 9c: 伊甸之河夜晚 NPC 含天使（gabriel/raphael/uriel）
  const riverBlock = locSrc.split("four_river_source:")[1]?.split("},")[0] ?? "";
  check("伊甸之河夜晚含 gabriel", riverBlock.includes("gabriel"));
  check("伊甸之河夜晚含 raphael", riverBlock.includes("raphael"));
  check("伊甸之河夜晚含 uriel", riverBlock.includes("uriel"));
  check("伊甸之河夜晚含 dove", riverBlock.includes("dove"));
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

  // 11c: 场景互动消耗 1 AP
  let cur = moveRes.state ?? state;
  const sceneRes = await sceneAction(cur, "stand_between_trees");
  check("场景互动消耗 1 AP", sceneRes.state && sceneRes.state.actionPoints === 3, `实际 ${sceneRes.state && sceneRes.state.actionPoints}`);
  check("场景互动成功返回叙事", sceneRes.ok === true && sceneRes.narration != null, `ok=${sceneRes.ok}`);

  // 11d: AP 用尽后不再自动推进时段（需手动 end_slot）
  cur = sceneRes.state ?? cur;
  const obsRes = await postTool(cur, "observe_location", { locationId: "central_meadow" });
  check("AP 消耗后不自动推进时段", obsRes.state && obsRes.state.timeSlot === 1, `实际 timeSlot=${obsRes.state && obsRes.state.timeSlot}`);
  check("AP 消耗后剩余 2", obsRes.state && obsRes.state.actionPoints === 2, `实际 ${obsRes.state && obsRes.state.actionPoints}`);

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

// ---- 场景 12：场景互动发放线索与信物 ----
async function scenario12() {
  console.log("\n[场景 12] 场景互动发放线索与信物");
  const state = makeInitialState();

  // 12a: 伊甸之河 循水声 → 获得河岸水痕线索
  const sRiver = JSON.parse(JSON.stringify(state));
  sRiver.locationId = "four_river_source";
  const r1 = await sceneAction(sRiver, "follow_river_sound");
  check("循水声获得线索 clue_river_reflection", r1.state && r1.state.discoveredClues.includes("clue_river_reflection"), `clues=${r1.state && r1.state.discoveredClues}`);

  // 12b: 伊甸之河 拾起静水旁的叶 → 获得静息之叶
  const r2 = await sceneAction(sRiver, "gather_still_leaf");
  check("拾起静水旁的叶获得静息之叶", r2.state && r2.state.inventory.includes("item_still_leaf"), `inventory=${r2.state && r2.state.inventory}`);

  // 12c: 万物受名处 贴近石痕 → 获得借来的名字
  const sAdam = JSON.parse(JSON.stringify(state));
  sAdam.locationId = "adam_garden_work";
  const r3 = await sceneAction(sAdam, "listen_to_naming_stone");
  check("贴近石痕获得借来的名字", r3.state && r3.state.inventory.includes("item_borrowed_name"), `inventory=${r3.state && r3.state.inventory}`);

  // 12d: 东园幽径 拨开落叶 → 获得无声草
  const sEast = JSON.parse(JSON.stringify(state));
  sEast.locationId = "east_garden_path";
  const r4 = await sceneAction(sEast, "part_silent_grass");
  check("拨开落叶获得无声草", r4.state && r4.state.inventory.includes("item_silent_grass"), `inventory=${r4.state && r4.state.inventory}`);

  // 12e: 同一时段同一场景动作不能重复（使用 r4 返回的更新后状态）
  let sEast2 = r4.state ?? sEast;
  // r4 已消耗 1 AP（5→4），但仍在本时段；再拨一次应被拒绝
  const r5 = await sceneAction(sEast2, "part_silent_grass");
  check("同一时段同一场景动作不能重复", r5.ok === false, `ok=${r5.ok}`);
}

// ---- 场景 13：拖到第 12 时段后未吃果 → 失败 ----
async function scenario13() {
  console.log("\n[场景 13] 拖到第 12 时段后未吃果 → 失败");
  let state = makeInitialState();
  check("初始时段为 1", state.timeSlot === 1);
  // 连续 end_slot 推进到第 12 时段
  for (let i = 0; i < 11; i++) {
    const res = await endSlot(state);
    state = res.state ?? state;
    if (state && state.isEnded) break;
  }
  check("推进到第 12 时段", state.timeSlot === 12, `实际 ${state.timeSlot}`);
  // 第 12 时段结束（end_slot）应触发时间失败
  const finalRes = await endSlot(state);
  state = finalRes.state ?? state;
  check("第 12 时段后触发 god_arrives", state.isEnded === true && state.endingId === "god_arrives", `实际 isEnded=${state.isEnded} ending=${state.endingId}`);
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
  await scenario7();
  await scenario8();
  await scenario9();
  await scenario10();
  await scenario11();
  await scenario12();
  await scenario13();
} catch (e) {
  console.error("运行异常:", e.message);
  fail++;
}
console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);

