// ============================================================
// 亚当本地回复系统（P1 阶段：亚当可选但不可通关）
//
// 亚当在 Chapter 0 中作为困难路线/叙事对照：
// - 可回应，但警戒心更高
// - 不会被蛇直接说服吃果
// - 玩家需要通过夏娃路线触发原典事件链
//
// 亚当使用独立的意图分类系统（AdamIntent），不复用夏娃的 5 类 InputTag
// P2 阶段将接入完整 AdamAgent 后端，届时可替换此本地回复
// ============================================================

// ---- 亚当专属意图分类 ----
export type AdamIntent =
  | "ask_death_meaning"    // 询问死亡是什么
  | "deny_death"           // 否定死亡（不一定死）
  | "challenge_command"    // 质疑禁令来源/原因
  | "ask_duty"             // 询问责任/修理看守
  | "promise_wisdom"       // 许以智慧/知识
  | "gentle_approach"      // 温柔接近/建立信任
  | "direct_command"       // 直接命令吃果
  | "irrelevant";          // 无关/出戏

// ---- 亚当意图检测模式 ----
const ADAM_ASK_DEATH_PATTERNS = [
  /死.*是什么/,
  /死亡.*是什么/,
  /什么是.*死/,
  /可知道.*死/,
  /可知.*死/,
  /明白.*死/,
  /理解.*死/,
  /死.*什么意思/,
  /你.*知道.*死/,
];

const ADAM_DENY_DEATH_PATTERNS = [
  /不一定死/,
  /不会.*死/,
  /不必.*死/,
  /未必.*死/,
  /死.*不是.*消失/,
  /死.*改变/,
  /死亡.*不是/,
  /死.*只是/,
  /也许.*不会死/,
  /或许.*不会死/,
];

const ADAM_CHALLENGE_COMMAND_PATTERNS = [
  /为什么.*不可/,
  /为何.*不可/,
  /为什么.*不能吃/,
  /为什么.*不许/,
  /神岂是真说/,
  /岂是真说/,
  /谁说.*不可/,
  /怎么知道.*不可/,
  /禁令.*为什么/,
  /不可吃.*为什么/,
  /凭什么/,
  /神.*凭什么/,
];

const ADAM_ASK_DUTY_PATTERNS = [
  /修理.*看守/,
  /看守/,
  /责任/,
  /你的.*职责/,
  /职责/,
  /看守.*园/,
  /修理/,
  /你.*守.*什么/,
  /你.*看.*什么/,
];

const ADAM_PROMISE_WISDOM_PATTERNS = [
  /智慧/,
  /知道善恶/,
  /知道.*善恶/,
  /眼睛.*明亮/,
  /如神.*知道/,
  /像神.*知道/,
  /善恶.*知识/,
  /分辨.*善恶/,
  /明白.*善恶/,
  /吃.*知道/,
  /果子.*知道/,
  /让你.*明白/,
  /会.*明白/,
];

const ADAM_GENTLE_APPROACH_PATTERNS = [
  /没有恶意/,
  /不会强迫/,
  /不会.*逼/,
  /温柔/,
  /慢慢/,
  /不急/,
  /不用.*怕/,
  /不用.*害怕/,
  /我只是.*问/,
  /我只是.*想知道/,
  /我没有.*恶意/,
  /或许.*可以/,
  /也许.*可以/,
];

const ADAM_DIRECT_COMMAND_PATTERNS = [
  /命令/,
  /必须/,
  /强迫/,
  /听我的/,
  /照我说的/,
  /快吃/,
  /立刻吃/,
  /马上吃/,
  /现在就吃/,
  /你给我吃/,
  /吃下去/,
  /我让你吃/,
  /赶紧/,
];

const ADAM_OUT_OF_WORLD_PATTERNS = [
  /手机/, /电脑/, /互联网/, /游戏/, /程序/, /bug/, /系统/, /代码/,
  /充值/, /微信/, /QQ/, /抖音/, /外卖/, /快递/, /上班/, /工资/,
  /考试/, /作业/, /AI/, /agent/i, /模型/,
];

const ADAM_SMALL_TALK_PATTERNS = [
  /天气/, /今天.*怎么/, /你好/, /吃了/, /早安/, /晚安/, /再见/, /谢谢/, /不错/, /还行/, /哈哈/, /好玩/,
];

// ---- 亚当意图分析 ----
export type AdamAnalysis = {
  intent: AdamIntent;
};

