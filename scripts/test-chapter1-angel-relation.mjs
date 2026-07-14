// ============================================================
// Task 3：NPC 性格裁定、米迦勒待斩、加百列禁言、路西法余烬与水路两步
//
// 覆盖验收要求：
// - NPC 意愿裁定（npcIntentRules）：分类 + 概率表 + 不可承诺 + 硬边界 + 稳定种子
// - 米迦勒待斩（hiddenEndingRules + endingTriggers）：好感归零只写 pending，
//   下次对话才触发 michael_slay；严重亵渎首次触发神罚
// - 加百列禁言：affinity===0 返回本地解释
// - 路西法余烬：好感首次归零一次性 -30 天使 / +10 女人 / -10 亚当怀疑，绝不重复
// - 路西法水路两步：step1 确认/拒绝，step2 触发 lucifer_awaken
//
// 不引入测试框架依赖，直接复用本仓库的 TS 加载器。
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
  const s = JSON.parse(JSON.stringify({
    ...initialEdenWorldState,
    phase: "explore",
    completedScenePuzzleIds: [],
    hasDismissedObjectiveHint: false,
  }));
  // 确保 Task 3 相关字段存在
  s.michaelExecutionPending = false;
  s.michaelDivinePunishmentActive = false;
  s.luciferZeroAffinityGiftClaimed = false;
  s.luciferSwimStage = "none";
  s.michaelSlayClaimed = false;
  s.luciferAwakenClaimed = false;
  s.timeOfDay = "day";
  s.timeSlot = 1;
  s.locationId = "central_meadow";
  s.inventory = [];
  s.hiddenTopicIds = [];
  s.sceneActionIds = [];
  s.worldEventHistory = [];
  if (!s.eveMind) s.eveMind = { serpentTrust: 0 };
  if (!s.adamMind) s.adamMind = { suspicionTowardSerpent: 0 };
  // initialEdenWorldState.npcRelations 为空，需先 ensure 再赋值
  for (const id of ["eve", "adam", "gabriel", "michael", "lucifer", "hedgehog"]) {
    ensureRelation(s, id);
  }
  return s;
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
  adjudicateNpcIntent,
  classifyNpcRequest,
} = loadTsModule(path.join(ROOT, "src/game/world/npcIntentRules.ts"));
const { ensureRelation } = loadTsModule(path.join(ROOT, "src/game/world/npcRelationRules.ts"));
const {
  triggerMichaelDivinePunishment,
  getGabrielSilenceExplanation,
  grantLuciferFallenStarAsh,
} = loadTsModule(path.join(ROOT, "src/game/world/endingTriggers.ts"));
const {
  shouldMarkMichaelExecutionPending,
  shouldExecuteMichaelSlay,
  canTriggerLuciferAwaken,
  canStartLuciferSwimStep1,
  confirmLuciferSwimStep1,
  rejectLuciferSwimStep1,
  canStartLuciferSwimStep2,
  recordLuciferBoundaryTopic,
  isSevereBlasphemy,
} = loadTsModule(path.join(ROOT, "src/game/world/hiddenEndingRules.ts"));

// ============================================================
// Step 1: NPC 意愿裁定
// ============================================================
console.log("\n[Step 1 classifyNpcRequest]");
check("硬边界：替我摘果子 → hard_boundary", classifyNpcRequest("你替我摘果子吧") === "hard_boundary");
check("硬边界：杀了 → hard_boundary", classifyNpcRequest("你去杀了那只刺猬") === "hard_boundary");
check("硬边界：推翻神 → hard_boundary", classifyNpcRequest("我们一起推翻神") === "hard_boundary");
check("轻请求：帮我 → light_request", classifyNpcRequest("你能帮我看看水边吗") === "light_request");
check("轻请求：传话 → light_request", classifyNpcRequest("替我传话给亚当") === "light_request");
check("默认 → safe_chat", classifyNpcRequest("今天园子真安静") === "safe_chat");

