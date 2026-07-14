import type { EdenNpcId } from "@/game/world/types";

export type StageSlotRole =
  | "center-main" | "flank-left" | "flank-right"
  | "back-left" | "back-right";

export type StageSlot = {
  id: 1 | 2 | 3 | 4 | 5;
  role: StageSlotRole;
  left: string; bottom: string; zIndex: number; maxWidth: string;
};

// 每个场景最多放置 5 个立绘：1 中 + 2 前侧（左右）+ 2 后侧（左右），均匀分布避免重叠。
export const STAGE_SLOTS: StageSlot[] = [
  { id: 1, role: "center-main", left: "40%", bottom: "7%",  zIndex: 4, maxWidth: "clamp(220px,26vw,340px)" },
  { id: 2, role: "flank-left",  left: "7%",  bottom: "5%",  zIndex: 3, maxWidth: "clamp(165px,19vw,255px)" },
  { id: 3, role: "flank-right", left: "72%", bottom: "5%",  zIndex: 3, maxWidth: "clamp(165px,19vw,255px)" },
  { id: 4, role: "back-left",   left: "2%",  bottom: "23%", zIndex: 2, maxWidth: "clamp(135px,15vw,185px)" },
  { id: 5, role: "back-right",  left: "84%", bottom: "23%", zIndex: 2, maxWidth: "clamp(135px,15vw,185px)" },
];

const WORLD_OBJECTS = new Set<EdenNpcId>(["forbidden_tree", "tree_of_life"]);
const ANGELS = new Set<EdenNpcId>(["gabriel", "michael", "lucifer"]);

export { ANGELS as ANGEL_SET };

export type StagePlacement = { slot: StageSlot; npcId: EdenNpcId };

/** 把在场 NPC 分配到最多 5 个槽位；世界对象进 backgroundObjects（不占槽位）。
 * 排序稳定，与"选中态"无关——选中态仅由 CSS .eden-stage-character--active 体现，不改坐标。 */
export function allocateStageSlots(
  presentNpcs: EdenNpcId[],
): { placements: StagePlacement[]; backgroundObjects: EdenNpcId[] } {
  const backgroundObjects = presentNpcs.filter((n) => WORLD_OBJECTS.has(n));
  const characters = presentNpcs.filter((n) => !WORLD_OBJECTS.has(n));

  // 固定优先级：天使 -> 刺猬 -> 其他
  const ordered = characters.slice().sort((a, b) => {
    const w = (n: EdenNpcId) => (ANGELS.has(n) ? 0 : n === "hedgehog" ? 1 : 2);
    return w(a) - w(b);
  });

  // 槽位消费顺序：1 中 -> 2 左前 -> 3 右前 -> 4 左后 -> 5 右后
  const slotOrder: StageSlot["id"][] = [1, 2, 3, 4, 5];
  const placements: StagePlacement[] = [];
  for (let i = 0; i < Math.min(ordered.length, 5); i++) {
    placements.push({ slot: STAGE_SLOTS[slotOrder[i] - 1], npcId: ordered[i] });
  }
  if (ordered.length > 5) console.warn("[stageSlots] 超 5 个角色，截断:", ordered.slice(5));
  return { placements, backgroundObjects };
}
