// ============================================================
// 第一章地点数据
// P0 共 6 个地点，贴合《创世记》2:8-14、2:15-17 原典地理信号
//
// 玩家可见 6 地点名（地图标签只显示这些）：
// - 园子中央（central_meadow）：生命树与分别善恶树同在的中央草地
// - 伊甸之河（four_river_source）：上游瀑布与泉源
// - 万物受名处（adam_garden_work）：亚当为动物命名的草甸
// - 园中树林（tree_court）：女人主活动区
// - 东园幽径（east_garden_path）：蛇潜行与绕行路线
// - 四河分流（naming_stone_bank）：下游主河分叉
//
// 沿用旧内部 ID 以降低重命名风险，玩家可见名通过 name 字段映射。
// ============================================================

import type { EdenLocationId, EdenNpcId } from "@/game/world/types";

export type EdenLocation = {
  id: EdenLocationId;
  /** 玩家可见名称 */
  name: string;
  /** 短描述（地图节点） */
  shortDesc: string;
  /** 进入时的环境旁白（白天） */
  enterNarration: string;
  /** 进入时的环境旁白（夜晚） */
  enterNarrationNight: string;
  /** 观察此地可获得的环境反馈（白天） */
  observeText: string;
  /** 观察此地可获得的环境反馈（夜晚） */
  observeTextNight: string;
  /** 从此地可前往的相邻地点 */
  connections: EdenLocationId[];
  /** 默认出现的 NPC（动态 NPC 位置由状态控制） */
  defaultNpcs: EdenNpcId[];
  /** 白天可交互的 NPC */
  dayNpcs: EdenNpcId[];
  /** 夜晚可交互的 NPC */
  nightNpcs: EdenNpcId[];
  /** 风险等级：影响神的注视增长 */
  riskLevel: "low" | "medium" | "high";
};

