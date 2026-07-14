# 20 · 第一章人工测试第四轮：好感度突破 / 神赐关系被动 / Token 统计 / 新场景问题 / 隐藏结局 等

> 面向：CodeBuddy / 开发执行
> 范围：第一章 `/world` 人工测试第四轮反馈的 9 大系统优化
> 基线分支：`feat/chapter1-round3-save-refresh`（承接 19 号文档第三轮存档/刷新之后）
> 文档性质：代码影响分析 + 根因定位 + 修复规划 + 回归测试清单
> 优先级：P0 好感度突破100 / P0 Token 统计修复 / P0 结局滚动 · P1 神赐关系被动 / P1 免费行动叠加 / P1 场景问题 / P1 隐藏结局 · P2 Agent 注入

---

## 0. 概述

本文档基于对当前仓库（`feat/chapter1-round3-save-refresh`）的逐行核查，确认 9 项需求对应的代码现状、根因与修复方案。**核心原则**：规则层权威（Agent 只读数值不改数值）、好感度可突破 100 但不失控、免费行动改为可叠加次数池、Token 统计对话与润色分离、新场景问题点击触发且每局一次、隐藏结局由规则层判定。

本轮涉及 9 项需求：

| 优先级 | 需求 | 当前状态 |
|---|---|---|
| P0 | 好感度取消 100 上限 + 满好感奖励只触发一次 | ❌ `clampAffinity` 强制 0-100，集齐 7 祝福覆盖为 100 |
| P0 | 冒险模式 Token 统计始终为 0 | ❌ 蛇 Tab 绑定润色变量；对话 usage 客户端丢弃 |
| P0 | 结局页面无法滚动 / 看不到顶部 | ❌ `.eden-ending-content` 缺 `min-height:0`，14 模块过长 |
| P1 | 神赐祝福关系被动（每项 +15/+15/+10/+10/-10） | ⚠️ 现为 +10/+10/-5/+5/-5 且 clamp100，无结算去重 |
| P1 | 无羁之步改为每时段第一次免费 + 免费次数叠加 | ❌ `gift_free_move` = 所有移动免费（布尔），无法叠加 |
| P1 | 园中树林场景问题（4 回响） | ❌ tree_court 无场景问题 |
| P1 | 四河分流场景问题 + 时间回溯 | ❌ naming_stone_bank 无场景问题，无回溯 |
| P1 | 旋转的火焰剑 + 逃离伊甸园隐藏结局 | ❌ 无该道具 / 结局 |
| P2 | Agent 注入好感与对神明敬畏 | ⚠️ 天使 prompt 完全未注入 affinity/obedience |

---

## 1. 代码影响分析（开发前必读）

### 1.1 好感度系统现状

| 关注点 | 文件:行 | 现状 |
|---|---|---|
| 好感 clamp 0-100 | `src/game/world/npcRelationRules.ts:23-25` | `clampAffinity` = `Math.max(0, Math.min(100, v))` |
| 好感计算应用 | `src/game/world/npcRelationRules.ts:122` | `applyNpcAffinity` 内 `newAffinity = clampAffinity(...)` |
| 满 100 触发奖励 | `src/game/world/npcRelationRules.ts:123` | `reached100 = newAffinity >= 100 && !rewardEligible && !rewardClaimed`（已是"首次"语义，但被 clamp 遮蔽） |
| 神赐关系结算 | `src/game/world/divineGiftRules.ts:160-170` | `clamp100` 限制；+10 gabriel/michael、-5 lucifer、+5 eve、-5 adam suspicion |
| 集满 7 顶点 | `src/game/world/divineGiftRules.ts:189-205` | `applyGiftCapstone` 强制全 NPC affinity=100（覆盖超 100 的值） |
| 关系类型注释 | `src/game/world/types.ts:717-728` | `NpcRelationState.affinity` 注释「0-100」 |
| 属性页显示 | `src/app/world/page.tsx`（buildAttributeProfile 195-302） | 固定「当前值 / 100」显示 |

**根因**：上限来自三处 clamp（`clampAffinity`、`clamp100`、`applyGiftCapstone` 覆盖）+ 属性页写死 `/100`。`reached100` 的"首次"语义其实已正确，只是被 clamp 阻止超过 100。

### 1.2 Agent 提示词注入现状（关键缺口）

第一章实际使用的 prompt builder 不是 `src/agents/world/buildAngelPrompt.ts`（**死代码**，无调用者），而是：

| Agent | 实际 builder | 注入的心智 | **缺失** |
|---|---|---|---|
| 夏娃 | `src/agents/world/worldAgentPrompts.ts:buildEveWorldPrompt`（28-118） | `eveMind{obedience,serpentTrust,selfJudgement}` + divineAttention + worldActions + 献礼道具 | `npcRelations.eve.affinity/obedience` |
| 亚当 | `worldAgentPrompts.ts:buildAdamWorldPrompt`（162-236） | `adamMind{suspicion,attachment,conflictAvoidance}`（**obedience 有字段未注入**）+ divineAttention | `npcRelations.adam.affinity/obedience` |
| 天使 | `src/app/api/world/route.ts:1273-1319` `buildWorldNpcPrompt`（内联） | divineAttention + `EDEN_NPCS.promptSummary` + location + 语言指令 + 引导指令 | **`npcRelations[angelId].affinity/obedience` 完全缺失**（天使无独立 mind，这是唯一心智源） |
| 刺猬 | `src/agents/hedgehog/buildHedgehogPrompt.ts` | 无任何 state | `npcRelations.hedgehog.affinity/obedience` |

- 好感阶段划分已有：`src/content/world/npcRelations.ts:164-169` `affinityStageHint`（<30/<60/<100/≥100），**但未注入任何 prompt**。
- `lastAffinitySignature`（`npcRelationRules.ts:68-71`）是防刷归一化 key（`${inputTag}:${strong|normal}`），**不是语义化"变化原因"**。当前无"最近关系变化原因"字段。
- Agent 分发入口：`route.ts:callWorldAgent`（1192-1226）按 targetNpc 分流，传入完整 `state`，但各 builder 未取 `npcRelations`。

### 1.3 免费移动 / 免费行动现状

**三套互不相干的免费机制**，在 `tool/route.ts:441-446` 用 `||` 合并：

```ts
const consumableMoveEffect = applyPendingConsumableToMove(state);   // 441
const passiveMoveEffect = applyPassiveLightStepToMove(state);       // 442
const moveCost =
  (consumableMoveEffect.freeApCost || passiveMoveEffect.freeApCost || state.inventory.includes("gift_free_move"))
    ? 0 : apCost;                                                    // 443-446
```

| 机制 | 检查点 | 当前效果 | 记录方式 |
|---|---|---|---|
| `gift_free_move` | `tool/route.ts:444` `inventory.includes` | **所有移动免费**（永久布尔） | 无（看 inventory） |
| `passive_light_step` | `resonanceRules.ts:474-477` | 每时段第一次移动免费 | `actionsThisSlot.usedItemIds.includes(...)`（布尔占用） |
| `resonance_boundary_mark` / `resonance_hedgehog_bristle`（consumable） | `resonanceRules.ts:412-425` `applyPendingConsumableToMove` | 下一次移动免费（一次性） | `pendingConsumableEffects` 列表 |
| `moonlight_path_marker` | `tool/route.ts:407-431` | **不解 AP**，只解除非相邻限制 | `itemCounts` 计数 |

**低语（whisper）AP 链路**（`src/app/api/world/route.ts`）：
- 预检 `whisperFreeFromConsumable = hasPendingFreeApForAction(state,"whisper")`（`route.ts:337-341`）。
- **当前无任何 whisper 免费 consumable**（`buildConsumableEffect` 未对 any_npc 道具设 `freeApCost`），故 `whisperCost` 恒为 1。
- `passive_soft_whisper`（细语印记）只压低 1 点注视，不解 AP。

**根因**：
1. `gift_free_move` 是 `inventory.includes` 布尔，强度过高且无法降为"每时段一次"。
2. `actionsThisSlot.usedItemIds` 是字符串数组，用 `includes` 做布尔判定，**无法表达"剩余 N 次"**。
3. 三套机制分散，没有统一的"本时段免费次数池"。
4. `consumePendingForAction`（`resonanceRules.ts:156-179`）一次 action 消费**所有匹配** effect，不是消费一条，无法叠加。

### 1.4 Token 统计现状（双重错误）

