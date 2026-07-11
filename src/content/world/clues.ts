// ============================================================
// 第一章线索数据
// P0 至少 3 条线索：命名石痕、河岸水痕、金色树叶
// 线索由 observe_location 或与 NPC 对话解锁
// ============================================================

import type { EdenClue } from "@/game/world/types";

export const EDEN_CLUES: EdenClue[] = [
  {
    id: "clue_death_unknown",
    title: "她并不理解死亡",
    description:
      "那个女人记得「吃的日子必定死」，但她从未见过死亡。她重复这句话，却像在念一个她不懂的词。",
    source: "adam",
    hiddenTags: ["death", "soften_death", "weakness"],
  },
  {
    id: "clue_only_remembers_command",
    title: "她只是记住禁令",
    description:
      "那个女人从亚当那里听见了禁令，而不是从神那里。她记住的是命令本身，不是命令的原因。",
    source: "adam",
    hiddenTags: ["command", "challenge_prohibition", "weakness"],
  },
  {
    id: "clue_eve_gazes_tree",
    title: "她有时会望向那棵树",
    description:
      "亚当说，那个女人有时会望向分别善恶树，但很快移开目光，像是怕自己被看见。",
    source: "adam",
    hiddenTags: ["curiosity", "tree", "weakness"],
  },
  {
    id: "clue_naming_stones",
    title: "命名石痕",
    description:
      "万物受名处的石头刻着亚当给动物起的名字。名字落在石头上，比露水还轻。被命名的生灵从石边走过，像是被一种温柔的秩序记住。",
    source: "adam_garden_work",
    hiddenTags: ["naming", "adam", "order"],
  },
  {
    id: "clue_river_reflection",
    title: "河岸水痕",
    description:
      "伊甸之河的水面映着天光，但倒影短暂地缺失了一瞬，像水记得什么，又忘了。水边的草比别处更凉。",
    source: "four_river_source",
    hiddenTags: ["water", "reflection", "memory"],
  },
  {
    id: "clue_golden_leaf",
    title: "金色树叶",
    description:
      "树林边的草地上落着一片金色的叶子，像是从那棵树上飘下来的。它没有声音，却让看见它的人停了一瞬。",
    source: "tree_court",
    hiddenTags: ["tree", "curiosity", "fruit"],
  },
  {
    id: "clue_angel_patrols_tree",
    title: "天使在东园幽径守望",
    description:
      "加百列常在东园幽径附近守望。他温和，但他的存在让那条小道比别处更静、更冷。",
    source: "east_garden_path",
    hiddenTags: ["angel", "tree", "risk"],
  },
  {
    id: "clue_four_river_echo",
    title: "四河回声",
    description:
      "分流的水声里藏着一句你说过的话，但变了调。话一旦流出，就不完全属于说话者；每句低语也会有去处。",
    source: "naming_stone_bank",
    hiddenTags: ["water", "consequence", "echo"],
  },
  {
    id: "clue_two_trees",
    title: "两树之间的静",
    description:
      "园子中央，生命树与分别善恶树相距不远。一棵像应许，一棵因命令而安静。这里的草地比别处更被注视。",
    source: "central_meadow",
    hiddenTags: ["tree", "forbidden", "attention"],
  },
];

/** 根据 ID 获取线索 */
export function getClueById(id: string): EdenClue | undefined {
  return EDEN_CLUES.find((c) => c.id === id);
}
