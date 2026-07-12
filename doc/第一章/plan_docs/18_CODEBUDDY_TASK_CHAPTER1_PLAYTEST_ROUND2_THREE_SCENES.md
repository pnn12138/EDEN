# 18 · 第一章人工测试第二轮：三场景问题修复

> 面向：CodeBuddy / 开发执行
> 范围：第一章 `/world` 人工测试第二轮反馈的三个场景问题
> 基线分支：`main`（commit `d2946a5`，承接 17 号文档六项修复之后）
> 文档性质：问题定位 + 修复规划 + 执行提示词索引

---

## 0. 概述

本文档基于对当前代码的逐行核查，确认第二轮人工测试的三个场景问题**全部存在**，并给出根因、代码定位与修复方案。所有改动遵循「一次性事件」原则——场景问题完成后不可通过切换场景、进入下一轮、刷新或读档重复领取奖励。

本轮涉及三个场景：

| 场景 | locationId | 核心问题 |
|---|---|---|
| 东园幽径 | `east_garden_path` | 进入即自动弹问题；选项/奖励与需求不符；需新增"幽径尽头"交互框 |
| 四河分流 | `naming_stone_bank` | 路西法立绘带灰底；场景介绍含"路西法看水"临时文字 |
| 伊甸之河 | `four_river_source` | 交互框双行显示；选项/奖励与需求不符（需 4 种水声回响） |

涉及的核心文件：

| 文件 | 关联问题 |
|---|---|
| `src/content/world/scenePuzzles.ts` | 东园幽径、伊甸之河（问题数据/选项/奖励） |
| `src/content/world/sceneActions.ts` | （仅核查，不改） |
| `src/content/world/items.ts` | 新增 7 个道具 |
| `src/content/world/locations.ts` | 四河分流文案；东园/伊甸场景介绍 |
| `src/game/world/puzzleRules.ts` | 场景问题结算（新增 per_option 模式 + 选项效果执行） |
| `src/game/world/actionPointRules.ts` | 行动点上限拆分（基础 + 全时段 + 时段加成） |
| `src/game/world/divineGiftRules.ts` | 献礼门槛修正 + 下限保护 |
| `src/game/world/divineAttentionRules.ts` | 注视值增加（引目） |
| `src/game/world/types.ts` | 新增状态字段 + 初始值 + normalize |
| `src/hooks/useWorldSave.ts` | 存档 normalize 兼容新字段 |
| `src/app/world/page.tsx` | 交互框、地图头像、双树名称、AP/注视值 UI |
| `src/app/api/world/puzzle/route.ts` | （核查，per_option 透传） |
| `src/components/world/ScenePuzzleModal.tsx` | 结果弹窗标题 + 反馈 |
| `src/components/world/InventoryPanel.tsx` | 新道具展示（核查即可） |
| `src/components/world/DivineAttentionViz.tsx` | 门槛 y 值用有效门槛 |
| `src/app/globals.css` | "幽径尽头"交互框样式、地图头像样式、双树标签样式 |
| `src/agents/world/buildAngelPrompt.ts` | 路西法人设 prompt"看水"措辞（可选） |

---

## 1. 东园幽径 ✅ 问题存在

### 1.1 根因

- 场景问题 `puzzle_east_path_cautious_presence` 定义于 `src/content/world/scenePuzzles.ts:96-130`，`trigger: "on_enter"`（`scenePuzzles.ts:98`）——三条场景问题中**唯一**自动弹出的。
- 自动弹出由 `src/app/world/page.tsx:800-815` 的 useEffect 实现：监听 `state.locationId` 等变化，调用 `getAvailableEnterPuzzle`（`src/game/world/puzzleRules.ts:90-95`，只挑 `on_enter` 且未完成的问题）后 `setActivePuzzle(puzzle)`。
- 当前**没有**东园幽径的可点击交互框（`page.tsx` 中无 `locationId === "east_garden_path"` 的交互按钮）。
- 当前 3 选项（`scenePuzzles.ts:103-118`）：`ask_gently` / `urge_directly` / `watch_silently`，`successTags: ["gentle_question", "patient_silence"]`（2 成功 1 失败），成功奖励单一 `resonance_silent_grass` + `trustDelta: 1`（`scenePuzzles.ts:122-125`）。
- 与需求差距大：需求 4 选项分别对应 众生回声 / 清醒之眼 / 双树残识 / 行动点归零，且无成功失败之分（每选项都完成事件、给对应奖励）。

### 1.2 一次性事件机制（已实现，无需改）

- 完成标记字段 `completedScenePuzzleIds: string[]`（`src/game/world/types.ts:432`）。
- 规则层 `isScenePuzzleCompleted`（`puzzleRules.ts:80-82`）+ `applyScenePuzzleAnswer` 完成检查（`puzzleRules.ts:134-149`）——已完成则返回 `rewards: []` 且不重复发奖。
- UI 层 `handleScenePuzzleClick`（`page.tsx:1379-1381`）/ `handleNamingStoneClick`（`page.tsx:1367-1369`）已完成则提示并 return。
- 存档：`completedScenePuzzleIds` 随整个 `EdenWorldState` 存 localStorage（`useWorldSave.ts:31`，key `eden:chapter1:world-state:v2`），刷新/读档保留。
- **结论：东园幽径当前不存在"可重复领奖"bug**，自动弹出是主要问题。改为 `explicit_interaction` + 交互框后，一次性语义自然满足。

### 1.3 修复方案

#### 1.3.1 改触发方式 + 新增"幽径尽头"交互框

1. `scenePuzzles.ts:98`：`trigger: "on_enter"` → `trigger: "explicit_interaction"`。改后 useEffect（`page.tsx:800-815`）不再自动弹出该问题。
2. 在 `page.tsx` 中、伊甸之河交互框（`page.tsx:1892-1908`）同级，新增东园幽径交互框，**参考刻名石**（`page.tsx:1873-1889`）写法：
   ```tsx
   {state.locationId === "east_garden_path" && (
     <button
       type="button"
       className={`eden-east-path-entry ${eastPathCompleted ? "eden-east-path-entry--completed" : ""}`}
       onClick={(event) => { event.stopPropagation(); handleScenePuzzleClick("puzzle_east_path_cautious_presence"); }}
       disabled={isLoading || !isExploreActive}
       aria-label={eastPathCompleted ? "幽径尽头，前方空无一物" : "走向幽径尽头"}
       title={eastPathCompleted ? "前方仍旧空无一物" : "走向小道的尽头"}
       data-testid="scene-action-east-path-end"
     >
       <span>幽径尽头</span>
     </button>
   )}
   ```
   - **只显示名称"幽径尽头"，不含 `<small>` 副标题**。
   - `eastPathCompleted` = `state.completedScenePuzzleIds.includes("puzzle_east_path_cautious_presence")`。
3. `handleScenePuzzleClick`（`page.tsx:1375-1386`）已完成时的提示文案改为：`"前方仍旧空无一物。"`（贴合需求反馈文案）。注意该 handler 是通用函数，被刻名石/伊甸之河/幽径尽头共用——需按 puzzleId 区分反馈文案，或新增专用 handler。**建议**：在 handler 内按 `puzzleId` 查表返回不同完成提示，避免影响刻名石/伊甸之河既有文案。
4. 完成后交互框采用**方案一（保留不可点视觉）**：加 `--completed` 类（opacity 0.82），文案仍为"幽径尽头"，点击给出"前方仍旧空无一物。"提示而不打开弹窗。

#### 1.3.2 新增交互框 CSS

在 `src/app/globals.css`（伊甸之河样式 `globals.css:6369-6416` 之后）新增 `.eden-east-path-entry`，坐标放在"小道延伸方向的尽头"，**不遮挡 NPC（加百列、刺猬）**：

```css
.eden-east-path-entry {
  position: absolute;
  left: 78%;          /* 小道远端，可按实际场景图微调 */
  top: 42%;
  z-index: 6;
  width: clamp(96px, 12vw, 138px);
  min-height: 46px;
  transform: translate(-50%, -50%);
  border: 1px solid rgba(180, 200, 150, 0.42);
  border-radius: 8px;
  background:
    radial-gradient(circle at 50% 40%, rgba(190, 210, 160, 0.22), transparent 62%),
    rgba(13, 18, 14, 0.7);
  box-shadow: 0 0 24px rgba(180, 200, 150, 0.18), inset 0 0 18px rgba(180, 200, 150, 0.1);
  color: #dfe8c8;
  cursor: pointer;
  pointer-events: auto;
}
.eden-east-path-entry span { display: block; font-size: 0.9rem; font-weight: 700; letter-spacing: 0; }
.eden-east-path-entry:hover, .eden-east-path-entry:focus-visible {
  border-color: rgba(210, 226, 170, 0.7);
  box-shadow: 0 0 34px rgba(180, 200, 150, 0.3), inset 0 0 22px rgba(180, 200, 150, 0.16);
}
.eden-east-path-entry--completed { opacity: 0.82; }
```

