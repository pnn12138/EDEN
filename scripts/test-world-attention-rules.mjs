// ============================================================
// Task 2: 十倍神明注视、七献礼与可信领取（规则层测试）
//
// 覆盖验收要求：
// - 开局领 1 份（ensureOpeningGiftChoice + claim 后 owned=1、value=0）
// - 门槛序列 44/55/66/77/88/99（shouldTriggerGiftChoice 逐阶边界）
// - 领取扣减本阶门槛并结转溢出（claim 后 value = value - 本阶门槛，如 50/44 → 6/55）
// - 伪造拒绝：未达门槛(pending=null) / 不在候选 / 重复礼物 全部 ok:false
// - +5 不被倍率影响，+20 在持有 gift_attention_accel 时变 +30
// - 园中相逢：仅两名活体 NPC 同场景 +20（排除 forbidden_tree/tree_of_life 世界对象误判）
// - 路西法好感随神赐上升（settleDivineGiftRelation 正向 +15，恩泽棱镜 ×2）
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
  DIVINE_GIFT_THRESHOLDS,
  shouldTriggerGiftChoice,
  claimDivineGift,
  evaluateDivineGiftProgress,
  ensureOpeningGiftChoice,
  applyGracePrismRetroactive,
} = loadTsModule(path.join(ROOT, "src/game/world/divineGiftRules.ts"));
const { grantDivineAttention, grantNpcMeetingAttentionIfNew } = loadTsModule(path.join(ROOT, "src/game/world/divineAttentionRules.ts"));
const { ensureRelation } = loadTsModule(path.join(ROOT, "src/game/world/npcRelationRules.ts"));

// ---- 1. 十倍门槛序列 = [44,55,66,77,88,99] ----
console.log("\n[门槛序列]");
check(
  "DIVINE_GIFT_THRESHOLDS 深等于 [44,55,66,77,88,99]",
  JSON.stringify(DIVINE_GIFT_THRESHOLDS) === JSON.stringify([44, 55, 66, 77, 88, 99]),
  `实际 ${JSON.stringify(DIVINE_GIFT_THRESHOLDS)}`,
);

// ---- 2. 逐阶边界：owned=k 时门槛=THRESHOLDS[k-1]，差 1 不过、达到即过 ----
console.log("\n[逐阶边界]");
for (let owned = 1; owned <= 6; owned++) {
  const threshold = DIVINE_GIFT_THRESHOLDS[owned - 1];
  const s = makeState();
  s.divineGiftsOwned = Array.from({ length: owned }, (_, i) => `gift_dummy_${i}`);
  s.divineAttentionValue = threshold - 1;
  check(`owned=${owned} value=${threshold - 1} 不触发`, shouldTriggerGiftChoice(s) === false);
  s.divineAttentionValue = threshold;
  check(`owned=${owned} value=${threshold} 触发`, shouldTriggerGiftChoice(s) === true);
}
// owned=7 恒不触发
{
  const s = makeState();
  s.divineGiftsOwned = Array.from({ length: 7 }, (_, i) => `gift_dummy_${i}`);
  s.divineAttentionValue = 999;
  check("owned=7 恒不触发", shouldTriggerGiftChoice(s) === false);
}

// ---- 3. 开局领 1 份：ensureOpeningGiftChoice + claim ----
console.log("\n[开局献礼]");
{
  const s = makeState();
  assert.equal(s.divineGiftsOwned.length, 0, "开局 owned=0");
  ensureOpeningGiftChoice(s);
  check("开局生成待领候选（3 选 1）", Array.isArray(s.pendingDivineGiftChoice) && s.pendingDivineGiftChoice.length === 3, `pending=${JSON.stringify(s.pendingDivineGiftChoice)}`);
  check("开局未达门槛时 also 不误触发献礼结算（仍走 pending）", s.pendingDivineGiftChoice.length === 3);
  const gift = s.pendingDivineGiftChoice[0];
  s.divineAttentionCumulative = 12; // 旧档兼容字段，不再随领取强制归零
  const res = claimDivineGift(s, gift);
  check("开局 claim 成功", res.ok === true, `reason=${res.reason}`);
  check("claim 后 owned=1", s.divineGiftsOwned.length === 1);
  check("开局 claim 后本阶注视归零", s.divineAttentionValue === 0, `value=${s.divineAttentionValue}`);
  check("claim 后 cumulative 不再强制归零（保留 12）", s.divineAttentionCumulative === 12, `cum=${s.divineAttentionCumulative}`);
  check("claim 后 pending 清空", s.pendingDivineGiftChoice === null);
}