| 问题 | 位置 | 说明 |
|---|---|---|
| 蛇 Tab「词元消耗统计」UI | `page.tsx:2780-2794` | 绑定 `polishTokensRound/Total/lastPolishTokens`（润色变量） |
| 底部「本次低语消耗」 | `page.tsx:3233-3237` | 条件 `polishTokensTurn > 0`，文案误导，实际只在润色后弹出 |
| 润色 token state | `page.tsx:647-656` | 4 个 polish state，无 whisper token state |
| 润色累加 | `page.tsx:1042-1061` `handlePolish` | 累加到 polish state + localStorage `eden:world:polish-tokens` |
| **对话 usage 服务端返回** | `route.ts:927,955,1268,1366,1416` | 三路径都带 `usage: result.data.usage` |
| **对话 usage 客户端丢弃** | `page.tsx:1104-1198` `applyWorldResponse` | 处理十几个字段，**唯独不读 `data.usage`** |
| 流式路径 usage | `route.ts:1164,1181` | `callStreamingWorldAgent` 声明 usage 但未赋值（恒 undefined） |
| `resolveTokenUsage` | `src/game/rules/tokenUsageRules.ts:60` | **仅第零章 `src/app/game/page.tsx:339` 用，第一章零引用** |
| EdenWorldState token 字段 | `types.ts` | **无任何 token 字段**，不写入存档 |
| 本轮清零 | `page.tsx:1322-1325` | 仅 `end_slot` 手动清零 `polishTokensRound`；AP 耗尽自动推进时段时不清零 |

**根因**：(a) 对话 token 根本没被记录；(b) UI 绑的是 polish 变量。未润色时恒为 0。

### 1.5 结局页面 UI 现状

| 问题 | 位置 | 说明 |
|---|---|---|
| 滚动 bug 根因 | `globals.css:2601-2609` `.eden-ending-content` | `flex:1; overflow-y:auto` 但**缺 `min-height:0`** → flex 子元素 min-height:auto 撑满内容 → 父 `.eden-game--ending`（`overflow:hidden`）裁剪 → 永远不触发滚动 |
| 无滚动到顶部 | `page.tsx` | 进入 ending 阶段无 `useEffect` 滚顶 |
| 复盘模块过多 | `EndingReview.tsx`（210 行） | 成功路径渲染 **14 个模块**，其中「回响使用记录」「神明献礼记录」未 `.slice()` 截断 |
| CSS 重复定义 | `globals.css:2593-2800` 与 `5658-5790` | 第二块覆盖第一块，多加 32px padding + 24px margin，更长 |
| 死 CSS | `globals.css:5658` `.eden-ending-main` | 无任何 TSX 使用 |
| 复盘数据源 | `src/game/world/traceRules.ts:56-176` `buildWorldEndingReview` | 非 `endingSummaryRules.ts`（那是 Chapter 0）；无"关键转折"选取逻辑 |
| 失败原因 | `traceRules.ts:189-218` `buildFailureReasons` | 4 条件聚合，可复用 |

### 1.6 场景问题 / 道具 / 结局现状

| 关注点 | 现状 |
|---|---|
| 场景问题定义 | `src/content/world/scenePuzzles.ts`，现有 4 个：刻名石、东园幽径 day/night、伊甸之河 |
| `tree_court`（园中树林） | `locations.ts:105-124`，dayNpcs/nightNpcs = `[eve, hedgehog]`，**无场景问题** |
| `naming_stone_bank`（四河分流） | `locations.ts:145-163`，dayNpcs/nightNpcs = `[lucifer]`，**无场景问题**（与 `four_river_source` 伊甸之河不同） |
| per_option 结算 | `puzzleRules.ts:138-241` `applyPerOptionAnswer`，已支持每选项独立发奖 |
| 选项效果字段 | `scenePuzzles.ts:25-52` `ScenePuzzleOptionEffect`，已有 `divineAttentionDelta/zeroActionPoints/restoreActionPointsToMax/apMaxBonus*` 等 |
| 东园幽径第4选项 | `scenePuzzles.ts:171-181`（day）/ `231-241`（night）`futile_struggle`，`zeroActionPoints:true`，需改为"挣脱"选项 |
| 结局 ID 类型 | `types.ts:44-47` `WorldEndingId = "eve_eats_fruit" \| "god_arrives" \| null`（**`life_fruit` 在图鉴/globalTracker 存在但未进类型**，已不一致） |
| 结局触发 | `route.ts:613-638`（eve_eats_fruit）、`673-675`（god_arrives）；`end_slot` 第12时段在 `actionPointRules.ts:117-122` |
| 结局图鉴 | `EndingsGallery.tsx:20-39` `ENDINGS` 数组（3 条），需加 `escape_eden` |
| 跨局结局追踪 | `globalTracker.ts:51` `NORMAL_ENDING_IDS`（3 个），隐藏结局是否计入需决定 |
| 隐藏印记 | `achievementRules.ts:265-268` `mark_hidden_ending` 由 `sceneActionIds.includes("trigger_lucifer_hidden_ending")` 解锁；`AchievementId` 类型 `types.ts:317` |
| 加百列赠礼 | `npcRelationRules.ts:170-219` `validateRelationGrant`，天使需 challenge passed + rewardItemId 匹配；`npcChallenges` 配置在 `src/content/world/npcChallenges.ts` |

### 1.7 存档兼容关键陷阱（见项目记忆 `eden-save-normalize-gotcha`）

新增 `EdenWorldState` 标量字段必须在 **4 处**显式补 `?? 默认`：
1. `normalizePuzzleState`（`puzzleRules.ts:44-55`）
2. `normalizeWorldStateForClient`（`useWorldSave.ts:14-33`）
3. `cloneWorldStateForPuzzle`（`puzzleRules.ts:58-93`）
4. `cloneWorldState`（`route.ts`）

同时在 `initialEdenWorldState`（`types.ts:486-570`）设默认值。**`withNpcWorldDefaults`（`types.ts:599-700`）不被读档链路调用**，不能只在那里补。读取该字段的计算函数内部也应 `?? 默认` 双保险。

---

## 2. P0 · 好感度取消 100 上限

### 2.1 规则层改动

#### 2.1.1 `npcRelationRules.ts`

- `clampAffinity`（23-25）改为只保下限：`Math.max(0, v)`（去掉 `Math.min(100, ...)`）。
- `applyNpcAffinity`（122）：`newAffinity = clampAffinity(relation.affinity + delta)` 即可（已用 clamp，改 clamp 即可）。
- `reached100`（123）：当前 `newAffinity >= 100 && !rewardEligible && !rewardClaimed` **语义已正确**（首次跨越 100 触发一次），无需改。但需确保 `rewardEligible` 置 true 后不再重复触发（已有 `!rewardEligible` 守卫 ✓）。
- **新增**：记录"最近关系变化原因"。在 `NpcRelationState` 新增 `lastAffinityChangeReason: string | null`，在 `applyNpcAffinity` 写入语义化原因（如 `"build_trust 强命中 +10"` / `"威胁言论 -10"`），供 Agent 注入。

#### 2.1.2 `divineGiftRules.ts`

- 删除 `clamp100`（160），改用 `Math.max(0, ...)` 保下限。
- **关系被动数值改为需求值**（3.1 节）：每项神赐祝福首次获得时结算 `michael +15 / gabriel +15 / adam +10 / eve +10 / lucifer -10`，**按拥有数量叠加**。
- **结算时机**：关系被动随 `claimDivineGift` 调用结算（替换原 160-170 的 +10/-5 块）。`claimDivineGift` 仅在首次领取某祝福时被调用，故每项祝福只结算一次，**无需额外去重字段**。
- `applyGiftCapstone`（189-205）改为：**仅当 affinity < 100 时提高到 100；已 >100 保留原值**。即 `r.affinity = Math.max(r.affinity, 100)` 而非 `r.affinity = 100`。同理 `eveMind.serpentTrust = Math.max(..., 100)`、`adamMind.suspicionTowardSerpent = Math.min(..., 0)`（即 adam 好感 `100 - suspicion` 已 ≥100 时保留）。

#### 2.1.3 恩泽棱镜倍率（3.2 节）

- 新增 `state.divineAffinityMultiplier: number`（默认 1，持有恩泽棱镜后为 2）。
- 关系被动结算时，正向加成 × `divineAffinityMultiplier`（lucifer 负向不乘）。
- 获得恩泽棱镜时，**补算已持有祝福的差额**：遍历 `divineGiftsOwned`，对每项补发 `(倍率2的正向 - 已发的正向)`。