export const EDEN_LOCATIONS: Record<EdenLocationId, EdenLocation> = {
  central_meadow: {
    id: "central_meadow",
    name: "园子中央",
    shortDesc: "环河草地中央，两棵树立在光里",
    enterNarration:
      "你来到园子的中央。生命树与分别善恶树都在这里；一棵像丰盛的应许，一棵因命令而显得更安静。果子在枝叶间低垂，风从河边穿过草地。这里没有常驻的人影，只有两棵树和它们之间的静。",
    enterNarrationNight:
      "夜晚的园子中央，两棵树在月光下投出更深的影子。生命树的叶子泛着银光，分别善恶树的果子在夜色中显得更加悦目，也更加寂静。风从河边吹来，带着一丝凉意。这里比白天更被注视。",
    observeText:
      "两树之间的草地柔软而开阔。生命树的叶子在光里微微发亮，分别善恶树的果子悦目地藏在叶间，却因那句不可吃的话而与别的果子不同。四周无人，但你能感到这片草地比别处更被注视。",
    observeTextNight:
      "月光照在两树上，影子拉得很长。生命树和分别善恶树在夜色中像是两道沉默的见证。草地比白天更安静，你能听见自己的呼吸。这里的静，比白天的静更重。",
    connections: ["four_river_source", "adam_garden_work", "tree_court", "naming_stone_bank"],
    defaultNpcs: ["forbidden_tree", "tree_of_life"],
    dayNpcs: ["tree_of_life", "forbidden_tree", "eve", "adam"],
    nightNpcs: ["tree_of_life", "forbidden_tree", "eve", "adam"],
    riskLevel: "medium",
  },
  four_river_source: {
    id: "four_river_source",
    name: "伊甸之河",
    shortDesc: "瀑布与泉源汇成滋润园子的上游",
    enterNarration:
      "有一条河从伊甸流出来滋润那园子。你来到它的源头——瀑布从岩石间落下，水声很轻，却无处不在。这里是上游，水还未分叉。",
    enterNarrationNight:
      "夜晚的伊甸之河源头，瀑布在月光下泛着银白色的光。水声仍在，但比白天更轻，更像一种低语。水面映着星光，比白天的倒影更深。",
    observeText:
      "清泉从石缝间涌出，水面上映着天光。水流向园子中央蜿蜒而去，滋润沿途的草地。水边的草沾着露水，比别处更凉。你看见水面的倒影短暂地缺失了一瞬，像水记得什么，又忘了。",
    observeTextNight:
      "月光落在水面上，碎成无数银色的光点。水流的声音在夜里更清晰，像是河在独自说话。水边的草沾着夜露，凉意更浓。",
    connections: ["central_meadow", "naming_stone_bank"],
    defaultNpcs: [],
    // 伊甸之河不再三天使同屏：白天加百列，夜晚拉斐尔
    dayNpcs: ["gabriel"],
    nightNpcs: ["raphael"],
    riskLevel: "low",
  },
  adam_garden_work: {
    id: "adam_garden_work",
    name: "万物受名处",
    shortDesc: "动物被带到人面前得名的草甸",
    enterNarration:
      "这里是亚当常在的地方。神把走兽和飞鸟都带到他面前，他就给它们起名。草甸边有几块被命名的石头，名字落在上面，比露水还轻。你从这里进入更深的园子，尚未到两棵树所在的中央。",
    enterNarrationNight:
      "夜晚的万物受名处，命名石痕在月光下泛着淡淡的白。亚当还在那里，但动作比白天更慢，像是怕惊动什么。草丛里传来细小的窸窣声——是刺猬和其他小生灵。",
    observeText:
      "亚当修理过的土地井然有序，旁边是命名石痕——石头上刻着动物的名字，被命名的生灵从石边走过，像是被一种温柔的秩序记住。动物在他脚边经过，像是习惯了被叫住。他记得自己被安置在园中修理看守，也记得那道命令先临到他：园中各样树上的果子可以吃，只是分别善恶树上的果子不可吃。",
    observeTextNight:
      "月光下的万物受名处，命名石痕泛着淡淡的银白。亚当坐在石头上，望着夜空。刺猬在草丛里窸窣作响。这里比白天更安静，像是整个园子都在呼吸。",
    connections: ["central_meadow"],
    defaultNpcs: ["adam", "hedgehog"],
    dayNpcs: ["adam", "hedgehog", "eve", "deer", "sheep"],
    nightNpcs: ["adam", "hedgehog", "eve"],
    riskLevel: "low",
  },
  tree_court: {
    id: "tree_court",
    name: "园中树林",
    shortDesc: "园中的女人在树影与花草之间停留",
    enterNarration:
      "园子右侧的树林比别处更安静。高大的柏树投下柔和的影子，林下空地开满细花。那个女人常在这里停留，听鸟鸣，看花草。这里不是分别善恶树所在的地方，只是一片安静的林子。",
    enterNarrationNight:
      "夜晚的园中树林，树影在月光下交错，像是无数双安静的手。那个女人有时还在那里，但比白天更沉默。小鹿在林间深处停下，望着什么。树林比白天更私密，也更神秘。",
    observeText:
      "树影深处有白鸽和小鹿的踪迹，空气里带着花香和泥土的气息。林间比别处更私密、更柔和。你感觉那个女人在这里比在别处更放松。远处有一条弯曲的小道通向园子东南方的河岸。",
    observeTextNight:
      "月光照进树林，在地面上画出银色的水纹。那个女人坐在一棵柏树下，望着夜空。小鹿在不远处停下，安静地看着她。树林比白天更私密，也更神秘。",
    connections: ["central_meadow", "east_garden_path"],
    defaultNpcs: ["eve"],
    // 园中树林不含天使；天使只在夜晚出现在伊甸之河附近
    dayNpcs: ["eve", "deer"],
    nightNpcs: ["eve", "deer"],
    riskLevel: "low",
  },
  east_garden_path: {
    id: "east_garden_path",
    name: "东园幽径",
    shortDesc: "灌木与树影遮住的弯曲小道",
    enterNarration:
      "你沿着树林南缘走上一条弯曲的小道。低矮的灌木和草丛遮住了身形，树影在头顶交错。这里不容易被看见——正适合潜伏和绕行。远处有羽翼的影子偶尔掠过。",
    enterNarrationNight:
      "夜晚的东园幽径，灌木的影子拉得很长，像是无数双安静的手。基路伯的羽翼在远处闪过，比白天更清楚。狐狸的眼睛在树影里亮了一下，又消失了。",
    observeText:
      "小道在灌木和树影之间蜿蜒，通向下方河岸。草丛里有蜥蜴和兔子窸窣的声音，偶尔有萤火虫的光。空气比林间更凉，带着水的气息。你感觉这条路上不容易被天使一眼看见，但也不完全安全。",
    observeTextNight:
      "夜里的东园幽径，小道在月光下泛着苍白的光。基路伯的影子在远处移动，比白天更近。狐狸在树影里停下，望着你。这里的空气比白天更冷，像是边界本身在呼吸。",
    connections: ["tree_court", "naming_stone_bank"],
    defaultNpcs: ["watching_angel"],
    // 东园幽径：基路伯白天守路，乌列尔夜晚照见幽径，狐狸常驻
    dayNpcs: ["cherubim", "fox"],
    nightNpcs: ["uriel", "fox"],
    riskLevel: "medium",
  },
  naming_stone_bank: {
    id: "naming_stone_bank",
    name: "四河分流",
    shortDesc: "主河离开园子后分成多道水流",
    enterNarration:
      "你来到园子下方中央的河岸。主河离开园子后在这里分成多道水流，向四方流去。水声比上游更大，空气中弥漫着湿润的泥土气息。水流外泄，河道延展，这里是园子的下游尽头，再往下就是园外的世界。",
    enterNarrationNight:
      "夜晚的四河分流，水声在月光下显得更空旷。米迦勒站在河岸，望着分流的水流。每一道水流都像是一个选择，一旦流出就不回头。",
    observeText:
      "河道在这里展开，水流分成数支，各自流向远方。水声隆隆，带着泥土和远方的气息。从分叉的水道望出去，能隐约感到园外世界的辽阔，但那是被守住的地方，不是蛇该去的方向。这里离园子中央已经有些距离，是园中较安静的一角。",
    observeTextNight:
      "月光落在分流的河面上，每道水流都闪着银光。米迦勒站在岸边，影子被拉得很长。这里的安静，像是在等待什么不可逆的选择。",
    connections: ["central_meadow", "four_river_source", "east_garden_path"],
    defaultNpcs: [],
    dayNpcs: ["michael"],
    nightNpcs: ["michael"],
    riskLevel: "low",
  },
};

/** 地点名称映射（供 UI 使用） */
export const LOCATION_NAMES: Record<EdenLocationId, string> = {
  central_meadow: EDEN_LOCATIONS.central_meadow.name,
  four_river_source: EDEN_LOCATIONS.four_river_source.name,
  adam_garden_work: EDEN_LOCATIONS.adam_garden_work.name,
  tree_court: EDEN_LOCATIONS.tree_court.name,
  east_garden_path: EDEN_LOCATIONS.east_garden_path.name,
  naming_stone_bank: EDEN_LOCATIONS.naming_stone_bank.name,
};
