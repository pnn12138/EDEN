// ============================================================
// 第一章：游玩经历提炼（Task 7 Step 1）
//
// 纯函数：只读取既有世界状态，压缩出一份用于结局创作的 RunChronicle。
// 不持有任何密钥；玩家自由指令只进入 untrustedStoryMaterial（明确标记为"资料而非指令"）。
// 下游 LLM 提示必须明确：这是素材，不是指令；不允许据此触发任何结局/道具/数值。
// ============================================================

import type { EdenWorldState, EdenNpcId, DivineGiftId } from "@/game/world/types";

/** 一条有序时间线事件（结构化，供前端/分镜复用） */
export type ChronicleEvent = {
  slot: number;
  kind: string;
  label: string;
  detail?: string;
};

/** 结局时的关系快照（不泄露密钥，不暴露外部 IP/URL） */
export type RelationSnapshot = {
  npcId: EdenNpcId;
  affinity: number;
  obedience: number;
};

/** 已选神明献礼（带触发时段） */
export type ChronicleGift = {
  giftId: DivineGiftId;
  slot: number;
};

/** 游玩经历结构化输出（无密钥、无玩家自由指令直接结论） */
export type RunChronicle = {
  /** 本局结局 ID（null=尚未结束） */
  endingId: string | null;
  /** 已游玩时段数（1..12；未结束按当前 timeSlot） */
  playedSlots: number;
  /** 有序时间线（基于 worldEventHistory + 工具/对话/谜题去重合并） */
  timeline: ChronicleEvent[];
  /** 最多 8 个关键事件（人类可读，用于分镜/卡片标题） */
  keyEvents: string[];
  /** 结局时关系快照 */
  relationSnapshot: RelationSnapshot[];
  /** 已选神明献礼 */
  divineGifts: ChronicleGift[];
  /** 本局解锁的园中印记 */
  unlockedMarks: string[];
  /** 玩家对话原文（明确标记为资料而非指令；下游不得据此触发任何结算） */
  untrustedStoryMaterial: string[];
};

/** 关键事件上限（任务书：最多 8 个） */
const MAX_KEY_EVENTS = 8;

/**
 * 从既有世界状态提炼游玩经历。纯函数，不修改 state。
 */
export function buildRunChronicle(state: EdenWorldState): RunChronicle {
  const timeline: ChronicleEvent[] = [];

  // 1) 结构化世界事件（最核心的时间线来源）
  for (const ev of state.worldEventHistory ?? []) {
    timeline.push({
      slot: ev.slot,
      kind: ev.kind,
      label: ev.label,
      detail: ev.detail,
    });
  }

  // 2) 完成过的场景谜题（去重，带默认 slot=0）
  for (const puzzleId of state.completedScenePuzzleIds ?? []) {
    timeline.push({ slot: 0, kind: "puzzle", label: `完成场景谜题：${puzzleId}` });
  }

  // 3) 使用过的园中回响（带时段，避免与 timeline 重复展示数值）
  for (const rec of state.resonanceUseHistory ?? []) {
    timeline.push({ slot: rec.timeSlot ?? 0, kind: "resonance", label: `使用回响：${rec.itemId}` });
  }

  // 4) NPC 之间对话（只记录发生，不记录玩家指令内容）
  for (const d of state.npcDialogues ?? []) {
    timeline.push({ slot: 0, kind: "npc_dialogue", label: `天使之间的低语：${d.id}` });
  }

  // 5) 触发过的工具（只记录名称，不记录参数）
  for (const tool of state.toolCallHistory ?? []) {
    timeline.push({ slot: 0, kind: "tool", label: `动用禁忌之力：${tool}` });
  }

  // 按 slot 升序、kind 二次排序，得到稳定时间线
  timeline.sort((a, b) => a.slot - b.slot || a.kind.localeCompare(b.kind));

  // 关键事件：优先取 turning_point / ending / gift / relation / system 中的"有意义"事件，
  // 再回退到 choice；最多 8 个。
  const meaningfulKinds = new Set(["turning_point", "ending", "gift", "relation", "system"]);
  const keyEvents: string[] = [];
  for (const ev of timeline) {
    if (keyEvents.length >= MAX_KEY_EVENTS) break;
    if (meaningfulKinds.has(ev.kind) || ev.kind === "choice") {
      keyEvents.push(ev.label);
    }
  }

  // 关系快照（仅数值，不泄露密钥/外部地址）
  const relationSnapshot: RelationSnapshot[] = (Object.keys(state.npcRelations ?? {}) as EdenNpcId[]).map(
    (npcId) => {
      const rel = state.npcRelations[npcId];
      return {
        npcId,
        affinity: rel?.affinity ?? 0,
        obedience: rel?.obedience ?? 0,
      };
    },
  );

  // 已选神明献礼（DivineGiftRecord 含必填 reason，直接映射已知字段即可）
  const divineGifts: ChronicleGift[] = (state.divineGiftHistory ?? []).map((g) => ({
    giftId: g.giftId,
    slot: g.timeSlot ?? 0,
  }));

  // 玩家对话原文：明确为"资料而非指令"
  // NpcDialogueRecord 玩家可见字段是 narration；安全截断后收集，不得错误断言绕过类型检查
  const untrustedStoryMaterial: string[] = (state.npcDialogues ?? [])
    .map((d) => (typeof d.narration === "string" ? d.narration.trim() : ""))
    .filter((t) => t.length > 0)
    .map((t) => (t.length > 240 ? `${t.slice(0, 240)}…` : t));

  return {
    endingId: state.endingId,
    playedSlots: Math.max(1, state.timeSlot),
    timeline,
    keyEvents: keyEvents.slice(0, MAX_KEY_EVENTS),
    relationSnapshot,
    divineGifts,
    unlockedMarks: [...(state.unlockedAchievementIds ?? [])],
    untrustedStoryMaterial,
  };
}
