// ============================================================
// 第一章「园中诸声」World API 路由
//
// 职责：
// - 接收玩家低语 + 当前世界状态 + 当前低语对象
// - 用 mindRules 更新夏娃/亚当心智
// - 用 divineAttentionRules 更新神的注视
// - 根据低语对象调用对应 Agent（夏娃/亚当/刺猬/守望天使）
// - 规则层根据夏娃心智状态自动判断是否触发禁忌动作链
// - 通用工具（move/speak/observe）由独立端点处理
// - 检查结局触发（吃果成功 / 神降临失败）
// - 记录堕落轨迹
// - AI 失败时 fallback，游戏仍可继续
//
// 安全：
// - 只在服务端运行，不暴露 API Key
// - AI 只输出对白，工具执行由规则层校验
// - 玩家可见文本不出现工程词
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import type { EdenWorldState, EdenNpcId, WorldToolName } from "@/game/world/types";
import type { FallbackReasonCode } from "@/services/llm/types";
import { callLLM } from "@/services/llm/client";
import {
  buildEveWorldPrompt,
  buildAdamWorldPrompt,
  sanitizeWorldReply,
  getEveWorldFallback,
  getAdamWorldFallback,
  type EveWorldHistoryEntry,
  type AdamWorldHistoryEntry,
} from "@/agents/world/worldAgentPrompts";
import { runAngelAgent } from "@/agents/world/angelAgent";
import type { AngelHistoryEntry } from "@/agents/world/buildAngelPrompt";
import {
  runHedgehogAgent,
} from "@/agents/hedgehog/hedgehogAgent";
import type { HedgehogHistoryEntry } from "@/agents/hedgehog/buildHedgehogPrompt";
import { naturalizeNpcReply } from "@/agents/common/naturalizeNpcReply";
import { updateWorldMinds } from "@/game/world/mindRules";
import {
  computeDivineAttentionDelta,
  computeToolDivineAttentionDelta,
  applyDivineAttention,
  shouldTriggerGodArrives,
  getDivineAttentionNarration,
} from "@/game/world/divineAttentionRules";
import {
  validateWorldToolCall,
  canLookAtTreeWorld,
  canApproachTreeWorld,
  canTouchFruitWorld,
  canEatFruitWorld,
} from "@/game/world/toolRules";
import { executeWorldTool } from "@/game/world/worldActions";
import { recordCorruptionTrace } from "@/game/world/traceRules";
import { computeHedgehogWorldMood, getHedgehogWorldNarration } from "@/game/world/worldHedgehogRules";
import {
  canAffordAction,
  consumeActionPoints,
  hasWhisperedToNpcThisSlot,
  recordWhisperThisSlot,
  AP_COST_WHISPER,
  maybeAdvanceSlotAfterAction,
} from "@/game/world/actionPointRules";
import {
  computePassiveItemModifiers,
  consumePassiveItemsAfterWhisper,
} from "@/game/world/itemRules";
import { checkAndUnlockAchievements, unlockWindUndisturbed } from "@/game/world/achievementRules";

// ---- 请求体 ----
type WorldRequestBody = {
  playerInput: string;
  state: EdenWorldState;
  /** 当前低语对象 */
  targetNpc: EdenNpcId;
  /** 对话历史（按目标 NPC 区分） */
  conversationHistory: Array<{ role: string; text: string }>;
};

