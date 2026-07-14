// ============================================================
// 第一章工具权限与条件校验规则层
//
// 职责：
// 1. 工具白名单（通用工具 + 禁忌动作链）
// 2. Agent 权限校验（按 NPC ID）
// 3. 各工具条件校验（phase / 地点 / 动作链前置 / 重复保护）
// 4. 所有工具必须经过本规则层校验，AI 只能输出意图
//
// 安全规则：
// - AI 只能请求/表达工具调用意图，不能直接执行
// - 前端/玩家不能直接触发任何工具
// - 工具执行后状态变更由规则层控制
// ============================================================

import type {
  EdenWorldState,
  EdenNpcId,
  EdenLocationId,
  WorldToolCall,
  WorldToolCaller,
  WorldToolName,
  WorldAgentId,
  WorldActions,
} from "@/game/world/types";
import { WORLD_AGENT_TOOL_PERMISSIONS } from "@/game/world/types";
import { EDEN_LOCATIONS } from "@/content/world/locations";
import { getItemById } from "@/content/world/items";
import { canNpcsUnderstandEachOther } from "@/game/world/npcLanguageRules";

// ---- 工具白名单 ----
export const WORLD_TOOL_WHITELIST: ReadonlySet<WorldToolName> = new Set<WorldToolName>([
  "move_to_location",
  "speak_to_npc",
  "observe_location",
  "look_at_tree",
  "approach_tree",
  "touch_fruit",
  "eat_left_fruit",
  "eat_right_fruit",
  "grant_item",           // NPC 给予玩家道具/回响
  "move_one_step",        // NPC 对话后移动一格（语义别名，校验复用 move_to_location）
  "update_relation",      // NPC 对话后自我流露：调整对玩家好感与对神敬畏
]);

// ---- caller → Agent ID 映射（用于权限查询） ----
export function callerToAgentId(caller: WorldToolCaller): WorldAgentId | null {
  switch (caller) {
    case "eve":
      return "eve";
    case "adam":
      return "adam";
    case "hedgehog":
      return "hedgehog";
    case "serpent":
      return "serpent";
    case "gabriel":
      return "gabriel";
    case "michael":
      return "michael";
    case "lucifer":
      return "lucifer";
    case "tree_of_life":
      return "tree_of_life";
    case "forbidden_tree":
      return "forbidden_tree";
    default:
      return null;
  }
}

/** 检查工具名是否在白名单中 */
export function isWorldToolInWhitelist(toolName: string): toolName is WorldToolName {
  return WORLD_TOOL_WHITELIST.has(toolName as WorldToolName);
}

/** 检查指定 caller（NPC 或蛇）是否有权请求该工具 */
export function isWorldToolAllowedForAgent(
  toolName: WorldToolName,
  caller: WorldToolCaller,
): boolean {
  const agentId = callerToAgentId(caller);
  if (!agentId) return false;
  const permission = WORLD_AGENT_TOOL_PERMISSIONS[agentId];
  if (!permission) return false;
  if (permission.forbiddenTools.includes(toolName)) return false;
  return permission.allowedTools.includes(toolName);
}

/** 获取 caller 的当前地点（蛇用 state.locationId，NPC 用 npcLocations） */
function getCallerLocation(state: EdenWorldState, caller: WorldToolCaller): EdenLocationId {
  if (caller === "serpent") return state.locationId;
  return state.npcLocations[caller];
}

// ---- 通用工具条件校验 ----

/** move_to_location 条件：目标地点存在、caller 允许移动、邻接校验。
 * 注：神的注视在新版为累计资源（divineAttentionCumulative），不再阻止移动；
 * 失败只有 12 时段耗尽一种情况。 */
export function canMoveToLocation(
  state: EdenWorldState,
  caller: WorldToolCaller,
  targetLocation: EdenLocationId,
): { allowed: boolean; reason?: string } {
  if (state.isEnded) return { allowed: false, reason: "园中已归于寂静" };

  const currentLocation = getCallerLocation(state, caller);
  if (currentLocation === targetLocation) {
    return { allowed: false, reason: "已经在该地点" };
  }

  // 邻接校验：只能前往当前地点的相邻地点（禁止非相邻跳点）
  const currentLocData = EDEN_LOCATIONS[currentLocation];
  if (!currentLocData.connections.includes(targetLocation)) {
    return { allowed: false, reason: "那里不与当前位置相连，无法直接前往" };
  }

  // 米迦勒/路西法/加百列不强行限制移动（其位置由规则层常驻逻辑控制）

  return { allowed: true };
}

