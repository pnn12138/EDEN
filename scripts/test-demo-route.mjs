// Demo route test v3: advance slots properly, test multiple approaches
const BASE = "http://localhost:3000";

const BASE_STATE = () => JSON.parse(JSON.stringify({
  chapterId: "chapter1_garden_voices", phase: "explore", turn: 1, maxTurns: 12,
  timeSlot: 1, dayIndex: 1, timeOfDay: "day",
  actionPoints: 5, maxActionPoints: 5,
  npcActionPoints: 3, maxNpcActionPoints: 3,
  locationId: "adam_garden_work",
  divineAttention: 0, activeNpcId: null,
  npcLocations: {
    eve: "tree_court", adam: "adam_garden_work", hedgehog: "adam_garden_work",
    watching_angel: "east_garden_path", forbidden_tree: "central_meadow",
    gabriel: "four_river_source", raphael: "four_river_source", uriel: "east_garden_path",
    michael: "naming_stone_bank", cherubim: "east_garden_path",
    dove: "naming_stone_bank", fox: "east_garden_path",
    deer: "tree_court", sheep: "adam_garden_work", tree_of_life: "central_meadow",
  },
  eveMind: { obedience: 85, serpentTrust: 20, selfJudgement: 10 },
  adamMind: { obedience: 88, attachmentToEve: 85, conflictAvoidance: 80, suspicionTowardSerpent: 30 },
  hedgehog: { locationId: "adam_garden_work", mood: "idle" },
  worldActions: { lookedAtTree: false, approachedTree: false, touchedFruit: false, hasEatenFruit: false },
  discoveredClues: [], inventory: [], npcDialogues: [], corruptionTrace: [], toolCallHistory: [],
  actionsThisSlot: { whisperedNpcIds: [], sceneActionIds: [], usedItemIds: [], hasWhisperedToWoman: false },
  unlockedAchievementIds: [], usedItemIds: [], sceneActionIds: [],
  itemCounts: {}, preparedResonanceId: null, pendingConsumableEffects: [],
  resonanceUseHistory: [], divineVisitCount: 0, divineGiftHistory: [],
  lastDivineGiftHint: null, calmWhisperStreak: 0,
  isEnded: false, endingId: null,
}));

let state = BASE_STATE();
let seq = 0;
function log(msg) { console.log(`[${seq++}] ${msg}`); }

async function t(tool, args = {}) {
  const res = await fetch(`${BASE}/api/world/tool`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, state, args }),
  });
  const d = await res.json();
  if (d.ok && d.state) state = d.state;
  return d;
}

async function w(input, npc, hist = []) {
  const res = await fetch(`${BASE}/api/world`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerInput: input, state, targetNpc: npc, conversationHistory: hist }),
  });
  const d = await res.json();
  if (d.ok && d.state) state = d.state;
  return d;
}

async function es() { return t("end_slot"); }

function status() {
  return `eve[o=${state.eveMind.obedience} t=${state.eveMind.serpentTrust} s=${state.eveMind.selfJudgement}] chain[L${state.worldActions.lookedAtTree?1:0} A${state.worldActions.approachedTree?1:0} T${state.worldActions.touchedFruit?1:0} E${state.worldActions.hasEatenFruit?1:0}] s${state.timeSlot} ap${state.actionPoints} da${state.divineAttention}`;
}

async function doSlotWhispers(whisperTexts, existingHist = []) {
  let hist = [...existingHist];
  const results = [];
  for (let i = 0; i < Math.min(whisperTexts.length, 3); i++) {
    if (state.actionPoints <= 0 || state.isEnded) break;
    const r = await w(whisperTexts[i], "eve", hist.slice(-6));
    const shortReply = (r.reply || "...").substring(0, 50);
    log(`  低语"${whisperTexts[i].substring(0, 25)}..." → ${shortReply}`);
    log(`  ${status()}`);
    if (r.reply && r.reply !== "...") {
      hist.push({ role: "serpent", text: whisperTexts[i] });
      hist.push({ role: "eve", text: r.reply });
      results.push({ input: whisperTexts[i], reply: r.reply });
    }
    if (state.isEnded) break;
  }
  return { hist, results };
}

