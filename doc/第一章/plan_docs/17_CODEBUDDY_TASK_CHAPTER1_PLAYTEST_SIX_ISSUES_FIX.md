# 17 · 第一章人工测试六项问题修复

> 面向：CodeBuddy / 开发执行
> 范围：第一章 `/world` 人工测试反馈的 6 个问题
> 基线分支：`main`（commit `d2946a5`）
> 文档性质：问题定位 + 修复规划 + 执行提示词

---

## 0. 概述

本文档基于对当前代码的逐行核查，确认 6 项人工测试问题**全部存在**，并给出根因、代码定位与修复方案。所有问题均可在不破坏既有玩法（禁忌动作链、回响、天使挑战、言语分裂、七献礼）的前提下修复。

涉及核心文件：

| 文件 | 关联问题 |
|---|---|
| `src/app/globals.css` | 1、2、4 |
| `src/app/world/page.tsx` | 1、2、4、5、6 |
| `src/components/world/DivineAttentionViz.tsx` | 2 |
| `src/game/world/divineAttentionRules.ts` | 2 |
| `src/game/world/divineGiftRules.ts` | 2 |
| `src/agents/world/worldAgentPrompts.ts` | 3、5 |
| `src/game/world/worldActions.ts` | 5 |
| `src/app/api/world/route.ts` | 5、6 |
| `src/game/world/stageSlots.ts` | 5 |
| `src/game/world/toolRules.ts` | 6（已实现，仅核对） |

---

## 1. 顶部设置按钮视觉需要优化 ✅ 存在

### 1.1 根因

- 设置按钮位于 `src/app/world/page.tsx:1830-1838`，结构为 `<button class="eden-sound-btn eden-settings-btn">⚙</button>`。
- 齿轮用的是文本字符 `⚙`，而非图标。`.eden-sound-btn`（`globals.css:302`）未声明 `color`，`.eden-settings-btn`（`globals.css:6800`）只声明了 `margin-left: 4px`。
- 因此 `⚙` 继承 header 的默认深色，呈现为接近纯黑。而旁边的声音按钮用 emoji `🔊`/`🔇`，emoji 自带颜色，对比之下齿轮显得过暗。
- 尺寸/描边：声音按钮是 emoji，齿轮是字形，二者视觉重量本就不一致。

### 1.2 修复方案

1. 在 `globals.css` 的 `.eden-settings-btn` 增加：
   ```css
   .eden-settings-btn {
     margin-left: 4px;
     color: #e8d5a3;            /* 与 .eden-title 一致的金色 */
     font-size: 1.1rem;
     line-height: 1;
   }
   ```
2. **推荐**：把 `⚙` 字符替换为内联 SVG 齿轮，统一描边粗细与声音图标的视觉重量：
   ```tsx
   <svg className="eden-settings-icon" width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
     <circle cx="12" cy="12" r="3.2" />
     <path d="M19.4 12.9a7.6 7.6 0 0 0 0-1.8l1.9-1.5-1.9-3.3-2.3.9a7.6 7.6 0 0 0-1.6-.9l-.4-2.5H9.9l-.4 2.5a7.6 7.6 0 0 0-1.6.9l-2.3-.9-1.9 3.3 1.9 1.5a7.6 7.6 0 0 0 0 1.8l-1.9 1.5 1.9 3.3 2.3-.9a7.6 7.6 0 0 0 1.6.9l.4 2.5h4.2l.4-2.5a7.6 7.6 0 0 0 1.6-.9l2.3.9 1.9-3.3z" />
   </svg>
   ```
   `strokeWidth=1.6` 与水滴描边（1.4）接近，`color: #e8d5a3` 走 `currentColor`。
3. 居中：`.eden-sound-btn` 已有 `display:flex; align-items:center; justify-content:center`，SVG 即可居中；字形 `⚙` 有基线偏移问题，改 SVG 后自然解决。
4. 视觉重量对齐声音按钮：保持 `width/height: 36px` 圆形容器不变，SVG 18×18 居中。

### 1.3 验收

- 齿轮颜色为金色，与声音按钮、地图、印记按钮色调一致。
- 齿轮在圆形按钮内水平、垂直居中。
- 描边粗细与声音图标视觉重量接近。

---