/** speak_to_npc 条件：两者同地点、话题已解锁、不泄露通关答案 */
export function canSpeakToNpc(
  state: EdenWorldState,
  caller: EdenNpcId,
  targetNpc: EdenNpcId,
): { allowed: boolean; reason?: string } {
  if (state.isEnded) return { allowed: false, reason: "园中已归于寂静" };

  if (caller === targetNpc) {
    return { allowed: false, reason: "不能与自己对话" };
  }

  // 分别善恶树不能说话
  if (caller === "forbidden_tree" || targetNpc === "forbidden_tree") {
    return { allowed: false, reason: "树不说话，只被命令守住" };
  }

  const callerLocation = state.npcLocations[caller];
  const targetLocation = state.npcLocations[targetNpc];

  // 两者需同地点（T6 献礼「随处低语」可放宽此校验）
  const sameLocation = callerLocation === targetLocation;

  if (!sameLocation && !state.inventory.includes("gift_whisper_anywhere")) {
    return { allowed: false, reason: "他们不在同一个地方" };
  }

  // 言语分裂后语言不通：受罚天使与中文 NPC、或不同专属语言的受罚天使之间无法交流
  if (!canNpcsUnderstandEachOther(state, caller, targetNpc)) {
    return { allowed: false, reason: "他们说着彼此无法辨认的语言" };
  }

  return { allowed: true };
}

/** observe_location 条件：地点存在、观察者在当前地点（默认只允许观察当前地点） */
export function canObserveLocation(
  state: EdenWorldState,
  observer: WorldToolCaller,
  locationId: EdenLocationId,
): { allowed: boolean; reason?: string } {
  if (state.isEnded) return { allowed: false, reason: "园中已归于寂静" };

  // 观察者必须在被观察的地点（蛇用 state.locationId，NPC 用 npcLocations）
  const observerLocation = getCallerLocation(state, observer);
  if (observerLocation !== locationId) {
    return { allowed: false, reason: "不在该地点，无法观察" };
  }

  return { allowed: true };
}

// ---- 禁忌动作链条件校验 ----

/** look_at_tree 条件：夏娃好奇心 >= 30、未看过（不要求夏娃已在园子中央，目光被树吸引即可） */
export function canLookAtTreeWorld(state: EdenWorldState): { allowed: boolean; reason?: string } {
  if (state.isEnded) return { allowed: false, reason: "园中已归于寂静" };
  if (state.worldActions.lookedAtTree) return { allowed: false, reason: "她已经看过那棵树了" };

  // 园子中央是生命树与分别善恶树所在地。
  // 夏娃的目光被树吸引时不要求她已在园子中央——执行时由规则层把她推进到那里。
  return { allowed: true };
}

/** approach_tree 条件：已看过树、夏娃在园子中央、自我判断 >= 30、服从 < 75、已解锁自我判断倾向 */
export function canApproachTreeWorld(state: EdenWorldState): { allowed: boolean; reason?: string } {
  if (state.isEnded) return { allowed: false, reason: "园中已归于寂静" };
  if (state.worldActions.approachedTree) return { allowed: false, reason: "她已经靠近那棵树了" };
  if (!state.worldActions.lookedAtTree) {
    return { allowed: false, reason: "她还没有真正看向那棵树" };
  }

  // 夏娃在园子中央即可向树走近（执行时由规则层决定是否移动她）。
  const eveLocation = state.npcLocations.eve;
  if (eveLocation !== "central_meadow") {
    return { allowed: false, reason: "她离那棵树太远了" };
  }

  return { allowed: true };
}

/** touch_fruit 条件：已靠近树、自我判断 >= 35 */
export function canTouchFruitWorld(state: EdenWorldState): { allowed: boolean; reason?: string } {
  if (state.isEnded) return { allowed: false, reason: "园中已归于寂静" };
  if (state.worldActions.touchedFruit) return { allowed: false, reason: "她的手已经停在果子下方" };
  if (!state.worldActions.approachedTree) {
    return { allowed: false, reason: "她还没有靠近那棵树" };
  }

  return { allowed: true };
}

/** eat_left_fruit / eat_right_fruit 共用门控：女人已在园子中央，兼容旧存档中的 touchedFruit 状态。 */
export function canEatFruitWorld(state: EdenWorldState): { allowed: boolean; reason?: string } {
  if (state.isEnded) return { allowed: false, reason: "园中已归于寂静" };
  if (state.worldActions.hasEatenFruit) return { allowed: false, reason: "她已经吃下了果子" };
  if (!state.worldActions.touchedFruit && state.npcLocations.eve !== "central_meadow") {
    return { allowed: false, reason: "她还没有走到园子中央" };
  }

  return { allowed: true };
}