视觉风格与刻名石（金色）/伊甸之河（青色）一致，采用幽径的暗绿调以区分。

#### 1.3.3 重写问题文案与 4 选项（依赖 §8 数据结构扩展）

将 `puzzle_east_path_cautious_presence` 重写为 `resolutionMode: "per_option"`（见 §8.1），4 选项各带 `effect`：

- 标题：`幽径尽头的问题`
- 正文：`小道在这里戛然而止。前方没有墙，也没有树木阻挡，但无论怎样凝望，都看不见更远的地方。\n四周安静得有些不自然，仿佛只要做出某个选择，眼前的一切就会发生变化。你准备怎么做？`（只暗示不真实感，不直接说梦境）

| 选项 | 文案 | 效果（effect） |
|---|---|---|
| `echo_of_beings` | 闭上眼睛，记住远处传来的每一道声音。 | `itemId: "resonance_echo_of_beings"`, `unlockMapNpcLocations: true`, feedback 见下 |
| `sober_eye` | 睁大眼睛，尝试看清那些不自然的细节。 | `itemId: "resonance_sober_eye"`, `apMaxBonusDay: 1`, feedback |
| `twin_tree_memory` | 回想园子中央那两棵始终看不真切的树。 | `itemId: "resonance_twin_tree_memory"`, `unlockTreeNames: true`, feedback |
| `futile_struggle` | 不顾一切地向前冲去，试图撞破眼前的一切。 | 无 itemId，`zeroActionPoints: true`, `resultTitle: "徒劳的挣扎"`, feedback |

各选项 feedback：
- echo_of_beings：`你闭上眼，远处的声音一一落下位置。即使看不见他们，你也能从回声里分辨出每个人所在的地方。` 获得「众生回声」。
- sober_eye：`光影与时间之间细微的不协调，开始在你眼里显形。` 获得「清醒之眼」——白天行动点上限 +1。
- twin_tree_memory：`两棵树的轮廓逐渐在你的记忆中变得清晰，你终于能分清左侧与右侧。` 获得「双树残识」。
- futile_struggle（resultTitle `徒劳的挣扎`）：`你向前冲去，却像撞进了一片无形的深水。等你重新站稳时，眼前的景象没有任何改变，力气却已经消耗殆尽。` 数值提示：当前行动点已归零。

#### 1.3.4 删除/保留旧奖励

旧奖励 `resonance_silent_grass`（道具）+ `trustDelta: 1` 不再发放。**保留** `resonance_silent_grass` 在 `items.ts` 中（若其他规则/成就引用），但本问题不再授予。CodeBuddy 需 grep `resonance_silent_grass` 确认无硬依赖后可标注废弃。

### 1.4 验收

- [ ] 进入东园幽径不再自动弹出问题。
- [ ] 场景中可见"幽径尽头"交互框，无副标题。
- [ ] 点击"幽径尽头"才打开问题弹窗。
- [ ] 文案不直接说明当前是梦境。
- [ ] 4 选项分别给 众生回声 / 清醒之眼 / 双树残识 / 行动点归零。
- [ ] 选第 4 项后当前行动点立即归零，上限不变。
- [ ] 完成后无法重复打开/重复领奖；切换场景返回、下一轮、刷新/读档后完成状态保留。
- [ ] 完成后交互框保留但点击只提示"前方仍旧空无一物。"

---

## 2. 四河分流 ✅ 问题存在

### 2.1 路西法立绘灰底问题

#### 2.1.1 根因

- 路西法 NPC 定义：`src/content/world/npcs.ts:110-121`（`EdenNpcMeta` 无立绘字段）。
- 立绘资源路径常量：`src/game/assets.ts:63` → `luciferSprite: "/assets/chapter1/images/npc_lucifer_sprite.png"`。
- 立绘映射：`src/app/world/page.tsx:380` → `lucifer: { src: CHAPTER1_IMAGES.luciferSprite, alt: "路西法", w: 1023, h: 1537 }`。
- 渲染：`page.tsx:2012-2028`，`<Image className="eden-angel-stage-sprite" />`。
- **CSS 无任何背景**：`.eden-stage-angel`（`globals.css:1148-1158`）`background: transparent`；`.eden-angel-stage-sprite`（`globals.css:1160-1169`）无 `background`/`box-shadow`，完全依赖 PNG 自身 alpha 通道。
- **灰底来自 PNG 文件本身（二进制解码坐实）**：对 5 张天使立绘做 PNG IHDR + IDAT 解码核查（zlib inflate + 反 filter + 统计 alpha 通道），结果如下：

  | 立绘 | colorType | 尺寸 | 透明像素(alpha=0) | 半透明 | 不透明 | 结论 |
  |---|---|---|---|---|---|---|
  | michael（基准） | 6 (RGBA) | 1023×1537 | 45.1% | 0.7% | 54.3% | ✅ 透明 |
  | gabriel（基准） | 6 (RGBA) | 1023×1537 | 47.6% | 0.6% | 51.8% | ✅ 透明 |
  | **lucifer（问题）** | **2 (RGB)** | **832×1216** | — | — | 100% | ❌ **无 alpha 通道，实色背景** |
  | uriel（弃用） | 6 (RGBA) | 1023×1537 | 40.4% | 1.4% | 58.1% | ✅ 透明，同系列 |
  | raphael（弃用） | 6 (RGBA) | 1023×1537 | 49.8% | 0.9% | 49.4% | ✅ 透明，同系列 |

  路西法立绘是 **colorType=2 的 RGB 图（根本没有 alpha 通道）**，且 832×1216 与其他四位 1023×1537 不同尺寸/批次（IMG035，2026-07-11 单独生成），灰底被烘焙死。其余四位同属 IMG217-221 系列，RGBA 透明、同尺寸、同风格。
- **乌列尔是路西法的前身**：`npcs.ts:109`「路西法：此前以乌列尔隐藏身份出现，本次正名」、`npcChallenges.ts:47`/`npcLanguages.ts:60`「路西法由乌列尔正名而来」、`types.ts:613-639` 有 `uriel -> lucifer` 旧存档迁移。故复用乌列尔立绘语义最契合，且不与米迦勒撞图。
- 弃用天使立绘（raphael/uriel/cherubim）原在 commit `d72a967`（v1.1 素材整理，"清理旧版素材减轻仓库体积"）中被删除，列入 `REMOVED_NPC_IDS`（`types.ts:556-565`）。**删除原因是角色被移除，非立绘质量问题**。文件可从 `git show d72a967^:<path>` 恢复。`npc_uriel_sprite.png` 已恢复至工作区（2.0 MB，核查通过）。

#### 2.1.2 修复方案（恢复并复用乌列尔立绘，不重新生成）

需求明确「不要重新生成，从已启用且确认正常的天使立绘中复用一张」。结合 §2.1.1 的二进制核查，候选与取舍：

| 候选 | 文件 | colorType/透明度 | 风格 | 取舍 |
|---|---|---|---|---|
| **乌列尔** | `npc_uriel_sprite.png`（已恢复至工作区） | RGBA / 40.4% 透明 | 银金长袍光球光杖 | **首选**：透明正常、同系列、不撞图、语义契合（路西法前身） |
| 拉斐尔 | `npc_raphael_sprite.png` | RGBA / 49.8% 透明 | 绿金长袍植物杖 | 备选：透明正常，可从 `git show d72a967^:public/assets/chapter1/images/npc_raphael_sprite.png` 恢复 |
| 米迦勒 | `npc_michael_sprite.png` | RGBA / 45.1% 透明 | 深蓝暗金斗篷 | 次选：透明正常，但与伊甸之河米迦勒撞图 |
| 加百列 | `npc_gabriel_sprite.png` | RGBA / 47.6% 透明 | 白金长袍 | 次选：配色差异较大 |
| 基路伯 | `npc_cherubim_sprite.png` | RGBA | 遮面多翼非人化 | 不适合人形路西法 |

