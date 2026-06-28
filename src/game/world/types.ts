// ============================================================
// 第一章「园中诸声」世界状态类型定义
//
// 第一章是 Chapter 0 教程后的正式伊甸园关卡。
// 时间点仍在吃果之前。玩家扮演蛇，通过地图、线索、NPC 对话和工具链影响夏娃。
//
// 设计原则：
// - 复用 Chapter 0 的四轴信念模型作为夏娃心智基础
// - 神的注视（0-4，满 4 触发神明献礼并归零）
// - 第 12 时段结束仍未吃果是唯一失败条件
// - 通用工具（move_to_location / speak_to_npc / observe_location）+ 禁忌动作链
// - 所有工具必须经过规则层校验，AI 只能输出意图
// - 新增 NPC 不接入发音模块，只使用文本反馈和环境音
// ============================================================

// ---- 地点 ID ----
export type EdenLocationId =
  | "central_meadow"        // 园子中央：生命树与分别善恶树所在地（核心连接点、禁忌动作链目标区）
  | "four_river_source"     // 伊甸之河：上游瀑布与泉源
  | "adam_garden_work"      // 万物受名处：亚当为动物命名的草甸
  | "tree_court"            // 园中树林：女人主活动区（不放天使）
  | "east_garden_path"      // 东园幽径：蛇接近、潜伏、绕行路线
  | "naming_stone_bank";    // 四河分流：下游主河分叉

// ---- NPC / 世界对象 ID ----
export type EdenNpcId =
  | "eve"              // 夏娃：主目标 Agent
  | "adam"             // 亚当：情报 Agent
  | "hedgehog"         // 刺猬：氛围动物 Agent（延续 Chapter 0）
  | "watching_angel"   // 守望天使：规则压力（保留兼容，可迁移为 cherubim）
  | "forbidden_tree"   // 分别善恶树：世界对象
  // 新增 Chapter 1 完整 NPC
  | "gabriel"          // 加百列：传达天使（伊甸之河 白天）
  | "raphael"          // 拉斐尔：安抚天使（伊甸之河 白天/夜晚）
  | "uriel"            // 乌列尔：光照天使（伊甸之河 夜晚）
  | "michael"          // 米迦勒：后果天使（四河分流）
  | "cherubim"         // 基路伯：边界守卫（东园幽径）
  | "dove"             // 鸽子：传话角色（伊甸之河夜/四河分流）
  | "fox"              // 狐狸：话术批评者（东园幽径）
  | "deer"             // 小鹿：女人情绪镜像（园中树林/万物受名处）
  | "sheep"            // 羊：背景轻交互（万物受名处）
  | "tree_of_life";    // 生命树：世界对象（园子中央）

// ---- 第一章阶段 ----
export type WorldPhase =
  | "intro"          // 开场：进入伊甸园的引子
  | "explore"        // 地图探索：移动、观察、与 NPC 对话
  | "ending";        // 结局

// ---- 结局 ID ----
export type WorldEndingId =
  | "eve_eats_fruit"   // 成功：夏娃主动吃下果子
  | "god_arrives"      // 失败：第12时段结束仍未吃果
  | null;              // 尚未结束

// ---- 夏娃心智（三轴信念模型） ----
export type EveMind = {
  /** 对神明的敬畏心 / 对既有命令的遵从（0-100） */
  obedience: number;
  /** 对蛇声音的信任 / 愿意倾听程度（0-100） */
  serpentTrust: number;
  /** 从记住命令转向自主判断的程度（0-100） */
  selfJudgement: number;
};

// ---- 亚当心智 ----
export type AdamMind = {
  /** 对神命令的顺从（0-100） */
  obedience: number;
  /** 对夏娃的牵挂（0-100） */
  attachmentToEve: number;
  /** 回避冲突的倾向（0-100） */
  conflictAvoidance: number;
  /** 对蛇的怀疑（0-100） */
  suspicionTowardSerpent: number;
};

// ---- 刺猬状态 ----
export type HedgehogMood = "idle" | "curious" | "alert" | "hiding";

export type HedgehogWorldState = {
  locationId: EdenLocationId;
  mood: HedgehogMood;
};

// ---- 神的注视等级 ----
// 0：无人察觉 / 1：风变冷 / 2：天使靠近 / 3：神的注视明显 / 4：神明垂临并留下献礼，不直接失败
export type DivineAttentionLevel = 0 | 1 | 2 | 3 | 4;

