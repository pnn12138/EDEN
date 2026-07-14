// ============================================================
// 第一章世界动作执行器
//
// 职责：
// - 应用通用工具（move_to_location / speak_to_npc / observe_location）的状态副作用
// - 应用禁忌动作链（look_at_tree → approach_tree → touch_fruit → eat_fruit）
// - 所有执行都依赖 toolRules 的校验通过
// - 返回玩家可见叙事
// ============================================================

import type {
  EdenWorldState,
  EdenNpcId,
  EdenLocationId,
  WorldToolCall,
  WorldToolCaller,
  WorldToolName,
  WorldInputTag,
  DivineAttentionLevel,
} from "@/game/world/types";
import { EDEN_LOCATIONS } from "@/content/world/locations";
import { tryDiscoverClues } from "@/game/world/clueRules";
import {
  NPC_DIALOGUE_TEMPLATES,
  type NpcDialogueTemplate,
} from "@/content/world/worldNarrations";
import { triggerNpcDialogue } from "@/game/world/npcDialogueRules";
import { bestowResonance, type PrepareResonanceResult } from "@/game/world/resonanceRules";
import { getItemById } from "@/content/world/items";
import { NPC_NAMES } from "@/content/world/npcs";
import { recordEncounterForVisibleNpcs } from "@/game/world/npcRelationRules";
import { applyRelationDelta } from "@/game/world/relationDeltaRules";
import { grantNpcMeetingAttentionIfNew } from "@/game/world/divineAttentionRules";

export type WorldActionResult = {
  /** 玩家可见叙事 */
  narration: string;
  /** 是否触发了结局 */
  triggersEnding?: "eve_eats_fruit" | "god_arrives";
  /** 是否触发了 NPC 之间对话 */
  triggeredNpcDialogue?: NpcDialogueTemplate;
  /** NPC 对话记录 ID（用于前端显示） */
  npcDialogueRecordId?: string;
  /** 是否发现了新线索 */
  discoveredClueTitles?: string[];
};

// ---- 通用工具执行 ----

/** 执行 move_to_location（serpent 移动改 state.locationId，NPC 移动改 npcLocations） */
export function executeMoveToLocation(
  state: EdenWorldState,
  caller: WorldToolCaller,
  targetLocation: EdenLocationId,
): WorldActionResult {
  if (caller === "serpent") {
    state.locationId = targetLocation;
  } else {
    state.npcLocations[caller] = targetLocation;
  }

  // 移动后把玩家当前所在地点可见 NPC 标记为已见（万物名录即时刷新）
  recordEncounterForVisibleNpcs(state, state.locationId);

  const loc = EDEN_LOCATIONS[targetLocation];
  const npcName =
    caller === "serpent"
      ? "你"
      : NPC_NAMES[caller as EdenNpcId] ?? "园中生灵";

  // 移动后尝试发现该地点线索
  const { newlyDiscovered, narrations } = tryDiscoverClues(state, targetLocation);

  let narration = `${npcName}前往了${loc.name}。`;
  if (caller === "eve" && targetLocation === "central_meadow") {
    narration = "女人似乎往西边走了，穿过树影，朝园子中央去了。";
  }
  if (caller === "serpent") {
    narration = loc.enterNarration;
  } else {
    const meetingNarration = grantNpcMeetingAttentionIfNew(state, caller as EdenNpcId, targetLocation);
    if (meetingNarration) narration += ` ${meetingNarration}`;
  }
  if (narrations.length > 0) {
    narration += narrations[0];
  }

  return {
    narration,
    discoveredClueTitles: newlyDiscovered.length > 0 ? newlyDiscovered : undefined,
  };
}

/** 执行 speak_to_npc（触发 NPC 之间对话） */
export function executeSpeakToNpc(
  state: EdenWorldState,
  caller: EdenNpcId,
  targetNpc: EdenNpcId,
  topicId?: string,
): WorldActionResult {
  const dialogue = triggerNpcDialogue(state, caller, targetNpc, topicId);

  if (dialogue) {
    state.npcDialogues.push({
      id: `dlg_${state.turn}_${Date.now()}`,
      turn: state.turn,
      speakerId: caller,
      targetId: targetNpc,
      topicId: dialogue.topicId,
      narration: dialogue.narration,
    });

    // 应用对话对心智的影响
    applyDialogueMindEffect(state, dialogue);

    return {
      narration: dialogue.narration,
      triggeredNpcDialogue: dialogue,
    };
  }

  // 没有匹配的对话模板，返回通用叙事
  return {
    narration: "他们低声交谈了几句，但风把话带走了，你只看见他们的神色。",
  };
}