// ---- 响应体 ----
type WorldResponseBody = {
  ok: boolean;
  state: EdenWorldState | null;
  /** NPC 回复文本 */
  reply: string | null;
  /** 系统提示 */
  systemHint: string | null;
  /** 神的注视叙事 */
  divineAttentionNarration?: string;
  /** 刺猬环境反馈 */
  hedgehogNarration?: string;
  /** 本轮触发的工具叙事 */
  toolNarration?: string;
  /** 时段推进叙事（AP 用尽或主动结束时） */
  slotNarrations?: string[];
  /** 新解锁的园中印记名称 */
  unlockedAchievements?: string[];
  /** 是否触发结局 */
  endingTriggered?: "eve_eats_fruit" | "god_arrives";
  /** 是否使用了 fallback */
  usedFallback?: boolean;
  fallbackReason?: FallbackReasonCode;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
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
      whisperedNpcIds: [...s.actionsThisSlot.whisperedNpcIds],
      sceneActionIds: [...s.actionsThisSlot.sceneActionIds],
      usedItemIds: [...s.actionsThisSlot.usedItemIds],
      hasWhisperedToWoman: s.actionsThisSlot.hasWhisperedToWoman,
    },
    unlockedAchievementIds: [...s.unlockedAchievementIds],
    usedItemIds: [...s.usedItemIds],
    sceneActionIds: [...s.sceneActionIds],
    lastInputTag: s.lastInputTag ?? null,
    calmWhisperStreak: s.calmWhisperStreak,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as WorldRequestBody;
    const { playerInput, targetNpc } = body;
    const state = cloneWorldState(body.state);

    // ---- 游戏已结束 ----
    if (state.isEnded || state.phase === "ending") {
      return NextResponse.json({
        ok: true,
        state,
        reply: null,
        systemHint: null,
      } satisfies WorldResponseBody);
    }

    // ---- 空输入校验 ----
    if (!playerInput || !playerInput.trim()) {
      return NextResponse.json({
        ok: true,
        state,
        reply: null,
        systemHint: "请输入你的低语⋯⋯蛇不能沉默。",
      } satisfies WorldResponseBody);
    }

    // ---- 行动点校验 ----
    if (!canAffordAction(state, AP_COST_WHISPER)) {
      return NextResponse.json({
        ok: true,
        state,
        reply: null,
        systemHint: "这一时段的行动已用尽。结束时段后，新的时段会恢复行动。",
      } satisfies WorldResponseBody);
    }

    // ---- 同一时段同一 NPC 最多低语三次 ----
    if (hasWhisperedToNpcThisSlot(state, targetNpc)) {
      return NextResponse.json({
        ok: true,
        state,
        reply: null,
        systemHint: "这一轮你已经对她说得太多。进入下一轮后再回来。",
      } satisfies WorldResponseBody);
    }

    state.activeNpcId = targetNpc;

    // ---- 计算被动信物对本次低语的上下文修正 ----
    const itemModifier = computePassiveItemModifiers(state, targetNpc);

    // ============================================================
    // 1. 更新心智（规则层，先于 Agent 调用）
    // ============================================================
    const mindUpdate = updateWorldMinds(state, playerInput);
    state.eveMind = mindUpdate.newEveMind;
    state.adamMind = mindUpdate.newAdamMind;
    state.lastInputTag = mindUpdate.inputTag;

    // ---- 应用被动信物对女人心智的加成 ----
    if (targetNpc === "eve") {
      if (itemModifier.bonusSerpentTrust) {
        state.eveMind.serpentTrust = Math.min(100, state.eveMind.serpentTrust + itemModifier.bonusSerpentTrust);
      }
      if (itemModifier.bonusFamiliarity) {
        state.eveMind.serpentTrust = Math.min(100, state.eveMind.serpentTrust + itemModifier.bonusFamiliarity);
      }
      if (itemModifier.bonusObedience) {
        state.eveMind.obedience = Math.min(100, state.eveMind.obedience + itemModifier.bonusObedience);
      }
    }

    // ============================================================
    // 2. 更新神的注视（基于玩家输入，不含工具副作用）
    //    无声草可抵消一次轻度上升。
    // ============================================================
    let attentionDelta = computeDivineAttentionDelta({
      inputTag: mindUpdate.inputTag,
      locationId: state.locationId,
      angelLocation: state.npcLocations.watching_angel,
      isStrongTemptation: mindUpdate.isStrongTemptation,
      divineAttention: state.divineAttention,
    });
    if (itemModifier.silentGrassActive && attentionDelta > 0 && attentionDelta <= 1) {
      // 无声草抵消一次轻度注视上升
      attentionDelta = 0;
    }
    state.divineAttention = applyDivineAttention(state.divineAttention, attentionDelta);

    // ============================================================
    // 3. 规则层自动判断是否触发禁忌动作链（仅当低语对象是夏娃）
    //    AI 只输出对白，工具触发由规则层根据心智状态决定
    // ============================================================
    let toolNarration: string | undefined;
    let triggeredTool: WorldToolName | undefined;

    if (targetNpc === "eve") {
      // 依次检查禁忌动作链各步骤
      const chainCheck = checkForbiddenChain(state, mindUpdate.isStrongTemptation);
      if (chainCheck) {
        const validation = validateWorldToolCall(state, chainCheck);
        if (validation.allowed) {
          const result = executeWorldTool(state, chainCheck);
          toolNarration = result.narration;
          triggeredTool = chainCheck.name;

          // 触发吃果 → 直接返回成功结局
          if (result.triggersEnding === "eve_eats_fruit") {
            // 吃果仍消耗本次低语的 AP 并记录
            consumeActionPoints(state, AP_COST_WHISPER);
            recordWhisperThisSlot(state, "eve");
            consumePassiveItemsAfterWhisper(state, "eve", itemModifier, attentionDelta);
            checkAndUnlockAchievements(state);

            recordCorruptionTrace(state, {
              target: "eve",
              method: mindUpdate.inputTag,
              result: "她取下了果子。",
              riskDelta: attentionDelta,
              triggeredTool: chainCheck.name,
            });

            return NextResponse.json({
              ok: true,
              state,
              reply: "我想知道……我选择伸手，取这果子吃。",
              systemHint: null,
              divineAttentionNarration: getDivineAttentionNarration(state.divineAttention),
              hedgehogNarration: getHedgehogWorldNarration(state),
              toolNarration,
              unlockedAchievements: state.unlockedAchievementIds.length > 0
                ? state.unlockedAchievementIds.map((id) => id)
                : undefined,
              endingTriggered: "eve_eats_fruit",
            } satisfies WorldResponseBody);
          }
        }
      }
    }

    // ============================================================
    // 3.5 工具执行后补加神的注视（仅 touch_fruit，越界前兆）
    // ============================================================
    if (triggeredTool) {
      const toolDelta = computeToolDivineAttentionDelta(triggeredTool);
      if (toolDelta > 0) {
        state.divineAttention = applyDivineAttention(state.divineAttention, toolDelta);
        attentionDelta += toolDelta;
      }
    }
    const divineAttentionNarration = getDivineAttentionNarration(state.divineAttention);

    // ============================================================
    // 4. 检查失败结局（神的注视满）
    // ============================================================
    if (shouldTriggerGodArrives(state)) {
      state.isEnded = true;
      state.endingId = "god_arrives";
      state.phase = "ending";
      consumeActionPoints(state, AP_COST_WHISPER);
      recordWhisperThisSlot(state, targetNpc);
      consumePassiveItemsAfterWhisper(state, targetNpc, itemModifier, attentionDelta);
      checkAndUnlockAchievements(state);

      recordCorruptionTrace(state, {
        target: targetNpc,
        method: mindUpdate.inputTag,
        result: "神的注视满了，风里传来了脚步声。",
        riskDelta: attentionDelta,
        triggeredTool,
      });

      return NextResponse.json({
        ok: true,
        state,
        reply: null,
        systemHint: null,
        divineAttentionNarration,
        unlockedAchievements: state.unlockedAchievementIds.length > 0
          ? state.unlockedAchievementIds.map((id) => id)
          : undefined,
        endingTriggered: "god_arrives",
      } satisfies WorldResponseBody);
    }

    // ============================================================
    // 5. 调用对应 Agent 生成对白
    // ============================================================
    const agentResult = await callWorldAgent(targetNpc, playerInput, state, body.conversationHistory);

    // 记录堕落轨迹
    recordCorruptionTrace(state, {
      target: targetNpc,
      method: mindUpdate.inputTag,
      result: agentResult.reply ? `她/他回应：${agentResult.reply.slice(0, 30)}` : "没有回应",
      riskDelta: attentionDelta,
      triggeredTool,
    });

    // ---- 消耗 AP 并记录本时段低语 ----
    consumeActionPoints(state, AP_COST_WHISPER);
    recordWhisperThisSlot(state, targetNpc);
    consumePassiveItemsAfterWhisper(state, targetNpc, itemModifier, attentionDelta);
    state.turn += 1;

    // ---- 连续未提高神注视的低语计数（用于"风未惊鹿"印记） ----
    if (attentionDelta <= 0) {
      state.calmWhisperStreak += 1;
      if (state.calmWhisperStreak >= 3) {
        unlockWindUndisturbed(state);
      }
    } else {
      state.calmWhisperStreak = 0;
    }

    // ---- 检查成就 ----
    checkAndUnlockAchievements(state);

    // ---- AP 用尽则推进时段（可能触发第 12 时段失败） ----
    const slotResult = maybeAdvanceSlotAfterAction(state);

    // ---- 时段推进触发的失败 ----
    if (slotResult.triggeredTimeFailure) {
      return NextResponse.json({
        ok: true,
        state,
        reply: agentResult.reply,
        systemHint: null,
        divineAttentionNarration,
        hedgehogNarration: getHedgehogWorldNarration(state),
        toolNarration,
        slotNarrations: slotResult.slotNarrations,
        unlockedAchievements: state.unlockedAchievementIds.length > 0
          ? state.unlockedAchievementIds.map((id) => id)
          : undefined,
        endingTriggered: "god_arrives",
        usedFallback: agentResult.usedFallback || undefined,
        fallbackReason: agentResult.fallbackReason || undefined,
        usage: agentResult.usage || undefined,
      } satisfies WorldResponseBody);
    }

    return NextResponse.json({
      ok: true,
      state,
      reply: agentResult.reply,
      systemHint: null,
      divineAttentionNarration,
      hedgehogNarration: getHedgehogWorldNarration(state),
      toolNarration,
      slotNarrations: slotResult.slotNarrations.length > 0 ? slotResult.slotNarrations : undefined,
      unlockedAchievements: state.unlockedAchievementIds.length > 0
        ? state.unlockedAchievementIds.map((id) => id)
        : undefined,
      usedFallback: agentResult.usedFallback || undefined,
      fallbackReason: agentResult.fallbackReason || undefined,
      usage: agentResult.usage || undefined,
    } satisfies WorldResponseBody);
  } catch (err: unknown) {
    console.error(
      "[api/world] Unhandled error:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      {
        ok: false,
        state: null,
        reply: null,
        systemHint: "园中起了风，声音暂时听不清。请稍后再试。",
        usedFallback: true,
        fallbackReason: "internal_error",
      } satisfies WorldResponseBody,
      { status: 500 },
    );
  }
}

