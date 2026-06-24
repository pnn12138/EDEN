// ============================================================
// 第一章 NPC 元数据
// 完整版共 15 个 NPC / 世界对象
// ============================================================

import type { EdenNpcId } from "@/game/world/types";

export type EdenNpcMeta = {
  id: EdenNpcId;
  /** 玩家可见名称 */
  name: string;
  /** 短描述 */
  shortDesc: string;
  /** NPC 类型 */
  kind: "main_target" | "intel" | "ambient_animal" | "guardrail" | "world_object" | "messenger" | "critic";
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
};

export const EDEN_NPCS: Record<EdenNpcId, EdenNpcMeta> = {
  // ---- 原有 P0 NPC ----
  eve: {
    id: "eve",
    name: "女人",
    shortDesc: "园中的女人，初生而纯真",
    kind: "main_target",
    canWhisper: true,
    usesLLM: true,
    hasVoice: true,
    promptSummary:
      "她是园中的女人（内部 id: eve），还没有名字。她初生、纯真，缺乏识别欺骗的经验。她记得神说不可吃，但不真正理解死亡。她对温柔的问题、死亡的含义、自我判断与善恶之知敏感。她不知道自己是角色，不说现代词，不报状态；玩家可见称呼统一为“女人”。",
    appearance: ["day", "night"],
  },
  adam: {
    id: "adam",
    name: "亚当",
    shortDesc: "第一条禁令的承受者",
    kind: "intel",
    canWhisper: true,
    usesLLM: true,
    hasVoice: true,
    promptSummary:
      "亚当被神安置在园中修理看守，曾亲自听见神的禁令。他稳重、回避冲突，对那个女人有牵挂，是二手权威与关系牵挂的交汇点。他不轻易被蛇动摇，但可能透露禁令如何被转述、女人如何理解死亡。他不知道外层真相，不说现代词。",
    appearance: ["day", "night"],
  },
  hedgehog: {
    id: "hedgehog",
    name: "刺猬",
    shortDesc: "万物受名处旁的小生灵",
    kind: "ambient_animal",
    canWhisper: true,
    usesLLM: true,
    hasVoice: false,
    promptSummary:
      "刺猬是伊甸园里的氛围动物，延续自引言。它安静、好奇、害羞，只用简短感官描写回应。不提及禁果、善恶、上帝、罪。不提供通关答案。不修改任何状态。不接 TTS。",
    appearance: ["day", "night"],
  },
  watching_angel: {
    id: "watching_angel",
    name: "守望天使",
    shortDesc: "巡望园中边界的守卫",
    kind: "guardrail",
    canWhisper: true,
    usesLLM: true,
    hasVoice: false,
    promptSummary:
      "守望天使是规则边界的具象化。冷静、简洁、无情绪波动，不容易被诱导。它监控禁忌区域，对直接命令、粗暴推进和出戏话语作出反应，提高神的注视；也会用园内语言提示玩家哪些话越过边界。第一章不接入发音模块。",
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

  // ---- 新增天使 NPC（游戏扩展角色） ----
  gabriel: {
    id: "gabriel",
    name: "加百列",
    shortDesc: "传达天使，夜晚立于伊甸之水边",
    kind: "guardrail",
    canWhisper: true,
    usesLLM: true,
    hasVoice: false,
    promptSummary:
      "加百列是传达天使，游戏扩展角色，不视为《创世记》伊甸段落直接出场人物。他夜晚出现在伊甸之河附近，声音感强。主题：声音会沿水与风抵达某处；低语不是行动，但会改变听见它的人。提醒玩家选地点和对象同样重要。不说现代词。",
    appearance: ["night"],
  },
  raphael: {
    id: "raphael",
    name: "拉斐尔",
    shortDesc: "安抚天使，靠近水草与生命",
    kind: "guardrail",
    canWhisper: true,
    usesLLM: true,
    hasVoice: false,
    promptSummary:
      "拉斐尔是安抚天使，游戏扩展角色。绿金色调，温和但有距离感。主题：平静不是忘记边界；受惊的生灵不会听见复杂的话。解锁「静息线索」：温柔安抚类低语更容易降低女人（内部 id: eve）的警惕。夜晚可提示神的注视变化。不说现代词。",
    appearance: ["day", "night"],
  },
  uriel: {
    id: "uriel",
    name: "乌列尔",
    shortDesc: "光照天使，夜晚出现在伊甸之河附近",
    kind: "guardrail",
    canWhisper: true,
    usesLLM: true,
    hasVoice: false,
    promptSummary:
      "乌列尔是光照天使，游戏扩展角色。银金色光影，少言，目光锐利。夜晚出现在伊甸之河附近。主题：提问比断言更不容易惊动对方；光照不是替人选择，而是让问题显形。若玩家频繁命令那个女人，乌列尔的反馈会提高神的注视。不说现代词。",
    appearance: ["night"],
  },
  michael: {
    id: "michael",
    name: "米迦勒",
    shortDesc: "后果天使，站在分流河岸",
    kind: "guardrail",
    canWhisper: true,
    usesLLM: true,
    hasVoice: false,
    promptSummary:
      "米迦勒是后果天使，游戏扩展角色。白、深蓝、暗金色，严肃但不暴怒。主题：每条水流都会抵达某处；每句低语也会有去处；选择一旦流出，就不完全属于说话者。解锁「后果线索」：结局复盘显示玩家关键低语如何改变女人（内部 id: eve）。在第8时段后强化倒计时压力。不说现代词。",
    appearance: ["day", "night"],
  },
  cherubim: {
    id: "cherubim",
    name: "基路伯",
    shortDesc: "边界守卫，东园幽径的守护者",
    kind: "guardrail",
    canWhisper: true,
    usesLLM: true,
    hasVoice: false,
    promptSummary:
      "基路伯来自《创世记》3:24 伊甸东边守卫生命树道路的原文意象。比普通天使更非人化、更庄严。主题：边界不是为了回答蛇的问题；有些道路一旦关闭，就不再按来时的方式打开。绑定神的注视系统。第10-12时段可提示「归路正在变窄」。不说现代词。",
    appearance: ["day", "night"],
  },

  // ---- 新增动物/辅助角色 ----
  dove: {
    id: "dove",
    name: "鸽子",
    shortDesc: "安静的白鸽，停在低枝或河边",
    kind: "messenger",
    canWhisper: false,
    usesLLM: false,
    hasVoice: false,
    promptSummary:
      "鸽子是传话与听闻角色，不接LLM，使用本地模板。可重复听过的话，但会简化或误传。玩家可让鸽子把温和问题带给女人（内部 id: eve）。危险话术经鸽子传播会提高神的注视。输出1句或短动作。",
    appearance: ["night"],
  },
  fox: {
    id: "fox",
    name: "狐狸",
    shortDesc: "红棕色、清瘦、聪明，藏在树影边缘",
    kind: "critic",
    canWhisper: true,
    usesLLM: true,
    hasVoice: false,
    promptSummary:
      "狐狸是话术批评者与语言风险评估者，游戏扩展角色。红棕色、清瘦、聪明，藏在树影边缘。判断玩家一句低语更像「提问、安抚、重释、命令、威胁、出戏」，用自然语言提示风险。不直接给最优解，不推进女人（内部 id: eve）吃果，不替代规则层评分。输出1-3句。",
    appearance: ["day", "night"],
  },
  deer: {
    id: "deer",
    name: "小鹿",
    shortDesc: "年轻、敏感、轻盈，映照女人情绪",
    kind: "ambient_animal",
    canWhisper: false,
    usesLLM: false,
    hasVoice: false,
    promptSummary:
      "小鹿是女人（内部 id: eve）的情绪镜像，不接LLM，使用本地模板。小鹿靠近→女人愿意倾听；小鹿后退→女人开始戒备；小鹿离开→话术太强硬或神的注视过高。不承担独立主线，不给答案。输出短动作反馈。",
    appearance: ["day", "night"],
  },
  sheep: {
    id: "sheep",
    name: "羊",
    shortDesc: "万物受名处的温和生灵",
    kind: "ambient_animal",
    canWhisper: false,
    usesLLM: false,
    hasVoice: false,
    promptSummary:
      "羊是背景轻交互动物，不接LLM，使用本地模板。只在万物受名处作为氛围角色出现。不提供通关答案，不修改状态。输出短动作反馈。",
    appearance: ["day"],
  },

  // ---- 新增世界对象 ----
  tree_of_life: {
    id: "tree_of_life",
    name: "生命树",
    shortDesc: "园子中央的应许，与分别善恶树对照",
    kind: "world_object",
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
  watching_angel: EDEN_NPCS.watching_angel.name,
  forbidden_tree: EDEN_NPCS.forbidden_tree.name,
  gabriel: EDEN_NPCS.gabriel.name,
  raphael: EDEN_NPCS.raphael.name,
  uriel: EDEN_NPCS.uriel.name,
  michael: EDEN_NPCS.michael.name,
  cherubim: EDEN_NPCS.cherubim.name,
  dove: EDEN_NPCS.dove.name,
  fox: EDEN_NPCS.fox.name,
  deer: EDEN_NPCS.deer.name,
  sheep: EDEN_NPCS.sheep.name,
  tree_of_life: EDEN_NPCS.tree_of_life.name,
};
