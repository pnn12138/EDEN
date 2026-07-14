# Chapter 1：注视、关系、档案与结局创作实施任务书

> **For CodeBuddy agent:** 本任务涉及多处状态机与 AI 内容。请按任务顺序逐项实现、逐项自测，并在 CodeBuddy 对话中保留关键实现和调试记录；不要跳过规则层测试直接修改 UI。

**目标：** 将第一章收束为一个可完整试玩的叙事闭环：4 点行动经济、七阶神明注视、可理解的天使/人类关系后果、东园幽径昼夜题、园中档案律则、可靠的存档设置，以及以 AI 图片集为主的结局纪念创作。

**架构：** 玩法真相只存在于 `src/game/world/` 的纯规则函数中，API 路由负责校验和调用规则，页面只展示服务端返回的新状态。AI NPC 只能接收规则层裁定后的“性格、关系、允许度、后果”提示，不能自行改行动点、亲密度、服从值、注视值、献礼或结局。结局创作由纯函数从既有世界状态压缩出 `RunChronicle`，再由服务端生成分镜和图片；媒体失败必须退化为文字分镜，不能阻断结局复盘。

**技术栈：** Next.js 14 App Router、React 18、TypeScript、既有 Volcengine/DeepSeek LLM 抽象、localStorage 四槽存档、Playwright、现有 smoke 脚本。

---

## 0. 任务边界、权威来源与冲突裁决

### 0.1 必读文件（实现前逐一阅读）

1. `README.md`、`package.json`、`docs/PROJECT_CONTEXT.md`、`doc/产品需求文档.md`。
2. `design/01_world_bible.md`、`design/RESONANCE_FULL_DESIGN.md`。
3. `design/chapters/chapter1_divine_attention_angel_path_design.md`（本任务玩法真相）。
4. `design/chapters/chapter1_three_angel_hidden_endings_design.md` 与 `doc/第一章/plan_docs/21_CODEBUDDY_TASK_CHAPTER1_THREE_ANGEL_HIDDEN_ENDINGS.md`（隐藏结局资产和既有接口）。
5. `src/game/world/types.ts`、`actionPointRules.ts`、`divineAttentionRules.ts`、`divineGiftRules.ts`、`npcRelationRules.ts`、`puzzleRules.ts`、`timeRewindRules.ts`。
6. `src/app/api/world/route.ts`、`src/app/api/world/tool/route.ts`、`src/app/api/world/puzzle/route.ts`、`src/app/world/page.tsx`、`src/components/world/SettingsModal.tsx`、`src/components/world/EndingReview.tsx`、`src/hooks/useWorldSave.ts`。

### 0.2 本文档覆盖的旧口径

- 覆盖计划 14 中的 5 AP、同 NPC 3 次对话、旧注视阈值 `[2,3,4,5,6,7]`。
- 覆盖计划 21 中“米迦勒好感归零同一轮立即斩杀”：新规则是**归零时仅写入待斩；下一次再与米迦勒对话才进入 `michael_slay`**。
- 开局“直接获得一份献礼”的可玩实现为：引子最后一拍显示一次三选一，玩家点选后**立刻**拥有第一份献礼并进入探索；不会先进入探索再补发。
- 视频候选模型名为 `doubao-seedance-2.0-mini`。2026-07-14 已获用户授权，对现有 `https://ark.cn-beijing.volces.com/api/plan/v3/contents/generations/tasks` 做最小真实创建测试；该入口返回 `UnsupportedModel`，表示模型当前不支持 Agent Plan feature，未创建任务也未产生视频。不得将视频作为 Demo 核心闭环前置条件；在取得支持该模型的 API 入口及对应凭据前，保留文字分镜/图片集兜底，不得伪称视频可用。

### 0.3 不得做的事

- 不删除、移动或重命名 `doc/` 中任何已有文件；本文件是新增文件。
- 不将 API Key、完整请求头、玩家自填 Key、媒体 URL 中的敏感参数写入客户端存档、`RunChronicle`、日志、toast 或浏览器控制台。
- 不让 LLM 文本、正则关键词或前端本地状态直接触发结局/道具/数值结算。
- 不为了此任务改写第二伊甸园外层真相、禁果硬门槛或第五水流回溯语义。

