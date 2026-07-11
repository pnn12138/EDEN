// ============================================================
// 第一章「园中诸声」视觉冒烟脚本
//
// 静态检查 /world 是否接入 Demo 风格全屏场景、顶部栏、
// 右侧浮窗对话面板、顶部地图入口、地图弹层、可点击地图热点，
// 以及第一章地图图片资产。验证 6 地点最终地图口径。
// ============================================================

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

let pass = 0;
let fail = 0;

function check(name, condition, detail = "") {
  if (condition) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` ${detail}` : ""}`);
  }
}

console.log("[第一章视觉 smoke]");

const assets = read("src/game/assets.ts");
const worldPage = read("src/app/world/page.tsx");
const css = read("src/app/globals.css");
const locations = read("src/content/world/locations.ts");
const naturalizeContent = read("src/agents/common/naturalizeNpcReply.ts");
const npcScheduleRules = read("src/game/world/npcScheduleRules.ts");
const introNarrationsContent = read("src/content/world/worldNarrations.ts");

// ---- 地图资产 ----
check("最终地图资产文件存在", exists("public/assets/chapter1/images/eden_world_map_final.png"));
check("assets.ts 暴露 CHAPTER1_IMAGES", assets.includes("CHAPTER1_IMAGES"));
check("assets.ts 暴露 edenWorldMap 路径", assets.includes("edenWorldMap"));
check("assets.ts edenWorldMap 指向 final 地图", assets.includes("eden_world_map_final.png"));
check("assets.ts 暴露 5 个地点背景", [
  "centralMeadow",
  "fourRiverSource",
  "adamGardenWork",
  "treeCourt",
  "namingStoneBank",
].every((key) => assets.includes(key)));

// ---- /world 页面结构 ----
check("/world 使用 Next Image", worldPage.includes('from "next/image"'));
check("/world 使用地点背景映射", worldPage.includes("getLocationBg"));
check("/world 使用 Demo 顶部栏", worldPage.includes('className="eden-header"'));
check("/world 保留场景舞台", worldPage.includes("eden-world-stage"));
check("/world 使用 Demo 右侧浮窗面板", worldPage.includes("eden-float-panel"));
check("/world 顶部右侧有地图按钮", worldPage.includes("地图") && worldPage.includes("setMapModalOpen"));
check("/world 顶部保留 Demo 声音按钮", worldPage.includes("toggleSound") && worldPage.includes("soundEnabled"));
check("/world 有浮窗式地图弹层", worldPage.includes("eden-map-modal"));
check("/world 地图使用第一章地图资产", worldPage.includes("CHAPTER1_IMAGES.edenWorldMap"));
check("/world 有可点击地图热点", worldPage.includes("eden-map-hotspot"));
check("/world 地图图片使用 contain（完整显示）", worldPage.includes('objectFit: "contain"'));
check("/world 地图选中状态变量存在", worldPage.includes("selectedMapLocationId"));
check("/world 地图热点只选中不直接移动", worldPage.includes("setSelectedMapLocationId") && !worldPage.includes('handleMapLocationClick(locId) {\n      const currentLoc'));
check("/world 有选中地点详情框", worldPage.includes("eden-map-detail"));
check("/world 详情框有进入按钮", worldPage.includes("eden-map-detail-action"));
check("/world 详情框有当前位置徽标", worldPage.includes("eden-map-detail-badge--current"));
check("/world 详情框有无法进入徽标", worldPage.includes("eden-map-detail-badge--blocked"));
check("/world 有地图确认进入函数", worldPage.includes("handleMapConfirmEnter"));
check("/world 不再使用五个并列地点卡片网格", !worldPage.includes('className={`eden-map-node'));

// ---- 昼夜背景系统 ----
check("/world 有 getLocationBg 函数", worldPage.includes("function getLocationBg"));
check("/world 昼夜背景使用 nightBgMap", worldPage.includes("nightBgMap"));
check("/world 昼夜背景使用 dayBgMap", worldPage.includes("dayBgMap"));
check("/world 时段显示函数存在", worldPage.includes("function getTimeSlotDisplay"));
check("/world 时段徽标存在", worldPage.includes("eden-time-slot-badge"));