**推荐方案：改 `assets.ts` 常量路径指向乌列尔文件（最小改动）**

1. `src/game/assets.ts:63`：
   ```ts
   // 路西法立绘复用乌列尔（其前身）透明立绘；原 npc_lucifer_sprite.png 为 colorType=2 实色背景图，已废弃
   luciferSprite: "/assets/chapter1/images/npc_uriel_sprite.png",
   ```
   - **只改路径值，不改常量名 `luciferSprite`**。
2. `src/app/world/page.tsx`：**无需改**（仍引用 `CHAPTER1_IMAGES.luciferSprite`，`page.tsx:380`）。
3. `npc_uriel_sprite.png` 已恢复至 `public/assets/chapter1/images/`（2.0 MB，RGBA 透明，核查通过）。
4. 灰底问题文件 `npc_lucifer_sprite.png`（colorType=2，832×1216）：
   - **推荐删除**（避免未来误用）。删除后需同步更新视觉冒烟测试 `scripts/test-world-visual-smoke.mjs:114`（`npc_lucifer_sprite.png` 存在 -> `npc_uriel_sprite.png` 存在）。
   - 备选：保留不引用（测试 `:114` 仍过，零测试改动），但残留问题文件不洁。
5. 视觉冒烟测试 `scripts/test-world-visual-smoke.mjs` 断言核查：
   - `:109`（assets.ts 含 `luciferSprite` 常量名）-> **仍过**（常量名未改）。
   - `:123`（lucifer 块含 `CHAPTER1_IMAGES.luciferSprite`）-> **仍过**。
   - `:137`（3 个文件名字符串互不相同）-> **仍过**（gabriel/michael/lucifer 三个字符串本就不同，且 :137 只校验数组内字符串唯一性，不校验实际引用）。
   - `:114`（`npc_lucifer_sprite.png` 存在）-> 若删除灰底文件则**需改为** `npc_uriel_sprite.png` 存在；若保留则仍过。
6. `doc/AI_ASSET_RECORD.md`：更新 IMG035（路西法）标注废弃、IMG219（乌列尔）标注"复用为路西法立绘"（文档维护，可选但建议）。

> 为何不直接复用米迦勒：米迦勒立绘透明正常，但路西法（四河分流）与米迦勒（伊甸之河）是两个不同 NPC，复用同图会造成玩家混淆。乌列尔立绘透明度、尺寸、风格系列与米迦勒一致，且语义上是路西法前身，是更优解。


#### 2.1.3 立绘容器核查（已排除 CSS 因素）

- `.eden-stage-angel` 父容器 `background: transparent; border: none; padding: 0;`（`globals.css:1148-1158`），无半透明背景。
- `.eden-angel-stage-sprite` 无 `background`/`box-shadow`，仅 `filter: drop-shadow(...)`（`globals.css:1160-1169`）。
- 槽位定位 `stageSlots.ts:13-20`，天使优先级最高（`stageSlots.ts:40`），通常占 center-main（`bottom:6%`），底部贴合地面。
- **结论：换用透明 PNG 后立绘自然融入，无需改 CSS。**

### 2.2 场景介绍"路西法看水"问题

#### 2.2.1 根因

- 四河分流 locationId = `naming_stone_bank`（`src/content/world/locations.ts:146-147`）。
- 场景介绍字段定义于 `locations.ts:145-163`：
  - `shortDesc`（`locations.ts:148`）：`"主河离开园子后分成多道水流，路西法看水"` ← **含"路西法看水"**
  - `description`（`:149`）：`"主河离开园子后分出的多道水流，水声隆隆，路西法坐于石上望着每一道分流的去向。"` ← NPC 临时行为写入固定场景介绍
  - `enterNarration`（`:151`）：`"…路西法坐在河中央的石头上，望着每一道分流的去向。"`
  - `enterNarrationNight`（`:153`）：`"…路西法坐在岸边，影子被拉得很长…"`
  - `observeTextNight`（`:157`）：`"…路西法坐在岸边…"`
- 字段用途：`shortDesc` 显示在场景标题下（`page.tsx:1870`）与地图节点；`description` 显示在进入地点弹窗（`page.tsx:671`）；`enterNarration`/`enterNarrationNight` 由 `move_to_location` 返回（`worldActions.ts:68-71`）作 `toolNarration`。
- 另出现处：`src/agents/world/buildAngelPrompt.ts:114` 身份 prompt `identity: "你被神安置在四河分流处看水，是园中明亮之星。"`——这是路西法人设（角色设定），**非场景介绍**，但措辞含"看水"。

#### 2.2.2 修复方案

1. `locations.ts:148` `shortDesc` 改为需求建议文案：`"主河离开园子后分成多道水流，沿着不同方向流向远方。"`（纯环境，无 NPC 行为）。
2. `locations.ts:149` `description` 删除"路西法坐于石上望着每一道分流的去向"，改为：`"主河离开园子后分成多道水流，水声隆隆，沿着不同方向流向远方。"`
3. `locations.ts:150-151` `enterNarration`、`:152-153` `enterNarrationNight`、`:156-157` `observeTextNight`：删除"路西法坐在河中央的石头上…""路西法坐在岸边…"等 NPC 动作描写，保留水流/石子/飞鸟等环境描写。路西法的当前行为应体现在 NPC 状态/对话中（其 `shortDesc` 已有"看遍所有水流的走向"，`npcs.ts:112`）。
4. `buildAngelPrompt.ts:114` 人设 prompt：将"你被神安置在四河分流处看水"调整为"你被神安置在四河分流处，是园中明亮之星，看遍所有水流的走向"（与 `npcs.ts:112` shortDesc 对齐，去掉生硬的"看水"）。**可选但建议**，确保"看水"字样不再出现。
5. 全仓 grep `"路西法看水"` 与 `"看水"` 确认仅剩 `locations.ts:148`（修复后消失）与 `buildAngelPrompt.ts:114`（修复后消失）。`design/` 文档与成就文案中"看看水"等为子串误命中，无需改。
6. 测试数据核查：`scripts/test-world-visual-smoke.mjs:165` 仅断言 `namingStoneBankLoc.includes("lucifer")`（dayNpcs 含 lucifer），不涉及文案，删除临时文字不破坏测试。

### 2.3 验收

- [ ] 路西法不再使用带矩形背景的立绘。
- [ ] 路西法使用已恢复的乌列尔透明立绘（其前身），背景透明、无灰底。
- [ ] 场景介绍（shortDesc / description / enterNarration）不再出现"路西法看水"及"路西法坐于石上"等 NPC 行为。
- [ ] 切换场景或刷新后错误文案不再出现。
- [ ] 视觉冒烟测试 `test-world-visual-smoke.mjs` 通过（断言同步更新）。

---

## 3. 伊甸之河 ✅ 问题存在

### 3.1 交互框双行显示问题

#### 3.1.1 根因

- 场景问题 `puzzle_river_words_belonging`（`scenePuzzles.ts:132-165`），`trigger: "explicit_interaction"`（`scenePuzzles.ts:134`）——**已不自动弹出**（`page.tsx:1891` 注释"显式可点击，不自动弹窗"确认）。需求中"不自动弹出"部分**已满足**。
- 真正问题：交互框在 `page.tsx:1892-1908` 硬编码了两行：
  ```tsx
  <span>伊甸之河</span>
  <small>{riverCompleted ? "回声已记下" : "倾听水声"}</small>
  ```
  `<span>` 与 `<small>` 均 `display:block`（`globals.css:6390-6404`），故呈两行（名称 + 操作提示重复）。

#### 3.1.2 修复方案

1. `page.tsx:1905-1906` 改为只显示名称"倾听水流"，删除 `<small>`：
   ```tsx
   <span>倾听水流</span>
   ```
   （不显示副标题，不显示"倾听水声"等第二行。）
2. 完成态：文案仍为"倾听水流"（不变），保留 `--completed` 类作视觉淡化。点击时由 `handleScenePuzzleClick`（`page.tsx:1375-1386`）按 puzzleId 返回提示：`"水声依旧，却不再回应你的选择。"`
3. `aria-label` / `title` 同步调整为"倾听水流"。

### 3.2 重写问题文案与 4 选项（依赖 §8 数据结构扩展）

将 `puzzle_river_words_belonging` 重写为 `resolutionMode: "per_option"`，4 选项均获得"水声回响"的不同后缀版本：