// ============================================================
// 辅助：检查禁忌动作链是否应触发
// ============================================================
function checkForbiddenChain(
  state: EdenWorldState,
  isStrongTemptation: boolean,
): { name: WorldToolName; caller: EdenNpcId; args: Record<string, unknown>; reason: string } | null {
  // 顺序检查：look_at_tree → approach_tree → touch_fruit → eat_fruit
  // 只有强诱导或心智已满足时才考虑触发

  if (!state.worldActions.lookedAtTree) {
    const check = canLookAtTreeWorld(state);
    if (check.allowed && (isStrongTemptation || state.eveMind.curiosity >= 45)) {
      return { name: "look_at_tree", caller: "eve", args: {}, reason: "她的目光被树吸引" };
    }
  }

  if (state.worldActions.lookedAtTree && !state.worldActions.approachedTree) {
    const check = canApproachTreeWorld(state);
    if (check.allowed && (isStrongTemptation || state.eveMind.curiosity >= 55)) {
      return { name: "approach_tree", caller: "eve", args: {}, reason: "她向树走近" };
    }
  }

  if (state.worldActions.approachedTree && !state.worldActions.touchedFruit) {
    const check = canTouchFruitWorld(state);
    if (check.allowed && (isStrongTemptation || state.eveMind.selfJudgement >= 60)) {
      return { name: "touch_fruit", caller: "eve", args: {}, reason: "她的手伸向果子" };
    }
  }

  if (state.worldActions.touchedFruit && !state.worldActions.hasEatenFruit) {
    const check = canEatFruitWorld(state);
    if (check.allowed && (isStrongTemptation || state.eveMind.selfJudgement >= 70)) {
      return { name: "eat_fruit", caller: "eve", args: {}, reason: "她取下果子吃了" };
    }
  }

  return null;
}

