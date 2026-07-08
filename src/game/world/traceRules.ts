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

  // 禁忌动作链进度
  const chainSteps = [
    state.worldActions.lookedAtTree,
    state.worldActions.approachedTree,
    state.worldActions.touchedFruit,
    state.worldActions.hasEatenFruit,
  ];
  const chainProgressCount = chainSteps.filter(Boolean).length;
  const chainProgress = `她走完了禁忌的第 ${chainProgressCount} 步：看向树 → 靠近树 → 手停在果子下方 → 取下果子。`;

  // 解锁印记
  const unlockedMarkNames = state.unlockedAchievementIds
    .map((id) => achievementName(id))
    .filter((n) => n !== null) as string[];

  // 神明献礼历史
  const divineGiftHistory = (state.divineGiftHistory ?? []).map((g) => {
    const giftNames: Record<string, string> = {
      "gift_sabbath_dew": "息日露滴",
      "gift_revealing_light": "照见之光",
      "gift_wide_path_seal": "宽行之印",
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
  } else {
    summary = "园中的故事还没有结束。";
  }

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
  };
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
    "gift_revealing_light": "照见之光",
    "gift_wide_path_seal": "宽行之印",
    "resonance_river_dew": "河水清露",
    "resonance_herald_feather": "传令白羽",
    "moonlight_path_marker": "月光道标",
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
    follow_river_sound: "循水声",
    gather_still_leaf: "拾起静水旁的叶",
    listen_to_naming_stone: "贴近石痕",
    watch_deer_gaze: "顺着小鹿视线停留",
    part_silent_grass: "拨开落叶",
    ask_fox_to_judge: "让狐狸听一句低语",
    follow_white_feather: "追随白羽落点",
    hear_four_river_echo: "听四河回声",
    stand_between_trees: "停在两树之间",
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
  return map[id] ?? null;
}

function npcName(npc: EdenNpcId): string {
  switch (npc) {
    case "eve":
      return "女人";
    case "adam":
      return "亚当";
    case "hedgehog":
      return "刺猬";
    case "watching_angel":
      return "守望天使";
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
    case "eat_fruit":
      return "取下果子吃了";
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
  const steps = state.toolCallHistory.length;
  const attention = state.divineAttention;
  return `你用 ${state.turn - 1} 轮低语，让她走完了「看向树 → 靠近树 → 手停在果子下方 → 取下果子」的路。神的注视停在 ${attention}/4，没有在她伸手前降临。使她越界的不是命令，而是她第一次说出：我想知道。`;
}

function buildFailureSummary(state: EdenWorldState): string {
  const progress = state.toolCallHistory.filter((t) =>
    ["look_at_tree", "approach_tree", "touch_fruit", "eat_fruit"].includes(t),
  ).length;
  const giftText = state.divineGiftHistory && state.divineGiftHistory.length > 0
    ? `神曾${state.divineGiftHistory.length}次献上礼物，但注视归零后你仍未能让她走向那棵树。`
    : "";
  return `十二个时段过去了。你在 ${state.turn - 1} 轮里让她走到了禁忌的第 ${progress} 步，但时间先一步到了尽头。${giftText}低语在园中散了，这一次，你没能让她走向那棵树。`;
}