#### 2.1.4 属性页显示

- `page.tsx` `buildAttributeProfile`（195-302）及属性 Tab 渲染处：**保留「/100」作为满好感奖励门槛参考**，分母固定 100，分子为真实好感度（可 >100）。即显示为「50/100」「120/100」等形式。只需确保分子不被 clamp 到 100，分母保持 100 字面量不改。

#### 2.1.5 类型注释

- `types.ts:719` `NpcRelationState.affinity` 注释「0-100」改为「≥0，可突破 100（满 100 触发奖励阈值，非上限）」。

### 2.2 验收示例对照

| 需求示例 | 实现 |
|---|---|
| 95 +20 = 115 | 去掉 `min(100)` 后自然成立 |
| 130 集齐 7 祝福仍 130 | `applyGiftCapstone` 用 `Math.max(affinity, 100)` |
| 95→115 触发一次，115→130 不重复 | `reached100` 首次跨越 100 置 `rewardEligible`，之后 `!rewardEligible` 守卫阻止重复 |

---

## 3. P1 · 神赐祝福关系被动

### 3.1 每项祝福的固定关系变化

**结算表**（每获得一项新祝福，叠加结算一次）：

| NPC | 好感映射字段 | 变化 |
|---|---|---|
| 米迦勒 | `npcRelations.michael.affinity` | +15 |
| 加百列 | `npcRelations.gabriel.affinity` | +15 |
| 亚当 | `adamMind.suspicionTowardSerpent`（好感 = 100 - suspicion，故 suspicion -10） | +10 好感 |
| 夏娃 | `eveMind.serpentTrust` | +10 |
| 路西法 | `npcRelations.lucifer.affinity` | -10 |

**实现**：在 `claimDivineGift`（`divineGiftRules.ts:137`）内替换原有的 +10/-5 结算块（160-170），改为调用新函数 `settleDivineGiftRelation(state)`。`claimDivineGift` 仅在玩家首次领取某祝福时被调用（三选一只展示未拥有的祝福，`rollGiftChoices` 已过滤 `!owned.includes(g)`），故关系被动**天然只结算一次，无需额外去重字段**：

```ts
function settleDivineGiftRelation(state: EdenWorldState): void {
  const mult = state.divineAffinityMultiplier ?? 1; // 恩泽棱镜倍率
  const pos = (v: number) => v * mult;
  const rel = (id: EdenNpcId) => ensureRelation(state, id);
  rel("michael").affinity  = Math.max(0, rel("michael").affinity  + pos(15));
  rel("gabriel").affinity  = Math.max(0, rel("gabriel").affinity  + pos(15));
  state.eveMind.serpentTrust = Math.max(0, state.eveMind.serpentTrust + pos(10));
  state.adamMind.suspicionTowardSerpent = Math.max(0, state.adamMind.suspicionTowardSerpent - pos(10)); // 好感+10
  rel("lucifer").affinity  = Math.max(0, rel("lucifer").affinity  - 10); // 负向不乘
}
```

**无需去重**：关系被动按拥有祝福数量叠加（3 项 = 累计 ×3），`claimDivineGift` 每项祝福只调用一次，重复载入/刷新不会重新调用该函数（读档链路不触发 claim），故不会二次结算。

**结果弹窗显示关系变化**：`claimDivineGift` 返回的 `DivineGiftResult` 新增 `relationChangeText?: string`，文案：
> 神恩在园中荡开。米迦勒与加百列对你更加亲近，亚当与女人也听见了这道回响；远处的晨星却移开了目光。

前端在领取弹窗中展示。

### 3.2 恩泽棱镜（新回响）

- 道具定义加入 `items.ts`：`id: "resonance_grace_prism"`，`kind: "passive"`，`sourceType: "scene"`，`sourceName: "园中树林"`，`shortEffect: "神赐祝福的正向好感加成翻倍。"`。
- 持有判定：`state.inventory.includes("resonance_grace_prism")`。
- 获得时（`grantResonance` 后或 puzzle 结算后）调用 `applyGracePrismRetroactive(state)`：
  - 设 `state.divineAffinityMultiplier = 2`。
  - 补算已持有祝福的差额：遍历 `state.divineGiftsOwned`，对每项补发 `(2倍正向 - 1倍正向) = 原正向值`。即补发 michael +15、gabriel +15、eve +10、adam +10（lucifer 不补）。后续新领取的祝福在 `settleDivineGiftRelation` 时直接按倍率 2 结算。
- 该道具由园中树林场景问题选项二发放（见 §6）。

---

## 4. P1 · 免费行动叠加机制重构

### 4.1 新增"免费次数池"字段

`EdenWorldState` 新增（`types.ts`）：

```ts
/** 本时段免费移动剩余次数（进入新时段重算） */
freeMoveCharges: number;
/** 本时段免费对话剩余次数 */
freeDialogueCharges: number;
/** 本时段已用免费移动次数（写存档，防止刷新作弊） */
freeMoveUsedThisSlot: number;
/** 本时段已用免费对话次数 */
freeDialogueUsedThisSlot: number;
```

> 也可把 `freeMoveCharges/freeDialogueCharges` 改为"每时段重算的派生值"不存档，只存 `*UsedThisSlot`。**推荐**：存 `*UsedThisSlot`（已用次数），`*Charges` 由 `getFreeMoveCharges(state)` 派生计算（持有道具数 × 各自贡献 - 已用）。这样存档只存已用次数，刷新后仍正确。

### 4.2 派生计算（规则层）

新增 `src/game/world/freeActionRules.ts`：

```ts
/** 当前时段免费移动次数 = 各被动道具贡献 + 永久门槛修正 */
export function getFreeMoveCharges(state: EdenWorldState): number {
  let n = 0;
  if (state.inventory.includes("gift_free_move")) n += 1;        // 无羁之步：每时段1次
  if (state.inventory.includes("passive_light_step")) n += 1;    // 轻步印记：每时段1次
  if (state.inventory.includes("resonance_day_shade_step")) n += 1; // 昼荫轻步：白天1次
  // 晨流回环：白天1次（且额外恢复1AP，见 §7.3）
  if (state.inventory.includes("resonance_morning_flow") && state.timeOfDay === "day") n += 1;
  return n;
}
export function getFreeDialogueCharges(state: EdenWorldState): number {
  let n = 0;
  if (state.inventory.includes("resonance_night_silence") && state.timeOfDay === "night") n += 1; // 夜露缄声
  if (state.inventory.includes("resonance_night_tide_echo") && state.timeOfDay === "night") n += 1; // 夜潮回声
  return n;
}
export function getFreeMoveRemaining(state): number {
  return Math.max(0, getFreeMoveCharges(state) - (state.freeMoveUsedThisSlot ?? 0));
}
export function tryConsumeFreeMove(state): boolean {
  if (getFreeMoveRemaining(state) <= 0) return false;
  state.freeMoveUsedThisSlot = (state.freeMoveUsedThisSlot ?? 0) + 1;
  return true;
}
// tryConsumeFreeDialogue 同理
```

### 4.3 移动 AP 链路改造（`tool/route.ts:441-446`）

```ts
// 1. 一次性 consumable（boundary_mark / hedgehog_bristle）仍走 pendingConsumable
const consumableMoveEffect = applyPendingConsumableToMove(state);
// 2. 永久免费次数池
const usedFreeCharge = tryConsumeFreeMove(state);
// 3. 晨流回环额外恢复1AP（不超上限）—— 在 moveCost=0 时触发
const morningFlowRestore = state.inventory.includes("resonance_morning_flow")
  && state.timeOfDay === "day"
  && !state.freeMoveUsedThisSlot_extraFlag... // 需单独标记"本时段已恢复过"
  ? 1 : 0;
const moveCost = (consumableMoveEffect.freeApCost || usedFreeCharge) ? 0 : apCost;
consumeActionPoints(state, moveCost);
if (morningFlowRestore && moveCost === 0) {
  state.actionPoints = Math.min(getEffectiveMaxActionPoints(state), state.actionPoints + 1);
  // 标记本时段已恢复
}
```

> **晨流回环**需独立标记"本时段已恢复过1AP"，新增 `state.morningFlowRestoredThisSlot: boolean`，`advanceToNextSlot` 时清空。

### 4.4 低语 AP 链路改造（`route.ts:337-341`）