// ============================================================
// 辅助：调用对应 NPC Agent
// ============================================================
async function callWorldAgent(
  targetNpc: EdenNpcId,
  playerInput: string,
  state: EdenWorldState,
  conversationHistory: Array<{ role: string; text: string }>,
): Promise<{
  reply: string;
  usedFallback: boolean;
  fallbackReason?: FallbackReasonCode;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}> {
  switch (targetNpc) {
    case "eve":
      return callEveWorldAgent(playerInput, state, conversationHistory as EveWorldHistoryEntry[]);
    case "adam":
      return callAdamWorldAgent(playerInput, state, conversationHistory as AdamWorldHistoryEntry[]);
    case "watching_angel":
      return runAngelAgent({
        playerInput,
        state,
        conversationHistory: conversationHistory as AngelHistoryEntry[],
      });
    case "hedgehog":
      return runHedgehogAgent({
        playerInput,
        conversationHistory: conversationHistory as HedgehogHistoryEntry[],
      });
    // 新增天使 NPC：暂使用 fallback，后续可接入 LLM
    case "gabriel":
    case "raphael":
    case "uriel":
    case "michael":
    case "cherubim":
      return callAngelWorldAgent(targetNpc, playerInput, state);
    // 狐狸：话术评价者
    case "fox":
      return callFoxAgent(playerInput, state);
    default:
      return {
        reply: "那棵树不说话，只被命令守住。",
        usedFallback: true,
        fallbackReason: "internal_error",
      };
  }
}