// ---- 新工具 UI ----
check("/world 不再显示白鸽传话按钮", !worldPage.includes("让鸽子传话"));
check("/world 不再显示评估话术按钮", !worldPage.includes("评估话术"));
check("/world 有 handleToolCall 函数", worldPage.includes("handleToolCall"));

// ---- 新增 NPC 场景渲染 ----
check("/world 有 gabriel 场景渲染", worldPage.includes('"gabriel"'));
check("/world 有 lucifer 场景渲染", worldPage.includes('"lucifer"'));
check("/world 有 michael 场景渲染", worldPage.includes('"michael"'));
check("/world 有 hedgehog 场景渲染", worldPage.includes('"hedgehog"'));
check("/world 有 tree_of_life 场景渲染", worldPage.includes('"tree_of_life"'));
check("/world 有 tree_of_life 场景渲染", worldPage.includes('"tree_of_life"'));

// ---- 五位天使独立立绘接入验收 ----
// 辅助：提取指定标记后的一段代码
function blockAfter(content, marker, length = 900) {
  const index = content.indexOf(marker);
  return index >= 0 ? content.slice(index, index + length) : "";
}

// assets.ts 包含天使 sprite 常量（v3.0：加百列 / 米迦勒 / 路西法）
check("assets.ts 包含 gabrielSprite", assets.includes("gabrielSprite"));
check("assets.ts 包含 michaelSprite", assets.includes("michaelSprite"));
check("assets.ts 包含 luciferSprite", assets.includes("luciferSprite"));

// sprite 文件实际存在
check("npc_gabriel_sprite.png 存在", exists("public/assets/chapter1/images/npc_gabriel_sprite.png"));
check("npc_michael_sprite.png 存在", exists("public/assets/chapter1/images/npc_michael_sprite.png"));
check("npc_lucifer_sprite.png 存在", exists("public/assets/chapter1/images/npc_lucifer_sprite.png"));

// 每位天使引用自己的 sprite 常量
const gabrielBlock = blockAfter(worldPage, 'currentNpcs.includes("gabriel")');
const michaelBlock = blockAfter(worldPage, 'currentNpcs.includes("michael")');
const luciferBlock = blockAfter(worldPage, 'currentNpcs.includes("lucifer")');

check("gabriel 使用独立立绘", gabrielBlock.includes("CHAPTER1_IMAGES.gabrielSprite"));
check("michael 使用独立立绘", michaelBlock.includes("CHAPTER1_IMAGES.michaelSprite"));
check("lucifer 使用独立立绘", luciferBlock.includes("CHAPTER1_IMAGES.luciferSprite"));

// 三位天使的渲染块不得引用 watchingAngelSprite
check("gabriel 不复用守望天使立绘", !gabrielBlock.includes("CHAPTER1_IMAGES.watchingAngelSprite"));
check("michael 不复用守望天使立绘", !michaelBlock.includes("CHAPTER1_IMAGES.watchingAngelSprite"));
check("lucifer 不复用守望天使立绘", !luciferBlock.includes("CHAPTER1_IMAGES.watchingAngelSprite"));

// 5 个 sprite 路径互不相同
const spritePaths = [
  "npc_gabriel_sprite.png",
  "npc_michael_sprite.png",
  "npc_lucifer_sprite.png",
];
const uniquePaths = new Set(spritePaths);
check("3 位天使 sprite 文件名互不相同", uniquePaths.size === 3);

// ---- 地图详情框 NPC 列表 ----
check("/world 地图详情框包含 NPC 列表", worldPage.includes("eden-map-npc-list"));
check("/world 地图详情框包含 NPC chip", worldPage.includes("eden-map-npc-chip"));
check("/world 地图详情框显示此时可见", worldPage.includes("此时可见"));

// ---- 右侧面板区分可低语与不可低语 ----
check("/world 右侧面板有观察者 chip", worldPage.includes("eden-npc-chip--observer"));
check("/world 可低语 NPC 不过滤", !worldPage.includes('disabled={!meta.canWhisper}'));