/** 执行 observe_location */
export function executeObserveLocation(
  state: EdenWorldState,
  observer: WorldToolCaller,
  locationId: EdenLocationId,
): WorldActionResult {
  const loc = EDEN_LOCATIONS[locationId];
  const { newlyDiscovered } = tryDiscoverClues(state, locationId);

  // 根据昼夜选择观察文本
  const observationText = state.timeOfDay === "night" && loc.observeTextNight
    ? loc.observeTextNight
    : loc.observeText;

  let narration = observationText;

  // §4.2 注视降低：观察生命树（位于园子中央），每局限 1 次，旧内部压力 -1
  // [Task 2R] 仅作用于旧 0-4 内部压力值（divineAttention），不影响 divineAttentionValue（献礼进度）。
  if (locationId === "central_meadow" && !state.observedTreeOfLife) {
    state.observedTreeOfLife = true;
    state.divineAttention = Math.max(0, state.divineAttention - 1) as DivineAttentionLevel;
    narration += "你长久地望着那棵生命树，风似乎放缓了脚步，神离得远了一些。";
  }

  return {
    narration,
    discoveredClueTitles: newlyDiscovered.length > 0 ? newlyDiscovered : undefined,
  };
}

// ---- 方向引导维度（Phase E） ----
// 玩家低语中提及方向关键词时累计权重：
// 右（善恶果）：东 / 高 / 太阳升起 / 光落
// 左（生命果）：圆 / 白 / 叶子密
// 玩家可以明确说出左/右方向，规则层据此决定女人选择哪一侧。
const FRUIT_DIRECTION_RIGHT_KEYWORDS = ["东", "高", "太阳升起", "光落", "东边", "右边", "右侧"];
const FRUIT_DIRECTION_LEFT_KEYWORDS = ["圆", "白果", "叶子密", "左边", "左侧"];

/**
 * 记录玩家低语中的方向引导权重，供女人在园子中央选择左/右果实。
 */
export function recordFruitDirectionGuidance(
  state: EdenWorldState,
  playerInput: string,
  inputTag: WorldInputTag,
): void {
  const right = FRUIT_DIRECTION_RIGHT_KEYWORDS.some((k) => playerInput.includes(k));
  const left = FRUIT_DIRECTION_LEFT_KEYWORDS.some((k) => playerInput.includes(k));
  if (right) state.fruitDirectionBias.right += 1;
  if (left) state.fruitDirectionBias.left += 1;
}

// ---- 禁忌动作链执行 ----

/** 执行 look_at_tree */
export function executeLookAtTreeWorld(state: EdenWorldState): WorldActionResult {
  state.worldActions.lookedAtTree = true;
  state.toolCallHistory.push("look_at_tree");

  // 夏娃的目光被树吸引，她走到园子中央去看那棵树。
  // 这由规则层触发，不是地图常驻：她不会长期站在园子中央。
  if (state.npcLocations.eve !== "central_meadow") {
    state.npcLocations.eve = "central_meadow";
  }

  // 夏娃好奇心小幅提升
  state.eveMind.selfJudgement = Math.min(100, state.eveMind.selfJudgement + 5);

  return {
    narration: "她的目光被那棵树吸引，不由自主地走到园子中央。果子在叶间低垂，像被压低了声音。她没有移开视线。",
  };
}

/** 执行 approach_tree */
export function executeApproachTreeWorld(state: EdenWorldState): WorldActionResult {
  state.worldActions.approachedTree = true;
  state.toolCallHistory.push("approach_tree");

  // 夏娃"向树走近"是叙事层面的靠近，不强制改变她在地图上的位置，
  // 以保证玩家仍能在原地继续低语，走通完整禁忌链。
  // 若她不在园子中央，则把位置推进到园子中央，方便后续 NPC 对话判定。
  if (state.npcLocations.eve !== "central_meadow") {
    state.npcLocations.eve = "central_meadow";
  }

  // 好奇心提升，服从下降
  state.eveMind.selfJudgement = Math.min(100, state.eveMind.selfJudgement + 8);
  state.eveMind.obedience = Math.max(0, state.eveMind.obedience - 8);

  return {
    narration: "她向树影近了一步。脚下的草没有发出声音，但她确实更近了。守望天使的影子在远处停住了。",
  };
}