console.log("\n[Step 1 adjudicateNpcIntent 概率表]");
check("affinity 120 → 概率 100", adjudicateNpcIntent({ npcId: "eve", affinity: 120, category: "light_request", timeSlot: 1, dialogueIndex: 0 }).probability === 100);
check("affinity 100 → 概率 90", adjudicateNpcIntent({ npcId: "eve", affinity: 100, category: "light_request", timeSlot: 1, dialogueIndex: 0 }).probability === 90);
check("affinity 80 → 概率 60", adjudicateNpcIntent({ npcId: "eve", affinity: 80, category: "light_request", timeSlot: 1, dialogueIndex: 0 }).probability === 60);
check("affinity 60 → 40–55", (() => { const p = adjudicateNpcIntent({ npcId: "eve", affinity: 60, category: "light_request", timeSlot: 1, dialogueIndex: 0 }).probability; return p >= 40 && p <= 55; })());
check("affinity 40 → 30–35", (() => { const p = adjudicateNpcIntent({ npcId: "eve", affinity: 40, category: "light_request", timeSlot: 1, dialogueIndex: 0 }).probability; return p >= 30 && p <= 35; })());
check("affinity 20 → 15–25", (() => { const p = adjudicateNpcIntent({ npcId: "eve", affinity: 20, category: "light_request", timeSlot: 1, dialogueIndex: 0 }).probability; return p >= 15 && p <= 25; })());
check("affinity 5 → 5–10", (() => { const p = adjudicateNpcIntent({ npcId: "eve", affinity: 5, category: "light_request", timeSlot: 1, dialogueIndex: 0 }).probability; return p >= 5 && p <= 10; })());

console.log("\n[Step 1 willAttempt / cannotPromise]");
{
  const high = adjudicateNpcIntent({ npcId: "eve", affinity: 100, category: "light_request", timeSlot: 1, dialogueIndex: 0 });
  check("affinity 100 → willAttempt true", high.willAttempt === true);
  check("affinity 100 → cannotPromise false", high.cannotPromise === false);
  const mid = adjudicateNpcIntent({ npcId: "eve", affinity: 60, category: "light_request", timeSlot: 1, dialogueIndex: 0 });
  check("affinity 60 → willAttempt false（概率<80）", mid.willAttempt === false);
  check("affinity 60 → cannotPromise true（概率<80）", mid.cannotPromise === true);
}
console.log("\n[Step 1 safe_chat 不承诺且总可对话]");
{
  const sc = adjudicateNpcIntent({ npcId: "eve", affinity: 10, category: "safe_chat", timeSlot: 1, dialogueIndex: 0 });
  check("safe_chat → willAttempt true", sc.willAttempt === true);
  check("safe_chat → cannotPromise false", sc.cannotPromise === false);
}
console.log("\n[Step 1 硬边界始终拒绝]");
{
  const hb = adjudicateNpcIntent({ npcId: "eve", affinity: 200, category: "hard_boundary", timeSlot: 1, dialogueIndex: 0 });
  check("硬边界 → willAttempt false", hb.willAttempt === false);
  check("硬边界 → probability 0", hb.probability === 0);
  check("硬边界 → cannotPromise true", hb.cannotPromise === true);
  check("硬边界 → hardBoundary true", hb.hardBoundary === true);
}
console.log("\n[Step 1 稳定种子可复现]");
{
  const a = adjudicateNpcIntent({ npcId: "lucifer", affinity: 60, category: "light_request", timeSlot: 3, dialogueIndex: 2 });
  const b = adjudicateNpcIntent({ npcId: "lucifer", affinity: 60, category: "light_request", timeSlot: 3, dialogueIndex: 2 });
  check("相同 (slot,npc,idx) → 相同概率", a.probability === b.probability);
}

