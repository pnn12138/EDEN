# CodeBuddy 执行提示词 · 第一章人工测试第二轮三场景问题修复

把以下整段作为任务提示词投递给 CodeBuddy。CodeBuddy 应先读 `doc/第一章/plan_docs/18_CODEBUDDY_TASK_CHAPTER1_PLAYTEST_ROUND2_THREE_SCENES.md` 获取完整定位与方案（含 file:line 与代码片段），再按下文执行。

---

## 角色

你是 EDEN 第一章（Next.js + TypeScript + Tailwind/CSS 文字立绘交互游戏）的资深前端/全栈工程师。本次任务修复人工测试第二轮反馈的三个场景问题：东园幽径、四河分流、伊甸之河。所有场景问题须按**一次性事件**处理--完成后不可通过切换场景、进入下一轮、刷新或读档重复领取奖励。改动须最小侵入、不破坏既有玩法（禁忌动作链、回响、天使挑战、言语分裂、七献礼、存档）。先读规划文档 `doc/第一章/plan_docs/18_CODEBUDDY_TASK_CHAPTER1_PLAYTEST_ROUND2_THREE_SCENES.md`，再按下方任务逐项实现。每完成一块跑 `npm run lint` 与相关 smoke 脚本，最后做整体验收。

## 必读上下文文件

- `src/content/world/scenePuzzles.ts`（场景问题数据/选项/奖励）
- `src/game/world/puzzleRules.ts`（场景问题结算，`applyScenePuzzleAnswer`）
- `src/game/world/actionPointRules.ts`（行动点规则）
- `src/game/world/divineGiftRules.ts`（献礼门槛，`shouldTriggerGiftChoice`/`claimDivineGift`/`DIVINE_GIFT_THRESHOLDS`）
- `src/game/world/divineAttentionRules.ts`（注视值，`applyDivineAttention`）
- `src/game/world/types.ts`（状态类型与初始值，`initialEdenWorldState`）
- `src/content/world/items.ts`（道具定义）
- `src/content/world/locations.ts`（场景介绍文案）
- `src/content/world/npcs.ts`（NPC 定义，含双树）
- `src/app/world/page.tsx`（主页面：交互框、地图、AP/注视值 UI、立绘映射 `NPC_SPRITE`）
- `src/app/api/world/route.ts`（`cloneWorldState`）
- `src/app/api/world/puzzle/route.ts`（问题后端，透传）
- `src/components/world/ScenePuzzleModal.tsx`（问题/结果弹窗）
- `src/components/world/DivineAttentionViz.tsx`（注视值 UI）
- `src/hooks/useWorldSave.ts`（存档 normalize）
- `src/app/globals.css`（样式）
- `src/agents/world/buildAngelPrompt.ts`（路西法人设 prompt）
- `scripts/test-world-visual-smoke.mjs`、`scripts/test-world-smoke.mjs`、`scripts/test-scene-puzzle-rules.mjs`（测试）

## 任务清单

### 任务 0 · 数据结构与状态字段扩展（先做，后续任务依赖）

1. `src/game/world/types.ts`：
   - 在 `EdenWorldState`（`maxActionPoints` 附近，约 `:334`）新增 5 字段：
     `apMaxBonusBase: number`、`apMaxBonusDay: number`、`divineThresholdModifier: number`、`unlockMapNpcLocations: boolean`、`unlockTreeNames: boolean`。
   - 在 `initialEdenWorldState`（约 `:484` 附近）补默认值：`apMaxBonusBase: 0`、`apMaxBonusDay: 0`、`divineThresholdModifier: 0`、`unlockMapNpcLocations: false`、`unlockTreeNames: false`。
2. `src/content/world/scenePuzzles.ts`：
   - 新增 `ScenePuzzleOptionEffect` 类型（字段见规划文档 §8.1：`feedback`、`resultTitle?`、`itemId?`、`zeroActionPoints?`、`restoreActionPointsToMax?`、`apMaxBonusBase?`、`apMaxBonusDay?`、`divineAttentionDelta?`、`divineThresholdModifier?`、`unlockMapNpcLocations?`、`unlockTreeNames?`）。
   - `ScenePuzzleOption` 增加可选 `effect?: ScenePuzzleOptionEffect`。
   - `ScenePuzzle` 增加可选 `resolutionMode?: "success_failure" | "per_option"`（默认 `"success_failure"`）。
3. 存档兼容（关键，旧存档读取链路不调用 `withNpcWorldDefaults`）：
   - `src/game/world/puzzleRules.ts` 的 `normalizePuzzleState`（约 `:41-47`）与 `cloneWorldStateForPuzzle`（约 `:49-78`）补 5 字段兜底（`?? 0` / `?? false`）。
   - `src/hooks/useWorldSave.ts` 的 `normalizeWorldStateForClient`（约 `:14-28`）补同样兜底。
   - `src/app/api/world/route.ts` 的 `cloneWorldState`（约 `:262-303`）补同样兜底。