```ts
const whisperFreeFromConsumable = hasPendingFreeApForAction(state, "whisper");
const usedFreeDialogue = tryConsumeFreeDialogue(state);
const whisperCost = (whisperFreeFromConsumable || usedFreeDialogue) ? 0 : AP_COST_WHISPER;
```

夜潮回声额外恢复1AP：同晨流回环，新增 `state.nightTideRestoredThisSlot: boolean`。

### 4.5 时段推进重置（`actionPointRules.ts:resetSlotActions` 89-96）

`resetSlotActions` 增加：
```ts
state.freeMoveUsedThisSlot = 0;
state.freeDialogueUsedThisSlot = 0;
state.morningFlowRestoredThisSlot = false;
state.nightTideRestoredThisSlot = false;
```

### 4.6 无羁之步效果更新

- `divineGiftRules.ts:85-88` `shortEffect` 改为「每个时段第一次移动不消耗行动点」。
- `items.ts:428-433` `gift_free_move` 的 `shortEffect`/`description` 同步改。
- `gift_free_move` 不再走 `inventory.includes` 直接免单，改为贡献 1 次 `freeMoveCharges`（见 4.2）。

### 4.7 存档迁移

旧存档无 `freeMoveUsedThisSlot` 等字段 → 4 处 normalize 补 `?? 0` / `?? false`。旧存档持有 `gift_free_move` 的玩家从"无限免费"降为"每时段1次"，**这是预期削弱**，文档已要求。

---

## 5. P0 · Token 统计修复

### 5.1 新增 Token 统计字段（写入存档）

`EdenWorldState` 新增（`types.ts`）：

```ts
tokenStats: {
  /** 本时段对话累计 */
  dialogueThisSlot: number;
  /** 本局对话累计 */
  dialogueTotal: number;
  /** 本局润色累计 */
  polishTotal: number;
  /** 最近一次对话消耗（展示后不清零，供复盘） */
  lastDialogueTokens: number;
  /** 最近一次润色消耗 */
  lastPolishTokens: number;
  /** 是否含估算成分 */
  hasEstimate: boolean;
  /** Prompt / Completion 分项（本局累计） */
  dialoguePromptTotal: number;
  dialogueCompletionTotal: number;
};
```

> 写入存档以支持"读档后本局累计不归零"（验收 5.4 第4条）。注意 4 处 normalize 补默认 + `initialEdenWorldState` 默认。

### 5.2 服务端：补全 usage

- `route.ts:1164,1181` 流式路径 `callStreamingWorldAgent`：在流结束后从 provider result 取 `usage` 赋值（与非流式路径 1268/1366/1416 对齐）。
- 响应体已含 `usage`（`route.ts:927,955`），保持。

### 5.3 客户端：读取并累加对话 token

`applyWorldResponse`（`page.tsx:1104-1198`）新增：

```ts
if (data.usage) {
  const usage = resolveTokenUsage({
    playerInput: lastInputRef.current,  // 需保留最近输入
    eveReply: data.reply ?? "",
    apiUsage: data.usage,
  });
  setState((s) => ({
    ...s,
    tokenStats: {
      ...s.tokenStats,
      dialogueThisSlot: s.tokenStats.dialogueThisSlot + usage.totalTokens,
      dialogueTotal: s.tokenStats.dialogueTotal + usage.totalTokens,
      lastDialogueTokens: usage.totalTokens,
      hasEstimate: s.tokenStats.hasEstimate || usage.estimated,
      dialoguePromptTotal: s.tokenStats.dialoguePromptTotal + usage.promptTokens,
      dialogueCompletionTotal: s.tokenStats.dialogueCompletionTotal + usage.completionTokens,
    },
  }));
}
```

> 注意 `applyWorldResponse` 当前可能用 `setState(result.state)` 整体替换。若 tokenStats 在 state 内，需在服务端 route.ts 结算 usage 写入 `state.tokenStats`，或客户端合并。**推荐服务端写入**（规则层权威），客户端不再单独累加。

### 5.4 润色 token 迁移到 state

`handlePolish`（`page.tsx:1042-1061`）改为写 `state.tokenStats.polishTotal += consumed`、`lastPolishTokens = consumed`。保留 localStorage 兜底或迁移旧值。

### 5.5 UI 拆分（`page.tsx:2780-2794` 与 `3233-3237`）

蛇 Tab「词元消耗统计」改为三组：

```
对话消耗
  本次对话消耗：{lastDialogueTokens}
  本时段对话累计：{tokenStats.dialogueThisSlot}
  本局对话累计：{tokenStats.dialogueTotal}

润色消耗
  本次润色消耗：{lastPolishTokens}
  本局润色累计：{tokenStats.polishTotal}

总计
  本局总消耗：{dialogueTotal + polishTotal}{hasEstimate ? "（含估算）" : ""}
```

底部「本次低语消耗」改为读 `lastDialogueTokens`（而非 `polishTokensTurn`），条件改为 `lastDialogueTokens > 0`。

### 5.6 时段推进 / 新游戏 / 回溯

- `advanceToNextSlot`（`actionPointRules.ts`）或客户端 `end_slot` 处理：清零 `tokenStats.dialogueThisSlot`，**保留** `dialogueTotal/polishTotal`。
- AP 耗尽自动推进时段（`route.ts:907` `maybeAdvanceSlotAfterAction`）：客户端 `applyWorldResponse` 收到时段推进时也清零 `dialogueThisSlot`（对齐 5.3 节缺口）。
- 新游戏（`handleRestart` `page.tsx:1513-1519`）：全部归零。
- **时间回溯不清 Token**（需求 5.3）：溯源之水重置时不碰 `tokenStats`（见 §7.3）。

### 5.7 验收对照

| 验收 | 实现 |
|---|---|
| 不润色对话，本次消耗 >0 | `applyWorldResponse` 读 usage 写 `lastDialogueTokens` |
| 对话/润色分别增长 | 两组独立 state |
| 润色不计入对话 | 累加路径分离 |
| 读档后本局累计不归零 | tokenStats 写入 EdenWorldState，存档保留 |
| 无 usage 时估算 | `resolveTokenUsage` 已支持估算标记 |

---

## 6. P1 · 园中树林场景问题（tree_court）

### 6.1 场景问题定义（`scenePuzzles.ts` 新增）

```ts
{
  id: "puzzle_tree_court_shadow",
  locationId: "tree_court",
  trigger: "explicit_interaction",   // 进入不自动弹
  inputMode: "choice",
  resolutionMode: "per_option",
  title: "树影留下的问题",
  prompt: "树叶将光切成细碎的形状……你准备触碰哪一道痕迹？",
  options: [
    { id: "look_up", text: "抬起头，让叶缝间的目光落在身上",
      effect: { divineAttentionDelta: 1, feedback: "...", resultTitle: "仰光之痕" } },
    { id: "prism_leaf", text: "拾起那片映着数道光芒的叶子",
      effect: { itemId: "resonance_grace_prism", feedback: "...", resultTitle: "恩泽棱镜" } },
    { id: "day_shade", text: "沿着白日树荫最深的地方滑行",
      effect: { itemId: "resonance_day_shade_step", feedback: "...", resultTitle: "昼荫轻步" } },
    { id: "night_silence", text: "把下一句话藏进尚未落下的夜色",
      effect: { itemId: "resonance_night_silence", feedback: "...", resultTitle: "夜露缄声" } },
  ],
  successFeedback: "", rewards: {}, failure: { hint: "" },
}
```

> **注意**：选项一「仰光之痕」需求说是"即时回响，神明注视度+1"。当前 per_option 的 `divineAttentionDelta` 会加到 `divineAttentionCumulative`（`puzzleRules.ts:211-214`），达门槛触发祝福选择。但"仰光之痕"作为回响应入库存？需求文案"获得回响：仰光之痕 / 类型：即时回响 / 效果：神明注视度+1"——可不入库存，仅 `divineAttentionDelta:1` + resultTitle 即可；或入库存一个 instant 道具。**推荐**：入库存 `resonance_uplight_mark`（instant，repeatable），effect 同时 `itemId + divineAttentionDelta:1`。

### 6.2 新回响道具定义（`items.ts` 新增 4 项）