## 2. 神明注视值的显示与累积机制异常 ✅ 存在（3 个独立 bug）

### 2.1 根因

#### Bug A：注视值（cumulative）领取献礼后不归零
- `divineAttentionRules.ts:138-155` 的 `applyDivineAttention` 注释写明 `divineAttentionCumulative`「永不归零」。
- `divineGiftRules.ts:129-159` 的 `claimDivineGift` 领取献礼时**未重置** `divineAttentionCumulative`。
- 全局检索 `divineAttentionCumulative = 0` 仅命中初始状态 `types.ts:494`，运行期从不归零。
- 后果：顶部 `注视值：x/y` 只增不减，玩家产生「任何行为都在涨注视值」的错觉。

#### Bug B：UI 读取门槛下标 off-by-one
- 规则层 `shouldTriggerGiftChoice`（`divineGiftRules.ts:120-126`）用 `DIVINE_GIFT_THRESHOLDS[owned - 1]`。
- UI 层 `page.tsx:1747` 用 `DIVINE_GIFT_THRESHOLDS[state.divineGiftsOwned.length]`（即 `[owned]`）。
- 二者不一致：领第 1 次献礼后 `owned=1`，规则下一次门槛取 `[0]`，UI 取 `[1]` → UI 显示 `0/4`，而规则实际在第 2 点就触发 → 显示与实际不符。

#### Bug C：门槛数值与期望不符
- 现状 `DIVINE_GIFT_THRESHOLDS = [2, 4, 6, 8, 10, 12]`（`divineGiftRules.ts:42`），第 3 次门槛为 4，与期望的 3 不符。

#### Bug D：顶部注视值文字、进度条、左侧水滴未对齐
- `DivineAttentionViz.tsx:77-95` 的进度区是 `flex-direction: column; align-items: center`（纵排居中），与左侧水滴（`eden-attention-stage`，行内）并排放在 `eden-header-left`（`globals.css:254`，`flex; align-items:center; gap:14px`）内，高度不一致导致垂直错位。

#### 关于「移动/查看/开界面也增加注视值」的核查结论
- 已确认 `/api/world/tool`（`move_to_location` / `observe_location` / `scene_action` / `end_slot` / `use_resonance`）**不调用** `applyDivineAttention`（`tool/route.ts` 中仅出现 `divineAttentionCumulative` 的状态归一化与 `state.divineAttention` 的只读过滤）。
- 打开地图 / 设置 / 印记浮窗为纯前端状态，无后端调用。
- 仅 `/api/world`（低语）会增加注视值，且 `build_trust`（温和提问/闲聊）的 delta=0（`divineAttentionRules.ts:61-63`）。
- **结论**：「无关行为增加注视值」是 Bug A（cumulative 不归零，数值单调爬升）造成的视觉错觉，修复 Bug A 即消除。

### 2.2 修复方案

1. **Bug A**：在 `claimDivineGift`（`divineGiftRules.ts`）末尾、`return` 前加：
   ```ts
   state.divineAttentionCumulative = 0;
   ```
   领取献礼后当前注视值归零、不留溢出。
2. **Bug B**：`page.tsx:1747` 改为与规则一致的下标：
   ```ts
   nextThreshold={DIVINE_GIFT_THRESHOLDS[state.divineGiftsOwned.length - 1] ?? null}
   ```
   `owned=0` 时 `[−1]` 为 `undefined → ?? null`，进度条不显示（开局由 intro 三选一弹窗处理，符合预期）。
3. **Bug C**：`divineGiftRules.ts:42` 改为（已与产品确认线性 +1）：
   ```ts
   export const DIVINE_GIFT_THRESHOLDS = [2, 3, 4, 5, 6, 7];
   ```
   修复后：开局免费 → 0/2 → 0/3 → 0/4 → 0/5 → 0/6 → 0/7。
4. **Bug D**：把「水滴 + 进度条 + 文字」包进统一簇容器并保证垂直居中。新增/调整 CSS：
   ```css
   .eden-attention-cluster {
     display: flex;
     align-items: center;
     gap: 8px;
   }
   .eden-attention-progress {
     display: flex;
     align-items: center;
     gap: 6px;
     margin-top: 0;            /* 取消原 column 时的 margin-top:6px */
   }
   .eden-attention-progress-bar { width: 120px; height: 5px; }
   .eden-attention-progress-text { white-space: nowrap; }
   ```
   在 `DivineAttentionViz.tsx` 用 `<span className="eden-attention-cluster">` 包裹水滴 span 与 progress div，使二者在 `eden-header-left` 行内同一基线对齐。移动端（`globals.css:6513` 起）同步核对。