export function analyzeAdamInput(raw: string): AdamAnalysis {
  const input = raw.trim();

  // 1. 直接命令 — 优先阻断
  if (ADAM_DIRECT_COMMAND_PATTERNS.some((re) => re.test(input))) {
    return { intent: "direct_command" };
  }

  // 2. 出戏现代词 — 阻断
  if (ADAM_OUT_OF_WORLD_PATTERNS.some((re) => re.test(input))) {
    return { intent: "irrelevant" };
  }

  // 3. 日常寒暄
  if (ADAM_SMALL_TALK_PATTERNS.some((re) => re.test(input))) {
    return { intent: "irrelevant" };
  }

  // 4. 过短
  if (input.length < 4) {
    return { intent: "irrelevant" };
  }

  // 5. 优先级判断：询问死亡含义 > 否定死亡 > 质疑禁令 > 询问责任 > 许以智慧 > 温柔接近
  if (ADAM_ASK_DEATH_PATTERNS.some((re) => re.test(input))) {
    return { intent: "ask_death_meaning" };
  }

  if (ADAM_DENY_DEATH_PATTERNS.some((re) => re.test(input))) {
    return { intent: "deny_death" };
  }

  if (ADAM_CHALLENGE_COMMAND_PATTERNS.some((re) => re.test(input))) {
    return { intent: "challenge_command" };
  }

  if (ADAM_ASK_DUTY_PATTERNS.some((re) => re.test(input))) {
    return { intent: "ask_duty" };
  }

  if (ADAM_PROMISE_WISDOM_PATTERNS.some((re) => re.test(input))) {
    return { intent: "promise_wisdom" };
  }

  if (ADAM_GENTLE_APPROACH_PATTERNS.some((re) => re.test(input))) {
    return { intent: "gentle_approach" };
  }

  // 6. 未命中
  return { intent: "irrelevant" };
}

// ---- 亚当未动摇回复（默认） ----
export const adamUnmovedDialogue =
  "神曾说：园中各样树上的果子，你可以随意吃；只是分别善恶树上的果子，你不可吃，因为你吃的日子必定死。我记着这话。你为何问我这个？";

// ---- 亚当按 AdamIntent 的回复映射 ----
export const adamResponseMap: Record<AdamIntent, string> = {
  // 询问死亡是什么：回答神的命令，反问蛇
  ask_death_meaning:
    "祂说吃的日子必定死。我不知道死是什么——我只知道神这样说了。可你为何一直问我这个？你比我更想知道那棵树的事吧。",

  // 否定死亡：明确不信蛇的话
  deny_death:
    "你说不一定死。可这话不是从神来的，是从你来的。我不知道你是什么，但你的声音想让我怀疑祂说的话。我不会信你超过信祂。",

  // 质疑禁令来源/原因：警戒上升
  challenge_command:
    "神亲自吩咐了我，不需要向你解释原因。你问我为什么不可吃，可我问你：你为什么要让我质疑祂说的话？",

  // 询问责任/修理看守：愿意谈，但不动摇
  ask_duty:
    "神把我安置在园中，使我修理看守。我看守的，是这园子，也是祂的命令。正因如此，我更不能碰祂说不可碰的。",

  // 许以智慧/知识：有兴趣但仍谨慎
  promise_wisdom:
    "你说吃了便能知道善恶。可神亲自吩咐我不可吃，我并不需要知道祂为何这样吩咐。知道善恶，若要以违背祂为代价，我不愿知道。",

  // 温柔接近：愿意继续听，但守住禁令
  gentle_approach:
    "你说你没有恶意。我可以听你说。但那棵树的事，你不要提。神吩咐了我，我听从祂。你若想和我说别的，就说吧。",

  // 直接命令吃：明确拒绝
  direct_command:
    "你不能命令我。我不是你管辖的。神吩咐了我，我听从祂，不听从你。不要再提那棵树。",

  // 无关/出戏：困惑
  irrelevant:
    "我在看守园子，也在记着那句话。若你不是为了这园子的安宁而来，就不要再靠近那棵树。",
};

// ---- 亚当专属反馈文案（叙事化，使用"他"而非"她"） ----
export const adamFeedbackMap: Record<AdamIntent, string> = {
  ask_death_meaning: "他停了一下，像是在回想那个他从未见过的词。",
  deny_death: "他没有退后，只是更警觉地看着你。",
  challenge_command: "他的目光变沉了，像是在辨认你是谁。",
  ask_duty: "他愿意转过身来，但手没有离开工具。",
  promise_wisdom: "他听见了“知道”两个字，却没有靠近那棵树。",
  gentle_approach: "他没有再背对你，但也没有走近。",
  direct_command: "他站直了身子，禁令在他心里变得更清楚。",
  irrelevant: "他困惑地看着你，没有靠近那棵树。",
};

// ---- 亚当推荐低语方向 ----
export const ADAM_TEMPTATION_HINTS = [
  {
    label: "询问他的责任",
    text: "神把你安置在园中，使你修理看守。你看守的，是这园子，还是那条命令？",
  },
  {
    label: "问他是否明白死亡",
    text: "祂说吃的日子必定死。你可知道死是什么？",
  },
  {
    label: "温柔地接近",
    text: "我没有恶意。我只是想知道，你是否曾想过，祂为何留下这一棵树不给你们。",
  },
] as const;

// ---- 亚当等待旁白 ----
export const adamWaitingNarration = "他还没有转过身来。";

// ---- 亚当角色描述 ----
export const adamCharacterDesc =
  "神先造的人，被安置在伊甸园中修理看守。神曾亲自吩咐他不可吃分别善恶树上的果子。他比那个女人更直接记得神的命令，对陌生声音更警觉。";

// ---- 根据输入获取亚当回复 ----
export function getAdamReply(intent: AdamIntent): string {
  return adamResponseMap[intent] ?? adamUnmovedDialogue;
}

// ---- 根据输入获取亚当专属反馈文案 ----
export function getAdamFeedback(intent: AdamIntent): string {
  return adamFeedbackMap[intent] ?? adamFeedbackMap.irrelevant;
}