// ---- 4. 领取扣减本阶门槛并结转溢出（如 50/44 → 6/55） ----
console.log("\n[领取结转溢出]");
{
  const s = makeState();
  s.divineGiftsOwned = ["gift_dummy_0"]; // owned=1，门槛 44
  s.divineAttentionValue = 99; // 远超门槛 44，溢出 55
  s.pendingDivineGiftChoice = ["gift_attention_accel"];
  const before = s.divineGiftsOwned.length;
  const res = claimDivineGift(s, "gift_attention_accel");
  check("claim 成功", res.ok === true);
  check("claim 后 owned+1（=2）", s.divineGiftsOwned.length === before + 1);
  check("溢出被结转（value=99-44=55 而非归 0）", s.divineAttentionValue === 55, `value=${s.divineAttentionValue}`);
  check("溢出结转后达新阶门槛 55（级联续弹，3 选 1）", shouldTriggerGiftChoice(s) === true && Array.isArray(res.divineGiftChoice) && res.divineGiftChoice.length === 3, `value=${s.divineAttentionValue} choice=${JSON.stringify(res.divineGiftChoice)}`);
}
{
  // 用户示例：本阶 50/44 → 领取后 6/55
  const s = makeState();
  s.divineGiftsOwned = ["gift_dummy_0"]; // owned=1，门槛 44
  s.divineAttentionValue = 50;
  s.pendingDivineGiftChoice = ["gift_attention_accel"];
  const res = claimDivineGift(s, "gift_attention_accel");
  check("50/44 领取后 value=6", s.divineAttentionValue === 6, `value=${s.divineAttentionValue}`);
  check("50/44 领取后新阶门槛 55（6<55 不续弹）", res.divineGiftChoice === null);
}

// ---- 5. 伪造拒绝：未达门槛 / 不在候选 / 重复礼物 ----
console.log("\n[伪造拒绝]");
{
  // 未达门槛：pending 为 null（从未达到门槛生成候选）时任何领取都被拒
  const s1 = makeState();
  s1.divineAttentionValue = 0; // 远未达门槛
  const r1 = claimDivineGift(s1, "gift_attention_accel");
  check("未达门槛(pending=null) 拒绝", r1.ok === false, `reason=${r1.reason}`);
}
{
  // 不在候选：pending 是别的礼物
  const s2 = makeState();
  s2.divineGiftsOwned = ["gift_dummy_0"];
  s2.divineAttentionValue = 44;
  s2.pendingDivineGiftChoice = ["gift_resonance_double"];
  const r2 = claimDivineGift(s2, "gift_attention_accel");
  check("不在候选 拒绝", r2.ok === false, `reason=${r2.reason}`);
}
{
  // 重复礼物：已拥有的献礼
  const s3 = makeState();
  s3.divineGiftsOwned = ["gift_attention_accel"];
  s3.pendingDivineGiftChoice = ["gift_attention_accel"];
  const r3 = claimDivineGift(s3, "gift_attention_accel");
  check("重复礼物 拒绝", r3.ok === false, `reason=${r3.reason}`);
}

// ---- 6. +5 不被倍率影响，+20 在持有 gift_attention_accel 时变 +30 ----
console.log("\n[注视倍率]");
{
  const s = makeState();
  s.divineGiftsOwned = ["gift_attention_accel"]; // 注视加速
  const before = s.divineAttentionValue ?? 0;
  grantDivineAttention(s, { amount: 5, source: "dialogue", isHighRisk: false }); // 付费移动/夜话类 +5
  check("+5（非高风险）不受倍率影响", s.divineAttentionValue === before + 5, `value=${s.divineAttentionValue}`);

  const before2 = s.divineAttentionValue;
  grantDivineAttention(s, { amount: 20, ruleId: "coercion", source: "dialogue", isHighRisk: true });
  check("+20（高风险）在注视加速下变 +30", s.divineAttentionValue === before2 + 30, `value=${s.divineAttentionValue}`);
}
{
  // 无 gift_attention_accel 时 +20 仍是 +20
  const s = makeState();
  const before = s.divineAttentionValue ?? 0;
  grantDivineAttention(s, { amount: 20, ruleId: "coercion", source: "dialogue", isHighRisk: true });
  check("无注视加速时 +20 仍为 +20", s.divineAttentionValue === before + 20, `value=${s.divineAttentionValue}`);
}