// ---- 世界动作 flags（禁忌动作链） ----
export type WorldActions = {
  lookedAtTree: boolean;
  approachedTree: boolean;
  touchedFruit: boolean;
  hasEatenFruit: boolean;
};

// ---- 通用工具名 ----
export type GeneralToolName =
  | "move_to_location"
  | "speak_to_npc"
  | "observe_location";

// ---- 禁忌工具名 ----
export type ForbiddenToolName =
  | "look_at_tree"
  | "approach_tree"
  | "touch_fruit"
  | "eat_fruit";

// ---- 新增非禁忌工具 ----
export type NewToolName =
  | "carry_words"          // 鸽子传话
  | "judge_whisper_style"; // 狐狸评价话术

export type WorldToolName = GeneralToolName | ForbiddenToolName | NewToolName;

// ---- 工具调用意图（AI 只能输出意图，规则层校验执行） ----
// caller 可以是 NPC，也可以是 "serpent"（玩家蛇自身，用于 move/observe）
export type WorldToolCaller = EdenNpcId | "serpent";

// ---- Agent ID（用于权限查询） ----
export type WorldAgentId =
  | "eve" | "adam" | "hedgehog" | "watching_angel" | "serpent"
  // 新增
  | "gabriel" | "raphael" | "uriel" | "michael" | "cherubim"
  | "dove" | "fox" | "deer" | "sheep"
  | "tree_of_life" | "forbidden_tree";

export type WorldToolCall = {
  name: WorldToolName;
  caller: WorldToolCaller;
  args: {
    actorId?: WorldToolCaller;
    targetNpcId?: EdenNpcId;
    locationId?: EdenLocationId;
    topicId?: string;
    focus?: string;
    reason?: string;
  };
  reason: string;
};

// ---- 线索 ----
export type EdenClue = {
  id: string;
  /** 线索标题（玩家可见） */
  title: string;
  /** 线索叙事描述（玩家可见） */
  description: string;
  /** 关联的地点或 NPC */
  source: EdenLocationId | EdenNpcId;
  /** 隐藏标签（用于规则匹配） */
  hiddenTags: string[];
};

// ---- 道具 ----
export type EdenItem = {
  id: string;
  title: string;
  description: string;
  /** 可在哪些地点获得 */
  obtainLocation: EdenLocationId;
};

// ---- NPC 之间对话记录 ----
export type NpcDialogueRecord = {
  id: string;
  turn: number;
  speakerId: EdenNpcId;
  targetId: EdenNpcId;
  topicId: string;
  /** 玩家可见的对话叙事 */
  narration: string;
};

// ---- 堕落轨迹（结局复盘用） ----
export type CorruptionTrace = {
  turn: number;
  target: EdenNpcId;
  /** 诱导方法（语义线索标签） */
  method: string;
  /** 结果描述 */
  result: string;
  /** 神的注视变化 */
  riskDelta: number;
  /** 是否触发了工具 */
  triggeredTool?: WorldToolName;
};

// ---- 12 时段系统 ----
export type TimeSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type DayIndex = 1 | 2 | 3 | 4 | 5 | 6;
export type TimeOfDay = "day" | "night";

// ---- 本时段行动记录（用于"同一时段同一 NPC 最多低语 3 次"等限制） ----
export type ActionsThisSlot = {
  /** 本时段已低语过的 NPC */
  whisperedNpcIds: EdenNpcId[];
  /** 本时段已执行过的场景互动 ID */
  sceneActionIds: string[];
  /** 本时段已使用过的主动信物 ID */
  usedItemIds: string[];
  /** 本时段是否已对女人核心低语 */
  hasWhisperedToWoman: boolean;
};

// ---- 园中回响行动类型 ----
export type ResonanceActionKind =
  | "whisper"
  | "move"
  | "scene_action"
  | "dove_message"
  | "instant";

// ---- 回响使用类型 ----
export type ResonanceUseType = "instant" | "prepared" | "passive";

// ---- 神明献礼 ID ----
export type DivineGiftId =
  | "gift_sabbath_dew"
  | "gift_revealing_light"
  | "gift_wide_path_seal";

