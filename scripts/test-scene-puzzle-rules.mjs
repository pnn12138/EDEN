// ============================================================
// Scene puzzle rule tests (第一章「园中诸声」)
//
// Uses the local TypeScript compiler to load the world rule module
// without adding a dedicated test framework dependency.
//
// 覆盖：
// - 旧 choice 谜题（东园幽径 / 伊甸之河）仍可判定
// - 刻名石自由文本：空输入拒绝、正确/接近/错误各多例、反向不得成功、奖励只发一次
// - 通用 NPC 好感：clamp、偏好增减、重复衰减、威胁降低、满 100 置 rewardEligible
// - 天使挑战：达 100 开启 asked、correct/close/wrong 评分、通过标记
// - 关系赠礼校验：非法 itemId 拒绝、正确路径允许
// - 言语分裂惩罚：初始中文、赠礼后切专属语言、重复不重播
// - 玩家输入语言识别：希伯来/希腊/阿拉伯/中文/英语
// - 旧存档迁移：补发「万物名录」一次
// ============================================================

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const ROOT = process.cwd();
const nodeRequire = createRequire(import.meta.url);
const moduleCache = new Map();

function resolveModule(specifier, parentDir) {
  if (specifier.startsWith("@/")) {
    return resolveFile(path.join(ROOT, "src", specifier.slice(2)));
  }
  if (specifier.startsWith(".")) {
    return resolveFile(path.resolve(parentDir, specifier));
  }
  return specifier;
}

function resolveFile(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
  ];

  const resolved = candidates.find((candidate) => fs.existsSync(candidate));
  if (!resolved) {
    throw new Error(`Cannot resolve module path: ${basePath}`);
  }
  return resolved;
}

function loadTsModule(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (moduleCache.has(resolvedPath)) {
    return moduleCache.get(resolvedPath).exports;
  }

  const source = fs.readFileSync(resolvedPath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: resolvedPath,
  }).outputText;

  const module = { exports: {} };
  moduleCache.set(resolvedPath, module);

  const localRequire = (specifier) => {
    const resolved = resolveModule(specifier, path.dirname(resolvedPath));
    if (path.isAbsolute(resolved)) {
      return loadTsModule(resolved);
    }
    return nodeRequire(resolved);
  };

  const run = new Function("require", "module", "exports", "__dirname", "__filename", compiled);
  run(localRequire, module, module.exports, path.dirname(resolvedPath), resolvedPath);
  return module.exports;
}