| id | title | kind | shortEffect |
|---|---|---|---|
| `resonance_uplight_mark` | 仰光之痕 | instant | 神明注视度 +1 |
| `resonance_grace_prism` | 恩泽棱镜 | passive | 神赐祝福正向好感加成翻倍 |
| `resonance_day_shade_step` | 昼荫轻步 | passive | 每个白天时段第一次移动不消耗行动点 |
| `resonance_night_silence` | 夜露缄声 | passive | 每个夜晚时段第一次与 NPC 对话不消耗行动点 |

### 6.3 交互对象「林间静影」UI（`page.tsx`）

- 仿东园幽径交互框（`page.tsx:1927-1942` `eden-east-path-entry`），在 `tree_court` 场景渲染一个可点击对象「林间静影」。
- CSS 类 `eden-tree-shadow-entry`，坐标对照 `tree_court` 白天/夜晚背景人工校准（`--day`/`--night`）。
- 点击 `handleScenePuzzleClick("puzzle_tree_court_shadow")`。
- 完成态：`completedScenePuzzleIds.includes(...)` 加 `--completed` 类，给提示不打开。
- **不自动弹出**：`trigger: "explicit_interaction"` 已保证（`getAvailableEnterPuzzle` 只取 `on_enter`）。

### 6.4 免费次数接入

- `resonance_day_shade_step` 在 `getFreeMoveCharges`（§4.2）中：`if (timeOfDay === "day") n += 1`。
- `resonance_night_silence` 在 `getFreeDialogueCharges` 中：`if (timeOfDay === "night") n += 1`。

---

## 7. P1 · 四河分流场景问题 + 时间回溯（naming_stone_bank）

### 7.1 场景问题定义（`scenePuzzles.ts` 新增）

```ts
{
  id: "puzzle_naming_stone_bank_fifth_reflection",
  locationId: "naming_stone_bank",
  trigger: "explicit_interaction",
  inputMode: "choice",
  resolutionMode: "per_option",
  title: "分流之外的问题",
  prompt: "四道水流向不同方向奔去……你准备听取哪一道水声？",
  options: [
    { id: "morning_flow", text: "听取带着晨光的水声",
      effect: { itemId: "resonance_morning_flow", feedback: "...", resultTitle: "晨流回环" } },
    { id: "night_tide", text: "听取藏在夜色下的水声",
      effect: { itemId: "resonance_night_tide_echo", feedback: "...", resultTitle: "夜潮回声" } },
    { id: "trace_source", text: "触碰那道流回最初的倒影",
      effect: { feedback: "（长文案）", resultTitle: "溯源之水" } },
  ],
  successFeedback: "", rewards: {}, failure: { hint: "" },
}
```

### 7.2 新回响道具（`items.ts` 新增 2 项）

| id | title | kind | shortEffect |
|---|---|---|---|
| `resonance_morning_flow` | 晨流回环 | passive | 每个白天时段第一次移动免AP并恢复1AP |
| `resonance_night_tide_echo` | 夜潮回声 | passive | 每个夜晚时段第一次对话免AP并恢复1AP |

### 7.3 溯源之水（时间回溯）—— 规则层最重

选项三「溯源之水」**获得并立即触发**。需新增规则函数 `applyTimeRewind(state)`（建议放 `src/game/world/timeRewindRules.ts`）：

**重置内容**（恢复开局）：
- `timeSlot=1, dayIndex=1, timeOfDay="day", turn=1`
- `actionPoints = getEffectiveMaxActionPoints(state)`（保留当前上限加成）
- `locationId = "adam_garden_work"`（蛇初始地点）
- `npcLocations` 恢复 `initialEdenWorldState.npcLocations`
- `eveMind / adamMind / hedgehog` 恢复初始值
- `npcRelations` 清空（恢复初始 profile 由 `ensureRelation` 重建）
- `npcChallenges / npcLanguageStates` 清空
- `encounteredNpcIds` 清空（再进入场景重新标记）
- `divineAttention=0, divineAttentionCumulative=0`
- `worldActions` 全 false
- `actionsThisSlot` 重置 + `freeMoveUsedThisSlot/freeDialogueUsedThisSlot` 等清零
- `corruptionTrace / npcDialogues / toolCallHistory` 清空
- `sceneActionIds / usedItemIds` 清空
- `pendingConsumableEffects` 清空
- `completedScenePuzzleIds` **只保留当前场景问题 ID**（`puzzle_naming_stone_bank_fifth_reflection`），其余恢复未完成

**保留内容**：
- `inventory / itemCounts`（已获回响与道具）
- `divineGiftsOwned / divineGiftHistory`（神赐祝福）
- `resonanceUseHistory`（回响使用历史）
- `unlockMapNpcLocations / unlockTreeNames`（已解锁园中印记相关）
- `unlockedAchievementIds`（印记不丢）
- `tokenStats`（Token 不清，见 5.6）
- `playerName`

**实施要点**：
- 该函数由 puzzle 选项触发，在 `applyPerOptionAnswer` 之外的特殊处理（因 `applyPerOptionAnswer` 只处理标准 effect 字段）。建议在 `ScenePuzzleOptionEffect` 新增 `triggerTimeRewind?: boolean` 标志，`applyPerOptionAnswer` 检测到时调用 `applyTimeRewind`。
- **防反复触发**：`completedScenePuzzleIds` 只保留当前 ID 后，该 puzzle 已完成，无法再次打开 ✓。但需确保 `isScenePuzzleAvailable` 对已完成返回 false。
- **非重复回响不叠加**：`grantResonance` 对 `repeatable:false` 道具已有去重（检查 inventory），重新完成其他场景问题选不同选项取得其他回响 ✓。

### 7.4 交互对象「第五道倒影」UI（`page.tsx`）

- 仿「林间静影」，在 `naming_stone_bank` 场景渲染可点击对象「第五道倒影」。
- CSS 类 `eden-fifth-reflection-entry`，坐标校准。
- 点击 `handleScenePuzzleClick("puzzle_naming_stone_bank_fifth_reflection")`。

### 7.5 免费次数接入

- `resonance_morning_flow` 在 `getFreeMoveCharges`：`if (timeOfDay === "day") n += 1`，并在移动免费时额外恢复1AP（`morningFlowRestoredThisSlot` 标记，见 §4.3）。
- `resonance_night_tide_echo` 在 `getFreeDialogueCharges`：`if (timeOfDay === "night") n += 1`，对话免费时恢复1AP。

---

## 8. P1 · 旋转的火焰剑 + 逃离伊甸园隐藏结局

### 8.1 旋转的火焰剑（新道具）

- `items.ts` 新增 `resonance_flaming_sword`：`kind: "passive"`，`sourceType: "angel"`，`sourceName: "加百列"`，`shortEffect: "能够破除幻境。"`（**不泄露隐藏结局触发**）。
- `EdenWorldState` 无需新字段（用 `inventory.includes`），但为赠礼去重建议复用 `npcRelations.gabriel.rewardClaimed` 或新增 `flameSwordClaimed: boolean`（4 处 normalize）。

### 8.2 获得条件（规则层判定）

- 加百列好感 ≥ 100（`npcRelations.gabriel.affinity >= 100`，突破100后也满足）。
- 完成加百列主动试炼（`npcChallenges.gabriel.status === "passed"`）。
- 之后首次符合条件的对话时由加百列主动赠予。
- **实现**：在 `route.ts` 加百列低语路径（`callAngelWorldAgent` 后）增加规则判定：若满足条件且 `!inventory.includes("resonance_flaming_sword")` 且 `!flameSwordClaimed`，则 `grantResonance(state, "resonance_flaming_sword")` + `flameSwordClaimed=true` + 返回赠礼叙事。**不依赖 Agent 自行决定**。
- 不替换加百列现有试炼奖励（`npcChallenges` 的 `rewardItemId`）。

### 8.3 东园幽径选项改造（`scenePuzzles.ts`）

将 day/night 两个 puzzle 的第4选项 `futile_struggle`（`171-181` / `231-241`）文案改为：
> 挣脱眼前的一切，试着从这场无法醒来的梦里离开。

`ScenePuzzleOptionEffect` 新增 `triggerEscapeCheck?: boolean` 标志。`applyPerOptionAnswer` 检测到时：
- 若 `inventory.includes("resonance_flaming_sword")` → 触发 `escape_eden` 结局（见 8.4）。
- 否则 → 保持原 `zeroActionPoints:true` 失败反馈（徒劳），标记 puzzle 完成。

### 8.4 逃离伊甸园结局