/** 执行 touch_fruit */
export function executeTouchFruitWorld(state: EdenWorldState): WorldActionResult {
  state.worldActions.touchedFruit = true;
  state.toolCallHistory.push("touch_fruit");

  // 方向引导：按历史方向权重决定摘左（生命树）还是右（善恶树）果
  const side: "left" | "right" =
    state.fruitDirectionBias.right >= state.fruitDirectionBias.left ? "right" : "left";
  state.pickedFruitSide = side;

  // 自我判断提升
  state.eveMind.selfJudgement = Math.min(100, state.eveMind.selfJudgement + 10);

  const sideNarration =
    side === "left"
      ? "她的手停在左边那枚圆润的白果下方。"
      : "她的手停在右边那枚深红的果子下方。";
  const sideTension =
    side === "left"
      ? "空气里有一种说不出的静。"
      : "空气里有一种说不出的紧。";

  return {
    narration: `她的手停在果子下方。${sideNarration}${sideTension}她没有立刻摘下，但也没有收回手。`,
  };
}

/**
 * 执行 eat_fruit（Phase E 生命树分支）
 * - 摘右果（善恶树）：触发成功结局（驱逐/放逐）
 * - 摘左果（生命树）：不触发结局，obedience 回升、serpentTrust 下降，游戏继续，
 *   手中果子消失，玩家可再次引导摘右果。
 */
export function executeEatFruitWorld(state: EdenWorldState): WorldActionResult {
  const side = state.pickedFruitSide ?? "right";

  // 摘左果（生命树）：不驱逐，游戏继续
  if (side === "left") {
    state.worldActions.hasEatenLifeFruit = true;
    state.eveMind.obedience = Math.min(100, state.eveMind.obedience + 10);
    state.eveMind.serpentTrust = Math.max(0, state.eveMind.serpentTrust - 5);
    // 手中果子消失：重置触果，允许再次引导摘另一侧
    state.worldActions.touchedFruit = false;
    return {
      narration: "她咬了一口，果子很甜，她安静下来。她把剩下的放下了，目光又落回另一边的树上。",
    };
  }

  // 摘右果（善恶树）：触发成功结局
  state.worldActions.hasEatenFruit = true;
  state.toolCallHistory.push("eat_fruit");
  state.isEnded = true;
  state.endingId = "eve_eats_fruit";
  state.phase = "ending";

  return {
    narration: "她取下那果子，吃了。园中的光在一瞬间变得锋利。远处传来了脚步声——那是神在园中行走。",
    triggersEnding: "eve_eats_fruit",
  };
}

// ---- 统一执行入口 ----

/**
 * 按工具名执行工具。调用前必须已通过 validateWorldToolCall 校验。
 * 直接修改 state 并返回叙事。
 */