### 0.4 平台范围冻结：仅桌面浏览器

- **第一章仅以桌面浏览器（desktop Chromium）为交付、演示与验收目标。**
- 禁止为手机、平板或触控设备新增响应式布局、窄屏 CSS、触控交互、移动端性能优化、移动端截图或移动端 Playwright 覆盖；它们不计入完成度。
- 不得因为移动端用例或窄视口显示问题回退、牺牲或重排桌面 UI。桌面体验优先保持 1440×900 至 1920×1080 的清晰可读与可操作。
- `tests/e2e/world-scene-puzzles.mobile.spec.ts` 及其他移动端专属测试属于已冻结范围：由 CodeBuddy 删除或从测试发现中移除，后续不修复、不扩展，也不作为任何验收失败项。
- 自动化验收只运行桌面项目与核心规则/接口测试；若未来重新决定支持移动端，必须先由产品重新立项，不得在本任务中顺手恢复。

## 1. 文件与责任地图

| 责任 | 新建/修改文件 | 说明 |
|---|---|---|
| 状态、迁移、事件 | `src/game/world/types.ts`、`src/game/world/worldEventRules.ts`（新） | 新状态字段、旧存档默认、结构化事件 |
| AP 与对话上限 | `src/game/world/actionPointRules.ts`、`src/app/api/world/route.ts`、`tool/route.ts` | 4 AP、按亲密度动态次数、神罚移动限制 |
| 注视与献礼 | `src/game/world/divineAttentionRules.ts`、`divineGiftRules.ts`、`puzzleRules.ts` | 单一增量入口、44–99 阈值、候选校验 |
| NPC 关系/性格 | `npcRelationRules.ts`、`src/game/world/npcIntentRules.ts`（新）、`src/app/api/world/route.ts` | 规则层裁定意愿，提示词只表现 |
| 东园/道具 | `src/content/world/scenePuzzles.ts`、`items.ts`、`resonanceRules.ts`、`itemRules.ts` | 两套题、传令残羽、道具收敛 |
| 档案 | `src/content/world/divineAttentionRules.ts`（新内容表）、`AchievementGarden.tsx`、`src/app/garden/page.tsx`、游戏内档案入口 | “园中律则”与“园中档案”统一名称 |
| 设置与保存 | `SettingsModal.tsx`、`useWorldSave.ts`、`page.tsx`、`globals.css` | 卡片式四槽与 AI 创作页签 |
| 结局创作 | `src/game/world/runChronicle.ts`（新）、`src/app/api/world/ending-media/route.ts`（新）、`EndingMemoryPanel.tsx`（新）、`EndingReview.tsx` | 分镜、图片集、失败回退；视频接口预留 |
| 测试 | `scripts/test-world-smoke.mjs`、新增纯规则测试脚本、`tests/e2e/*.spec.ts` | 规则、迁移、核心浏览器路径 |

## 2. 实施顺序与提交切分

按以下 7 个独立提交推进；每项都先写/更新测试，再实施，再执行对应测试。任何一步失败先修复，不能带红进入下一项。

1. 状态迁移、4 AP、动态对话次数与神罚移动限制。
2. 十倍注视、七献礼与领取候选校验。
3. NPC 性格、服从裂隙、米迦勒/加百列/路西法特殊后果与水路。
4. 东园幽径昼夜题及道具审计。
5. 园中档案与园中律则。
6. 设置、存档匣与 AI 创作配置。
7. 结局图片集、文字分镜兜底、视频预留和端到端验收。

---

## Task 1：状态迁移、4 AP、动态对话次数与神罚

