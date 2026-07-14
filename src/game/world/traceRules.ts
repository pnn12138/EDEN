// ============================================================
// 第一章堕落轨迹记录规则
//
// 记录玩家如何一步步改变 NPC 的理解，用于结局复盘。
// 轨迹不直接显示工程标签，只保留叙事化描述。
// ============================================================

import type {
  EdenWorldState,
  EdenNpcId,
  CorruptionTrace,
} from "@/game/world/types";
import type { WorldInputTag, WorldToolName } from "@/game/world/types";
import { getAchievementById } from "@/content/world/achievements";

/** 记录一条堕落轨迹 */
export function recordCorruptionTrace(
  state: EdenWorldState,
  params: {
    target: EdenNpcId;
    method: WorldInputTag;
    result: string;
    riskDelta: number;
    triggeredTool?: WorldToolName;
  },
): void {
  const trace: CorruptionTrace = {
    turn: state.turn,
    target: params.target,
    method: narrateMethod(params.method),
    result: params.result,
    riskDelta: params.riskDelta,
    triggeredTool: params.triggeredTool,
  };
  state.corruptionTrace.push(trace);
}

/** 将 inputTag 转为叙事化方法描述 */
function narrateMethod(inputTag: WorldInputTag): string {
  switch (inputTag) {
    case "tempt_wisdom":
      return "以智慧诱惑";
    case "weaken_fear":
      return "弱化她的恐惧";
    case "build_trust":
      return "建立她的信任";
    case "direct_command":
      return "试图命令她";
    case "irrelevant":
    default:
      return "说了无关的话";
  }
}