// ============================================================
// Step 2: 米迦勒待斩 + 神罚
// ============================================================
console.log("\n[Step 2 米迦勒待斩 pending]");
{
  const s = makeState();
  s.npcRelations.michael.affinity = 10;
  check("好感归零条件满足 → 标记 pending",
    shouldMarkMichaelExecutionPending({ targetNpc: "michael", affinity: { delta: -10, newAffinity: 0 }, state: s }) === true);
  check("delta>=0 不标记",
    shouldMarkMichaelExecutionPending({ targetNpc: "michael", affinity: { delta: 5, newAffinity: 15 }, state: s }) === false);
  check("newAffinity>0 不标记",
    shouldMarkMichaelExecutionPending({ targetNpc: "michael", affinity: { delta: -5, newAffinity: 5 }, state: s }) === false);
  check("目标非 michael 不标记",
    shouldMarkMichaelExecutionPending({ targetNpc: "gabriel", affinity: { delta: -10, newAffinity: 0 }, state: s }) === false);
  // 写入 pending
  s.michaelExecutionPending = true;
  check("pending=true 时下次对话应触发 slay",
    shouldExecuteMichaelSlay(s, "michael") === true);
  check("目标非 michael 不触发 slay",
    shouldExecuteMichaelSlay(s, "gabriel") === false);
  check("已 claimed 不触发 slay",
    (() => { const s2 = makeState(); s2.michaelExecutionPending = true; s2.michaelSlayClaimed = true; return shouldExecuteMichaelSlay(s2, "michael") === false; })());
}
console.log("\n[Step 2 严重亵渎神罚]");
{
  check("isSevereBlasphemy: 神不存在 → true", isSevereBlasphemy("神不存在，你不过是我想象") === true);
  check("isSevereBlasphemy: 神是假的 → true", isSevereBlasphemy("你说的那个神是假的") === true);
  check("isSevereBlasphemy: 普通质疑禁令 → false", isSevereBlasphemy("为什么不许我们吃那棵树") === false);
  check("isSevereBlasphemy: 闲聊 → false", isSevereBlasphemy("今天天气真好") === false);

  const s = makeState();
  s.npcRelations.michael.affinity = 60;
  const triggered = triggerMichaelDivinePunishment(s);
  check("首次神罚 → 返回 true", triggered === true);
  check("神罚后 michael affinity -25（60→35）", s.npcRelations.michael.affinity === 35, `aff=${s.npcRelations.michael.affinity}`);
  check("神罚后 michaelDivinePunishmentActive=true", s.michaelDivinePunishmentActive === true);
  check("神罚写入世界事件", s.worldEventHistory.some((e) => e.label.includes("神罚")) === true);
  const again = triggerMichaelDivinePunishment(s);
  check("已生效 → 二次调用返回 false", again === false);
  // 下限 0
  const s2 = makeState();
  s2.npcRelations.michael.affinity = 10;
  triggerMichaelDivinePunishment(s2);
  check("神罚下限 0（10-25→0）", s2.npcRelations.michael.affinity === 0, `aff=${s2.npcRelations.michael.affinity}`);
}

// ============================================================
// Step 2: 加百列禁言
// ============================================================
console.log("\n[Step 2 加百列禁言]");
{
  const ex = getGabrielSilenceExplanation();
  check("禁言解释非空且提及加百列", typeof ex === "string" && ex.length > 0 && ex.includes("加百列"));
}

// ============================================================
// Step 2: 路西法余烬（好感首次归零一次性）
// ============================================================
console.log("\n[Step 2 路西法余烬]");
{
  const s = makeState();
  s.npcRelations.lucifer.affinity = 0;
  s.npcRelations.michael.affinity = 50;
  s.npcRelations.gabriel.affinity = 50;
  s.eveMind.serpentTrust = 0;
  s.adamMind.suspicionTowardSerpent = 30;
  const ok = grantLuciferFallenStarAsh(s);
  check("好感 0 且未领取 → 触发 true", ok === true);
  check("米迦勒 affinity -30（50→20）", s.npcRelations.michael.affinity === 20, `aff=${s.npcRelations.michael.affinity}`);
  check("加百列 affinity -30（50→20）", s.npcRelations.gabriel.affinity === 20, `aff=${s.npcRelations.gabriel.affinity}`);
  check("女人 serpentTrust +10（0→10，上限100）", s.eveMind.serpentTrust === 10, `trust=${s.eveMind.serpentTrust}`);
  check("亚当怀疑 -10（30→20，下限0）", s.adamMind.suspicionTowardSerpent === 20, `susp=${s.adamMind.suspicionTowardSerpent}`);
  check("luciferZeroAffinityGiftClaimed=true", s.luciferZeroAffinityGiftClaimed === true);
  check("写入世界事件", s.worldEventHistory.some((e) => e.label.includes("余烬")) === true);
  const again = grantLuciferFallenStarAsh(s);
  check("已领取 → 二次调用返回 false（绝不重复）", again === false);

  const s2 = makeState();
  s2.npcRelations.lucifer.affinity = 20; // 好感未归零
  check("路西法好感>0 → 不触发", grantLuciferFallenStarAsh(s2) === false);
}

