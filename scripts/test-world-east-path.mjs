// ============================================================
// Task 4: 东园幽径、传令残羽与道具收敛（规则层测试）
//
// 覆盖验收要求：
// - 昼题《东风所传》四项选项的效果（解锁地图/清醒之眼/传令残羽/东风逆行）
// - 夜题《羽下月路》四项选项的效果（双树残识/无声草/主动引目/无影东行）
// - 无影东行：无剑仅 +50 注视；持火焰剑触发 escape_eden
// - 传令残羽：对三名天使降低顺服、抬升本阶注视；对非天使/无残羽不消耗
// - 每时段最多一次免费移动（多件免费道具不叠加）
// - 边界之痕：使用激活 forecast，predictNextAttentionChanges 返回确定性 +5 走向
// - 回溯后场景题重开（completedScenePuzzleIds 不含东园题时不锁死）
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
  const { ensureRelation } = loadTsModule(path.join(ROOT, "src/game/world/npcRelationRules.ts"));
  const base = JSON.parse(JSON.stringify({
    ...initialEdenWorldState,
    phase: "explore",
    completedScenePuzzleIds: [],
    hasDismissedObjectiveHint: false,
  }));
  // 确保所有 NPC 关系已初始化（initialEdenWorldState.npcRelations 可能为空）
  for (const npc of ["eve", "adam", "hedgehog", "gabriel", "michael", "lucifer", "serpent", "forbidden_tree", "tree_of_life"]) {
    ensureRelation(base, npc);
  }
  return base;
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
} = loadTsModule(path.join(ROOT, "src/game/world/puzzleRules.ts"));
const { getScenePuzzleById } = loadTsModule(path.join(ROOT, "src/content/world/scenePuzzles.ts"));
const {
  consumeAngelFeather,
  predictNextAttentionChanges,
  executeConsumableResonance,
} = loadTsModule(path.join(ROOT, "src/game/world/resonanceRules.ts"));
const { getFreeMoveCharges } = loadTsModule(path.join(ROOT, "src/game/world/freeActionRules.ts"));

function puzzle(id) {
  const p = getScenePuzzleById(id);
  if (!p) throw new Error(`puzzle not found: ${id}`);
  return p;
}

// ---- 1. 昼题《东风所传》四项选项 ----
console.log("\n[昼题·东风所传]");
{
  const day = puzzle("puzzle_east_path_cautious_presence_day");
  check("昼题标题为《东风所传》", day.title === "东风所传", `实际 ${day.title}`);

  const s1 = makeState();
  const r1 = applyScenePuzzleAnswer(s1, day, "echo_of_beings");
  check("echo_of_beings 解锁地图 NPC 位置", r1.state.unlockMapNpcLocations === true);
  check("echo_of_beings 发放 resonance_echo_of_beings", r1.state.inventory.includes("resonance_echo_of_beings"));

  const s2 = makeState();
  const r2 = applyScenePuzzleAnswer(s2, day, "calibrate_east_light");
  check("calibrate_east_light 发放 resonance_sober_eye", r2.state.inventory.includes("resonance_sober_eye"));
  check("calibrate_east_light 白天 AP 上限 +1", (r2.state.apMaxBonusDay ?? 0) === 1, `实际 ${r2.state.apMaxBonusDay}`);

  // AP 上限奖励总和封顶 +2，溢出转为当前行动点
  const sc = makeState();
  sc.apMaxBonusDay = 2; // 已达上限
  sc.actionPoints = 1;
  const rc = applyScenePuzzleAnswer(sc, day, "calibrate_east_light");
  check("已达 +2 上限时不继续累加（仍为 2）", (rc.state.apMaxBonusDay ?? 0) === 2, `实际 ${rc.state.apMaxBonusDay}`);
  check("溢出 +1 转为当前行动点回复", rc.state.actionPoints === 2, `实际 ${rc.state.actionPoints}`);

  const s3 = makeState();
  const r3 = applyScenePuzzleAnswer(s3, day, "ask_gabriel_command");
  check("ask_gabriel_command 发放传令残羽 resonance_angel_feather", r3.state.inventory.includes("resonance_angel_feather"));
  check("传令残羽获得时不直接改变顺服（加百列 affinity 不变）", r3.state.npcRelations.gabriel.affinity === s3.npcRelations.gabriel.affinity);

  const s4 = makeState();
  const beforeGab = s4.npcRelations.gabriel.affinity;
  const r4 = applyScenePuzzleAnswer(s4, day, "east_wind_reverse");
  check("east_wind_reverse 行动点归零", r4.state.actionPoints === 0);
  check("east_wind_reverse 加百列好感 -5", r4.state.npcRelations.gabriel.affinity === beforeGab - 5);
  check("east_wind_reverse 注视 +20", r4.state.divineAttentionValue === 20);
}