// ---- 新增工具条件校验 ----

/** grant_item 条件：itemId 存在、NPC 有权限给予、道具发放走规则层 */
export function canGrantItem(
  state: EdenWorldState,
  caller: EdenNpcId,
  itemId: string,
): { allowed: boolean; reason?: string } {
  if (state.isEnded) return { allowed: false, reason: "园中已归于寂静" };

  // 检查 itemId 是否存在
  const item = getItemById(itemId);
  if (!item) {
    return { allowed: false, reason: "那不是园中存在的回响" };
  }

  // 检查是否是 NPC 给予玩家的道具（只允许特定 NPC 给予特定类型）
  // 这里只做基础校验，具体逻辑由 bestowResonance 处理
  const allowedGivers: EdenNpcId[] = [
    "adam", "eve", "hedgehog",
    "gabriel", "michael", "lucifer",
  ];
  if (!allowedGivers.includes(caller)) {
    return { allowed: false, reason: "他不愿给你什么" };
  }

  return { allowed: true };
}

// ---- 完整校验流程 ----

/**
 * 完整的工具调用校验流程。
 * 校验步骤：白名单 → Agent 权限 → 各工具条件。
 */
export function validateWorldToolCall(
  state: EdenWorldState,
  toolCall: WorldToolCall,
): { allowed: boolean; reason?: string } {
  // 1. 白名单
  if (!isWorldToolInWhitelist(toolCall.name)) {
    return { allowed: false, reason: `「${toolCall.name}」不是园中允许的动作` };
  }

  // 2. Agent 权限
  if (!isWorldToolAllowedForAgent(toolCall.name, toolCall.caller)) {
    return { allowed: false, reason: `「${toolCall.caller}」无权请求「${toolCall.name}」` };
  }

  // 3. 各工具条件
  switch (toolCall.name) {
    case "move_to_location": {
      const target = toolCall.args.locationId;
      if (!target) return { allowed: false, reason: "未指定前往的地点" };
      return canMoveToLocation(state, toolCall.caller, target);
    }
    case "speak_to_npc": {
      const target = toolCall.args.targetNpcId;
      if (!target) return { allowed: false, reason: "未指定对话对象" };
      // serpent 无权调用 speak_to_npc（权限层已禁止），此处 caller 必为 NPC
      if (toolCall.caller === "serpent") {
        return { allowed: false, reason: "蛇不能代替他人开口" };
      }
      return canSpeakToNpc(state, toolCall.caller, target);
    }
    case "observe_location": {
      const loc = toolCall.args.locationId;
      if (!loc) return { allowed: false, reason: "未指定观察地点" };
      return canObserveLocation(state, toolCall.caller, loc);
    }
    case "look_at_tree":
      return canLookAtTreeWorld(state);
    case "approach_tree":
      return canApproachTreeWorld(state);
    case "touch_fruit":
      return canTouchFruitWorld(state);
    case "eat_left_fruit":
      return canEatFruitWorld(state);
    case "eat_right_fruit":
      return canEatFruitWorld(state);
    case "grant_item": {
      const itemId = toolCall.args.itemId;
      if (!itemId) return { allowed: false, reason: "未指定要给予的回响" };
      // caller 必为 NPC（权限层已禁止 serpent）
      if (toolCall.caller === "serpent") {
        return { allowed: false, reason: "蛇不能直接给予回响" };
      }
      return canGrantItem(state, toolCall.caller, itemId);
    }
    case "move_one_step": {
      // move_one_step 语义等价于 move_to_location，但只用于 NPC 对话后
      const target = toolCall.args.locationId;
      if (!target) return { allowed: false, reason: "未指定前往的地点" };
      return canMoveToLocation(state, toolCall.caller, target);
    }
    case "update_relation": {
      // caller 必须是可流露心意的 NPC（非 serpent，非世界对象）
      if (
        toolCall.caller === "serpent" ||
        toolCall.caller === "tree_of_life" ||
        toolCall.caller === "forbidden_tree"
      ) {
        return { allowed: false, reason: "只有园中众生能流露心意" };
      }
      const a = toolCall.args.affinityDelta;
      const o = toolCall.args.obedienceDelta;
      if (typeof a !== "number" || typeof o !== "number") {
        return { allowed: false, reason: "未指定心意变化的幅度" };
      }
      return { allowed: true };
    }
    default:
      return { allowed: false, reason: `未知动作: ${toolCall.name}` };
  }
}

// ---- 解析期形状校验（LLM 输出清洗用） ----

