# CodeBuddy 执行提示词 · 第一章人工测试六项问题修复

把以下整段作为任务提示词投递给 CodeBuddy。CodeBuddy 应先读 `doc/第一章/plan_docs/17_CODEBUDDY_TASK_CHAPTER1_PLAYTEST_SIX_ISSUES_FIX.md` 获取完整定位与方案，再按下文执行。

---

## 角色

你是 EDEN 第一章（Next.js + TypeScript + Tailwind/CSS 文字立绘交互游戏）的资深前端/全栈工程师。本次任务修复人工测试反馈的 6 个问题。改动须最小侵入、不破坏既有玩法（禁忌动作链、回响、天使挑战、言语分裂、七献礼、存档）。先读规划文档 `doc/第一章/plan_docs/17_CODEBUDDY_TASK_CHAPTER1_PLAYTEST_SIX_ISSUES_FIX.md`，再按下方任务逐项实现。每完成一项跑一次 `npm run lint` 与相关 smoke 脚本，最后做整体验收。

## 必读上下文文件

- `src/app/world/page.tsx`（主页面：顶部栏、注视值 UI、立绘舞台、对话面板、输入区）
- `src/components/world/DivineAttentionViz.tsx`（注视值可视化）
- `src/game/world/divineAttentionRules.ts`、`src/game/world/divineGiftRules.ts`（注视值/献礼规则）
- `src/agents/world/worldAgentPrompts.ts`（夏娃/亚当/天使 prompt）
- `src/game/world/worldActions.ts`、`src/game/world/stageSlots.ts`（工具执行、立绘槽位）
- `src/app/api/world/route.ts`（低语后端）
- `src/app/globals.css`（样式）

## 任务清单

### 任务 1 · 顶部设置按钮视觉优化
- 文件：`src/app/world/page.tsx`（约 1830-1838 行设置按钮）、`src/app/globals.css`（`.eden-settings-btn` 约 6800 行、`.eden-sound-btn` 约 302 行）。
- 把按钮内的 `⚙` 文本字符替换为内联 SVG 齿轮（18×18，`stroke=currentColor`，`strokeWidth=1.6`，`linecap/linejoin=round`，含中心圆 + 8 齿轮轮廓 path）。
- `.eden-settings-btn` 增加 `color:#e8d5a3; font-size:1.1rem; line-height:1;`（金色与 `.eden-title` 一致）。SVG 走 `currentColor` 自动金色。
- 确认齿轮在 36px 圆形按钮内水平/垂直居中（`.eden-sound-btn` 已有 flex 居中）。
- 验收：齿轮金色、居中、描边粗细与声音按钮视觉重量接近。

### 任务 2 · 注视值显示与累积机制（3 个 bug）
1. `src/game/world/divineGiftRules.ts`：
   - `DIVINE_GIFT_THRESHOLDS` 改为 `[2, 3, 4, 5, 6, 7]`。
   - `claimDivineGift` 函数末尾 `return` 前加 `state.divineAttentionCumulative = 0;`（领取献礼后注视值归零，不留溢出）。
2. `src/app/world/page.tsx`（约 1747 行 `DivineAttentionViz` 的 `nextThreshold`）：
   - 由 `DIVINE_GIFT_THRESHOLDS[state.divineGiftsOwned.length]` 改为 `DIVINE_GIFT_THRESHOLDS[state.divineGiftsOwned.length - 1] ?? null`，与规则层 `shouldTriggerGiftChoice` 的 `[owned-1]` 下标对齐。
3. `src/components/world/DivineAttentionViz.tsx` + `src/app/globals.css`：
   - 用 `<span className="eden-attention-cluster">` 包裹「水滴 span + 进度条 div」，使二者在 `eden-header-left` 行内同一基线垂直居中。
   - CSS 新增 `.eden-attention-cluster{display:flex;align-items:center;gap:8px;}`；`.eden-attention-progress` 改 `display:flex;align-items:center;gap:6px;margin-top:0;`，进度条 `width:120px;height:5px;`，文字 `white-space:nowrap;`。移动端（`@media` 段，约 6513 行起）同步核对。
- 核查结论（无需改动，仅理解）：`/api/world/tool`（移动/观察/场景互动/结束轮/回响）不调用 `applyDivineAttention`；打开地图/设置为纯前端。仅低语增加注视值，`build_trust` delta=0。「无关行为涨注视值」是 cumulative 不归零的视觉错觉，本任务修复后即消除。
- 验收：移动/观察/开界面不涨注视值；开局后 `0/2`->`2/2`->领奖->`0/3`->…->`0/7`；领奖后归零；水滴/进度条/文字对齐。

### 任务 3 · 亚当关于妻子位置的记忆
- 文件：`src/agents/world/worldAgentPrompts.ts` 的 `buildAdamWorldPrompt`（约 163-236 行）。
- 注入 `const eveLocation = LOCATION_NAMES[state.npcLocations.eve];`，并在 systemPrompt 中加入事实约束：「你的妻子（那个女人）现在在 ${eveLocation}。若蛇问起她在哪里，你据实相告，但用你自己的语气（例如『她刚才往 ${eveLocation} 去了，说是要摘些果子』），不要像在汇报。」
- 不要写死「东边树林」--必须用动态 `state.npcLocations.eve`。
- 顺带检查 `buildEveWorldPrompt` 与天使 prompt 是否对其他角色位置有类似缺口；本任务至少补全亚当。
- 验收：问亚当妻子在哪，回答指向夏娃实际地点，不再说「水边」。