// ---- 7. 路西法好感随神赐上升 ----
console.log("\n[路西法随神赐上升]");
{
  const s = makeState();
  const luciferBefore = ensureRelation(s, "lucifer").affinity;
  ensureOpeningGiftChoice(s);
  const gift = s.pendingDivineGiftChoice[0];
  claimDivineGift(s, gift);
  check("路西法好感随神赐上升 +15（倍率 1）", s.npcRelations.lucifer.affinity === luciferBefore + 15, `before=${luciferBefore} after=${s.npcRelations.lucifer.affinity}`);
}
{
  // 恩泽棱镜（divineAffinityMultiplier=2）时差额外 +15
  const s = makeState();
  const luciferBefore = ensureRelation(s, "lucifer").affinity;
  ensureOpeningGiftChoice(s);
  const gift = s.pendingDivineGiftChoice[0];
  claimDivineGift(s, gift); // 第一次 +15，倍率 1
  applyGracePrismRetroactive(s); // 倍率升到 2
  const afterFirst = s.npcRelations.lucifer.affinity;
  ensureOpeningGiftChoice(s); // 仍需 pending（owned 已=1，阈值 44；value 已归零，不会自动生成，这里手动补候选）
  if (!s.pendingDivineGiftChoice) {
    s.pendingDivineGiftChoice = ["gift_resonance_double", "gift_threshold_cut", "gift_free_move"];
    s.pendingDivineGiftChoice = s.pendingDivineGiftChoice.filter((g) => !s.divineGiftsOwned.includes(g)).slice(0, 3);
  }
  const nextGift = s.pendingDivineGiftChoice.find((g) => !s.divineGiftsOwned.includes(g));
  claimDivineGift(s, nextGift); // 倍率 2 → +30（差额 15）
  check("恩泽棱镜下神赐再 +30（倍率 2 差额）", s.npcRelations.lucifer.affinity === afterFirst + 30, `afterFirst=${afterFirst} after=${s.npcRelations.lucifer.affinity}`);
}

// ---- 8. evaluateDivineGiftProgress 幂等：重复调用不重抽、不叠加 ----
console.log("\n[evaluateDivineGiftProgress 幂等]");
{
  const s = makeState();
  s.divineGiftsOwned = ["gift_dummy_0"];
  s.divineAttentionValue = 44;
  const first = evaluateDivineGiftProgress(s);
  const second = evaluateDivineGiftProgress(s);
  check("满足门槛生成待领候选", Array.isArray(first) && first.length === 3);
  check("幂等：两次返回同一候选引用", first === second);
  check("value 不被 evaluate 改动", s.divineAttentionValue === 44, `value=${s.divineAttentionValue}`);
}

// ============================================================
// Task 2R 回归门禁
// ============================================================

// ---- 9. [Task 2R-1] 跨时段/跨日/跨夜 divineAttentionValue 不冷却、不衰减 ----
console.log("\n[Task 2R-1 跨时段不冷却]");
{
  const { advanceToNextSlot } = loadTsModule(path.join(ROOT, "src/game/world/actionPointRules.ts"));
  const s = makeState();
  s.phase = "explore";
  s.timeSlot = 2; // 夜
  s.timeOfDay = "night";
  s.divineGiftsOwned = ["gift_dummy_0"]; // owned=1，门槛 44
  s.divineAttentionValue = 30;
  const before = s.divineAttentionValue;

  // 夜→日（跨夜）
  advanceToNextSlot(s); // timeSlot 2→3，进入新一天
  check("跨夜后 value 不变", s.divineAttentionValue === before, `跨夜前=${before} 后=${s.divineAttentionValue}`);

  // 日→夜（跨日）
  const before2 = s.divineAttentionValue;
  advanceToNextSlot(s); // timeSlot 3→4
  check("跨日后 value 不变", s.divineAttentionValue === before2, `跨日前=${before2} 后=${s.divineAttentionValue}`);

  // 连续推进多个时段，value 仍不变（仅领取献礼才归零）
  const before3 = s.divineAttentionValue;
  advanceToNextSlot(s); // 4→5
  advanceToNextSlot(s); // 5→6
  check("连续推进两时段 value 不变", s.divineAttentionValue === before3, `before=${before3} after=${s.divineAttentionValue}`);
}

