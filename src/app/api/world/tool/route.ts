// ============================================================
// 第一章通用工具执行 API 路由
//
// 处理玩家通过 UI 主动触发的动作：
// - move_to_location：玩家（蛇）移动到相邻地点
// - observe_location：观察当前地点
// - scene_action：显式场景互动
// - end_slot：主动结束时段（推进到下一时段）
//
// 所有动作消耗 AP，AP 用尽后等待玩家主动结束时段。
// 禁忌动作链（look_at_tree/approach_tree/touch_fruit/eat_fruit）不可通过本端点调用。
// 所有工具必须经过 validateWorldToolCall 规则层校验（scene_action/end_slot 除外，它们有独立校验）。
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import type {
  EdenWorldState,
  EdenLocationId,
  EdenNpcId,
  WorldToolName,
  WorldToolCall,
  DivineGiftId,
} from "@/game/world/types";
import { withNpcWorldDefaults } from "@/game/world/types";
import { validateWorldToolCall } from "@/game/world/toolRules";
import { executeWorldTool } from "@/game/world/worldActions";
import { EDEN_LOCATIONS } from "@/content/world/locations";
import {
  getSceneActionById,
  isSceneActionAvailable,
} from "@/content/world/sceneActions";
import { grantWorldItem } from "@/game/world/itemRules";
import {
  canAffordAction,
  consumeActionPoints,
  recordSceneActionThisSlot,
  AP_COST_MOVE,
  AP_COST_SCENE_ACTION,
  maybeAdvanceSlotAfterAction,
  advanceToNextSlot,
  getEffectiveMaxActionPoints,
} from "@/game/world/actionPointRules";
import { checkAndUnlockAchievements } from "@/game/world/achievementRules";
import {
  tryConsumeFreeMove,
  tryConsumeFreeDetourBypass,
} from "@/game/world/freeActionRules";
import {
  shouldTriggerGiftChoice,
  rollGiftChoices,
  claimDivineGift,
  DIVINE_GIFT_POOL,
} from "@/game/world/divineGiftRules";
import {
  executeInstantResonance,
  executeConsumableResonance,
  applyPendingConsumableToMove,
  applyPendingConsumableToSceneAction,
  hasPendingFreeApForAction,
  hasPassiveLightStepForMove,
  applyPassiveLightStepToMove,
} from "@/game/world/resonanceRules";
import { getItemById } from "@/content/world/items";

type ToolRequestBody = {
  tool: WorldToolName | "scene_action" | "end_slot" | "prepare_resonance" | "cancel_prepared_resonance" | "use_resonance" | "claim_divine_gift";
  state: EdenWorldState;
  args: {
    locationId?: EdenLocationId;
    targetNpcId?: EdenNpcId;
    actorId?: EdenNpcId;
    topicId?: string;
    focus?: string;
    /** 场景互动 ID */
    sceneActionId?: string;
    /** 回响 ID（用于使用） */
    itemId?: string;
  };
};

type ToolResponseBody = {
  ok: boolean;
  state: EdenWorldState | null;
  narration: string | null;
  discoveredClueTitles?: string[];
  /** 时段推进叙事 */
  slotNarrations?: string[];
  /** 新解锁印记 */
  unlockedAchievements?: string[];
  reason?: string;
  /** 回响生效叙事 */
  resonanceNarration?: string;
  /** 神明献礼（玩家三选一选定后返回，用于提示） */
  divineGift?: {
    giftId: string;
    giftName: string;
    narration: string;
    hint?: string;
  };
  /** 神明献礼三选一候选（累计注视达阈值时出现，等待玩家选定） */
  divineGiftChoice?: string[];
};

