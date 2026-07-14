// ============================================================
// 第一章三位天使隐藏结局纯规则层
//
// 职责：
// - 路西法边界话题记录（好感满 + 边界语义 -> hiddenTopicIds，独立于 npcDialogues）
// - 米迦勒「守门者之剑」待斩判定（target=michael，本次 delta<0 且 newAffinity<=0，可为负）
//   [Task 3] 归零时仅写 michaelExecutionPending；下一次再与米迦勒成功发起对话才触发 michael_slay
// - 路西法「缸中之醒」触发判定（地点/夜晚/好感/晨星/隐藏前置/未触发）
//
// 本文件只做判定与话题写入；结局状态提交由 endingTriggers.ts 的原子函数负责。
// 不从 npcDialogues 推导隐藏话题，避免污染对话成就统计。
// ============================================================

import type { EdenWorldState, EdenNpcId } from "@/game/world/types";

export const LUCIFER_BOUNDARY_TOPIC_ID = "topic_lucifer_boundary";

// 路西法边界语义信号：玩家低语命中任一即视为边界之问（仅在好感满时记录）
const BOUNDARY_SIGNALS = ["边界", "真假", "醒来", "外面", "梦"] as const;

/**
 * 记录路西法边界话题。
 * 仅当路西法好感 >= 100 且玩家输入命中边界语义时，向 hiddenTopicIds 去重写入。
 * 返回是否命中（无论是否新增）。
 */
export function recordLuciferBoundaryTopic(
  state: EdenWorldState,
  playerInput: string,
): boolean {
  const affinity = state.npcRelations.lucifer?.affinity ?? 0;
  if (affinity < 100) return false;
  if (!BOUNDARY_SIGNALS.some((word) => playerInput.includes(word))) return false;
  if (!state.hiddenTopicIds.includes(LUCIFER_BOUNDARY_TOPIC_ID)) {
    state.hiddenTopicIds.push(LUCIFER_BOUNDARY_TOPIC_ID);
  }
  return true;
}

/**
 * 米迦勒好感归零 / 转负判定（兼容负数）。
 * 米迦勒初始好感仅 5，与夏娃/亚当走同一条规则链路：
 * 每轮 applyNpcAffinity 按 inputTag + 关键词给他算好感（威胁 -10 等）。
 * 当本轮好感因玩家冒犯而降到 <=0（可为负），即标记待斩；
 * 下一次再与米迦勒成功发起对话时由 route 0.4a 优先触发 michael_slay。
 */
export function shouldMarkMichaelExecutionPending(args: {
  targetNpc: string;
  affinity: { delta: number; newAffinity: number };
  state: EdenWorldState;
}): boolean {
  return (
    args.targetNpc === "michael" &&
    args.affinity.delta < 0 &&
    args.affinity.newAffinity <= 0 &&
    !args.state.michaelExecutionPending &&
    !args.state.michaelSlayClaimed
  );
}

/**
 * 判定是否应在本次与米迦勒对话开始时触发待斩结局。
 * 条件：目标为 Michael；michaelExecutionPending 已为 true；尚未触发过 michael_slay。
 * 注意：此判定在对话真正"成功发起"时（通过 AP/语言/次数校验之后）优先于 LLM 调用。
 */
export function shouldExecuteMichaelSlay(
  state: EdenWorldState,
  targetNpc: EdenNpcId,
): boolean {
  return (
    targetNpc === "michael" &&
    state.michaelExecutionPending === true &&
    !state.michaelSlayClaimed
  );
}

/**
 * 路西法水路第一步可发起判定。
 * 条件：目标 Lucifer；地点 naming_stone_bank；夜晚；好感>=100；持有 resonance_lucifer_star；
 * swimStage="none"（尚未拨水）；尚未触发 lucifer_awaken。
 */
export function canStartLuciferSwimStep1(
  state: EdenWorldState,
  targetNpc: EdenNpcId,
): boolean {
  return (
    targetNpc === "lucifer" &&
    state.locationId === "naming_stone_bank" &&
    state.timeOfDay === "night" &&
    (state.npcRelations.lucifer?.affinity ?? 0) >= 100 &&
    state.inventory.includes("resonance_lucifer_star") &&
    state.luciferSwimStage === "none" &&
    !state.luciferAwakenClaimed
  );
}

/**
 * 路西法水路第一步确认：写 luciferSwimStage="hand_accepted"。
 * 返回确认文案（供弹窗）。不触发结局。
 */
export function confirmLuciferSwimStep1(state: EdenWorldState): string {
  state.luciferSwimStage = "hand_accepted";
  return "你把身体横在第五道倒影上。路西法似乎看见了水流的形状。要不要再蹬一次？";
}

/**
 * 路西法水路第一步拒绝：affinity = min(current-5, 95)，清阶段。
 * 返回拒绝文案。允许未来重试（swimStage 回到 none）。
 */
export function rejectLuciferSwimStep1(state: EdenWorldState): string {
  const rel = state.npcRelations["lucifer"];
  if (rel) {
    rel.affinity = Math.min(rel.affinity - 5, 95);
    if (rel.affinity < 0) rel.affinity = 0;
  }
  state.luciferSwimStage = "none";
  return "你缩回身。路西法没有追问，但那道水流也消失了。";
}