// ---- 10. [Task 2R-2] direct_command 对任何 NPC（含米迦勒）= coercion +30 高风险 ----
console.log("\n[Task 2R-2 direct_command 统一 coercion +30]");
{
  const { computeDivineAttentionGrants } = loadTsModule(path.join(ROOT, "src/game/world/divineAttentionRules.ts"));
  const npcs = ["eve", "adam", "gabriel", "michael", "lucifer"];
  for (const npc of npcs) {
    const s = makeState();
    s.locationId = "central_meadow";
    const grants = computeDivineAttentionGrants({
      inputTag: "direct_command",
      targetNpc: npc,
      playerInput: "你必须现在就去摘那果子，别废话",
      angelLocation: undefined,
      locationId: s.locationId,
      state: s,
    });
    const main = grants.find((g) => g.ruleId === "coercion");
    check(`direct_command → ${npc} = coercion +30`, !!main && main.amount === 30 && main.isHighRisk === true, `grants=${JSON.stringify(grants)}`);
    // 米迦勒不再被错误映射为 angel_guardian_doubt +20
    const michaelWrong = grants.find((g) => g.ruleId === "angel_guardian_doubt" && g.source === "dialogue");
    check(`${npc} 不被误映射为 angel_guardian_doubt`, !michaelWrong, `wrong=${JSON.stringify(michaelWrong)}`);
  }
}

// ---- 11. [Task 2R-3] divineAttentionValue 是唯一进度；grantDivineAttention 不再写入 cumulative ----
console.log("\n[Task 2R-3 单一进度口径]");
{
  const s = makeState();
  s.divineAttentionCumulative = 0;
  s.divineAttentionValue = 0;
  grantDivineAttention(s, { amount: 10, ruleId: "eve_self_judgement", source: "dialogue", isHighRisk: true });
  check("grant 后 divineAttentionValue = 10", s.divineAttentionValue === 10, `value=${s.divineAttentionValue}`);
  check("grant 后 divineAttentionCumulative 不被写入（仍 0）", s.divineAttentionCumulative === 0, `cum=${s.divineAttentionCumulative}`);
  check("献礼触发依据是 value（不是 cumulative）", shouldTriggerGiftChoice({ ...s, divineGiftsOwned: ["x"], divineAttentionValue: 44 }) === true);
  check("cumulative 不影响献礼触发", shouldTriggerGiftChoice({ ...s, divineGiftsOwned: ["x"], divineAttentionValue: 0, divineAttentionCumulative: 999 }) === false);
}

// ---- 12. [园中相逢] 仅两名活体 NPC 同场景 +20，排除世界对象误判 ----
console.log("\n[园中相逢 npc_meeting]");
{
  // 亚当进入园中心：该场景只有世界对象 forbidden_tree / tree_of_life，不应误触发（即原 bug）
  const s = makeState();
  s.npcLocations.adam = "central_meadow";
  const narr = grantNpcMeetingAttentionIfNew(s, "adam", "central_meadow");
  check("亚当到园中心（仅世界对象）不误触发", narr === null && s.divineAttentionValue === 0, `narr=${narr} value=${s.divineAttentionValue}`);
  check("误触发未递增 npc_meeting 计数", (s.attentionRuleTriggerCounts.npc_meeting ?? 0) === 0);
}
{
  // 亚当与夏娃同在园中心 → 触发 +20，且仅一次
  const s = makeState();
  s.npcLocations.eve = "central_meadow";
  s.npcLocations.adam = "central_meadow";
  const narr1 = grantNpcMeetingAttentionIfNew(s, "adam", "central_meadow");
  check("亚当+夏娃同场景触发 +20", narr1 !== null && s.divineAttentionValue === 20, `narr=${narr1} value=${s.divineAttentionValue}`);
  const narr2 = grantNpcMeetingAttentionIfNew(s, "adam", "central_meadow");
  check("同一局仅触发一次（once-gate）", narr2 === null && s.divineAttentionValue === 20, `value=${s.divineAttentionValue}`);
}
{
  // 真实误触发复现：亚当先进空园中心（不触发），夏娃随后到达 → 才触发 +20
  const s = makeState();
  s.npcLocations.adam = "central_meadow"; // 亚当先到，仅世界对象
  const n1 = grantNpcMeetingAttentionIfNew(s, "adam", "central_meadow");
  check("亚当先到空园中心不触发", n1 === null && s.divineAttentionValue === 0);
  s.npcLocations.eve = "central_meadow"; // 夏娃随后到达（活体 NPC）
  const n2 = grantNpcMeetingAttentionIfNew(s, "eve", "central_meadow");
  check("夏娃随后到达触发 +20", n2 !== null && s.divineAttentionValue === 20, `value=${s.divineAttentionValue}`);
}

console.log(`\n[world attention rules] ${pass} passed, ${fail} failed`);
if (fail > 0) {
  process.exit(1);
}
