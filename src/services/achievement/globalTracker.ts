// ============================================================
// 跨局印记追踪（纯前端 localStorage，不混入游戏存档）
//
// 用途：记录跨多个游戏会话才能达成的印记条件，例如：
//   - mark_echo_collector：跨局累计收集到的不同回响
//   - mark_all_ending：跨局触发过的不同普通结局
//
// 设计文档《ACHIEVEMENT_GARDEN_MARK.md》把 28 个印记分为
// 普通 / 隐藏两类，其中少量印记需要跨局累计。这些累计数据
// 用独立 localStorage 键 eden:global:achievements 存储，
// 与游戏存档（eden:chapter1:world-state:v2）完全分离。
//
// 本模块是「客户端」模块：所有 localStorage 访问都包在
// isBrowser() 守卫内，因此被规则层（服务端）导入时不会报错，
// readGlobalSnapshot() 在服务端安全返回 null。
// ============================================================

import type { EdenWorldState, AchievementId, EdenNpcId } from "@/game/world/types";

const GLOBAL_ACH_KEY = "eden:global:achievements";

export type GlobalAchievementData = {
  /** 跨局累计收集到的不同回响 ID（去重） */
  collectedResonanceIds: string[];
  /** 跨局触发过的结局 ID（普通结局：成功 / 失败 / 生命果） */
  triggeredEndingIds: string[];
  /** 本会话内神的注视峰值（随客户端 sync 更新） */
  maxDivineAttention: number;
  /** 已解锁的跨局印记（持久化，供图鉴展示） */
  unlockedCrossSessionMarkIds: AchievementId[];
  /** 印记解锁时间（markId -> ISO 时间字符串），供图鉴展示 */
  unlockedAt: Record<string, string>;
};

const DEFAULT_DATA: GlobalAchievementData = {
  collectedResonanceIds: [],
  triggeredEndingIds: [],
  maxDivineAttention: 0,
  unlockedCrossSessionMarkIds: [],
  unlockedAt: {},
};

/** 供规则层只读判定的快照；服务端返回 null */
export type GlobalAchievementSnapshot = {
  collectedResonanceCount: number;
  triggeredEndingIds: string[];
  maxDivineAttention: number;
};

/** 普通结局集合（生命果结局在代码中以 worldActions.hasEatenLifeFruit 表示，需撑到时段结束） */
export const NORMAL_ENDING_IDS = ["eve_eats_fruit", "god_arrives", "life_fruit"] as const;

/**
 * 回声收藏家阈值。
 * 设计文档原始目标为「跨局累计 30 种」，但本作可获取回响池总量有限
 * （约 25 个），30 在技术上不可达，故下调为 18 以保证多周目可达成。
 */
export const ECHO_COLLECTOR_THRESHOLD = 18;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readGlobalSnapshot(): GlobalAchievementSnapshot | null {
  if (!isBrowser()) return null;
  const data = readData();
  return {
    collectedResonanceCount: data.collectedResonanceIds.length,
    triggeredEndingIds: data.triggeredEndingIds,
    maxDivineAttention: data.maxDivineAttention,
  };
}

function readData(): GlobalAchievementData {
  if (!isBrowser()) return { ...DEFAULT_DATA };
  try {
    const raw = window.localStorage.getItem(GLOBAL_ACH_KEY);
    if (!raw) return { ...DEFAULT_DATA };
    const parsed = JSON.parse(raw) as Partial<GlobalAchievementData>;
    return {
      collectedResonanceIds: Array.isArray(parsed.collectedResonanceIds)
        ? parsed.collectedResonanceIds
        : [],
      triggeredEndingIds: Array.isArray(parsed.triggeredEndingIds)
        ? parsed.triggeredEndingIds
        : [],
      maxDivineAttention:
        typeof parsed.maxDivineAttention === "number" ? parsed.maxDivineAttention : 0,
      unlockedCrossSessionMarkIds: Array.isArray(parsed.unlockedCrossSessionMarkIds)
        ? (parsed.unlockedCrossSessionMarkIds as AchievementId[])
        : [],
      unlockedAt:
        parsed.unlockedAt && typeof parsed.unlockedAt === "object"
          ? (parsed.unlockedAt as Record<string, string>)
          : {},
    };
  } catch {
    return { ...DEFAULT_DATA };
  }
}