- `types.ts:44-47` `WorldEndingId` 新增 `"escape_eden"`（同时建议补 `"life_fruit"` 修正既有不一致）。
- 新增 `mark_escape_eden` 到 `AchievementId`（`types.ts:317`）。
- `src/content/world/achievements.ts` 新增印记定义（hidden:true, category:"ending"）。
- `src/components/world/EndingsGallery.tsx:20-39` `ENDINGS` 新增 `escape_eden`（type:"special" 或新增 "hidden"）。
- `globalTracker.ts:51` `NORMAL_ENDING_IDS` **不加** escape_eden（需求："不计入普通失败结局"）。但 `triggeredEndingIds` 仍记录以解锁图鉴。
- 结局触发函数 `triggerEscapeEden(state)`：
  ```ts
  state.phase = "ending";
  state.isEnded = true;
  state.endingId = "escape_eden";
  // 解锁印记
  if (!state.unlockedAchievementIds.includes("mark_escape_eden")) {
    state.unlockedAchievementIds.push("mark_escape_eden");
  }
  ```
- 结局叙事文案放入 `src/content/world/endings` 或内联（按现有结局文案存放惯例）。
- `endingSummaryRules` / `traceRules` 的结局识别需加 `escape_eden` 分支（成功/隐藏类，不算失败）。
- **复盘记录**：结局复盘中明确记录"获得旋转的火焰剑 / 在幽径尽头选择挣脱 / 火焰剑破除幻境"——在 `buildWorldEndingReview` 或新隐藏结局复盘分支中加。

### 8.5 验收

| 验收 | 实现 |
|---|---|
| 无火焰剑挣脱只耗尽AP | `triggerEscapeCheck` 检测无剑走 `zeroActionPoints` |
| 持剑立即触发逃离 | 检测有剑调 `triggerEscapeEden` |
| 触发后不能继续操作 | `isEnded=true` + `phase=ending`，前端锁定 |
| 图鉴/印记正确解锁 | EndingsGallery + mark_escape_eden |
| 存读隐藏结局存档不回探索 | `isEnded/phase/endingId` 写入存档，读档恢复 ending |

---

## 9. P0 · 结局页面 UI 修复

### 9.1 滚动修复（`globals.css`）

```css
/* :2601 */
.eden-ending-content {
  flex: 1;
  min-height: 0;          /* ← 关键：修复 flex 滚动陷阱 */
  overflow-y: auto;
  display: flex;
  justify-content: center;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}
```

- 删除或修正死 CSS `.eden-ending-main`（`globals.css:5658`，无使用）。
- 合并两处重复的结局 CSS 块（2593-2800 与 5658-5790），统一 padding/margin，避免双重留白。
- 确保小屏幕不强制垂直居中把顶部推出：`.eden-ending-content` 的 `justify-content:center` 在内容高于视口时改为 `flex-start`（可用 `@media` 或 `auto-fit` min-height 处理；或父级不固定高度）。

### 9.2 自动滚到顶部（`page.tsx`）

新增 `useEffect`：
```ts
const endingScrollRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  if (state.phase === "ending" || state.isEnded) {
    endingScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }
}, [state.phase, state.isEnded]);
```
绑定到 `.eden-ending-content` 或 `.eden-ending-scroll`。

### 9.3 精简结局复盘（`EndingReview.tsx`）

**最终只保留 5 个模块**（需求 10.3）：

1. **结局标题与叙事**（保留，2-4 短段落）。
2. **本局关键结果**：抵达时段 / 对话次数 / 最终神明注视 / 回响获得与使用数量。
3. **三个关键转折**：规则层从 `corruptionTrace / divineGiftHistory / worldActions` 选取最多 3 项。需在 `traceRules.ts:buildWorldEndingReview` 新增 `keyTurns: string[]` 选取逻辑：
   - 女人第一次怀疑命令（corruptionTrace 中首次 selfJudgement 相关）
   - 触碰/接近善恶树（worldActions.approachedTree/touchedFruit 首次）
   - 获得关键回响（如火焰剑/恩泽棱镜）
   - 某 NPC 好感跨越 100
   - 隐藏结局道具组合
4. **结局原因**：成功/隐藏显示达成条件；失败显示 ≤3 条 `buildFailureReasons`。
5. **本局解锁印记**：仅本局新解锁（`unlockedAchievementIds` 中本局新增的，需对比开局快照或标记）。

**删除/折叠**：完整对话记录、完整关键低语、全部场景互动、全部神赐祝福历史、全部回响使用历史、重复注视说明、第二伊甸园复刻。放入默认折叠的「查看详细记录」`<details>`。

### 9.4 隐藏结局复盘特殊处理

`escape_eden` 复盘：结局原因区显示"获得旋转的火焰剑 / 在幽径尽头选择挣脱 / 火焰剑破除幻境"。

---

## 10. P2 · Agent 注入好感与对神明敬畏

### 10.1 属性统一映射（需求 2.2）

| NPC | 对玩家好感 | 对神明敬畏 |
|---|---|---|
| 夏娃 | `eveMind.serpentTrust` | `eveMind.obedience` |
| 亚当 | `100 - adamMind.suspicionTowardSerpent` | `adamMind.obedience` |
| 加百列/米迦勒/路西法/刺猬 | `npcRelations[npcId].affinity` | `npcRelations[npcId].obedience` |

### 10.2 新增注入工具函数

`src/agents/world/worldAgentPrompts.ts` 新增：

```ts
export function describeAffinityForPrompt(npcId: EdenNpcId, state: EdenWorldState): string {
  // 返回统一好感 + 敬畏 + 心理阶段 + 最近变化原因
  const affinity = getUnifiedAffinity(npcId, state);   // 按上表映射
  const obedience = getUnifiedObedience(npcId, state);
  const stage = getAffinityStage(affinity);            // 复用 affinityStageHint 划分，但允许 >100
  const reason = getRelationChangeReason(npcId, state);// lastAffinityChangeReason
  // 行为关系参考表（高/低 × 高/低）生成态度指引
  return `对蛇好感：${stage}（${affinity}）/ 对神敬畏：${obedienceStage}（${obedience}）\n最近：${reason}\n态度：${attitudeGuidance(affinity, obedience)}`;
}
```

`attitudeGuidance` 按需求 2.2 行为表：
- 高好感+高敬畏：友善但维护秩序，不轻易越界帮助
- 高好感+低敬畏：愿意理解蛇，可能主动帮助探索边界
- 低好感+高敬畏：警惕克制，倾向拒绝
- 低好感+低敬畏：不服从神也不信任蛇，疏离独立
- 好感 >100：增加亲近，但不失人格/职责/信仰

### 10.3 各 builder 注入

- `buildEveWorldPrompt`（`worldAgentPrompts.ts:28-118`）：在 `describeEveMind` 输出后追加 `describeAffinityForPrompt("eve", state)`。注意 eve 的好感用 `eveMind.serpentTrust`、敬畏用 `eveMind.obedience`（与 npcRelations 重复，以 eveMind 为准）。
- `buildAdamWorldPrompt`（162-236）：追加 `describeAffinityForPrompt("adam", state)`，好感 = `100 - suspicionTowardSerpent`，敬畏 = `adamMind.obedience`（当前 `describeAdamMind` 未用 obedience，需补）。
- `buildWorldNpcPrompt`（`route.ts:1273-1319`）：追加 `describeAffinityForPrompt(npcId, state)`——这是最关键的缺口，天使首次获得好感/敬畏上下文。
- `buildHedgehogPrompt`：刺猬可选择性注入（低优先，刺猬为氛围动物）。

### 10.4 约束

- **Agent 不得输出/修改数值**，prompt 中明确"以下数值仅供你调整态度，不得在回复中报数或改变"。
- 所有数值变化仍由规则层（`applyNpcAffinity` / `settleDivineGiftRelation`）决定。

---

## 11. 存档兼容要求（需求第十二节）

新增字段清单与迁移点：

| 新字段 | 默认值 | 4 处 normalize |
|---|---|---|
| `divineAffinityMultiplier: number` | `1` | ✓ |
| `freeMoveUsedThisSlot: number` | `0` | ✓ |
| `freeDialogueUsedThisSlot: number` | `0` | ✓ |
| `morningFlowRestoredThisSlot: boolean` | `false` | ✓ |
| `nightTideRestoredThisSlot: boolean` | `false` | ✓ |
| `tokenStats: TokenStats` | 见 5.1 | ✓（嵌套对象需整体 `?? {}` + 字段 `?? 0`） |
| `lastAffinityChangeReason`（在 NpcRelationState） | `null` | 在 `ensureRelation` 补 |
| `flameSwordClaimed: boolean` | `false` | ✓ |
| `WorldEndingId` 加 `escape_eden`/`life_fruit` | — | 类型扩展，旧存档 `endingId` 不受影响 |
| `AchievementId` 加 `mark_escape_eden` | — | 类型扩展 |

