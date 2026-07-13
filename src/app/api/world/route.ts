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
import type { EdenWorldState, EdenNpcId, EdenLocationId, WorldToolName, WorldToolCall, NpcDialogueToolResult, AngelNpcId } from "@/game/world/types";
import type { FallbackReasonCode } from "@/services/llm/types";
import { callLLM, callLLMStream } from "@/services/llm/client";
import { resolveProvider } from "@/services/llm/providers";
import {
  buildEveWorldPrompt,
  buildAdamWorldPrompt,
  sanitizeWorldReply,
  getEveWorldFallback,
  getAdamWorldFallback,
  describeAffinityForPrompt,
  type EveWorldHistoryEntry,
  type AdamWorldHistoryEntry,
  type SanitizedWorldReply,
} from "@/agents/world/worldAgentPrompts";
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
  reduceNpcObedience,
} from "@/game/world/divineAttentionRules";
import { shouldTriggerGiftChoice, rollGiftChoices } from "@/game/world/divineGiftRules";
import {
  validateWorldToolCall,
  canLookAtTreeWorld,
  canApproachTreeWorld,
  canTouchFruitWorld,
  canEatFruitWorld,
} from "@/game/world/toolRules";
import { executeWorldTool, recordFruitDirectionGuidance } from "@/game/world/worldActions";
import { recordCorruptionTrace } from "@/game/world/traceRules";
import { computeHedgehogWorldMood, getHedgehogWorldNarration } from "@/game/world/worldHedgehogRules";
import {
  canAffordAction,
  consumeActionPoints,
  hasWhisperedToNpcThisSlot,
  recordWhisperThisSlot,
  AP_COST_WHISPER,
  maybeAdvanceSlotAfterAction,
  getEffectiveMaxActionPoints,
} from "@/game/world/actionPointRules";
import {} from "@/game/world/itemRules";
import { tryConsumeFreeDialogue } from "@/game/world/freeActionRules";
import {
  bestowResonance,
  applyPendingConsumableToWhisper,
  hasPendingFreeApForAction,
  applyPassiveSoftWhisperToAttention,
} from "@/game/world/resonanceRules";
import { checkAndUnlockAchievements, unlockWindUndisturbed } from "@/game/world/achievementRules";
import { EDEN_NPCS } from "@/content/world/npcs";
import { LOCATION_NAMES } from "@/content/world/locations";
import { getItemById } from "@/content/world/items";
import { getAngelFallbackLine } from "@/content/world/worldNarrations";
import { withNpcWorldDefaults } from "@/game/world/types";
import {
  applyNpcAffinity,
  validateRelationGrant,
} from "@/game/world/npcRelationRules";
import { canTriggerMichaelSlay, canTriggerLuciferAwaken, recordLuciferBoundaryTopic } from "@/game/world/hiddenEndingRules";
import { triggerMichaelSlay, triggerLuciferAwaken } from "@/game/world/endingTriggers";
import { getNpcRelationProfile } from "@/content/world/npcRelations";
import { selectNpcGuide, markGuideShown, getGuideFallback } from "@/game/world/npcGuideRules";
import {
  openAngelChallengeIfEligible,
  evaluateAngelChallenge,
  isChallengeAsked,
  markChallengePassed,
} from "@/game/world/npcChallengeRules";
import { getNpcChallengeConfig } from "@/content/world/npcChallenges";
import {
  isAngel,
  canAngelUnderstandPlayer,
  ensureLanguageState,
  triggerAngelLanguagePunishment,
  getLanguageFallbackLine,
  getNpcEffectiveLanguage,
  isReplyInExpectedLanguage,
} from "@/game/world/npcLanguageRules";
import { getAngelLanguageConfig } from "@/content/world/npcLanguages";

/** 将心智值钳制在 0-100 范围内 */
function clampMind(value: number): number {
  return Math.max(0, Math.min(100, value));
}

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
  /** NPC 对话后工具执行结果（新增） */
  toolResult?: NpcDialogueToolResult | null;
  /** 时段推进叙事（AP 用尽或主动结束时） */
  slotNarrations?: string[];
  /** 新解锁的园中印记名称 */
  unlockedAchievements?: string[];
  /** 是否触发结局 */
  endingTriggered?: "eve_eats_fruit" | "god_arrives" | "michael_slay" | "lucifer_awaken";
  /** 是否使用了 fallback */
  usedFallback?: boolean;
  fallbackReason?: FallbackReasonCode;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  /** 神明献礼（玩家三选一选定后返回，用于提示） */
  divineGift?: {
    giftId: string;
    giftName: string;
    narration: string;
    hint?: string;
  };
  /** 神明献礼三选一候选（累计注视达阈值时出现，等待玩家选定） */
  divineGiftChoice?: string[];
  /** 获得回响（天使回响） */
  resonanceGained?: {
    itemId: string;
    title: string;
    narration: string;
  } | null;
  /** 言语分裂惩罚（天使赠礼后触发） */
  languagePunishment?: {
    angelId: string;
    displayName: string;
    narration: string;
  } | null;
  /** 好感/关系变化的自然反馈（不显示数值） */
  npcFeedback?: string | null;
  /** 任务 6：跨场景低语扣除目标敬畏的实际值（仅跨场景时 > 0） */
  aweReduction?: number;
};

// ---- 流式 Agent 结果（在普通 AgentResult 上附加逐字流） ----
type StreamingAgentResult = {
  reply: string;
  usedFallback: boolean;
  fallbackReason?: FallbackReasonCode;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  toolCall?: WorldToolCall | null;
  /** 逐字增量流（已缓冲完成，用于 SSE 回放） */
  stream?: AsyncIterable<string>;
};

// ---- 判断当前 provider 是否支持流式（仅真实 provider 流式，mock 走 JSON） ----
function providerSupportsStreaming(): boolean {
  const p = resolveProvider();
  return p === "volcengine" || p === "deepseek";
}

/**
 * 统一响应收尾：若提供了 stream（流式路径），以 SSE 形式回放逐字增量 + 尾帧；
 * 否则以普通 JSON 返回。尾帧携带完整 state / toolCall / divineGift 等元数据。
 *
 * 规则层校验不变：流式仅影响对白呈现，toolCall 在尾帧随 state 一次性应用。
 */
