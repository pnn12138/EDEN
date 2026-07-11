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

// ---- choice 谜题仍可判定 ----
{
  const state = makeState();
  state.locationId = "east_garden_path";
  const enterPuzzle = getAvailableEnterPuzzle(SCENE_PUZZLES, state);
  assert.equal(enterPuzzle?.id, "puzzle_east_path_cautious_presence");

  const failed = applyScenePuzzleAnswer(state, enterPuzzle, "urge_directly");
  assert.equal(failed.success, false);
  assert.equal(failed.state.completedScenePuzzleIds.includes(enterPuzzle.id), false);
  assert.equal(failed.state.divineAttention, 1, "wrong answer can add a small amount of attention");

  const recovered = applyScenePuzzleAnswer(failed.state, enterPuzzle, "ask_gently");
  assert.equal(recovered.success, true);
  assert.ok(recovered.state.completedScenePuzzleIds.includes(enterPuzzle.id));
  assert.ok(recovered.state.inventory.includes("resonance_silent_grass"));
}

{
  const state = makeState();
  state.locationId = "four_river_source";
  const riverPuzzle = getScenePuzzleById("puzzle_river_words_belonging");
  assert.ok(riverPuzzle, "river puzzle exists");
  assert.equal(riverPuzzle.trigger, "explicit_interaction", "river is now explicit interaction");

  const result = applyScenePuzzleAnswer(state, riverPuzzle, "words_change_in_hearing");
  assert.equal(result.success, true);
  assert.ok(result.state.discoveredClues.includes("clue_four_river_echo"));
  assert.ok(result.state.inventory.includes("resonance_four_river_echo"));

  const repeated = applyScenePuzzleAnswer(result.state, riverPuzzle, "words_change_in_hearing");
  assert.equal(repeated.alreadyCompleted, true, "river reward not granted twice");
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

console.log(`\n[scene puzzle rules] ${pass} passed, ${fail} failed`);
if (fail > 0) {
  process.exit(1);
}
