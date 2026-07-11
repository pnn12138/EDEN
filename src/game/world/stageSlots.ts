import type { EdenNpcId } from "@/game/world/types";

export type StageSlotRole =
  | "center-main" | "flank-left" | "flank-right"
  | "back-left" | "back-right" | "foreground";

export type StageSlot = {
  id: 1 | 2 | 3 | 4 | 5 | 6;
  role: StageSlotRole;
  left: string; bottom: string; zIndex: number; maxWidth: string;
};

export const STAGE_SLOTS: StageSlot[] = [
  { id: 1, role: "center-main", left: "42%", bottom: "6%",  zIndex: 4, maxWidth: "clamp(220px,26vw,340px)" },
  { id: 2, role: "flank-left",  left: "12%", bottom: "5%",  zIndex: 3, maxWidth: "clamp(180px,20vw,280px)" },
  { id: 3, role: "flank-right", left: "70%", bottom: "5%",  zIndex: 3, maxWidth: "clamp(180px,20vw,280px)" },
  { id: 4, role: "back-left",   left: "4%",  bottom: "20%", zIndex: 2, maxWidth: "clamp(150px,16vw,200px)" },
  { id: 5, role: "back-right",  left: "82%", bottom: "20%", zIndex: 2, maxWidth: "clamp(150px,16vw,200px)" },
  { id: 6, role: "foreground",  left: "28%", bottom: "0%",  zIndex: 5, maxWidth: "clamp(110px,12vw,160px)" },
];

const WORLD_OBJECTS = new Set<EdenNpcId>(["forbidden_tree", "tree_of_life"]);
const ANGELS = new Set<EdenNpcId>(["gabriel", "michael", "lucifer"]);

export { ANGELS as ANGEL_SET };

export type StagePlacement = { slot: StageSlot; npcId: EdenNpcId };

/** 把在场 NPC 分配到 6 槽位；世界对象进 backgroundObjects（不占槽位） */
export function allocateStageSlots(
  presentNpcs: EdenNpcId[],
  activeNpc: EdenNpcId | null,
): { placements: StagePlacement[]; backgroundObjects: EdenNpcId[] } {
  const backgroundObjects = presentNpcs.filter((n) => WORLD_OBJECTS.has(n));
  const characters = presentNpcs.filter((n) => !WORLD_OBJECTS.has(n));

  // 排序：activeNpc 首位；其余 天使->刺猬->其他
  const rest = characters.filter((n) => n !== activeNpc).sort((a, b) => {
    const w = (n: EdenNpcId) => (ANGELS.has(n) ? 0 : n === "hedgehog" ? 1 : 2);
    return w(a) - w(b);
  });
  const ordered = activeNpc && characters.includes(activeNpc)
    ? [activeNpc, ...rest] : rest;

  // 槽位消费顺序：1 center-main -> 4,5 back -> 6 foreground -> 2,3 flank
  const slotOrder: StageSlot["id"][] = [1, 4, 5, 6, 2, 3];
  const placements: StagePlacement[] = [];
  for (let i = 0; i < Math.min(ordered.length, 6); i++) {
    placements.push({ slot: STAGE_SLOTS[slotOrder[i] - 1], npcId: ordered[i] });
  }
  if (ordered.length > 6) console.warn("[stageSlots] 超 6 个角色，截断:", ordered.slice(6));
  return { placements, backgroundObjects };
}
