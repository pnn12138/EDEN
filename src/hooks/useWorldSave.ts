// ============================================================
// 第一章：世界存档 hook（localStorage，纯前端）
//
// 非侵入式抽取：将 page.tsx 中的 localStorage 读写逻辑
// 统一到本 hook。保持键名与数据格式与原有完全一致，
// 兼容旧存档；不改变游戏状态结构。
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { EdenWorldState } from "@/game/world/types";
import { normalizePuzzleState } from "@/game/world/puzzleRules";

// 与 page.tsx 中本地定义保持一致（不修改规则层）
function normalizeWorldStateForClient(s: EdenWorldState): EdenWorldState {
  return normalizePuzzleState({
    ...s,
    apMaxBonusBase: s.apMaxBonusBase ?? 0,
    apMaxBonusDay: s.apMaxBonusDay ?? 0,
    divineThresholdModifier: s.divineThresholdModifier ?? 0,
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

/** 与原有完全一致的 localStorage 键名 */
export const WORLD_STATE_STORAGE_KEY = "eden:chapter1:world-state:v2";

function formatClock(d: Date = new Date()): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
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

function tryNormalize(raw: string | null): EdenWorldState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as EdenWorldState;
    if (parsed.chapterId !== "chapter1_garden_voices") return null;
    return normalizeWorldStateForClient(parsed);
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

  // ---- 挂载时读取存档 ----
  useEffect(() => {
    const normalized = tryNormalize(window.localStorage.getItem(WORLD_STATE_STORAGE_KEY));
    if (normalized) {
      onLoad(normalized);
    } else if (window.localStorage.getItem(WORLD_STATE_STORAGE_KEY)) {
      // 旧版本 / 不兼容存档 → 清除
      try {
        window.localStorage.removeItem(WORLD_STATE_STORAGE_KEY);
      } catch {
        /* noop */
      }
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

  // ---- 每 5 分钟自动保存一次（不依赖手动保存） ----
  useEffect(() => {
    const id = window.setInterval(() => {
      try {
        window.localStorage.setItem(
          WORLD_STATE_STORAGE_KEY,
          JSON.stringify(stateRef.current),
        );
        setLastSavedAt(formatClock());
        dirtyRef.current = false;
        setDirty(false);
      } catch {
        /* 忽略写入失败 */
      }
    }, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const save = useCallback(() => {
    try {
      window.localStorage.setItem(
        WORLD_STATE_STORAGE_KEY,
        JSON.stringify(stateRef.current),
      );
      setLastSavedAt(formatClock());
      dirtyRef.current = false;
      setDirty(false);
    } catch {
      /* 忽略写入失败 */
    }
  }, []);

  const load = useCallback(() => {
    const normalized = tryNormalize(window.localStorage.getItem(WORLD_STATE_STORAGE_KEY));
    if (normalized) onLoad(normalized);
  }, [onLoad]);

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(WORLD_STATE_STORAGE_KEY);
      // 模块1：重置后重新显示开场弹窗
      window.localStorage.removeItem("eden:world:global_intro_shown");
      // 模块4：重置词元统计
      window.localStorage.removeItem("eden:world:polish-tokens");
    } catch {
      /* noop */
    }
    setLastSavedAt(null);
    dirtyRef.current = false;
    setDirty(false);
    onReset();
  }, [onReset]);

  return { lastSavedAt, dirty, loaded, save, load, reset };
}