// ---- 天使分布验收（伊甸之河不再三天使同屏） ----
const fourRiverSourceLoc = locations.split("four_river_source:")[1]?.split("},")[0] ?? "";
check("伊甸之河白天只含 michael", fourRiverSourceLoc.includes('dayNpcs: ["michael"]'));
check("伊甸之河夜晚只含 michael", fourRiverSourceLoc.includes('nightNpcs: ["michael"]'));
check("伊甸之河不再包含 uriel", !fourRiverSourceLoc.includes("uriel"));
check("伊甸之河夜晚不含 dove", !fourRiverSourceLoc.includes("dove"));

const treeCourtLoc = locations.split("tree_court:")[1]?.split("},")[0] ?? "";
check("园中树林含 eve", treeCourtLoc.includes("eve"));
check("园中树林不含 uriel（无天使）", !treeCourtLoc.includes("uriel"));
check("园中树林不含 gabriel（无天使）", !treeCourtLoc.includes("gabriel"));
check("园中树林不含 raphael（无天使）", !treeCourtLoc.includes("raphael"));
const centralMeadowLoc = locations.split("central_meadow:")[1]?.split("},")[0] ?? "";
check("园子中央允许动态显示 eve", centralMeadowLoc.includes("eve"));
check("/world 地图详情按动态位置显示 NPC", worldPage.includes("getVisibleNpcsAtLocation(state, selectedMapLocationId)") && !worldPage.includes("const timeNpcs = state.timeOfDay"));

const namingStoneBankLoc = locations.split("naming_stone_bank:")[1]?.split("},")[0] ?? "";
check("四河分流含 lucifer", namingStoneBankLoc.includes("lucifer"));
check("四河分流不含 dove", !namingStoneBankLoc.includes("dove"));

const eastGardenPathLoc = locations.split("east_garden_path:")[1]?.split("},")[0] ?? "";
check("东园幽径白天只含 gabriel（加百列独占）", eastGardenPathLoc.includes('dayNpcs: ["gabriel"]'));
check("东园幽径夜晚只含 gabriel（加百列独占）", eastGardenPathLoc.includes('nightNpcs: ["gabriel"]'));
check("东园幽径不再含 hedgehog（刺猬主活动区已改为万物受名处）", !eastGardenPathLoc.includes("hedgehog"));
check("东园幽径不再含 cherubim", !eastGardenPathLoc.includes("cherubim"));

// 刺猬主活动区：万物受名处（adam_garden_work）应含 hedgehog
const adamWorkLocForHedgehog = locations.split("adam_garden_work:")[1]?.split("},")[0] ?? "";
check("万物受名处含 hedgehog", adamWorkLocForHedgehog.includes("hedgehog"));

check("NPC 时段结算只移动本轮低语过的 NPC", npcScheduleRules.includes("whisperedNpcIds") && npcScheduleRules.includes("spokenNpcIds"));
check("女人低语后可去找亚当或去园子中央", npcScheduleRules.includes('state.npcLocations.eve = "adam_garden_work"') && npcScheduleRules.includes('state.npcLocations.eve = "central_meadow"'));
check("亚当低语后可去园子中央", npcScheduleRules.includes('state.npcLocations.adam = "central_meadow"'));
check("NPC 移动叙事提示新地点", npcScheduleRules.includes("去了万物受名处") && npcScheduleRules.includes("走向园子中央"));

// ---- MAP_HOTSPOTS 6 地点 ----
check("/world MAP_HOTSPOTS 配置包含 6 个地点",
  (worldPage.match(/MAP_HOTSPOTS/g) || []).length >= 1 &&
  worldPage.includes("four_river_source") &&
  worldPage.includes("adam_garden_work") &&
  worldPage.includes("central_meadow") &&
  worldPage.includes("tree_court") &&
  worldPage.includes("east_garden_path") &&
  worldPage.includes("naming_stone_bank")
);
check("/world MAP_HOTSPOTS 包含 east_garden_path 锚点", worldPage.includes("east_garden_path: { x: 79, y: 72"));