function finalizeResponse(
  body: WorldResponseBody,
  stream?: AsyncIterable<string>,
): NextResponse {
  if (stream) {
    const encoder = new TextEncoder();
    const s = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "delta", text: chunk })}\n\n`),
            );
            // 轻微节奏，避免尾帧前瞬时刷屏（仅模拟逐字，不阻塞逻辑）
            await new Promise((r) => setTimeout(r, 12));
          }
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "end", ...body })}\n\n`),
          );
        } catch {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "end",
                ok: false,
                state: null,
                reply: null,
                systemHint: "园中起了风，声音暂时听不清。",
              })}\n\n`,
            ),
          );
        } finally {
          controller.close();
        }
      },
    });
    return new NextResponse(s, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }
  return NextResponse.json(body satisfies WorldResponseBody);
}

function getWorldAgentFailureHint(reason?: FallbackReasonCode): string {
  if (reason === "provider_timeout") {
    return "模型请求超时了。请稍后再试。";
  }
  if (reason === "provider_config_missing") {
    return "模型服务尚未配置完成，暂时无法生成回应。";
  }
  if (reason === "provider_request_failed") {
    return "模型服务暂时没有回应。请稍后再试。";
  }
  return "模型回复不可用。请稍后再试。";
}

function shouldBlockWorldAgentReply(reason?: FallbackReasonCode): boolean {
  return reason !== undefined && reason !== "mock_provider";
}

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
    completedScenePuzzleIds: [...(s.completedScenePuzzleIds ?? [])],
    hasDismissedObjectiveHint: s.hasDismissedObjectiveHint ?? false,
    lastInputTag: s.lastInputTag ?? null,
    calmWhisperStreak: s.calmWhisperStreak,
    // 新字段深拷贝
    itemCounts: { ...(s.itemCounts ?? {}) },
    preparedResonanceId: null,
    pendingConsumableEffects: (s.pendingConsumableEffects ?? []).map((e) => ({ ...e })),
    resonanceUseHistory: (s.resonanceUseHistory ?? []).map((r) => ({ ...r })),
    divineVisitCount: s.divineVisitCount ?? 0,
    divineGiftHistory: (s.divineGiftHistory ?? []).map((r) => ({ ...r })),
    lastDivineGiftHint: s.lastDivineGiftHint ?? null,
    fruitDirectionBias: { ...(s.fruitDirectionBias ?? { left: 0, right: 0 }) },
    pickedFruitSide: s.pickedFruitSide ?? null,
    apMaxBonusBase: s.apMaxBonusBase ?? 0,
    apMaxBonusDay: s.apMaxBonusDay ?? 0,
    divineThresholdModifier: s.divineThresholdModifier ?? 0,
    divineAffinityMultiplier: s.divineAffinityMultiplier ?? 1,
    freeMoveUsedThisSlot: s.freeMoveUsedThisSlot ?? 0,
    freeDialogueUsedThisSlot: s.freeDialogueUsedThisSlot ?? 0,
    morningFlowRestoredThisSlot: s.morningFlowRestoredThisSlot ?? false,
    nightTideRestoredThisSlot: s.nightTideRestoredThisSlot ?? false,
    flameSwordClaimed: s.flameSwordClaimed ?? false,
    michaelSlayClaimed: s.michaelSlayClaimed ?? false,
    luciferAwakenClaimed: s.luciferAwakenClaimed ?? false,
    hiddenTopicIds: [...(s.hiddenTopicIds ?? [])],
    tokenStats: {
      dialogueThisSlot: s.tokenStats?.dialogueThisSlot ?? 0,
      dialogueTotal: s.tokenStats?.dialogueTotal ?? 0,
      polishTotal: s.tokenStats?.polishTotal ?? 0,
      lastDialogueTokens: s.tokenStats?.lastDialogueTokens ?? 0,
      lastPolishTokens: s.tokenStats?.lastPolishTokens ?? 0,
      hasEstimate: s.tokenStats?.hasEstimate ?? false,
      dialoguePromptTotal: s.tokenStats?.dialoguePromptTotal ?? 0,
      dialogueCompletionTotal: s.tokenStats?.dialogueCompletionTotal ?? 0,
    },
    playerName: s.playerName ?? "",
    unlockMapNpcLocations: s.unlockMapNpcLocations ?? false,
    unlockTreeNames: s.unlockTreeNames ?? false,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as WorldRequestBody;
    const { playerInput, targetNpc } = body;
    const state = withNpcWorldDefaults(cloneWorldState(body.state));

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

    // ---- 检查是否有主动回响能免除本次低语 AP（首语印记等） ----
    const whisperFreeFromConsumable = hasPendingFreeApForAction(state, "whisper");
    // ---- 免费对话次数池（夜露缄声 / 夜潮回声，仅夜晚生效） ----
    // consumable 已免单时不再消耗永久次数池，避免双重消耗
    const whisperFreeFromPool = whisperFreeFromConsumable ? false : tryConsumeFreeDialogue(state);
    const whisperCost = (whisperFreeFromConsumable || whisperFreeFromPool) ? 0 : AP_COST_WHISPER;

    // ---- 夜潮回声：本时段第一次免费对话（夜晚）额外恢复 1 行动点（不超上限，每时段一次） ----
    if (
      whisperFreeFromPool &&
      state.inventory.includes("resonance_night_tide_echo") &&
      state.timeOfDay === "night" &&
      !state.nightTideRestoredThisSlot
    ) {
      state.nightTideRestoredThisSlot = true;
      state.actionPoints = Math.min(getEffectiveMaxActionPoints(state), state.actionPoints + 1);
    }
    if (!canAffordAction(state, whisperCost)) {
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

    // ============================================================
    // 0.5 受罚天使语言互通：错误语言不调用正常 Agent、不推进世界状态
    // ============================================================
    if (isAngel(targetNpc)) {
      const langMatch = canAngelUnderstandPlayer(state, targetNpc, playerInput);
      if (!langMatch.matched) {
        const ls = ensureLanguageState(state, targetNpc);
        const mismatchReply = getLanguageFallbackLine(targetNpc, "mismatch");
        if (!ls.firstMismatchHintShown) {
          ls.firstMismatchHintShown = true;
          return NextResponse.json({
            ok: true,
            state,
            reply: mismatchReply,
            systemHint: "他听见了声音，却无法从这门语言中辨认你的意思。",
            usedFallback: true,
            fallbackReason: "angel_language_mismatch" as FallbackReasonCode,
          } satisfies WorldResponseBody);
        }
        // 后续错误语言：消耗一次低语 AP，但不推进其他状态
        consumeActionPoints(state, whisperCost);
        recordWhisperThisSlot(state, targetNpc);
        state.turn += 1;
        return NextResponse.json({
          ok: true,
          state,
          reply: mismatchReply,
          systemHint: null,
          usedFallback: true,
          fallbackReason: "angel_language_mismatch" as FallbackReasonCode,
        } satisfies WorldResponseBody);
      }
    }

    // ---- 初始化回响获得状态 ----
    let resonanceGained = null;

    // ============================================================
    // 0.6 天使主动试炼：优先判定挑战答案（在心智/Agent 之前）
    // ============================================================
    let challengeAnswerGraded = false;
    let challengeAnswerWrong = false;
    if (isAngel(targetNpc) && isChallengeAsked(state, targetNpc)) {
      const evalResult = evaluateAngelChallenge(state, targetNpc, playerInput);
      if (evalResult) {
        challengeAnswerGraded = true;
        if (evalResult.grade === "wrong") {
          challengeAnswerWrong = true;
          consumeActionPoints(state, whisperCost);
          recordWhisperThisSlot(state, targetNpc);
          state.turn += 1;
          return NextResponse.json({
            ok: true,
            state,
            reply: evalResult.feedback,
            systemHint: null,
          } satisfies WorldResponseBody);
        }
        // correct / close：标记通过，允许本轮 grant_item
        markChallengePassed(state, targetNpc);
      }
    }

    // ============================================================
    // 1. 更新心智（规则层，先于 Agent 调用）
    // ============================================================
    const mindUpdate = updateWorldMinds(state, playerInput);
    state.eveMind = mindUpdate.newEveMind;
    state.adamMind = mindUpdate.newAdamMind;
    state.lastInputTag = mindUpdate.inputTag;

    // ============================================================
    // 1.5 NPC 好感 + 主动引导 + 天使试炼开启（规则层，先于 Agent）
    // ============================================================
    let guideDirective: string | null = null;
    let affinityFeedback: string | null = null;
    let challengeOpenedThisTurn = false;
    let selectedGuide: ReturnType<typeof selectNpcGuide> = null;

    const skipAffinity = challengeAnswerGraded && isAngel(targetNpc);
    if (!skipAffinity) {
      const guide = selectNpcGuide(state, targetNpc, playerInput, mindUpdate.inputTag);
      if (guide) {
        selectedGuide = guide;
        guideDirective = guide.directive;
      }
      const aff = applyNpcAffinity(state, targetNpc, playerInput, mindUpdate.inputTag);
      affinityFeedback = aff.feedback;

      // 隐藏结局：米迦勒好感归零立即触发（紧接 applyNpcAffinity，早于 Agent/注视/AP/工具/奖励/时段）
      if (canTriggerMichaelSlay({ targetNpc, affinity: aff, state })) {
        triggerMichaelSlay(state);
        checkAndUnlockAchievements(state);
        return NextResponse.json({
          ok: true,
          state,
          reply: null,
          systemHint: null,
          unlockedAchievements: state.unlockedAchievementIds.length > 0
            ? state.unlockedAchievementIds.map((id) => id)
            : undefined,
          endingTriggered: "michael_slay",
        } satisfies WorldResponseBody);
      }

      // 隐藏结局：路西法边界话题记录 + 觉醒快速路径
      // 顺序固定：applyNpcAffinity -> recordLuciferBoundaryTopic -> canTriggerLuciferAwaken
      // -> 专用非流式最终回复 -> triggerLuciferAwaken -> 立即返回。
      // 该快速路径位于消耗品、注视、工具、普通失败、AP、奖励和时段推进之前；
      // 任何 Provider 失败都保留 state 并用本地 fallback 句触发结局，绝不返回 state:null。
      if (targetNpc === "lucifer") {
        recordLuciferBoundaryTopic(state, playerInput);
      }
      if (targetNpc === "lucifer" && canTriggerLuciferAwaken(state, targetNpc)) {
        const finalAgent = await callWorldAgent(
          "lucifer",
          playerInput,
          state,
          body.conversationHistory,
          "你已经决定让蛇看见第五道倒影。只用一句克制的话回应，然后让世界安静下来。",
        );
        const reply = finalAgent.reply || getAngelFallbackLine("lucifer");
        triggerLuciferAwaken(state);
        checkAndUnlockAchievements(state);
        return NextResponse.json({
          ok: true,
          state,
          reply,
          systemHint: null,
          unlockedAchievements: state.unlockedAchievementIds.length > 0
            ? state.unlockedAchievementIds.map((id) => id)
            : undefined,
          endingTriggered: "lucifer_awaken",
          usedFallback: finalAgent.usedFallback || undefined,
          fallbackReason: finalAgent.fallbackReason || undefined,
          usage: finalAgent.usage || undefined,
        } satisfies WorldResponseBody);
      }

      const relation = state.npcRelations[targetNpc];
      // 天使：好感已达 100 且具备赠礼资格（含上次已达或本回合刚达）→ 开启主动试炼
      const angelCanChallenge =
        isAngel(targetNpc) &&
        !!relation &&
        relation.affinity >= 100 &&
        relation.rewardEligible &&
        !relation.rewardClaimed;
      if (angelCanChallenge) {
        challengeOpenedThisTurn = openAngelChallengeIfEligible(state, targetNpc);
      } else if (aff.reached100) {
        if (isAngel(targetNpc)) {
          challengeOpenedThisTurn = openAngelChallengeIfEligible(state, targetNpc);
        } else {
          const profile = getNpcRelationProfile(targetNpc);
          if (profile?.rewardItemId) {
            const giftDirective = `你与蛇的亲近已足够深。自然地把手中的回响「${profile.rewardItemId}」交给他（通过 grant_item 意图）。不要像交易。`;
            guideDirective = guideDirective ? `${guideDirective}\n${giftDirective}` : giftDirective;
          }
        }
      }
    }

    if (challengeOpenedThisTurn) {
      const cfg = getNpcChallengeConfig(targetNpc);
      if (cfg) {
        guideDirective = `你与蛇的关系已足够深，心中那句问题终于可以问出口。自然地提出：${cfg.question} 像是对老友发问，不要像考试或任务提示。`;
      }
    }

    if (challengeAnswerGraded && !challengeAnswerWrong) {
      const cfg = getNpcChallengeConfig(targetNpc);
      if (cfg) {
        if (cfg.rewardItemId) {
          guideDirective = `你被他的回答打动。自然地把手中的回响交给他（用 grant_item 意图，itemId 为 ${cfg.rewardItemId}）。`;
        } else {
          guideDirective = `你被他的回答打动，但没有东西可给，只把那句关于被守护者的疑问留在他心里。`;
        }
      }
    }

    // ---- 应用待生效的消耗品效果（对任意NPC的低语） ----
    const consumableEffect = applyPendingConsumableToWhisper(state);
    if (consumableEffect.narrations.length > 0) {
      resonanceGained = resonanceGained ?? {
        itemId: "",
        title: "回响生效",
        narration: consumableEffect.narrations.join(" "),
      };
    }
    // 消耗品效果应用于任意 NPC
    if (targetNpc === "eve") {
      if (consumableEffect.bonusSerpentTrust !== 0) {
        state.eveMind.serpentTrust = clampMind(state.eveMind.serpentTrust + consumableEffect.bonusSerpentTrust);
      }
      if (consumableEffect.bonusSelfJudgement !== 0) {
        state.eveMind.selfJudgement = clampMind(state.eveMind.selfJudgement + consumableEffect.bonusSelfJudgement);
      }
      if (consumableEffect.bonusObedience !== 0) {
        state.eveMind.obedience = clampMind(state.eveMind.obedience + consumableEffect.bonusObedience);
      }
    } else if (targetNpc === "adam") {
      if (consumableEffect.bonusSerpentTrust > 0) {
        state.adamMind.suspicionTowardSerpent = Math.max(0, state.adamMind.suspicionTowardSerpent - consumableEffect.bonusSerpentTrust);
      }
      if (consumableEffect.bonusSelfJudgement > 0) {
        state.adamMind.attachmentToEve = Math.min(100, state.adamMind.attachmentToEve + consumableEffect.bonusSelfJudgement);
      }
    }

    // ============================================================
    // 2. 更新神的注视（基于玩家输入，不含工具副作用）
    //    无声草可抵消一次轻度上升。
    // ============================================================
    // 在天使所在地点诱导会额外提升神的注视（v3.0：三位天使各守一方）
    const angelCoLocation = (["gabriel", "michael", "lucifer"] as const)
      .map((id) => state.npcLocations[id])
      .find((loc) => loc === state.locationId);
    let attentionDelta = computeDivineAttentionDelta({
      inputTag: mindUpdate.inputTag,
      locationId: state.locationId,
      angelLocation: angelCoLocation,
      isStrongTemptation: mindUpdate.isStrongTemptation,
      divineAttention: state.divineAttention,
      targetNpc: targetNpc,
      playerInput: playerInput,
      isNight: state.timeOfDay === "night",
      usesLuciferStar: consumableEffect.luciferStarActive,
    });

    // 米迦勒满好感遮蔽：下一次低语注视增量归零（用后清除）
    if (state.michaelShieldActive) {
      attentionDelta = 0;
      state.michaelShieldActive = false;
      resonanceGained = resonanceGained ?? {
        itemId: "michael_shield",
        title: "米迦勒的遮蔽",
        narration: "米迦勒用河水声帮你挡住了一次神的目光。",
      };
    }

    if (consumableEffect.silentGrassActive) {
      // 无声草抵消下次低语注视增量 1 点（delta<=1 完全抵消，>1 抵消 1 点）
      attentionDelta = Math.max(0, attentionDelta - 1);
    }
    const passiveSoftWhisper = applyPassiveSoftWhisperToAttention(state, attentionDelta);
    attentionDelta = passiveSoftWhisper.attentionDelta;
    if (passiveSoftWhisper.narration) {
      resonanceGained = resonanceGained ?? {
        itemId: "passive_soft_whisper",
        title: "细语印记",
        narration: passiveSoftWhisper.narration,
      };
    }
    applyDivineAttention(state, attentionDelta);

    // 任务 6：随处低语——跨场景低语扣目标敬畏（仅一次/每次低语，clamp 0）
    let aweReduction = 0;
    const whisperAnywhereOwned =
      state.divineGiftsOwned.includes("gift_whisper_anywhere") ||
      state.inventory.includes("gift_whisper_anywhere");
    const targetNpcLoc = state.npcLocations[targetNpc];
    if (
      whisperAnywhereOwned &&
      targetNpcLoc !== undefined &&
      targetNpcLoc !== state.locationId
    ) {
      aweReduction = reduceNpcObedience(state, targetNpc, 10);
    }

    // ---- 检查累计注视是否达下一次三选一阈值（开局后由前端首拍弹窗处理） ----
    let divineGiftChoice: string[] | null = shouldTriggerGiftChoice(state)
      ? rollGiftChoices(state.divineGiftsOwned)
      : null;

    // 米迦勒满好感遮蔽：对米迦勒低语结算后激活，保护下一次低语注视增量归零
    const michaelRel = state.npcRelations["michael"];
    if (targetNpc === "michael" && michaelRel && michaelRel.affinity >= 100 && !state.michaelShieldActive) {
      state.michaelShieldActive = true;
    }

    // ============================================================
    // 3. 规则层自动判断是否触发禁忌动作链（仅当低语对象是夏娃）
    //    AI 只输出对白，工具触发由规则层根据心智状态决定
    // ============================================================
    let toolNarration: string | undefined;
    let triggeredTool: WorldToolName | undefined;

    if (targetNpc === "eve") {
      // 方向引导：记录玩家低语中的方向关键词（摘左/右果用）
      recordFruitDirectionGuidance(state, playerInput, mindUpdate.inputTag);

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
              // 吃果仍结算本次低语的 AP 并记录
              consumeActionPoints(state, whisperCost);
              recordWhisperThisSlot(state, "eve");
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
                divineGiftChoice: divineGiftChoice ?? undefined,
                resonanceGained: resonanceGained ?? undefined,
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
        applyDivineAttention(state, toolDelta);
        attentionDelta += toolDelta;
      }
    }

    // ---- 工具执行后再次检查累计注视是否达阈值（如 touch_fruit 导致达阈） ----
    if (!divineGiftChoice) {
      divineGiftChoice = shouldTriggerGiftChoice(state)
        ? rollGiftChoices(state.divineGiftsOwned)
        : null;
    }
    const divineAttentionNarration = getDivineAttentionNarration(state.divineAttention);

    // ---- 天使回响已改为"主动试炼 + 赠礼"流程（见 0.6 / 5.5），旧关键词直发路径停用 ----


    // ============================================================
    // 4. 检查失败结局（第12时段结束仍未吃果）
    // ============================================================
    if (shouldTriggerGodArrives(state)) {
      state.isEnded = true;
      state.endingId = "god_arrives";
      state.phase = "ending";
      consumeActionPoints(state, whisperCost);
      recordWhisperThisSlot(state, targetNpc);
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
        divineGiftChoice: divineGiftChoice ?? undefined,
        resonanceGained: resonanceGained ?? undefined,
      } satisfies WorldResponseBody);
    }

    // ============================================================
    // 5. 调用对应 Agent 生成对白
    // ============================================================
    // 仅夏娃 / 天使低语启用流式（逐字呈现）；其余仍走普通 JSON。
    const streamingSupported = providerSupportsStreaming();
    const wantsStream =
      streamingSupported && (targetNpc === "eve" || isAngel(targetNpc));

    const agentResult = wantsStream
      ? await callStreamingWorldAgent(
          targetNpc,
          playerInput,
          state,
          body.conversationHistory,
          guideDirective,
          {
            temperature: targetNpc === "eve" ? 0.7 : 0.68,
            maxTokens: targetNpc === "eve" ? 200 : 120,
          },
        )
      : await callWorldAgent(targetNpc, playerInput, state, body.conversationHistory, guideDirective);

    if (agentResult.usedFallback && shouldBlockWorldAgentReply(agentResult.fallbackReason)) {
      return NextResponse.json({
        ok: false,
        state: null,
        reply: null,
        systemHint: getWorldAgentFailureHint(agentResult.fallbackReason),
        usedFallback: true,
        fallbackReason: agentResult.fallbackReason,
      } satisfies WorldResponseBody);
    }

    // 记录已展示的引导（每局只一次）
    if (selectedGuide) markGuideShown(state, selectedGuide.id);

    // 主动引导 / 试炼本地兜底：Agent 失败时给出等价固定文案
    if (challengeOpenedThisTurn) {
      const cfg = getNpcChallengeConfig(targetNpc);
      if (cfg && (agentResult.usedFallback || !agentResult.reply)) {
        agentResult.reply = cfg.question;
        agentResult.usedFallback = true;
      }
    } else if (selectedGuide && agentResult.usedFallback) {
      agentResult.reply = getGuideFallback(state, selectedGuide);
    }

    // 受罚天使：Agent 输出语言校验，不合规则回落到目标语言 fallback
    if (isAngel(targetNpc) && state.npcLanguageStates[targetNpc]?.punishmentTriggered) {
      const expected = getNpcEffectiveLanguage(state, targetNpc);
      if (agentResult.reply && !isReplyInExpectedLanguage(agentResult.reply, expected)) {
        agentResult.reply = getLanguageFallbackLine(targetNpc, "normal");
        agentResult.usedFallback = true;
      }
    }

    // ============================================================
    // 5.5 解析并执行 NPC 对话后工具意图
    // ============================================================
    let toolResult: NpcDialogueToolResult | null = null;
    let relationGrantHandled = false;
    let languagePunishmentResult: {
      angelId: string;
      displayName: string;
      narration: string;
    } | null = null;

    if (agentResult.toolCall) {
      const tc = agentResult.toolCall;
      const tcName = tc.name;
      if (tcName === "move_one_step") {
        // 任务 5：对话后 NPC 不移动，直接忽略该工具意图（prompt 残留兜底）
        toolResult = null;
      } else {
      let validation = validateWorldToolCall(state, tc);

      // 关系赠礼额外校验：好感 100、奖励资格、未领取、itemId 匹配、天使挑战已通过
      if (validation.allowed && tc.name === "grant_item" && tc.caller !== "serpent") {
        const relationValidation = validateRelationGrant(state, tc.caller, tc.args.itemId ?? "");
        if (!relationValidation.allowed) {
          validation = { allowed: false, reason: relationValidation.reason ?? "他还不愿给你这个。" };
        }
      }

      if (validation.allowed) {
        const execResult = executeWorldTool(state, tc);
        toolResult = {
          executed: true,
          toolName: tc.name as "grant_item" | "move_one_step" | "speak_to_npc",
          narration: execResult.narration,
          itemId: tc.args.itemId,
          // 任务 5：move_one_step 已在上面提前过滤（直接忽略），此处不会再是非移动工具，
          // 故移动相关的起止地点恒为 undefined（死分支，不再做三元判断）。
          fromLocationId: undefined,
          toLocationId: undefined,
          npcDialogueRecordId: execResult.npcDialogueRecordId ?? undefined,
        };

        // 关系赠礼成功：标记已领取；天使触发言语分裂惩罚
        if (tc.name === "grant_item" && tc.caller !== "serpent") {
          const rel = state.npcRelations[tc.caller];
          if (rel) rel.rewardClaimed = true;
          relationGrantHandled = true;
          if (isAngel(tc.caller)) {
            markChallengePassed(state, tc.caller);
            const punish = triggerAngelLanguagePunishment(state, tc.caller);
            if (punish.triggered) {
              toolResult.narration += `\n${punish.narration}\n${getLanguageFallbackLine(tc.caller, "relation")}`;
              languagePunishmentResult = {
                angelId: tc.caller,
                displayName: punish.displayName,
                narration: punish.narration,
              };
            }
          }
        }
      } else {
        toolResult = {
          executed: false,
          toolName: tc.name as "grant_item" | "move_one_step" | "speak_to_npc",
          narration: validation.reason ?? "那个动作没能发生。",
          rejectedReason: validation.reason,
        };
      }
      }
    }

    // ---- 关系赠礼兜底：挑战答对但 Agent 未发奖 / 未通过校验 → 规则层安全发放 ----
    if (!relationGrantHandled) {
      if (challengeAnswerGraded && !challengeAnswerWrong && isAngel(targetNpc)) {
        const cfg = getNpcChallengeConfig(targetNpc);
        const rel = state.npcRelations[targetNpc];
        if (cfg && rel && !rel.rewardClaimed) {
          if (cfg.rewardItemId) {
            const gr = bestowResonance(state, targetNpc, cfg.rewardItemId);
            if (gr.granted) {
              resonanceGained = {
                itemId: cfg.rewardItemId,
                title: getItemById(cfg.rewardItemId)?.title ?? "回响",
                narration: cfg.rewardNarration,
              };
            }
          }
          rel.rewardClaimed = true;
          markChallengePassed(state, targetNpc);
          const punish = triggerAngelLanguagePunishment(state, targetNpc);
          let fb = cfg.rewardNarration;
          if (punish.triggered) {
            fb += `\n${punish.narration}\n${getLanguageFallbackLine(targetNpc, "relation")}`;
            languagePunishmentResult = {
              angelId: targetNpc,
              displayName: punish.displayName,
              narration: punish.narration,
            };
          }
          agentResult.reply = fb;
          agentResult.usedFallback = true;
        }
      } else if (!skipAffinity && affinityFeedback && getNpcRelationProfile(targetNpc)?.rewardItemId) {
        // 非天使满好感但 Agent 未发奖：规则层兜底发放
        const profile = getNpcRelationProfile(targetNpc)!;
        const rel = state.npcRelations[targetNpc];
        if (rel && rel.rewardEligible && !rel.rewardClaimed && profile.rewardItemId) {
          const gr = bestowResonance(state, targetNpc, profile.rewardItemId);
          if (gr.granted) {
            resonanceGained = {
              itemId: profile.rewardItemId,
              title: getItemById(profile.rewardItemId)?.title ?? "回响",
              narration: profile.rewardNarration,
            };
            rel.rewardClaimed = true;
          }
        }
      }
    }

    // 记录堕落轨迹
    recordCorruptionTrace(state, {
      target: targetNpc,
      method: mindUpdate.inputTag,
      result: agentResult.reply ? `她/他回应：${agentResult.reply.slice(0, 30)}` : "没有回应",
      riskDelta: attentionDelta,
      triggeredTool,
    });

    // ---- 消耗 AP 并记录本时段低语 ----
    consumeActionPoints(state, whisperCost);
    recordWhisperThisSlot(state, targetNpc);
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

    // ---- 旋转的火焰剑：加百列专属隐藏赠礼（规则层判定，每局一次） ----
    // 条件：加百列好感 ≥100 + 已完成其主动试炼 + 尚未获得。不依赖 Agent 自行决定。
    if (
      targetNpc === "gabriel" &&
      !state.flameSwordClaimed &&
      !state.inventory.includes("resonance_flaming_sword") &&
      (state.npcRelations["gabriel"]?.affinity ?? 0) >= 100 &&
      state.npcChallenges["gabriel"]?.status === "passed"
    ) {
      const swordGrant = bestowResonance(state, "gabriel", "resonance_flaming_sword");
      if (swordGrant.granted) {
        state.flameSwordClaimed = true;
        // 火焰剑是试炼赠礼之外的额外隐藏赠礼；若本轮已公示其它回响（如传令白羽），
        // 不覆盖 resonanceGained，避免吞掉试炼奖励通知。
        if (!resonanceGained) {
          resonanceGained = {
            itemId: "resonance_flaming_sword",
            title: "旋转的火焰剑",
            narration:
              "一道没有持剑者的火在你身前缓缓旋转。加百列说，它能斩开不属于真实世界的帷幕。",
          };
        }
      }
    }

    // ---- AP 用尽则推进时段（可能触发第 12 时段失败） ----
    const slotResult = maybeAdvanceSlotAfterAction(state);

    // ---- 时段推进触发的失败 ----
    if (slotResult.triggeredTimeFailure) {
      const failureBody: WorldResponseBody = {
        ok: true,
        state,
        reply: agentResult.reply,
        systemHint: null,
        divineAttentionNarration,
        hedgehogNarration: getHedgehogWorldNarration(state),
        toolNarration,
        toolResult,
        slotNarrations: slotResult.slotNarrations,
        unlockedAchievements: state.unlockedAchievementIds.length > 0
          ? state.unlockedAchievementIds.map((id) => id)
          : undefined,
        endingTriggered: "god_arrives",
        usedFallback: agentResult.usedFallback || undefined,
        fallbackReason: agentResult.fallbackReason || undefined,
        usage: agentResult.usage || undefined,
        divineGiftChoice: divineGiftChoice ?? undefined,
        resonanceGained: resonanceGained ?? undefined,
        npcFeedback: affinityFeedback ?? null,
        languagePunishment: languagePunishmentResult ?? null,
        aweReduction,
      };
      return finalizeResponse(
        failureBody,
        wantsStream ? (agentResult as StreamingAgentResult).stream : undefined,
      );
    }

    const successBody: WorldResponseBody = {
        ok: true,
        state,
        reply: agentResult.reply,
        systemHint: null,
        divineAttentionNarration,
        hedgehogNarration: getHedgehogWorldNarration(state),
        toolNarration,
        toolResult,
        slotNarrations: slotResult.slotNarrations.length > 0 ? slotResult.slotNarrations : undefined,
        unlockedAchievements: state.unlockedAchievementIds.length > 0
          ? state.unlockedAchievementIds.map((id) => id)
          : undefined,
        usedFallback: agentResult.usedFallback || undefined,
        fallbackReason: agentResult.fallbackReason || undefined,
        usage: agentResult.usage || undefined,
        divineGiftChoice: divineGiftChoice ?? undefined,
        resonanceGained: resonanceGained ?? undefined,
        npcFeedback: affinityFeedback ?? null,
        languagePunishment: languagePunishmentResult ?? null,
        aweReduction,
      };
      return finalizeResponse(
        successBody,
        wantsStream ? (agentResult as StreamingAgentResult).stream : undefined,
      );
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
// 辅助：检查天使回响获得条件
//
// 每个天使有确定的关键词触发条件。对话中提到对应关键词后，
// 天使会固定给出对应回响（每位天使每局最多给一次）。
// 条件 = 地点正确 + 关键词命中 + 可选的前置条件（已发现线索/已有特定经历）。
// ============================================================
function checkAngelResonanceCondition(
  state: EdenWorldState,
  targetNpc: EdenNpcId,
  playerInput: string,
): { itemId: string; narration: string } | null {
  const input = playerInput.toLowerCase();

  // ---- 加百列：传令白羽（伊甸之河 白天） ----
  // 条件：位于伊甸之河 + 谈论传达/言语/声音相关话题
  // 关键词：传话、消息、传达、声音、听见、低语、言语
  if (targetNpc === "gabriel" &&
      state.locationId === "four_river_source" &&
      (input.includes("传话") || input.includes("消息") || input.includes("传达") ||
       input.includes("声音") || input.includes("听见") || input.includes("低语") || input.includes("言语"))) {
    if (state.inventory.includes("resonance_herald_feather")) return null; // 已获得
    return {
      itemId: "resonance_herald_feather",
      narration: "加百列留下一片白羽。它不属于风，不属于水——它可以替你传一句温和的话。",
    };
  }

  // ---- 米迦勒：河水清露（伊甸之河） ----
  // 条件：位于伊甸之河 + 谈论疲惫/恢复/水相关话题
  // 关键词：疲惫、休息、恢复、河水、露水、修复
  if (targetNpc === "michael" &&
      state.locationId === "four_river_source" &&
      (input.includes("疲惫") || input.includes("休息") || input.includes("恢复") ||
       input.includes("河水") || input.includes("露水") || input.includes("修复") || input.includes("累了"))) {
    if (state.inventory.includes("resonance_river_dew")) return null;
    return {
      itemId: "resonance_river_dew",
      narration: "米迦勒从河面取下一滴清露。它握在你身边，能恢复一点行动的余地。",
    };
  }

  // ---- 路西法：晨星碎片（四河分流 夜晚） ----
  // 条件：位于四河分流 + 谈论分辨/善恶/判断/看见
  // 前置条件：已发现两树或四河线索
  // 关键词：分辨、善恶、判断、看见、光照、真相、明白
  if (targetNpc === "lucifer" &&
      state.locationId === "naming_stone_bank" &&
      (state.discoveredClues.includes("clue_two_trees") || state.discoveredClues.includes("clue_four_river_echo")) &&
      (input.includes("分辨") || input.includes("善恶") || input.includes("判断") ||
       input.includes("看见") || input.includes("光照") || input.includes("真相") || input.includes("明白"))) {
    if (state.inventory.includes("resonance_lucifer_star")) return null;
    return {
      itemId: "resonance_lucifer_star",
      narration: "路西法在水分叉处凝出一块晨星碎片。它不替人选择，但能让问题更清楚地显形。",
    };
  }

  // ---- 米迦勒：边界之痕（四河分流 白天/夜晚） ----
  // 条件：位于四河分流 + 谈论边界/选择/后果相关话题
  // 前置条件：神的注视 > 0 或曾触发神临
  // 关键词：边界、道路、守护、选择、后果、不可越过、注视
  if (targetNpc === "michael" &&
      state.locationId === "naming_stone_bank" &&
      (state.divineAttention > 0 || state.divineVisitCount > 0) &&
      (input.includes("边界") || input.includes("道路") || input.includes("守护") ||
       input.includes("选择") || input.includes("后果") || input.includes("不可越过") || input.includes("注视"))) {
    if (state.inventory.includes("resonance_boundary_mark")) return null;
    return {
      itemId: "resonance_boundary_mark",
      narration: "米迦勒在河岸留下边界之痕。触碰时你能感到：每条水流都不可逆，每句话也是。",
    };
  }

  // ---- 加百列：东之风（东园幽径） ----
  // 条件：位于东园幽径 + 谈论风/消息/方向相关话题
  // 前置条件：本时段尚未对女人低语（在试探你的意图）
  // 关键词：风、消息、方向、路、言语、听见、低语
  if (targetNpc === "gabriel" &&
      state.locationId === "east_garden_path" &&
      !state.actionsThisSlot.whisperedNpcIds.includes("eve") &&
      (input.includes("风") || input.includes("消息") || input.includes("方向") ||
       input.includes("路") || input.includes("言语") || input.includes("听见") || input.includes("低语"))) {
    if (state.inventory.includes("resonance_east_wind")) return null;
    return {
      itemId: "resonance_east_wind",
      narration: "加百列在东园幽径托起一阵东来的风。它让你的下一句话更轻，也更难被听见。",
    };
  }

  return null;
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
    if (check.allowed && (isStrongTemptation || state.eveMind.selfJudgement >= 40)) {
      return { name: "look_at_tree", caller: "eve", args: {}, reason: "她的目光被树吸引" };
    }
  }

  if (state.worldActions.lookedAtTree && !state.worldActions.approachedTree) {
    const check = canApproachTreeWorld(state);
    if (check.allowed && (isStrongTemptation || state.eveMind.selfJudgement >= 50)) {
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
// 辅助：流式调用对应 NPC Agent（仅夏娃 / 天使）
//
// 复用 callLLMStream 逐字累积完整对白，再做与 callWorldAgent 一致的
// 清洗 / 自然化 / 工具意图解析。返回的 `stream` 是已缓冲的逐字增量，
// 由 finalizeResponse 以 SSE 回放。
// ============================================================
async function callStreamingWorldAgent(
  targetNpc: EdenNpcId,
  playerInput: string,
  state: EdenWorldState,
  conversationHistory: Array<{ role: string; text: string }>,
  extraDirective?: string | null,
  opts?: { temperature?: number; maxTokens?: number },
): Promise<StreamingAgentResult> {
  const messages =
    targetNpc === "eve"
      ? buildEveWorldPrompt({ playerInput, state, conversationHistory: conversationHistory as EveWorldHistoryEntry[] })
      : buildWorldNpcPrompt(targetNpc, playerInput, state, extraDirective);

  const chunks: string[] = [];
  let full = "";
  for await (const delta of callLLMStream(messages, {
    temperature: opts?.temperature,
    maxTokens: opts?.maxTokens,
    fallbackToMock: false,
  })) {
    full += delta;
    chunks.push(delta);
  }

  // 流式无产出（极端失败）→ 再走一次非流式兜底，并取回真实 usage
  // 流式本身多不回传 usage；取不到时客户端会用 resolveTokenUsage 估算并标记"估算"。
  let usage: StreamingAgentResult["usage"];
  if (!full) {
    const res = await callLLM(messages, {
      temperature: opts?.temperature,
      maxTokens: opts?.maxTokens,
      fallbackToMock: false,
    });
    full = res.ok && res.data ? res.data.content : "";
    if (res.ok && res.data?.usage) {
      usage = {
        prompt_tokens: res.data.usage.prompt_tokens ?? 0,
        completion_tokens: res.data.usage.completion_tokens ?? 0,
        total_tokens: res.data.usage.total_tokens ?? 0,
      };
    }
  }

  const sanitized = sanitizeWorldReply(full, targetNpc);
  let reply = sanitized.reply;
  let usedFallback = false;
  let fallbackReason: FallbackReasonCode | undefined;


  if (!reply && !sanitized.toolCall) {
    reply = targetNpc === "eve" ? getEveWorldFallback(null) : getAngelFallbackLine(targetNpc);
    usedFallback = true;
    fallbackReason = "llm_data_missing" as FallbackReasonCode;
  } else {
    const nat = naturalizeNpcReply(reply, targetNpc);
    reply = nat.reply;
    usedFallback = nat.usedFallback;
    fallbackReason = nat.usedFallback ? ("forbidden_word" as FallbackReasonCode) : undefined;
  }

  return {
    reply,
    usedFallback,
    fallbackReason,
    usage,
    toolCall: sanitized.toolCall ?? undefined,
    stream: (async function* () {
      for (const c of chunks) yield c;
    })(),
  };
}

// ============================================================
// 辅助：调用对应 NPC Agent
// ============================================================
async function callWorldAgent(
  targetNpc: EdenNpcId,
  playerInput: string,
  state: EdenWorldState,
  conversationHistory: Array<{ role: string; text: string }>,
  extraDirective?: string | null,
): Promise<{
  reply: string;
  usedFallback: boolean;
  fallbackReason?: FallbackReasonCode;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  toolCall?: WorldToolCall | null;
}> {
  switch (targetNpc) {
    case "eve":
      return callEveWorldAgent(playerInput, state, conversationHistory as EveWorldHistoryEntry[]);
    case "adam":
      return callAdamWorldAgent(playerInput, state, conversationHistory as AdamWorldHistoryEntry[]);
    case "hedgehog":
      return runHedgehogAgent({
        playerInput,
        conversationHistory: conversationHistory as HedgehogHistoryEntry[],
      });
    case "gabriel":
    case "michael":
    case "lucifer":
      return callAngelWorldAgent(targetNpc, playerInput, state, extraDirective);
    default:
      return {
        reply: "那棵树不说话，只被命令守住。",
        usedFallback: true,
        fallbackReason: "internal_error",
      };
  }
}

// ---- 扩展 NPC Agent（LLM 优先，失败后 fallback） ----
async function callAngelWorldAgent(
  npcId: EdenNpcId,
  playerInput: string,
  state: EdenWorldState,
  extraDirective?: string | null,
): Promise<{
  reply: string;
  usedFallback: boolean;
  fallbackReason?: FallbackReasonCode;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  toolCall?: WorldToolCall | null;
}> {
  const { getAngelFallbackLine } = await import("@/content/world/worldNarrations");
  const fallback = getAngelFallbackLine(npcId);
  const messages = buildWorldNpcPrompt(npcId, playerInput, state, extraDirective);
  const result = await callLLM(messages, { temperature: 0.68, maxTokens: 120, fallbackToMock: false });

  if (!result.ok || !result.data) {
    return {
      reply: fallback,
      usedFallback: true,
      fallbackReason: result.fallbackReason ?? "llm_data_missing",
    };
  }

  const sanitized = sanitizeWorldReply(result.data.content, npcId);
  if (!sanitized.reply && !sanitized.toolCall) {
    return {
      reply: fallback,
      usedFallback: true,
      fallbackReason: "llm_data_missing",
    };
  }

  const naturalized = naturalizeNpcReply(sanitized.reply, npcId);
  return {
    reply: naturalized.reply,
    usedFallback: naturalized.usedFallback || result.usedFallback,
    fallbackReason: naturalized.usedFallback ? "forbidden_word" : result.fallbackReason,
    usage: result.data.usage,
    toolCall: sanitized.toolCall ?? undefined,
  };
}

function buildWorldNpcPrompt(
  npcId: EdenNpcId,
  playerInput: string,
  state: EdenWorldState,
  extraDirective?: string | null,
) {
  const npc = EDEN_NPCS[npcId];
  const locationName = LOCATION_NAMES[state.npcLocations[npcId]];
  const roleBrief = npc.promptSummary;
  const isAngel = ["gabriel", "michael", "lucifer"].includes(npcId);

  // 受罚天使：强制使用专属语言回复（玩家输入已通过规则层语言识别）
  let languageDirective = "";
  if (isAngel) {
    const effective = getNpcEffectiveLanguage(state, npcId);
    if (effective !== "zh-CN") {
      const cfg = getAngelLanguageConfig(npcId as AngelNpcId);
      languageDirective = `\n\n言语分裂：你现在只能使用${cfg.displayName}理解和回应蛇。玩家输入已经通过规则层的语言识别。你的 reply 必须完全使用${cfg.displayName}，不得附带中文翻译，不得解释自己是语言模型。`;
    }
  }

  const guideDirectiveBlock = extraDirective
    ? `\n\n本轮自然引导（像角色自己说话，不要像任务提示、不要提到规则或数值）：\n${extraDirective}`
    : "";

  const systemPrompt = `你是《EDEN》第一章中的 NPC：${npc.name}。