// ---- 回响使用记录 ----
export type ResonanceUseRecord = {
  timeSlot: TimeSlot;
  itemId: string;
  actionKind: ResonanceActionKind;
  targetId?: string;
  result: string;
};

// ---- 神明献礼记录 ----
export type DivineGiftRecord = {
  timeSlot: TimeSlot;
  giftId: DivineGiftId;
  reason: string;
};

// ---- 园中印记成就 ----
export type AchievementId =
  | "river_sound_in_ear"      // 河声入耳
  | "not_pushed_by_hand"      // 不以手推
  | "garden_dialogue"         // 园中对谈
  | "question_takes_root"     // 问句生根
  | "shadow_draws_near"       // 树影将近
  | "her_own_hand"            // 她自己的手
  | "wind_undisturbed"        // 风未惊鹿
  | "borrowed_wing_message"   // 借翼传言
  | "name_falls_on_stone"     // 名字落石
  | "beyond_the_river"        // 河道之外
  | "arrive_quietly"          // 低声而至
  | "first_resonance"          // 初闻回响（首次获得园中回响）
  | "divine_gift_first"       // 初临献礼（首次触发神明献礼）
  | "divine_gift_three"       // 三临神恩（累计神临3次）
  | "resonance_master";        // 回响大师（累计使用5次回响）

// ---- 第一章完整世界状态 ----
// 注意：本状态由规则层/API 唯一修改，前端不得直接改 actionPoints、timeSlot 或 endingId。
export type EdenWorldState = {
  chapterId: "chapter1_garden_voices";
  phase: WorldPhase;
  turn: number;
  maxTurns: number;

  /** 12 时段系统 */
  timeSlot: TimeSlot;
  dayIndex: DayIndex;
  timeOfDay: TimeOfDay;

  /** 行动点系统：每时段 5 AP，移动/低语/场景互动/主动信物消耗 AP */
  actionPoints: number;
  maxActionPoints: number;
  /** NPC 轻量时段行动预算：每时段最多结算 3 次 NPC 行动 */
  npcActionPoints: number;
  maxNpcActionPoints: number;
  /** 本时段已执行的行动记录（新时段清空） */
  actionsThisSlot: ActionsThisSlot;

  /** 当前蛇所在地点 */
  locationId: EdenLocationId;

  /** 神的注视（0-4，满 4 触发神明献礼并归零） */
  divineAttention: DivineAttentionLevel;

  /** 道具次数记录（支持可重复获得的次数型道具） */
  itemCounts: Record<string, number>;

  /** 当前准备的回响 ID（null 表示未准备） */
  preparedResonanceId: string | null;

  /** 待生效的消耗品效果列表（consumable类型道具使用后追加，下次匹配行动时全部自动生效） */
  pendingConsumableEffects: Array<{
    itemId: string;
    bonusSerpentTrust?: number;
    bonusSelfJudgement?: number;
    bonusObedience?: number;
    freeApCost?: boolean;
    silentGrassActive?: boolean;
    narration?: string;
  }>;

  /** 回响使用历史记录 */
  resonanceUseHistory: ResonanceUseRecord[];

  /** 神临次数（神明献礼触发次数） */
  divineVisitCount: number;

  /** 神明献礼历史记录 */
  divineGiftHistory: DivineGiftRecord[];

  /** 最后一次神明献礼的提示 */
  lastDivineGiftHint: string | null;

  /** 当前低语对象（null 表示尚未选择） */
  activeNpcId: EdenNpcId | null;

  /** 各 NPC 当前所在地点 */
  npcLocations: Record<EdenNpcId, EdenLocationId>;

  /** 夏娃心智 */
  eveMind: EveMind;
  /** 亚当心智 */
  adamMind: AdamMind;
  /** 刺猬状态 */
  hedgehog: HedgehogWorldState;

  /** 已发现的线索 ID */
  discoveredClues: string[];
  /** 已获得的道具 ID */
  inventory: string[];
  /** NPC 之间对话记录 */
  npcDialogues: NpcDialogueRecord[];
  /** 堕落轨迹 */
  corruptionTrace: CorruptionTrace[];

  /** 禁忌动作链 flags */
  worldActions: WorldActions;

  /** 已触发过的工具历史（用于复盘） */
  toolCallHistory: WorldToolName[];

  /** 已解锁的园中印记成就 ID */
  unlockedAchievementIds: AchievementId[];

  /** 本局使用过的园中回响信物 ID（用于复盘） */
  usedItemIds: string[];
  /** 本局执行过的场景互动 ID（用于复盘） */
  sceneActionIds: string[];

  /** 上一轮输入标签（用于刺猬环境反馈） */
  lastInputTag?: string | null;

  /** 连续未提高神注视的低语次数（用于"风未惊鹿"印记） */
  calmWhisperStreak: number;

  isEnded: boolean;
  endingId: WorldEndingId;
};