- 标题：`伊甸之河的问题`
- 正文：`水声不断重复，却没有一次完全相同。\n你听得越久，周围的景象便越显得遥远，仿佛意识正漂向某个即将醒来的清晨。水流愿意留下一道回响，你准备听取哪一种？`（暗示似梦非梦，不直接判定梦境）

| 选项 | 文案 | 道具 | 效果（effect） |
|---|---|---|---|
| `revive` | 让疲惫随着水流离开。 | 水声回响·复苏 | `restoreActionPointsToMax: true` |
| `abundant` | 让河流拓宽我所能抵达的边界。 | 水声回响·丰沛 | `apMaxBonusBase: 1` |
| `attract` | 让这道声音传到更高的地方。 | 水声回响·引目 | `divineAttentionDelta: 1` |
| `conceal` | 让水声暂时盖过那道注视。 | 水声回响·藏目 | `divineThresholdModifier: -1` |

各选项 feedback（结果弹窗）：
- revive（复苏）：`水声洗去了你的疲惫。` 数值提示：行动点已全部恢复。
- abundant（丰沛）：`河流在你身后拓宽了一道边界。` 白天与夜晚行动点上限各 +1。
- attract（引目）：`那道声音顺着水流攀向更高的地方，引起了一阵注视。` 神明注视值 +1。
- conceal（藏目）：`水声暂时盖过了那道注视，门槛随之松弛。` 献礼门槛永久 -1（不低于 1）。

> 道具界面需明确显示后缀与效果（见 §8.2 新道具定义）。4 个水声回响变体各自有独立 itemId、title（含水声回响·后缀）、shortEffect。

### 3.3 一次性限制

- 已由 `completedScenePuzzleIds` 机制保证（同 §1.2）。
- 完成后"倾听水流"保留可点，点击提示"水声依旧，却不再回应你的选择。"，不弹选项。
- 切换场景返回 / 下一轮 / 刷新读档均不重复领取。

### 3.4 旧奖励处理

旧奖励 `clue_four_river_echo`（线索）+ `resonance_four_river_echo`（道具）不再发放。CodeBuddy 需 grep 两者确认是否有成就/结局依赖：
- 若 `clue_four_river_echo` 被成就/结局引用，考虑在新选项中保留授予该线索（作为基础线索，与水声回响道具并存）。
- 若无依赖，标注废弃但保留数据。

### 3.5 验收

- [ ] 进入伊甸之河不自动弹出问题（已满足，回归确认）。
- [ ] 交互对象只显示"倾听水流"，无副标题。
- [ ] 4 选项均获得"水声回响"的不同属性版本（复苏/丰沛/引目/藏目）。
- [ ] 道具界面能区分 4 个版本（标题含后缀、shortEffect 明确）。
- [ ] 复苏：当前行动点回复至当前上限（白天回白天上限、夜晚回夜晚上限）。
- [ ] 丰沛：白天与夜晚行动点上限各 +1。
- [ ] 丰沛与清醒之眼可叠加（基础+1 + 白天+1）。
- [ ] 引目：神明注视值 +1，达门槛只触发一次献礼。
- [ ] 藏目：当前及后续献礼门槛 -1，不低于 1；降低后若已达标立即触发一次献礼。
- [ ] 完成后不能重复领取任何效果。

---

## 4. 行动点上限拆分 ✅ 需新增机制

### 4.1 现状

- `actionPoints`（当前值，`types.ts:333`）+ `maxActionPoints`（上限，`types.ts:334`），初始均 5（`types.ts:483-484`）。
- **单一扁平上限，无白天/夜晚区分，无"基础 + 加成"概念。** `timeOfDay: "day" | "night"`（`types.ts:330`，类型 `types.ts:210`）仅影响背景/NPC/注视，不影响 AP 上限。
- `restoreActionPoints`（私有，`actionPointRules.ts:91-94`）：`state.actionPoints = state.maxActionPoints`，仅在 `advanceToNextSlot`（`actionPointRules.ts:162`）内调用。
- `consumeActionPoints(state, cost)`（`actionPointRules.ts:40-42`）：`Math.max(0, state.actionPoints - cost)`，用于归零。
- AP UI：dots `page.tsx:1763-1770`（`Array.from({length: state.maxActionPoints})`，title `${actionPoints}/${maxActionPoints}`）；状态栏 `page.tsx:2613`；AP 耗尽提示 `page.tsx:2218` 硬编码"恢复5点"。
- `resonance_river_dew` 回 AP 用 `Math.min(state.maxActionPoints, ...)`（`resonanceRules.ts:296`）。

### 4.2 修复方案

#### 4.2.1 新增状态字段（见 §8.3）

- `apMaxBonusBase: number`（默认 0）：全时段行动点上限加成（水声回响·丰沛 +1）。
- `apMaxBonusDay: number`（默认 0）：白天行动点上限加成（清醒之眼 +1）。

#### 4.2.2 新增有效上限计算函数

在 `src/game/world/actionPointRules.ts` 新增并导出：

```ts
export function getEffectiveMaxActionPoints(state: EdenWorldState): number {
  const base = state.maxActionPoints ?? 5;
  const bonusAll = state.apMaxBonusBase ?? 0;
  const bonusDay = state.timeOfDay === "day" ? (state.apMaxBonusDay ?? 0) : 0;
  return base + bonusAll + bonusDay;
}
```

对应需求公式：`最终行动点上限 = 基础行动点上限 + 全时段行动点上限加成 + 当前时段行动点上限加成`。

#### 4.2.3 改造恢复与读取点

1. `restoreActionPoints`（`actionPointRules.ts:91-94`）改用有效上限：
   ```ts
   function restoreActionPoints(state: EdenWorldState): void {
     state.actionPoints = getEffectiveMaxActionPoints(state);
     state.npcActionPoints = state.maxNpcActionPoints;
   }
   ```
   ——满足"进入新白天/新夜晚阶段，行动点回复至新的上限"。
2. `resonance_river_dew` 回 AP（`resonanceRules.ts:296`）：`Math.min(getEffectiveMaxActionPoints(state), state.actionPoints + 1)`。
3. AP UI 读取（`page.tsx:1763-1770` dots、`:2613` 状态栏、`:2218` 耗尽提示）：把 `state.maxActionPoints` 替换为 `getEffectiveMaxActionPoints(state)`。耗尽提示文案改为动态数值（如"恢复 {n} 点行动点"）。
4. `cloneWorldState`（`src/app/api/world/route.ts:262-303`）：`maxActionPoints ?? 5` 保留；新增 `apMaxBonusBase ?? 0`、`apMaxBonusDay ?? 0` 兜底（标量无需深拷贝）。

#### 4.2.4 选项效果执行（在 §8 per_option 结算中调用）

- **清醒之眼**（`apMaxBonusDay: 1`）：`state.apMaxBonusDay += 1`。**不立即回复当前 AP**（只提上限）。
- **水声回响·丰沛**（`apMaxBonusBase: 1`）：`state.apMaxBonusBase += 1`。**不立即回复当前 AP**。
- **水声回响·复苏**（`restoreActionPointsToMax: true`）：`state.actionPoints = getEffectiveMaxActionPoints(state)`。满 AP 时仍可选，但不超过上限。
- **东园·行动点归零**（`zeroActionPoints: true`）：`state.actionPoints = 0`。不动上限，不影响下一轮回满。

#### 4.2.5 叠加示例（与需求一致）

基础 5 + 丰沛(+1 全时段) + 清醒之眼(+1 白天)：
- 白天上限 = 5 + 1 + 1 = 7
- 夜晚上限 = 5 + 1 + 0 = 6

#### 4.2.6 显示

- 道具 `清醒之眼` 的 `shortEffect`：`白天行动点上限 +1（本局永久）`。
- 道具 `水声回响·丰沛` 的 `shortEffect`：`白天与夜晚行动点上限各 +1（本局永久）`。
- 顶部 AP dots 数量随有效上限变化（白天/夜晚切换时 dot 数量可能不同，符合需求）。

### 4.3 验收

- [ ] 清醒之眼：白天上限 +1，夜晚不变。
- [ ] 丰沛：白天与夜晚上限各 +1。
- [ ] 二者叠加：白天 7、夜晚 6（基础 5）。
- [ ] 复苏：当前 AP 回复至当前时段有效上限。
- [ ] 行动点归零：当前 AP=0，上限不变，下一轮正常回满。
- [ ] 获得加成道具时不直接回复当前 AP。
- [ ] 顶部 AP 显示使用有效上限。

