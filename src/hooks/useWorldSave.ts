// ============================================================
// 第一章：世界存档 hook（localStorage，纯前端）
//
// 非侵入式抽取：将 page.tsx 中的 localStorage 读写逻辑
// 统一到本 hook。支持四槽位独立存档，旧单存档自动迁移到槽位 1。
//
// 稳定性增强（doc 19 遗留修复 + 成熟度优化）：
// - lastActiveSlot 跨会话持久化（eden:chapter1:save:last-active）。
// - 5 分钟自动保存写入独立 key（eden:chapter1:autosave），不覆盖四手动槽。
// - load() 内置 loadingRef，跳过下一次 dirty effect（读取后不再误标未保存）。
// - 损坏存档不再静默清除：readSlotDetailed 区分为 ok / empty / corrupt。
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { EdenWorldState } from "@/game/world/types";
import { normalizePuzzleState } from "@/game/world/puzzleRules";
import { LOCATION_NAMES } from "@/content/world/locations";

// ---- 四槽位存储 ----
export const SAVE_SLOTS = [1, 2, 3, 4] as const;
export type SaveSlotIndex = (typeof SAVE_SLOTS)[number];

/** 每个槽位的存储包装（不仅存 state，还存保存时间） */
export type WorldSaveSlotData = {
  state: EdenWorldState;
  savedAt: string; // ISO 字符串
  slotIndex: SaveSlotIndex;
};

/** 槽位 i 的存储 key */
export function slotKey(i: SaveSlotIndex): string {
  return `eden:chapter1:save:slot${i}`;
}

/** 最近活跃槽位（跨会话持久化，避免每次刷新都回退到槽位 1） */
export const LAST_ACTIVE_KEY = "eden:chapter1:save:last-active";

/** 5 分钟自动保存：独立 key，不覆盖四个手动槽 */
export const AUTOSAVE_KEY = "eden:chapter1:autosave";

/** 旧单存档 key（迁移后删除） */
export const LEGACY_WORLD_STATE_KEY = "eden:chapter1:world-state:v2";

/** 辅助 key（重新开始时一并清理） */
export const AUX_KEYS_TO_CLEAR = [
  "eden:world:global_intro_shown",
  "eden:world:polish-tokens",
];

/** 槽位摘要（UI 展示用） */
export type SaveSlotMeta = {
  index: SaveSlotIndex;
  empty: boolean;
  /** 该槽位存档损坏（不可解析或非本章节数据），保留不删除 */
  corrupted?: boolean;
  savedAtLabel: string | null;
  chapterSceneLabel: string | null;
  timeSlotLabel: string | null;
};

function formatClock(d: Date = new Date()): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function timeSlotDisplay(timeSlot: number, dayIndex: number, timeOfDay: string): string {
  const dayNames = ["", "周一", "周二", "周三", "周四", "周五", "周六"];
  const timeLabel = timeOfDay === "night" ? "夜晚" : "白天";
  return `时段 ${timeSlot}/12 · ${dayNames[dayIndex] ?? ""} ${timeLabel}`;
}

type UseWorldSaveOptions = {
  state: EdenWorldState;
  /** 从存档恢复时回调（上层据此更新 state + 地图位置） */
  onLoad: (s: EdenWorldState) => void;
  /** 加载流程结束（无论有无存档）时回调 */
  onAfterLoad: () => void;
  /** 重置时回调（上层重置 state 与所有 UI 状态） */
  onReset: () => void;
};

/**
 * 清空全部本地存档（四手动槽 + 旧单存档 + 辅助 key + 自动保存 + 最近活跃槽）。
 * 主页「开始新游戏」与 useWorldSave.reset 共用，杜绝漏清某一类存档
 * （早期 bug：漏清 autosave，导致新游戏仍加载到旧 autosave 进度、跳过开场白）。
 */
export function clearAllWorldSaves(): void {
  try {
    SAVE_SLOTS.forEach((i) => window.localStorage.removeItem(slotKey(i)));
    window.localStorage.removeItem(LEGACY_WORLD_STATE_KEY);
    AUX_KEYS_TO_CLEAR.forEach((k) => window.localStorage.removeItem(k));
    window.localStorage.removeItem(AUTOSAVE_KEY);
    window.localStorage.removeItem(LAST_ACTIVE_KEY);
  } catch {
    /* localStorage 不可用时静默忽略 */
  }
}