// ---- 2. 夜题《羽下月路》四项选项 ----
console.log("\n[夜题·羽下月路]");
{
  const night = puzzle("puzzle_east_path_cautious_presence_night");
  check("夜题标题为《羽下月路》", night.title === "羽下月路", `实际 ${night.title}`);

  const s1 = makeState();
  const r1 = applyScenePuzzleAnswer(s1, night, "twin_tree_memory");
  check("twin_tree_memory 解锁双树命名", r1.state.unlockTreeNames === true);
  check("twin_tree_memory 发放 resonance_twin_tree_memory", r1.state.inventory.includes("resonance_twin_tree_memory"));

  const s2 = makeState();
  const r2 = applyScenePuzzleAnswer(s2, night, "take_silent_grass");
  check("take_silent_grass 发放 resonance_silent_grass", r2.state.inventory.includes("resonance_silent_grass"));

  const s3 = makeState();
  const r3 = applyScenePuzzleAnswer(s3, night, "active_expose");
  check("active_expose 注视 +10", r3.state.divineAttentionValue === 10);

  const s4 = makeState();
  const beforeGab = s4.npcRelations.gabriel.affinity;
  const r4 = applyScenePuzzleAnswer(s4, night, "shadowless_east");
  check("shadowless_east 行动点归零", r4.state.actionPoints === 0);
  check("shadowless_east 加百列好感 -5", r4.state.npcRelations.gabriel.affinity === beforeGab - 5);
  check("shadowless_east 注视 +50", r4.state.divineAttentionValue === 50);
  check("shadowless_east 无火焰剑不触发逃离结局", r4.state.endingId !== "escape_eden" && r4.state.isEnded === false);
}

// ---- 3. 无影东行 + 火焰剑 → escape_eden ----
console.log("\n[无影东行·火焰剑逃离]");
{
  const night = puzzle("puzzle_east_path_cautious_presence_night");
  const s = makeState();
  s.inventory.push("resonance_flaming_sword");
  const r = applyScenePuzzleAnswer(s, night, "shadowless_east");
  check("持火焰剑选择无影东行触发 escape_eden", r.state.endingId === "escape_eden" && r.state.isEnded === true);
}

// ---- 4. 传令残羽：三名天使 + 非天使 + 无残羽 ----
console.log("\n[传令残羽]");
{
  // 路西法：-8 顺服 / +10 注视
  const sl = makeState();
  sl.inventory.push("resonance_angel_feather");
  sl.npcRelations.lucifer.obedience = 50;
  const rl = consumeAngelFeather(sl, "lucifer");
  check("路西法：残羽生效", rl.applied === true);
  check("路西法：顺服 -8（50→42）", sl.npcRelations.lucifer.obedience === 42, `实际 ${sl.npcRelations.lucifer.obedience}`);
  check("路西法：注视 +10", sl.divineAttentionValue === 10);
  check("路西法：残羽被消耗", !sl.inventory.includes("resonance_angel_feather"));

  // 加百列：-5 / +20
  const sg = makeState();
  sg.inventory.push("resonance_angel_feather");
  sg.npcRelations.gabriel.obedience = 50;
  const rg = consumeAngelFeather(sg, "gabriel");
  check("加百列：顺服 -5（50→45）", sg.npcRelations.gabriel.obedience === 45, `实际 ${sg.npcRelations.gabriel.obedience}`);
  check("加百列：注视 +20", sg.divineAttentionValue === 20);

  // 米迦勒：-2 / +20
  const sm = makeState();
  sm.inventory.push("resonance_angel_feather");
  sm.npcRelations.michael.obedience = 50;
  const rm = consumeAngelFeather(sm, "michael");
  check("米迦勒：顺服 -2（50→48）", sm.npcRelations.michael.obedience === 48, `实际 ${sm.npcRelations.michael.obedience}`);
  check("米迦勒：注视 +20", sm.divineAttentionValue === 20);

  // 非天使（夏娃）：不生效、不消耗
  const se = makeState();
  se.inventory.push("resonance_angel_feather");
  const re = consumeAngelFeather(se, "eve");
  check("夏娃：残羽不生效", re.applied === false);
  check("夏娃：残羽未被消耗", se.inventory.includes("resonance_angel_feather"));

  // 无残羽：不生效
  const sn = makeState();
  const rn = consumeAngelFeather(sn, "lucifer");
  check("无残羽：不生效", rn.applied === false);

  // 顺服已到下限：不消耗
  const s0 = makeState();
  s0.inventory.push("resonance_angel_feather");
  s0.npcRelations.lucifer.obedience = 0;
  const r0 = consumeAngelFeather(s0, "lucifer");
  check("顺服已到下限：不消耗", r0.applied === false && s0.inventory.includes("resonance_angel_feather"));
}