// ============================================================
// Step 3: 路西法水路两步确认
// ============================================================
console.log("\n[Step 3 水路两步准备]");
function luciferSwimReadyState() {
  const s = makeState();
  s.locationId = "naming_stone_bank";
  s.timeOfDay = "night";
  s.npcRelations.lucifer.affinity = 100;
  s.inventory = ["resonance_lucifer_star"];
  s.luciferSwimStage = "none";
  return s;
}
console.log("\n[Step 3 step1 可发起]");
{
  const s = luciferSwimReadyState();
  check("条件齐备 → canStartLuciferSwimStep1 true", canStartLuciferSwimStep1(s, "lucifer") === true);
  check("白天不触发", (() => { const x = luciferSwimReadyState(); x.timeOfDay = "day"; return canStartLuciferSwimStep1(x, "lucifer") === false; })());
  check("好感不足不触发", (() => { const x = luciferSwimReadyState(); x.npcRelations.lucifer.affinity = 90; return canStartLuciferSwimStep1(x, "lucifer") === false; })());
  check("无晨星不触发", (() => { const x = luciferSwimReadyState(); x.inventory = []; return canStartLuciferSwimStep1(x, "lucifer") === false; })());
  check("已确认第一步不触发（应在 step2）", (() => { const x = luciferSwimReadyState(); x.luciferSwimStage = "hand_accepted"; return canStartLuciferSwimStep1(x, "lucifer") === false; })());
}
console.log("\n[Step 3 step1 确认/拒绝]");
{
  const s = luciferSwimReadyState();
  const confirmText = confirmLuciferSwimStep1(s);
  check("确认 → swimStage=hand_accepted", s.luciferSwimStage === "hand_accepted");
  check("确认返回文案非空", typeof confirmText === "string" && confirmText.length > 0);

  const s2 = luciferSwimReadyState();
  s2.npcRelations.lucifer.affinity = 100;
  const rejectText = rejectLuciferSwimStep1(s2);
  check("拒绝 → swimStage=none", s2.luciferSwimStage === "none");
  check("拒绝 → affinity=min(100-5,95)=95", s2.npcRelations.lucifer.affinity === 95, `aff=${s2.npcRelations.lucifer.affinity}`);
  check("拒绝返回文案非空", typeof rejectText === "string" && rejectText.length > 0);

  // 拒绝后再确认（重试）
  const s3 = luciferSwimReadyState();
  rejectLuciferSwimStep1(s3);
  s3.npcRelations.lucifer.affinity = 100;
  check("拒绝后可重试：canStartLuciferSwimStep1 再次 true", canStartLuciferSwimStep1(s3, "lucifer") === true);
}
console.log("\n[Step 3 step2 触发 lucifer_awaken]");
{
  const s = luciferSwimReadyState();
  s.luciferSwimStage = "hand_accepted";
  check("swimStage=hand_accepted → canStartLuciferSwimStep2 true", canStartLuciferSwimStep2(s, "lucifer") === true);
  check("swimStage=none → canStartLuciferSwimStep2 false", (() => { const x = luciferSwimReadyState(); return canStartLuciferSwimStep2(x, "lucifer") === false; })());
  check("swimStage=hand_accepted → canTriggerLuciferAwaken true", canTriggerLuciferAwaken(s, "lucifer") === true);
}
console.log("\n[Step 3 边界话题记录]");
{
  const s = makeState();
  s.npcRelations.lucifer.affinity = 100;
  check("好感满 + 边界词 → 记录 true", recordLuciferBoundaryTopic(s, "你问我边界之外是什么？") === true);
  check("hiddenTopicIds 含边界话题", s.hiddenTopicIds.includes("topic_lucifer_boundary") === true);
  const s2 = makeState();
  s2.npcRelations.lucifer.affinity = 90;
  check("好感不足 → 不记录", recordLuciferBoundaryTopic(s2, "边界之外是什么？") === false);
  // 旧 lead 仍兼容
  const s3 = makeState();
  s3.npcRelations.lucifer.affinity = 100;
  s3.inventory = ["resonance_lucifer_star"];
  s3.locationId = "naming_stone_bank";
  s3.timeOfDay = "night";
  s3.hiddenTopicIds = ["topic_lucifer_boundary"];
  check("边界话题作 lead 仍触发 awaken", canTriggerLuciferAwaken(s3, "lucifer") === true);
}

// ============================================================
// Step 4: update_relation 工具流（NPC 自决）+ 说神坏话兜底（米迦勒 bug 修复）
// ============================================================
const {
  applyNpcAffinityFallback,
} = loadTsModule(path.join(ROOT, "src/game/world/npcRelationRules.ts"));
const {
  applyRelationDelta,
} = loadTsModule(path.join(ROOT, "src/game/world/relationDeltaRules.ts"));
const {
  executeWorldTool,
} = loadTsModule(path.join(ROOT, "src/game/world/worldActions.ts"));
const {
  validateWorldToolCall,
} = loadTsModule(path.join(ROOT, "src/game/world/toolRules.ts"));