function normalizeWorldStateForClient(s: EdenWorldState): EdenWorldState {
  // 旧版润色 token 累计迁移到 tokenStats.polishTotal（仅当本局润色累计为 0 时补，避免重复累加）
  let migratedPolish = 0;
  try {
    const legacy = window.localStorage.getItem("eden:world:polish-tokens");
    if (legacy) migratedPolish = Number(legacy) || 0;
  } catch {
    /* localStorage 不可用时静默忽略 */
  }
  const tokenStats = s.tokenStats ?? {
    dialogueThisSlot: 0,
    dialogueTotal: 0,
    polishTotal: 0,
    lastDialogueTokens: 0,
    lastPolishTokens: 0,
    hasEstimate: false,
    dialoguePromptTotal: 0,
    dialogueCompletionTotal: 0,
  };
  if (migratedPolish > 0 && tokenStats.polishTotal === 0) {
    tokenStats.polishTotal = migratedPolish;
    try {
      window.localStorage.removeItem("eden:world:polish-tokens");
    } catch {
      /* ignore */
    }
  }
  return normalizePuzzleState({
    ...s,
    tokenStats,
    apMaxBonusBase: s.apMaxBonusBase ?? 0,
    apMaxBonusDay: s.apMaxBonusDay ?? 0,
    divineThresholdModifier: s.divineThresholdModifier ?? 0,
    playerName: s.playerName ?? "",
    unlockMapNpcLocations: s.unlockMapNpcLocations ?? false,
    unlockTreeNames: s.unlockTreeNames ?? false,
    itemCounts: { ...(s.itemCounts ?? {}) },
    pendingConsumableEffects: (s.pendingConsumableEffects ?? []).map((effect) => ({ ...effect })),
    resonanceUseHistory: (s.resonanceUseHistory ?? []).map((record) => ({ ...record })),
    divineGiftHistory: (s.divineGiftHistory ?? []).map((record) => ({ ...record })),
    michaelSlayClaimed: s.michaelSlayClaimed ?? false,
    luciferAwakenClaimed: s.luciferAwakenClaimed ?? false,
    hiddenTopicIds: [...(s.hiddenTopicIds ?? [])],
    actionsThisSlot: {
      whisperedNpcIds: [...(s.actionsThisSlot?.whisperedNpcIds ?? [])],
      sceneActionIds: [...(s.actionsThisSlot?.sceneActionIds ?? [])],
      usedItemIds: [...(s.actionsThisSlot?.usedItemIds ?? [])],
      hasWhisperedToWoman: s.actionsThisSlot?.hasWhisperedToWoman ?? false,
      hasGrantedPaidDayMoveAttention: s.actionsThisSlot?.hasGrantedPaidDayMoveAttention ?? false,
      hasGrantedPaidNightDialogueAttention: s.actionsThisSlot?.hasGrantedPaidNightDialogueAttention ?? false,
      moveCount: s.actionsThisSlot?.moveCount ?? 0,
    },
    divineAttentionValue: s.divineAttentionValue ?? 0,
    pendingDivineGiftChoice: s.pendingDivineGiftChoice ?? null,
    unlockedDivineAttentionRuleIds: [...(s.unlockedDivineAttentionRuleIds ?? [])],
    attentionRuleTriggerCounts: { ...(s.attentionRuleTriggerCounts ?? {}) },
    michaelDivinePunishmentActive: s.michaelDivinePunishmentActive ?? false,
    michaelExecutionPending: s.michaelExecutionPending ?? false,
    luciferZeroAffinityGiftClaimed: s.luciferZeroAffinityGiftClaimed ?? false,
    luciferSwimStage: s.luciferSwimStage ?? "none",
    worldEventHistory: (s.worldEventHistory ?? []).map((e) => ({ ...e })),
  });
}

/** 槽位读取结果：区分 空 / 正常 / 损坏 */
type SlotReadResult =
  | { status: "empty" }
  | { status: "ok"; data: WorldSaveSlotData }
  | { status: "corrupt" };

/** 读取单个槽位（区分损坏与缺失，损坏保留不删除） */
function readSlotDetailed(i: SaveSlotIndex): SlotReadResult {
  try {
    const raw = window.localStorage.getItem(slotKey(i));
    if (!raw) return { status: "empty" };
    const parsed = JSON.parse(raw) as WorldSaveSlotData;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.state ||
      parsed.state.chapterId !== "chapter1_garden_voices"
    ) {
      return { status: "corrupt" };
    }
    return { status: "ok", data: parsed };
  } catch {
    // key 存在但无法解析：视为损坏，保留以便用户感知
    return { status: "corrupt" };
  }
}