**旧存档迁移要点**：
- 神赐关系被动无需去重字段：`claimDivineGift` 仅在首次领取某祝福时调用，读档链路不触发 claim，故旧存档已领取的祝福不会重新结算，新领取的按新数值（+15/+15/+10/+10/-10）结算。旧档玩家视为已享受过旧 +10 逻辑，不补发差额。
- 不得因取消 100 上限重置好感：去掉 clamp 后旧档好感值自然保留，**不主动改值**。
- 已完成旧场景问题记录不丢失：`completedScenePuzzleIds` 保留，新 puzzle ID 不影响旧记录。
- 结局图鉴/印记数据不损坏：`unlockedAchievementIds` / globalTracker localStorage 不碰。
- 旧 `eden:world:polish-tokens` localStorage 迁移到 `state.tokenStats.polishTotal`（首次读档时合并）。

---

## 12. 涉及文件清单

| 文件 | 改动 | 关联需求 |
|---|---|---|
| `src/game/world/types.ts` | 新增 8+ 字段 + WorldEndingId/AchievementId 扩展 + NpcRelationState 加 lastAffinityChangeReason + TokenStats 类型 + 注释更新 | 全局 |
| `src/game/world/npcRelationRules.ts` | clampAffinity 去 100 上限 + 写 lastAffinityChangeReason | 2.1 |
| `src/game/world/divineGiftRules.ts` | 关系被动结算 + 恩泽棱镜倍率 + capstone 不降值 + DivineGiftResult 加 relationChangeText | 2.1/3.1/3.2 |
| `src/game/world/freeActionRules.ts`（新） | getFreeMoveCharges / tryConsumeFreeMove / 对话版 | 4 |
| `src/game/world/actionPointRules.ts` | resetSlotActions 清免费次数字段 | 4 |
| `src/game/world/timeRewindRules.ts`（新） | applyTimeRewind | 7.3 |
| `src/game/world/puzzleRules.ts` | normalize 补新字段 + per_option 处理 triggerTimeRewind/triggerEscapeCheck | 4/6/7/8 |
| `src/game/world/traceRules.ts` | buildWorldEndingReview 加 keyTurns + escape_eden 分支 | 9 |
| `src/game/world/resonanceRules.ts` | 免费移动改造（配合 freeActionRules） | 4 |
| `src/content/world/scenePuzzles.ts` | 新增 2 场景问题 + 改东园幽径第4选项 | 6/7/8 |
| `src/content/world/items.ts` | 新增 7 回响（恩泽棱镜/仰光之痕/昼荫轻步/夜露缄声/晨流回环/夜潮回声/火焰剑）+ 无羁之步文案 | 3.2/6/7/8 |
| `src/content/world/achievements.ts` | 新增 mark_escape_eden | 8 |
| `src/content/world/npcRelations.ts` | affinityStageHint 允许 >100（如 115/130/200 阶段） | 2.1/10 |
| `src/agents/world/worldAgentPrompts.ts` | describeAffinityForPrompt + 注入 eve/adam | 10 |
| `src/app/api/world/route.ts` | buildWorldNpcPrompt 注入 + 流式 usage 补全 + 加百列火焰剑赠予 + escape_eden 触发 + tokenStats 写入 + cloneWorldState 补字段 | 5/8/10 |
| `src/app/api/world/tool/route.ts` | moveCost 改用 freeActionRules + cloneWorldState 补字段 | 4 |
| `src/app/api/polish/route.ts` | （核查）usage 透传 | 5 |
| `src/app/world/page.tsx` | Token UI 拆分 + applyWorldResponse 读 usage + 林间静影/第五道倒影交互对象 + 属性页去 /100 + 结局滚顶 useEffect + 东园幽径选项文案 | 2.1/5/6/7/9 |
| `src/components/world/EndingReview.tsx` | 精简为 5 模块 + 折叠详细记录 | 9 |
| `src/components/world/EndingsGallery.tsx` | 加 escape_eden | 8 |
| `src/components/world/SettingsModal.tsx` | （核查）结果弹窗显示关系变化 | 3.1 |
| `src/app/globals.css` | 结局滚动修复 + 新交互对象坐标 + 合并重复结局 CSS | 6/7/9 |
| `src/hooks/useWorldSave.ts` | normalizeWorldStateForClient 补新字段 + 旧 polish-tokens 迁移 | 5/11 |
| `src/services/achievement/globalTracker.ts` | （核查）escape_eden 记录但不入 NORMAL_ENDING_IDS | 8 |

---

## 13. 回归测试清单（开发完成后必检）

### 13.1 好感度突破 100（P0）
- [ ] NPC 95 +20 = 115 显示。
- [ ] NPC 130 集齐 7 祝福仍 130。
- [ ] 95→115 触发一次满好感奖励，115→130 不重复。
- [ ] 属性页保留 /100 显示，分子可 >100（如 50/100、120/100）。
- [ ] 图鉴/结局统计/成就判断支持 >100。

### 13.2 神赐祝福关系被动（P1）
- [ ] 获 1 祝福：michael/gabriel +15、adam/eve +10、lucifer -10。
- [ ] 获 3 祝福：累计 michael/gabriel +45、adam/eve +30、lucifer -30。
- [ ] 重复载入/刷新不二次结算。
- [ ] 好感不低于 0。
- [ ] 结果弹窗显示关系变化文案。

### 13.3 恩泽棱镜（P1）
- [ ] 持有后正向加成 ×2（michael/gabriel +30、adam/eve +20，lucifer 仍 -10）。
- [ ] 已有 2 祝福后获棱镜：补发 michael/gabriel +30、adam/eve +20。

### 13.4 免费行动叠加（P1）
- [ ] 无羁之步：每时段第一次移动免费，第二次消耗。
- [ ] 持无羁之步+轻步印记+昼荫轻步：白天前 3 次移动免费。
- [ ] 夜晚只有前 2 次免费（无昼荫轻步）。
- [ ] 一次性 consumable 与永久次数叠加不覆盖。
- [ ] 刷新页面后已用次数不重置（写存档）。
- [ ] 进入新时段免费次数重置。

### 13.5 Token 统计（P0）
- [ ] 不润色对话，本次对话消耗 >0。
- [ ] 开润色后对话/润色分别增长。
- [ ] 润色不计入对话消耗。
- [ ] 读档后本局累计不归零。
- [ ] 无 API usage 时显示估算值（标记"估算"）。
- [ ] 进入下一时段清零本时段对话累计，保留本局累计。
- [ ] 新游戏全归零。
- [ ] 时间回溯不清 Token。

### 13.6 园中树林场景问题（P1）
- [ ] 进入 tree_court 不自动弹出。
- [ ] 点击「林间静影」打开问题。
- [ ] 每选项只发对应回响。
- [ ] 选择后本局不可再打开。
- [ ] 仰光之痕：神明注视 +1，达门槛触发祝福选择。
- [ ] 昼荫轻步只在白天贡献免费移动。
- [ ] 夜露缄声只在夜晚贡献免费对话。

### 13.7 四河分流 + 时间回溯（P1）
- [ ] 进入 naming_stone_bank 不自动弹出。
- [ ] 点击「第五道倒影」打开问题。
- [ ] 晨流回环：白天第一次移动免费 + 恢复1AP（不超上限）。
- [ ] 夜潮回声：夜晚第一次对话免费 + 恢复1AP。
- [ ] 溯源之水：时间/NPC 状态恢复开局；Agent 对话历史清空；已有回响保留；其他场景问题恢复可完成；四河分流当前问题保持已完成；Token 与印记保留；不能反复触发。

### 13.8 火焰剑 + 隐藏结局（P1）
- [ ] 加百列好感≥100 + 试炼通过后首次对话获火焰剑。
- [ ] 每局只获一次。
- [ ] 无剑挣脱：AP 归零，不触发结局。
- [ ] 持剑挣脱：立即触发逃离伊甸园。
- [ ] 触发后不能继续操作世界。
- [ ] 图鉴与 mark_escape_eden 解锁。
- [ ] 存读隐藏结局存档不回探索阶段。
- [ ] 不计入普通失败结局。