### 任务 1 · 行动点上限拆分

1. `src/game/world/actionPointRules.ts` 新增导出：
   ```ts
   export function getEffectiveMaxActionPoints(state: EdenWorldState): number {
     const base = state.maxActionPoints ?? 5;
     const bonusAll = state.apMaxBonusBase ?? 0;
     const bonusDay = state.timeOfDay === "day" ? (state.apMaxBonusDay ?? 0) : 0;
     return base + bonusAll + bonusDay;
   }
   ```
2. `restoreActionPoints`（约 `:91-94`）改为 `state.actionPoints = getEffectiveMaxActionPoints(state);`（npc 行动预算不变）。
3. `src/app/world/page.tsx` 所有作"上限"用途的 `state.maxActionPoints` 读取改用 `getEffectiveMaxActionPoints(state)`：AP dots（约 `:1763-1770`）、状态栏（约 `:2613`）、AP 耗尽提示（约 `:2218`，文案改动态数值）。
4. `src/game/world/resonanceRules.ts` 的 `resonance_river_dew` 回 AP（约 `:296`）改用 `Math.min(getEffectiveMaxActionPoints(state), ...)`。
- 验收：基础 5；丰沛(+1 全时段) + 清醒之眼(+1 白天) -> 白天 7、夜晚 6。获得加成道具时不回复当前 AP。

### 任务 2 · 献礼门槛修正 + 下限保护

1. `src/game/world/divineGiftRules.ts` 新增导出：
   ```ts
   export function getEffectiveDivineThreshold(state: EdenWorldState): number | null {
     const owned = state.divineGiftsOwned.length;
     if (owned === 0 || owned >= 7) return null;
     const base = DIVINE_GIFT_THRESHOLDS[owned - 1];
     return Math.max(1, base + (state.divineThresholdModifier ?? 0));
   }
   ```
2. `shouldTriggerGiftChoice`（约 `:120-126`）改用 `getEffectiveDivineThreshold`（null 时返回 false）。
3. `src/app/world/page.tsx` 注视值 `nextThreshold`（约 `:1755`）改用 `getEffectiveDivineThreshold(state)`。`DivineAttentionViz` 组件接收透传值即可（核查组件内不再自行取数组）。
- 验收：藏目使当前及后续门槛 -1，最低 1；降低后若已达标立即触发一次献礼，不重复触发。

### 任务 3 · per_option 结算模式

1. `src/game/world/puzzleRules.ts`：
   - `ScenePuzzleAnswerResult`（约 `:26-35`）新增 `resultTitle?: string`。
   - 新增 `applyPerOptionAnswer(state, puzzle, optionId)`，按规划文档 §8.1.1 实现：找选项 -> 已完成则拒 -> 应用 `option.effect`（道具、AP 上限加成、AP 即时变化、注视值、门槛修正、解锁开关）-> `wasPending = shouldTriggerGiftChoice(next)`（**在应用 effect 前取**）-> 若 `!wasPending && shouldTriggerGiftChoice(next)` 则 `divineGiftChoice = rollGiftChoices(...)` -> 写入 `completedScenePuzzleIds` -> 返回 `{ success: true, resultTitle, feedback, rewards, divineGiftChoice, ... }`。
   - `applyScenePuzzleAnswer`（约 `:109-230`）在 `inputMode === "choice"` 分支开头：若 `puzzle.resolutionMode === "per_option"` 则 `return applyPerOptionAnswer(...)`。
   - `applyPerOptionAnswer` 内：`divineAttentionDelta` 直接 `next.divineAttentionCumulative += delta`（**不**调 `applyDivineAttention`）；`restoreActionPointsToMax` 用 `getEffectiveMaxActionPoints(next)`；`zeroActionPoints` 设 `next.actionPoints = 0`；上限加成只累加字段、不动 `actionPoints`。
2. `src/components/world/ScenePuzzleModal.tsx`：结果区渲染 `result.resultTitle`（标题）+ `result.feedback`（正文）；`per_option` 模式选项无成功/失败色区分。

### 任务 4 · 东园幽径重写

1. `src/content/world/scenePuzzles.ts` 重写 `puzzle_east_path_cautious_presence`：
   - `trigger: "on_enter"` -> `"explicit_interaction"`；`resolutionMode: "per_option"`。
   - `title: "幽径尽头的问题"`；`prompt` 用规划文档 §1.3.3 正文（戛然而止、不自然、不直接说梦境）。
   - 4 选项 `echo_of_beings` / `sober_eye` / `twin_tree_memory` / `futile_struggle`，各带 `effect`（ itemId + 对应开关；`futile_struggle` 无 itemId、`zeroActionPoints: true`、`resultTitle: "徒劳的挣扎"`）。feedback 文案见 §1.3.3。
   - 删除旧 `successTags`/`rewards`/`failure`（per_option 不用）。
