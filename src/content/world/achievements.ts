// ============================================================
// 第一章园中印记成就
//
// 成就不提供数值奖励，只用于反馈、重玩和 Demo 展示。
// 玩家可见名称为"园中印记"。
//
// Phase 2 说明：
// - `ACHIEVEMENTS` 为设计文档《ACHIEVEMENT_GARDEN_MARK》定义的 29 个印记全量集
//   （4 分类：explore 7 / interaction 9 / gameplay 7 / ending 6，含 4 个隐藏印记），
//   与 public/assets/chapter1/images/achievements/ 下的 29 个图标一一对应，图鉴以此为准。
// - `LEGACY_ACHIEVEMENTS` 保留第一章早期 15 个印记（ID / name / desc 完全不变），
//   用于旧存档兼容：旧存档 unlockedAchievementIds 中的历史 ID 仍可被 getAchievementById 解析。
// - getAchievementById 同时检索两个集合。
// ============================================================

import type { AchievementId } from "@/game/world/types";

export type AchievementCategory = "explore" | "interaction" | "gameplay" | "ending";

export type Achievement = {
  id: AchievementId;
  /** 玩家可见名称 */
  name: string;
  /** 玩家可见说明 */
  desc: string;
  /** 图鉴分类 */
  category: AchievementCategory;
  /** 是否为隐藏印记（未解锁时图鉴显示为「？？？」） */
  hidden: boolean;
};

// ---- 28 个印记全量集（图鉴权威） ----
export const ACHIEVEMENTS: Achievement[] = [
  // （一）探索类（7）
  {
    id: "mark_river_step",
    name: "河声入耳",
    desc: "你走过了伊甸的每一寸土地，流水、草叶、风都记得你的痕迹",
    category: "explore",
    hidden: false,
  },
  {
    id: "mark_all_resonance",
    name: "回响满囊",
    desc: "你捡遍了园子里所有带着记忆的碎片，它们的重量藏着你说过的每一句话",
    category: "explore",
    hidden: false,
  },
  {
    id: "mark_name_stone",
    name: "名刻石痕",
    desc: "你看懂了石上的每一个名字，知道了园子里所有生灵的来处",
    category: "explore",
    hidden: false,
  },
  {
    id: "mark_moonlight",
    name: "月光道标",
    desc: "你摸到了月光铺成的近路，知道了怎么穿过看不见的边界",
    category: "explore",
    hidden: false,
  },
  {
    id: "mark_gift_3",
    name: "神恩三顾",
    desc: "神三次降临你身边，留下了祂的印记",
    category: "explore",
    hidden: false,
  },
  {
    id: "mark_echo_collector",
    name: "回声收藏家",
    desc: "你听过园子里所有的风声、水声、说话声，它们都变成了你的印记",
    category: "explore",
    hidden: false,
  },

  // （二）交互类（9）
  {
    id: "mark_all_npc_friend",
    name: "园中旧识",
    desc: "园子里的所有生灵都认识你了，刺猬见了你不会蜷起来，天使会对你点头",
    category: "interaction",
    hidden: false,
  },
  {
    id: "mark_her_trust",
    name: "她的信任",
    desc: "她完全信任你了，愿意对你说她从来没告诉过别人的疑问",
    category: "interaction",
    hidden: false,
  },
  {
    id: "mark_adam_friend",
    name: "亚当的认可",
    desc: "亚当告诉你他给所有动物起名的故事，把你当成了可以信任的人",
    category: "interaction",
    hidden: false,
  },
  {
    id: "mark_michael_approve",
    name: "米迦勒的默许",
    desc: "最忠诚的天使默认了你的存在，愿意为你挡住一次神的目光",
    category: "interaction",
    hidden: false,
  },
  {
    id: "mark_gabriel_tip",
    name: "加百列的提示",
    desc: "信使偷偷告诉了你藏在东园的秘密，风帮他隐瞒了这句话",
    category: "interaction",
    hidden: false,
  },
  {
    id: "mark_lucifer_trust",
    name: "晨星的共鸣",
    desc: "明亮之星认可了你的选择，愿意和你一起看看水流往别处的风景",
    category: "interaction",
    hidden: false,
  },
  {
    id: "mark_hedgehog_friend",
    name: "刺猬的亲近",
    desc: "胆小的小刺猬再也不怕你了，会把最软的肚皮露给你看",
    category: "interaction",
    hidden: false,
  },
  {
    id: "mark_question_10",
    name: "百句低语",
    desc: "你和园子里的生灵说了几百句话，每一句都留在了风里",
    category: "interaction",
    hidden: false,
  },
  {
    id: "mark_hidden_dialog",
    name: "未闻之语",
    desc: "你听到了晨星藏了很久的疑问，那个关于边界之外的问题",
    category: "interaction",
    hidden: true,
  },

  // （三）玩法类（7）
  {
    id: "mark_no_attention",
    name: "风过无痕",
    desc: "你说的每一句话都轻得像风，神从来没有注意到你的存在",
    category: "gameplay",
    hidden: false,
  },
  {
    id: "mark_fast_pass",
    name: "晨露未干",
    desc: "太阳还没升到天顶，你就已经让她做出了选择",
    category: "gameplay",
    hidden: false,
  },
  {
    id: "mark_one_whisper",
    name: "一语中的",
    desc: "你只说了一句话，就改变了她所有的想法",
    category: "gameplay",
    hidden: false,
  },
  {
    id: "mark_no_resonance",
    name: "空手而归",
    desc: "你什么额外的助力都没有，只用自己的声音就让她做出了选择",
    category: "gameplay",
    hidden: false,
  },
  {
    id: "mark_peace_pass",
    name: "和平路径",
    desc: "你没有得罪园子里的任何生灵，安安静静地完成了你想做的事",
    category: "gameplay",
    hidden: false,
  },
  {
    id: "mark_hard_mode",
    name: "逆道而行",
    desc: "你没有借助任何神的使者的帮助，自己走完了全程",
    category: "gameplay",
    hidden: false,
  },
  {
    id: "mark_hidden_operation",
    name: "划水之人",
    desc: "你跟着晨星学会了怎么在水里划动，摸到了边界之外的东西",
    category: "gameplay",
    hidden: true,
  },

  // （四）结局类（7）
  {
    id: "mark_success_ending",
    name: "逐入尘世",
    desc: "你看着她吃下了果子，和她一起走出了伊甸园的门",
    category: "ending",
    hidden: false,
  },
  {
    id: "mark_fail_ending",
    name: "神临园中",
    desc: "你没有在神来之前让她做出选择，神的脚步落在了园子里",
    category: "ending",
    hidden: false,
  },
  {
    id: "mark_life_fruit",
    name: "永生之味",
    desc: "她吃下了永生的果子，永远留在了园子里",
    category: "ending",
    hidden: false,
  },
  {
    id: "mark_all_ending",
    name: "诸路皆通",
    desc: "你见过了这个世界所有的普通走向，知道了每条路的尽头是什么",
    category: "ending",
    hidden: false,
  },
  {
    id: "mark_hidden_ending",
    name: "缸中之醒",
    desc: "你打破了看不见的边界，从漫长的梦里醒了过来",
    category: "ending",
    hidden: true,
  },
  {
    id: "mark_escape_eden",
    name: "园外清晨",
    desc: "你持旋转的火焰剑从幽径尽头挣脱，幻境在裂缝后退向同一个清晨，你第一次站上一片尚未被命名的土地",
    category: "ending",
    hidden: true,
  },
  {
    id: "mark_michael_slay",
    name: "守门者之剑",
    desc: "你让米迦勒最后一点容忍归于零，守门者使每一次威胁承担了后果",
    category: "ending",
    hidden: true,
  },
];