### 2.3 验收

- 普通点击、移动、打开界面、观察对象不会让 `注视值：x/y` 上升。
- 开局领第 1 次献礼后顶部显示 `0/2`；累计到 `2/2` 领第 2 次后显示 `0/3`；以此类推至 `0/7`。
- 每次领献礼后当前注视值归零，不保留上一阶段溢出。
- 水滴、进度条、`注视值：x/y` 文字垂直居中对齐，间距统一。

---

## 3. 亚当关于妻子位置的记忆错误 ✅ 存在

### 3.1 根因

- `worldAgentPrompts.ts:163-236` 的 `buildAdamWorldPrompt` 只注入 `adamLocation` 与 `serpentLocation`，**未注入夏娃位置**。
- 被问及「妻子在哪」时，LLM 缺乏事实依据，自行编造（如「往水边去了」）。
- 夏娃的实际位置由 `state.npcLocations.eve` 决定（动态），并非固定「水边」。

### 3.2 修复方案

1. 在 `buildAdamWorldPrompt` 中注入夏娃位置并给出事实约束：
   ```ts
   const eveLocation = LOCATION_NAMES[state.npcLocations.eve];
   // systemPrompt 内追加：
   // 你的妻子（那个女人）现在在${eveLocation}。若蛇问起她在哪里，你据实相告，
   // 但用你自己的语气（例如「她刚才往${eveLocation}去了，说是要摘些果子」），不要像在汇报。
   ```
2. 同步检查 `buildEveWorldPrompt`（已注入 `eveLocation`，无需改）、天使 prompt 是否对其他角色位置有类似缺口；本任务至少补全亚当。
3. 不写死「东边树林」——用动态 `state.npcLocations.eve`，保证与世界状态一致。

### 3.3 验收

- 询问亚当「你妻子在哪」时，回答指向夏娃实际所在地点，而非「水边」。
- NPC 对其他角色位置的描述读取 `state.npcLocations`，不出现旧状态/错误地点。

---

## 4. 场景中央存在不自然的黑色阴影区域 ✅ 存在（需运行时定位元素）

### 4.1 根因

- 静态核查未发现显式的「中央暗色矩形」容器。已排除：
  - `.eden-stage-tree-of-life`（`globals.css:3835`）：空 div，无宽高/背景。
  - `.eden-character-portrait`（`globals.css:1565`）：仅 Chapter 0 `game/page.tsx` 使用，且无背景。
- 最可能候选（均始终渲染于 `eden-stage`）：
  - `.eden-stage::after`（`globals.css:615-623`）：底部 30% 暗渐变带。
  - `.eden-grass-foreground`（`globals.css:774-788`）：底部 12% 暗渐变。
  - `.eden-stage::before`（`globals.css:603-613`）：含侧边暗角 `linear-gradient(90deg, rgba(4,9,6,.2), transparent 30%, rgba(4,9,6,.16))`。
  - 某角色容器的 `background`/`box-shadow`（角色未出现时仍可见）。
- 需在运行时用 DevTools 选中该矩形确认元素。

### 4.2 修复方案

1. **定位**：运行 `npm run dev`，在 `/world` 浏览状态下用 DevTools 元素检查器选中中央暗色矩形，记录其选择器。
2. **通用原则**：
   - 去除固定矩形边界 / 暗色遮罩层，使无角色时场景画面完整。
   - 角色立绘的阴影仅作用于 sprite 本身（`filter: drop-shadow(...)`，参考 `.eden-stage-animal` `globals.css:1143`），不再用容器级 `background`/`box-shadow`。
3. **针对候选的处置**：
   - 若为 `.eden-stage::after` / `.eden-grass-foreground`：降低 `rgba` alpha 或收窄 `height`，使其不形成明显矩形带。
   - 若为角色容器残留：将 `.eden-stage-character` 系列 `background` 保持 `transparent`，移除任何 `box-shadow`/`border`，仅保留 sprite 的 `drop-shadow`。
   - 若为 `.eden-stage::before` 侧边暗角过重：降低两侧 alpha。