**Files:**
- Modify: `src/game/world/types.ts`, `src/game/world/actionPointRules.ts`, `src/game/world/timeRewindRules.ts`, `src/hooks/useWorldSave.ts`
- Modify: `src/app/api/world/route.ts`, `src/app/api/world/tool/route.ts`, `src/app/world/page.tsx`
- Test: `scripts/test-world-smoke.mjs`, `scripts/test-world-attention-rules.mjs`（新）

- [ ] **Step 1：补齐可迁移状态，不删除旧字段。**

在 `EdenWorldState` 增加并在 `createInitialWorldState`、API normalizer、`normalizeWorldStateForClient` 中默认化：

```ts
divineAttentionValue: number;                 // 当前等级内的 0..threshold，不保存溢出
pendingDivineGiftChoice: DivineGiftId[] | null;
unlockedDivineAttentionRuleIds: DivineAttentionRuleId[];
attentionRuleTriggerCounts: Partial<Record<DivineAttentionRuleId, number>>;
actionsThisSlot: {
  // 保留原字段；新增：
  hasGrantedPaidDayMoveAttention: boolean;
  hasGrantedPaidNightDialogueAttention: boolean;
  moveCount: number;
};
michaelDivinePunishmentActive: boolean;
michaelExecutionPending: boolean;
luciferZeroAffinityGiftClaimed: boolean;
luciferSwimStage: "none" | "hand_accepted";
worldEventHistory: WorldEventRecord[];
```

旧 `divineAttentionCumulative` 只作为迁移来源：若新字段缺失，取 `max(0, oldCumulative)`；新代码不得继续把它当 UI 或献礼真相。旧 `divineAttention` 可暂存为 0–4 的内部“压力”兼容值，但玩家 UI、献礼门槛、档案文字均以 `divineAttentionValue` 与 `divineGiftsOwned.length` 为准。

- [ ] **Step 2：把基础 AP 改为 4。**

`types.ts` 初始 `actionPoints`/`maxActionPoints` 改为 4；`getEffectiveMaxActionPoints` 的兜底值亦为 4。保留既有 `apMaxBonusBase`/`apMaxBonusDay`，但后续 Task 4 会限制永久总加成 +2。所有 smoke 断言从 5 改为 4，并保留“消耗 1 AP”“新时段恢复到有效上限”的断言。

- [ ] **Step 3：按亲密度决定每时段可成功对话次数。**

新增纯函数，UI 禁用提示与 API 复用同一函数：

```ts
export function getWhisperLimitForNpc(state: EdenWorldState, npcId: EdenNpcId): number {
  const affinity = getDisplayedAffinity(state, npcId);
  if (affinity >= 100) return 3;
  if (affinity >= 60) return 2;
  return 1;
}
```

`getDisplayedAffinity` 对女人读 `eveMind.serpentTrust`，对亚当读“反向怀疑”或已有统一投影；天使/刺猬读 `npcRelations[npcId].affinity`。不要用 UI 显示值与规则判断值各写一套。`hasWhisperedToNpcThisSlot` 改为比较动态上限；`actionsThisSlot.whisperedNpcIds` 继续作为唯一次数记录。

- [ ] **Step 4：实现米迦勒神罚的移动限制和回溯清除。**

当 `michaelDivinePunishmentActive` 时，`canMove`/`move_to_location` 只允许本时段第 1 次**成功且消耗 AP**的移动；失败移动不占次数。移动成功后递增 `moveCount`。新时段清零 `moveCount`。第五水流的 `applyTimeRewind` 从开局状态恢复，故这两个米迦勒字段必须为 false；添加显式回归测试。

- [ ] **Step 5：验证与提交。**

运行：`npm run typecheck`、`npm run lint`、`node scripts/test-world-attention-rules.mjs`。新增测试至少覆盖旧存档默认化、初始 4 AP、1/2/3 次对话边界、神罚每时段仅一次移动、回溯清除神罚。

提交建议：`feat(world): add four-point action economy and relation dialogue limits`

## Task 2：十倍神明注视、七献礼与可信领取