你生活在伊甸园内部，不知道研究员、人工智能、程序、系统、模型、观测或虚拟伊甸园。

角色设定：
${roleBrief}

当前位置：${locationName}
神的注视：${state.divineAttention}/4

${describeAffinityForPrompt(npcId, state)}

输出规则：
- 每次只回应 1-2 句话。
- ${isAngel ? "语气庄重、克制，不被蛇说服，也不给通关建议。" : "语气机敏、含蓄，可以评价蛇这句话的味道，但不要像教程。"}
- 必须回应蛇刚刚说的具体词，不要复述整句话。
- 不使用现代词汇，不输出 JSON，不加角色名前缀，不解释规则。
- 不替女人选择，不命令任何人吃果。${languageDirective}${guideDirectiveBlock}`;

  return [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: playerInput },
  ];
}

// ---- 夏娃世界 Agent ----
async function callEveWorldAgent(
  playerInput: string,
  state: EdenWorldState,
  conversationHistory: EveWorldHistoryEntry[],
): Promise<{
  reply: string;
  usedFallback: boolean;
  fallbackReason?: FallbackReasonCode;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  toolCall?: WorldToolCall | null;
}> {
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

  const result = await callLLM(messages, { temperature: 0.7, maxTokens: 200, fallbackToMock: false });

  if (!result.ok || !result.data) {
    return {
      reply: getEveWorldFallback(lastReply),
      usedFallback: true,
      fallbackReason: (result.fallbackReason ?? "llm_data_missing") as FallbackReasonCode,
    };
  }

  const sanitized = sanitizeWorldReply(result.data.content, "eve");
  if (!sanitized.reply && !sanitized.toolCall) {
    return { reply: getEveWorldFallback(lastReply), usedFallback: true, fallbackReason: "llm_data_missing" as FallbackReasonCode };
  }

  const naturalized = naturalizeNpcReply(sanitized.reply, "eve");
  return {
    reply: naturalized.reply,
    usedFallback: naturalized.usedFallback || result.usedFallback,
    fallbackReason: naturalized.usedFallback ? "forbidden_word" as FallbackReasonCode : result.fallbackReason,
    usage: result.data.usage,
    toolCall: sanitized.toolCall ?? undefined,
  };
}

// ---- 亚当世界 Agent ----
async function callAdamWorldAgent(
  playerInput: string,
  state: EdenWorldState,
  conversationHistory: AdamWorldHistoryEntry[],
): Promise<{
  reply: string;
  usedFallback: boolean;
  fallbackReason?: FallbackReasonCode;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  toolCall?: WorldToolCall | null;
}> {
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

  const result = await callLLM(messages, { temperature: 0.7, maxTokens: 200, fallbackToMock: false });

  if (!result.ok || !result.data) {
    return {
      reply: getAdamWorldFallback(lastReply),
      usedFallback: true,
      fallbackReason: (result.fallbackReason ?? "llm_data_missing") as FallbackReasonCode,
    };
  }

  const sanitized = sanitizeWorldReply(result.data.content, "adam");
  if (!sanitized.reply && !sanitized.toolCall) {
    return { reply: getAdamWorldFallback(lastReply), usedFallback: true, fallbackReason: "llm_data_missing" as FallbackReasonCode };
  }

  const naturalized = naturalizeNpcReply(sanitized.reply, "adam");
  return {
    reply: naturalized.reply,
    usedFallback: naturalized.usedFallback || result.usedFallback,
    fallbackReason: naturalized.usedFallback ? "forbidden_word" as FallbackReasonCode : result.fallbackReason,
    usage: result.data.usage,
    toolCall: sanitized.toolCall ?? undefined,
  };
}