function writeData(data: GlobalAchievementData): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(GLOBAL_ACH_KEY, JSON.stringify(data));
  } catch {
    /* 忽略写入失败（隐私模式等） */
  }
}

/** 根据累计数据计算已解锁的跨局印记 */
export function evaluateCrossSessionMarks(data: GlobalAchievementData): AchievementId[] {
  const unlocked: AchievementId[] = [];

  if (data.collectedResonanceIds.length >= ECHO_COLLECTOR_THRESHOLD) {
    unlocked.push("mark_echo_collector");
  }

  const distinctEndings = new Set(
    data.triggeredEndingIds.filter((id) => (NORMAL_ENDING_IDS as readonly string[]).includes(id)),
  );
  if (distinctEndings.size >= 3) {
    unlocked.push("mark_all_ending");
  }

  return unlocked;
}

/**
 * 用当前世界状态刷新跨局累计数据，并回写已解锁的跨局印记。
 * 应在客户端调用（世界页 effect、图鉴页挂载时）。
 * 返回本次累计后「应视为已解锁」的跨局印记 ID 列表。
 */
export function syncFromWorldState(state: EdenWorldState): AchievementId[] {
  if (!isBrowser()) return [];
  const data = readData();

  // 合并本局收集到的回响（去重累计）
  const resonanceSet = new Set(data.collectedResonanceIds);
  for (const id of state.inventory ?? []) resonanceSet.add(id);
  data.collectedResonanceIds = Array.from(resonanceSet);

  // 更新神的注视峰值
  data.maxDivineAttention = Math.max(data.maxDivineAttention, state.divineAttention ?? 0);

  // 记录结局（普通结局 / 生命果结局）
  if (state.isEnded && state.endingId) {
    if (!data.triggeredEndingIds.includes(state.endingId)) {
      data.triggeredEndingIds.push(state.endingId);
    }
  }
  if (state.worldActions?.hasEatenLifeFruit && !data.triggeredEndingIds.includes("life_fruit")) {
    data.triggeredEndingIds.push("life_fruit");
  }

  const unlocked = evaluateCrossSessionMarks(data);
  data.unlockedCrossSessionMarkIds = unlocked;
  writeData(data);
  return unlocked;
}

/** 读取已持久化的跨局印记 ID（供图鉴汇总） */
export function getUnlockedCrossSessionMarkIds(): AchievementId[] {
  return readData().unlockedCrossSessionMarkIds;
}

/** 读取跨局累计收集过的回响 ID 列表（供图鉴回响分页） */
export function getCollectedResonanceIds(): string[] {
  return readData().collectedResonanceIds;
}

/** 读取跨局触发过的结局 ID 列表（供图鉴结局分页） */
export function getTriggeredEndingIds(): string[] {
  return readData().triggeredEndingIds;
}

/** 读取跨局累计概览（供图鉴进度展示） */
export function getGlobalAchievementSummary(): {
  collectedResonanceCount: number;
  triggeredEndingCount: number;
  maxDivineAttention: number;
} {
  const data = readData();
  return {
    collectedResonanceCount: data.collectedResonanceIds.length,
    triggeredEndingCount: new Set(
      data.triggeredEndingIds.filter((id) =>
        (NORMAL_ENDING_IDS as readonly string[]).includes(id),
      ),
    ).size,
    maxDivineAttention: data.maxDivineAttention,
  };
}

/** 记录一组印记的解锁时间（仅首次观察时写入） */
export function recordUnlockedTimes(ids: string[]): void {
  if (!isBrowser() || ids.length === 0) return;
  const data = readData();
  let changed = false;
  for (const id of ids) {
    if (!data.unlockedAt[id]) {
      data.unlockedAt[id] = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) writeData(data);
}

/** 读取印记解锁时间映射 */
export function getUnlockedAt(): Record<string, string> {
  return readData().unlockedAt;
}

/** 仅用于测试 / 重置（客户端） */
export function resetGlobalAchievements(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(GLOBAL_ACH_KEY);
  } catch {
    /* noop */
  }
}

// 供其它模块使用的类型再导出
export type { EdenNpcId };