### 任务 4 · 场景中央黑色矩形阴影
- 先 `npm run dev`，在 `/world` 浏览态用浏览器 DevTools 选中中央暗色矩形，确认选择器。
- 候选：`.eden-stage::after`（底部 30% 暗渐变，`globals.css` 约 615）、`.eden-grass-foreground`（底部 12%，约 774）、`.eden-stage::before` 侧边暗角（约 603）、或某角色容器残留 `background`/`box-shadow`。
- 修复原则：去除固定矩形暗色遮罩，无角色时场景完整；角色阴影仅用 `filter: drop-shadow(...)` 作用于 sprite 本身（参考 `.eden-stage-animal` 约 1143）。
- 具体处置：降低候选元素的 `rgba` alpha 或收窄 `height`；角色容器 `background` 保持 `transparent`、移除 `box-shadow`/`border`。
- 验收：浏览场景无中央矩形黑影；立绘出现后自然融入。

### 任务 5 · 对话后不应自动移动 NPC
1. `src/agents/world/worldAgentPrompts.ts`：在 `buildEveWorldPrompt`、`buildAdamWorldPrompt` 及天使 prompt 的工具说明 / JSON 示例中，移除 `move_one_step` 条目（保留 `grant_item`、`speak_to_npc`）。
2. `src/app/api/world/route.ts`（约 747 行解析 `agentResult.toolCall` 处）：兜底过滤——若 `tc.name === "move_one_step"`，不执行，直接忽略（防 prompt 残留）。
3. `src/game/world/stageSlots.ts` 的 `allocateStageSlots`：移除 `activeNpc` 优先重排（删去 `const ordered = activeNpc && characters.includes(activeNpc) ? [activeNpc, ...rest] : rest;` 的 activeNpc 优先），改为按固定稳定顺序分配槽位（天使->刺猬->夏娃->亚当，或按 NPC 固定优先级 + `slotOrder`）。选中态仅由 CSS `.eden-stage-character--active` 体现，不改坐标。
4. 核对刺猬等大尺寸立绘在槽位 `maxWidth` 下不被 `.eden-stage` `overflow:hidden` 裁切；必要时给 sprite 加 `object-fit: contain`。
5. 对话结束后不做位置恢复（因不再移动）。
- 验收：对话前后 NPC 坐标不变；选中仅高亮不位移；立绘不被裁切。

### 任务 6 · 随处低语完整实现 + 对话面板精简
1. 跨场景低语对象 UI（`src/app/world/page.tsx` 输入区，约 3040-3110）：
   - 当 `state.divineGiftsOwned.includes("gift_whisper_anywhere")` 时，在输入框上方渲染一排「低语对象」列表，候选 = `EDEN_NPCS` 中 `canWhisper===true` 且非 `forbidden_tree`/`tree_of_life` 的全部 NPC（跨所有地点）。当前场景内者优先并标记「在此处」，跨场景者标记「远处」。
   - 点击设置 `activeNpc`（即使不在当前场景）、打开对话框、切到 dialogue Tab。
   - 未持有该献礼时维持现状（仅当前场景 NPC）。
2. 跨场景低语扣敬畏（`src/app/api/world/route.ts` 低语结算内，`applyDivineAttention` 之后、返回前）：
   - 新增 helper `reduceNpcObedience(state, npcId, amount)`（放 `divineAttentionRules.ts`）：eve→`eveMind.obedience`、adam→`adamMind.obedience`、其他→`npcRelations[npc].obedience`，clamp 0-100，返回实际扣除值。
   - 当 `gift_whisper_anywhere` 已拥有且 `state.npcLocations[targetNpc] !== state.locationId`（跨场景）时，调用 `reduceNpcObedience(state, targetNpc, 10)`，每次低语仅扣一次。
   - 可选：把扣除叙事通过 `npcFeedback` 或新字段返回，前端在对话区外提示。
3. 对话 Tab 精简（`src/app/world/page.tsx` 约 2283-2426）：
   - 移除对话 Tab 内 `achievementToast` 渲染，改为独立浮动 toast（参考 `divineGiftToast` 实现，定时消失）。
   - 移除对话 Tab 内 `eden-divine-narration`（`divineNarrationText`，已在顶部 `DivineAttentionViz` 显示）。
   - `slotNarrations` 移出对话 Tab → 顶部提示条或「线索与记录」Tab。
   - 保留：对话历史、`currentReply`、`toolNarration`、`hedgehogNarration`、`npcFeedbackState`、`languagePunishmentState`。
- 验收：持有献礼后可选跨场景 NPC 低语；每次跨场景低语扣目标 10 点敬畏（仅一次）；普通对话仍守场景限制；对话 Tab 不含系统/环境信息。

## 约束与回归

- 不改 `initialEdenWorldState` 的字段结构；新字段若必须加，需在 `normalizePuzzleState` 与 `useWorldSave` 兼容。
- 存档兼容：旧存档 `divineAttentionCumulative` 可能超过新门槛——加载后允许正常弹三选一（可接受），或在加载时 clamp 到 `当前门槛-1`。任选其一并测试。
- 不动 `npcScheduleRules`、`triggerNpcDialogue` 的触发条件逻辑（仅不改 NPC 坐标）。
- `obedience` 不得穿透到负数（clamp 0）。
- 保持中文 UI 文案与既有伊甸园语感一致；不引入现代词。

## 交付

- 改动文件清单 + 每项对应验收点。
- `npm run lint` 通过；运行 `node scripts/test-scene-puzzle-rules.mjs`、`node scripts/test-world-smoke.mjs`、`node scripts/test-world-visual-smoke.mjs` 通过（若脚本涉及被改逻辑，按需更新断言并在交付说明里列出）。
- 简述存档兼容处理方式。
- 自测 6 项验收清单（见规划文档第 8 节）。