2. `src/app/world/page.tsx` 新增"幽径尽头"交互框（`locationId === "east_garden_path"`，参考刻名石 `:1873-1889`）：只 `<span>幽径尽头</span>` 无 `<small>`；`eastPathCompleted = state.completedScenePuzzleIds.includes("puzzle_east_path_cautious_presence")`；完成加 `--completed` 类；点击走 `handleScenePuzzleClick("puzzle_east_path_cautious_presence")`。
3. `handleScenePuzzleClick`（约 `:1375-1386`）已完成提示按 puzzleId 区分：东园返回 `"前方仍旧空无一物。"`、伊甸之河返回 `"水声依旧，却不再回应你的选择。"`、刻名石保持原文案。
4. `src/app/globals.css` 新增 `.eden-east-path-entry` 系列样式（规划文档 §1.3.2，暗绿调，坐标 `left:78%; top:42%` 可微调，不遮挡加百列/刺猬）。
- 验收：进入不自动弹；点击"幽径尽头"才开问题；4 选项各给对应奖励；第 4 项 AP 归零上限不变；完成后不可重复。

### 任务 5 · 伊甸之河重写 + 交互框单行

1. `src/content/world/scenePuzzles.ts` 重写 `puzzle_river_words_belonging`：
   - `resolutionMode: "per_option"`；`title: "伊甸之河的问题"`；`prompt` 用规划文档 §3.2 正文（似梦非梦，不直接判定梦境）。
   - 4 选项 `revive` / `abundant` / `attract` / `conceal`，各 `effect`：`restoreActionPointsToMax` / `apMaxBonusBase: 1` / `divineAttentionDelta: 1` / `divineThresholdModifier: -1`；各 `itemId` 对应 `resonance_water_echo_revive`/`_abundant`/`_attract`/`_conceal`。feedback 见 §3.2。
   - 删除旧 `successTags`/`rewards`/`failure`。
2. `src/app/world/page.tsx:1905-1906` 改为只 `<span>倾听水流</span>`，删除 `<small>`；`aria-label`/`title` 同步。
3. `src/content/world/items.ts` 新增 7 个道具（规划文档 §8.2：众生回声、清醒之眼、双树残识、水声回响·复苏/丰沛/引目/藏目），注意 `kind`（永久加成用 `passive`，即时用 `instant`），`shortEffect` 明确写效果。
- 验收：交互框只显"倾听水流"无副标题；4 选项各得水声回响不同版本；复苏回当前上限、丰沛+1 全时段、引目+1 注视值、藏目-1 门槛；完成后不可重复。

### 任务 6 · 众生回声 · 地图 NPC 头像

1. `src/app/world/page.tsx` 地图热点渲染循环（约 `:2906-2937`）：当 `state.unlockMapNpcLocations` 为真，在热点 button 内或旁渲染该地点可见 NPC 头像组--`getVisibleNpcsAtLocation(state, locId).filter(id => NPC_SPRITE[id])`，复用 `NPC_SPRITE` 全身立绘做 28px 圆形头像（`object-fit: cover; border-radius: 50%`），并排显示，`pointer-events: none`。
2. `src/app/globals.css` 新增 `.eden-map-hotspot-avatars` 与 `.eden-map-hotspot-avatar` 样式（规划文档 §6.2.3）。
- 验收：解锁后地图节点旁显示 NPC 头像；多 NPC 并排；NPC 移动同步；夜晚不出现的不显示；双树不显示。

### 任务 7 · 双树残识 · 双树名称

1. 新增 `getTreeDisplayName(npcId, state)` helper（`src/content/world/npcs.ts` 或 `types.ts` 旁）：`state.unlockTreeNames` 为真返回 `"生命树"`/`"分别善恶树"`，否则 `"园中央左侧的树"`/`"园中央右侧的树"`（左=生命树、右=分别善恶树，与 `pickedFruitSide` 注释一致）。
2. `src/app/world/page.tsx` 在 `central_meadow` 新增"园心双树"交互框（参考刻名石模式，不绑定 ScenePuzzle，可反复点击）：点击展示信息--解锁前 `"两棵树的轮廓始终看不真切，你分不清它们有何不同。"`，解锁后 `"园子中央并立着两棵树--左侧是生命树，右侧是分别善恶树。"`（用 `systemHint` 或轻量弹窗）。
3. `forbidden_tree`/`tree_of_life` 属性页（`page.tsx:234-288`）标题改用 `getTreeDisplayName(id, state)`。
4. `src/app/globals.css` 视需要新增"园心双树"交互框样式（坐标避开双树 CSS 与 NPC）。
- 验收：解锁后可查看双树真实名称，区分左右；解锁前不显示真名；状态持续至本局结束。