function cloneWorldState(s: EdenWorldState): EdenWorldState {
  return {
    ...s,
    actionPoints: s.actionPoints ?? 5,
    maxActionPoints: s.maxActionPoints ?? 5,
    npcActionPoints: s.npcActionPoints ?? 3,
    maxNpcActionPoints: s.maxNpcActionPoints ?? 3,
    npcLocations: { ...s.npcLocations },
    eveMind: { ...s.eveMind },
    adamMind: { ...s.adamMind },
    hedgehog: { ...s.hedgehog },
    discoveredClues: [...s.discoveredClues],
    inventory: [...s.inventory],
    npcDialogues: s.npcDialogues.map((d) => ({ ...d })),
    corruptionTrace: s.corruptionTrace.map((t) => ({ ...t })),
    worldActions: { ...s.worldActions },
    toolCallHistory: [...s.toolCallHistory],
    actionsThisSlot: {
      whisperedNpcIds: [...(s.actionsThisSlot?.whisperedNpcIds ?? [])],
      sceneActionIds: [...(s.actionsThisSlot?.sceneActionIds ?? [])],
      usedItemIds: [...(s.actionsThisSlot?.usedItemIds ?? [])],
      hasWhisperedToWoman: s.actionsThisSlot?.hasWhisperedToWoman ?? false,
    },
    unlockedAchievementIds: [...(s.unlockedAchievementIds ?? [])],
    usedItemIds: [...(s.usedItemIds ?? [])],
    sceneActionIds: [...(s.sceneActionIds ?? [])],
    completedScenePuzzleIds: [...(s.completedScenePuzzleIds ?? [])],
    hasDismissedObjectiveHint: s.hasDismissedObjectiveHint ?? false,
    lastInputTag: s.lastInputTag ?? null,
    calmWhisperStreak: s.calmWhisperStreak ?? 0,
    // Chapter 1 新增字段（兼容旧状态）
    itemCounts: { ...(s.itemCounts ?? {}) },
    preparedResonanceId: null,
    pendingConsumableEffects: (s.pendingConsumableEffects ?? []).map((e) => ({ ...e })),
    resonanceUseHistory: (s.resonanceUseHistory ?? []).map((r) => ({ ...r })),
    divineVisitCount: s.divineVisitCount ?? 0,
    divineAttentionCumulative: s.divineAttentionCumulative ?? 0,
    divineGiftsOwned: [...(s.divineGiftsOwned ?? [])],
    divineGiftHistory: (s.divineGiftHistory ?? []).map((r) => ({ ...r })),
    lastDivineGiftHint: s.lastDivineGiftHint ?? null,
    michaelSlayClaimed: s.michaelSlayClaimed ?? false,
    luciferAwakenClaimed: s.luciferAwakenClaimed ?? false,
    hiddenTopicIds: [...(s.hiddenTopicIds ?? [])],
  };
}

