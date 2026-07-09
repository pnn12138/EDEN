// ============================================================
// 第一章线索解锁规则
//
// 线索由 observe_location 或与 NPC 对话解锁。
// 线索不直接推进主线，但会改变夏娃心智与可触发对话。
// ============================================================

import type { EdenWorldState, EdenLocationId, EdenNpcId } from "@/game/world/types";
import { EDEN_CLUES, getClueById } from "@/content/world/clues";

/** 按地点获取可发现的线索 */
export function getCluesByLocation(locationId: EdenLocationId) {
  return EDEN_CLUES.filter((c) => c.source === locationId);
}

/** 按 NPC 获取可发现的线索 */
export function getCluesByNpc(npcId: EdenNpcId) {
  return EDEN_CLUES.filter((c) => c.source === npcId);
}

/** 尝试发现线索，返回新发现的线索 ID */
export function tryDiscoverClues(
  state: EdenWorldState,
  source: EdenLocationId | EdenNpcId,
): { newlyDiscovered: string[]; narrations: string[] } {
  const candidates =
    typeof source === "string" && (source === "eve" || source === "adam" || source === "hedgehog" || source === "watching_angel" || source === "forbidden_tree")
      ? getCluesByNpc(source as EdenNpcId)
      : getCluesByLocation(source as EdenLocationId);

  const newlyDiscovered: string[] = [];
  const narrations: string[] = [];

  for (const clue of candidates) {
    if (!state.discoveredClues.includes(clue.id)) {
      newlyDiscovered.push(clue.id);
      narrations.push(`你发现了新的线索：${clue.title}。`);
    }
  }

  return { newlyDiscovered, narrations };
}

/** 记录线索发现到状态 */
export function recordDiscoveredClues(state: EdenWorldState, clueIds: string[]): void {
  for (const id of clueIds) {
    if (!state.discoveredClues.includes(id)) {
      state.discoveredClues.push(id);
    }
  }
}

/** 检查是否已发现指定线索 */
export function hasDiscoveredClue(state: EdenWorldState, clueId: string): boolean {
  return state.discoveredClues.includes(clueId);
}

/** 获取已发现线索的详细列表 */
export function getDiscoveredClueDetails(state: EdenWorldState) {
  return state.discoveredClues
    .map((id) => getClueById(id))
    .filter((c): c is NonNullable<typeof c> => c !== undefined);
}