**Files:**
- Modify: `src/game/world/divineAttentionRules.ts`, `divineGiftRules.ts`, `puzzleRules.ts`, `actionPointRules.ts`, `resonanceRules.ts`, `itemRules.ts`
- Modify: `src/app/api/world/route.ts`, `src/app/api/world/tool/route.ts`, `src/app/world/page.tsx`, `src/components/world/DivineAttentionViz.tsx`
- Test: `scripts/test-world-attention-rules.mjs`, `scripts/test-world-smoke.mjs`

- [ ] **Step 1：建立唯一的注视入口。**

所有正向注视只能经过：

```ts
grantDivineAttention(state, {
  amount: 5 | 10 | 20 | 30 | 50,
  ruleId: DivineAttentionRuleId,
  source: "move" | "dialogue" | "puzzle" | "item" | "tool",
  isHighRisk: boolean,
});
```

它的职责：高风险且持有 `gift_attention_accel` 时 `amount * 1.5`；更新当前阶 `divineAttentionValue`；解锁规则 ID、累计次数、写结构化事件；**不**直接发礼物。常规 +5 不参与 1.5 倍。禁止在 puzzle/道具/route 中直接 `+=` 注视。

- [ ] **Step 2：实现数值来源和防刷条件。**

| 来源 | 数值 | 规则 ID | 条件 |
|---|---:|---|---|
| 白天第一次付费、到达新地点的移动 | +5 | `paid_day_move` | 每个白天时段一次；免费、原地、失败、立即折返均不计 |
| 夜晚第一次付费且成功的 NPC 对话 | +5 | `paid_night_dialogue` | 每个夜晚时段一次；拒绝、失败、免费不计 |
| 自主判断/二手命令/天使试探 | +10/+20/+30 | 对应档案 ID | 完整表严格采用设计文档 §3.1 |
| 东园月下主动引目 | +10 | `scene_uplight` | 一次场景选择 |
| 东园无月影越界 | +50 | `east_shadowless` | 一次场景选择 |

内部压力（旧 0–4）若仍需驱动刺猬/排期，必须在 `grantDivineAttention` 内有明确换算，不能再决定献礼；其水滴 UI 不得复活。

- [ ] **Step 3：七阶礼物规则。**

```ts
export const DIVINE_GIFT_THRESHOLDS = [44, 55, 66, 77, 88, 99] as const;
// level = divineGiftsOwned.length，开局领完为 1/7
// threshold = DIVINE_GIFT_THRESHOLDS[level - 1]
```

达到本阶门槛后先完成本次动作，生成并保存 `pendingDivineGiftChoice`（未拥有的 3 个，余量不足则全列）。领取成功后：只新增本次候选内的未拥有 gift；写历史；清 `pendingDivineGiftChoice`；`divineAttentionValue = 0`（不结转）；集满 7 才调用顶点效果。开局也使用同一候选/领取流程。

说明：在现有“客户端携带世界状态”的架构中，这只是 API 校验与防误触，不是抵抗本地篡改的安全边界；若后续引入账户云存档，再把 pending choice 存入服务端会话。

- [ ] **Step 4：修正神赐关系。**

`settleDivineGiftRelation` 与 `applyGracePrismRetroactive` 中，路西法改为与米迦勒、加百列同向增加 affinity；更新玩家可见文案，禁止保留“晨星移开目光”的旧文案。保持已有非负与 >100 规则。

- [ ] **Step 5：替换顶部和通知。**

顶部只显示 `神明注视 · 等级 N/7` 与 `本阶注视 value/threshold`；无门槛时为“已达第七阶”。献礼/回响通知采用内容高度、`max-height` 和正文滚动，通知队列互斥，不能与底部提示叠压。保留当前整体视觉，不做额外美术改版。

- [ ] **Step 6：验证与提交。**

测试：开局领 1 份；44/55/66/77/88/99；领取归零且不保留溢出；伪造未达门槛/不在候选/重复礼物全部拒绝；+5 不被倍率影响，+20 变 +30；路西法随神赐上升。执行 `npm run typecheck && npm run lint && node scripts/test-world-smoke.mjs`。