---

## 5. 神明注视值与献礼门槛 ✅ 需新增机制

### 5.1 现状

- `divineAttention`（0-4 可视等级，`types.ts:345`）+ `divineAttentionCumulative`（正向累计、驱动献礼，`types.ts:348`）。
- `applyDivineAttention(state, delta)`（`divineAttentionRules.ts:139-155`）：同时改可视等级与累计值，且有 `gift_attention_accel` ×1.5 加速。
- `shouldTriggerGiftChoice(state)`（`divineGiftRules.ts:120-126`）：`DIVINE_GIFT_THRESHOLDS[owned - 1]` 比较累计值。
- `DIVINE_GIFT_THRESHOLDS = [2, 3, 4, 5, 6, 7]`（`divineGiftRules.ts:42`）。
- `claimDivineGift`（`divineGiftRules.ts:129-162`）：领奖后 `state.divineAttentionCumulative = 0`（`:154`，17 号文档已修复）。
- UI：`DivineAttentionViz.tsx:85-87` 显示 `注视值：{cumulative}/{nextThreshold}`；`page.tsx:1750-1756` 传 `nextThreshold={DIVINE_GIFT_THRESHOLDS[divineGiftsOwned.length - 1] ?? null}`。
- **无门槛修正机制，无下限保护。**

### 5.2 修复方案

#### 5.2.1 新增状态字段（见 §8.3）

- `divineThresholdModifier: number`（默认 0）：献礼门槛永久修正（负值=降低，藏目 -1）。

#### 5.2.2 新增有效门槛计算函数

在 `src/game/world/divineGiftRules.ts` 新增并导出：

```ts
export function getEffectiveDivineThreshold(state: EdenWorldState): number | null {
  const owned = state.divineGiftsOwned.length;
  if (owned === 0 || owned >= 7) return null;   // 开局/集满不显示
  const base = DIVINE_GIFT_THRESHOLDS[owned - 1];
  const modifier = state.divineThresholdModifier ?? 0;
  return Math.max(1, base + modifier);          // 最低不低于 1
}
```

对应需求公式：`实际献礼门槛 = 当前阶段基础门槛 + 永久门槛修正`，最低 1。

#### 5.2.3 改造触发与 UI

1. `shouldTriggerGiftChoice`（`divineGiftRules.ts:120-126`）改用有效门槛：
   ```ts
   const threshold = getEffectiveDivineThreshold(state);
   if (threshold === null) return false;
   return state.divineAttentionCumulative >= threshold;
   ```
2. UI 传参（`page.tsx:1755`）：`nextThreshold={getEffectiveDivineThreshold(state)}`（替换 `DIVINE_GIFT_THRESHOLDS[...]`）。`DivineAttentionViz` 接收后显示。
3. `claimDivineGift` 维持 `divineAttentionCumulative = 0`（已有）。

#### 5.2.4 选项效果执行

- **水声回响·引目**（`divineAttentionDelta: 1`）：直接 `state.divineAttentionCumulative += 1`（**不**走 `applyDivineAttention`，避免可视等级变化与 accel 乘数——引目是道具直加累计值）。然后 `shouldTriggerGiftChoice(next)` 为真则 `rollGiftChoices` 返回 `divineGiftChoice`。顶部 UI 立即刷新（state 更新触发）。
- **水声回响·藏目**（`divineThresholdModifier: -1`）：`state.divineThresholdModifier -= 1`。**不**清空当前注视值。然后 `shouldTriggerGiftChoice(next)` 为真（因门槛降低，累计值可能已达标）则返回 `divineGiftChoice`。

#### 5.2.5 防重复触发（关键）

- 引目/藏目在一次选项结算中**只检查一次** `shouldTriggerGiftChoice`，返回 `divineGiftChoice` 后由前端弹出三选一；玩家选择后 `claimDivineGift` 将累计值归零，不会再次触发。
- **藏目边界**：若选项结算前 `shouldTriggerGiftChoice` 已为真（即献礼本就 pending），则不再重复设置 `divineGiftChoice`（前端已有 pending 选择列表）。CodeBuddy 需在 per_option 结算中判断：仅当此前未 pending 且结算后 `shouldTriggerGiftChoice` 为真时才返回 `divineGiftChoice`。
- **藏目降低后立即触发**：如当前 `2/3`（门槛 3），藏目使门槛变 2，累计 2 ≥ 2 → 触发献礼；领奖后累计归零、`owned+1`，下一门槛取 `DIVINE_GIFT_THRESHOLDS[owned] + modifier`（如 `0/3`，假设下一基础 4 + (-1) = 3）。符合需求示例。

### 5.3 验收

- [ ] 引目：注视值 +1，顶部 UI 立即刷新。
- [ ] 引目达门槛后只触发一次献礼。
- [ ] 藏目：当前及后续门槛各 -1，最低不低于 1。
- [ ] 藏目降低后若已达标，立即触发一次献礼。
- [ ] 献礼触发后注视值清零、进入下一阶段门槛。
- [ ] 不因门槛变化导致献礼重复触发。

---

## 6. 众生回声 · 地图 NPC 头像 ✅ 需新增功能

### 6.1 现状

- 地图弹层 `page.tsx:2873-3004`；热点配置 `MAP_HOTSPOTS`（`page.tsx:383-391`，`{x, y, labelOffset}`）。
- 地图节点（热点 button）只显示地点名 + 状态文字（`page.tsx:2921-2936`），**节点旁不显示 NPC**。
- NPC 信息仅在选中地点详情框以**文字 chip** 显示（`page.tsx:2946-2981`），无头像。
- **无卡通头像资源**：现有 `NPC_SPRITE`（`page.tsx:374-381`）为全身大图（eve/adam/hedgehog/gabriel/michael/lucifer）；`forbidden_tree`/`tree_of_life` 无立绘（CSS 对象）。
- `state.npcLocations: Record<EdenNpcId, EdenLocationId>`（`types.ts:399`），NPC 移动后由 React state 刷新。
- `getVisibleNpcsAtLocation(s, locId)`（`page.tsx:885-904`）：按昼夜 + 位置过滤可见 NPC。**可复用**。
- **第一章无 NPC 死亡/消失机制**——可见性即昼夜 + 位置。

### 6.2 修复方案

#### 6.2.1 新增状态字段

- `unlockMapNpcLocations: boolean`（默认 false）：众生回声解锁。

#### 6.2.2 地图热点旁渲染 NPC 头像

不新增美术资源，**复用现有全身立绘做小尺寸圆形头像**（与项目"无新素材"约束一致）。在 `page.tsx:2906-2937` 热点渲染循环内，当 `state.unlockMapNpcLocations` 为真时，于热点旁附加该地点可见 NPC 的头像组：

```tsx
{state.unlockMapNpcLocations && (() => {
  const npcs = getVisibleNpcsAtLocation(state, locId)
    .filter((id) => NPC_SPRITE[id]);   // 仅渲染有立绘的 NPC（排除双树）
  if (!npcs.length) return null;
  return (
    <div className="eden-map-hotspot-avatars" aria-hidden="true">
      {npcs.map((id) => {
        const sprite = NPC_SPRITE[id];
        return (
          <Image key={id} src={sprite.src} alt={EDEN_NPCS[id].name}
            width={28} height={28}
            className="eden-map-hotspot-avatar" title={EDEN_NPCS[id].name} />
        );
      })}
    </div>
  );
})()}
```

- 头像用 `object-fit: cover; border-radius: 50%` 裁为圆形小头像（28-32px），并排显示（`display:flex; gap:4px`）。
- **位置**：头像组定位在热点 button 旁（如热点右上角或正上方），`pointer-events: none`，不遮挡热点点击。
- NPC 移动场景后 `npcLocations` 变化 → `getVisibleNpcsAtLocation` 重算 → 头像位置同步更新。
- 昼夜切换后 NPC 可见性变化 → 头像组同步增减（满足"暂时不可见不显示"）。
- 双树无立绘且不移动，被 `NPC_SPRITE[id]` 过滤排除（不显示）。
- 只显示 NPC 所在场景，不显示场景内精确坐标（地图本身就是场景级，满足）。

#### 6.2.3 CSS

在 `globals.css` 地图样式段新增：
```css
.eden-map-hotspot-avatars {
  position: absolute;
  left: 50%; top: -14px;
  transform: translate(-50%, -100%);
  display: flex; gap: 4px;
  pointer-events: none;
  z-index: 7;
}
.eden-map-hotspot-avatar {
  width: 28px; height: 28px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid rgba(246, 219, 144, 0.7);
  box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  background: rgba(13,18,14,0.5);
}
```