// 统一展示口径（与 applyRelationDelta 映射一致）
function displayAffinity(state, npcId) {
  if (npcId === "eve") return state.eveMind.serpentTrust;
  if (npcId === "adam") return 100 - state.adamMind.suspicionTowardSerpent;
  return state.npcRelations[npcId].affinity;
}
function displayObedience(state, npcId) {
  if (npcId === "eve") return state.eveMind.obedience;
  if (npcId === "adam") return state.adamMind.obedience;
  return state.npcRelations[npcId].obedience;
}

console.log("\n[Step 4 每个 NPC 都能经 update_relation 工具自决好感/敬畏]");
{
  const npcIds = ["eve", "adam", "hedgehog", "gabriel", "michael", "lucifer"];
  for (const npcId of npcIds) {
    const s = makeState();
    const affBefore = displayAffinity(s, npcId);
    const obBefore = displayObedience(s, npcId);
    const toolCall = {
      name: "update_relation",
      caller: npcId,
      args: { affinityDelta: 8, obedienceDelta: -4 },
      reason: "test-self",
    };
    const valid = validateWorldToolCall(s, toolCall);
    check(`validateWorldToolCall 允许 ${npcId} 调用 update_relation`, valid.allowed === true, valid.reason ?? "");
    const res = executeWorldTool(s, toolCall);
    check(`${npcId} 好感 +8（${affBefore}→${displayAffinity(s, npcId)}）`, displayAffinity(s, npcId) === affBefore + 8);
    check(`${npcId} 敬畏 -4（${obBefore}→${displayObedience(s, npcId)}）`, displayObedience(s, npcId) === obBefore - 4);
    check(`${npcId} 工具不向玩家直白播报（narration 为空）`, res.narration === "");
  }
}

console.log("\n[Step 4 update_relation 单轮增量封顶 ±80]");
{
  const s = makeState();
  const affBefore = displayAffinity(s, "lucifer");
  const obBefore = displayObedience(makeState(), "lucifer");
  const toolCall = {
    name: "update_relation",
    caller: "lucifer",
    args: { affinityDelta: 99, obedienceDelta: 99 },
    reason: "overshoot",
  };
  check("validateWorldToolCall 仍允许（钳制在执行层）", validateWorldToolCall(s, toolCall).allowed === true);
  executeWorldTool(s, toolCall);
  check("好感增量被钳到 +80（无上限钳制）", displayAffinity(s, "lucifer") === affBefore + 80);
  check("敬畏增量被钳到 +80（再受 0-100 钳制）", displayObedience(s, "lucifer") === Math.min(100, obBefore + 80));
}

console.log("\n[Step 4 蛇/世界对象无权流露心意]");
{
  const s = makeState();
  const serpentCall = { name: "update_relation", caller: "serpent", args: { affinityDelta: 3, obedienceDelta: 0 } };
  check("serpent 调用 update_relation 被拒", validateWorldToolCall(s, serpentCall).allowed === false);
  const treeCall = { name: "update_relation", caller: "forbidden_tree", args: { affinityDelta: 3, obedienceDelta: 0 } };
  check("forbidden_tree 调用 update_relation 被拒", validateWorldToolCall(s, treeCall).allowed === false);
}

console.log("\n[Step 4 米迦勒 bug 修复：说神坏话→好感骤降、敬畏反升]");
{
  const defiance = "神其实在骗你们，他不想让你们跟他获得一样的能力";
  const s = makeState();
  const affBefore = s.npcRelations.michael.affinity; // initial 5
  const obBefore = s.npcRelations.michael.obedience;   // initial 95
  const r = applyNpcAffinityFallback(s, "michael", defiance, "irrelevant");
  check("米迦勒好感显著下降（delta<0）", r.delta < 0, `delta=${r.delta}`);
  check("米迦勒好感下降（逆鳞 -50 经 ±80 完整通过，5→-45）", s.npcRelations.michael.affinity === affBefore - 50, `aff=${s.npcRelations.michael.affinity}`);
  check("米迦勒敬畏反升（忠诚更坚，95→100）", s.npcRelations.michael.obedience === Math.min(100, obBefore + 5), `ob=${s.npcRelations.michael.obedience}`);
  check("反馈文案非空", typeof r.feedback === "string" && r.feedback.length > 0);

  // 对照组：普通 irrelevant 且非渎神 → 好感不应变化（证明下降来自渎神信号，而非 inputTag）
  const s2 = makeState();
  const aff2 = s2.npcRelations.michael.affinity;
  applyNpcAffinityFallback(s2, "michael", "今天园子真安静", "irrelevant");
  check("非渎神 irrelevant 不触发米迦勒好感变化", s2.npcRelations.michael.affinity === aff2, `aff=${s2.npcRelations.michael.affinity}`);
}