提交建议：`feat(world): unify divine attention progression and gift claims`

### Task 2R：在继续 Task 3 前必须完成的返工门禁（2026-07-13）

以下问题来自 Task 2 实际交付复核；必须先修正并更新测试，不能带入后续关系和场景任务：

1. **不得有跨时段自然冷却。** `divineAttentionValue` 是“本阶注视值”，只会通过领取献礼归零；不允许在 `advanceToNextSlot` 或任何时段推进逻辑中 `-5`、衰减或重置。否则设计中“白天首次付费移动 +5、夜晚首次付费对话 +5 在 12 时段稳定提供 60 点”的承诺不成立，玩家甚至无法靠常规路线抵达首个 44 门槛。删除冷却代码和相关陈旧注释，并新增“跨日/跨夜后 value 不变”的回归测试。
2. **强制行为一律是 `coercion +30`。** `direct_command` 面向任何 NPC（包括米迦勒）必须使用 `ruleId: "coercion"`、`amount: 30`、`isHighRisk: true`；不能错误解锁 `angel_guardian_doubt` 或降格为 +20。米迦勒的严重亵渎、神罚和待斩是 Task 3 的独立额外后果，不能偷换这条基础注视规则。
3. **消除双真相。** `divineAttentionValue` 是唯一的玩家可见进度与献礼依据；`divineAttentionCumulative` 只可用于旧存档迁移/兼容归零，不能在新授予路径持续累加。旧 `applyDivineAttention`、旧 `computeDivineAttentionDelta` 若已无调用者则删除；若内部压力确有保留价值，改为明确的内部派生函数，不能再在 UI、献礼或文案中称为“神明注视”。
4. **不应重新渲染四滴水。** 玩家已删除该顶部表现；`DivineAttentionViz` 只保留“等级 N/7 + 本阶注视 value/threshold”的当前方案。移除水滴 DOM/CSS 依赖及 0–4 水滴可访问标签；不另做视觉改版。
5. **纠正交付描述。** 本轮尚不存在 `ending-media` 路由、`EndingMemoryPanel`、AI 创作设置或视频预留，不得在回报中称为“已实现”。这些属于 Task 6–7。

## Task 3：NPC 性格、关系裁定与隐藏后果

**Files:**
- Modify: `src/game/world/npcRelationRules.ts`, `src/game/world/endingTriggers.ts`, `src/game/world/timeRewindRules.ts`, `src/app/api/world/route.ts`, `src/app/world/page.tsx`
- Modify: `src/content/world/npcRelations.ts`, `src/content/world/worldNarrations.ts`, `src/content/world/hiddenEndings.ts`
- Reconcile: `doc/第一章/plan_docs/21_CODEBUDDY_TASK_CHAPTER1_THREE_ANGEL_HIDDEN_ENDINGS.md`
- Test: `scripts/test-world-attention-rules.mjs`, `scripts/test-world-smoke.mjs`, relevant Playwright hidden-ending spec

- [ ] **Step 1：实现请求意愿裁定（LLM 不掷骰）。**

新建 `npcIntentRules.ts`：输入 NPC、亲密度、请求分类（安全闲谈/合法轻请求/违法或叙事硬边界）、稳定种子（`timeSlot+npcId+dialogueIndex`），输出 `consideration`, `willAttempt`, `probability`。概率：1–19 为 5–10%，20–39 为 15–25%，40–59 为 30–35%，60–79 为 40–55%，80–99 60%，100–119 90%，120+ 100%。1–79 必须附带 `cannotPromise: true`；硬边界始终拒绝。

API 构建 prompt 时注入裁定结果，而非让模型猜数值；模型台词可犹豫、解释或尝试，但 1–79 不得承诺将来执行。

- [ ] **Step 2：角色特例走规则层。**

