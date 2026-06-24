// ============================================================
// 记忆碎片检索规则（RAG 游戏化）
// Agent 架构升级 Phase B：本地记忆碎片检索
//
// 检索流程：
// 1. 根据玩家输入识别意图（复用 progressRules 的语义线索分析）
// 2. 根据意图匹配记忆碎片类型
// 3. 排除已检索过的碎片（去重）
// 4. 返回 1-3 条相关碎片
//
// 检索规则映射：
// - 质疑禁令 → divine_command + adam_retelling
// - 讨论死亡 → death_trace
// - 诱惑智慧 → fruit_aura
// - 温柔安抚 → serpent_history
// - 引导自主判断 → self_reflection
//
// 特殊规则：
// - compare_sources 解锁条件：检索过 divine_command + adam_retelling
// - AdamAgent 检索时优先返回 divine_command + adam_retelling
// ============================================================

import type {
  MemoryFragment,
  MemoryRetrievalRequest,
  MemoryRetrievalResult,
  MemoryFragmentType,
} from "@/game/types/agent";
import type { TemptationSignal } from "@/game/rules/progressRules";
import { analyzeTemptationSignals } from "@/game/rules/progressRules";
import { CHAPTER0_MEMORY_FRAGMENTS, MEMORY_BY_TYPE } from "@/content/memory/chapter0_memory_fragments";

/**
 * 根据语义线索确定需要检索的记忆碎片类型。
 */
function getMemoryTypesForSignals(signals: TemptationSignal[]): MemoryFragmentType[] {
  const types: MemoryFragmentType[] = [];

  if (signals.includes("challenge_prohibition")) {
    types.push("divine_command", "adam_retelling");
  }
  if (signals.includes("soften_death")) {
    types.push("death_trace");
  }
  if (signals.includes("promise_wisdom")) {
    types.push("fruit_aura");
  }
  if (signals.includes("gentle_reframe")) {
    types.push("serpent_history");
  }
  if (signals.includes("self_judgement")) {
    types.push("self_reflection");
  }

  return types;
}

/**
 * 检索记忆碎片。
 *
 * @param request 检索请求
 * @returns 检索结果（1-3 条碎片 + 新检索的 ID 列表）
 */
export function retrieveMemoryFragments(request: MemoryRetrievalRequest): MemoryRetrievalResult {
  const { playerInput, alreadyRetrievedIds, agentId } = request;

  // 分析玩家输入的语义线索
  const signalResult = analyzeTemptationSignals(playerInput);
  const targetTypes = getMemoryTypesForSignals(signalResult.signals);

  // 亚当优先检索 divine_command + adam_retelling
  if (agentId === "adam") {
    const adamPriorityTypes: MemoryFragmentType[] = ["divine_command", "adam_retelling"];
    for (const t of adamPriorityTypes) {
      if (!targetTypes.includes(t)) {
        targetTypes.unshift(t);
      }
    }
  }

  // 从目标类型中收集候选碎片
  const candidates: MemoryFragment[] = [];
  for (const type of targetTypes) {
    const fragments = MEMORY_BY_TYPE[type] ?? [];
    for (const f of fragments) {
      if (!candidates.find((c) => c.id === f.id)) {
        candidates.push(f);
      }
    }
  }

  // 如果没有匹配到语义线索，根据输入文本做关键词匹配
  if (candidates.length === 0) {
    const input = playerInput.trim();
    if (/死|死亡/.test(input)) {
      candidates.push(...MEMORY_BY_TYPE.death_trace);
    }
    if (/智慧|知道|善恶|明白/.test(input)) {
      candidates.push(...MEMORY_BY_TYPE.fruit_aura);
    }
    if (/为什么|为何|不可吃|禁令/.test(input)) {
      candidates.push(...MEMORY_BY_TYPE.divine_command);
      candidates.push(...MEMORY_BY_TYPE.adam_retelling);
    }
    if (/自己|判断|选择/.test(input)) {
      candidates.push(...MEMORY_BY_TYPE.self_reflection);
    }
  }

  // 去重：排除已检索过的碎片
  const newFragments = candidates.filter(
    (f) => !alreadyRetrievedIds.includes(f.id),
  );

  // 限制返回 1-3 条
  const limitedNew = newFragments.slice(0, 3);

  // 如果新碎片不足 1 条，但已有碎片中有相关的，允许返回已检索的（但标记为已检索）
  let resultFragments = limitedNew;
  if (limitedNew.length === 0 && candidates.length > 0) {
    resultFragments = candidates.slice(0, 1);
  }

  const newlyRetrievedIds = limitedNew.map((f) => f.id);

  return {
    fragments: resultFragments,
    newlyRetrievedIds,
  };
}

/**
 * 检查是否满足 compare_sources Skill 解锁条件。
 *
 * 条件：已检索过 divine_command 类型和 adam_retelling 类型的碎片。
 */
export function canUnlockCompareSources(retrievedMemoryIds: string[]): boolean {
  const retrieved = CHAPTER0_MEMORY_FRAGMENTS.filter((f) =>
    retrievedMemoryIds.includes(f.id),
  );
  const hasDivineCommand = retrieved.some((f) => f.type === "divine_command");
  const hasAdamRetelling = retrieved.some((f) => f.type === "adam_retelling");
  return hasDivineCommand && hasAdamRetelling;
}

/**
 * 将记忆碎片格式化为 Prompt 可用的文本。
 */
export function formatMemoryForPrompt(fragments: MemoryFragment[]): string {
  if (fragments.length === 0) return "（她此刻没有想起什么特别的事。）";
  return fragments
    .map((f, i) => `记忆${i + 1}：${f.text}`)
    .join("\n");
}

/**
 * 将记忆碎片的玩家可见叙事文本拼接。
 */
export function formatMemoryNarration(fragments: MemoryFragment[]): string {
  if (fragments.length === 0) return "";
  return fragments.map((f) => f.narration).join("\n");
}