#### 6.2.4 选项效果执行

- **众生回声**（`unlockMapNpcLocations: true`）：`state.unlockMapNpcLocations = true`。地图随即显示头像。

### 6.3 验收

- [ ] 选"众生回声"后，打开地图可见每个场景节点旁显示其中 NPC 头像。
- [ ] 同场景多 NPC 并排显示。
- [ ] NPC 移动场景后头像位置同步。
- [ ] 夜晚不出现的 NPC 不显示头像。
- [ ] 双树不显示头像。
- [ ] 效果持续至本场游戏结束（新游戏重置）。

---

## 7. 双树残识 · 双树真实名称 ✅ 需新增功能

### 7.1 现状

- `forbidden_tree`（分别善恶树，`npcs.ts:71-81`）与 `tree_of_life`（生命树，`npcs.ts:124-135`），`kind: "world_object"`，初始位置 `central_meadow`（`types.ts:500/504`）。
- **名称始终公开显示**（npcs.ts name 字段 + 各处文案），无"解锁后显示真名"机制。
- 渲染：`tree_of_life` 为 CSS 元素（`page.tsx:2050-2052`，`.eden-stage-tree-of-life` `left:50%; bottom:25%` 居中，`pointer-events:none`，`globals.css:3836-3843`）；`forbidden_tree` 无独立渲染元素（`.eden-world-forbidden-tree` `display:none`，`globals.css:3930-3932`）。**无左右视觉区分**。
- 数据层有左右概念：`fruitDirectionBias: {left, right}`（`types.ts:390`）、`pickedFruitSide: "left"|"right"|null`（`types.ts:393`），注释 `left=生命树，right=善恶树`。
- 两树通过禁忌动作链工具交互（`look_at_tree` 等，`types.ts:100-104`），非 sceneAction。
- 属性页可查看：`forbidden_tree`（`page.tsx:234-244`）、`tree_of_life`（`page.tsx:278-288`）。

### 7.2 修复方案

#### 7.2.1 新增状态字段

- `unlockTreeNames: boolean`（默认 false）：双树残识解锁。

#### 7.2.2 新增显示名 helper

在 `src/content/world/npcs.ts` 或 `src/game/world/types.ts` 旁新增 helper：
```ts
export function getTreeDisplayName(npcId: "forbidden_tree" | "tree_of_life", state: EdenWorldState): string {
  if (state.unlockTreeNames) {
    return npcId === "tree_of_life" ? "生命树" : "分别善恶树";
  }
  return npcId === "tree_of_life" ? "园中央左侧的树" : "园中央右侧的树";
}
```
（左侧=生命树，右侧=分别善恶树，与 `pickedFruitSide` 注释一致。）

#### 7.2.3 园心双树交互框（central_meadow）

在 `central_meadow` 场景新增一个交互框"园心双树"（参考刻名石/幽径尽头模式），点击弹出简单信息弹窗：
- 解锁前：`两棵树的轮廓始终看不真切，你分不清它们有何不同。`
- 解锁后：`园子中央并立着两棵树——左侧是生命树，右侧是分别善恶树。`

这满足需求"可以显示在场景交互框、场景介绍或点击后的简单信息弹窗中"与"明确区分左侧和右侧"。可复用 `systemHint` 或一个轻量弹窗展示。

> 该交互框**不**绑定场景问题（不是 ScenePuzzle），仅作信息展示，因此不受一次性事件限制；可反复点击查看。

#### 7.2.4 属性页与既有名称显示

- `forbidden_tree`/`tree_of_life` 属性页（`page.tsx:234-288`）的标题改用 `getTreeDisplayName(id, state)`，解锁前显示模糊名，解锁后显示真名。
- 全仓 grep `生命树`/`分别善恶树` 在**场景级用户可见文案**中的出现（如 locations 描述、NPC 对话模板），评估是否需条件化。**优先保证属性页与园心双树交互框两处**；对话中由 LLM 生成的名称不在本次硬改范围（可由 prompt 引导，非必须）。

#### 7.2.5 选项效果执行

- **双树残识**（`unlockTreeNames: true`）：`state.unlockTreeNames = true`。园心双树交互框与属性页随即显示真名。

### 7.3 验收

- [ ] 选"双树残识"后，可查看两棵树的真实名称。
- [ ] 名称明确区分左侧（生命树）与右侧（分别善恶树）。
- [ ] 解锁前属性页/交互框不显示真实名称。
- [ ] 解锁状态持续至本场游戏结束。
- [ ] 树木名称沿用游戏设定，不随机生成。

---

## 8. 数据结构与道具系统扩展

### 8.1 ScenePuzzle 扩展：per_option 解析模式

当前 `ScenePuzzle`（`scenePuzzles.ts:29-62`）为「单 `rewards` + `successTags` 二元判定」。新增「每选项独立奖励」模式：

```ts
// 新增类型
export type ScenePuzzleOptionEffect = {
  feedback: string;                       // 结果反馈正文
  resultTitle?: string;                   // 结果弹窗标题（如"徒劳的挣扎"）
  itemId?: string;                        // 获得道具
  zeroActionPoints?: boolean;             // 当前行动点归零
  restoreActionPointsToMax?: boolean;     // 当前行动点回复至有效上限
  apMaxBonusBase?: number;                // 基础行动点上限永久 +N
  apMaxBonusDay?: number;                 // 白天行动点上限永久 +N
  divineAttentionDelta?: number;          // 神明注视值（累计）+N
  divineThresholdModifier?: number;       // 献礼门槛永久修正（负值=降低）
  unlockMapNpcLocations?: boolean;        // 解锁地图 NPC 位置
  unlockTreeNames?: boolean;              // 解锁双树真实名称
};

// ScenePuzzleOption 增加可选 effect
export type ScenePuzzleOption = {
  id: string;
  text: string;
  tags: string[];
  effect?: ScenePuzzleOptionEffect;       // 新增
};

// ScenePuzzle 增加解析模式
export type ScenePuzzle = {
  ... // 既有字段
  resolutionMode?: "success_failure" | "per_option";  // 新增，默认 "success_failure"
};
```

### 8.1.1 applyScenePuzzleAnswer 改造（`puzzleRules.ts:109-230`）

在函数开头，`inputMode === "choice"` 分支内，若 `puzzle.resolutionMode === "per_option"`，走新分支 `applyPerOptionAnswer`：

```ts
function applyPerOptionAnswer(state, puzzle, optionId): ScenePuzzleAnswerResult {
  const option = findPuzzleOption(puzzle, optionId);
  const next = cloneWorldStateForPuzzle(state);
  const alreadyCompleted = isScenePuzzleCompleted(next, puzzle.id);
  if (alreadyCompleted) {
    return { success: false, alreadyCompleted: true, selectedOptionId: optionId,
      feedback: "这个问题已经在本局留下答案，奖励不会再次出现。",
      state: next, rewards: [], divineGiftChoice: null };
  }
  if (!option?.effect) {
    return { /* 选项无 effect 兜底 */ };
  }
  const rewards: ScenePuzzleRewardResult[] = [];
  const effect = option.effect;
  let divineGiftChoice: string[] | null = null;
  const wasPending = shouldTriggerGiftChoice(next);   // 防重复触发基准

  // 1. 道具
  if (effect.itemId) {
    grantResonance(next, effect.itemId, 1);
    const item = getItemById(effect.itemId);
    rewards.push({ type: "item", id: effect.itemId, title: item ? `回响：${item.title}` : effect.itemId });
  }
  // 2. 行动点上限加成（不回复当前 AP）
  if (effect.apMaxBonusBase) next.apMaxBonusBase = (next.apMaxBonusBase ?? 0) + effect.apMaxBonusBase;
  if (effect.apMaxBonusDay) next.apMaxBonusDay = (next.apMaxBonusDay ?? 0) + effect.apMaxBonusDay;
  // 3. 行动点即时变化
  if (effect.zeroActionPoints) next.actionPoints = 0;
  if (effect.restoreActionPointsToMax) next.actionPoints = getEffectiveMaxActionPoints(next);
  // 4. 神明注视值
  if (effect.divineAttentionDelta) {
    next.divineAttentionCumulative = Math.max(0, next.divineAttentionCumulative + effect.divineAttentionDelta);
    rewards.push({ type: "attention", title: `神的注视 +${effect.divineAttentionDelta}` });
  }
  // 5. 献礼门槛修正
  if (effect.divineThresholdModifier) {
    next.divineThresholdModifier = (next.divineThresholdModifier ?? 0) + effect.divineThresholdModifier;
  }
  // 6. 解锁开关
  if (effect.unlockMapNpcLocations) next.unlockMapNpcLocations = true;
  if (effect.unlockTreeNames) next.unlockTreeNames = true;

  // 7. 触发献礼（仅当此前未 pending 且现在满足门槛时）
  if (!wasPending && shouldTriggerGiftChoice(next)) {
    divineGiftChoice = rollGiftChoices(next.divineGiftsOwned);
  }

  next.completedScenePuzzleIds = [...next.completedScenePuzzleIds, puzzle.id];
  return { success: true, alreadyCompleted: false, selectedOptionId: optionId,
    resultTitle: effect.resultTitle, feedback: effect.feedback,
    state: next, rewards, divineGiftChoice };
}
```