// ---- 早期 15 个印记（ID / name / desc 保持不变，仅补 category / hidden 以对齐类型） ----
// 仅用于旧存档兼容与结局复盘中历史解锁的解析，不进入 28 图鉴集。
export const LEGACY_ACHIEVEMENTS: Achievement[] = [
  // 主线印记
  { id: "river_sound_in_ear", name: "河声入耳", desc: "获得第一条地点线索。地点会影响玩法。", category: "explore", hidden: false },
  { id: "not_pushed_by_hand", name: "不以手推", desc: "首次用非命令式低语推进女人。问题比命令有效。", category: "interaction", hidden: false },
  { id: "garden_dialogue", name: "园中对谈", desc: "首次听见园中之人彼此交谈。世界会自行变化。", category: "interaction", hidden: false },
  { id: "question_takes_root", name: "问句生根", desc: "女人首次主动提出疑问。她开始自己思考。", category: "interaction", hidden: false },
  { id: "shadow_draws_near", name: "树影将近", desc: "女人进入园子中央。禁忌动作链已开始。", category: "gameplay", hidden: false },
  { id: "her_own_hand", name: "她自己的手", desc: "女人触碰果实。禁忌动作由她主动完成。", category: "ending", hidden: false },
  // 行为印记
  { id: "wind_undisturbed", name: "风未惊鹿", desc: "连续三次低语不提高神的注视。", category: "gameplay", hidden: false },
  { id: "borrowed_wing_message", name: "借翼传言", desc: "成功让鸽子传递一次温和低语。", category: "interaction", hidden: false },
  { id: "name_falls_on_stone", name: "名字落石", desc: "获得借来的名字。", category: "explore", hidden: false },
  { id: "beyond_the_river", name: "河道之外", desc: "同一局使用三种不同的园中回响。", category: "gameplay", hidden: false },
  { id: "arrive_quietly", name: "低声而至", desc: "神的注视不高于 1 时进入园子中央。", category: "gameplay", hidden: false },
  { id: "first_resonance", name: "初闻回响", desc: "首次获得一段园中回响。园子开始回应你的行动。", category: "explore", hidden: false },
  { id: "divine_gift_first", name: "初临献礼", desc: "首次从神的三选一献礼中选定一份。神的注视已化作可循的资源。", category: "explore", hidden: false },
  { id: "divine_gift_three", name: "三临神恩", desc: "同一局累计从三选一献礼中选定三份。", category: "explore", hidden: false },
  { id: "divine_gift_all", name: "七恩俱临", desc: "集齐神的七份献礼，园中众人对你全然倾心。", category: "explore", hidden: false },
  { id: "resonance_master", name: "回响大师", desc: "同一局累计使用五次园中回响。", category: "gameplay", hidden: false },
];

/** 全部印记（28 图鉴集 + 15 兼容集），供 getAchievementById 检索 */
export const ALL_ACHIEVEMENTS: Achievement[] = [...ACHIEVEMENTS, ...LEGACY_ACHIEVEMENTS];

export function getAchievementById(id: string): Achievement | undefined {
  return ALL_ACHIEVEMENTS.find((a) => a.id === id);
}

/** 按分类返回 28 图鉴集（保持定义顺序） */
export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.category === category);
}