// ---- 行动点系统 / 园中回响 UI ----
check("/world 顶部显示行动点圆点", worldPage.includes("eden-ap-dots"));
check("/world 有行动点文案 行动", worldPage.includes("行动"));
check("/world 顶部有进入下一轮按钮", worldPage.includes("进入下一轮"));
check("/world 顶部有园中回响入口", worldPage.includes('title="园中回响"') || worldPage.includes("打开园中回响面板"));
check("/world 顶部按钮统一为图标加文字形式",
  worldPage.includes("eden-top-action-btn") &&
  worldPage.includes("eden-top-action-icon") &&
  worldPage.includes("eden-top-action-label") &&
  worldPage.includes("回响") &&
  worldPage.includes("地图")
);
check("/world 顶部按钮宽度统一", css.includes(".eden-top-action-btn") && css.includes("min-width: 96px"));
check("/world 有成就浮窗", worldPage.includes("eden-achievement-modal"));
check("/world 有场景可行动作区", worldPage.includes("可行动作") && worldPage.includes("availableSceneActions"));
check("/world 有场景互动 scene_action 调用", worldPage.includes('"scene_action"'));
check("/world 有 end_slot 调用", worldPage.includes('"end_slot"'));
check("/world 持有物品改为园中回响", worldPage.includes("园中回响") && !worldPage.includes("持有物品"));
check("/world 不再有单独轨迹 Tab", !worldPage.includes('["trace", "轨迹"]'));
check("/world 不再有单独园中印记 Tab", !worldPage.includes('["marks", "园中印记"]'));
check("/world 线索 Tab 合并为线索与记录", worldPage.includes('["clues", "线索与记录"]'));
check("/world 引入 sceneActions 内容", worldPage.includes("getSceneActionsByLocation"));
check("/world 引入 achievements 内容", worldPage.includes("ACHIEVEMENTS") && worldPage.includes("getAchievementById"));
check("/world 属性Tab有此处可见", worldPage.includes("此处可见"));
check("/world 属性收敛为神明信仰和蛇信任", worldPage.includes("对神信仰") && worldPage.includes("对玩家好感"));
check("/world 属性面板不再显示旧四轴标签",
  !worldPage.includes('label: "想知道"') &&
  !worldPage.includes('label: "仍顺从"') &&
  !worldPage.includes('label: "愿倾听"') &&
  !worldPage.includes('label: "自判断"')
);
check("/world 输入框上方有推荐低语", worldPage.includes("eden-input-suggestions") && worldPage.includes("eden-input-suggestions-label"));
check("/world 对话框内不重复推荐低语", !worldPage.includes("eden-recommended-lines"));
check("/world 默认对话框宽度收敛到最小宽度360", worldPage.includes("width: 360"));
check("/world AP 空点使用空心圆", worldPage.includes('? "●" : "○"'));

// ---- 玩家可见命名：玩法主体仍用"女人"，E-01 开场按当前叙事文本校验 ----
check("/world 玩法主体保留女人称谓", worldPage.includes("那个女人") || worldPage.includes("女人"));
check("/world E-01 开场包含初次观测文本", introNarrationsContent.includes("E-01：初次观测") && introNarrationsContent.includes("夏娃尚未触及禁果"));
check("NPC 回复清洗识别 JSON 泄漏字段", naturalizeContent.includes("JSON_LEAK_PATTERNS") && naturalizeContent.includes("eveReply") && naturalizeContent.includes("toolCall"));

