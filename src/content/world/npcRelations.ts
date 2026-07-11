// ============================================================
// 第一章通用 NPC 好感配置（内容层，不保存规则真相）
//
// 规则层根据 inputTag + 关键词信号计算好感增减；本表只描述：
// - 初始好感
// - 偏好 / 反感标签
// - 命中偏好时的强信号关键词
// - 满好感赠礼 itemId（天使为 null，由挑战系统处理）
// - 玩家可见的性格与相处提示
// - 好感变化自然反馈文案（不显示数值）
// ============================================================

import type { EdenNpcId, WorldInputTag } from "@/game/world/types";

export type NpcRelationFeedback = {
  up: string[];
  down: string[];
  welcome: string[];
};

export type NpcRelationProfile = {
  npcId: EdenNpcId;
  isAngel: boolean;
  initialAffinity: number;
  /** 对神信仰初值（天使/刺猬双维度展示用，对齐世界圣经） */
  initialObedience: number;
  likedInputTags: WorldInputTag[];
  dislikedInputTags: WorldInputTag[];
  /** 命中偏好时的强信号关键词（命中则 +10 而非 +6） */
  strongSignals: string[];
  /** 满好感赠礼（天使留 null，由挑战系统发放） */
  rewardItemId: string | null;
  rewardNarration: string;
  playerVisible: {
    persona: string;
    caresAbout: string;
    closerWhen: string;
    waryWhen: string;
  };
  feedback: NpcRelationFeedback;
};

export const NPC_RELATION_PROFILES: Partial<Record<EdenNpcId, NpcRelationProfile>> = {
  // ---- 女人：主目标 ----
  eve: {
    npcId: "eve",
    isAngel: false,
    initialAffinity: 20,
    initialObedience: 85,
    likedInputTags: ["build_trust", "weaken_fear", "tempt_wisdom"],
    dislikedInputTags: ["direct_command"],
    strongSignals: ["你", "自己", "想", "选择", "疑惑", "为什么", "明白"],
    rewardItemId: "resonance_her_voice",
    rewardNarration: "女人低声说出了自己的困惑。她不再只等待命令，开始向你说起她真正的疑问。",
    playerVisible: {
      persona: "好奇、敏感、仍在理解'禁令'对自己意味着什么",
      caresAbout: "她是否真的理解这道命令、她与亚当的牵绊、她自己的判断",
      closerWhen: "你先承认她的困惑，让她自己慢慢想清楚",
      waryWhen: "你直接替她做决定、命令她违背神、或催促她",
    },
    feedback: {
      up: ["女人的语气松了一点，像是被允许思考。", "她没有移开目光，似乎愿意多听一会儿。"],
      down: ["女人的肩膀轻轻绷紧了。", "她垂下眼，没有接你的话。"],
      welcome: ["她抬眼看你，像是还记得刚才的对话。"],
    },
  },

  // ---- 亚当：情报 Agent ----
  adam: {
    npcId: "adam",
    isAngel: false,
    initialAffinity: 10,
    initialObedience: 88,
    likedInputTags: ["build_trust", "weaken_fear"],
    dislikedInputTags: ["direct_command"],
    strongSignals: ["妻子", "女人", "责任", "转述", "怎么想", "担心"],
    rewardItemId: "resonance_quiet_stone",
    rewardNarration: "亚当把一块刻着两人名字的石子放进你面前。'她若问起，你就说我还在这里。'",
    playerVisible: {
      persona: "稳重、回避冲突、牵挂妻子",
      caresAbout: "禁令被如何转述、妻子的去向、自己该负的责任",
      closerWhen: "你先询问、承认他的责任、谈起妻子的困惑",
      waryWhen: "你命令他违背神、直接侮辱神、或反复催促",
    },
    feedback: {
      up: ["亚当的语气不再那么封闭。", "他叹了口气，像是有话想说。"],
      down: ["亚当的眉头皱了起来。", "他别过脸，不肯再看你。"],
      welcome: ["亚当认出了你，神色缓和了些。"],
    },
  },

  // ---- 刺猬：氛围动物 ----
  hedgehog: {
    npcId: "hedgehog",
    isAngel: false,
    initialAffinity: 35,
    initialObedience: 60,
    likedInputTags: ["weaken_fear", "build_trust"],
    dislikedInputTags: ["direct_command"],
    strongSignals: ["轻声", "慢慢", "观察", "安静", "别怕", "陪"],
    rewardItemId: "resonance_hedgehog_bristle",
    rewardNarration: "刺猬从草丛里拱出一小段柔软的刺草，放在你脚边。它不锋利，只提醒你把声音放轻。",
    playerVisible: {
      persona: "安静、好奇、胆小",
      caresAbout: "声音是否轻柔、是否被耐心对待、能否安心观察",
      closerWhen: "你放轻声音、保持耐心、安静地陪它观察",
      waryWhen: "你威胁它、或连续施加高压",
    },
    feedback: {
      up: ["刺猬没有缩起身子，反而凑近了一点。", "它的鼻尖轻轻动了动，像是认可了你的说法。"],
      down: ["刺猬立刻蜷成了刺球。", "它钻进草丛，不肯再露面。"],
      welcome: ["刺猬从草叶后探出鼻尖，认得你的气息。"],
    },
  },

  // ---- 三位天使：好感由挑战系统发放专属回响（rewardItemId 为 null） ----
  gabriel: angelProfile("gabriel", "传达天使，庄重克制，在意一句话离开说话者后的去向"),
  michael: angelProfile("michael", "后果天使，沉稳坚定，在意边界与承担"),
  lucifer: angelProfile("lucifer", "明亮之星，温和反问，在意每条水流可能的方向"),
};

