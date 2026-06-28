// ============================================================
// 第一章通用工具执行 API 路由
//
// 处理玩家通过 UI 主动触发的动作：
// - move_to_location：玩家（蛇）移动到相邻地点
// - observe_location：观察当前地点
// - scene_action：场景互动（循水声 / 贴近石痕 …）
// - carry_words：鸽子传话
// - judge_whisper_style：狐狸评价话术
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
} from "@/game/world/types";
import { validateWorldToolCall } from "@/game/world/toolRules";
import { executeWorldTool } from "@/game/world/worldActions";
import { EDEN_LOCATIONS } from "@/content/world/locations";
import {
  getSceneActionById,
  getSceneActionsByLocation,
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
} from "@/game/world/actionPointRules";
import { checkAndUnlockAchievements } from "@/game/world/achievementRules";
import { triggerDivineGiftIfFull } from "@/game/world/divineGiftRules";
import {
  prepareResonance,
  cancelPreparedResonance,
  executeInstantResonance,
  executeConsumableResonance,
  applyPreparedResonanceToAction,
  consumePreparedResonanceAfterAction,
  applyPendingConsumableToMove,
} from "@/game/world/resonanceRules";
import { getItemById } from "@/content/world/items";

type ToolRequestBody = {
  tool: WorldToolName | "scene_action" | "end_slot" | "prepare_resonance" | "cancel_prepared_resonance" | "use_resonance";
  state: EdenWorldState;
  args: {
    locationId?: EdenLocationId;
    targetNpcId?: EdenNpcId;
    actorId?: EdenNpcId;
    topicId?: string;
    focus?: string;
    /** 场景互动 ID */
    sceneActionId?: string;
    /** 回响 ID（用于准备/使用） */
    itemId?: string;
    /** 渐进点击序号（1-based），用于多击场景互动 */
    clickIndex?: number;
    /** 渐进点击所需总次数 */
    requiredClicks?: number;
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
  /** 神明献礼（神的注视满 4 时触发） */
  divineGift?: {
    giftId: string;
    giftName: string;
    narration: string;
    hint?: string;
  };
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
    lastInputTag: s.lastInputTag ?? null,
    calmWhisperStreak: s.calmWhisperStreak ?? 0,
    // Chapter 1 新增字段（兼容旧状态）
    itemCounts: { ...(s.itemCounts ?? {}) },
    preparedResonanceId: s.preparedResonanceId ?? null,
    pendingConsumableEffects: (s.pendingConsumableEffects ?? []).map((e) => ({ ...e })),
    resonanceUseHistory: (s.resonanceUseHistory ?? []).map((r) => ({ ...r })),
    divineVisitCount: s.divineVisitCount ?? 0,
    divineGiftHistory: (s.divineGiftHistory ?? []).map((r) => ({ ...r })),
    lastDivineGiftHint: s.lastDivineGiftHint ?? null,
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

  // 检查神的注视是否满 4，若满则触发神明献礼（不触发失败）
  const divineGift = triggerDivineGiftIfFull(state);

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
    divineGift: divineGift ?? undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ToolRequestBody;
    const { tool, args } = body;
    const state = cloneWorldState(body.state);

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
      // 取消准备的回响（不消耗道具）
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
    // 回响准备 / 取消准备 / 即时使用（不消耗 AP）
    // ============================================================
    if (tool === "prepare_resonance") {
      const result = prepareResonance(state, args.itemId!);
      return NextResponse.json({
        ok: result.allowed,
        state,
        narration: result.allowed ? "这段回响已被你握住，等待下一次合适的行动。" : null,
        reason: result.reason,
      } satisfies ToolResponseBody);
    }

    if (tool === "cancel_prepared_resonance") {
      cancelPreparedResonance(state);
      return NextResponse.json({
        ok: true,
        state,
        narration: "你松开了这段回响。它仍留在园中回响里。",
      } satisfies ToolResponseBody);
    }

    if (tool === "use_resonance") {
      const item = getItemById(args.itemId!);
      if (!item) {
        return NextResponse.json({ ok: false, state, narration: null, reason: "未知回响" } satisfies ToolResponseBody);
      }
      if (item.kind === "consumable") {
        const result = executeConsumableResonance(state, args.itemId!);
        return NextResponse.json({
          ok: result.allowed,
          state,
          narration: result.narration ?? null,
          reason: result.reason,
        } satisfies ToolResponseBody);
      }
      const result = executeInstantResonance(state, args.itemId!);
      return NextResponse.json({
        ok: result.allowed,
        state,
        narration: result.narration ?? null,
        reason: result.reason,
      } satisfies ToolResponseBody);
    }

    // ============================================================
    // scene_action：场景互动（循水声 / 贴近石痕 …）
    // 支持渐进式点击：每次点击消耗 1 AP，达到 requiredClicks 后才发放奖励
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
      // 必须在当前地点
      if (action.locationId !== state.locationId) {
        return NextResponse.json({ ok: false, state, narration: null, reason: "不在该地点，无法进行" } satisfies ToolResponseBody);
      }
      // 校验时段可用性
      const available = getSceneActionsByLocation(
        state.locationId,
        state.timeOfDay,
        state.timeSlot,
        state.divineAttention,
      ).some((a) => a.id === actionId);
      if (!available) {
        return NextResponse.json({ ok: false, state, narration: null, reason: "此刻无法进行这个动作" } satisfies ToolResponseBody);
      }
      // 同一时段同一场景动作不重复（已完成的不再接受点击）
      if (state.actionsThisSlot.sceneActionIds.includes(actionId)) {
        return NextResponse.json({ ok: false, state, narration: null, reason: "这一时段你已经做过这件事了" } satisfies ToolResponseBody);
      }
      // AP 校验
      if (!canAffordAction(state, AP_COST_SCENE_ACTION)) {
        return NextResponse.json({
          ok: false,
          state,
          narration: null,
          reason: "这一时段的行动已用尽。",
        } satisfies ToolResponseBody);
      }

      // 渐进式点击：每次点击消耗 1 AP
      const requiredClicks: number = typeof args.clickIndex === "number" ? (args.requiredClicks as number ?? 1) : 1;
      const clickIndex: number = typeof args.clickIndex === "number" ? (args.clickIndex as number) : 1;
      const isFinalClick = clickIndex >= requiredClicks;

      // 检查准备的回响是否匹配场景互动
      const resonanceEffect = applyPreparedResonanceToAction(state, {
        actionKind: "scene_action",
        locationId: state.locationId,
      });
      const sceneCost = resonanceEffect.freeApCost ? 0 : AP_COST_SCENE_ACTION;

      // 消耗 AP（每次点击都消耗）
      consumeActionPoints(state, sceneCost);

      // 中间点击：只消耗 AP，返回进度提示
      if (!isFinalClick) {
        const resp = buildResponse(
          state,
          `${action.label}亮起了一些（${clickIndex}/${requiredClicks}）。`,
        );
        return NextResponse.json({ ...resp, resonanceNarration: undefined } satisfies ToolResponseBody);
      }

      // 最终点击：记录完成，发放奖励
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

      // 消耗准备的回响（如果匹配场景互动）
      consumePreparedResonanceAfterAction(state, {
        actionKind: "scene_action",
        locationId: state.locationId,
      }, resonanceEffect.narration ?? action.rewards.narration);

      // 河声入耳：获得第一条地点线索后解锁
      checkAndUnlockAchievements(state);

      const resp = buildResponse(state, action.rewards.narration, newlyDiscoveredTitles.length > 0 ? newlyDiscoveredTitles : undefined);
      return NextResponse.json(resp satisfies ToolResponseBody);
    }

    // ============================================================
    // 通用工具：move_to_location / observe_location / speak_to_npc / carry_words / judge_whisper_style
    // 这些都消耗 1 AP（移动/观察/传话/评价）
    // ============================================================
    const apCost = AP_COST_MOVE;
    if (!canAffordAction(state, apCost)) {
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

      // 月光道标：持有者可绕过邻接限制直接到达任意地点
      const hasMoonlightPath = (state.itemCounts["moonlight_path_marker"] ?? 0) > 0;
      const isNotConnected = !EDEN_LOCATIONS[state.locationId].connections.includes(target);
      const connectionRejected = !validation.allowed &&
        validation.reason === "那里不与当前位置相连，无法直接前往";
      const usingMoonlightPath = hasMoonlightPath && isNotConnected && connectionRejected;

      if (usingMoonlightPath) {
        // 消耗一枚月光道标并允许移动
        state.itemCounts["moonlight_path_marker"] -= 1;
        if (!state.usedItemIds.includes("moonlight_path_marker")) {
          state.usedItemIds.push("moonlight_path_marker");
        }
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

      // 检查准备的回响是否匹配移动
      const resonanceEffect = applyPreparedResonanceToAction(state, {
        actionKind: "move",
        locationId: target,
      });
      // 检查待生效的消耗品效果（移动类）
      const consumableMoveEffect = applyPendingConsumableToMove(state);
      const moveCost = (resonanceEffect.freeApCost || consumableMoveEffect.freeApCost) ? 0 : apCost;

      consumeActionPoints(state, moveCost);
      const result = executeWorldTool(state, toolCall);

      // 消耗准备的回响（如果匹配）
      consumePreparedResonanceAfterAction(state, {
        actionKind: "move",
        locationId: target,
      }, result.narration ?? "");

      const moveNarration = consumableMoveEffect.narrations.length > 0
        ? `${consumableMoveEffect.narrations.join(" ")} ${result.narration ?? ""}`
        : result.narration;
      const resp = buildResponse(state, moveNarration, result.discoveredClueTitles);
      return NextResponse.json(resp satisfies ToolResponseBody);
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

    // ---- 鸽子传话：carry_words（由 dove 触发）----
    if (tool === "carry_words") {
      const caller = args.actorId ?? "dove";
      if (caller !== "dove") {
        return NextResponse.json({
          ok: false,
          state,
          narration: null,
          reason: "只有鸽子可以传话",
        } satisfies ToolResponseBody);
      }

      const toolCall: WorldToolCall = {
        name: "carry_words",
        caller: "dove",
        args: { actorId: "dove", focus: args.focus },
        reason: "鸽子传话",
      };

      const validation = validateWorldToolCall(state, toolCall);
      if (!validation.allowed) {
        return NextResponse.json({
          ok: false,
          state,
          narration: null,
          reason: validation.reason ?? "鸽子无法传话。",
        } satisfies ToolResponseBody);
      }

      consumeActionPoints(state, apCost);
      const result = executeWorldTool(state, toolCall);
      // 鸽子传话解锁"借翼传言"
      checkAndUnlockAchievements(state);
      const resp = buildResponse(state, result.narration);
      return NextResponse.json(resp satisfies ToolResponseBody);
    }

    // ---- 狐狸评价话术：judge_whisper_style ----
    if (tool === "judge_whisper_style") {
      const caller: string = args.actorId ?? "fox";
      if (caller !== "fox" && caller !== "serpent") {
        return NextResponse.json({
          ok: false,
          state,
          narration: null,
          reason: "只有狐狸可以评价话术",
        } satisfies ToolResponseBody);
      }

      const toolCall: WorldToolCall = {
        name: "judge_whisper_style",
        caller: caller as "fox" | "serpent",
        args: { actorId: caller, focus: args.focus },
        reason: "狐狸评价话术",
      };

      const validation = validateWorldToolCall(state, toolCall);
      if (!validation.allowed) {
        return NextResponse.json({
          ok: false,
          state,
          narration: null,
          reason: validation.reason ?? "狐狸无法评价话术。",
        } satisfies ToolResponseBody);
      }

      consumeActionPoints(state, apCost);
      const result = executeWorldTool(state, toolCall);
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