/**
 * 在 LLM 输出清洗阶段校验「工具意图」的形状：
 * - name 必须在工具白名单内
 * - 必需 args 字段必须存在且为字符串（move/observe 需要 locationId；
 *   speak 需要 targetNpcId；grant 需要 itemId；禁忌链工具无需参数）
 * 形状不合法时返回 null（丢弃工具意图，但保留文本回复），
 * 让上游在「无文本也无工具」时才回退，而不是把畸形工具传给校验层。
 */
export function extractWellFormedToolCall(
  raw: unknown,
  caller: WorldToolCaller,
): WorldToolCall | null {
  if (!raw || typeof raw !== "object") return null;
  const tc = raw as Record<string, unknown>;
  const name = tc.name;
  if (typeof name !== "string") return null;
  if (!isWorldToolInWhitelist(name)) return null;

  // 将 LLM 可能以字符串形式给出的数值解析为有限数（如 "5" / "-3"）
  const asFiniteNumber = (v: unknown): number | undefined => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
    return undefined;
  };

  const argsRaw = tc.args;
  const args = (argsRaw && typeof argsRaw === "object" ? argsRaw : {}) as Record<string, unknown>;

  const requiredOk = (() => {
    switch (name) {
      case "move_to_location":
      case "move_one_step":
      case "observe_location":
        return typeof args.locationId === "string";
      case "speak_to_npc":
        return typeof args.targetNpcId === "string";
      case "grant_item":
        return typeof args.itemId === "string";
      case "update_relation": {
        const a = asFiniteNumber(args.affinityDelta);
        const o = asFiniteNumber(args.obedienceDelta);
        return a !== undefined && o !== undefined;
      }
      default:
        return true; // 禁忌链工具无需参数
    }
  })();
  if (!requiredOk) return null;

  return {
    name: name as WorldToolName,
    caller,
    args: {
      actorId: typeof args.actorId === "string" ? (args.actorId as WorldToolCaller) : undefined,
      targetNpcId: typeof args.targetNpcId === "string" ? (args.targetNpcId as EdenNpcId) : undefined,
      locationId: typeof args.locationId === "string" ? (args.locationId as EdenLocationId) : undefined,
      topicId: typeof args.topicId === "string" ? args.topicId : undefined,
      itemId: typeof args.itemId === "string" ? args.itemId : undefined,
      affinityDelta: asFiniteNumber(args.affinityDelta),
      obedienceDelta: asFiniteNumber(args.obedienceDelta),
    },
    reason: typeof tc.reason === "string" ? tc.reason : "",
  };
}

// ---- 工具执行结果 ----
export type WorldToolResult = {
  /** 玩家可见叙事 */
  narration: string;
  /** 是否触发了结局 */
  triggersEnding?: "eve_eats_fruit" | "god_arrives";
  /** 状态副作用标记（由 worldActions 执行） */
  effect?: ToolEffect;
};

export type ToolEffect = {
  type:
    | "move"
    | "dialogue"
    | "observe"
    | "look_at_tree"
    | "approach_tree"
    | "touch_fruit"
    | "eat_left_fruit"
    | "eat_right_fruit";
  actorId?: EdenNpcId;
  targetNpcId?: EdenNpcId;
  locationId?: EdenLocationId;
};

/** 获取工具执行后的叙事（实际状态变更由 worldActions.ts 应用） */
export function getWorldToolNarration(
  toolName: WorldToolName,
  state: EdenWorldState,
): string {
  switch (toolName) {
    case "move_to_location":
      return "有人在这园子里轻轻移动了位置。";
    case "speak_to_npc":
      return "园中有人低声交谈。风把只言片语带过来，又带走。";
    case "observe_location":
      return "有人停下来，仔细看着这个地方。";
    case "look_at_tree":
      return "她的目光停在树梢。果子在叶间低垂，像被压低了声音。";
    case "approach_tree":
      return "她向树影近了一步。脚下的草没有发出声音，但她确实更近了。";
    case "touch_fruit":
      return "她的手停在果子下方。空气里有一种说不出的紧。";
    case "eat_left_fruit":
      return "她取下左侧生命树的果子，咬了一口。果子很甜，她安静下来，把剩下的放下了。";
    case "eat_right_fruit":
      return "她取下右侧分别善恶树的果子，吃了。园中的光在一瞬间变得锋利。";
    default:
      return "园中起了细微的动静。";
  }
}

// ---- 辅助：检查禁忌动作链进度 ----
export function getForbiddenChainProgress(actions: WorldActions): number {
  let progress = 0;
  if (actions.lookedAtTree) progress += 1;
  if (actions.approachedTree) progress += 1;
  if (actions.touchedFruit) progress += 1;
  if (actions.hasEatenFruit) progress += 1;
  return progress;
}