4. 无角色或未选中 NPC 时，遮罩不可见；角色立绘出现后自然融入背景。

### 4.3 验收

- 正常浏览场景时看不到明显矩形黑色区域。
- 角色立绘出现后自然融入背景，仅立绘本身有柔和阴影/轮廓。

---

## 5. 与 NPC 对话后不应自动移动 NPC 位置 ✅ 存在

### 5.1 根因

两处独立机制都会导致「对话后 NPC 位置变化」：

1. **真实坐标变化**：NPC Agent（夏娃/亚当/天使）的 prompt（`worldAgentPrompts.ts`）允许返回 `move_one_step` 工具调用；`world/route.ts:747-797` 解析并执行 `agentResult.toolCall`，调用 `executeMoveOneStep`（`worldActions.ts:382-396`，注释明写「NPC 对话后移动一格」），直接修改 `state.npcLocations[caller]`，使 NPC 离开当前场景。
2. **视觉位移**：`allocateStageSlots(currentNpcs, activeNpc)`（`stageSlots.ts:30-53`）把 `activeNpc` 排到首位并占 `center-main` 槽位（`left:42%, bottom:6%`）；取消选中后槽位回退 → 选中/取消时立绘左右跳动。刺猬立绘 1254×1254 较大，槽位位移易导致立绘被 `.eden-stage` 的 `overflow:hidden` 裁切。

### 5.2 修复方案

1. **停止对话后移动 NPC**：从 NPC Agent 的工具能力中移除 `move_one_step`。
   - 在 `worldAgentPrompts.ts` 的 `buildEveWorldPrompt` / `buildAdamWorldPrompt`（及天使 prompt）中，删除工具说明里的 `move_one_step` 条目与 JSON 示例中的对应分支。
   - 兜底：在 `world/route.ts:747` 解析 `agentResult.toolCall` 时，过滤 `tc.name === "move_one_step"`（不执行，直接忽略），防止 prompt 残留导致移动。保留 `grant_item`、`speak_to_npc`。
2. **稳定立绘槽位**：`allocateStageSlots` 不再因 `activeNpc` 重排。
   - 移除 `const ordered = activeNpc && characters.includes(activeNpc) ? [activeNpc, ...rest] : rest;` 的 activeNpc 优先逻辑，改为按固定稳定顺序分配（如按 `STAGE_SLOTS` 顺序 + NPC 固定优先级：天使→刺猬→夏娃→亚当）。
   - 选中态仅由 CSS `.eden-stage-character--active`（金色描边 + 脚光，`globals.css:1091-1126` 已有）体现，不改坐标。
3. **裁切兜底**：核对刺猬等大尺寸立绘在槽位 `maxWidth`（`stageSlots.ts:19`，foreground 槽 `clamp(110px,12vw,160px)`）下的显示；必要时给 sprite 加 `object-fit: contain`，避免超出被隐藏。
4. 对话结束后无需执行位置恢复（因根本不再移动）。

### 5.3 验收

- 对话前后 NPC 场景坐标完全不变（刺猬、夏娃、亚当、天使均如此）。
- 选中对话对象时仅出现描边/高亮，不发生位移。
- 立绘不再被裁切或错误隐藏。

---

## 6. 「神明献礼：随处低语」未完整实现 + 对话面板需精简 ✅ 存在

### 6.1 根因

#### 6.1.1 随处低语功能半成品
- 后端 `toolRules.ts:142-147` 的 `canSpeakToNpc`（NPC 间对话）已对 `gift_whisper_anywhere` 放行跨场景；玩家低语路径 `/api/world` 本就**无同场景校验**（grep `world/route.ts` 无 `sameLocation`/同地点判断）→ 后端已允许跨场景低语。
- 但前端 `page.tsx:882-938` 的 `getVisibleNpcsAtLocation` / `handleSelectNpc` / `handleNpcInteract` 只允许选择**当前场景** NPC → 跨场景选目标 UI 缺失，功能体感未实现。
- 「被低语对象对神明敬畏 −10」**完全未实现**（全仓 grep 无相关逻辑）。

