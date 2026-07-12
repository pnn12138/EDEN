// ============================================================
// 第一章：世界存档 hook（localStorage，纯前端）
//
// 非侵入式抽取：将 page.tsx 中的 localStorage 读写逻辑
// 统一到本 hook。支持四槽位独立存档，旧单存档自动迁移到槽位 1。
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

function normalizeWorldStateForClient(s: EdenWorldState): EdenWorldState {
  return normalizePuzzleState({
    ...s,
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
    actionsThisSlot: {
      whisperedNpcIds: [...(s.actionsThisSlot?.whisperedNpcIds ?? [])],
      sceneActionIds: [...(s.actionsThisSlot?.sceneActionIds ?? [])],
      usedItemIds: [...(s.actionsThisSlot?.usedItemIds ?? [])],
      hasWhisperedToWoman: s.actionsThisSlot?.hasWhisperedToWoman ?? false,
    },
  });
}

/** 读取单个槽位（校验章节一致） */
function readSlotRaw(i: SaveSlotIndex): WorldSaveSlotData | null {
  try {
    const raw = window.localStorage.getItem(slotKey(i));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorldSaveSlotData;
    if (parsed?.state?.chapterId !== "chapter1_garden_voices") return null;
    return parsed;
  } catch {
    return null;
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

  // ---- 挂载：迁移旧存档 + 自动读取上次活跃槽（默认槽位 1）----
  useEffect(() => {
    migrateLegacy();
    const target: SaveSlotIndex = lastActiveSlotRef.current ?? 1;
    const data = readSlotRaw(target);
    if (data) {
      onLoad(normalizeWorldStateForClient(data.state));
      setLastActiveSlot(target);
      lastActiveSlotRef.current = target;
      setLastSavedAt(formatClock(new Date(data.savedAt)));
    }
    setLoaded(true);
    onAfterLoad();
    // 仅挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 状态变化后标记未保存 ----
  useEffect(() => {
    if (!loaded) return;
    if (firstApply.current) {
      firstApply.current = false;
      return;
    }
    dirtyRef.current = true;
    setDirty(true);
  }, [state, loaded]);

  // ---- 每 5 分钟自动保存一次（写入上次活跃槽，无则槽位 1）----
  useEffect(() => {
    const id = window.setInterval(() => {
      const target = lastActiveSlotRef.current ?? 1;
      try {
        const data: WorldSaveSlotData = {
          state: stateRef.current,
          savedAt: new Date().toISOString(),
          slotIndex: target,
        };
        window.localStorage.setItem(slotKey(target), JSON.stringify(data));
        setLastSavedAt(formatClock());
        dirtyRef.current = false;
        setDirty(false);
      } catch {
        /* 忽略写入失败 */
      }
    }, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const save = useCallback((i: SaveSlotIndex) => {
    try {
      const data: WorldSaveSlotData = {
        state: stateRef.current,
        savedAt: new Date().toISOString(),
        slotIndex: i,
      };
      window.localStorage.setItem(slotKey(i), JSON.stringify(data));
      setLastActiveSlot(i);
      lastActiveSlotRef.current = i;
      setLastSavedAt(formatClock());
      dirtyRef.current = false;
      setDirty(false);
    } catch {
      /* 忽略写入失败 */
    }
  }, []);

  const load = useCallback(
    (i: SaveSlotIndex) => {
      const data = readSlotRaw(i);
      if (data) {
        onLoad(normalizeWorldStateForClient(data.state));
        setLastActiveSlot(i);
        lastActiveSlotRef.current = i;
        setLastSavedAt(formatClock(new Date(data.savedAt)));
        dirtyRef.current = false;
        setDirty(false);
      }
    },
    [onLoad],
  );

  const reset = useCallback(() => {
    SAVE_SLOTS.forEach((i) => {
      try {
        window.localStorage.removeItem(slotKey(i));
      } catch {
        /* noop */
      }
    });
    try {
      window.localStorage.removeItem(LEGACY_WORLD_STATE_KEY);
      AUX_KEYS_TO_CLEAR.forEach((k) => window.localStorage.removeItem(k));
    } catch {
      /* noop */
    }
    setLastSavedAt(null);
    setLastActiveSlot(null);
    lastActiveSlotRef.current = null;
    dirtyRef.current = false;
    setDirty(false);
    onReset();
  }, [onReset]);

  /** 槽位摘要（UI 用），每次调用读取 4 个槽位 */
  const getSlotMetas = useCallback((): SaveSlotMeta[] => {
    return SAVE_SLOTS.map((i) => {
      const data = readSlotRaw(i);
      if (!data) {
        return {
          index: i,
          empty: true,
          savedAtLabel: null,
          chapterSceneLabel: null,
          timeSlotLabel: null,
        };
      }
      const s = data.state;
      return {
        index: i,
        empty: false,
        savedAtLabel: formatClock(new Date(data.savedAt)),
        chapterSceneLabel: `第一章 · ${LOCATION_NAMES[s.locationId] ?? s.locationId}`,
        timeSlotLabel: timeSlotDisplay(s.timeSlot, s.dayIndex, s.timeOfDay),
      };
    });
  }, []);

  const hasAnySave = useCallback((): boolean => {
    return SAVE_SLOTS.some((i) => readSlotRaw(i) !== null);
  }, []);

  return {
    lastSavedAt,
    dirty,
    loaded,
    lastActiveSlot,
    save,
    load,
    reset,
    getSlotMetas,
    hasAnySave,
  };
}