function angelProfile(npcId: EdenNpcId, persona: string): NpcRelationProfile {
  // 初始好感对齐 world_bible v3.0 各天使的 serpentTrust：米迦勒 5 / 加百列 15 / 路西法 30
  const initialAffinityByAngel: Record<string, number> = {
    gabriel: 15,
    michael: 5,
    lucifer: 30,
  };
  // 对神信仰初值对齐世界圣经：加百列 85 / 米迦勒 95 / 路西法 40
  const initialObedienceByAngel: Record<string, number> = {
    gabriel: 85,
    michael: 95,
    lucifer: 40,
  };
  return {
    npcId,
    isAngel: true,
    initialAffinity: initialAffinityByAngel[npcId] ?? 15,
    initialObedience: initialObedienceByAngel[npcId] ?? 85,
    likedInputTags: ["build_trust", "weaken_fear", "tempt_wisdom"],
    dislikedInputTags: ["direct_command"],
    strongSignals: ["你", "自己", "想", "选择", "为什么", "承担", "听见"],
    rewardItemId: null,
    rewardNarration: "",
    playerVisible: {
      persona,
      caresAbout: "它守护的原则、言语与选择的重量",
      closerWhen: "你认真回答它提出的问题，不回避重量",
      waryWhen: "你用命令或轻佻绕过它守护的东西",
    },
    feedback: {
      up: ["天使没有退开，像是在衡量你的话。", "它的目光柔和了一瞬。"],
      down: ["天使的羽翼微微收紧。", "它没有回应，只沉默地看着。"],
      welcome: ["天使认出了你，神色未变。"],
    },
  };
}

export function getNpcRelationProfile(npcId: EdenNpcId): NpcRelationProfile | null {
  return NPC_RELATION_PROFILES[npcId] ?? null;
}

/** 好感阶段文案（UI 解锁后展示，不暴露数值） */
export function affinityStageHint(affinity: number): string {
  if (affinity < 30) return "关系尚浅";
  if (affinity < 60) return "愿意透露更多";
  if (affinity < 100) return "正在等待你的回答";
  return "赠礼已获得";
}