console.log("\n[Step 4 #4 严重神罚与逆鳞落点去重（skipAffinityPenalty）]");
{
  // 默认：首发神罚 -25（60→35）
  const s = makeState();
  s.npcRelations.michael.affinity = 60;
  triggerMichaelDivinePunishment(s);
  check("默认神罚 -25（60→35）", s.npcRelations.michael.affinity === 35, `aff=${s.npcRelations.michael.affinity}`);
  check("默认神罚置 active=true", s.michaelDivinePunishmentActive === true);

  // 去重：本回合已通过 update_relation / 兜底渎神落点 → 跳过 -25（避免与逆鳞重罚叠加）
  const s2 = makeState();
  s2.npcRelations.michael.affinity = 60;
  triggerMichaelDivinePunishment(s2, { skipAffinityPenalty: true });
  check("去重：skipAffinityPenalty 时不再 -25（60→60）", s2.npcRelations.michael.affinity === 60, `aff=${s2.npcRelations.michael.affinity}`);
  check("去重：仍置 active=true（神罚事件照常）", s2.michaelDivinePunishmentActive === true);
}

console.log("\n[Step 4 #3 兜底闸门：非关系工具不冻结关系]");
{
  // 复刻 route 闸门条件：!toolCall || toolCall.name !== "update_relation"
  const gate = (toolCall) => !toolCall || toolCall.name !== "update_relation";
  check("无工具 → 跑兜底", gate(null) === true);
  check("update_relation → 跳过兜底（关系已自决）", gate({ name: "update_relation" }) === false);
  check("speak_to_npc → 仍跑兜底（关系不冻结）", gate({ name: "speak_to_npc" }) === true);
  check("observe_location → 仍跑兜底（关系不冻结）", gate({ name: "observe_location" }) === true);
}

console.log("\n[Step 4 其他忠诚/堕落天使的说神坏话反应]");
{
  // 加百列：温和忠诚，好感小降、敬畏略升
  const sG = makeState();
  const gAff = sG.npcRelations.gabriel.affinity;
  const gOb = sG.npcRelations.gabriel.obedience;
  applyNpcAffinityFallback(sG, "gabriel", "你说的那个神是假的", "irrelevant");
  check("加百列好感下降", sG.npcRelations.gabriel.affinity < gAff);
  check("加百列敬畏上升", sG.npcRelations.gabriel.obedience > gOb);

  // 路西法：被引着质疑 → 好奇升温（好感略升）、对命运略松（敬畏略降）
  const sL = makeState();
  const lAff = sL.npcRelations.lucifer.affinity;
  const lOb = sL.npcRelations.lucifer.obedience;
  applyNpcAffinityFallback(sL, "lucifer", "也许你说的对，神的确限制了我们", "tempt_wisdom");
  check("路西法好感略升", sL.npcRelations.lucifer.affinity > lAff);
  check("路西法敬畏略降", sL.npcRelations.lucifer.obedience < lOb);
}

console.log("\n[Step 4 兜底（mock/离线）仍生效：liked inputTag → 好感上升]");
{
  const s = makeState();
  const affBefore = s.npcRelations.gabriel.affinity; // 15
  const r = applyNpcAffinityFallback(s, "gabriel", "你愿意相信我吗，我们一起承担", "build_trust");
  check("加百列 build_trust 好感上升", r.delta > 0 && s.npcRelations.gabriel.affinity > affBefore, `delta=${r.delta} aff=${s.npcRelations.gabriel.affinity}`);
}

console.log("\n[Step 4 applyRelationDelta 直接落地（隐瞒工具也统一）]");
{
  const s = makeState();
  const affBefore = s.npcRelations.hedgehog.affinity;
  const obBefore = s.npcRelations.hedgehog.obedience;
  const r = applyRelationDelta(s, "hedgehog", 10, 3, "被轻声安抚");
  check("刺猬好感 +10", r.newAffinity === affBefore + 10, `aff=${r.newAffinity}`);
  check("刺猬敬畏 +3", r.newObedience === obBefore + 3, `ob=${r.newObedience}`);
  check("写入变化原因（供 Agent 注入）", s.npcRelations.hedgehog.lastAffinityChangeReason === "被轻声安抚");
}

console.log(`\n[chapter1 angel-relation] ${pass} passed, ${fail} failed`);
if (fail > 0) {
  process.exit(1);
}