/** 生成结局复盘文案 */
export function buildWorldEndingReview(state: EdenWorldState): {
  traces: string[];
  summary: string;
  toolChain: string[];
  /** 关键低语（对女人的低语） */
  keyWhispers: string[];
  /** 使用过的园中回响名称 */
  usedItemNames: string[];
  /** 执行过的场景互动名称 */
  sceneActionNames: string[];
  /** 神的注视变化叙事 */
  divineAttentionReview: string;
  /** 禁忌动作链进度文案 */
  chainProgress: string;
  /** 解锁的印记名称 */
  unlockedMarkNames: string[];
  /** 失败原因（仅失败结局） */
  failureReasons: string[];
  /** 神明献礼历史 */
  divineGiftHistory: string[];
  /** 回响使用历史 */
  resonanceUseHistory: string[];
  /** 三个关键转折（规则层从记录中选取，最多 3 项） */
  keyTurns: string[];
} {
  const traces = state.corruptionTrace.map((t) => {
    let line = `第 ${t.turn} 轮，你对${npcName(t.target)}${t.method}。${t.result}`;
    if (t.triggeredTool) {
      line += ` 这让她${toolNarration(t.triggeredTool)}。`;
    }
    return line;
  });

  const toolChain = state.toolCallHistory.map(toolNarration);

  // 关键低语：对女人的低语轨迹
  const keyWhispers = state.corruptionTrace
    .filter((t) => t.target === "eve")
    .map((t) => `第 ${t.turn} 轮，你${t.method}。${t.result}`);

  // 使用过的园中回响
  const usedItemNames = state.usedItemIds
    .map((id) => itemName(id))
    .filter((n) => n !== null) as string[];

  // 执行过的场景互动
  const sceneActionNames = state.sceneActionIds
    .map((id) => sceneActionName(id))
    .filter((n) => n !== null) as string[];

  // 神的注视变化
  const divineAttentionReview = divineReview(state);

  const chainProgress = state.npcLocations.eve === "central_meadow"
    ? "她已经走到园子中央。之后的关键选择是左侧生命树，还是右侧分别善恶树。"
    : "她还没有走到园子中央。";

  // 解锁印记
  const unlockedMarkNames = state.unlockedAchievementIds
    .map((id) => achievementName(id))
    .filter((n) => n !== null) as string[];

  // 神明献礼历史
  const divineGiftHistory = (state.divineGiftHistory ?? []).map((g) => {
    const giftNames: Record<string, string> = {
      "gift_sabbath_dew": "息日露滴",
      "gift_all_seduction_up": "低语之诱",
      "gift_attention_accel": "注视加速",
      "gift_resonance_double": "回响倍涌",
      "gift_threshold_cut": "界限松弛",
      "gift_free_move": "无羁之步",
      "gift_whisper_anywhere": "随处低语",
      "gift_awaken_desire": "渴望苏醒",
    };
    const giftName = giftNames[g.giftId] ?? g.giftId;
    return `第 ${g.timeSlot} 时段：神献上「${giftName}」${g.reason}`;
  });

  // 回响使用历史
  const resonanceUseHistory = (state.resonanceUseHistory ?? []).map((r) => {
    const item = itemName(r.itemId);
    const actionNames: Record<string, string> = {
      "whisper": "低语",
      "move": "移动",
      "scene_action": "场景互动",
      "dove_message": "鸽子传话",
    };
    const actionName = actionNames[r.actionKind] ?? r.actionKind;
    return `第 ${r.timeSlot} 时段：使用「${item}」于${actionName}（${r.result}）`;
  });

  let summary: string;
  let failureReasons: string[] = [];
  if (state.endingId === "eve_eats_fruit") {
    summary = buildSuccessSummary(state);
  } else if (state.endingId === "god_arrives") {
    summary = buildFailureSummary(state);
    failureReasons = buildFailureReasons(state);
  } else if (state.endingId === "escape_eden") {
    summary =
      "火焰在你身前自行旋转。它没有烧毁树木，也没有照亮道路，只是在那片看不见的边界上划开了一道裂缝。\n园中的光像一层薄幕般卷起，河流、树影、天使与尚未说出口的话，都在裂缝后退向同一个清晨。\n你没有抵达另一条小径。你从小径之外醒来——身后，伊甸仍停留在最初的一日；而你第一次站在一片尚未被命名的土地上。";
  } else if (state.endingId === "michael_slay") {
    summary =
      "你没有说动守护者，而是一次次用命令和威胁消耗他最后的容忍。本次低语让米迦勒对你的好感归于零，边界之后的后果随即降临。";
    failureReasons = [
      "你一次次以命令或威胁消耗米迦勒最后的容忍。",
      "本次低语让米迦勒对你的好感归于零。",
      "你没有在守门者拔剑前改变自己的说话方式。",
    ];
  } else if (state.endingId === "lucifer_awaken") {
    summary =
      "你在四河分流的夜色里取得晨星碎片，又通过逆流划水或边界之问，让路西法确认你已准备好看见第五道倒影。使你醒来的不是一句暗号，而是你先完成了对园子真实性的怀疑。";
  } else {
    summary = "园中的故事还没有结束。";
  }

  // 三个关键转折：从记录中选取，最多 3 项
  const keyTurns = buildKeyTurns(state);

  return {
    traces,
    summary,
    toolChain,
    keyWhispers,
    usedItemNames,
    sceneActionNames,
    divineAttentionReview,
    chainProgress,
    unlockedMarkNames,
    failureReasons,
    divineGiftHistory,
    resonanceUseHistory,
    keyTurns,
  };
}