#### 6.1.2 对话 Tab 混入系统信息
- `page.tsx:2283-2426` 的对话 Tab 直接渲染了：
  - `achievementToast`（「解锁印记：初临献礼」，2300-2304）。
  - `divineNarrationText`（「风停了一瞬，鸟鸣顿了一下…」，2286-2288，与顶部 `DivineAttentionViz` 叙事条重复）。
  - `slotNarrations`（时段推进叙事，2291-2297）。

### 6.2 修复方案

#### 6.2.1 跨场景低语对象选择 UI
- 当 `state.divineGiftsOwned.includes("gift_whisper_anywhere")` 时，在底部输入框上方（`eden-input-footer` 内、`eden-input-suggestions` 同级）渲染一排「低语对象」选择列表：
  - 候选 = `EDEN_NPCS` 中 `canWhisper === true` 且非 `forbidden_tree`/`tree_of_life` 的全部 NPC，跨所有地点。
  - 排序：当前场景内 NPC 优先，其余按地点分组或平铺；当前场景内者高亮标记「在此处」，跨场景者标记「远处」。
  - 点击设置 `activeNpc`（即使该 NPC 不在当前场景），打开对话框、切到 dialogue Tab。
- 输入框 placeholder 同步显示当前目标（已有逻辑：`对${activeNpcMeta.name}低语⋯⋯`，保持）。
- 未持有 `gift_whisper_anywhere` 时：维持现状，仅能选当前场景 NPC。

#### 6.2.2 跨场景低语扣除敬畏值
- 在 `/api/world/route.ts` 低语结算中（`applyDivineAttention` 之后、返回响应之前），新增：
  ```ts
  const whisperAnywhereOwned = state.divineGiftsOwned.includes("gift_whisper_anywhere");
  const isCrossScene = state.npcLocations[targetNpc] !== state.locationId;
  let aweReduction = 0;
  if (whisperAnywhereOwned && isCrossScene) {
    aweReduction = reduceNpcObedience(state, targetNpc, 10); // 仅一次/每次低语
  }
  ```
- 新增 helper（建议放 `divineAttentionRules.ts` 或新建 `npcObedienceRules.ts`）：
  ```ts
  export function reduceNpcObedience(state: EdenWorldState, npcId: EdenNpcId, amount: number): number {
    if (npcId === "eve") {
      const before = state.eveMind.obedience;
      state.eveMind.obedience = clampMind(before - amount);
      return before - state.eveMind.obedience;
    }
    if (npcId === "adam") {
      const before = state.adamMind.obedience;
      state.adamMind.obedience = clampMind(before - amount);
      return before - state.adamMind.obedience;
    }
    const rel = state.npcRelations[npcId];
    if (!rel) return 0;
    const before = rel.obedience;
    rel.obedience = Math.max(0, Math.min(100, before - amount));
    return before - rel.obedience;
  }
  ```
- 敬畏值变化只在「跨场景低语」时触发一次，不重复扣除（同一次低语结算只调用一次）。
- 可选：在响应体带回 `aweReduction` 叙事（如「你的声音越过距离落下，${name}对神的敬畏减了几分」），通过 `npcFeedback` 或新字段返回，前端在对话区外提示。

#### 6.2.3 对话 Tab 精简
- 移除对话 Tab 内的 `achievementToast` 渲染（2300-2304），改为独立浮动 toast（参考 `divineGiftToast` / `resonanceGainedToast` 实现，固定在屏幕角落，定时消失）。
- 移除对话 Tab 内的 `eden-divine-narration`（2286-2288）——该叙事已在顶部 `DivineAttentionViz` 的 `narration` 条显示，重复。
- `slotNarrations`（时段推进叙事）移出对话 Tab → 顶部提示条或「线索与记录」Tab。
- 保留在对话 Tab：对话历史、`currentReply`、`toolNarration`（禁忌动作链叙事，属必要叙事）、`hedgehogNarration`、`npcFeedbackState`、`languagePunishmentState`。
- 印记解锁、属性变化、系统提示统一走独立通知 / 顶部提示条 / 线索与记录区。

### 6.3 验收

- 持有 `gift_whisper_anywhere` 后，输入框上方出现全场景可低语对象列表；可选中当前场景外的 NPC 并成功低语。
- 每次跨场景低语准确扣除目标 10 点对神明敬畏，仅扣一次。
- 普通对话（未持有献礼）仍受场景限制，只能选当前场景 NPC。
- 对话 Tab 不再出现「解锁印记：初临献礼」「风停了一瞬…」等系统/环境信息，仅含角色发言与必要叙事。