// ---- 5. 每时段最多一次免费移动 ----
console.log("\n[免费移动上限]");
{
  const s = makeState();
  // 同时持有 无羁之步 + 轻步印记 + 昼荫轻步 + 晨流回环（白天）
  s.inventory.push("gift_free_move", "passive_light_step", "resonance_day_shade_step", "resonance_morning_flow");
  s.timeOfDay = "day";
  check("多件免费道具合并后每时段仅 1 次免费移动", getFreeMoveCharges(s) === 1, `实际 ${getFreeMoveCharges(s)}`);

  const s2 = makeState();
  s2.inventory.push("gift_free_move");
  check("仅无羁之步：每时段 1 次", getFreeMoveCharges(s2) === 1);

  const s3 = makeState();
  check("无任何免费道具：0 次", getFreeMoveCharges(s3) === 0);
}

// ---- 6. 边界之痕：激活 + 预测未来三次注视 ----
console.log("\n[边界之痕·注视预测]");
{
  const s = makeState();
  s.inventory.push("resonance_boundary_mark");
  s.itemCounts["resonance_boundary_mark"] = 1;
  const before = s.itemCounts["resonance_boundary_mark"] ?? 0;
  const r = executeConsumableResonance(s, "resonance_boundary_mark");
  check("边界之痕使用成功", r.allowed === true, `reason=${r.reason}`);
  check("边界之痕激活 forecast 标记", s.boundaryMarkForecastActive === true);
  check("边界之痕消耗次数", (s.itemCounts["resonance_boundary_mark"] ?? 0) === before - 1);

  // 当前为白天时段 1：预测应含 白天首次付费移动 +5（slot1），夜晚首次付费对话 +5（slot2），白天 +5（slot3）
  const forecast = predictNextAttentionChanges(s, 3);
  check("预测返回至多 3 条", forecast.length <= 3, `实际 ${forecast.length}`);
  check("预测均为确定性 +5", forecast.every((f) => f.amount === 5));
  const slots = forecast.map((f) => f.slot);
  check("预测按时间线向前枚举（slot 递增）", slots.every((v, i) => i === 0 || v > slots[i - 1]));
}

// ---- 7. 回溯后东园题重开（不锁死） ----
console.log("\n[回溯重开]");
{
  const day = puzzle("puzzle_east_path_cautious_presence_day");
  const s = makeState();
  s.completedScenePuzzleIds = ["puzzle_east_path_cautious_presence_day"];
  const r = applyScenePuzzleAnswer(s, day, "echo_of_beings");
  check("已完成的题再次选择返回 alreadyCompleted", r.alreadyCompleted === true);
  check("已完成题再次选择不重复发放奖励", !r.rewards.some((rw) => rw.type === "item"));
}

// ---- 汇总 ----
console.log(`\nTask 4 规则测试：通过 ${pass} / 失败 ${fail}`);
if (fail > 0) {
  process.exit(1);
}