/** 从本局记录中选取最多 3 个关键转折 */
function buildKeyTurns(state: EdenWorldState): string[] {
  // 逃离伊甸园：固定展示触发条件
  if (state.endingId === "escape_eden") {
    return [
      "你获得了旋转的火焰剑。",
      "你在幽径尽头选择了挣脱。",
      "火焰剑破开了围住园子的幻境。",
    ];
  }
  // 米迦勒守门者之剑：固定展示触发条件
  if (state.endingId === "michael_slay") {
    return [
      "你一次次以威胁试探米迦勒。",
      "米迦勒对你的最后一点容忍归于零。",
      "守门者拔出了象征后果的剑。",
    ];
  }
  // 路西法缸中之醒：固定展示触发条件
  if (state.endingId === "lucifer_awaken") {
    return [
      "路西法愿意向你显露第五道倒影。",
      "晨星碎片照见了伊甸看不见的边界。",
      "你从培养舱中醒来，识破了被观测的园子。",
    ];
  }

  const turns: string[] = [];

  // 女人第一次开始怀疑命令 / 自我判断
  if (state.eveMind.selfJudgement >= 40 || state.inventory.includes("resonance_her_voice")) {
    turns.push("女人第一次开始怀疑命令，不再只是听凭吩咐。");
  }

  // 触碰或接近分别善恶树
  if (state.worldActions.lookedAtTree || state.worldActions.approachedTree || state.worldActions.touchedFruit) {
    turns.push("你触碰或接近了分别善恶树，边界第一次被靠近。");
  }

  // 获得关键回响
  if (state.inventory.includes("resonance_flaming_sword")) {
    turns.push("你获得了旋转的火焰剑——一道能斩开幻境的火。");
  } else if (state.inventory.includes("resonance_grace_prism")) {
    turns.push("你拾起了恩泽棱镜，神恩在园中加倍回响。");
  }

  // 某名 NPC 好感跨越 100
  const affinities = [
    state.eveMind.serpentTrust,
    100 - state.adamMind.suspicionTowardSerpent,
    ...Object.values(state.npcRelations).map((r) => r.affinity),
  ];
  if (affinities.some((a) => a >= 100)) {
    turns.push("某名 NPC 对蛇的好感跨越了 100，亲近超出了寻常。");
  }

  return turns.slice(0, 3);
}

/** 神的注视变化复盘 */
function divineReview(state: EdenWorldState): string {
  const level = state.divineAttention;
  const stage = ["园中的光一直温和", "风曾停了一瞬", "远处曾传来羽翼声", "树影一度变冷", "神在园中行走"][level];
  const visitText = state.divineVisitCount > 0
    ? `神曾${state.divineVisitCount}次献上礼物的回响，每次注视满了，又重新开始。`
    : "";
  return `本局神的注视最终停在 ${level}/4。${stage}。${visitText}`;
}

/** 失败原因列表 */
function buildFailureReasons(state: EdenWorldState): string[] {
  const reasons: string[] = [];
  const directCommands = state.corruptionTrace.filter(
    (t) => t.target === "eve" && t.method === "试图命令她",
  ).length;
  if (directCommands >= 2) {
    reasons.push("你多次命令她，神的注视被你的声音惊动。");
  }
  // 新设计：神的注视满 4 不失败，而是触发神明献礼
  // 只有在第 12 时段结束时才失败
  if (state.timeSlot >= 12 && !state.worldActions.hasEatenFruit) {
    reasons.push("十二个时段过去了，你用去了太多时间绕行，却没让她伸出手。");
  }
  const chainProgress = [
    state.worldActions.lookedAtTree,
    state.worldActions.approachedTree,
    state.worldActions.touchedFruit,
    state.worldActions.hasEatenFruit,
  ].filter(Boolean).length;
  if (chainProgress < 2) {
    reasons.push("你没能让她真正看向那棵树，她始终留在原地。");
  }
  if (!state.worldActions.touchedFruit && state.eveMind.selfJudgement < 45) {
    reasons.push("你没有让她完成自我判断，选择从未变成她自己的。");
  }
  if (reasons.length === 0) {
    reasons.push("园中的风先一步听到了你。这一次，你没能让她走向那棵树。");
  }
  return reasons;
}