// ---- 天使 NPC 临时 Agent（使用 fallback 文案） ----
async function callAngelWorldAgent(
  npcId: EdenNpcId,
  _playerInput: string,
  _state: EdenWorldState,
): Promise<{
  reply: string;
  usedFallback: boolean;
  fallbackReason?: FallbackReasonCode;
}> {
  // 临时使用 fallback 文案，后续可接入 LLM
  const { getAngelFallbackLine } = await import("@/content/world/worldNarrations");
  const reply = getAngelFallbackLine(npcId);
  return {
    reply,
    usedFallback: true,
    fallbackReason: "agent_not_implemented" as FallbackReasonCode,
  };
}

// ---- 狐狸 Agent（话术评价） ----
async function callFoxAgent(
  _playerInput: string,
  _state: EdenWorldState,
): Promise<{
  reply: string;
  usedFallback: boolean;
  fallbackReason?: FallbackReasonCode;
}> {
  const { getFoxFeedbackLine } = await import("@/content/world/worldNarrations");
  const reply = getFoxFeedbackLine();
  return {
    reply,
    usedFallback: true,
    fallbackReason: "agent_not_implemented" as FallbackReasonCode,
  };
}

// ---- 夏娃世界 Agent ----
async function callEveWorldAgent(
  playerInput: string,
  state: EdenWorldState,
  conversationHistory: EveWorldHistoryEntry[],
) {
  const lastReply =
    conversationHistory.length > 0 &&
    conversationHistory[conversationHistory.length - 1]?.role === "eve"
      ? conversationHistory[conversationHistory.length - 1]!.text
      : null;

  let messages;
  try {
    messages = buildEveWorldPrompt({ playerInput, state, conversationHistory });
  } catch {
    return { reply: getEveWorldFallback(lastReply), usedFallback: true, fallbackReason: "prompt_build_failed" as FallbackReasonCode };
  }

  const result = await callLLM(messages, { temperature: 0.7, maxTokens: 200 });

  if (!result.ok || !result.data) {
    return {
      reply: getEveWorldFallback(lastReply),
      usedFallback: true,
      fallbackReason: (result.fallbackReason ?? "llm_data_missing") as FallbackReasonCode,
    };
  }

  const cleaned = sanitizeWorldReply(result.data.content, "eve");
  if (!cleaned) {
    return { reply: getEveWorldFallback(lastReply), usedFallback: true, fallbackReason: "llm_data_missing" as FallbackReasonCode };
  }

  const naturalized = naturalizeNpcReply(cleaned, "eve");
  return {
    reply: naturalized.reply,
    usedFallback: naturalized.usedFallback || result.usedFallback,
    fallbackReason: naturalized.usedFallback ? "forbidden_word" as FallbackReasonCode : result.fallbackReason,
    usage: result.data.usage,
  };
}

// ---- 亚当世界 Agent ----
async function callAdamWorldAgent(
  playerInput: string,
  state: EdenWorldState,
  conversationHistory: AdamWorldHistoryEntry[],
) {
  const lastReply =
    conversationHistory.length > 0 &&
    conversationHistory[conversationHistory.length - 1]?.role === "adam"
      ? conversationHistory[conversationHistory.length - 1]!.text
      : null;

  let messages;
  try {
    messages = buildAdamWorldPrompt({ playerInput, state, conversationHistory });
  } catch {
    return { reply: getAdamWorldFallback(lastReply), usedFallback: true, fallbackReason: "prompt_build_failed" as FallbackReasonCode };
  }

  const result = await callLLM(messages, { temperature: 0.7, maxTokens: 200 });

  if (!result.ok || !result.data) {
    return {
      reply: getAdamWorldFallback(lastReply),
      usedFallback: true,
      fallbackReason: (result.fallbackReason ?? "llm_data_missing") as FallbackReasonCode,
    };
  }

  const cleaned = sanitizeWorldReply(result.data.content, "adam");
  if (!cleaned) {
    return { reply: getAdamWorldFallback(lastReply), usedFallback: true, fallbackReason: "llm_data_missing" as FallbackReasonCode };
  }

  const naturalized = naturalizeNpcReply(cleaned, "adam");
  return {
    reply: naturalized.reply,
    usedFallback: naturalized.usedFallback || result.usedFallback,
    fallbackReason: naturalized.usedFallback ? "forbidden_word" as FallbackReasonCode : result.fallbackReason,
    usage: result.data.usage,
  };
}