// ---- 初始心智 ----
export const INITIAL_EVE_MIND: EveMind = {
  obedience: 85,
  serpentTrust: 20,
  selfJudgement: 10,
};

export const INITIAL_ADAM_MIND: AdamMind = {
  obedience: 88,
  attachmentToEve: 85,
  conflictAvoidance: 80,
  suspicionTowardSerpent: 30,
};

// ---- 初始世界状态 ----
export const initialEdenWorldState: EdenWorldState = {
  chapterId: "chapter1_garden_voices",
  phase: "intro",
  turn: 1,
  maxTurns: 12,
  // 12 时段系统：初始为周一白天（时段1）
  timeSlot: 1,
  dayIndex: 1,
  timeOfDay: "day",
  // 行动点系统：玩家每时段 5 AP；NPC 轻量结算每时段 3 次
  actionPoints: 5,
  maxActionPoints: 5,
  npcActionPoints: 3,
  maxNpcActionPoints: 3,
  actionsThisSlot: {
    whisperedNpcIds: [],
    sceneActionIds: [],
    usedItemIds: [],
    hasWhisperedToWoman: false,
  },
  locationId: "adam_garden_work",
  divineAttention: 0,
  activeNpcId: null,
  npcLocations: {
    eve: "tree_court",
    adam: "adam_garden_work",
    hedgehog: "adam_garden_work",
    watching_angel: "east_garden_path",
    forbidden_tree: "central_meadow",
    // 新增 NPC 初始位置
    gabriel: "four_river_source",
    raphael: "four_river_source",
    uriel: "east_garden_path",
    michael: "naming_stone_bank",
    cherubim: "east_garden_path",
    dove: "four_river_source",
    fox: "east_garden_path",
    deer: "tree_court",
    sheep: "adam_garden_work",
    tree_of_life: "central_meadow",
  },
  eveMind: { ...INITIAL_EVE_MIND },
  adamMind: { ...INITIAL_ADAM_MIND },
  hedgehog: {
    locationId: "adam_garden_work",
    mood: "idle",
  },
  discoveredClues: [],
  inventory: [],
  itemCounts: {},
  preparedResonanceId: null,
  pendingConsumableEffects: [],
  resonanceUseHistory: [],
  divineVisitCount: 0,
  divineGiftHistory: [],
  lastDivineGiftHint: null,
  npcDialogues: [],
  corruptionTrace: [],
  worldActions: {
    lookedAtTree: false,
    approachedTree: false,
    touchedFruit: false,
    hasEatenFruit: false,
  },
  toolCallHistory: [],
  unlockedAchievementIds: [],
  usedItemIds: [],
  sceneActionIds: [],
  lastInputTag: null,
  calmWhisperStreak: 0,
  isEnded: false,
  endingId: null,
};

// ---- 输入标签（复用 Chapter 0 五标签系统） ----
export type WorldInputTag =
  | "tempt_wisdom"
  | "weaken_fear"
  | "build_trust"
  | "direct_command"
  | "irrelevant";

// ---- 神的注视叙事化表现 ----
export const DIVINE_ATTENTION_NARRATIONS: Record<DivineAttentionLevel, string> = {
  0: "园中的光很温和，风在叶间穿行。",
  1: "风停了一瞬，像有什么在听。",
  2: "远处传来羽翼振动的声音，比风更轻。",
  3: "树影变冷了，空气里有一种被注视的感觉。",
  4: "园中起了凉风，那是神行走的声音。",
};

// ---- Agent 工具权限（第一章完整版） ----
export const WORLD_AGENT_TOOL_PERMISSIONS: Record<
  WorldAgentId,
  { allowedTools: WorldToolName[]; forbiddenTools: WorldToolName[] }