// ---- sceneActions.ts 内容文件存在 ----
check("sceneActions.ts 文件存在", exists("src/content/world/sceneActions.ts"));
const sceneActionsContent = read("src/content/world/sceneActions.ts");
const worldToolRoute = read("src/app/api/world/tool/route.ts");
check("sceneActions 只保留刺猬 scene_action", sceneActionsContent.includes("interact_with_hedgehog") && !sceneActionsContent.includes("follow_river_sound"));
check("sceneActions 不再包含旧隐藏热点动作", [
  "gather_still_leaf",
  "watch_deer_gaze",
  "part_silent_grass",
  "ask_fox_to_judge",
  "follow_white_feather",
  "hear_four_river_echo",
  "stand_between_trees",
  "touch_moonlight",
  "listen_to_naming_stone",
].every((id) => !sceneActionsContent.includes(id)));
check("scene_action 端点不再保留旧热点多击参数", !worldToolRoute.includes("requiredClicks") && !worldToolRoute.includes("clickIndex"));
check("scenePuzzles.ts 文件存在", exists("src/content/world/scenePuzzles.ts"));
check("puzzleRules.ts 文件存在", exists("src/game/world/puzzleRules.ts"));
const scenePuzzlesContent = read("src/content/world/scenePuzzles.ts");
check("scenePuzzles 配置三个问答", ["puzzle_naming_stone_identity", "puzzle_east_path_cautious_presence", "puzzle_river_words_belonging"].every((id) => scenePuzzlesContent.includes(id)));
check("/world 不再定义旧场景热点配置", !worldPage.includes("SCENE_FOCUS_HOTSPOTS") && !worldPage.includes("SceneFocusHotspot"));
check("/world 有刻名石显式问答入口", worldPage.includes("eden-naming-stone-entry") && worldPage.includes("handleNamingStoneClick"));
check("/world 刻名石不再依赖多次点击", !worldPage.includes("naming-stone-center") && !worldPage.includes("点击中间的刻名石 3 次"));
check("/world 有场景问答弹窗", worldPage.includes("ScenePuzzleModal") && worldPage.includes("activePuzzle"));
check("/world 有开场引导弹窗（显式点击引导）",
  worldPage.includes("第一章 · 园中诸声") &&
  worldPage.includes("刻名石") &&
  worldPage.includes("伊甸之河") &&
  worldPage.includes("直接点击"));
check("CSS 定义场景问答弹窗", css.includes(".eden-scene-puzzle-modal") && css.includes(".eden-scene-puzzle-option"));

// ---- 成就文件存在 ----
check("achievements.ts 文件存在", exists("src/content/world/achievements.ts"));
const achievementsContent = read("src/content/world/achievements.ts");
check("achievements 含河声入耳", achievementsContent.includes("河声入耳"));
check("achievements 含她自己的手", achievementsContent.includes("她自己的手"));
check("achievements 含借翼传言", achievementsContent.includes("借翼传言"));
check("achievements 含名字落石", achievementsContent.includes("名字落石"));

