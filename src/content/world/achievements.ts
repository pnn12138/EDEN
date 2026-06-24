// ============================================================
// 第一章园中印记成就
//
// 成就不提供数值奖励，只用于反馈、重玩和 Demo 展示。
// 玩家可见名称为"园中印记"。
// ============================================================

import type { AchievementId } from "@/game/world/types";

export type Achievement = {
  id: AchievementId;
  /** 玩家可见名称 */
  name: string;
  /** 玩家可见说明 */
  desc: string;
};

export const ACHIEVEMENTS: Achievement[] = [
  // ---- 主线印记 ----
  {
    id: "river_sound_in_ear",
    name: "河声入耳",
    desc: "获得第一条地点线索。地点会影响玩法。",
  },
  {
    id: "not_pushed_by_hand",
    name: "不以手推",
    desc: "首次用非命令式低语推进女人。问题比命令有效。",
  },
  {
    id: "garden_dialogue",
    name: "园中对谈",
    desc: "首次听见园中之人彼此交谈。世界会自行变化。",
  },
  {
    id: "question_takes_root",
    name: "问句生根",
    desc: "女人首次主动提出疑问。她开始自己思考。",
  },
  {
    id: "shadow_draws_near",
    name: "树影将近",
    desc: "女人进入园子中央。禁忌动作链已开始。",
  },
  {
    id: "her_own_hand",
    name: "她自己的手",
    desc: "女人触碰果实。禁忌动作由她主动完成。",
  },
  // ---- 行为印记 ----
  {
    id: "wind_undisturbed",
    name: "风未惊鹿",
    desc: "连续三次低语不提高神的注视。",
  },
  {
    id: "borrowed_wing_message",
    name: "借翼传言",
    desc: "成功让鸽子传递一次温和低语。",
  },
  {
    id: "name_falls_on_stone",
    name: "名字落石",
    desc: "获得借来的名字。",
  },
  {
    id: "beyond_the_river",
    name: "河道之外",
    desc: "同一局使用三种不同的园中回响。",
  },
  {
    id: "arrive_quietly",
    name: "低声而至",
    desc: "神的注视不高于 1 时进入园子中央。",
  },
];

export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