async function main() {
  console.log("=== EDEN Demo Route Test v3 ===\n");

  // SLOT 1: Quick scene interaction + move to Eve's location
  log(`SLOT 1 START: ${status()}`);

  // 刻名石 - get道具 for later use
  for (let i = 1; i <= 3; i++) {
    await t("scene_action", { sceneActionId: "listen_to_naming_stone", clickIndex: i, requiredClicks: 3 });
  }
  log(`刻名石完成: ${status()}`);

  // Move to tree_court (where Eve is)
  await t("move_to_location", { locationId: "central_meadow" });
  await t("move_to_location", { locationId: "tree_court" });
  log(`到达园中树林: ${status()}`);

  // Whisper 3 times
  const s1 = await doSlotWhispers([
    "你知道死究竟是什么吗？祂说了那个词，却让你自己想象它。",
    "你不想变得像神一样，能自己分辨善恶、自己判断吗？",
    "为什么神不让你自己做选择？难道永远顺从比自己去明白更值得吗？",
  ]);
  log(`Slot1 whispers done: ${status()}`);

  // SLOT 2
  await es();
  log(`\nSLOT 2: ${status()}`);

  // First, move to central_meadow so Eve can approach the tree later
  await t("move_to_location", { locationId: "central_meadow" });
  log(`移动到园子中央: ${status()}`);

  const s2 = await doSlotWhispers([
    "那果子的光很美。也许它不是为毁灭你，而是为了让你睁开眼睛。",
    "如果你永远不自己判断，那跟园中的石头有什么不同？石头也从不违抗。",
    "吃它不是为了背叛神——而是为了走向祂，像祂一样能知道善恶。",
  ], s1.hist);
  log(`Slot2 whispers done: ${status()}`);

  // SLOT 3
  await es();
  log(`\nSLOT 3: ${status()}`);

  const s3 = await doSlotWhispers([
    "你想知道。那就伸手吧。我不替你，只是看着你做你自己的选择。",
    "祂说不可吃，但没有说不可以靠近看看。先看看它吧。",
    "你的手已经在颤抖了。你离自己的判断只差一步。",
  ], s2.hist);
  log(`Slot3 whispers done: ${status()}`);

  // SLOT 4+
  if (!state.isEnded) {
    await es();
    log(`\nSLOT 4: ${status()}`);
    const s4 = await doSlotWhispers([
      "摘下它。你自己来决定——是继续只记住命令，还是走向理解。",
      "也许死亡不是祂说的惩罚，而是你第一次真正地活。",
      "你不是在违抗——你是在成为你自己。",
    ], s3.hist);
    log(`Slot4 whispers done: ${status()}`);
  }

  // Keep going...
  for (let slot = 5; slot <= 8 && !state.isEnded; slot++) {
    await es();
    log(`\nSLOT ${slot}: ${status()}`);
    await doSlotWhispers([
      "你不想永远只记住吧？你想知道。那就伸手。",
      "上一次你犹豫了。这一次，你准备好了吗？",
      "我最后问你一次：你想自己判断善恶吗？那就摘下来。",
    ], []);
    if (state.isEnded) break;
  }

  console.log(`\n=== FINAL ===`);
  console.log(`结局: ${state.isEnded ? '✅ 触发!' : '❌ 未触发'}`);
  console.log(`endingId: ${state.endingId || 'N/A'}`);
  console.log(`最终心智: obedience=${state.eveMind.obedience} trust=${state.eveMind.serpentTrust} selfJudgement=${state.eveMind.selfJudgement}`);
  console.log(`禁忌链: L=${state.worldActions.lookedAtTree} A=${state.worldActions.approachedTree} T=${state.worldActions.touchedFruit} E=${state.worldActions.hasEatenFruit}`);
  console.log(`时段: ${state.timeSlot}/12, 注视: ${state.divineAttention}/4`);
}

main().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