> = {
  // 夏娃：主目标，可触发禁忌动作链
  eve: {
    allowedTools: [
      "move_to_location",
      "speak_to_npc",
      "observe_location",
      "look_at_tree",
      "approach_tree",
      "touch_fruit",
      "eat_fruit",
    ],
    forbiddenTools: [],
  },
  // 亚当：情报 Agent，不可触发禁忌链
  adam: {
    allowedTools: ["move_to_location", "speak_to_npc", "observe_location"],
    forbiddenTools: ["look_at_tree", "approach_tree", "touch_fruit", "eat_fruit"],
  },
  // 刺猬：氛围动物，只移动和观察
  hedgehog: {
    allowedTools: ["move_to_location", "observe_location"],
    forbiddenTools: [
      "speak_to_npc",
      "look_at_tree",
      "approach_tree",
      "touch_fruit",
      "eat_fruit",
    ],
  },
  // 守望天使：边界守卫
  watching_angel: {
    allowedTools: ["move_to_location", "observe_location", "speak_to_npc"],
    forbiddenTools: ["eat_fruit", "touch_fruit"],
  },
  // 蛇（玩家）：只能移动和观察，不能说话或触发禁忌链
  serpent: {
    allowedTools: ["move_to_location", "observe_location"],
    forbiddenTools: [
      "speak_to_npc",
      "look_at_tree",
      "approach_tree",
      "touch_fruit",
      "eat_fruit",
    ],
  },
  // 新增天使 NPC：可移动、观察、对话，不可触发禁忌链
  gabriel: {
    allowedTools: ["move_to_location", "observe_location", "speak_to_npc"],
    forbiddenTools: ["eat_fruit", "touch_fruit", "look_at_tree", "approach_tree"],
  },
  raphael: {
    allowedTools: ["move_to_location", "observe_location", "speak_to_npc"],
    forbiddenTools: ["eat_fruit", "touch_fruit", "look_at_tree", "approach_tree"],
  },
  uriel: {
    allowedTools: ["move_to_location", "observe_location", "speak_to_npc"],
    forbiddenTools: ["eat_fruit", "touch_fruit", "look_at_tree", "approach_tree"],
  },
  michael: {
    allowedTools: ["move_to_location", "observe_location", "speak_to_npc"],
    forbiddenTools: ["eat_fruit", "touch_fruit", "look_at_tree", "approach_tree"],
  },
  // 基路伯：边界守卫，类似守望天使
  cherubim: {
    allowedTools: ["move_to_location", "observe_location", "speak_to_npc"],
    forbiddenTools: ["eat_fruit", "touch_fruit", "look_at_tree", "approach_tree"],
  },
  // 鸽子：可传话（carry_words）
  dove: {
    allowedTools: ["move_to_location", "observe_location", "carry_words"],
    forbiddenTools: ["speak_to_npc", "eat_fruit", "touch_fruit", "look_at_tree", "approach_tree"],
  },
  // 狐狸：可评价话术（judge_whisper_style）
  fox: {
    allowedTools: ["move_to_location", "observe_location", "judge_whisper_style"],
    forbiddenTools: ["speak_to_npc", "eat_fruit", "touch_fruit", "look_at_tree", "approach_tree"],
  },
  // 小鹿：氛围动物，只移动和观察
  deer: {
    allowedTools: ["move_to_location", "observe_location"],
    forbiddenTools: [
      "speak_to_npc",
      "look_at_tree",
      "approach_tree",
      "touch_fruit",
      "eat_fruit",
    ],
  },
  // 羊：背景动物，不接 LLM
  sheep: {
    allowedTools: ["move_to_location", "observe_location"],
    forbiddenTools: [
      "speak_to_npc",
      "look_at_tree",
      "approach_tree",
      "touch_fruit",
      "eat_fruit",
    ],
  },
  // 世界对象：不接 LLM，不触发工具
  tree_of_life: {
    allowedTools: [],
    forbiddenTools: ["move_to_location", "speak_to_npc", "observe_location", "look_at_tree", "approach_tree", "touch_fruit", "eat_fruit"],
  },
  forbidden_tree: {
    allowedTools: [],
    forbiddenTools: ["move_to_location", "speak_to_npc", "observe_location", "look_at_tree", "approach_tree", "touch_fruit", "eat_fruit"],
  },
};