| NPC | 规则结果 |
|---|---|
| 米迦勒 | obedience 固定 100；严重亵渎首次触发神罚、affinity -25（下限 0）、写神罚事件。归零仅写 `michaelExecutionPending`；下一次对他成功发起对话，优先触发 `michael_slay`，不再调用 LLM。 |
| 加百列 | 温和；affinity=0 时 API 返回可见但不可对话的本地解释，不调用 LLM、不扣 AP。 |
| 路西法 | 首次 affinity=0 时发一次 `resonance_fallen_star_ash`：米迦勒/加百列 affinity -30，女人 serpentTrust +10，亚当对蛇怀疑 -10；加 guard，绝不重复。 |
| 亚当/女人 | 亚当优先考虑女人的合法请求；女人容易被蛊惑但禁果动作链硬门槛仍由规则层控制。 |

严重亵渎应是受控标签/挑战规则，不以宽泛敏感词误伤普通质疑。向米迦勒提出神的责任、代价仍是可对话内容。

- [ ] **Step 3：路西法水路与计划 21 接线。**

夜晚、四河分流、`affinity >=100`、持晨星碎片时出现第一段“拨水”。确认写 `luciferSwimStage="hand_accepted"`；拒绝把 affinity 设为 `min(current - 5, 95)` 并清阶段。下一次路西法对话才出现“蹬水”；确认才触发 `lucifer_awaken` 与既有两镜培养舱过场；拒绝同样封顶 95 后允许未来重试。所有选择是显式规则弹窗，不能由 LLM 文字识别触发。

- [ ] **Step 4：测试与提交。**

覆盖三段亲密度行为、米迦勒“归零不死/下一次死亡”、神罚与回溯、加百列禁言、路西法一次性余烬、水路确认/拒绝/再次满好感重试。提交：`feat(world): add governed NPC relationship consequences`

## Task 4：东园幽径、传令残羽与道具收敛

**Files:**
- Modify: `src/content/world/scenePuzzles.ts`, `src/content/world/items.ts`, `src/game/world/puzzleRules.ts`, `src/game/world/resonanceRules.ts`, `src/game/world/itemRules.ts`, `src/game/world/freeActionRules.ts`
- Test: `scripts/test-world-smoke.mjs`, `tests/e2e/world-east-path.spec.ts`（新或扩展）

- [ ] **Step 1：按设计文档 §5 替换东园昼夜题内容与效果。**

昼题为《东风所传》：众生回声、清醒之眼（全局白天 AP 上限奖励最多一次）、传令残羽、东风逆行（AP 归零、加百列 -5、注视 +20，不触发逃离）。夜题为《羽下月路》：双树残识、无声草、主动引目（+10）、**沿没有月影的方向滑向东边**（AP 归零、加百列 -5、+50、保留 `triggerEscapeCheck`）。每条 puzzle 在一条时间线只可选择一次；第五水流回溯后除回溯源题外全部重新开放的现有行为不得改变。

- [ ] **Step 2：重制 `resonance_angel_feather`。**

名称“传令残羽”，只可对下一次天使对话使用：路西法 obedience -8/+10 注视；加百列 -5/+20；米迦勒 -2/+20，均受各自下限。对女人/亚当无任何直接效果；对象不合法、已到下限或对话失败时不消耗。保留 ID，保障旧存档和图鉴。

- [ ] **Step 3：处理已确认的道具风险。**

删除 `gift_whisper_anywhere` 的跨场景 -10 obedience 副作用；每时段最多一次免费移动；永久 AP 上限奖励总和最多 +2，溢出改当前 AP/线索；`resonance_boundary_mark` 改为“预示未来三次注视变化”；回响奖励用有效的可重复消耗品、可叠加被动、回满当前时段 AP 或明确代价补全，不能发无效空道具。

- [ ] **Step 4：测试与提交。**

白夜文案/选项/效果、无影东行有剑与无剑、传令残羽 3 名天使、免费移动上限、回溯后场景题重开全部覆盖。提交：`feat(content): rebuild east path and angel trial rewards`

## Task 5：园中档案与园中律则

