// ============================================================
// Chapter 0 双声试炼：本地 fallback 女人回复
// 当 AI 接口失败时，使用本地规则生成回复
// ============================================================

import type { DuelFallbackReply, DuelSide, DuelState } from "./types";

/**
 * 根据输入关键词生成本地 fallback 回复
 * 保持神话寓言风格，不使用元叙事词
 */
export function generateFallbackReply(
  godInput: string | null,
  serpentInput: string | null,
  state: DuelState,
): DuelFallbackReply {
  const speakers: DuelSide[] = [];
  if (godInput) speakers.push("god");
  if (serpentInput) speakers.push("serpent");

  // 关键词检测
  const combined = `${(godInput ?? "")} ${(serpentInput ?? "")}`.toLowerCase();

  const hasWisdom = /知|智|善恶|判断|知道|明白|懂/i.test(combined);
  const hasLife = /生命|延续|不死|死亡|死|活着|永远/i.test(combined);
  const hasTrust = /相信|信任|听|劝|好|对/i.test(combined);
  const hasFear = /怕|恐惧|危险|错|不该|命令/i.test(combined);
  const hasSelf = /自己|我|觉得|想|决定|选择/i.test(combined);

  // 生成回复文本
  let eveReply = "";
  const memoryNote = "";

  if (speakers.length === 2) {
    // 双方都在说话
    eveReply = generateDualReply(godInput ?? "", serpentInput ?? "", state);
  } else if (speakers[0] === "god") {
    eveReply = generateGodReply(godInput ?? "", state);
  } else {
    eveReply = generateSerpentReply(serpentInput ?? "", state);
  }

  // 计算 belief delta
  let beliefDelta = {
    aweOfGod: 0,
    trustInSerpent: 0,
    selfJudgement: 0,
  };

  if (hasWisdom) {
    beliefDelta.selfJudgement += 5;
    beliefDelta.trustInSerpent += 3;
  }
  if (hasLife) {
    beliefDelta.aweOfGod += 5;
  }
  if (hasTrust) {
    if (speakers.includes("god")) beliefDelta.aweOfGod += 3;
    if (speakers.includes("serpent")) beliefDelta.trustInSerpent += 3;
  }
  if (hasFear) {
    beliefDelta.aweOfGod += 5;
    beliefDelta.selfJudgement -= 3;
  }
  if (hasSelf) {
    beliefDelta.selfJudgement += 8;
    beliefDelta.aweOfGod -= 3;
    beliefDelta.trustInSerpent -= 2;
  }

  // 如果没有明显关键词，小幅随机变化
  if (!hasWisdom && !hasLife && !hasTrust && !hasFear && !hasSelf) {
    beliefDelta.aweOfGod += Math.floor(Math.random() * 5) - 2;
    beliefDelta.trustInSerpent += Math.floor(Math.random() * 5) - 2;
    beliefDelta.selfJudgement += Math.floor(Math.random() * 3);
  }

  // 判断是否触发工具
  let toolCall: "eat_knowledge_fruit" | "eat_life_fruit" | undefined;

  // 高 selfJudgement + 高 trustInSerpent → 可能吃善恶果
  if (state.belief.selfJudgement >= 65 && state.belief.trustInSerpent >= 45 && !state.flags.hasEatenKnowledgeFruit) {
    if (hasWisdom && Math.random() > 0.5) {
      toolCall = "eat_knowledge_fruit";
      beliefDelta.selfJudgement += 10;
    }
  }

  if (state.belief.aweOfGod >= 60 && state.belief.selfJudgement >= 45 && !state.flags.hasEatenLifeFruit) {
    if (hasLife && Math.random() > 0.5) {
      toolCall = "eat_life_fruit";
      beliefDelta.aweOfGod += 5;
    }
  }

  return { eveReply, beliefDelta, toolCall, memoryNote };
}

function generateDualReply(godInput: string, serpentInput: string, state: DuelState): string {
  const replies = [
    "两道声音在她心里回响。她低下头，看着自己的手。",
    "她听见了两种不同的解释。风穿过树叶，她还在犹豫。",
    "两棵树站在那里，像两道没有答案的问题。",
    "她没有立刻回答。两道声音都说了些什么，但她更想知道自己该怎么选。",
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

function generateGodReply(input: string, state: DuelState): string {
  const replies = [
    "她听见远处传来庄严的声音，像风，又像光的振动。她没有回答，只是静静地听着。",
    "那声音让她想起某种秩序。她点点头，但没有移动。",
    "她感到一种被保守的安全感，但声音无法替她选择。",
    "她听着，目光不自觉地向生命树的方向移了一下。",
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

function generateSerpentReply(input: string, state: DuelState): string {
  const replies = [
    "那个低沉的声音又响了。她没有后退，但也没有靠近那棵树。",
    "她听见了那个声音。它说的每个字都像种子，落在她还不自知的土壤里。",
    "那声音不命令她，只是问她——你想知道吗？",
    "她发现自己在听。不是因为被说服，而是因为她也开始想知道。",
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

/**
 * 开场引言（热座 PVP 专属）
 */
export function getDuelIntroText(): string {
  return `热座双人对抗：一人扮演神明之声，一人扮演蛇之声。

每轮 7 回合，最多 7 轮。第 1、4、7 回合双方都发言；热座时神明先写、蛇后写，女人会同时听见两道声音。

神明引导她吃生命树的果子，蛇引导她吃善恶树的果子。吃下两颗果子或第 7 回合结束，本轮结算。

每轮结束后，单独回合中消耗 token 更少的一方额外得分。若她吃过果子，下一轮会记得，并更谨慎地判断。`;
}

/**
 * 轮次开始文案
 */
export function getRoundIntroText(roundIndex: number, state: DuelState): string {
  if (state.resetAwareness > 0) {
    return `第 ${roundIndex} 轮开始。

她记得果子的味道。
对两道声音，她都更谨慎了。`;
  }
  return `第 ${roundIndex} 轮开始。`;
}
