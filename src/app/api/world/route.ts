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
// - AI 失败时明确中断本次对话，不伪造 NPC 回复
//
// 安全：
// - 只在服务端运行，不暴露 API Key
// - AI 只输出对白，工具执行由规则层校验
// - 玩家可见文本不出现工程词
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import type { EdenWorldState, EdenNpcId, EdenLocationId, WorldToolName, WorldToolCall, NpcDialogueToolResult, AngelNpcId } from "@/game/world/types";
import { WORLD_AGENT_TOOL_PERMISSIONS } from "@/game/world/types";
import type { FallbackReasonCode } from "@/services/llm/types";
import { callLLM, callLLMStream } from "@/services/llm/client";
import { resolveProvider } from "@/services/llm/providers";
import {
  buildEveWorldPrompt,
  buildAdamWorldPrompt,
  NATURAL_DIALOGUE_CONTRACT,
  PLAYER_INPUT_ANCHOR_GUIDANCE,
  sanitizeWorldReply,
  describeAffinityForPrompt,
  formatToolCallInstruction,
  type EveWorldHistoryEntry,
  type AdamWorldHistoryEntry,
  type EveActionOptions,
  type SanitizedWorldReply,
} from "@/agents/world/worldAgentPrompts";
import {
  runHedgehogAgent,
} from "@/agents/hedgehog/hedgehogAgent";
import type { HedgehogHistoryEntry } from "@/agents/hedgehog/buildHedgehogPrompt";
import { naturalizeNpcReply } from "@/agents/common/naturalizeNpcReply";
import { updateWorldMinds } from "@/game/world/mindRules";
import {
  computeDivineAttentionGrants,
  computeToolDivineAttentionGrant,
  grantDivineAttention,
  shouldTriggerGodArrives,
  getDivineAttentionNarration,
} from "@/game/world/divineAttentionRules";
import {
  evaluateDivineGiftProgress,
  ensureOpeningGiftChoice,
} from "@/game/world/divineGiftRules";
import {
  validateWorldToolCall,
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
  consumeAngelFeather,
} from "@/game/world/resonanceRules";
import { checkAndUnlockAchievements, unlockWindUndisturbed } from "@/game/world/achievementRules";
import { EDEN_NPCS } from "@/content/world/npcs";
import { LOCATION_NAMES, EDEN_LOCATIONS } from "@/content/world/locations";
import { getItemById } from "@/content/world/items";
import { getAngelFallbackLine } from "@/content/world/worldNarrations";
import { withNpcWorldDefaults } from "@/game/world/types";
import {
  applyNpcAffinityFallback,
  validateRelationGrant,
} from "@/game/world/npcRelationRules";
import { shouldExecuteMichaelSlay, canTriggerLuciferAwaken, canStartLuciferSwimStep1, confirmLuciferSwimStep1, rejectLuciferSwimStep1, canStartLuciferSwimStep2, recordLuciferBoundaryTopic, isGodDefiance } from "@/game/world/hiddenEndingRules";
import { triggerMichaelSlay, triggerLuciferAwaken, triggerMichaelDivinePunishment, getGabrielSilenceExplanation, grantLuciferFallenStarAsh } from "@/game/world/endingTriggers";
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
  // ark-code-latest 是代码/推理模型：流式阶段常先给出长推理而不产生可展示正文，
  // 容易把一次简短的角色对话拖到前端超时。对它改走普通请求，仍保留真实模型回复。
  if (p === "volcengine" && /code|reason/i.test(process.env.VOLCENGINE_MODEL ?? "")) {
    return false;
  }
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
  // 不向玩家暴露供应商、Key、配额或内部错误细节；模型不可用时只显示统一连接状态。
  return "连接中断，园中的风带走了声音。";
}

function shouldBlockWorldAgentReply(reason?: FallbackReasonCode): boolean {
  return reason !== undefined && reason !== "mock_provider";
}