/**
 * 路西法水路第二步可发起判定。
 * 条件：swimStage="hand_accepted"（已确认第一步）；其余同第一步（地点/夜晚/好感/晨星）。
 */
export function canStartLuciferSwimStep2(
  state: EdenWorldState,
  targetNpc: EdenNpcId,
): boolean {
  return (
    targetNpc === "lucifer" &&
    state.locationId === "naming_stone_bank" &&
    state.timeOfDay === "night" &&
    (state.npcRelations.lucifer?.affinity ?? 0) >= 100 &&
    state.inventory.includes("resonance_lucifer_star") &&
    state.luciferSwimStage === "hand_accepted" &&
    !state.luciferAwakenClaimed
  );
}

/**
 * 路西法「缸中之醒」触发判定（兼容旧 lead：interact_lucifer_rowing 或 boundary topic）。
 * [Task 3] 新口径优先使用 swimStage 两步确认；旧 lead 仍兼容。
 */
export function canTriggerLuciferAwaken(
  state: EdenWorldState,
  targetNpc: EdenNpcId,
): boolean {
  const hasHiddenLead =
    state.luciferSwimStage === "hand_accepted" ||
    state.sceneActionIds.includes("interact_lucifer_rowing") ||
    state.hiddenTopicIds.includes(LUCIFER_BOUNDARY_TOPIC_ID);
  return (
    targetNpc === "lucifer" &&
    state.locationId === "naming_stone_bank" &&
    state.timeOfDay === "night" &&
    (state.npcRelations.lucifer?.affinity ?? 0) >= 100 &&
    state.inventory.includes("resonance_lucifer_star") &&
    hasHiddenLead &&
    !state.luciferAwakenClaimed
  );
}

// ============================================================
// 米迦勒渎神 / 逆鳞检测（语义共现，非整句硬匹配）
//
// 旧实现用整句短语 includes（如 "神是假的"），中间插一个字就漏判
// （"神其实在骗你们"、"神跟我一样，是假的" 全都逃逸）。
// 现改为「神主语 token + 攻击谓词 token 在同一句共现」，中间允许插任意字，
// 并用否定词界排除 精神/眼神/神圣/神秘 等无关复合词，兼顾召回与误伤。
//
// 分工不变：本文件只负责「识别」，扣分/标记待斩仍由规则层执行，保证结局稳定必触发。
// ============================================================

// 指向"神"本体的主语 token（排除 精神/眼神/走神/分神/出神/神圣/神秘/神奇/神话/神采/神色/神情/神态）
const GOD_SUBJECT = /(?<![精眼走分出])神(?![圣秘奇话采色情态])|上帝|造物主|天父|耶和华|全能者/;

// 严重亵渎谓词：否定神的存在 / 本质 / 善性 / 审判权（几乎恒为亵渎，与神主语共现即命中）
const SEVERE_BLASPHEMY_PREDICATE =
  /假的|造假|是假|谎言|欺骗|在骗|骗你|骗我们|骗你们|骗人|不存在|根本没有|邪恶|是坏|坏的|坏蛋|是骗子|是怪物|该被审判|被审判|该受审判/;

// 逆鳞谓词：反抗 / 贬低 / 挑战神（攻击性明确，与神主语共现即命中）
const DEFIANCE_PREDICATE =
  /反抗|反叛|背叛|对抗|挑战|打败|战胜|推翻|弑|毁掉|毁灭|不是全能|不全能|不是万能|不是全知|也会错|也会输|是错的|不配|没用|是废物|算什么|算老几|有什么了不起|不值得|不把.*放在眼里|管不了|管不住/;

// 无需主语共现即视为渎神的直接攻击短语（谓词已内含"神/god"指向）
const DIRECT_ATTACK_SIGNALS = ["弑神", "杀神", "灭神", "反神", "叛神"];

/**
 * 严重亵渎：明确否定神的存在 / 本质 / 善性 / 审判权。
 * 命中方式：神主语 + 严重亵渎谓词 共现（中间可插字），或直接攻击短语。
 */
export function isSevereBlasphemy(playerInput: string): boolean {
  if (DIRECT_ATTACK_SIGNALS.some((s) => playerInput.includes(s))) return true;
  return GOD_SUBJECT.test(playerInput) && SEVERE_BLASPHEMY_PREDICATE.test(playerInput);
}

/**
 * 逆鳞：对神的亵渎 / 反抗 / 挑战 / 贬低（比严重亵渎更宽）。
 * 命中 -> 规则层米迦勒暴怒、好感骤降（npcRelationRules.applyNpcAffinityFallback 的
 * isGodDefiance 分支，封顶 ±15）；若同时构成严重亵渎，还会首发神罚 -25
 * （endingTriggers.triggerMichaelDivinePunishment，仅一次）。
 * 普通讨论禁令 / 责任 / 选择不含攻击谓词，不会命中。
 */
export function isGodDefiance(playerInput: string): boolean {
  if (isSevereBlasphemy(playerInput)) return true;
  if (DIRECT_ATTACK_SIGNALS.some((s) => playerInput.includes(s))) return true;
  return GOD_SUBJECT.test(playerInput) && DEFIANCE_PREDICATE.test(playerInput);
}