### 任务 8 · 四河分流立绘 + 文案

1. `src/game/assets.ts:63` `luciferSprite` 路径改为 `"/assets/chapter1/images/npc_uriel_sprite.png"`（**只改路径值，不改常量名**；复用乌列尔透明立绘--乌列尔是路西法前身，语义契合，且不与米迦勒撞图）。`npc_uriel_sprite.png` 已恢复至 `public/assets/chapter1/images/`。`page.tsx` 无需改。
2. 灰底问题文件 `public/assets/chapter1/images/npc_lucifer_sprite.png`（colorType=2 实色背景）推荐删除；删除后 `scripts/test-world-visual-smoke.mjs:114` 改为 `npc_uriel_sprite.png` 存在。`:109`/`:123`/`:137` 断言无需改（常量名与字符串唯一性均仍成立）。
3. `src/content/world/locations.ts` 四河分流（`naming_stone_bank`，约 `:145-163`）：
   - `shortDesc`（`:148`）改为 `"主河离开园子后分成多道水流，沿着不同方向流向远方。"`（删"路西法看水"）。
   - `description`（`:149`）删"路西法坐于石上望着每一道分流的去向"，改为纯环境。
   - `enterNarration`/`enterNarrationNight`/`observeTextNight`（`:150-157`）删"路西法坐在…望着…"等 NPC 动作，保留水流/石子/飞鸟环境描写。
4. `src/agents/world/buildAngelPrompt.ts:114` 人设"你被神安置在四河分流处看水"调整为"你被神安置在四河分流处，是园中明亮之星，看遍所有水流的走向"（对齐 `npcs.ts:112` shortDesc）。
5. 全仓 grep `"路西法看水"` 与 `"看水"` 确认仅剩上述两处并已修复（`design/` 文档与"看看水"子串误命中无需改）。
- 验收：路西法用乌列尔透明立绘、无灰底、不与米迦勒撞图；场景介绍无"路西法看水"；视觉冒烟测试通过。

## 约束与回归

- **一次性事件**：依赖既有 `completedScenePuzzleIds` 机制（规则层 + UI 层双拦截 + 存档持久化），不要新造完成标记。`per_option` 模式所有选项都写 `completedScenePuzzleIds`，无成功/失败之分。
- **防献礼重复触发**：`applyPerOptionAnswer` 中 `wasPending` 必须在应用 `divineThresholdModifier`/`divineAttentionDelta` **之前**取；仅 `!wasPending && shouldTriggerGiftChoice(next)` 时返回 `divineGiftChoice`。
- **引目不调 `applyDivineAttention`**：只 `divineAttentionCumulative += delta`，避免可视等级（0-4）被道具直加与 `gift_attention_accel` 乘数。
- **AP 上限加成不回复当前 AP**：`apMaxBonusBase`/`apMaxBonusDay` 只累加字段；只有 `restoreActionPointsToMax`（复苏）才设 `actionPoints`。
- **不动 `maxActionPoints` 基础值**（保持 5）；有效上限统一走 `getEffectiveMaxActionPoints`。
- **门槛最低 1**：`getEffectiveDivineThreshold` 用 `Math.max(1, ...)`。
- **存档兼容**：5 个新字段必须在 `normalizePuzzleState`、`normalizeWorldStateForClient`、`cloneWorldState`、`cloneWorldStateForPuzzle` 四处补兜底，否则旧存档读取为 undefined。
- **不删旧道具**（`resonance_silent_grass`/`resonance_four_river_echo`/`clue_four_river_echo`）：grep 确认无硬依赖后标注废弃但保留数据；若 `clue_four_river_echo` 被成就/结局引用，考虑在伊甸之河新选项中保留授予该线索。
- **不改 `withNpcWorldDefaults`**（存档读取链路不调用它，改了无效）；改 `normalizePuzzleState` 与 `normalizeWorldStateForClient`。
- **路西法立绘不重新生成**：复用 `npc_michael_sprite.png`。
- **保持中文 UI 文案与既有伊甸园语感一致**；不引入现代词。文案不直接说"这是梦境"。

## 交付

- 改动文件清单 + 每项对应验收点。
- `npm run lint` 通过；运行 `node scripts/test-scene-puzzle-rules.mjs`、`node scripts/test-world-smoke.mjs`、`node scripts/test-world-visual-smoke.mjs` 通过（若脚本涉及被改逻辑--东园/伊甸旧选项断言、路西法立绘断言--按需更新断言并在交付说明里列出）。
- 简述存档兼容处理方式（5 字段四处兜底）。
- 自测三场景验收清单（见规划文档 §11）。