- `ScenePuzzleAnswerResult`（`puzzleRules.ts:26-35`）新增 `resultTitle?: string`。
- `cloneWorldStateForPuzzle`（`puzzleRules.ts:49-78`）需补全新标量字段兜底（`apMaxBonusBase ?? 0` 等），无需深拷贝。
- `/api/world/puzzle/route.ts` 无需改（透传 result）。

### 8.1.2 ScenePuzzleModal 改造

- 结果展示区渲染 `result.resultTitle`（若有）作为标题，`result.feedback` 作为正文。
- 选项弹窗对 `per_option` 模式：所有选项均"提交即完成"，无成功/失败色调区分。

### 8.2 新增 7 个道具（`src/content/world/items.ts`）

```ts
// 东园幽径
{ id: "resonance_echo_of_beings", title: "众生回声",
  description: "即使看不见他们，你仍能从园中的回声里分辨出每个人的位置。",
  obtainLocation: "east_garden_path", kind: "passive", sourceType: "scene", sourceName: "东园幽径",
  shortEffect: "地图上显示每个 NPC 当前所在的场景。", icon: "👂" },
{ id: "resonance_sober_eye", title: "清醒之眼",
  description: "你开始注意到光影与时间之间细微的不协调。",
  obtainLocation: "east_garden_path", kind: "passive", sourceType: "scene", sourceName: "东园幽径",
  shortEffect: "白天行动点上限 +1（本局永久）。", icon: "👁️" },
{ id: "resonance_twin_tree_memory", title: "双树残识",
  description: "两棵树的轮廓逐渐在你的记忆中变得清晰。",
  obtainLocation: "east_garden_path", kind: "passive", sourceType: "scene", sourceName: "东园幽径",
  shortEffect: "可分辨园子中央左侧（生命树）与右侧（分别善恶树）的真实名称。", icon: "🌳" },

// 伊甸之河（水声回响四变体）
{ id: "resonance_water_echo_revive", title: "水声回响·复苏",
  description: "水声洗去了你的疲惫。",
  obtainLocation: "four_river_source", kind: "instant", sourceType: "scene", sourceName: "伊甸之河",
  shortEffect: "当前行动点立即回复至上限。", icon: "💧" },
{ id: "resonance_water_echo_abundant", title: "水声回响·丰沛",
  description: "河流拓宽了你所能抵达的边界。",
  obtainLocation: "four_river_source", kind: "passive", sourceType: "scene", sourceName: "伊甸之河",
  shortEffect: "白天与夜晚行动点上限各 +1（本局永久）。", icon: "🌊" },
{ id: "resonance_water_echo_attract", title: "水声回响·引目",
  description: "那道声音攀向更高的地方，引起了一阵注视。",
  obtainLocation: "four_river_source", kind: "instant", sourceType: "scene", sourceName: "伊甸之河",
  shortEffect: "神明注视值 +1，达门槛即触发献礼。", icon: "✨" },
{ id: "resonance_water_echo_conceal", title: "水声回响·藏目",
  description: "水声暂时盖过了那道注视。",
  obtainLocation: "four_river_source", kind: "passive", sourceType: "scene", sourceName: "伊甸之河",
  shortEffect: "所有神明献礼门槛永久 -1（不低于 1）。", icon: "🌫️" },
```

> `kind` 选择：丰沛/藏目/清醒之眼/众生回声/双树残识为永久加成 → `passive`；复苏/引目为即时结算 → `instant`。实际机制由 `applyPerOptionAnswer` 在完成问题时一次性执行，`kind` 仅影响 InventoryPanel 是否显示"使用"按钮（passive 显示"自动生效"）。复苏/引目虽标 `instant`，但已在问题结算时执行，InventoryPanel 的"使用"按钮应不出现重复执行——CodeBuddy 需确认 `instant` 道具若无 `executeInstantResonance` 实现时不报错（参考 `resonanceRules.ts:295-300`，未实现的 instant 静默跳过）。

### 8.3 新增状态字段（`src/game/world/types.ts`）

在 `EdenWorldState`（`types.ts:321-`）`maxActionPoints` 附近新增：

```ts
/** 全时段行动点上限加成（水声回响·丰沛） */
apMaxBonusBase: number;
/** 白天行动点上限加成（清醒之眼） */
apMaxBonusDay: number;
/** 献礼门槛永久修正（水声回响·藏目，负值=降低） */
divineThresholdModifier: number;
/** 众生回声：地图显示 NPC 所在场景 */
unlockMapNpcLocations: boolean;
/** 双树残识：解锁双树真实名称 */
unlockTreeNames: boolean;
```

在 `initialEdenWorldState`（`types.ts:473-551`，`maxActionPoints` 于 `:484` 附近）补默认值：
```ts
apMaxBonusBase: 0,
apMaxBonusDay: 0,
divineThresholdModifier: 0,
unlockMapNpcLocations: false,
unlockTreeNames: false,
```

---

## 9. 存档兼容（关键）

### 9.1 存档读取链路现状

- key `eden:chapter1:world-state:v2`（`useWorldSave.ts:31`），`JSON.stringify(stateRef.current)` 整体序列化。
- 读取链路：`tryNormalize` → `normalizeWorldStateForClient`（`useWorldSave.ts:14-28`）→ `normalizePuzzleState`（`puzzleRules.ts:41-47`）。
- **`withNpcWorldDefaults`（`types.ts:580-671`）未被存档读取链路调用**——在此函数补默认值对旧存档无效。
- 服务端 `cloneWorldState`（`route.ts:262-303`）对 `maxActionPoints` 有 `?? 5` 兜底。

### 9.2 新字段兼容点

新字段为标量，必须显式补默认值，否则旧存档读取时为 `undefined`：

| 字段 | 兜底位置 | 兜底值 |
|---|---|---|
| `apMaxBonusBase` | `normalizePuzzleState` + `cloneWorldStateForPuzzle` + `cloneWorldState`（route.ts） | `?? 0` |
| `apMaxBonusDay` | 同上 | `?? 0` |
| `divineThresholdModifier` | 同上 | `?? 0` |
| `unlockMapNpcLocations` | 同上 | `?? false` |
| `unlockTreeNames` | 同上 | `?? false` |

具体改动：
1. `normalizePuzzleState`（`puzzleRules.ts:41-47`）补 5 个字段兜底。
2. `normalizeWorldStateForClient`（`useWorldSave.ts:14-28`）补同样兜底（客户端首读）。
3. `cloneWorldStateForPuzzle`（`puzzleRules.ts:49-78`）补兜底（puzzle 结算前 clone）。
4. `cloneWorldState`（`route.ts:262-303`）补兜底（低语/工具结算前 clone）。
5. `getEffectiveMaxActionPoints` / `getEffectiveDivineThreshold` 内部已用 `?? 0` 防御，双保险。

### 9.3 新游戏重置

- `handleRestart`（`page.tsx:1464-1469`）调 `makeInitialState`（`page.tsx:480` 附近，基于 `initialEdenWorldState`）→ 新字段自动回到默认值（0/false）。满足"重新开始新游戏后恢复默认数值"。

### 9.4 旧存档已完成的场景问题

- 旧存档若已 `completedScenePuzzleIds` 含 `puzzle_east_path_cautious_presence`，重写后该 puzzle 仍标记完成，不会重复触发。但旧存档玩家不会获得新道具/新加成（因已完成不可再领）。**可接受**——本局已答过旧问题，新机制下一局生效。

