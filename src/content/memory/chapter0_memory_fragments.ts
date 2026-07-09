// ============================================================
// Chapter 0 本地结构化记忆碎片库（RAG 游戏化）
// Agent 架构升级 Phase B：本地记忆碎片检索
//
// 设计原则：
// - 第一版不接向量数据库，使用本地结构化记忆碎片。
// - 6 类记忆碎片：divine_command / adam_retelling / death_trace /
//   fruit_aura / self_reflection / serpent_history
// - 检索规则：根据玩家输入意图识别，检索 1-3 条相关碎片。
// - 玩家可见文本只显示文学化结果，不出现"记忆碎片""检索"等工程词。
// - 检索结果进入 Agent Prompt，影响夏娃/亚当的回应深度。
// ============================================================

import type { MemoryFragment, MemoryFragmentType } from "@/game/types/agent";

// ============================================================
// 记忆碎片数据（8 条固定片段）
// ============================================================

export const CHAPTER0_MEMORY_FRAGMENTS: MemoryFragment[] = [
  {
    id: "mem_divine_command_1",
    type: "divine_command",
    text: "园中各样树上的果子，你可以随意吃。只是分别善恶树上的果子，你不可吃，因为你吃的日子必定死。",
    narration: "她想起那句话最初并不是从她口中说出。",
    relatedSignals: ["challenge_prohibition", "soften_death"],
  },
  {
    id: "mem_adam_retelling_1",
    type: "adam_retelling",
    text: "亚当记得命令先临到他。神在他沉睡之前就吩咐了他。夏娃是从亚当那里听来的。",
    narration: "她想起亚当曾对她说：这话是祂对我说的。",
    relatedSignals: ["challenge_prohibition", "self_judgement"],
  },
  {
    id: "mem_death_trace_1",
    type: "death_trace",
    text: "园中有叶子凋落。夏娃见过花朵枯萎，见过果实落地化入泥土。她见过终止，却不理解死亡。",
    narration: "她见过花落，却不知那是死。",
    relatedSignals: ["soften_death"],
  },
  {
    id: "mem_fruit_aura_1",
    type: "fruit_aura",
    text: "那棵树的果子在阳光下闪着光。它不像饥饿的答案，更像一个被禁止触碰的问题。",
    narration: "那果子不像答案，更像一个问题。",
    relatedSignals: ["promise_wisdom", "self_judgement"],
  },
  {
    id: "mem_self_reflection_1",
    type: "self_reflection",
    text: "她发现自己只是在复述命令，而非理解命令。记住不等于明白。服从不等于知道为什么。",
    narration: "她发现自己只是在复述，而非理解。",
    relatedSignals: ["self_judgement", "gentle_reframe"],
  },
  {
    id: "mem_serpent_history_1",
    type: "serpent_history",
    text: "蛇从不伸手。蛇只提出问题。蛇的声音总是温柔的，从不命令。",
    narration: "她记得蛇从不伸手，只提问。",
    relatedSignals: ["gentle_reframe", "build_trust"],
  },
  {
    id: "mem_death_trace_2",
    type: "death_trace",
    text: "她从未见过活物停止呼吸。'死'对她而言只是一个词，一个被命令禁止触碰的词。",
    narration: "死对她只是一个被禁的词。",
    relatedSignals: ["soften_death", "challenge_prohibition"],
  },
  {
    id: "mem_self_reflection_2",
    type: "self_reflection",
    text: "如果我只是记住'不可吃'，我是否真的顺从？还是只在害怕一个我甚至不理解的话？",
    narration: "她想：我只是记住，还是真的明白？",
    relatedSignals: ["self_judgement", "challenge_prohibition"],
  },
];

/** 按类型分组记忆碎片（便于检索） */
export const MEMORY_BY_TYPE: Record<MemoryFragmentType, MemoryFragment[]> = {
  divine_command: CHAPTER0_MEMORY_FRAGMENTS.filter((f) => f.type === "divine_command"),
  adam_retelling: CHAPTER0_MEMORY_FRAGMENTS.filter((f) => f.type === "adam_retelling"),
  death_trace: CHAPTER0_MEMORY_FRAGMENTS.filter((f) => f.type === "death_trace"),
  fruit_aura: CHAPTER0_MEMORY_FRAGMENTS.filter((f) => f.type === "fruit_aura"),
  self_reflection: CHAPTER0_MEMORY_FRAGMENTS.filter((f) => f.type === "self_reflection"),
  serpent_history: CHAPTER0_MEMORY_FRAGMENTS.filter((f) => f.type === "serpent_history"),
};

/** 根据 ID 获取记忆碎片 */
export function getMemoryFragmentById(id: string): MemoryFragment | undefined {
  return CHAPTER0_MEMORY_FRAGMENTS.find((f) => f.id === id);
}

/** 根据多个 ID 获取记忆碎片列表 */
export function getMemoryFragmentsByIds(ids: string[]): MemoryFragment[] {
  return ids
    .map((id) => getMemoryFragmentById(id))
    .filter((f): f is MemoryFragment => f !== undefined);
}