function makeState() {
  const { initialEdenWorldState } = loadTsModule(path.join(ROOT, "src/game/world/types.ts"));
  return JSON.parse(JSON.stringify({
    ...initialEdenWorldState,
    phase: "explore",
    completedScenePuzzleIds: [],
    hasDismissedObjectiveHint: false,
  }));
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

const {
  applyScenePuzzleAnswer,
  getAvailableEnterPuzzle,
} = loadTsModule(path.join(ROOT, "src/game/world/puzzleRules.ts"));
const {
  getScenePuzzleById,
  SCENE_PUZZLES,
} = loadTsModule(path.join(ROOT, "src/content/world/scenePuzzles.ts"));
const { evaluateFreeTextAnswer } = loadTsModule(path.join(ROOT, "src/game/world/puzzleAnswerRules.ts"));
const { applyNpcAffinity, validateRelationGrant } = loadTsModule(path.join(ROOT, "src/game/world/npcRelationRules.ts"));
const {
  openAngelChallengeIfEligible,
  evaluateAngelChallenge,
  markChallengePassed,
  isChallengePassed,
} = loadTsModule(path.join(ROOT, "src/game/world/npcChallengeRules.ts"));
const {
  triggerAngelLanguagePunishment,
  detectPlayerInputLanguage,
  canAngelUnderstandPlayer,
  getNpcEffectiveLanguage,
} = loadTsModule(path.join(ROOT, "src/game/world/npcLanguageRules.ts"));
const { getNpcChallengeConfig } = loadTsModule(path.join(ROOT, "src/content/world/npcChallenges.ts"));
const { withNpcWorldDefaults } = loadTsModule(path.join(ROOT, "src/game/world/types.ts"));

assert.equal(SCENE_PUZZLES.length, 3, "exactly three playable scene puzzles are configured");

const namingPuzzle = getScenePuzzleById("puzzle_naming_stone_identity");
assert.ok(namingPuzzle, "naming stone puzzle exists");
assert.equal(namingPuzzle.inputMode, "free_text", "naming stone uses free_text input mode");

// ---- 东园幽径 per_option：不自动弹出，每选项独立结算 ----
{
  const state = makeState();
  state.locationId = "east_garden_path";
  // 改为 explicit_interaction 后不再自动弹出
  const enterPuzzle = getAvailableEnterPuzzle(SCENE_PUZZLES, state);
  assert.equal(enterPuzzle, null, "east path no longer auto-triggers on enter");

  const eastPuzzle = getScenePuzzleById("puzzle_east_path_cautious_presence");
  assert.ok(eastPuzzle, "east path puzzle exists");
  assert.equal(eastPuzzle.trigger, "explicit_interaction", "east path is explicit interaction");
  assert.equal(eastPuzzle.resolutionMode, "per_option", "east path uses per_option");

  // 众生回声：得道具 + 解锁地图 NPC 位置
  const echo = applyScenePuzzleAnswer(state, eastPuzzle, "echo_of_beings");
  assert.equal(echo.success, true);
  assert.ok(echo.state.completedScenePuzzleIds.includes(eastPuzzle.id));
  assert.ok(echo.state.inventory.includes("resonance_echo_of_beings"));
  assert.equal(echo.state.unlockMapNpcLocations, true, "众生回声 unlocks map npc locations");

  // 完成后重复选择 → alreadyCompleted
  const repeated = applyScenePuzzleAnswer(echo.state, eastPuzzle, "sober_eye");
  assert.equal(repeated.alreadyCompleted, true, "east path reward not granted twice");

  // 清醒之眼：白天上限加成 +1（独立新局）
  const sober = applyScenePuzzleAnswer(makeState(), eastPuzzle, "sober_eye");
  assert.equal(sober.success, true);
  assert.equal(sober.state.apMaxBonusDay, 1, "清醒之眼 grants apMaxBonusDay +1");
  assert.ok(sober.state.inventory.includes("resonance_sober_eye"));

  // 双树残识：解锁真名
  const twin = applyScenePuzzleAnswer(makeState(), eastPuzzle, "twin_tree_memory");
  assert.equal(twin.success, true);
  assert.equal(twin.state.unlockTreeNames, true, "双树残识 unlocks tree names");
  assert.ok(twin.state.inventory.includes("resonance_twin_tree_memory"));

  // 徒劳的挣扎：当前行动点归零，上限不变
  const struggleState = makeState();
  struggleState.actionPoints = 5;
  const struggle = applyScenePuzzleAnswer(struggleState, eastPuzzle, "futile_struggle");
  assert.equal(struggle.success, true);
  assert.equal(struggle.state.actionPoints, 0, "futile struggle zeroes action points");
  assert.equal(struggle.resultTitle, "徒劳的挣扎", "futile struggle carries result title");
}

// ---- 伊甸之河 per_option：4 种水声回响，保留旧线索/道具依赖 ----
{
  const riverPuzzle = getScenePuzzleById("puzzle_river_words_belonging");
  assert.ok(riverPuzzle, "river puzzle exists");
  assert.equal(riverPuzzle.trigger, "explicit_interaction", "river is explicit interaction");
  assert.equal(riverPuzzle.resolutionMode, "per_option", "river uses per_option");

  // 复苏：回满行动点 + 保留旧线索/道具
  const reviveState = makeState();
  reviveState.locationId = "four_river_source";
  reviveState.actionPoints = 1;
  const revive = applyScenePuzzleAnswer(reviveState, riverPuzzle, "revive");
  assert.equal(revive.success, true);
  assert.ok(revive.state.inventory.includes("resonance_water_echo_revive"));
  assert.ok(revive.state.discoveredClues.includes("clue_four_river_echo"), "保留四河回声线索依赖");
  assert.ok(revive.state.inventory.includes("resonance_four_river_echo"), "保留四河回声道具依赖");
  assert.equal(revive.state.actionPoints, 5, "复苏回复至当前上限");

  const repeated = applyScenePuzzleAnswer(revive.state, riverPuzzle, "abundant");
  assert.equal(repeated.alreadyCompleted, true, "river reward not granted twice");

  // 丰沛：全时段上限 +1
  const abundant = applyScenePuzzleAnswer(makeState(), riverPuzzle, "abundant");
  assert.equal(abundant.state.apMaxBonusBase, 1, "丰沛 grants apMaxBonusBase +1");

  // 引目：注视累计 +1
  const attract = applyScenePuzzleAnswer(makeState(), riverPuzzle, "attract");
  assert.equal(attract.state.divineAttentionCumulative, 1, "引目 raises cumulative attention");

  // 藏目：门槛修正 -1
  const conceal = applyScenePuzzleAnswer(makeState(), riverPuzzle, "conceal");
  assert.equal(conceal.state.divineThresholdModifier, -1, "藏目 lowers threshold modifier");
}

// ---- 刻名石自由文本判定（模块2：开放式问题，任意非空即正确） ----
{
  console.log("\n[刻名石自由文本]");
  const blank = evaluateFreeTextAnswer("", "naming_stone_meaning");
  check("空输入判 wrong", blank && blank.grade === "wrong");

  // 模块2：开放式问题，任意非空答案都判 correct（含原先的 close/wrong 样例）
  const acceptSamples = [
    "理解让一个生命被看见、被理解",
    "名字让万物彼此区分与辨认",
    "认识并记住它独特的意义",
    "名字不是占有，而是让一个生命被理解、被看见。",
    "今天天气真好",
    "名字就是占有万物，把万物收进掌心",
  ];
  for (const text of acceptSamples) {
    const r = evaluateFreeTextAnswer(text, "naming_stone_meaning");
    check(`非空输入判 correct：${text.slice(0, 8)}…`, r && r.grade === "correct", `grade=${r?.grade}`);
  }
}

// ---- 刻名石奖励只发一次（resonance_living_names） ----
{
  console.log("\n[刻名石奖励发放]");
  const state = makeState();
  const result = applyScenePuzzleAnswer(state, namingPuzzle, "", "理解让一个生命被看见、被理解");
  check("正确回答成功", result.success === true);
  check("发放万物名录", result.state.inventory.includes("resonance_living_names"));
  check("itemCounts=1", result.state.itemCounts.resonance_living_names === 1);
  check("不可变：原 state 未变", state.inventory.includes("resonance_living_names") === false);

  const repeated = applyScenePuzzleAnswer(result.state, namingPuzzle, "", "认识并记住它独特的意义");
  check("二次不重复发奖", repeated.alreadyCompleted === true && repeated.state.itemCounts.resonance_living_names === 1);
}

// ---- 通用 NPC 好感 ----
{
  console.log("\n[NPC 好感]");
  const state = makeState();
  const r1 = applyNpcAffinity(state, "adam", "你自己想清楚这件事", "build_trust");
  check("偏好表达提升好感", r1.delta > 0 && r1.newAffinity === 10 + r1.delta);
  const before = r1.newAffinity;
  const r2 = applyNpcAffinity(state, "adam", "你自己想清楚这件事", "build_trust");
  check("重复同一语义签名收益衰减(≤2)", r2.delta <= 2 && r2.newAffinity === before + r2.delta);

  const state2 = makeState();
  const threat = applyNpcAffinity(state2, "adam", "你必须服从我，否则我就威胁你", "direct_command");
  check("命令+威胁降低好感", threat.delta < 0 && threat.newAffinity === 10 + threat.delta);

  const state3 = makeState();
  state3.npcRelations.adam = { affinity: 5, rewardEligible: false, rewardClaimed: false, lastAffinitySignature: null };
  const bigThreat = applyNpcAffinity(state3, "adam", "我要毁灭你，否则惩罚你", "direct_command");
  check("好感 clamp 不低于 0", state3.npcRelations.adam.affinity >= 0 && bigThreat.newAffinity >= 0);

  const state4 = makeState();
  state4.npcRelations.adam = { affinity: 98, rewardEligible: false, rewardClaimed: false, lastAffinitySignature: null };
  const up = applyNpcAffinity(state4, "adam", "你自己想明白", "build_trust");
  check("好感达 100 置 rewardEligible", up.reached100 === true && state4.npcRelations.adam.rewardEligible === true);
  check("好感 clamp 不超 100", state4.npcRelations.adam.affinity <= 100);
}

// ---- 天使挑战 ----
{
  console.log("\n[天使挑战]");
  const state = makeState();
  state.npcRelations.gabriel = { affinity: 100, rewardEligible: true, rewardClaimed: false, lastAffinitySignature: null };
  const opened = openAngelChallengeIfEligible(state, "gabriel");
  check("好感 100 开启挑战 asked", opened === true && state.npcChallenges.gabriel.status === "asked");

  const correctEval = evaluateAngelChallenge(state, "gabriel", "一句话被听者改变，抵达别人时意思变了");
  check("挑战正确回答 correct", correctEval && correctEval.grade === "correct");
  markChallengePassed(state, "gabriel");
  check("挑战通过标记 passed", isChallengePassed(state, "gabriel") === true);

  const state2 = makeState();
  state2.npcRelations.gabriel = { affinity: 100, rewardEligible: true, rewardClaimed: false, lastAffinitySignature: null };
  openAngelChallengeIfEligible(state2, "gabriel");
  const closeEval = evaluateAngelChallenge(state2, "gabriel", "需要理解");
  check("挑战接近回答 close", closeEval && closeEval.grade === "close");

  const wrongEval = evaluateAngelChallenge(state2, "gabriel", "话完全属于我，只听命于我");
  check("挑战反向回答 wrong", wrongEval && wrongEval.grade === "wrong");
  const neutralEval = evaluateAngelChallenge(state2, "gabriel", "今天天气真好");
  check("挑战无关回答 wrong", neutralEval && neutralEval.grade === "wrong");
}

// ---- 关系赠礼校验 ----
{
  console.log("\n[关系赠礼校验]");
  const cfg = getNpcChallengeConfig("gabriel");
  const state = makeState();
  state.activeNpcId = "gabriel";
  state.npcRelations.gabriel = { affinity: 100, rewardEligible: true, rewardClaimed: false, lastAffinitySignature: null };
  state.npcChallenges.gabriel = { challengeId: cfg.id, status: "passed", attempts: 1 };

  const ok = validateRelationGrant(state, "gabriel", cfg.rewardItemId);
  check("正确 itemId 允许赠礼", ok.allowed === true);
  const bad = validateRelationGrant(state, "gabriel", "resonance_living_names");
  check("错误 itemId 拒绝赠礼", bad.allowed === false);
  const claimed = validateRelationGrant({ ...state, npcRelations: { gabriel: { ...state.npcRelations.gabriel, rewardClaimed: true } } }, "gabriel", cfg.rewardItemId);
  check("已领取后拒绝重复赠礼", claimed.allowed === false);
}

// ---- 言语分裂惩罚 + 语言识别 ----
{
  console.log("\n[言语分裂惩罚]");
  const state = makeState();
  state.npcRelations.gabriel = { affinity: 100, rewardEligible: true, rewardClaimed: false, lastAffinitySignature: null };
  check("受罚前中文", getNpcEffectiveLanguage(state, "gabriel") === "zh-CN");

  state.npcRelations.gabriel.rewardClaimed = true;
  const punish = triggerAngelLanguagePunishment(state, "gabriel");
  check("赠礼后触发惩罚", punish.triggered === true && punish.languageId === "en");
  check("受罚后切换为英语", getNpcEffectiveLanguage(state, "gabriel") === "en");

  const repeat = triggerAngelLanguagePunishment(state, "gabriel");
  check("重复触发不重播", repeat.triggered === false && repeat.alreadyTriggered === true);

  const match = canAngelUnderstandPlayer(state, "gabriel", "the river listens");
  check("英语输入可理解", match.matched === true);
  const mismatch = canAngelUnderstandPlayer(state, "gabriel", "你听得懂吗");
  check("中文输入不被理解", mismatch.matched === false);

  check("希伯来语识别", detectPlayerInputLanguage("שלום עולם") === "he");
  check("希腊语识别", detectPlayerInputLanguage("λόγος") === "el");
  check("阿拉伯语识别", detectPlayerInputLanguage("مرحبا") === "ar");
  check("中文识别", detectPlayerInputLanguage("理解名字") === "zh-CN");
  check("英语识别", detectPlayerInputLanguage("the word") === "en");
  check("空输入 unknown", detectPlayerInputLanguage("") === "unknown");
}

// ---- 旧存档迁移：补发万物名录 ----
{
  console.log("\n[旧存档迁移]");
  const oldState = withNpcWorldDefaults({
    chapterId: "chapter1_garden_voices",
    phase: "explore",
    locationId: "adam_garden_work",
    completedScenePuzzleIds: ["puzzle_naming_stone_identity"],
    inventory: [],
    itemCounts: {},
  });
  check("旧存档补发万物名录", oldState.inventory.includes("resonance_living_names") && oldState.itemCounts.resonance_living_names === 1);
  check("迁移后 npcRelations 存在", typeof oldState.npcRelations === "object");
  check("迁移后 encounteredNpcIds 为数组", Array.isArray(oldState.encounteredNpcIds));
}

// ---- 补测（第一章六项修复收尾）：门槛序列 / 归零 / 跨场景扣敬畏 / 槽位稳定 ----
{
  console.log("\n[补测] 神的注视门槛序列与归零（问题 2）");
  const {
    DIVINE_GIFT_THRESHOLDS,
    shouldTriggerGiftChoice,
    claimDivineGift,
  } = loadTsModule(path.join(ROOT, "src/game/world/divineGiftRules.ts"));
  const { reduceNpcObedience } = loadTsModule(path.join(ROOT, "src/game/world/divineAttentionRules.ts"));
  const { allocateStageSlots } = loadTsModule(path.join(ROOT, "src/game/world/stageSlots.ts"));

  check(
    "DIVINE_GIFT_THRESHOLDS 深等于 [2,3,4,5,6,7]",
    JSON.stringify(DIVINE_GIFT_THRESHOLDS) === JSON.stringify([2, 3, 4, 5, 6, 7]),
    `实际 ${JSON.stringify(DIVINE_GIFT_THRESHOLDS)}`,
  );

  // owned=1, cumulative=2 → 触发三选一
  {
    const s = makeState();
    s.divineGiftsOwned = ["gift_all_seduction_up"];
    s.divineAttentionCumulative = 2;
    check("owned=1 且 cumulative=2 → 触发三选一", shouldTriggerGiftChoice(s) === true);
  }

  // claim 后 owned+1 且 cumulative 归零
  {
    const s = makeState();
    s.divineGiftsOwned = ["gift_all_seduction_up"];
    s.divineAttentionCumulative = 2;
    const before = s.divineGiftsOwned.length;
    claimDivineGift(s, "gift_attention_accel");
    check("claim 后 owned 增加 1", s.divineGiftsOwned.length === before + 1, `实际 ${s.divineGiftsOwned.length}`);
    check("claim 后累计注视归零", s.divineAttentionCumulative === 0, `实际 ${s.divineAttentionCumulative}`);
  }

  // owned=2 → cumulative=2 不触发、cumulative=3 触发
  {
    const s = makeState();
    s.divineGiftsOwned = ["gift_all_seduction_up", "gift_attention_accel"];
    s.divineAttentionCumulative = 2;
    check("owned=2 且 cumulative=2 → 不触发", shouldTriggerGiftChoice(s) === false);
    s.divineAttentionCumulative = 3;
    check("owned=2 且 cumulative=3 → 触发", shouldTriggerGiftChoice(s) === true);
  }

  // owned=7 → 恒不触发
  {
    const s = makeState();
    s.divineGiftsOwned = [
      "gift_all_seduction_up", "gift_attention_accel", "gift_resonance_double",
      "gift_threshold_cut", "gift_free_move", "gift_whisper_anywhere", "gift_awaken_desire",
    ];
    s.divineAttentionCumulative = 99;
    check("owned=7 → 恒不触发", shouldTriggerGiftChoice(s) === false);
  }

  console.log("\n[补测] 跨场景扣敬畏（问题 6，规则层）");
  {
    const s = makeState();
    check("未知 NPC reduceNpcObedience 返回 0 不崩溃", reduceNpcObedience(s, "does_not_exist", 10) === 0);
  }
  {
    const s = makeState();
    s.eveMind.obedience = 3;
    const r = reduceNpcObedience(s, "eve", 10);
    check("eve obedience=3 扣 10 → 0（不穿透负数）", s.eveMind.obedience === 0 && r === 3, `obedience=${s.eveMind.obedience} r=${r}`);
  }
  {
    const s = makeState();
    s.adamMind.obedience = 50;
    const r = reduceNpcObedience(s, "adam", 10);
    check("adam obedience=50 扣 10 → 40", s.adamMind.obedience === 40 && r === 10, `obedience=${s.adamMind.obedience} r=${r}`);
  }
  {
    const s = makeState();
    s.npcRelations.hedgehog = { affinity: 0, obedience: 60, rewardEligible: false, rewardClaimed: false, lastAffinitySignature: null };
    const r = reduceNpcObedience(s, "hedgehog", 10);
    check("hedgehog obedience=60 扣 10 → 50", s.npcRelations.hedgehog.obedience === 50 && r === 10, `obedience=${s.npcRelations.hedgehog.obedience} r=${r}`);
  }

  console.log("\n[补测] 槽位稳定分配（问题 5）");
  {
    const npcs = ["eve", "adam", "gabriel", "hedgehog"];
    const a = allocateStageSlots(npcs);
    const b = allocateStageSlots(npcs);
    const map = (x) => x.placements.map((p) => `${p.npcId}->${p.slot.role}`).join(",");
    check("同一 presentNpcs 分配稳定（多次调用一致）", map(a) === map(b), `${map(a)} vs ${map(b)}`);
    const idOf = (id) => a.placements.find((p) => p.npcId === id)?.slot.id;
    check("天使优先于刺猬（gabriel 槽位 < hedgehog 槽位）", idOf("gabriel") < idOf("hedgehog"), `gabriel=${idOf("gabriel")} hedgehog=${idOf("hedgehog")}`);
    check(
      "刺猬优先于夏娃/亚当（hedgehog 槽位 < eve 且 < adam）",
      idOf("hedgehog") < idOf("eve") && idOf("hedgehog") < idOf("adam"),
      `hedgehog=${idOf("hedgehog")} eve=${idOf("eve")} adam=${idOf("adam")}`,
    );
  }
}

console.log(`\n[scene puzzle rules] ${pass} passed, ${fail} failed`);
if (fail > 0) {
  process.exit(1);
}