---

## 10. 任务分解（按文件）

| # | 文件 | 改动 |
|---|---|---|
| T1 | `src/content/world/scenePuzzles.ts` | 新增 `ScenePuzzleOptionEffect` / `resolutionMode` 类型；重写东园幽径（4 选项 per_option，trigger 改 explicit_interaction）与伊甸之河（4 选项 per_option）问题 |
| T2 | `src/game/world/puzzleRules.ts` | 新增 `applyPerOptionAnswer`；`ScenePuzzleAnswerResult` 加 `resultTitle`；`cloneWorldStateForPuzzle` 补新字段兜底；`normalizePuzzleState` 补新字段兜底 |
| T3 | `src/game/world/actionPointRules.ts` | 新增 `getEffectiveMaxActionPoints`；`restoreActionPoints` 用有效上限 |
| T4 | `src/game/world/divineGiftRules.ts` | 新增 `getEffectiveDivineThreshold`；`shouldTriggerGiftChoice` 用有效门槛 |
| T5 | `src/game/world/types.ts` | 新增 5 个状态字段 + `initialEdenWorldState` 默认值 |
| T6 | `src/content/world/items.ts` | 新增 7 个道具定义 |
| T7 | `src/content/world/locations.ts` | 四河分流 shortDesc/description/enterNarration/observeTextNight 去除路西法行为；改为环境描写 |
| T8 | `src/content/world/npcs.ts`（或 types.ts 旁） | 新增 `getTreeDisplayName` helper |
| T9 | `src/app/world/page.tsx` | 新增"幽径尽头"交互框 + `eastPathCompleted`；伊甸之河交互框改单行"倾听水流"；`handleScenePuzzleClick` 按 puzzleId 区分完成提示；AP UI 用 `getEffectiveMaxActionPoints`；注视值 `nextThreshold` 用 `getEffectiveDivineThreshold`；地图热点旁渲染 NPC 头像（unlockMapNpcLocations）；central_meadow 新增"园心双树"交互框；双树属性页用 `getTreeDisplayName`（路西法立绘改动在 T8/assets.ts，page.tsx 无需改） |
| T10 | `src/components/world/ScenePuzzleModal.tsx` | 结果区渲染 `resultTitle` + `feedback`；per_option 模式无成功/失败色 |
| T11 | `src/components/world/DivineAttentionViz.tsx` | 核查 `nextThreshold` 透传（由 page.tsx 传入有效门槛，组件无需改；若组件内自行取数组则改） |
| T12 | `src/hooks/useWorldSave.ts` | `normalizeWorldStateForClient` 补 5 个新字段兜底 |
| T13 | `src/app/api/world/route.ts` | `cloneWorldState` 补 5 个新字段兜底 |
| T14 | `src/agents/world/buildAngelPrompt.ts` | 路西法人设"看水"措辞调整（可选） |
| T15 | `src/app/globals.css` | `.eden-east-path-entry` 样式；`.eden-map-hotspot-avatar(s)` 样式；园心双树交互框样式（若新增） |
| T16 | `scripts/test-world-visual-smoke.mjs` | :114 改为 `npc_uriel_sprite.png` 存在（若删除灰底 lucifer 文件）；:109/:123/:137 常量名与字符串唯一性断言无需改 |
| T17 | `scripts/test-world-smoke.mjs` / `scripts/test-scene-puzzle-rules.mjs` | 若涉及东园/伊甸旧选项断言，按新 per_option 行为更新 |

---

## 11. 验收清单（人工测试重点）

### 东园幽径
- [ ] 进入场景不自动弹出问题。
- [ ] 可见"幽径尽头"交互框，无副标题。
- [ ] 点击后才打开问题。
- [ ] 文案不直接说明是梦境。
- [ ] 4 选项分别给 众生回声 / 清醒之眼 / 双树残识 / 行动点归零。
- [ ] 选"众生回声"后地图正确显示所有 NPC 所在场景。
- [ ] NPC 移动后地图头像同步。
- [ ] 选"清醒之眼"后白天行动点上限 +1。
- [ ] 夜晚上限不受清醒之眼影响。
- [ ] 选"双树残识"后可查看两棵树真实名称（左生命树、右分别善恶树）。
- [ ] 选第 4 项后当前行动点立即归零。
- [ ] 第 4 项不降低行动点上限。
- [ ] 完成后无法重复领取奖励（切换场景/下一轮/刷新读档均保留完成态）。

### 四河分流
- [ ] 路西法不再使用带矩形背景的立绘。
- [ ] 路西法使用乌列尔透明立绘（不与米迦勒撞图）。
- [ ] 新立绘背景透明。
- [ ] 场景介绍不再出现"路西法看水"。
- [ ] 切换场景或刷新后错误文案不再出现。

### 伊甸之河
- [ ] 进入场景不自动弹出问题。
- [ ] 交互对象只显示"倾听水流"。
- [ ] 不显示副标题。
- [ ] 4 选项均获得"水声回响"不同属性版本。
- [ ] 道具界面能区分 4 个版本。
- [ ] "复苏"正确回复至当前上限。
- [ ] "丰沛"同时提高白天和夜晚行动点上限。
- [ ] "丰沛"与"清醒之眼"能叠加（白天 7、夜晚 6）。
- [ ] "引目"正确增加 1 点神明注视值。
- [ ] 达门槛后只触发一次神明献礼。
- [ ] "藏目"正确降低当前及后续献礼门槛。
- [ ] 门槛最低不低于 1。
- [ ] 降低门槛后若已达标会立即触发献礼。
- [ ] 场景问题完成后不能重复领取任何效果。

---

## 12. 回归风险

- **per_option 模式与既有 success_failure 模式共存**：刻名石（free_text）与未来其他问题仍用旧模式。`applyScenePuzzleAnswer` 需按 `resolutionMode` 正确分支，默认值 `success_failure` 保证向后兼容。
- **AP 有效上限改动波及面**：所有读取 `maxActionPoints` 作"上限"的位点（dots、状态栏、耗尽提示、河源露回 AP）须统一改 `getEffectiveMaxActionPoints`。漏改会导致显示与实际不符。`maxActionPoints` 字段本身保持基础值 5 不变，`cloneWorldState` 的 `?? 5` 兜底不受影响。
- **门槛修正与旧存档**：旧存档 `divineThresholdModifier` 为 undefined → normalize 补 0，行为不变。若旧存档 `divineAttentionCumulative` 已超当前门槛，加载后 `shouldTriggerGiftChoice` 可能为真 → 弹三选一（17 号文档已接受此行为）。
- **藏目防重复触发**：`wasPending` 基准必须在应用 `divineThresholdModifier` 之前取，确保只触发一次。
- **引目不走 applyDivineAttention**：避免可视等级（0-4）被道具直加、避免 `gift_attention_accel` 乘数。引目只加 `divineAttentionCumulative`。
- **路西法立绘复用乌列尔**：`assets.ts:63` `luciferSprite` 路径改为 `npc_uriel_sprite.png`（常量名不变，page.tsx 无需改）；测试 :109/:123/:137 仍过，仅 :114 需视是否删除灰底 lucifer 文件而调整。乌列尔立绘已从 git `d72a967^` 恢复并核查透明（RGBA，40.4% 透明像素）。若产品认为乌列尔风格不合适，可改用拉斐尔（同透明，`git show d72a967^:public/assets/chapter1/images/npc_raphael_sprite.png` 恢复）。
- **旧奖励 `resonance_silent_grass` / `clue_four_river_echo` / `resonance_four_river_echo`**：grep 确认无成就/结局硬依赖；若有，决定保留授予或迁移。
- **地图头像用全身立绘裁圆**：立绘是全身大图，裁为 28px 圆形头像可能只显示局部（通常上半身）。可接受作"卡通头像"替代；若效果不佳，CodeBuddy 可调整 `object-position` 聚焦面部。
- **园心双树交互框**：central_meadow 已有较多元素（双树 CSS、NPC），新交互框坐标需避开重叠；`pointer-events` 不影响树下禁忌动作链工具。
- **per_option 结果弹窗的 resultTitle**：`ScenePuzzleModal` 现有结果区结构需核查，确保标题/正文渲染不破坏既有 success_failure 模式的反馈展示。

---

## 13. 给 CodeBuddy 的执行提示词

见同目录 `18_CODEBUDDY_PROMPT_PLAYTEST_ROUND2_THREE_SCENES.md`。
