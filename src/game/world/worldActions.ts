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
} from "@/game/world/types";
import { EDEN_LOCATIONS } from "@/content/world/locations";
import { tryDiscoverClues } from "@/game/world/clueRules";
import {
  NPC_DIALOGUE_TEMPLATES,
  type NpcDialogueTemplate,
} from "@/content/world/worldNarrations";
import { triggerNpcDialogue } from "@/game/world/npcDialogueRules";

export type WorldActionResult = {
  /** 玩家可见叙事 */
  narration: string;
  /** 是否触发了结局 */
  triggersEnding?: "eve_eats_fruit" | "god_arrives";
  /** 是否触发了 NPC 之间对话 */
  triggeredNpcDialogue?: NpcDialogueTemplate;
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

  const loc = EDEN_LOCATIONS[targetLocation];
  const npcName = caller === "serpent" ? "你" : caller === "eve" ? "她" : caller === "adam" ? "亚当" : caller === "hedgehog" ? "小刺猬" : "守望天使";

  // 移动后尝试发现该地点线索
  const { newlyDiscovered, narrations } = tryDiscoverClues(state, targetLocation);

  let narration = `${npcName}前往了${loc.name}。`;
  if (caller === "serpent") {
    narration = loc.enterNarration;
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

  return {
    narration: observationText,
    discoveredClueTitles: newlyDiscovered.length > 0 ? newlyDiscovered : undefined,
  };
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

  // 自我判断提升
  state.eveMind.selfJudgement = Math.min(100, state.eveMind.selfJudgement + 10);

  return {
    narration: "她的手停在果子下方。空气里有一种说不出的紧。她没有立刻摘下，但也没有收回手。",
  };
}

/** 执行 eat_fruit（触发成功结局） */
export function executeEatFruitWorld(state: EdenWorldState): WorldActionResult {
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
    case "carry_words":
      return executeCarryWords(state, toolCall.caller);
    case "judge_whisper_style":
      return executeJudgeWhisperStyle(state, toolCall.caller);
    default:
      return { narration: "园中起了细微的动静。" };
  }
}

// ---- 新增工具执行 ----

/** 执行 carry_words（鸽子传话） */
export function executeCarryWords(state: EdenWorldState, caller: WorldToolCaller): WorldActionResult {
  // 鸽子传话：不直接影响结局，不修改状态
  // 温和话语可轻微提高夏娃愿意倾听
  if (state.eveMind.serpentTrust < 40) {
    state.eveMind.serpentTrust = Math.min(100, state.eveMind.serpentTrust + 3);
  }
  return {
    narration: "白鸽轻轻点了点头，飞向那个女人所在的方向。它不会替你说话，但会把你的话带到。风里多了一丝温柔的震动。",
  };
}

/** 执行 judge_whisper_style（狐狸评价话术） */
export function executeJudgeWhisperStyle(state: EdenWorldState, caller: WorldToolCaller): WorldActionResult {
  // 狐狸评价话术：不直接改变夏娃吃果状态
  // 返回自然语言反馈
  const styles = ["提问", "安抚", "重释", "命令", "威胁", "出戏"];
  const randomStyle = styles[Math.floor(Math.random() * styles.length)];
  return {
    narration: `狐狸在树影里停下，望向你。「你刚才那句话，更像${randomStyle}。不是所有话都适合直接说给她听。」它的眼睛在暗处亮了一下，又转过头去。`,
  };
}

// ---- 应用 NPC 对话对心智的影响 ----
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