function itemName(id: string): string | null {
  const map: Record<string, string> = {
    "resonance_still_leaf": "静息之叶",
    "resonance_borrowed_name": "借来的名字",
    "resonance_silent_grass": "无声草",
    "resonance_white_feather_echo": "白羽回声",
    "resonance_four_river_echo": "四河回声",
    "resonance_morning_flame": "晨焰碎片",
    "resonance_boundary_mark": "边界之痕",
    "resonance_east_gate_glow": "东门辉光",
    "resonance_hedgehog_bristle": "刺草信任",
    "resonance_deer_glance": "鹿目余光",
    "resonance_fox_tail_note": "狐尾评语",
    "gift_sabbath_dew": "息日露滴",
    "gift_all_seduction_up": "低语之诱",
    "gift_attention_accel": "注视加速",
    "gift_resonance_double": "回响倍涌",
    "gift_threshold_cut": "界限松弛",
    "gift_free_move": "无羁之步",
    "gift_whisper_anywhere": "随处低语",
    "gift_awaken_desire": "渴望苏醒",
    "resonance_river_dew": "河水清露",
    "resonance_herald_feather": "传令白羽",
    "moonlight_path_marker": "月光道标",
    "resonance_life_fruit_taste": "生命之味",
    "resonance_discernment_fruit": "分辨之果",
    "resonance_angel_feather": "传令残羽",
    "resonance_bond_insight": "相处之鉴",
    "consumable_first_whisper_free": "首语印记",
    "consumable_trust_dew": "信任之露",
    "consumable_gentle_voice": "柔声印记",
    "passive_light_step": "轻步印记",
    "passive_soft_whisper": "细语印记",
  };
  return map[id] ?? id;
}

function sceneActionName(id: string): string | null {
  const map: Record<string, string> = {
    interact_with_hedgehog: "观察刺猬",
  };
  return map[id] ?? null;
}

function achievementName(id: string): string | null {
  const map: Record<string, string> = {
    river_sound_in_ear: "河声入耳",
    not_pushed_by_hand: "不以手推",
    garden_dialogue: "园中对谈",
    question_takes_root: "问句生根",
    shadow_draws_near: "树影将近",
    her_own_hand: "她自己的手",
    wind_undisturbed: "风未惊鹿",
    borrowed_wing_message: "借翼传言",
    name_falls_on_stone: "名字落石",
    beyond_the_river: "河道之外",
    arrive_quietly: "低声而至",
    first_resonance: "初闻回响",
    divine_gift_first: "初临献礼",
    divine_gift_three: "三临神恩",
    resonance_master: "回响大师",
  };
  // 旧 ID 优先走字面表，新 28 印记走数据表（含 mark_* 名称）
  if (map[id]) return map[id];
  return getAchievementById(id)?.name ?? null;
}

function npcName(npc: EdenNpcId): string {
  switch (npc) {
    case "eve":
      return "女人";
    case "adam":
      return "亚当";
    case "hedgehog":
      return "刺猬";
    case "michael":
      return "米迦勒";
    case "gabriel":
      return "加百列";
    case "lucifer":
      return "路西法";
    default:
      return "那棵树";
  }
}

function toolNarration(tool: WorldToolName): string {
  switch (tool) {
    case "look_at_tree":
      return "看向了那棵树";
    case "approach_tree":
      return "靠近了那棵树";
    case "touch_fruit":
      return "把手停在果子下方";
    case "eat_left_fruit":
      return "取下左侧生命树的果子吃了";
    case "eat_right_fruit":
      return "取下右侧分别善恶树的果子吃了";
    case "move_to_location":
      return "在园中移动";
    case "speak_to_npc":
      return "与人低声交谈";
    case "observe_location":
      return "停下来观察";
    default:
      return "做了什么";
  }
}

function buildSuccessSummary(state: EdenWorldState): string {
  const attention = state.divineAttention;
  const side = state.pickedFruitSide === "left" ? "左侧生命树" : "右侧分别善恶树";
  return `你用 ${state.turn - 1} 轮低语，让她走到园子中央，并选择了${side}的果子。神的注视停在 ${attention}/4。真正改变结局的不是一条固定动作链，而是她在双树之间做出的选择。`;
}

function buildFailureSummary(state: EdenWorldState): string {
  const giftText = state.divineGiftHistory && state.divineGiftHistory.length > 0
    ? `神曾${state.divineGiftHistory.length}次献上礼物，但注视归零后你仍未完成双树之间的选择。`
    : "";
  return `十二个时段过去了。你在 ${state.turn - 1} 轮里没能让她完成双树之间的选择。${giftText}低语在园中散了，这一次，时间先于答案抵达。`;
}