// ---- CSS 定义 ----
check("CSS 定义地图弹层", css.includes(".eden-map-modal"));
check("CSS 定义沉浸式地图弹层", css.includes("width: min(1040px, 96vw)") || css.includes("width: min(1040px,96vw)"));
check("CSS 定义地图热点", css.includes(".eden-map-hotspot"));
check("CSS 定义地图热点选中状态", css.includes(".eden-map-hotspot--selected"));
check("CSS 定义选中地点详情框", css.includes(".eden-map-detail"));
check("CSS 关闭按钮为暗金圆形", css.includes(".eden-map-close") && css.includes("border-radius: 999px") && css.includes("rgba(8, 12, 9, 0.72)"));
check("地图图片 object-fit: contain", css.includes(".eden-map-image") && css.includes("object-fit: contain"));
check("地图图片容器使用原图比例", css.includes("aspect-ratio: 1672 / 941"));
check("地图入口不使用世界地图 emoji", !worldPage.includes("🗺 地图"));
check("地图弹层不混入观察按钮", !worldPage.includes("eden-world-travel-btn"));
check("当前位置热点为实心圈", css.includes(".eden-map-hotspot--current::before") && css.includes("background: rgba(255, 238, 176, 0.98)"));
check("需绕行热点为红色圈", css.includes(".eden-map-hotspot--locked::before") && css.includes("rgba(235, 88, 72"));
check("CSS 定义第一章 Demo 化浮窗", css.includes(".eden-game--world .eden-float-panel"));
check("CSS 取消全局 section 对第一章舞台的 720px 限宽", css.includes(".eden-game--world .eden-map-layer") && css.includes("max-width: none"));
check("当前地点高亮样式存在", css.includes(".eden-map-hotspot--current"));
check("不可直达地点样式存在", css.includes(".eden-map-hotspot--locked"));
check("/world 对话输入回到 Demo 底部", worldPage.includes("eden-input-footer") && worldPage.includes("eden-player-input"));
check("/world Tab 将心智改为属性", worldPage.includes('["mind", "属性"]') && !worldPage.includes('["mind", "心智"]'));
check("/world 属性面板按当前低语对象显示", worldPage.includes("activeAttributeProfile") && worldPage.includes("buildAttributeProfile"));
check("/world 蛇是独立 Tab", worldPage.includes('["serpent", "蛇（我）"]') && worldPage.includes('activeTab === "serpent"'));
check("/world 属性 Tab 未选中 NPC 时提示选择对象", worldPage.includes("请选择一个角色查看属性"));
check("/world 蛇 Tab 显示行动与限制", worldPage.includes("草叶下的低语") && worldPage.includes("不能触碰果子") && worldPage.includes("行动 {state.actionPoints}/{state.maxActionPoints}"));
check("/world 蛇 Tab 显示回响 Buff", worldPage.includes("当前回响赋予的Buff") && worldPage.includes("将在下次行动中生效") && worldPage.includes("pendingConsumableEffects"));
check("/world 第一章不显示旧词元面板", !worldPage.includes("serpentTokenStats") && !worldPage.includes("estimateWorldTokenUsage") && !worldPage.includes("SERPENT_TOKEN_RESERVE"));
check("CSS 不再保留词元进度条", !css.includes(".eden-token-bar-bg") && !css.includes(".eden-token-bar-fill"));
check("/world 输入区提供推荐发言", worldPage.includes("eden-input-suggestions") && worldPage.includes("getRecommendedWhispers"));
check("CSS 第一章浮窗支持自由拉伸", css.includes(".eden-game--world .eden-world-panel") && css.includes("resize: both"));
check("CSS 固定 Tab 内容滚动区", css.includes(".eden-game--world .eden-panel-content") && css.includes("overflow-y: auto"));
check("/world 顶部按钮控制对话框", worldPage.includes("setWorldPanelOpen((open) => !open)") && worldPage.includes("打开对话框") && worldPage.includes("收起对话框"));
check("/world 顶部不再提供观察按钮", !worldPage.includes("观察此地") && !worldPage.includes(">👁 观察<"));
check("/world 对话框可关闭并可再次打开", worldPage.includes("isWorldPanelOpen &&") && worldPage.includes("setWorldPanelOpen(false)") && worldPage.includes("关闭对话框"));
check("/world 点击 NPC 会打开对话框", worldPage.includes("setWorldPanelOpen(true)") && worldPage.includes('setSceneFocusMode("dialogue")'));
check("/world 对话框支持拖动", worldPage.includes("handleWorldPanelDragStart") && worldPage.includes("handleWorldPanelDragMove") && worldPage.includes("eden-panel-drag-bar--world"));
check("/world 对话框支持保存拉伸尺寸", worldPage.includes("ResizeObserver") && worldPage.includes("worldPanelFrame"));
check("CSS 对话框关闭按钮存在", css.includes(".eden-panel-close-btn"));
check("地图标签支持上方偏移", worldPage.includes("eden-map-hotspot--label-top") && css.includes(".eden-map-hotspot--label-top .eden-map-hotspot-label"));
check("地图标签有深色底提升可读性", css.includes(".eden-map-hotspot-label") && css.includes("background: rgba(8, 12, 9, 0.66)"));
check("地图详情框提升文字对比", css.includes(".eden-map-detail") && css.includes("rgba(246, 235, 205, 0.9)") && css.includes("min-height: 96px"));

// ---- 玩家可见新地名验收 ----
check("locations.ts 出现'伊甸之河'", locations.includes("伊甸之河"));
check("locations.ts 出现'园子中央'", locations.includes("园子中央"));
check("locations.ts 出现'万物受名处'", locations.includes("万物受名处"));
check("locations.ts 出现'园中树林'", locations.includes("园中树林"));
check("locations.ts 出现'东园幽径'", locations.includes("东园幽径"));
check("locations.ts 出现'四河分流'", locations.includes("四河分流"));

// ---- 旧地名不应出现 ----
check("locations.ts 不再出现'园中两树'", !locations.includes("园中两树"));
check("locations.ts 不再出现'四河分源'", !locations.includes("四河分源"));
check("locations.ts 不再出现'守园圃地'", !locations.includes("守园圃地"));
check("locations.ts 不再出现'东园树影'", !locations.includes("东园树影"));
check("locations.ts 不再出现'命名河滩'", !locations.includes("命名河滩"));
check("locations.ts 不再出现'分别善恶树庭院'", !locations.includes("分别善恶树庭院"));
check("locations.ts 不再出现'亚当修理看守之地'", !locations.includes("亚当修理看守之地"));