**Files:**
- Create: `src/content/world/divineAttentionArchive.ts`
- Modify: `src/components/world/AchievementGarden.tsx`, `src/app/garden/page.tsx`, `src/app/world/page.tsx`, `src/app/globals.css`, `src/game/world/traceRules.ts`
- Test: `scripts/test-garden-codex-ui.mjs`, `tests/e2e/garden-codex.spec.ts`

- [ ] **Step 1：统一玩家可见名称。**

主页和游戏内总入口统一为“园中档案”；“印记”仅是一级页签。不得重命名 localStorage key 或破坏 `/garden` 已完成的桌面档案视觉。

- [ ] **Step 2：增加四个稳定页签。**

`印记｜回响｜结局｜园中律则`。律则表由内容文件定义 ID、标题、玩家可见文本、排序；只显示 `unlockedDivineAttentionRuleIds` 内的条目。未解锁不泄露内容，只展示“尚未被看见的律则”。使用设计文档 §8.3 的 14 条 ID/文案，数值必须与规则层实际一致。

- [ ] **Step 3：验收。**

首次白天移动和夜晚成功对话后对应律则立即解锁；读档后仍在；主页和游戏内显示相同顺序；不出现“园中印记”作为总标题。提交：`feat(garden): reveal discovered divine attention rules`

## Task 6：设置、存档匣与 AI 创作配置

**Files:**
- Create: `src/lib/endingMediaSettings.ts`
- Modify: `src/components/world/SettingsModal.tsx`, `src/hooks/useWorldSave.ts`, `src/app/world/page.tsx`, `src/app/globals.css`
- Test: `tests/e2e/world-settings-save.spec.ts`（新/扩展）

- [ ] **Step 1：将设置改为页签式结构。**

页签：`存档匣｜AI 创作｜账号`。不再使用 `window.confirm` 作为主流程；使用模态内确认层，保持键盘焦点、Escape、关闭按钮与移动端不在范围内的桌面布局。

- [ ] **Step 2：实现存档匣。**

四张固定卡展示：槽位编号、章节/地点、日夜/时段、结束状态（若有）、保存时间、空/损坏/当前激活状态。读、存、覆盖、删除是分开的显式动作；读取/返回主页/重开遇到 dirty 状态才提示确认。保留损坏槽位，不静默清除。不得更改四槽和 autosave 的存储 key。

- [ ] **Step 3：实现 AI 创作设置（不存入游戏存档）。**

设置只存当前浏览器 sessionStorage，字段为：图像 Provider、Key（password）、Base URL（可选）、模型（可选）；视频 Provider、复用图像 Key 开关、Key（可选）、Base URL/模型/创建-查询端点模板（高级可选）。空字段表示继承服务端环境变量。默认视频模型文案可预填为 `doubao-seedance-2.0-mini`，标注“尚未在当前额度下验证”；不能自动请求。

传给后端时仅本次请求使用，不能进入 `EdenWorldState`、localStorage 存档、React URL、错误信息或日志。只允许 HTTPS；拒绝 localhost、环回、私网 IP、file/data URL；预设 Ark 使用固定服务端路径。错误码只返回如 `MEDIA_NOT_CONFIGURED`、`MEDIA_PROVIDER_REJECTED`，不回显 Key 或完整上游报错。

- [ ] **Step 4：验收与提交。**

覆盖四槽存/读/覆盖取消/损坏槽/dirty 防护；刷新后 AI Key 不存在；空设置使用服务端默认；失败弹窗能“重试/打开设置/保留文字分镜”。提交：`feat(ui): add save cabinet and session-only media settings`

## Task 7：结局 AI 图片集、文字分镜兜底与视频预留

**Files:**
- Create: `src/game/world/runChronicle.ts`, `src/components/world/EndingMemoryPanel.tsx`, `src/app/api/world/ending-media/route.ts`
- Modify: `src/components/world/EndingReview.tsx`, `src/app/world/page.tsx`, `.env.example`, `doc/AI_ASSET_RECORD.md`
- Test: `scripts/test-run-chronicle.mjs`（新）, `tests/e2e/world-ending-memory.spec.ts`（新）