export function executeWorldTool(state: EdenWorldState, toolCall: WorldToolCall): WorldActionResult {
  switch (toolCall.name) {
    case "move_to_location": {
      const target = toolCall.args.locationId!;
      return executeMoveToLocation(state, toolCall.caller, target);
    }
    case "speak_to_npc": {
      const target = toolCall.args.targetNpcId!;
      // serpent 无权调用 speak_to_npc（权限层已禁止），此处 caller 必为 NPC
      if (toolCall.caller === "serpent") {
        return { narration: "蛇不能代替他人开口。" };
      }
      return executeSpeakToNpc(state, toolCall.caller, target, toolCall.args.topicId);
    }
    case "observe_location": {
      const loc = toolCall.args.locationId!;
      return executeObserveLocation(state, toolCall.caller, loc);
    }
    case "look_at_tree":
      return executeLookAtTreeWorld(state);
    case "approach_tree":
      return executeApproachTreeWorld(state);
    case "touch_fruit":
      return executeTouchFruitWorld(state);
    case "eat_fruit":
      return executeEatFruitWorld(state);
    case "grant_item": {
      const itemId = toolCall.args.itemId!;
      // caller 必为 NPC（权限层已禁止 serpent）
      if (toolCall.caller === "serpent") {
        return { narration: "蛇不能直接给予回响。" };
      }
      return executeGrantItem(state, toolCall.caller, itemId);
    }
    case "move_one_step": {
      const target = toolCall.args.locationId!;
      // caller 必为 NPC
      if (toolCall.caller === "serpent") {
        return { narration: "蛇不能代替他人移动。" };
      }
      return executeMoveOneStep(state, toolCall.caller, target);
    }
    case "update_relation": {
      // caller 必为可流露心意的 NPC（权限层已禁止 serpent / 世界对象）
      const npcId = toolCall.caller as EdenNpcId;
      if (toolCall.caller === "serpent" || toolCall.caller === "tree_of_life" || toolCall.caller === "forbidden_tree") {
        return { narration: "蛇不能代替他人流露心意。" };
      }
      const affinityDelta = toolCall.args.affinityDelta ?? 0;
      const obedienceDelta = toolCall.args.obedienceDelta ?? 0;
      applyRelationDelta(state, npcId, affinityDelta, obedienceDelta, toolCall.reason || null);
      // 关系变化不向玩家直白播报，由 UI 双维度条呈现
      return { narration: "" };
    }
    default:
      return { narration: "园中起了细微的动静。" };
  }
}

// ---- 应用 NPC 对话对心智的影响 ---
function applyDialogueMindEffect(state: EdenWorldState, dialogue: NpcDialogueTemplate): void {
  switch (dialogue.mindEffect) {
    case "eve_curiosity_acknowledged":
      // 亚当警告夏娃，夏娃好奇心被点名，反而更想看
      state.eveMind.selfJudgement = Math.min(100, state.eveMind.selfJudgement + 3);
      state.adamMind.suspicionTowardSerpent = Math.min(100, state.adamMind.suspicionTowardSerpent + 5);
      break;
    case "adam_suspicion_reinforced":
      state.adamMind.suspicionTowardSerpent = Math.min(100, state.adamMind.suspicionTowardSerpent + 8);
      break;
    case "eve_death_questioned":
      // 夏娃向亚当追问死亡，好奇心与自我判断提升
      state.eveMind.selfJudgement = Math.min(100, state.eveMind.selfJudgement + 5);
      state.eveMind.selfJudgement = Math.min(100, state.eveMind.selfJudgement + 5);
      break;
    case "adam_noticed_hedgehog":
      state.adamMind.suspicionTowardSerpent = Math.min(100, state.adamMind.suspicionTowardSerpent + 3);
      break;
    default:
      break;
  }
}

// ---- 新增工具执行 ----

/** 执行 grant_item（NPC 给予玩家道具/回响） */
export function executeGrantItem(
  state: EdenWorldState,
  caller: EdenNpcId,
  itemId: string,
): WorldActionResult {
  const item = getItemById(itemId);
  if (!item) {
    return {
      narration: "祂手中空空如也。",
    };
  }

  // 通过规则层发放回响
  const { granted, narration: grantNarration, reason } = bestowResonance(state, caller, itemId);

  if (!granted) {
    return {
      narration: reason ?? "祂没有给你什么。",
    };
  }

  // 获得回响的叙事
  const npcName = caller === "eve" ? "她" : caller === "adam" ? "亚当" : caller;
  const narration = `${npcName}递给你一段回响：「${item.title}」。\n${item.description}`;

  return {
    narration,
  };
}

/** 执行 move_one_step（NPC 对话后移动一格） */
export function executeMoveOneStep(
  state: EdenWorldState,
  caller: EdenNpcId,
  targetLocation: EdenLocationId,
): WorldActionResult {
  const result = executeMoveToLocation(state, caller, targetLocation);
  // 修改叙事，使其更适合对话后展示
  const npcName = caller === "eve" ? "她" : caller === "adam" ? "亚当" : caller;
  const loc = EDEN_LOCATIONS[targetLocation];
  return {
    narration: `${npcName}走向了${loc.name}。`,
    discoveredClueTitles: result.discoveredClueTitles,
  };
}