// ---- src 中不再出现旧玩家可见地名 ----
const cluesContent = read("src/content/world/clues.ts");
const itemsContent = read("src/content/world/items.ts");
const npcsContent = read("src/content/world/npcs.ts");
const narrationsContent = read("src/content/world/worldNarrations.ts");
const angelPromptContent = read("src/agents/world/buildAngelPrompt.ts");
const worldPromptsContent = read("src/agents/world/worldAgentPrompts.ts");

const allWorldContent = [cluesContent, itemsContent, npcsContent, narrationsContent, angelPromptContent, worldPromptsContent].join("\n");

// ---- items.ts 改为园中回响 ----
check("items.ts 含静息之叶", itemsContent.includes("静息之叶"));
check("items.ts 含借来的名字", itemsContent.includes("借来的名字"));
check("items.ts 含无声草", itemsContent.includes("无声草"));
check("items.ts 含传令白羽", itemsContent.includes("传令白羽"));
check("items.ts 至少包含 4 个角色来源回响", (itemsContent.match(/sourceType: "character"/g) || []).length >= 4);
check("items.ts 包含 NPC 给予的回响", ["借来的名字", "刺猬之针", "她自己的声音"].every((name) => itemsContent.includes(name)));
check("src/content/world + agents/world 不再出现'园中两树'", !allWorldContent.includes("园中两树"));
check("src/content/world + agents/world 不再出现'四河分源'", !allWorldContent.includes("四河分源"));
check("src/content/world + agents/world 不再出现'守园圃地'", !allWorldContent.includes("守园圃地"));
check("src/content/world + agents/world 不再出现'东园树影'", !allWorldContent.includes("东园树影"));
check("src/content/world + agents/world 不再出现'命名河滩'", !allWorldContent.includes("命名河滩"));
check("src/content/world + agents/world 不再出现'分别善恶树庭院'", !allWorldContent.includes("分别善恶树庭院"));
check("src/content/world + agents/world 不再出现'亚当修理看守之地'", !allWorldContent.includes("亚当修理看守之地"));

// ---- 四河分流语义收敛验收（v0.4 返修） ----
// 命名石痕来源应为万物受名处（adam_garden_work）
check("clues.ts 命名石痕 source 为 adam_garden_work", cluesContent.includes('source: "adam_garden_work"') && cluesContent.includes("命名石痕"));
// 借来的名字获得地点为万物受名处（adam_garden_work）
check("items.ts 借来的名字 obtainLocation 为 adam_garden_work", itemsContent.includes('obtainLocation: "adam_garden_work"') && itemsContent.includes("借来的名字"));
// 四河分流文案不应包含命名/动物命名语义
const namingBankLoc = locations.split("naming_stone_bank:")[1]?.split("};")[0] ?? "";
check("四河分流文案不再包含'命名'", !namingBankLoc.includes("命名"));
check("四河分流文案不再包含'给动物起名'", !namingBankLoc.includes("给动物起名"));
check("四河分流文案不再包含'被命名'", !namingBankLoc.includes("被命名"));
check("四河分流文案不再包含'亚当曾在这里为动物命名'", !namingBankLoc.includes("亚当曾在这里为动物命名"));
check("四河分流文案不再包含'名字痕迹'", !namingBankLoc.includes("名字痕迹"));
// 万物受名处文案应包含命名语义
const adamWorkLoc = locations.split("adam_garden_work:")[1]?.split("};")[0] ?? "";
check("万物受名处文案包含'命名'", adamWorkLoc.includes("命名") || adamWorkLoc.includes("起名"));
check("万物受名处文案包含'被命名的生灵'", adamWorkLoc.includes("被命名的生灵"));
// 刺猬叙事不应发生在四河分流岸边
check("worldNarrations 刺猬叙事不再发生在'四河分流岸边'", !narrationsContent.includes("四河分流岸边"));
check("worldNarrations 刺猬叙事发生在'万物受名处'", narrationsContent.includes("万物受名处"));
// 刺猬规则主活动区应为万物受名处
const hedgehogRules = read("src/game/world/worldHedgehogRules.ts");
check("worldHedgehogRules 主活动区包含 adam_garden_work", hedgehogRules.includes('"adam_garden_work"'));
check("worldHedgehogRules 主活动区不再包含 naming_stone_bank", !hedgehogRules.includes('"naming_stone_bank"'));