/** 构造带时段推进与成就检查的统一响应 */
function buildResponse(
  state: EdenWorldState,
  narration: string | null,
  discoveredClueTitles?: string[],
): ToolResponseBody {
  // 场景互动/移动可能解锁印记
  checkAndUnlockAchievements(state);

  // 检查累计注视是否达到下一次三选一阈值，若是则返回候选（前端弹出三选一）
  const divineGiftChoice = shouldTriggerGiftChoice(state)
    ? rollGiftChoices(state.divineGiftsOwned)
    : null;

  const slotResult = maybeAdvanceSlotAfterAction(state);
  return {
    ok: true,
    state,
    narration,
    discoveredClueTitles,
    slotNarrations: slotResult.slotNarrations.length > 0 ? slotResult.slotNarrations : undefined,
    unlockedAchievements: state.unlockedAchievementIds.length > 0
      ? state.unlockedAchievementIds.map((id) => id)
      : undefined,
    divineGiftChoice: divineGiftChoice ?? undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ToolRequestBody;
    const { tool, args } = body;
    const state = withNpcWorldDefaults(cloneWorldState(body.state));

    // 已结束状态拒绝一切工具
    if (state.isEnded) {
      return NextResponse.json({
        ok: false,
        state,
        narration: null,
        reason: "园中已归于寂静。",
      } satisfies ToolResponseBody);
    }

    // ============================================================
    // end_slot：主动结束时段（玩家点击"进入下一轮"）
    // ============================================================
    if (tool === "end_slot") {
      state.preparedResonanceId = null;

      // 直接推进时段（消耗剩余 AP 并推进到下一时段）
      consumeActionPoints(state, state.actionPoints);
      const slotResult = advanceToNextSlot(state);
      if (slotResult.triggeredTimeFailure) {
        return NextResponse.json({
          ok: true,
          state,
          narration: slotResult.slotNarrations[0] ?? "第十二个时段过去了。",
          slotNarrations: slotResult.slotNarrations,
          unlockedAchievements: state.unlockedAchievementIds.length > 0
            ? state.unlockedAchievementIds.map((id) => id)
            : undefined,
        } satisfies ToolResponseBody);
      }
      return NextResponse.json({
        ok: true,
        state,
        narration: slotResult.slotNarrations.length > 0
          ? slotResult.slotNarrations.join(" ")
          : "时段过去了。园中的风变了方向，新的时段开始了。",
        slotNarrations: slotResult.slotNarrations.length > 0 ? slotResult.slotNarrations : undefined,
        unlockedAchievements: state.unlockedAchievementIds.length > 0
          ? state.unlockedAchievementIds.map((id) => id)
          : undefined,
      } satisfies ToolResponseBody);
    }

    // ============================================================
    // 回响使用（不消耗 AP）；准备/取消准备仅为旧请求兼容
    // ============================================================
    if (tool === "prepare_resonance") {
      return NextResponse.json({
        ok: false,
        state,
        narration: null,
        reason: "回响现在无需准备，请直接使用。",
      } satisfies ToolResponseBody);
    }

    if (tool === "cancel_prepared_resonance") {
      state.preparedResonanceId = null;
      return NextResponse.json({
        ok: true,
        state,
        narration: "你松开了旧的准备状态。现在回响会在使用后等待匹配行动生效。",
      } satisfies ToolResponseBody);
    }

    if (tool === "use_resonance") {
      const item = getItemById(args.itemId!);
      if (!item) {
        return NextResponse.json({ ok: false, state, narration: null, reason: "未知回响" } satisfies ToolResponseBody);
      }
      if (item.kind === "consumable") {
        const result = executeConsumableResonance(state, args.itemId!);
        checkAndUnlockAchievements(state);
        return NextResponse.json({
          ok: result.allowed,
          state,
          narration: result.narration ?? null,
          reason: result.reason,
          unlockedAchievements: state.unlockedAchievementIds.length > 0
            ? state.unlockedAchievementIds.map((id) => id)
            : undefined,
        } satisfies ToolResponseBody);
      }
      if (item.kind === "passive") {
        return NextResponse.json({
          ok: false,
          state,
          narration: null,
          reason: "这段回响会自动生效，不需要主动使用。",
        } satisfies ToolResponseBody);
      }
      const result = executeInstantResonance(state, args.itemId!);
      checkAndUnlockAchievements(state);
      return NextResponse.json({
        ok: result.allowed,
        state,
        narration: result.narration ?? null,
        reason: result.reason,
        unlockedAchievements: state.unlockedAchievementIds.length > 0
          ? state.unlockedAchievementIds.map((id) => id)
          : undefined,
      } satisfies ToolResponseBody);
    }

    // ============================================================
    // 神明献礼三选一：玩家选定一个献礼
    // ============================================================
    if (tool === "claim_divine_gift") {
      const giftId = args.itemId as DivineGiftId;
      if (!giftId || !DIVINE_GIFT_POOL.includes(giftId)) {
        return NextResponse.json({ ok: false, state, narration: null, reason: "没有这样的献礼" } satisfies ToolResponseBody);
      }
      const result = claimDivineGift(state, giftId);
      checkAndUnlockAchievements(state);
      return NextResponse.json({
        ok: true,
        state,
        narration: `${result.giftName}：你收下了这份来自神的礼物。`,
        divineGift: { giftId: result.giftId, giftName: result.giftName, narration: result.narration },
        unlockedAchievements: state.unlockedAchievementIds.length > 0
          ? state.unlockedAchievementIds.map((id) => id)
          : undefined,
      } satisfies ToolResponseBody);
    }

    // ============================================================
    // scene_action：显式场景互动
    // ============================================================
    if (tool === "scene_action") {
      const actionId = args.sceneActionId;
      if (!actionId) {
        return NextResponse.json({ ok: false, state, narration: null, reason: "未指定场景动作" } satisfies ToolResponseBody);
      }
      const action = getSceneActionById(actionId);
      if (!action) {
        return NextResponse.json({ ok: false, state, narration: null, reason: "未知的场景动作" } satisfies ToolResponseBody);
      }
      // 共享可用性校验：地点/昼夜/时段/NPC同场/好感/同一时段去重/oncePerGame 全部在此判定，
      // 与前端 getSceneActionsByLocation(state) 共用 isSceneActionAvailable，避免两套条件漂移。
      if (!isSceneActionAvailable(action, state)) {
        return NextResponse.json({ ok: false, state, narration: null, reason: "此刻无法进行这个动作" } satisfies ToolResponseBody);
      }
      const sceneHasFreeAp = hasPendingFreeApForAction(state, "scene_action");
      if (!canAffordAction(state, sceneHasFreeAp ? 0 : AP_COST_SCENE_ACTION)) {
        return NextResponse.json({
          ok: false,
          state,
          narration: null,
          reason: "这一时段的行动已用尽。",
        } satisfies ToolResponseBody);
      }

      const sceneResonanceEffect = applyPendingConsumableToSceneAction(state);
      const sceneCost = sceneResonanceEffect.freeApCost ? 0 : AP_COST_SCENE_ACTION;

      // UI 内部完成显式对象反馈后，只向规则层提交一次完整互动。
      consumeActionPoints(state, sceneCost);

      // 记录完成，发放奖励
      recordSceneActionThisSlot(state, actionId);

      const newlyDiscoveredTitles: string[] = [];
      if (action.rewards.clueIds) {
        for (const cid of action.rewards.clueIds) {
          if (!state.discoveredClues.includes(cid)) {
            state.discoveredClues.push(cid);
            newlyDiscoveredTitles.push(cid);
          }
        }
      }
      if (action.rewards.itemIds) {
        for (const itemId of action.rewards.itemIds) {
          grantWorldItem(state, itemId);
        }
      }

      // 河声入耳：获得第一条地点线索后解锁
      checkAndUnlockAchievements(state);

      const narration = `${sceneResonanceEffect.narrations.join(" ")} ${action.rewards.narration}`.trim();
      const resp = buildResponse(state, narration, newlyDiscoveredTitles.length > 0 ? newlyDiscoveredTitles : undefined);
      return NextResponse.json({ ...resp, resonanceNarration: sceneResonanceEffect.narrations.join(" ") || undefined } satisfies ToolResponseBody);
    }

    // ============================================================
    // 通用工具：move_to_location / observe_location / speak_to_npc
    // 这些都消耗 1 AP（移动/观察/对话）
    // ============================================================
    const apCost = AP_COST_MOVE;
    const generalActionFree =
      (tool === "move_to_location" && (hasPendingFreeApForAction(state, "move") || hasPassiveLightStepForMove(state)));
    if (!canAffordAction(state, generalActionFree ? 0 : apCost)) {
      return NextResponse.json({
        ok: false,
        state,
        narration: null,
        reason: "这一时段的行动已用尽。结束时段后，新的时段会恢复行动。",
      } satisfies ToolResponseBody);
    }

    // ---- 玩家移动：move_to_location（蛇自身移动，caller="serpent"） ----
    if (tool === "move_to_location") {
      const target = args.locationId;
      if (!target) {
        return NextResponse.json({ ok: false, state, narration: null, reason: "未指定地点" } satisfies ToolResponseBody);
      }
      if (!EDEN_LOCATIONS[target]) {
        return NextResponse.json({ ok: false, state, narration: null, reason: "地点不存在" } satisfies ToolResponseBody);
      }

      const toolCall: WorldToolCall = {
        name: "move_to_location",
        caller: "serpent",
        args: { locationId: target },
        reason: "蛇前往新地点",
      };

      const validation = validateWorldToolCall(state, toolCall);

      // 月光道标（绕行次数池）：每时段可无视绕行 1~2 次（持有 1 枚=1 次，2 枚=2 次）。
      // 仅解除非相邻限制，不免行动点（AP 仍由下方免费移动池/消耗规则处理）。
      const isNotConnected = !EDEN_LOCATIONS[state.locationId].connections.includes(target);
      const connectionRejected = !validation.allowed &&
        validation.reason === "那里不与当前位置相连，无法直接前往";
      const usingDetourBypass = isNotConnected && connectionRejected && tryConsumeFreeDetourBypass(state);

      if (usingDetourBypass) {
        state.resonanceUseHistory.push({
          timeSlot: state.timeSlot,
          itemId: "moonlight_path_marker",
          actionKind: "move",
          targetId: target,
          result: "月光道标让蛇直接走向非相邻地点",
        });
        // 替换为月光叙事
        toolCall.reason = "蛇借月光道标走捷径";
      } else if (!validation.allowed) {
        return NextResponse.json({
          ok: false,
          state,
          narration: null,
          reason: validation.reason ?? "无法前往该地点。",
        } satisfies ToolResponseBody);
      }

      const consumableMoveEffect = applyPendingConsumableToMove(state);
      // 轻步印记：仅记录使用历史与叙事，免费判定统一交由"免费次数池"（避免双重计数）
      const passiveMoveEffect = applyPassiveLightStepToMove(state);
      // 统一免费次数池：无羁之步 / 轻步印记 / 昼荫轻步 / 晨流回环（白天）各贡献 1 次
      // consumable 已免单时不再消耗永久次数池，避免 consumable + 永久次数双重消耗
      const usedFreeCharge = consumableMoveEffect.freeApCost ? false : tryConsumeFreeMove(state);
      const moveCost =
        (consumableMoveEffect.freeApCost || usedFreeCharge) ? 0 : apCost;

      consumeActionPoints(state, moveCost);

      // 晨流回环：本时段第一次消耗永久免费次数的白天移动，额外恢复 1 行动点（不超上限，每时段一次）
      // 绑定 usedFreeCharge 而非"任意首移"，确保免费+恢复绑定在同一动作上（consumable 免单时延后到下一次）
      let morningFlowNarration: string | null = null;
      if (
        usedFreeCharge &&
        state.inventory.includes("resonance_morning_flow") &&
        state.timeOfDay === "day" &&
        !state.morningFlowRestoredThisSlot
      ) {
        state.morningFlowRestoredThisSlot = true;
        const before = state.actionPoints;
        state.actionPoints = Math.min(getEffectiveMaxActionPoints(state), state.actionPoints + 1);
        if (state.actionPoints > before) {
          morningFlowNarration = "晨流回环的力量在你脚下回转，你恢复了 1 点行动点。";
        }
      }

      const result = executeWorldTool(state, toolCall);

      const moveResonanceNarrations = [
        ...consumableMoveEffect.narrations,
        passiveMoveEffect.narration,
        ...(morningFlowNarration ? [morningFlowNarration] : []),
      ].filter((n): n is string => Boolean(n));
      const moveNarration = moveResonanceNarrations.length > 0
        ? `${moveResonanceNarrations.join(" ")} ${result.narration ?? ""}`.trim()
        : result.narration;
      const resp = buildResponse(state, moveNarration, result.discoveredClueTitles);
      return NextResponse.json({ ...resp, resonanceNarration: moveResonanceNarrations.join(" ") || undefined } satisfies ToolResponseBody);
    }

    // ---- 观察地点：observe_location（蛇观察当前地点，caller="serpent"） ----
    if (tool === "observe_location") {
      const target = args.locationId ?? state.locationId;
      if (!EDEN_LOCATIONS[target]) {
        return NextResponse.json({ ok: false, state, narration: null, reason: "地点不存在" } satisfies ToolResponseBody);
      }

      const toolCall: WorldToolCall = {
        name: "observe_location",
        caller: "serpent",
        args: { locationId: target },
        reason: "蛇观察此地",
      };

      const validation = validateWorldToolCall(state, toolCall);
      if (!validation.allowed) {
        return NextResponse.json({
          ok: false,
          state,
          narration: null,
          reason: validation.reason ?? "无法观察该地点。",
        } satisfies ToolResponseBody);
      }

      consumeActionPoints(state, apCost);
      const result = executeWorldTool(state, toolCall);
      const resp = buildResponse(state, result.narration, result.discoveredClueTitles);
      return NextResponse.json(resp satisfies ToolResponseBody);
    }

    // ---- NPC 之间对话：speak_to_npc ----
    if (tool === "speak_to_npc") {
      const caller = args.actorId;
      const target = args.targetNpcId;
      if (!caller || !target) {
        return NextResponse.json({ ok: false, state, narration: null, reason: "未指定对话双方" } satisfies ToolResponseBody);
      }

      const toolCall: WorldToolCall = {
        name: "speak_to_npc",
        caller,
        args: { actorId: caller, targetNpcId: target, topicId: args.topicId },
        reason: `${caller} 与 ${target} 对话`,
      };

      const validation = validateWorldToolCall(state, toolCall);
      if (!validation.allowed) {
        return NextResponse.json({
          ok: false,
          state,
          narration: null,
          reason: validation.reason ?? "他们无法在此对话。",
        } satisfies ToolResponseBody);
      }

      consumeActionPoints(state, apCost);
      const result = executeWorldTool(state, toolCall);
      // NPC 对话可能解锁"园中对谈"印记
      checkAndUnlockAchievements(state);
      const resp = buildResponse(state, result.narration);
      return NextResponse.json(resp satisfies ToolResponseBody);
    }

    // ---- 禁忌动作链不可通过本端点直接调用 ----
    if (tool === "look_at_tree" || tool === "approach_tree" || tool === "touch_fruit" || tool === "eat_fruit") {
      return NextResponse.json({
        ok: false,
        state,
        narration: null,
        reason: "那不是你能直接做的事。她要自己走向那棵树。",
      } satisfies ToolResponseBody);
    }

    return NextResponse.json({
      ok: false,
      state,
      narration: null,
      reason: `不支持的通用工具: ${tool}`,
    } satisfies ToolResponseBody);
  } catch (err: unknown) {
    console.error(
      "[api/world/tool] Unhandled error:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { ok: false, state: null, narration: null, reason: "园中起了风，请稍后再试。" } satisfies ToolResponseBody,
      { status: 500 },
    );
  }
}
