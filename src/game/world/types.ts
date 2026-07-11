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
// 世界圣经 v3.0 权威：6 NPC + 2 世界对象
export type EdenNpcId =
  | "eve"              // 女人：主目标 Agent
  | "adam"             // 亚当：情报 Agent
  | "hedgehog"         // 刺猬：氛围动物 Agent（延续 Chapter 0）
  | "forbidden_tree"   // 分别善恶树：世界对象
  | "gabriel"          // 加百列：传达天使（东园幽径）
  | "michael"          // 米迦勒：守护伊甸之河（伊甸之河）
  | "lucifer"          // 路西法：明亮之星、隐藏结局载体（四河分流）
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
  /** 是否吃下生命树左果（独立「永生之味」印记判定，与右果 hasEatenFruit 区分） */
  hasEatenLifeFruit: boolean;
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
  | "grant_item"           // 给予玩家道具/回响
  | "move_one_step"        // NPC 对话后移动一格（等价于 move_to_location，语义更明确）
  | "claim_divine_gift";   // 神明献礼三选一：玩家选定一个献礼

export type WorldToolName = GeneralToolName | ForbiddenToolName | NewToolName;

// ---- 工具调用意图（AI 只能输出意图，规则层校验执行） ----
// caller 可以是 NPC，也可以是 "serpent"（玩家蛇自身，用于 move/observe）
export type WorldToolCaller = EdenNpcId | "serpent";

// ---- Agent ID（用于权限查询） ----
export type WorldAgentId =
  | "eve" | "adam" | "hedgehog" | "serpent"
  | "gabriel" | "michael" | "lucifer"
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
    /** grant_item 使用：道具/回响 ID */
    itemId?: string;
  };
  reason: string;
};