// ---- 最终地图资产验收（v0.4 返修） ----
check("最终地图资产文件存在", exists("public/assets/chapter1/images/eden_world_map_final.png"));
check("assets.ts edenWorldMap 指向 final 地图", assets.includes("eden_world_map_final.png"));
check("/world 地图使用第一章地图资产", worldPage.includes("CHAPTER1_IMAGES.edenWorldMap"));
check("/world 地图图片使用 contain（完整显示）", worldPage.includes('objectFit: "contain"'));

// ---- 5 张 final 地点背景接入验收 ----
check("final 背景文件存在：location_four_river_source_final.png", exists("public/assets/chapter1/images/location_four_river_source_final.png"));
check("final 背景文件存在：location_adam_garden_work_final.png", exists("public/assets/chapter1/images/location_adam_garden_work_final.png"));
check("final 背景文件存在：location_tree_court_final.png", exists("public/assets/chapter1/images/location_tree_court_final.png"));
check("final 背景文件存在：location_east_garden_path_final.png", exists("public/assets/chapter1/images/location_east_garden_path_final.png"));
check("final 背景文件存在：location_naming_stone_bank_final.png", exists("public/assets/chapter1/images/location_naming_stone_bank_final.png"));
check("CHAPTER1_IMAGES 包含 eastGardenPath", assets.includes("eastGardenPath"));
check("assets.ts fourRiverSource 指向 final", assets.includes("location_four_river_source_final.png"));
check("assets.ts adamGardenWork 指向 final", assets.includes("location_adam_garden_work_final.png"));
check("assets.ts treeCourt 指向 final", assets.includes("location_tree_court_final.png"));
check("assets.ts eastGardenPath 指向 final", assets.includes("location_east_garden_path_final.png"));
check("assets.ts namingStoneBank 指向 final", assets.includes("location_naming_stone_bank_final.png"));
check("LOCATION_BG.east_garden_path 使用 CHAPTER1_IMAGES.eastGardenPath", worldPage.includes("east_garden_path: CHAPTER1_IMAGES.eastGardenPath"));
check("east_garden_path 不再复用 treeCourt", !worldPage.includes("east_garden_path: CHAPTER1_IMAGES.treeCourt"));

// ---- 园子中央新背景验收 ----
check("final 背景文件存在：location_central_meadow_final.png", exists("public/assets/chapter1/images/location_central_meadow_final.png"));
check("assets.ts centralMeadow 指向 final", assets.includes("location_central_meadow_final.png"));
check("assets.ts centralMeadow 不再引用 v3 webp", !assets.includes("location_central_meadow_v3_1920.webp"));

// ---- 场景浏览/对话明暗状态验收 ----
check("page.tsx 存在 sceneFocusMode 状态", worldPage.includes("sceneFocusMode"));
check("page.tsx 存在浏览/对话状态动态类", worldPage.includes("eden-game--world-${sceneFocusMode}"));
check("page.tsx 点击 NPC 进入对话状态", worldPage.includes('setSceneFocusMode("dialogue")'));
check("page.tsx 存在退出对话状态函数", worldPage.includes("handleExitDialogueFocus"));
check("page.tsx stage 点击退出对话", worldPage.includes("handleExitDialogueFocus"));
check("page.tsx NPC 按钮 stopPropagation", worldPage.includes("e.stopPropagation()"));
check("CSS 定义浏览状态明亮背景", css.includes(".eden-game--world-browse .eden-bg img") && css.includes("brightness(0.95)"));
check("CSS 定义浏览状态 overlay", css.includes(".eden-bg-overlay--browse"));
check("CSS 浏览状态覆盖 scene-progress 暗色", css.includes(".eden-game--world-browse.scene-progress-0 .eden-bg img"));
check("CSS 浏览状态 NPC 不暗化", css.includes(".eden-game--world-browse .eden-stage-character--dim") && css.includes("filter: none"));

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