/** 读取自动保存（独立 key） */
function readAutosave(): { state: EdenWorldState; savedAt: string } | null {
  try {
    const raw = window.localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: EdenWorldState; savedAt?: string };
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.state ||
      parsed.state.chapterId !== "chapter1_garden_voices"
    ) {
      return null;
    }
    return {
      state: parsed.state,
      savedAt: parsed.savedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** 读取持久化的「最近活跃槽位」 */
function readLastActiveSlot(): SaveSlotIndex | null {
  try {
    const v = window.localStorage.getItem(LAST_ACTIVE_KEY);
    if (v === "1" || v === "2" || v === "3" || v === "4") {
      return Number(v) as SaveSlotIndex;
    }
  } catch {
    /* noop */
  }
  return null;
}

/** 供首页存档选择器读取的四个手动槽位摘要（不包含后台自动保存）。 */
export function getWorldSaveSlotMetas(): SaveSlotMeta[] {
  return SAVE_SLOTS.map((i) => {
    const r = readSlotDetailed(i);
    if (r.status === "ok") {
      const s = r.data.state;
      return {
        index: i,
        empty: false,
        corrupted: false,
        savedAtLabel: formatClock(new Date(r.data.savedAt)),
        chapterSceneLabel: `第一章 · ${LOCATION_NAMES[s.locationId] ?? s.locationId}`,
        timeSlotLabel: timeSlotDisplay(s.timeSlot, s.dayIndex, s.timeOfDay),
      };
    }
    return {
      index: i,
      empty: r.status === "empty",
      corrupted: r.status === "corrupt",
      savedAtLabel: null,
      chapterSceneLabel: null,
      timeSlotLabel: null,
    };
  });
}

/** 选择下次进入世界时应优先读取的手动槽位。 */
export function selectWorldSaveSlot(i: SaveSlotIndex): void {
  try {
    window.localStorage.setItem(LAST_ACTIVE_KEY, String(i));
  } catch {
    /* localStorage 不可用时由世界页按常规优先级读取 */
  }
}

export function useWorldSave({
  state,
  onLoad,
  onAfterLoad,
  onReset,
}: UseWorldSaveOptions) {
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const firstApply = useRef(true);
  const loadingRef = useRef(false);
  const lastActiveSlotRef = useRef<SaveSlotIndex | null>(null);
  const [lastActiveSlot, setLastActiveSlot] = useState<SaveSlotIndex | null>(null);

  /** 旧单存档 -> 槽位 1 迁移（读档链路 normalizer，不用 withNpcWorldDefaults） */
  const migrateLegacy = useCallback(() => {
    try {
      const legacy = window.localStorage.getItem(LEGACY_WORLD_STATE_KEY);
      if (!legacy) return;
      if (window.localStorage.getItem(slotKey(1))) return; // 槽位 1 已有，不覆盖
      const parsed = JSON.parse(legacy) as EdenWorldState;
      if (parsed?.chapterId !== "chapter1_garden_voices") return;
      const normalized = normalizeWorldStateForClient(parsed);
      const data: WorldSaveSlotData = {
        state: normalized,
        savedAt: new Date().toISOString(),
        slotIndex: 1,
      };
      window.localStorage.setItem(slotKey(1), JSON.stringify(data));
      window.localStorage.removeItem(LEGACY_WORLD_STATE_KEY);
    } catch {
      /* noop */
    }
  }, []);

  // ---- 挂载：迁移旧存档 + 按优先级读取（last-active 槽 → 任一正常槽 → 自动保存）----
  useEffect(() => {
    migrateLegacy();

    const persistedLast = readLastActiveSlot();
    let target: SaveSlotIndex | null = null;
    if (persistedLast && readSlotDetailed(persistedLast).status === "ok") {
      target = persistedLast;
    } else {
      const firstOk = SAVE_SLOTS.find((i) => readSlotDetailed(i).status === "ok");
      if (firstOk) target = firstOk;
    }

    if (target) {
      const r = readSlotDetailed(target);
      if (r.status === "ok") {
        onLoad(normalizeWorldStateForClient(r.data.state));
        setLastActiveSlot(target);
        lastActiveSlotRef.current = target;
        setLastSavedAt(formatClock(new Date(r.data.savedAt)));
      }
    } else {
      // 无手动槽：尝试自动保存恢复（不计入 dirty）
      const auto = readAutosave();
      if (auto) {
        onLoad(normalizeWorldStateForClient(auto.state));
        setLastSavedAt(formatClock(new Date(auto.savedAt)));
      }
    }

    setLoaded(true);
    onAfterLoad();
    // 仅挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 状态变化后标记未保存（首次挂载 / 读取加载时跳过）----
  useEffect(() => {
    if (!loaded) return;
    if (firstApply.current) {
      firstApply.current = false;
      return;
    }
    if (loadingRef.current) {
      loadingRef.current = false;
      return;
    }
    dirtyRef.current = true;
    setDirty(true);
  }, [state, loaded]);

  // ---- 每 5 分钟自动保存一次：写入独立 autosave key，绝不覆盖四个手动槽 ----
  useEffect(() => {
    const id = window.setInterval(() => {
      try {
        const payload = {
          state: stateRef.current,
          savedAt: new Date().toISOString(),
        };
        window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
      } catch {
        /* 自动保存失败静默处理，不干扰玩家 */
      }
    }, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  /**
   * 保存到指定手动槽。返回是否成功（失败多为 localStorage 不可用）。
   * 同时持久化 last-active 槽位。
   */
  const save = useCallback((i: SaveSlotIndex): boolean => {
    try {
      const data: WorldSaveSlotData = {
        state: stateRef.current,
        savedAt: new Date().toISOString(),
        slotIndex: i,
      };
      window.localStorage.setItem(slotKey(i), JSON.stringify(data));
      window.localStorage.setItem(LAST_ACTIVE_KEY, String(i));
      setLastActiveSlot(i);
      lastActiveSlotRef.current = i;
      setLastSavedAt(formatClock());
      dirtyRef.current = false;
      setDirty(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  /**
   * 从指定手动槽读取。返回是否成功：
   * - 槽位损坏 / 不存在 → 返回 false（由调用方提示，不修改当前状态）。
   * - 成功 → 标记 loadingRef 跳过下一次 dirty effect（读取后不再误标未保存）。
   */
  const load = useCallback(
    (i: SaveSlotIndex): boolean => {
      const r = readSlotDetailed(i);
      if (r.status !== "ok") return false;
      loadingRef.current = true;
      onLoad(normalizeWorldStateForClient(r.data.state));
      window.localStorage.setItem(LAST_ACTIVE_KEY, String(i));
      setLastActiveSlot(i);
      lastActiveSlotRef.current = i;
      setLastSavedAt(formatClock(new Date(r.data.savedAt)));
      dirtyRef.current = false;
      setDirty(false);
      return true;
    },
    [onLoad],
  );

  const reset = useCallback(() => {
    clearAllWorldSaves();
    setLastSavedAt(null);
    setLastActiveSlot(null);
    lastActiveSlotRef.current = null;
    dirtyRef.current = false;
    setDirty(false);
    onReset();
  }, [onReset]);

  /** 删除指定手动槽（保留其它槽与 autosave；损坏槽也可删除）。dirty 状态不受影响。 */
  const deleteSlot = useCallback((i: SaveSlotIndex): void => {
    try {
      window.localStorage.removeItem(slotKey(i));
    } catch {
      /* localStorage 不可用时静默忽略 */
    }
  }, []);

  /** 槽位摘要（UI 用），每次调用读取 4 个槽位（不含 autosave） */
  const getSlotMetas = useCallback((): SaveSlotMeta[] => {
    return getWorldSaveSlotMetas();
  }, []);

  /** 是否存在任一「正常」手动存档（不含 autosave） */
  const hasAnySave = useCallback((): boolean => {
    return SAVE_SLOTS.some((i) => readSlotDetailed(i).status === "ok");
  }, []);

  /** 是否存在任一存档（含损坏槽与 autosave），用于首页「读取最近存档」可用性判断 */
  const hasAnySaveIncludingAutosave = useCallback((): boolean => {
    const manual = SAVE_SLOTS.some((i) => readSlotDetailed(i).status !== "empty");
    return manual || readAutosave() !== null;
  }, []);

  return {
    lastSavedAt,
    dirty,
    loaded,
    lastActiveSlot,
    save,
    load,
    deleteSlot,
    reset,
    getSlotMetas,
    hasAnySave,
    hasAnySaveIncludingAutosave,
  };
}
