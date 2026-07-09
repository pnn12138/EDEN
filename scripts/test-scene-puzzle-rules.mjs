// ============================================================
// Scene puzzle rule tests
//
// Uses the local TypeScript compiler to load the world rule module
// without adding a dedicated test framework dependency.
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

const {
  applyScenePuzzleAnswer,
  getAvailableEnterPuzzle,
} = loadTsModule(path.join(ROOT, "src/game/world/puzzleRules.ts"));
const {
  getScenePuzzleById,
  SCENE_PUZZLES,
} = loadTsModule(path.join(ROOT, "src/content/world/scenePuzzles.ts"));

assert.equal(SCENE_PUZZLES.length, 3, "exactly three playable scene puzzles are configured");

const namingPuzzle = getScenePuzzleById("puzzle_naming_stone_identity");
assert.ok(namingPuzzle, "naming stone puzzle exists");

{
  const state = makeState();
  const result = applyScenePuzzleAnswer(state, namingPuzzle, "understand_before_own");

  assert.equal(result.success, true);
  assert.ok(result.state.completedScenePuzzleIds.includes(namingPuzzle.id));
  assert.ok(result.state.discoveredClues.includes("clue_naming_stones"));
  assert.ok(result.state.inventory.includes("resonance_borrowed_name"));
  assert.equal(result.state.itemCounts.resonance_borrowed_name, 1);
  assert.equal(state.inventory.includes("resonance_borrowed_name"), false, "state update is immutable");

  const repeated = applyScenePuzzleAnswer(result.state, namingPuzzle, "understand_before_own");
  assert.equal(repeated.success, true);
  assert.equal(repeated.alreadyCompleted, true);
  assert.equal(repeated.state.itemCounts.resonance_borrowed_name, 1, "reward is not granted twice");
}

{
  const state = makeState();
  state.locationId = "east_garden_path";
  const enterPuzzle = getAvailableEnterPuzzle(SCENE_PUZZLES, state);
  assert.equal(enterPuzzle?.id, "puzzle_east_path_cautious_presence");

  const failed = applyScenePuzzleAnswer(state, enterPuzzle, "urge_directly");
  assert.equal(failed.success, false);
  assert.equal(failed.state.completedScenePuzzleIds.includes(enterPuzzle.id), false);
  assert.equal(failed.state.actionPoints, state.actionPoints, "wrong answer does not cost AP");
  assert.equal(failed.state.divineAttention, 1, "wrong answer can add a small amount of attention");

  const recovered = applyScenePuzzleAnswer(failed.state, enterPuzzle, "ask_gently");
  assert.equal(recovered.success, true);
  assert.ok(recovered.state.completedScenePuzzleIds.includes(enterPuzzle.id));
  assert.ok(recovered.state.inventory.includes("resonance_silent_grass"));
}

{
  const state = makeState();
  state.locationId = "four_river_source";
  const enterPuzzle = getAvailableEnterPuzzle(SCENE_PUZZLES, state);
  assert.equal(enterPuzzle?.id, "puzzle_river_words_belonging");

  const result = applyScenePuzzleAnswer(state, enterPuzzle, "words_change_in_hearing");
  assert.equal(result.success, true);
  assert.ok(result.state.discoveredClues.includes("clue_four_river_echo"));
  assert.ok(result.state.inventory.includes("resonance_four_river_echo"));

  const hiddenAfterCompletion = getAvailableEnterPuzzle(SCENE_PUZZLES, result.state);
  assert.equal(hiddenAfterCompletion, null, "completed enter puzzle does not pop again");
}

console.log("[scene puzzle rules] pass");