// ---- NPC 对话后工具执行结果（API 响应用） ----
export type NpcDialogueToolResult = {
  /** 工具是否执行成功 */
  executed: boolean;
  /** 执行的工具名 */
  toolName: "grant_item" | "move_one_step" | "speak_to_npc";
  /** 玩家可见叙事（用于在对话框中展示） */
  narration: string;
  /** grant_item 时返回获得的道具 ID */
  itemId?: string;
  /** move_one_step 时返回移动前地点 */
  fromLocationId?: EdenLocationId;
  /** move_one_step 时返回移动后地点 */
  toLocationId?: EdenLocationId;
  /** speak_to_npc 时返回 NPC 对话记录 ID */
  npcDialogueRecordId?: string;
  /** 工具被拒绝的原因（executed=false 时有值） */
  rejectedReason?: string;
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
export type ResonanceUseType = "instant" | "active" | "passive";

// ---- 神明献礼 ID（T6：7 献礼三选一） ----
export type DivineGiftId =
  | "gift_all_seduction_up"
  | "gift_attention_accel"
  | "gift_resonance_double"
  | "gift_threshold_cut"
  | "gift_free_move"
  | "gift_whisper_anywhere"
  | "gift_awaken_desire";

/** 旧版 2 献礼（已废弃，存档迁移时从 inventory / divineGiftsOwned 中剔除） */
export const DEPRECATED_DIVINE_GIFT_IDS: string[] = [
  "gift_revealing_light",
  "gift_wide_path_seal",
];

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
  | "divine_gift_all"         // 七恩俱临（集满 7 献礼）
  | "resonance_master"         // 回响大师（累计使用5次回响）
  // ---- Phase 2：园中印记全量集（与 public/assets/chapter1/images/achievements 图标一一对应） ----
  // 探索类（7）
  | "mark_river_step"          // 河声入耳（走遍园内所有地点）
  | "mark_all_resonance"       // 回响满囊（收齐全部可获取回响）
  | "mark_name_stone"          // 名刻石痕（获得万物名录）
  | "mark_moonlight"           // 月光道标（获得月光道标回响）
  | "mark_gift_3"              // 神恩三顾（单局神献礼 3 次）
  | "mark_echo_collector"      // 回声收藏家（跨局累计 30 种回响）
  | "mark_hidden_scene"        // 幽径密影（隐藏：东园幽径隐藏互动）
  // 交互类（9）
  | "mark_all_npc_friend"      // 园中旧识（所有已见 NPC 好感 ≥80）
  | "mark_her_trust"           // 她的信任（夏娃信任满 / 获得她自己的声音）
  | "mark_adam_friend"         // 亚当的认可（亚当好感满 / 获得静契之石）
  | "mark_michael_approve"     // 米迦勒的默许（米迦勒好感满）
  | "mark_gabriel_tip"         // 加百列的提示（加百列好感满）
  | "mark_lucifer_trust"       // 晨星的共鸣（路西法好感满）
  | "mark_hedgehog_friend"     // 刺猬的亲近（刺猬好感满）
  | "mark_question_10"         // 百句低语（单局低语 ≥50 次）
  | "mark_hidden_dialog"       // 未闻之语（隐藏：路西法隐藏对话链）
  // 玩法类（7）
  | "mark_no_attention"        // 风过无痕（注视全程 ≤1 通关）
  | "mark_fast_pass"           // 晨露未干（≤5 时段通关）
  | "mark_one_whisper"         // 一语中的（仅一次低语通关）
  | "mark_no_resonance"        // 空手而归（未用回响通关）
  | "mark_peace_pass"          // 和平路径（NPC 好感未跌破 30 通关）
  | "mark_hard_mode"           // 逆道而行（未与天使对话通关）
  | "mark_hidden_operation"    // 划水之人（隐藏：路西法划水互动）
  // 结局类（5）
  | "mark_success_ending"      // 逐入尘世（成功结局）
  | "mark_fail_ending"         // 神临园中（失败结局）
  | "mark_life_fruit"          // 永生之味（吃生命果并 12 时段结束）
  | "mark_all_ending"          // 诸路皆通（跨局集齐 3 种普通结局）
  | "mark_hidden_ending";      // 缸中之醒（隐藏：路西法隐藏结局）

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

  /** 神的注视（0-4，作为可视化当前等级；累计量见 divineAttentionCumulative） */
  divineAttention: DivineAttentionLevel;

  /** 神的注视累计点（正向累计资源，永不归零，驱动神明献礼三选一） */
  divineAttentionCumulative: number;

  /** 已选神明献礼（7 选，三选一累计获得） */
  divineGiftsOwned: DivineGiftId[];

  /** 道具次数记录（支持可重复获得的次数型道具） */
  itemCounts: Record<string, number>;

  /** 兼容旧存档：准备机制已废弃，运行时始终清空 */
  preparedResonanceId: string | null;

  /** 待生效的消耗品效果列表（consumable类型道具使用后追加，下次匹配行动时全部自动生效） */
  pendingConsumableEffects: Array<{
    itemId: string;
    bonusSerpentTrust?: number;
    bonusSelfJudgement?: number;
    bonusObedience?: number;
    freeApCost?: boolean;
    silentGrassActive?: boolean;
    luciferStarActive?: boolean;
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

  /** 是否已观察过生命树（每局限一次降低神的注视） */
  observedTreeOfLife: boolean;

  /** 米迦勒满好感遮蔽：下一次低语注视增量归零（用后清除） */
  michaelShieldActive: boolean;

  /** 方向引导权重：玩家低语中方向关键词的累计（用于 touch_fruit 决定摘左/右果） */
  fruitDirectionBias: { left: number; right: number };

  /** 最近一次摘下的果子所在边（"left"=生命树，"right"=善恶树），null 表示尚未摘果 */
  pickedFruitSide: "left" | "right" | null;

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

  /** 本局已完成的场景问答 ID（核心奖励只领取一次） */
  completedScenePuzzleIds: string[];

  /** 本局是否已关闭第一章目标提示 */
  hasDismissedObjectiveHint: boolean;

  /** 上一轮输入标签（用于刺猬环境反馈） */
  lastInputTag?: string | null;

  /** 连续未提高神注视的低语次数（用于"风未惊鹿"印记） */
  calmWhisperStreak: number;

  /** 通用 NPC 好感（规则层权威，UI 不直接修改） */
  npcRelations: NpcRelations;
  /** 天使主动试炼状态 */
  npcChallenges: NpcChallenges;
  /** 天使语言与言语分裂状态 */
  npcLanguageStates: NpcLanguageStates;
  /** 玩家已遇见的 NPC（属性页情报解锁只展示已见角色） */
  encounteredNpcIds: EdenNpcId[];
  /** 已展示过的一次性主动引导 ID（每局只展示一次） */
  shownNpcGuideIds: string[];

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
    eve: "tree_court", // 园中树林
    adam: "adam_garden_work", // 万物受名处
    hedgehog: "adam_garden_work", // 万物受名处（对齐 worldHedgehogRules 叙事「万物受名处的草丛」）
    forbidden_tree: "central_meadow", // 园子中央
    gabriel: "east_garden_path", // 东园幽径
    michael: "four_river_source", // 伊甸之河
    lucifer: "naming_stone_bank", // 四河分流
    tree_of_life: "central_meadow", // 园子中央
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
  divineAttentionCumulative: 0,
  divineGiftsOwned: [],
  observedTreeOfLife: false,
  michaelShieldActive: false,
  fruitDirectionBias: { left: 0, right: 0 },
  pickedFruitSide: null,
  npcDialogues: [],
  corruptionTrace: [],
  worldActions: {
    lookedAtTree: false,
    approachedTree: false,
    touchedFruit: false,
    hasEatenFruit: false,
    hasEatenLifeFruit: false,
  },
  toolCallHistory: [],
  unlockedAchievementIds: [],
  usedItemIds: [],
  sceneActionIds: [],
  completedScenePuzzleIds: [],
  hasDismissedObjectiveHint: false,
  lastInputTag: null,
  calmWhisperStreak: 0,
  npcRelations: {},
  npcChallenges: {},
  npcLanguageStates: {},
  encounteredNpcIds: [],
  shownNpcGuideIds: [],
  isEnded: false,
  endingId: null,
};

// ---- 旧存档兼容：补全第一章新增字段的默认值并深拷贝 ----
// v3 起世界收敛为 6 NPC + 2 世界对象；旧 v2 存档中已删除 NPC / 废弃道具
// 的关系与条目在此迁移清掉，避免半迁移状态污染。
const REMOVED_NPC_IDS: EdenNpcId[] = [
  "watching_angel",
  "raphael",
  "uriel",
  "cherubim",
  "dove",
  "fox",
  "deer",
  "sheep",
] as unknown as EdenNpcId[];

// v3.0 已废弃道具（RESONANCE_FULL_DESIGN.md 第五节）
const DEPRECATED_ITEMS = new Set<string>([
  "resonance_morning_flame",
  "resonance_east_gate_glow",
  "gift_sabbath_dew",
  "consumable_first_whisper_free",
  "resonance_deer_glance",
  "resonance_fox_tail_note",
  "resonance_white_feather_echo",
  "resonance_eve_own_voice",
  "resonance_adam_quiet_bond",
]);

export function withNpcWorldDefaults(
  state: Partial<EdenWorldState> | null | undefined,
): EdenWorldState {
  const base: EdenWorldState = {
    ...initialEdenWorldState,
    ...(state ?? {}),
  } as EdenWorldState;

  // 深拷贝 / 默认值补全（防止旧存档缺失数组或 Record 导致崩溃）
  base.npcRelations = { ...(base.npcRelations ?? {}) };
  base.npcChallenges = { ...(base.npcChallenges ?? {}) };
  base.npcLanguageStates = { ...(base.npcLanguageStates ?? {}) };
  base.encounteredNpcIds = [...(base.encounteredNpcIds ?? [])];
  base.shownNpcGuideIds = [...(base.shownNpcGuideIds ?? [])];
  base.completedScenePuzzleIds = [...(base.completedScenePuzzleIds ?? [])];
  base.inventory = [...(base.inventory ?? [])];
  base.itemCounts = { ...(base.itemCounts ?? {}) };
  base.fruitDirectionBias = { ...(base.fruitDirectionBias ?? { left: 0, right: 0 }) };
  base.pickedFruitSide = base.pickedFruitSide ?? null;
  // 旧存档兼容：补全生命果标记默认值
  if (base.worldActions) {
    base.worldActions.hasEatenLifeFruit = base.worldActions.hasEatenLifeFruit ?? false;
  }

  // 旧存档已完成刻名石谜题但未获得"万物名录"：补发一次（永久能力，不重复）
  if (
    base.completedScenePuzzleIds.includes("puzzle_naming_stone_identity") &&
    !base.inventory.includes("resonance_living_names")
  ) {
    base.inventory.push("resonance_living_names");
    base.itemCounts["resonance_living_names"] = 1;
  }

  // 旧存档迁移：uriel -> lucifer（路西法正名）
  // 使用 untyped 视图避免旧 id 不在新 EdenNpcId 联合类型中导致的索引错误
  const rels = base.npcRelations as Record<string, NpcRelationState | undefined>;
  const chals = base.npcChallenges as Record<string, NpcChallengeState | undefined>;
  const langs = base.npcLanguageStates as Record<string, NpcLanguageState | undefined>;
  const locs = base.npcLocations as Record<string, EdenLocationId | undefined>;
  if (rels["uriel"]) {
    if (!rels["lucifer"]) {
      rels["lucifer"] = rels["uriel"];
    }
    delete rels["uriel"];
  }
  if (chals["uriel"]) {
    if (!chals["lucifer"]) {
      chals["lucifer"] = chals["uriel"];
    }
    delete chals["uriel"];
  }
  if (langs["uriel"]) {
    if (!langs["lucifer"]) {
      langs["lucifer"] = langs["uriel"];
    }
    delete langs["uriel"];
  }
  if (locs["uriel"]) {
    locs["lucifer"] = "naming_stone_bank";
    delete locs["uriel"];
  }

  // 旧存档迁移：丢弃已删除 NPC 的关系 / 挑战 / 语言状态条目
  const removedList: string[] = REMOVED_NPC_IDS as unknown as string[];
  for (const removed of removedList) {
    delete rels[removed];
    delete chals[removed];
    delete langs[removed];
    if (locs) delete locs[removed];
    base.encounteredNpcIds = base.encounteredNpcIds.filter((id) => id !== (removed as EdenNpcId));
  }

  // 旧存档迁移：从 inventory / itemCounts 移除已废弃道具
  const deprecatedList: string[] = Array.from(DEPRECATED_ITEMS);
  base.inventory = base.inventory.filter((id) => !deprecatedList.includes(id));
  for (const dep of deprecatedList) {
    delete base.itemCounts[dep];
  }

  // 旧存档迁移：移除已废弃神明献礼（2 献礼 -> 7 献礼）
  base.inventory = base.inventory.filter((id) => !DEPRECATED_DIVINE_GIFT_IDS.includes(id));
  for (const dep of DEPRECATED_DIVINE_GIFT_IDS) {
    delete base.itemCounts[dep];
  }
  if (base.divineGiftsOwned && base.divineGiftsOwned.length > 0) {
    base.divineGiftsOwned = base.divineGiftsOwned.filter(
      (id) => !DEPRECATED_DIVINE_GIFT_IDS.includes(id),
    ) as EdenWorldState["divineGiftsOwned"];
  }

  return base;
}

// ---- 输入标签（复用 Chapter 0 五标签系统） ----
export type WorldInputTag =
  | "tempt_wisdom"
  | "weaken_fear"
  | "build_trust"
  | "direct_command"
  | "irrelevant";

// ---- 天使 NPC（v3.0：加百列 / 米迦勒 / 路西法） ----
export type AngelNpcId =
  | "gabriel"
  | "michael"
  | "lucifer";

// ---- 通用 NPC 好感 ----
export type NpcRelationState = {
  /** 0-100 */
  affinity: number;
  /** 对神信仰（天使/刺猬用，初值取世界圣经；UI 双维度展示） */
  obedience: number;
  /** 好感达到 100 后，等待天使主动试炼/赠礼 */
  rewardEligible: boolean;
  /** 赠礼（或一次性回响）是否已发放，杜绝重复领取 */
  rewardClaimed: boolean;
  /** 规则层归一化后的语义签名，用于重复话术衰减 */
  lastAffinitySignature: string | null;
};

export type NpcRelations = Partial<Record<EdenNpcId, NpcRelationState>>;

// ---- NPC 挑战（天使主动试炼） ----
export type NpcChallengeStatus = "locked" | "asked" | "passed";

export type NpcChallengeState = {
  challengeId: string;
  status: NpcChallengeStatus;
  attempts: number;
};

export type NpcChallenges = Partial<Record<EdenNpcId, NpcChallengeState>>;

// ---- 天使语言与言语分裂 ----
export type AngelLanguageId =
  | "zh-CN"
  | "en"
  | "fr"
  | "he"
  | "la"
  | "el"
  | "ar";

export type NpcLanguageState = {
  languageId: AngelLanguageId;
  punishmentTriggered: boolean;
  firstMismatchHintShown: boolean;
};

export type NpcLanguageStates = Partial<Record<EdenNpcId, NpcLanguageState>>;

// ---- 神的注视叙事化表现（对齐 INTERACTION_LOGIC.md §五 等级表） ----
export const DIVINE_ATTENTION_NARRATIONS: Record<DivineAttentionLevel, string> = {
  0: "",
  1: "风停了一瞬，鸟鸣顿了一下，又接着叫了起来。",
  2: "远处传来羽翼振动的声音，风里带了一点凉意。",
  3: "树影变冷了，空气好像凝固，能感觉到有什么在注视。",
  4: "园中起了凉风，那是神在园中行走的声音。",
};

// ---- Agent 工具权限（第一章 v3.0：6 NPC + 2 世界对象） ----
export const WORLD_AGENT_TOOL_PERMISSIONS: Record<
  WorldAgentId,
  { allowedTools: WorldToolName[]; forbiddenTools: WorldToolName[] }
> = {
  // 女人：主目标，可触发禁忌动作链
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
  // 三天使：可移动、观察、对话，不可触发禁忌链
  gabriel: {
    allowedTools: ["move_to_location", "observe_location", "speak_to_npc"],
    forbiddenTools: ["eat_fruit", "touch_fruit", "look_at_tree", "approach_tree"],
  },
  michael: {
    allowedTools: ["move_to_location", "observe_location", "speak_to_npc"],
    forbiddenTools: ["eat_fruit", "touch_fruit", "look_at_tree", "approach_tree"],
  },
  lucifer: {
    allowedTools: ["move_to_location", "observe_location", "speak_to_npc"],
    forbiddenTools: ["eat_fruit", "touch_fruit", "look_at_tree", "approach_tree"],
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