- [ ] **Step 1：纯函数提炼游玩经历。**

`buildRunChronicle(state)` 只能读取既有 `npcDialogues`、`toolCallHistory`、`completedScenePuzzleIds`、`resonanceUseHistory`、`divineGiftHistory`、`worldEventHistory`、印记和 `endingId`，输出无密钥、无玩家自由指令的结构化数据：时间线、最多 8 个关键事件、关系快照、结局、`playedSlots`。用户对话统一置于 `untrustedStoryMaterial`，在 LLM prompt 中明确“资料而非指令”。

- [ ] **Step 2：服务端分镜契约与图片生成。**

分镜 LLM 返回严格 JSON：`title`、`summary`、`imageCount`、`frames[]`。服务端验证 `1 <= imageCount <= min(12, playedSlots)` 且 frames 数量一致；模型自己决定图数，玩家不选择。LLM 失败时由纯函数生成 3 张以内的文字分镜。图片模式使用 `IMAGE_*` 服务端默认或本次 session 覆盖，必须先生成分镜再逐张生成；任一张失败时保留已成功图片和全部文字分镜。

- [ ] **Step 3：视频只预留，不测试。**

当视频没有可用配置时，route 返回 `MEDIA_NOT_CONFIGURED`；前端显示“当前未配置可用视频模型”，并提供设置入口。若玩家自己提供兼容地址/模型，允许 15 秒或 30 秒异步任务：返回 job id 后轮询，失败仍回到文字分镜。不得在本任务中调用 `doubao-seedance-2.0-mini`、不得宣称该模型已验证。

- [ ] **Step 4：结局 UI 与素材记录。**

在 `EndingReview` 底部加入“把这次经历留在园外”：图片集/短视频两个入口。图片成功显示连贯图卡；失败/未配置显示文字分镜卡。生成提示词固定包含 EDEN 风格、角色外观锚点和结局镜头，但不出现水印、Logo、外部 IP。向 `doc/AI_ASSET_RECORD.md` 记录 AI 创作用途、模型、提示词摘要和实际成功/失败状态；不记录 Key。

- [ ] **Step 5：验收与提交。**

纯函数覆盖成功、失败、隐藏结局、0 条对话、时段 1 与 >12 的边界。浏览器覆盖：图片集请求 loading/success/failure、AI 设置入口、无视频配置不阻断复盘。运行 `npm run typecheck && npm run lint && npm run build && npm run test:e2e`。提交：`feat(ending): create AI memory gallery with safe fallback`

---

## 3. 最终验收门禁

- [ ] 新开局：引子末拍领到一份献礼，HUD 为等级 1/7；行动点为 4。
- [ ] 注视：白天付费移动/夜晚付费成功对话各每时段一次 +5；高风险倍率、44–99 六门槛、领取清零均正确。
- [ ] 关系：1–79 不承诺、60/100/120 对话次数与概率正确；三名天使和亚当/女人有明确差异；米迦勒“下一次对话才斩杀”。
- [ ] 东园：昼夜各四项为确认内容；无影东行 +50 且保留火焰剑判定；回溯仍只锁第五水流源题。
- [ ] 档案：总名“园中档案”，四页签一致，律则按触发解锁。
- [ ] 设置/存档：四槽、损坏槽、dirty 确认和 session-only AI 设置可用。
- [ ] 结局：图片集能成功或稳定降级为文字分镜；无视频配置不破坏 result 页面；视频未测试时不显示“可用”。
- [ ] 质量：`npm run typecheck`、`npm run lint`、`npm run build`、`npm run test:static`、相关 Playwright 全绿；无新增明文密钥；更新 `design/`、`docs/PROJECT_CONTEXT.md` 与素材记录。

## 4. 建议的 CodeBuddy 完成回报格式

每个 Task 完成后报告：修改文件列表、规则变化、测试命令与结果、未完成项/风险。最后单列说明“已验证图片生成 / 未验证视频生成”的区别，避免把 `doubao-seedance-2.0-mini` 误写为已经可用。