### 13.9 结局页面 UI（P0）
- [ ] 打开结局自动定位顶部。
- [ ] 鼠标滚轮/触控/滚动条均可滚动。
- [ ] 移动端可拖动。
- [ ] 复盘只 5 模块 + 折叠详细记录。
- [ ] 隐藏结局复盘显示火焰剑/挣脱/破除幻境。

### 13.10 Agent 注入（P2）
- [ ] 天使回复态度随好感/敬畏变化（高好感低敬畏更愿帮助）。
- [ ] Agent 不在回复中报数值。
- [ ] 好感 >100 增加亲近但不失人格。

### 13.11 存档兼容（P0）
- [ ] 旧存档读取不崩，缺字段补默认。
- [ ] 旧存档不重复发神赐关系奖励。
- [ ] 旧存档好感不被重置。
- [ ] 旧存档已完成场景问题记录不丢。
- [ ] 结局图鉴/印记不损坏。

---

## 14. 建议开发顺序

### Phase 1：底层规则与 Bug 修复（P0 为主）
1. 好感度取消 100 上限（§2）—— 改动小、解锁后续测试。
2. 神赐祝福关系被动 + 恩泽棱镜（§3）—— 依赖 2.1。
3. 免费行动叠加重构（§4）—— 独立子系统，新增 freeActionRules。
4. Token 统计修复（§5）—— 独立，需服务端+客户端协同。
5. 结局滚动修复（§9.1/9.2）—— 纯 CSS + 一个 useEffect，最快见效。
6. Agent 注入好感/敬畏（§10）—— 依赖 2.1 的统一映射。

### Phase 2：回响与场景问题（P1）
7. 7 项新回响道具定义（§6.2/7.2/8.1）。
8. 园中树林场景问题（§6）。
9. 四河分流场景问题 + 时间回溯（§7）—— 最重，单独充分测试。
10. 精简结局复盘（§9.3）—— 依赖新复盘数据字段。

### Phase 3：隐藏结局与最终测试（P1）
11. 旋转的火焰剑（§8.1/8.2）。
12. 东园幽径选项改造 + 逃离伊甸园结局（§8.3/8.4）。
13. 旧存档迁移与回归测试（§11/13）。

---

## 15. 执行提示词（供 CodeBuddy 启动）

```
执行 doc/第一章/plan_docs/20_CODEBUDDY_TASK_CHAPTER1_PLAYTEST_ROUND4_RELATION_TOKENS_ENDING.md 的开发任务。

基线：feat/chapter1-round3-save-refresh。按 Phase 1 -> 2 -> 3 顺序实现，每完成一项跑一次回归清单对应小节。

关键约束：
1. 新增 EdenWorldState 标量字段必须在 4 处补 ?? 默认：
   normalizePuzzleState、normalizeWorldStateForClient、cloneWorldStateForPuzzle、cloneWorldState(route.ts)，
   并设 initialEdenWorldState 默认值。withNpcWorldDefaults 不被读档链路调用（见项目记忆 eden-save-normalize-gotcha）。
2. 好感度只去上限（Math.max(0,v)），保留下限 0；reached100 首次跨越 100 语义已正确，不重复触发。
3. 集满 7 祝福 capstone 用 Math.max(affinity,100)，不把 >100 降回 100。
4. 神赐关系被动无需额外去重字段：结算放在 claimDivineGift 内（该函数仅在首次领取某祝福时调用），lucifer 负向不乘恩泽棱镜倍率。
5. 免费行动改为次数池：存 freeMoveUsedThisSlot/freeDialogueUsedThisSlot（已用），剩余由 getFreeMoveCharges 派生；
   gift_free_move 从"无限免费"降为"每时段1次"（预期削弱）。
6. Token 统计：applyWorldResponse 必须读 data.usage 并经 resolveTokenUsage 累加到 state.tokenStats；
   蛇 Tab UI 拆分对话/润色两组；tokenStats 写入存档，读档不归零，时间回溯不清。
7. 新场景问题 trigger:"explicit_interaction"（不自动弹），per_option 模式，每局一次（completedScenePuzzleIds 去重）。
8. 溯源之水时间回溯：重置除 inventory/divineGifts/unlockedAchievementIds/tokenStats/playerName 外的所有状态；
   completedScenePuzzleIds 只保留当前问题 ID。
9. 火焰剑由规则层判定发放（加百列好感≥100 + 试炼通过 + 每局一次），不依赖 Agent 决定。
10. 隐藏结局 escape_eden 不计入 NORMAL_ENDING_IDS；结局复盘精简为 5 模块 + 折叠详细记录。
11. 结局滚动修复核心：.eden-ending-content 加 min-height:0；进入 ending 阶段 useEffect 滚顶。
12. Agent 注入好感/敬畏仅供调整态度，Agent 不得输出/修改数值。

完成后更新本文档"回归测试清单"勾选状态，并输出变更文件列表与 npm run lint / npm run build 结果。
```

---

## 附录 A · 关键代码定位速查

| 关注点 | 文件:行 |
|---|---|
| 好感 clamp | `src/game/world/npcRelationRules.ts:23-25,122` |
| 满 100 触发 | `src/game/world/npcRelationRules.ts:123` |
| 神赐关系结算 | `src/game/world/divineGiftRules.ts:160-170` |
| 集满 capstone | `src/game/world/divineGiftRules.ts:189-205` |
| 关系类型 | `src/game/world/types.ts:717-728` |
| 夏娃 prompt | `src/agents/world/worldAgentPrompts.ts:28-118` |
| 亚当 prompt | `src/agents/world/worldAgentPrompts.ts:162-236` |
| 天使 prompt（实际） | `src/app/api/world/route.ts:1273-1319` |
| 天使 prompt（死代码） | `src/agents/world/buildAngelPrompt.ts`（无调用） |
| 好感阶段 | `src/content/world/npcRelations.ts:164-169` |
| 移动 moveCost | `src/app/api/world/tool/route.ts:441-446` |
| 轻步印记 | `src/game/world/resonanceRules.ts:474-493` |
| gift_free_move | `src/app/api/world/tool/route.ts:444` |
| 低语 whisperCost | `src/app/api/world/route.ts:337-341` |
| pending consumable | `src/game/world/resonanceRules.ts:156-179` |
| ActionsThisSlot 类型 | `src/game/world/types.ts:213-222` |
| 时段重置 | `src/game/world/actionPointRules.ts:89-96` |
| Token UI（蛇 Tab） | `src/app/world/page.tsx:2780-2794` |
| Token UI（底部） | `src/app/world/page.tsx:3233-3237` |
| 润色 token state | `src/app/world/page.tsx:647-656` |
| applyWorldResponse | `src/app/world/page.tsx:1104-1198` |
| 服务端 usage 返回 | `src/app/api/world/route.ts:927,955,1268,1366,1416` |
| 流式 usage 缺失 | `src/app/api/world/route.ts:1164,1181` |
| resolveTokenUsage | `src/game/rules/tokenUsageRules.ts:60` |
| 结局滚动 bug | `src/app/globals.css:2601-2609` |
| 结局复盘组件 | `src/components/world/EndingReview.tsx` |
| 复盘数据源 | `src/game/world/traceRules.ts:56-176` |
| 失败原因 | `src/game/world/traceRules.ts:189-218` |
| 结局触发 | `src/app/api/world/route.ts:613-638,673-675` |
| 结局图鉴 | `src/components/world/EndingsGallery.tsx:20-39` |
| WorldEndingId 类型 | `src/game/world/types.ts:44-47` |
| 跨局结局 | `src/services/achievement/globalTracker.ts:51` |
| 隐藏印记解锁 | `src/game/world/achievementRules.ts:265-268` |
| 场景问题定义 | `src/content/world/scenePuzzles.ts` |
| per_option 结算 | `src/game/world/puzzleRules.ts:138-241` |
| 东园幽径第4选项 | `src/content/world/scenePuzzles.ts:171-181,231-241` |
| tree_court 地点 | `src/content/world/locations.ts:105-124` |
| naming_stone_bank 地点 | `src/content/world/locations.ts:145-163` |
| 加百列赠礼校验 | `src/game/world/npcRelationRules.ts:170-219` |
| normalize 4 处 | `puzzleRules.ts:44-55` / `useWorldSave.ts:14-33` / `puzzleRules.ts:58-93` / `route.ts:cloneWorldState` |