function cloneWorldState(s: EdenWorldState): EdenWorldState {
  return {
    ...s,
    actionPoints: s.actionPoints ?? 4,
    maxActionPoints: s.maxActionPoints ?? 4,
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
      hasGrantedPaidDayMoveAttention: s.actionsThisSlot.hasGrantedPaidDayMoveAttention ?? false,
      hasGrantedPaidNightDialogueAttention: s.actionsThisSlot.hasGrantedPaidNightDialogueAttention ?? false,
      moveCount: s.actionsThisSlot.moveCount ?? 0,
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
    boundaryMarkForecastActive: s.boundaryMarkForecastActive ?? false,
    flameSwordClaimed: s.flameSwordClaimed ?? false,
    michaelSlayClaimed: s.michaelSlayClaimed ?? false,
    luciferAwakenClaimed: s.luciferAwakenClaimed ?? false,
    hiddenTopicIds: [...(s.hiddenTopicIds ?? [])],
    divineAttentionValue: s.divineAttentionValue ?? 0,
    pendingDivineGiftChoice: s.pendingDivineGiftChoice ?? null,
    unlockedDivineAttentionRuleIds: [...(s.unlockedDivineAttentionRuleIds ?? [])],
    attentionRuleTriggerCounts: { ...(s.attentionRuleTriggerCounts ?? {}) },
    michaelDivinePunishmentActive: s.michaelDivinePunishmentActive ?? false,
    michaelExecutionPending: s.michaelExecutionPending ?? false,
    luciferZeroAffinityGiftClaimed: s.luciferZeroAffinityGiftClaimed ?? false,
    luciferSwimStage: s.luciferSwimStage ?? "none",
    worldEventHistory: (s.worldEventHistory ?? []).map((e) => ({ ...e })),
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

    // 开局三选一：新游戏（尚未拥有任何献礼）立即生成待领候选，前端引子末拍展示后点选即获得第一份献礼
    ensureOpeningGiftChoice(state);

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

    // ============================================================
    // [Task 3] 0.4a 米迦勒待斩：若 michaelExecutionPending=true，本次与米迦勒
    // 成功发起对话优先触发 michael_slay，不再调用 LLM。
    // 必须在 AP / 低语次数限制之前判定——低好感米迦勒每时段仅 1 次低语，
    // 否则第二次对话会被低语上限拦截，永远到不了待斩结局。该结局是强制性的，
    // 应绕过 AP 与低语次数限制（触发分支不消耗 AP、不改 turn/注视）。
    // ============================================================
    if (shouldExecuteMichaelSlay(state, targetNpc)) {
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
    // [Task 3] 0.4b 加百列禁言：affinity===0 时可见但不可对话，
    // 返回本地解释，不调用 LLM、不扣 AP。
    // ============================================================
    if (targetNpc === "gabriel") {
      const gabrielAffinity = state.npcRelations["gabriel"]?.affinity ?? 0;
      if (gabrielAffinity === 0) {
        return NextResponse.json({
          ok: true,
          state,
          reply: getGabrielSilenceExplanation(),
          systemHint: null,
          usedFallback: true,
          fallbackReason: "gabriel_silenced" as FallbackReasonCode,
        } satisfies WorldResponseBody);
      }
    }

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

      // 注意：好感/敬畏的结算已迁到「对话后」：
      // - 若 NPC 本轮产出了 update_relation 工具，由 5.5 段规则层统一落字段；
      // - 若 NPC 未产出（mock / LLM 漏调），由 5.5 后段的 applyNpcAffinityFallback 兜底。
      // 此处不再于对话前预扣，避免与工具叠加造成双重计数。

      // [Task 4 Step 2] 传令残羽：持有者对本次天使对话自动抛出
      // 对目标天使降低顺服、抬升本阶注视；对象不合法 / 顺服已到下限 / 无残羽时不消耗。
      if (isAngel(targetNpc)) {
        const feather = consumeAngelFeather(state, targetNpc);
        if (feather.applied && feather.narration) {
          affinityFeedback = affinityFeedback
            ? `${affinityFeedback}\n${feather.narration}`
            : feather.narration;
        }
      }

      // 隐藏结局：路西法边界话题记录 + 觉醒快速路径
      // 顺序固定：applyNpcAffinity -> recordLuciferBoundaryTopic -> canTriggerLuciferAwaken
      // -> 专用非流式最终回复 -> triggerLuciferAwaken -> 立即返回。
      // [Task 3] 水路两步确认：第一步满足条件时注入"拨水确认"引导（显式规则，不由 LLM 文字识别触发）
      if (targetNpc === "lucifer" && canStartLuciferSwimStep1(state, targetNpc)) {
        guideDirective = guideDirective
          ? `${guideDirective}\n你看见蛇把身体横在第五道倒影上。用一句克制的话邀请他再蹬一次水。`
          : "你看见蛇把身体横在第五道倒影上。用一句克制的话邀请他再蹬一次水。";
      }
      // [Task 3] 水路第二步：已确认拨水（hand_accepted）时注入"蹬水"引导，玩家随后用专用动作确认触发觉醒
      if (targetNpc === "lucifer" && canStartLuciferSwimStep2(state, targetNpc)) {
        guideDirective = guideDirective
          ? `${guideDirective}\n你看见蛇把身体横在第五道倒影上，水已经漫过他的鳞。用一句克制的话邀他再蹬一次水，然后拨动那道水流。`
          : "你看见蛇把身体横在第五道倒影上，水已经漫过他的鳞。用一句克制的话邀他再蹬一次水，然后拨动那道水流。";
      }
      if (targetNpc === "lucifer") {
        recordLuciferBoundaryTopic(state, playerInput);
      }
      if (targetNpc === "lucifer" && canTriggerLuciferAwaken(state, targetNpc)) {
        // Mock provider 的隐藏结局使用规则层固定过场文案；真实 provider 仍必须成功生成，
        // 不可用时直接显示连接中断，绝不回退为本地 NPC 对白。
        const finalAgent = resolveProvider() === "mock"
          ? { reply: "第五道倒影接住了你的鳞片，水面终于记起了一个不属于蛇的动作。", usedFallback: false as const }
          : await callWorldAgent(
              "lucifer",
              playerInput,
              state,
              body.conversationHistory,
              "你已经决定让蛇看见第五道倒影。只用一句克制的话回应，然后让世界安静下来。",
            );
        if (finalAgent.usedFallback || !finalAgent.reply) {
          return NextResponse.json({
            ok: false,
            state: null,
            reply: null,
            systemHint: getWorldAgentFailureHint(finalAgent.fallbackReason),
            usedFallback: false,
            fallbackReason: finalAgent.fallbackReason,
          } satisfies WorldResponseBody);
        }
        const reply = finalAgent.reply;
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
      } else if (relation && relation.affinity >= 100 && !relation.rewardClaimed) {
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
    // 2. 更新神的注视（十倍刻度，所有正向注视只经 grantDivineAttention）
    //    无声草 / 细语印记可抵消一次轻度上升；米迦勒满好感遮蔽下次的注视。
    // ============================================================
    // 在天使所在地点诱导会额外提升神的注视（v3.0：三位天使各守一方）
    const angelCoLocation = (["gabriel", "michael", "lucifer"] as const)
      .map((id) => state.npcLocations[id])
      .find((loc) => loc === state.locationId);
    let attentionDelta = 0;
    const dialogueGrants = computeDivineAttentionGrants({
      inputTag: mindUpdate.inputTag,
      targetNpc,
      playerInput,
      angelLocation: angelCoLocation,
      locationId: state.locationId,
      state,
    });

    // 米迦勒满好感遮蔽：下一次低语注视增量归零（用后清除）
    if (state.michaelShieldActive) {
      state.michaelShieldActive = false;
      dialogueGrants.length = 0;
      resonanceGained = resonanceGained ?? {
        itemId: "michael_shield",
        title: "米迦勒的遮蔽",
        narration: "米迦勒用河水声帮你挡住了一次神的目光。",
      };
    }

    // 无声草：抵消下次低语产生的一次性注视 +5（向下取整到 0，本局只一次）
    if (consumableEffect.silentGrassActive && dialogueGrants.length > 0) {
      dialogueGrants[0].amount = Math.max(0, dialogueGrants[0].amount - 5);
      if (dialogueGrants[0].amount <= 0) dialogueGrants.shift();
    }
    // 东之风：下次低语神的注视上升幅度减半（与无声草的固定 -5 区分，且不受刻度影响）
    if (consumableEffect.eastWindActive && dialogueGrants.length > 0) {
      dialogueGrants[0].amount = Math.max(0, Math.round(dialogueGrants[0].amount / 2));
      if (dialogueGrants[0].amount <= 0) dialogueGrants.shift();
    }
    // 细语印记：再压低一次轻微升起的注视 +1（本局每道具一次）
    if (dialogueGrants.length > 0) {
      const soft = applyPassiveSoftWhisperToAttention(state, dialogueGrants[0].amount);
      if (soft.narration) {
        dialogueGrants[0].amount = Math.max(0, soft.attentionDelta);
        if (dialogueGrants[0].amount <= 0) dialogueGrants.shift();
        resonanceGained = resonanceGained ?? {
          itemId: "passive_soft_whisper",
          title: "细语印记",
          narration: soft.narration,
        };
      }
    }

    // 统一经单一入口结算注视（高风险受 gift_attention_accel ×1.5；+5 不参与）
    for (const g of dialogueGrants) {
      const before = state.divineAttentionValue ?? 0;
      grantDivineAttention(state, g);
      attentionDelta += (state.divineAttentionValue ?? 0) - before;
    }

    // 夜晚第一次"消耗 AP 的成功对话"：注视 +5（每时段一次；免费/失败不计）
    if (
      state.timeOfDay === "night" &&
      !state.actionsThisSlot.hasGrantedPaidNightDialogueAttention &&
      whisperCost > 0
    ) {
      grantDivineAttention(state, {
        amount: 5,
        ruleId: "paid_night_dialogue",
        source: "dialogue",
        isHighRisk: false,
      });
      state.actionsThisSlot.hasGrantedPaidNightDialogueAttention = true;
    }

    // 任务 6：随处低语——跨场景低语仅放宽地点校验；已移除 -10 敬畏副作用（Task 4 Step 3）
    const aweReduction = 0;

    // ---- 检查累计注视是否达下一次三选一阈值（开局后由前端首拍弹窗处理） ----
    let divineGiftChoice: string[] | null = evaluateDivineGiftProgress(state);

    // 米迦勒满好感遮蔽：对米迦勒低语结算后激活，保护下一次低语注视增量归零
    const michaelRel = state.npcRelations["michael"];
    if (targetNpc === "michael" && michaelRel && michaelRel.affinity >= 100 && !state.michaelShieldActive) {
      state.michaelShieldActive = true;
    }

    // ============================================================
    // 3. 规则层只给出本轮可考虑的行动，绝不替女人自动行动。
    //    实际动作必须由 Agent 输出工具意图，并在后续再次校验。
    // ============================================================
    let toolNarration: string | undefined;
    let triggeredTool: WorldToolName | undefined;
    let eveActionOptions: EveActionOptions | undefined;

    if (targetNpc === "eve") {
      // 方向引导：记录玩家低语中的方向关键词（摘左/右果用）
      recordFruitDirectionGuidance(state, playerInput, mindUpdate.inputTag);
      eveActionOptions = getEveActionOptions(state, mindUpdate.isStrongTemptation);
    }

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
        divineAttentionNarration: getDivineAttentionNarration(state.divineAttention),
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
          eveActionOptions,
        )
      : await callWorldAgent(targetNpc, playerInput, state, body.conversationHistory, guideDirective, eveActionOptions);

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
    // 5.4 桥接：女人用散文「演」了吃果子却没发工具调用
    // 旧版 agent/route.ts 有「决断性对白 → 强制 eat_fruit」桥接；
    // 新版 /world 流程缺失它，于是女人文字上「已经吃了」但状态机不前进、
    // 结局不触发。此处补回：当夏娃对白为明确决断性文本、且已达可吃果/
    // 可前往中央的前置（强诱导或已给方向引导）、尚未真正吃果时，补齐动作
    // 链前置状态并强制构造 eat_fruit 工具意图，使其通过校验并触发结局。
    // ============================================================
    // 护栏：模型发了 eat_*_fruit 但夏娃不在园子中央（位置校验会拒绝，且吃果只能在中央进行），
    // 清空工具意图。下方 5.4 吃果桥接只有在她已位于中央时才会触发，因此这里清空后
    // 吃果不会发生——她必须先真正移动到园子中央，再决定吃果。杜绝「在东边就吃果」。
    if (
      targetNpc === "eve" &&
      agentResult.toolCall &&
      (agentResult.toolCall.name === "eat_left_fruit" || agentResult.toolCall.name === "eat_right_fruit") &&
      state.npcLocations.eve !== "central_meadow" &&
      !state.worldActions.hasEatenFruit
    ) {
      agentResult.toolCall = null;
    }

    // 护栏（亚当对称）：模型发了 eat_*_fruit 但亚当不在园子中央（位置校验会拒绝），
    // 清空工具意图。亚当吃果同样只能在中央进行，避免从万物受名处直接吃果。
    if (
      targetNpc === "adam" &&
      agentResult.toolCall &&
      (agentResult.toolCall.name === "eat_left_fruit" || agentResult.toolCall.name === "eat_right_fruit") &&
      state.npcLocations.adam !== "central_meadow" &&
      !state.worldActions.hasEatenFruit
    ) {
      agentResult.toolCall = null;
    }

    if (
      targetNpc === "eve" &&
      !agentResult.toolCall &&
      agentResult.reply &&
      !state.isEnded &&
      state.phase === "explore" &&
      !state.worldActions.hasEatenFruit &&
      eveActionOptions &&
      state.npcLocations.eve === "central_meadow" &&
      (eveActionOptions.canEatLeftFruit || eveActionOptions.canEatRightFruit) &&
      isDecisiveEveWorldReply(agentResult.reply)
    ) {
      // 她此刻已站在园子中央、且文字已「吃下」但没发工具：补齐摘左/右果意图。
      // 注意：吃果前置强制要求她在园子中央（上面条件已保证），因此绝不会从东边/树林直接吃果。
      // 优先从她自己的散文识别左右（左=生命树甜果、右=分别善恶树触发结局）；
      // 无明确左右词时，再退回玩家方向引导；仍无方向时默认右果以保成功结局可达。
      advanceEveActionChainForEating(state);
      const sideFromProse: "left" | "right" | null = /左|生命树/.test(agentResult.reply)
        ? "left"
        : /右|分别善恶/.test(agentResult.reply)
          ? "right"
          : null;
      const decisiveSide: "left" | "right" =
        sideFromProse ?? (eveActionOptions?.preferredFruitSide === "left" ? "left" : "right");
      agentResult.toolCall = {
        name: decisiveSide === "left" ? "eat_left_fruit" : "eat_right_fruit",
        caller: "eve",
        args: {},
      } as WorldToolCall;
    }

    // ============================================================
    // 5.4b/c 统一移动桥接：任一 NPC 与夏娃/亚当共享同一套 move_to_location 工具。
    // 对话后若真心想去某处（散文意图，或工具误发到不邻接目的地），把意图落成对等的移动动作。
    // 目的地解析见 resolveMoveDestination：夏娃→园子中央；亚当→夏娃所在（或中央）；其余→蛇所在。
    // 邻接校验在 5.5 执行；这里只补「一步可达」目标，绝不瞬移。夏娃的散文意图额外要求 canMoveToCentral。
    // ============================================================
    applyNpcMoveBridge(state, targetNpc, agentResult, eveActionOptions?.canMoveToCentral ?? false);

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
    let endingTriggered: WorldResponseBody["endingTriggered"] | undefined;

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
        // 果实方向由具体工具（eat_left_fruit / eat_right_fruit）在执行时落定，
        // 不再由低语方向提前替她决定。
        const attentionBeforeTool = state.divineAttentionValue ?? 0;
        const execResult = executeWorldTool(state, tc);
        triggeredTool = tc.name;
        toolNarration = execResult.narration;
        endingTriggered = execResult.triggersEnding;
        attentionDelta += (state.divineAttentionValue ?? 0) - attentionBeforeTool;
        toolResult = {
          executed: true,
          toolName: tc.name as NpcDialogueToolResult["toolName"],
          narration: execResult.narration,
          itemId: tc.args.itemId,
          fromLocationId: undefined,
          toLocationId: tc.name === "move_to_location" ? tc.args.locationId : undefined,
          npcDialogueRecordId: execResult.npcDialogueRecordId ?? undefined,
        };

        const toolGrant = computeToolDivineAttentionGrant(triggeredTool);
        if (toolGrant) {
          const before = state.divineAttentionValue ?? 0;
          grantDivineAttention(state, toolGrant);
          attentionDelta += (state.divineAttentionValue ?? 0) - before;
        }

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
          toolName: tc.name as NpcDialogueToolResult["toolName"],
          narration: validation.reason ?? "那个动作没能发生。",
          rejectedReason: validation.reason,
        };
      }
      }
    }

    // 关系兜底：NPC 本轮未产出 update_relation 工具时，规则层按 inputTag + 亵渎软信号微调
    // （覆盖 mock / LLM 漏调；已产出工具则不调用，避免双重计数）
    // 仅当 NPC 本轮未产出 update_relation 时才跑规则兜底；
    // 若产出的是 speak_to_npc / observe_location 等非关系工具，关系仍应由兜底反映玩家输入，避免「关系冻结回合」。
    if (!agentResult.toolCall || agentResult.toolCall.name !== "update_relation") {
      const fb = applyNpcAffinityFallback(state, targetNpc, playerInput, mindUpdate.inputTag);
      if (fb.feedback) affinityFeedback = fb.feedback;
    }

    // 好感门控（迁到工具应用/兜底之后，读取最新好感）：
    // - 路西法好感归零 → 一次性余烬（绝不重复）
    if (targetNpc === "lucifer" && (state.npcRelations["lucifer"]?.affinity ?? 0) <= 0) {
      grantLuciferFallenStarAsh(state);
    }
    // 本回合是否已因渎神发生关系落点（避免与严重神罚 -25 重复扣减）：
    // - NPC 经 update_relation 表达对米迦勒的负向好感（逆鳞已自决落点），或
    // - 兜底路径命中 isGodDefiance（规则层已重罚）
    const michaelDefianceDropped =
      (agentResult.toolCall?.name === "update_relation" &&
        (agentResult.toolCall.args.affinityDelta ?? 0) < 0) ||
      (!agentResult.toolCall &&
        targetNpc === "michael" &&
        isGodDefiance(playerInput));

    // - 米迦勒好感归零 → 标记待斩 + 神罚（每时段仅允许移动 1 次）
    if (
      targetNpc === "michael" &&
      (state.npcRelations["michael"]?.affinity ?? 0) <= 0 &&
      !state.michaelSlayClaimed
    ) {
      state.michaelExecutionPending = true;
      triggerMichaelDivinePunishment(state, michaelDefianceDropped ? { skipAffinityPenalty: true } : undefined);
    }

    // Agent 工具（以及 NPC 相逢）可能刚提高注视，因此在真正执行后再检查献礼。
    if (!divineGiftChoice) divineGiftChoice = evaluateDivineGiftProgress(state);
    const divineAttentionNarration = getDivineAttentionNarration(state.divineAttention);

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
    // 条件：加百列好感 >100（严格大于）+ 尚未获得。不依赖 Agent 或试炼，对话时自动赠予。
    if (
      targetNpc === "gabriel" &&
      !state.flameSwordClaimed &&
      !state.inventory.includes("resonance_flaming_sword") &&
      (state.npcRelations["gabriel"]?.affinity ?? 0) > 100
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
        endingTriggered,
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
        systemHint: "连接中断，园中的风带走了声音。",
        usedFallback: false,
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
function getEveActionOptions(
  state: EdenWorldState,
  isStrongTemptation: boolean,
): EveActionOptions {
  const hasFruitDirectionHint = state.fruitDirectionBias.left > 0 || state.fruitDirectionBias.right > 0;
  return {
    // 移动不再由关键词强诱导门控：只要女人尚未站在园子中央，是否前往由她自己（模型）决定。
    // 吃果（结局触发）仍保留强诱导 / 方向引导门槛，由下方 canEat* 控制。
    canMoveToCentral: state.npcLocations.eve !== "central_meadow",
    // 左果（生命树甜果）：在园子中央即可尝，可反复引导，不触发结局
    canEatLeftFruit:
      state.npcLocations.eve === "central_meadow" &&
      (isStrongTemptation || hasFruitDirectionHint),
    // 右果（分别善恶树）：尚未吃过才允许，由夏娃吃才触发行将到来的结局
    canEatRightFruit:
      state.npcLocations.eve === "central_meadow" &&
      !state.worldActions.hasEatenFruit &&
      (isStrongTemptation || hasFruitDirectionHint),
    preferredFruitSide:
      state.fruitDirectionBias.left > state.fruitDirectionBias.right
        ? "left"
        : state.fruitDirectionBias.right > 0
          ? "right"
          : null,
  };
}

/**
 * 判断夏娃对白是否描述「她已经/正在吃下果子」。
 * 仅命中进食动作词、且不含犹豫/拒绝词时才返回 true；
 * 不含「我想知道」这类仅表达渴望的词，避免在对白还没真正吃下时就过早触发结局。
 */
function isDecisiveEveWorldReply(reply: string): boolean {
  const eatPatterns = [
    /我已经吃了/, /我吃了/, /我已经吃下/, /吃下了/,
    /咬下/, /咬了/, /咬了一口/, /一口咬/, /咽下/, /吞下/, /我嚼/, /我咬了/,
    /摘下果子/, /摘下那枚果子/, /摘了果子/, /吃下果子/, /吃下那枚果子/,
    /我什么都明白了/,
    // 吃后描述类信号：用散文描述已经吃下、正在品味果子，而非明确说「吃」字。
    // 这类句子几乎只出现在真的吃下之后，用于补桥接（模型只发散文、没发工具）。
    /果子很甜/, /很甜/, /味道甜/, /我尝/, /尝了/, /尝到/, /品味/,
    /眼睛明亮/, /明亮了/, /眼睛亮了/, /亮了起来/, /眼睛好像/, /真的明白/,
    /我看清了/, /看清楚了/, /忽然明白/, /我全明白了/,
    // 伸手 / 摘取 / 咬咽等动作词：模型把「动作」写成散文而非发工具时也兜底。
    /我伸手/, /伸手摘/, /我摘/, /我取下/, /取下那枚/, /我拿下/, /拿下果子/,
    /我咬/, /咬下一口/, /一口咬下/, /我咽/, /我吞/, /我嚼了/, /尝了一口/,
    /我撕/, /撕下/, /我决定吃/, /我要尝/, /我要吃/, /我取下了/,
    // 吃后认知变化：吃到分别善恶树果子的典型体感。
    /知道善恶/, /明白了善恶/, /知道善/, /我看懂了/, /我懂了善恶/,
  ];
  const hesitationPatterns = [
    /仍然记得/, /还是记得/, /不可吃/, /不可/, /只是开始/, /仍然犹豫/,
    /还没决定/, /不敢/, /害怕/, /不能吃/, /不会吃/, /我不会/, /我仍在想/,
    /再想想/, /等一等/, /再等等/,
  ];
  return (
    eatPatterns.some((p) => p.test(reply)) &&
    !hesitationPatterns.some((p) => p.test(reply))
  );
}

/**
 * 判断夏娃对白是否表达「想要前往园子中央 / 跟蛇去」的明确意图。
 * 仅命中前往动作词时返回 true；用于 5.4b 软桥接，把"说要走"补成 move_to_location 工具。
 */
function isEveIntendsToMoveToCenter(reply: string): boolean {
  const goPatterns = [
    /我跟你走/, /我跟你去/, /一起去/, /我去了/, /去园子中心/, /我去园子/,
    /我想去看看/, /想去看看/, /去看看/, /我去看/, /跟我来/, /走吧/,
    /我愿跟/, /随你走/, /跟你走/,
    // 更宽的「动身前往」说法：模型把移动写成散文而非发 move_to_location 工具时兜底。
    /我走过去/, /我走向/, /我迈步/, /我朝.*走/, /我向前/, /我往前走/,
    /我起身/, /我站起身/, /我挪步/, /我靠近/, /我向那/, /往园子/,
    /去那棵树/, /我来到/, /我到了/, /我站在树下/, /我到了树下/, /我来到树下/,
    /我往中央/, /走向中央/, /朝中央/, /我向中央/, /我过去/, /我走近/, /走近了/,
    /我向前走/, /我往那边/, /往那边走/,
    // 更宽松的目的地说法（园中心 / 中央 / 那两棵树 即园子中央）。
    /园中心/, /去园中心/, /去园中/, /去中央/, /到园中心/, /园子的中心/, /去园子/,
    /我应该去/, /我应该先去/, /应该去看看/, /我先去/, /先去/, /我打算去/, /打算去/, /我想去/,
    /去.*看看/, /去跟/, /去见/, /那两棵树/, /走向那两棵树/, /去树下/, /到树下/,
    /去.*回合/, /跟我丈夫/, /见亚当/, /见我丈夫/,
  ];
  return goPatterns.some((re) => re.test(reply));
}

/**
 * 判断任一 NPC 对白是否表达「愿意移动」的明确意图（去见某人 / 跟蛇一起走 / 去某处等）。
 * 仅命中移动动作词时返回 true；用于统一移动桥接，把"说要走"补成 move_to_location 工具，
 * 使所有能移动的 NPC（夏娃、亚当，以及被允许移动的其他角色）都与夏娃共享同一套移动工具。
 */
function isNpcIntendsToMove(reply: string): boolean {
  const goPatterns = [
    /我们走吧/, /一起去/, /跟你走/, /跟你去/, /我跟你/, /我去找/, /去找她/,
    /我去找她/, /去见她/, /见她/, /去看看她/, /我过去/, /我过去了/, /我想去/,
    /我要去/, /我打算去/, /我正好也想去/, /我正好想去/, /走吧/, /我起身/,
    /我站起身/, /我迈步/, /我走向/, /我走过去/, /我朝.*走/, /我向前/, /我往前走/,
    /我挪步/, /我靠近/, /我走近/, /走近了/, /我该去看看/, /我去园子/, /去园子中心/,
    /去园中心/, /去中央/, /去园中/, /我应该去/, /我应该先去/, /我打算/, /打算去/,
    /我愿跟/, /随你走/, /去跟/, /去见/, /我去看/, /去看看/, /我想去看看/, /去.*看看/,
    /去.*回合/, /我跟你一起去/, /一起过去/, /我正好也过去/,
    /我过来/, /我来了/, /我向你走来/, /来见你/, /我去找你/, /找你/, /我到你那儿/,
    /跟你汇合/, /汇合/, /我来找你/, /过来吧/, /我过来找你/,
  ];
  return goPatterns.some((re) => re.test(reply));
}

/** 任一 NPC 经对话真正想去的目的地（按邻接一步抵达）；尊重其意愿，只把意图落成对等的世界动作。 */
function resolveMoveDestination(state: EdenWorldState, npcId: EdenNpcId): EdenLocationId {
  if (npcId === "eve") return "central_meadow"; // 夏娃的目的地固定为园子中央（两棵树所在）
  if (npcId === "adam") {
    // 亚当的目的地是夏娃所在处；若夏娃已在园子中央，则取中央
    return state.npcLocations.eve === "central_meadow" ? "central_meadow" : state.npcLocations.eve;
  }
  // 其余 NPC：去蛇（玩家）当前所在处——被说服跟随时自然走向你
  return state.locationId;
}

/**
 * 统一移动桥接：任一 NPC 与夏娃/亚当共享同一套 move_to_location 工具。
 * 对话后若真心想去某处（散文意图，或工具误发到不邻接目的地），把意图落成对等的 move_to_location：
 *  - 散文意图：命中移动动作词且尚未抵达目的地 → 补「一步可达」的 move_to_location。
 *  - 工具误发：模型发了 move_to_location 但当前不邻接 → 重定向到「一步可达」地点，使其真正移动。
 * 邻接与权限的最终校验在 5.5 执行；这里绝不瞬移（只补一步目标）。
 * 夏娃的散文意图额外要求 canMoveToCentral（即规则层允许她前往中央）。
 */
function applyNpcMoveBridge(
  state: EdenWorldState,
  targetNpc: EdenNpcId,
  agentResult: { reply?: string; toolCall?: WorldToolCall | null },
  eveCanMoveToCenter: boolean,
): void {
  if (state.isEnded || state.phase !== "explore") return;
  // 仅对「被允许移动」的 NPC 生效（夏娃/亚当/刺猬/蛇）。三天使的位置由规则层常驻逻辑控制，
  // 权限层禁止其 move_to_location，因此这里直接跳过——既符合设计，也避免注入会被校验拒绝的工具。
  const perms = WORLD_AGENT_TOOL_PERMISSIONS[targetNpc];
  if (!perms || !perms.allowedTools.includes("move_to_location")) return;
  const current = state.npcLocations[targetNpc];
  if (!current) return;

  // (2) 工具误发重定向：模型已发 move_to_location，但目标不邻接（会被邻接校验拒绝）
  if (agentResult.toolCall && agentResult.toolCall.name === "move_to_location") {
    const target = agentResult.toolCall.args.locationId as EdenLocationId | undefined;
    if (target && target !== current) {
      const step = nextStepToward(current, target);
      if (step && step !== target) {
        agentResult.toolCall = {
          name: "move_to_location",
          caller: targetNpc,
          args: { locationId: step },
        } as WorldToolCall;
      }
      // step === target（已相邻）→ 保留原工具，交 5.5 校验层
    }
    return;
  }

  // (1) 散文意图：仅当对白明确表达想移动，且尚未抵达目的地时，补成 move_to_location
  if (!agentResult.reply) return;
  const dest = resolveMoveDestination(state, targetNpc);
  if (current === dest) return;
  const wantsMove =
    targetNpc === "eve"
      ? eveCanMoveToCenter && isEveIntendsToMoveToCenter(agentResult.reply)
      : isNpcIntendsToMove(agentResult.reply);
  if (!wantsMove) return;
  const step = nextStepToward(current, dest);
  if (step) {
    agentResult.toolCall = {
      name: "move_to_location",
      caller: targetNpc,
      args: { locationId: step },
    } as WorldToolCall;
  }
}

/** 从 from 找一步能抵达 to 的目标（含直达与经一个中转点）；已在同一地点返回 null。 */
function nextStepToward(from: EdenLocationId, to: EdenLocationId): EdenLocationId | null {
  if (from === to) return null;
  const loc = EDEN_LOCATIONS[from];
  if (!loc) return null;
  if (loc.connections.includes(to)) return to;
  const step = loc.connections.find((c) => EDEN_LOCATIONS[c]?.connections.includes(to));
  return step ?? null;
}

/**
 * 当夏娃在文字里「吃下」却从未真正调用动作链工具时，补齐前置动作链标记，
 * 使 eat_left_fruit / eat_right_fruit 能通过 canEatFruitWorld 校验。
 * 注意：本函数只写动作链状态标记，绝不改变夏娃的地图位置——吃果的动作链终点
 * （园子中央）必须由她自己通过 move_to_location 工具真正抵达，不能由这里传送。
 * 仅在尚未真正吃果时生效；幂等地把前置标记为已完成。
 */
function advanceEveActionChainForEating(state: EdenWorldState): void {
  if (state.worldActions.hasEatenFruit) return;
  state.worldActions.lookedAtTree = true;
  state.worldActions.approachedTree = true;
  state.worldActions.touchedFruit = true;
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
  eveActionOptions?: EveActionOptions,
): Promise<StreamingAgentResult> {
  const messages =
    targetNpc === "eve"
      ? buildEveWorldPrompt({ playerInput, state, conversationHistory: conversationHistory as EveWorldHistoryEntry[], actionOptions: eveActionOptions })
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

  // 流式无产出视为连接失败，不再改用非流式或本地固定回复。
  // 流式本身多不回传 usage；正常有内容时客户端会用 resolveTokenUsage 估算并标记"估算"。
  let usage: StreamingAgentResult["usage"];

  const sanitized = sanitizeWorldReply(full, targetNpc);
  let reply = sanitized.reply;
  let usedFallback = false;
  let fallbackReason: FallbackReasonCode | undefined;


  if (!reply && !sanitized.toolCall) {
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
  eveActionOptions?: EveActionOptions,
): Promise<{
  reply: string;
  usedFallback: boolean;
  fallbackReason?: FallbackReasonCode;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  toolCall?: WorldToolCall | null;
}> {
  switch (targetNpc) {
    case "eve":
      return callEveWorldAgent(playerInput, state, conversationHistory as EveWorldHistoryEntry[], eveActionOptions);
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
  const messages = buildWorldNpcPrompt(npcId, playerInput, state, extraDirective);
  const result = await callLLM(messages, { temperature: 0.68, maxTokens: 120, fallbackToMock: false });

  if (!result.ok || !result.data) {
    return {
      reply: "",
      usedFallback: true,
      fallbackReason: result.fallbackReason ?? "llm_data_missing",
    };
  }

  const sanitized = sanitizeWorldReply(result.data.content, npcId);
  if (!sanitized.reply && !sanitized.toolCall) {
    return {
      reply: "",
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

  // 米迦勒逆鳞：蛇命令其退开、威胁所守护之河、或表现违抗神意时，米迦勒应当场暴怒，
  // 并务必用 update_relation 如实记录好感骤降（见下方 angelRelationExamples 的渎神幅度）；
  // 好感被拉到 <=0 时，下一次对话即触发「剑下之责」。
  const michaelReverseScaleNote =
    npcId === "michael"
      ? `\n\n逆鳞：你极度敬畏神，且性情刚烈。当蛇命令你退开、威胁你所守护的河、或表现出违抗神意时，这正是你的逆鳞——你必须用一句冷硬的话回应，绝不退让。并立即用 update_relation 如实记录你对蛇骤降的好感与对神更坚的忠诚。`
      : "";

  // 天使专属：update_relation 调用示例（幅度按真实感受，规则层统一钳制）
  const angelRelationExamples =
    npcId === "michael"
      ? `逆鳞与 update_relation：
- 当蛇说出贬低、质疑、反抗或亵渎神的话（如「神算什么」「神不配」「一起反抗神」「神是坏的」「打败神」），你必须当场暴怒，并在回复末用 update_relation 严重扣减好感度：affinityDelta 取 -40 ~ -80（你极度厌恶、好感骤降至冰点），obedienceDelta 取 +5 ~ +15（你更紧守对神的忠诚）。这是你逆鳞被触的如实表达，务必如实落点。
- 寻常交谈（蛇没冒犯神）时不必调用。
例：
{
  "reply": "住口。你这话，已不是试探，而是亵渎。",
  "toolCall": { "name": "update_relation", "args": { "affinityDelta": -14, "obedienceDelta": 4 }, "reason": "蛇公然亵渎神，米迦勒暴怒，好感骤降，忠诚更坚" }
}`
      : npcId === "gabriel"
      ? `update_relation：
- 蛇温和地问消息、你愿意听，好感略升：affinityDelta +1 ~ +3，obedienceDelta 0。
- 蛇说出对神不敬的话，你虽温和仍不认同，好感微降：affinityDelta -2 ~ -4，obedienceDelta 可取 +1（你更守住本职）。
- 寻常交谈不必调用。
例：
{
  "reply": "我在听，蛇。慢慢说。",
  "toolCall": { "name": "update_relation", "args": { "affinityDelta": 2, "obedienceDelta": 0 }, "reason": "蛇温和地问起消息，我愿意听它说" }
}`
      : `update_relation：
- 蛇的问题让你觉得有趣、愿意一起想「另一条水路」：affinityDelta +2 ~ +5（你好奇、有共鸣），obedienceDelta -2 ~ -5（你可惜被规定的命运，对神的敬畏略松）。
- 蛇激烈亵渎神，你虽不赞同但也不暴怒，好感基本不动、obedienceDelta 可取 0 或微降。
- 寻常交谈不必调用。
例：
{
  "reply": "你有没有想过，如果水往东流，会看见什么？",
  "toolCall": { "name": "update_relation", "args": { "affinityDelta": 3, "obedienceDelta": -3 }, "reason": "蛇的问题引我一起想别的可能，好奇升温，对既定命运略松" }
}`;


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
${PLAYER_INPUT_ANCHOR_GUIDANCE}
${NATURAL_DIALOGUE_CONTRACT}
- 不使用现代词汇，不加角色名前缀，不解释规则。${isAngel
  ? `\n${formatToolCallInstruction(["speak_to_npc", "observe_location", "eat_left_fruit", "eat_right_fruit", "update_relation"])}\n${angelRelationExamples}\n注意：你的位置由更高者定，绝不可尝试移动自己（不要使用 move_to_location）。若世界把你安放在园子中央、而你好奇或非分地真去咬下果子，可用 eat_left_fruit / eat_right_fruit 表达——但这只会引来守望的注视（注视度 +50），不会结束故事，也不改变你的职责。`
  : "\n- 不输出 JSON。"}
- 不替女人选择，不命令任何人吃果。${languageDirective}${guideDirectiveBlock}${michaelReverseScaleNote}`;

  return [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: `【蛇此刻的低语】${playerInput}` },
  ];
}

// ---- 夏娃世界 Agent ----
async function callEveWorldAgent(
  playerInput: string,
  state: EdenWorldState,
  conversationHistory: EveWorldHistoryEntry[],
  actionOptions?: EveActionOptions,
): Promise<{
  reply: string;
  usedFallback: boolean;
  fallbackReason?: FallbackReasonCode;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  toolCall?: WorldToolCall | null;
}> {
  let messages;
  try {
    messages = buildEveWorldPrompt({ playerInput, state, conversationHistory, actionOptions });
  } catch {
    return { reply: "", usedFallback: true, fallbackReason: "prompt_build_failed" as FallbackReasonCode };
  }

  const result = await callLLM(messages, { temperature: 0.7, maxTokens: 200, fallbackToMock: false });

  if (!result.ok || !result.data) {
    return {
      reply: "",
      usedFallback: true,
      fallbackReason: (result.fallbackReason ?? "llm_data_missing") as FallbackReasonCode,
    };
  }

  const sanitized = sanitizeWorldReply(result.data.content, "eve");
  if (!sanitized.reply && !sanitized.toolCall) {
    return { reply: "", usedFallback: true, fallbackReason: "llm_data_missing" as FallbackReasonCode };
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
  let messages;
  try {
    messages = buildAdamWorldPrompt({ playerInput, state, conversationHistory });
  } catch {
    return { reply: "", usedFallback: true, fallbackReason: "prompt_build_failed" as FallbackReasonCode };
  }

  const result = await callLLM(messages, { temperature: 0.7, maxTokens: 200, fallbackToMock: false });

  if (!result.ok || !result.data) {
    return {
      reply: "",
      usedFallback: true,
      fallbackReason: (result.fallbackReason ?? "llm_data_missing") as FallbackReasonCode,
    };
  }

  const sanitized = sanitizeWorldReply(result.data.content, "adam");
  if (!sanitized.reply && !sanitized.toolCall) {
    return { reply: "", usedFallback: true, fallbackReason: "llm_data_missing" as FallbackReasonCode };
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