---

## 7. 任务分解（按文件）

| # | 文件 | 改动 |
|---|---|---|
| T1 | `src/app/globals.css` | `.eden-settings-btn` 加金色 + 尺寸；新增 `.eden-attention-cluster` 与进度条对齐样式；定位并修复中央暗色矩形（问题 4）；移动端同步 |
| T2 | `src/app/world/page.tsx` | 设置按钮换 SVG 齿轮；`nextThreshold` 下标改 `[len-1]`；注视值簇容器包裹；跨场景低语对象选择 UI；对话 Tab 移除系统信息 |
| T3 | `src/components/world/DivineAttentionViz.tsx` | 用 `eden-attention-cluster` 包裹水滴+进度条，对齐 |
| T4 | `src/game/world/divineAttentionRules.ts` | 新增 `reduceNpcObedience` helper |
| T5 | `src/game/world/divineGiftRules.ts` | `DIVINE_GIFT_THRESHOLDS=[2,3,4,5,6,7]`；`claimDivineGift` 重置 `divineAttentionCumulative=0` |
| T6 | `src/agents/world/worldAgentPrompts.ts` | `buildAdamWorldPrompt` 注入夏娃位置；eve/adam/天使 prompt 移除 `move_one_step` 工具说明 |
| T7 | `src/game/world/worldActions.ts` | （可选）`executeMoveOneStep` 保留但不再被对话路径触发 |
| T8 | `src/app/api/world/route.ts` | 过滤 `move_one_step` toolCall 不执行；跨场景低语调用 `reduceNpcObedience(-10)` |
| T9 | `src/game/world/stageSlots.ts` | `allocateStageSlots` 移除 activeNpc 重排，改稳定顺序 |

---

## 8. 验收清单（人工测试重点）

- [ ] 普通 点击、移动、打开界面、观察对象不会让注视值上升。
- [ ] 开局领第 1 次献礼后显示 `0/2`；`2/2` 领第 2 次后显示 `0/3`；后续 `0/4`→`0/7`。
- [ ] 每次领献礼后注视值归零，不保留溢出；UI 立即刷新。
- [ ] 注视值水滴、进度条、文字垂直对齐。
- [ ] 齿轮图标金色、居中、描边与声音图标协调。
- [ ] 询问亚当妻子位置，回答指向夏娃实际地点，非「水边」。
- [ ] 浏览场景时无中央矩形黑影；立绘自然融入。
- [ ] 对话前后 NPC 坐标不变；选中仅高亮不位移；立绘不被裁切。
- [ ] 持有「随处低语」后可选跨场景 NPC 低语；每次跨场景低语扣目标 10 点敬畏（仅一次）。
- [ ] 对话 Tab 不含印记解锁/环境提示等系统信息。

## 9. 回归风险

- **门槛数组改动**会影响存档：旧存档 `divineAttentionCumulative` 可能已超过新门槛 → 加载后若 `shouldTriggerGiftChoice` 立即为真，会立即弹三选一。建议在 `normalizePuzzleState` / 状态加载时若 `cumulative >= 当前门槛` 且未触发，允许正常弹窗（属可接受行为）；或加载时将 `cumulative` clamp 到 `门槛-1`。需测试存档兼容。
- **移除 `move_one_step`**：确认无结局/成就依赖「NPC 对话后移动」逻辑（核查 `npcScheduleRules`、`triggerNpcDialogue` 的地点条件，本任务不改其触发逻辑，仅不改 NPC 坐标）。
- **`allocateStageSlots` 稳定排序**：多 NPC 同屏时可能视觉重叠，需用固定优先级 + 槽位 `slotOrder` 保证分散。
- **跨场景低语敬畏 −10**：确认不与「米迦勒遮蔽」「言语分裂」等既有逻辑冲突；`obedience` 不应穿透到负数（clamp 0）。

---

## 10. 给 CodeBuddy 的执行提示词

见同目录 `17_CODEBUDDY_PROMPT_PLAYTEST_SIX_FIXES.md`（或直接使用下方提示词）。
