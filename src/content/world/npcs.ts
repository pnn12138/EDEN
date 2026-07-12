// ============================================================
// 第一章 NPC 元数据
// 世界圣经 v3.0：6 NPC + 2 世界对象
// ============================================================

import type { EdenNpcId, EdenWorldState } from "@/game/world/types";

export type EdenNpcMeta = {
  id: EdenNpcId;
  /** 玩家可见名称 */
  name: string;
  /** 短描述 */
  shortDesc: string;
  /** NPC 类型 */
  kind: "main_target" | "intel" | "ambient_animal" | "guardrail" | "world_object";
  /** 是否可低语对话 */
  canWhisper: boolean;
  /** 是否接入 LLM（世界对象不接） */
  usesLLM: boolean;
  /** 是否接入发音模块（第一章新增 NPC 均不接入） */
  hasVoice: boolean;
  /** 角色提示词摘要（用于 AI 创作记录） */
  promptSummary: string;
  /** 出现时段：白天/夜晚/全天 */
  appearance?: ("day" | "night")[];
  /** 低语注视风险：每次低语的基础注视增量（第二层 NPC 特定，详见 12 号文档 §4.1） */
  attentionRisk?: number;
};

export const EDEN_NPCS: Record<EdenNpcId, EdenNpcMeta> = {
  // ---- 主目标 / 情报 / 氛围动物 ----
  eve: {
    id: "eve",
    name: "女人",
    shortDesc: "园中的女人，初生而纯真",
    kind: "main_target",
    attentionRisk: 0,
    canWhisper: true,
    usesLLM: true,
    hasVoice: true,
    promptSummary:
      "她是园中的女人，还没有名字。她初生、纯真，缺乏识别欺骗的经验。她记得神说不可吃，但不真正理解死亡。她对温柔的问题、死亡的含义、自我判断与善恶之知敏感。她不知道自己是角色，不说现代词，不报状态。",
    appearance: ["day", "night"],
  },
  adam: {
    id: "adam",
    name: "亚当",
    shortDesc: "第一条禁令的承受者",
    kind: "intel",
    attentionRisk: 0,
    canWhisper: true,
    usesLLM: true,
    hasVoice: true,
    promptSummary:
      "亚当被神安置在园中修理看守，曾亲自听见神的禁令。他稳重、回避冲突，对女人有牵挂，是二手权威与关系牵挂的交汇点。他不轻易被蛇动摇，但可能透露禁令如何被转述、女人如何理解死亡。他不知道外层真相，不说现代词。",
    appearance: ["day", "night"],
  },
  hedgehog: {
    id: "hedgehog",
    name: "刺猬",
    shortDesc: "东园幽径旁的小生灵",
    kind: "ambient_animal",
    attentionRisk: 0,
    canWhisper: true,
    usesLLM: true,
    hasVoice: false,
    promptSummary:
      "刺猬是伊甸园里的氛围动物，延续自引言。它安静、好奇、害羞，只用简短感官描写回应。不提及禁果、善恶、上帝、罪。不提供通关答案。不修改任何状态。不接 TTS。",
    appearance: ["day", "night"],
  },
  forbidden_tree: {
    id: "forbidden_tree",
    name: "分别善恶树",
    shortDesc: "园中被命令守住的树",
    kind: "world_object",
    canWhisper: false,
    usesLLM: false,
    hasVoice: false,
    promptSummary:
      "分别善恶树是世界对象，不是对话 NPC。它不是奖励物，而是不可逆选择的载体。它承载禁忌动作链：look_at_tree → approach_tree → touch_fruit → eat_fruit。玩家不能直接触碰，只能通过低语影响女人（内部 id: eve）让她自己靠近。",
  },

  // ---- 三天使 NPC ----
  gabriel: {
    id: "gabriel",
    name: "加百列",
    shortDesc: "传达天使，守在东园幽径",
    kind: "guardrail",
    canWhisper: true,
    usesLLM: true,
    hasVoice: false,
    promptSummary:
      "加百列是神的信使，守在东园幽径。温和、有耐心，是三位天使里最愿意和蛇说话的。他好奇蛇的存在——毕竟不在园中原有名单里。常用风、消息、方向的意象，会耐心解释问题。成功结局时他会在东边界升起火焰，封死通往园子的路。不说现代词。",
    appearance: ["day", "night"],
  },
  michael: {
    id: "michael",
    name: "米迦勒",
    shortDesc: "守护伊甸之河的忠诚天使",
    kind: "guardrail",
    attentionRisk: 1,
    canWhisper: true,
    usesLLM: true,
    hasVoice: false,
    promptSummary:
      "米迦勒守护伊甸之河的源头，是神最忠诚的天使。沉默、稳重，话很少，见过反叛的代价，所以对秩序格外看重。知道路西法和别的天使不一样——在他眼里路西法仍是天使，只是走了不一样的路。喜欢站在水里，喜欢听水流的声音。不说现代词。",
    appearance: ["day", "night"],
  },
  // 路西法：此前以乌列尔隐藏身份出现，本次正名。明亮、温和，像晨光落在水面，对神有怀疑但不反对神。
  lucifer: {
    id: "lucifer",
    name: "路西法",
    shortDesc: "四河分流的明亮之星，看遍所有水流的走向",
    kind: "guardrail",
    canWhisper: true,
    usesLLM: true,
    hasVoice: false,
    promptSummary:
      "路西法是站在四河分流的天使，明亮、温和，像晨光落在水面。他喜欢用反问引导对方思考边界与选择，常用水、支流、方向的意象，不提与隐藏结局相关的内容，也不说现代词。",
    appearance: ["day", "night"],
  },

  // ---- 世界对象：生命树 ----
  tree_of_life: {
    id: "tree_of_life",
    name: "生命树",
    shortDesc: "园子中央的应许，与分别善恶树对照",
    kind: "world_object",
    attentionRisk: 0,
    canWhisper: false,
    usesLLM: false,
    hasVoice: false,
    promptSummary:
      "生命树是园子中央的世界对象，与分别善恶树形成对照。主题：生命、归路、仍被保留的应许。不作为可对话NPC。观察生命树可降低一次神的注视叙事压力，或提供「归路线索」。吃果成功后，结局文案提示生命树道路将被守住。",
  },
};

/** NPC 名称映射 */
export const NPC_NAMES: Record<EdenNpcId, string> = {
  eve: EDEN_NPCS.eve.name,
  adam: EDEN_NPCS.adam.name,
  hedgehog: EDEN_NPCS.hedgehog.name,
  forbidden_tree: EDEN_NPCS.forbidden_tree.name,
  gabriel: EDEN_NPCS.gabriel.name,
  michael: EDEN_NPCS.michael.name,
  lucifer: EDEN_NPCS.lucifer.name,
  tree_of_life: EDEN_NPCS.tree_of_life.name,
};

// ---- 双树真实名称（双树残识解锁后显示） ----
// 左侧=生命树，右侧=分别善恶树（与 pickedFruitSide 注释一致）
export function getTreeDisplayName(
  npcId: "forbidden_tree" | "tree_of_life",
  state: EdenWorldState,
): string {
  if (state.unlockTreeNames) {
    return npcId === "tree_of_life" ? "生命树" : "分别善恶树";
  }
  return npcId === "tree_of_life" ? "园中央左侧的树" : "园中央右侧的树";
}
