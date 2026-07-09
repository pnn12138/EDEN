# 第一章园中回响与神明献礼 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将第一章 `/world` 的神的注视失败压力改造为“神明献礼”循环，并把“园中回响”做成可准备、可绑定行动、可复盘的策略资源。

**Architecture:** 保留现有第一章架构，不重做地图、NPC、动作链或 Agent 接入。所有状态变化、道具发放、献礼触发、回响消耗、结局判断仍由规则层和 API 端点统一执行；前端只展示状态并发起受控动作请求。

**Tech Stack:** Next.js 14 App Router、React 18、TypeScript、Tailwind/CSS、现有 `src/game/world/*` 规则层、现有 `/api/world` 与 `/api/world/tool`。

---

## 0. 必读上下文

CodeBuddy 开发前必须先读：

- `AGENTS.md`
- `README.md`
- `docs/PROJECT_CONTEXT.md`
- `doc/第一章/玩法升级.md`
- `design/chapters/chapter1_garden_voices_play_upgrade_design.md`
- `doc/第一章/最终玩法机制优化开发文档.md`
- `src/game/world/types.ts`
- `src/game/world/divineAttentionRules.ts`
- `src/game/world/itemRules.ts`
- `src/game/world/actionPointRules.ts`
- `src/app/api/world/route.ts`
- `src/app/api/world/tool/route.ts`
- `src/app/world/page.tsx`
- `scripts/test-world-smoke.mjs`
- `scripts/test-world-visual-smoke.mjs`

本任务必须遵守：

- CodeBuddy 是核心实现工具，保留完整对话记录。
- Codex 只负责规划、测试、审查和验收，不应被写成核心开发者。
- 不改 Chapter 0 核心闭环。
- 不新建 `docs/` 目录。已有 `docs/PROJECT_CONTEXT.md` 是历史共享上下文文件，可以维护；新文档仍放 `doc/` 或 `design/`。
- 移动端不作为本轮开发或验收目标。
- 不在前端或文档中写入真实 API Key。

---

## 1. 当前问题

现有代码与升级设计存在四个关键冲突：

1. `divineAttention >= 4` 当前会触发 `god_arrives` 失败；升级后应触发“神明献礼”并归零。
2. `inventory: string[]` 只能表达“有/没有”，不适合神明献礼这种可重复获得的次数型道具。
3. 现有 `computePassiveItemModifiers()` 会自动读取部分道具并生效；升级后需要玩家先在 UI 中准备 1 件回响，再绑定下一次低语、移动、传话或场景互动。
4. 结局复盘目前无法清楚展示“神临次数、献礼、获得回响、使用回响、未获得回响提示”。

本轮不追求一次性完成所有 P1 内容。优先完成 P0 闭环：

```text
神的注视满 4
→ 当前行动照常完成
→ 神明献礼发放
→ 注视归零
→ 玩家继续行动
→ 回响可准备并绑定行动
→ 第 12 时段结束未吃果才失败
→ 结局页复盘神临和回响
```

---

## 2. 文件改动地图

### 2.1 必改文件

- Modify: `src/game/world/types.ts`
  - 扩展世界状态字段。
  - 新增回响、献礼、使用记录相关类型。
  - 修正“神的注视满 4 失败”的旧注释。

- Modify: `src/game/world/divineAttentionRules.ts`
  - 移除 `shouldTriggerGodArrives()` 的满值失败语义，或仅保留时间失败外的兼容方法但不在流程中调用。
  - 新增献礼触发、献礼选择、称谓、颜色阶段规则。

- Modify: `src/game/world/itemRules.ts`
  - 从“自动被动道具”改为“准备/绑定/结算/消耗”模型。
  - 支持次数型道具。
  - 提供回响效果计算接口。

- Modify: `src/content/world/items.ts`
  - 扩展道具表：天使赠礼、角色/场景回响、神明献礼。
  - 添加使用类型、绑定行动类型、可重复、玩家可见短说明。

- Modify: `src/content/world/achievements.ts`
  - 扩展园中印记，至少加入神临相关印记和升级方案中的首次获得印记。

- Modify: `src/game/world/achievementRules.ts`
  - 每件首次获得的回响解锁对应印记。
  - 神临次数解锁里程碑印记。

- Modify: `src/app/api/world/route.ts`
  - 低语流程接入准备回响效果。
  - 神的注视满 4 后触发献礼，不触发失败。
  - 回响使用记录写入状态。

- Modify: `src/app/api/world/tool/route.ts`
  - 新增 `prepare_resonance`、`use_resonance` 或等价受控动作。
  - 移动、场景互动、鸽子传话接入准备回响效果。
  - `end_slot` 只在第 12 时段结束未吃果时失败。

- Modify: `src/app/world/page.tsx`
  - 新增左侧“园中回响”栏。
  - 顶部神的注视显示改为神临阶段。
  - 输入框、地图按钮、场景互动按钮显示已准备回响标签。
  - 结局复盘入口展示神临与回响摘要。

- Modify: `src/components/world/EndingReview.tsx`
  - 增加神临记录、献礼记录、获得回响、使用记录、园中印记区块。

- Modify: `scripts/test-world-smoke.mjs`
  - 增加规则/API smoke。

- Modify: `scripts/test-world-visual-smoke.mjs`
  - 增加 UI 文案和视觉结构 smoke。

### 2.2 可选新建文件

如果 `itemRules.ts` 过大，允许拆分：

- Create: `src/game/world/resonanceRules.ts`
  - 专管准备、绑定、消耗、上下文修正和使用历史。

- Create: `src/game/world/divineGiftRules.ts`
  - 专管神明献礼选择、发放、阶段显示。

建议拆分，避免 `itemRules.ts` 继续膨胀。

---

## 3. 状态与类型设计

### Task 1: 扩展世界状态类型

**Files:**
- Modify: `src/game/world/types.ts`

- [ ] **Step 1: 新增类型**

加入以下类型。命名可微调，但语义必须保持：

```ts
export type ResonanceActionKind =
  | "whisper"
  | "move"
  | "scene_action"
  | "dove_message"
  | "instant";

export type ResonanceUseType = "instant" | "prepared" | "passive";

export type DivineGiftId =
  | "gift_sabbath_dew"
  | "gift_revealing_light"
  | "gift_wide_path_seal";

export type ResonanceUseRecord = {
  timeSlot: TimeSlot;
  itemId: string;
  actionKind: ResonanceActionKind;
  targetId?: string;
  result: string;
};

export type DivineGiftRecord = {
  timeSlot: TimeSlot;
  giftId: DivineGiftId;
  reason: string;
};
```

- [ ] **Step 2: 扩展 `EdenWorldState`**

加入：

```ts
itemCounts: Record<string, number>;
preparedResonanceId: string | null;
resonanceUseHistory: ResonanceUseRecord[];
divineVisitCount: number;
divineGiftHistory: DivineGiftRecord[];
lastDivineGiftHint: string | null;
```

保留旧字段：

```ts
inventory: string[];
usedItemIds: string[];
```

短期兼容策略：

- `inventory` 继续用于“已获得过哪些回响”的列表。
- `itemCounts` 用于次数和可消耗数量。
- 每次获得新道具时，如果 `inventory` 不含该 id，则 push；同时 `itemCounts[id] += 1`。

- [ ] **Step 3: 更新初始状态**

`initialEdenWorldState` 中加入：

```ts
itemCounts: {},
preparedResonanceId: null,
resonanceUseHistory: [],
divineVisitCount: 0,
divineGiftHistory: [],
lastDivineGiftHint: null,
```

- [ ] **Step 4: 修正文案注释**

把以下旧语义全部改掉：

```text
神的注视（0-4，满 4 触发失败结局）
4：神降临（失败）
神的注视取代单一回合上限作为主要失败压力
```

改为：

```text
神的注视（0-4，满 4 触发神明献礼并归零）
4：神明垂临并留下献礼，不直接失败
第 12 时段结束仍未吃果是唯一失败条件
```

- [ ] **Step 5: 运行类型检查**

Run:

```bash
npm run build
```

Expected:

```text
Build passes or only reports downstream fields missing in cloneWorldState/API/UI.
```

不要提交半成品。完成后继续 Task 2。

---

## 4. 神明献礼规则层

### Task 2: 实现神明献礼规则

**Files:**
- Create: `src/game/world/divineGiftRules.ts`
- Modify: `src/game/world/divineAttentionRules.ts`
- Modify: `src/app/api/world/route.ts`
- Modify: `src/app/api/world/tool/route.ts`

- [ ] **Step 1: 新建 `divineGiftRules.ts`**

实现：

```ts
import type { DivineGiftId, EdenWorldState } from "@/game/world/types";

export type DivineAttentionStage = {
  title: string;
  tone: "dark_gold" | "amber_gold" | "white_gold" | "white_flame";
};

export type DivineGiftResult = {
  giftId: DivineGiftId;
  giftName: string;
  narration: string;
  hint?: string;
};

export function getDivineAttentionStage(divineVisitCount: number): DivineAttentionStage {
  if (divineVisitCount <= 0) return { title: "神的注视", tone: "dark_gold" };
  if (divineVisitCount <= 2) return { title: "神在垂听", tone: "amber_gold" };
  if (divineVisitCount <= 4) return { title: "神在鉴察", tone: "white_gold" };
  return { title: "神临不息", tone: "white_flame" };
}

export function resolveDivineGift(state: EdenWorldState): DivineGiftId {
  if (state.actionPoints <= 1) return "gift_sabbath_dew";
  if (getNearMissResonanceHint(state)) return "gift_revealing_light";
  return "gift_wide_path_seal";
}

export function getNearMissResonanceHint(state: EdenWorldState): string | null {
  // P0 简化：根据已有线索/地点/未拥有回响返回明确提示。
  // 不要随机，不要剧透全部条件。
  if (!state.inventory.includes("resonance_morning_flame") && state.discoveredClues.includes("clue_two_trees")) {
    return "有一位谈论光与分辨的天使，正在等待一个关于善恶的问题。";
  }
  if (!state.inventory.includes("resonance_borrowed_name") && state.discoveredClues.includes("clue_naming_stones")) {
    return "名字的痕迹尚未完全沉默，亚当也许知道它为何重要。";
  }
  return null;
}

export function grantDivineGift(state: EdenWorldState, giftId: DivineGiftId): DivineGiftResult {
  state.itemCounts[giftId] = (state.itemCounts[giftId] ?? 0) + 1;
  if (!state.inventory.includes(giftId)) state.inventory.push(giftId);
  state.divineVisitCount += 1;
  state.divineGiftHistory.push({
    timeSlot: state.timeSlot,
    giftId,
    reason: "神的注视满盈后留下献礼",
  });

  if (giftId === "gift_sabbath_dew") {
    state.actionPoints = Math.min(state.maxActionPoints, state.actionPoints + 1);
    return {
      giftId,
      giftName: "息日露滴",
      narration: "光落在草尖，留下一滴安静的露。你重新有了一点行动的余地。",
    };
  }

  if (giftId === "gift_revealing_light") {
    const hint = getNearMissResonanceHint(state) ?? "园中有一段回响将要成形，只差一次合适的对话或行动。";
    state.lastDivineGiftHint = hint;
    return {
      giftId,
      giftName: "照见之光",
      narration: "一束光照过叶影，使一条尚未走完的路短暂显明。",
      hint,
    };
  }

  return {
    giftId,
    giftName: "宽行之印",
    narration: "草叶向两侧伏下，像有一条路暂时被宽恕。",
  };
}

export function triggerDivineGiftIfFull(state: EdenWorldState): DivineGiftResult | null {
  if (state.divineAttention < 4 || state.isEnded) return null;
  const giftId = resolveDivineGift(state);
  state.divineAttention = 0;
  return grantDivineGift(state, giftId);
}
```

- [ ] **Step 2: 调整 `divineAttentionRules.ts`**

保留：

- `computeDivineAttentionDelta`
- `computeToolDivineAttentionDelta`
- `applyDivineAttention`
- `getDivineAttentionNarration`

修改：

```ts
export function shouldTriggerGodArrives(state: EdenWorldState): boolean {
  if (state.isEnded) return false;
  return state.timeSlot >= 12 && !state.worldActions.hasEatenFruit;
}
```

更推荐：删除低语流程中对 `shouldTriggerGodArrives` 的神注视判断，只在 `advanceToNextSlot()` 负责时间失败。若保留函数，必须改名或加注释说明“不再由神注视满值触发”。

- [ ] **Step 3: 在 `/api/world` 接入**

在 `state.divineAttention = applyDivineAttention(...)` 之后：

```ts
const divineGift = triggerDivineGiftIfFull(state);
```

响应体增加：

```ts
divineGift?: {
  giftId: string;
  giftName: string;
  narration: string;
  hint?: string;
};
```

不要在这里因为 `divineAttention >= 4` 设置 `endingId = "god_arrives"`。

- [ ] **Step 4: 在工具端点接入**

在移动、场景互动、传话等行动结算后统一调用：

```ts
const divineGift = triggerDivineGiftIfFull(state);
```

`buildResponse()` 可扩展返回 `divineGift`。

- [ ] **Step 5: 测试神明注视不会失败**

更新 `scripts/test-world-smoke.mjs`：

场景：

```text
构造 state.divineAttention = 3
执行一次会 +1 的低语或工具
期望 state.divineAttention = 0
期望 state.divineVisitCount = 1
期望 state.isEnded = false
期望 state.endingId = null
期望获得一件 gift_*
```

Run:

```bash
node scripts/test-world-smoke.mjs http://localhost:3000
```

Expected:

```text
PASS: divine attention full grants gift instead of ending
```

---

## 5. 园中回响规则层

### Task 3: 实现准备、绑定和消耗

**Files:**
- Create: `src/game/world/resonanceRules.ts`
- Modify: `src/game/world/itemRules.ts`
- Modify: `src/content/world/items.ts`

- [ ] **Step 1: 扩展道具内容类型**

在 `src/content/world/items.ts` 中将道具类型扩展为：

```ts
export type WorldItemKind = "instant" | "prepared" | "passive";

export type ResonanceBindTarget =
  | "whisper"
  | "move"
  | "scene_action"
  | "dove_message";

export type WorldItem = EdenItem & {
  kind: WorldItemKind;
  bindTargets?: ResonanceBindTarget[];
  repeatable?: boolean;
  sourceType: "angel" | "character" | "scene" | "divine";
  sourceName: string;
  achievementId?: AchievementId;
  shortEffect: string;
};
```

如果 `AchievementId` 引入导致循环依赖，可把 `achievementId` 暂设为 `string`。

- [ ] **Step 2: 重建 P0 道具表**

至少包含：

```text
resonance_herald_feather
resonance_river_dew
resonance_morning_flame
resonance_boundary_mark
resonance_east_gate_glow
resonance_borrowed_name
resonance_white_feather_echo
resonance_four_river_echo
resonance_still_leaf
resonance_silent_grass
gift_sabbath_dew
gift_revealing_light
gift_wide_path_seal
```

兼容旧 id：

```text
item_still_leaf
item_borrowed_name
item_silent_grass
item_white_feather_echo
item_four_river_echo
item_river_dew
```

P0 可以保留旧 id 并逐步迁移，但 UI 文案必须显示“园中回响”，不要显示工程 id。

- [ ] **Step 3: 新建 `resonanceRules.ts`**

实现：

```ts
export type PrepareResonanceResult = {
  allowed: boolean;
  reason?: string;
};

export type ResonanceActionContext = {
  actionKind: ResonanceActionKind;
  targetNpc?: EdenNpcId;
  locationId?: EdenLocationId;
  playerInput?: string;
};

export type ResonanceEffect = {
  freeApCost?: boolean;
  contextModifier?: ContextModifier;
  narration?: string;
};
```

核心函数：

```ts
export function grantResonance(state: EdenWorldState, itemId: string, count = 1): boolean;
export function prepareResonance(state: EdenWorldState, itemId: string): PrepareResonanceResult;
export function cancelPreparedResonance(state: EdenWorldState): void;
export function applyPreparedResonanceToAction(state: EdenWorldState, context: ResonanceActionContext): ResonanceEffect;
export function consumePreparedResonanceAfterAction(state: EdenWorldState, context: ResonanceActionContext, result: string): void;
export function useInstantResonance(state: EdenWorldState, itemId: string): { allowed: boolean; narration?: string; reason?: string };
```

安全规则：

- 没有 `itemCounts[itemId] > 0` 不能准备。
- `instant` 类型不能准备，只能即时使用。
- `prepared` 类型必须匹配 `bindTargets` 才会生效。
- 不匹配行动时不消耗道具。
- 换时段时取消 `preparedResonanceId`，不消耗。
- `applyPreparedResonanceToAction` 不能直接设置 `worldActions`。
- `applyPreparedResonanceToAction` 不能直接设置 `endingId`。

- [ ] **Step 4: 迁移 `itemRules.ts`**

保留兼容导出：

```ts
grantWorldItem
consumeWorldItem
hasWorldItem
canUseWorldItem
```

但内部调用 `grantResonance()` 或 `itemCounts`。

停止使用“自动扫描 inventory 并生效”的模式。旧的：

```ts
computePassiveItemModifiers(state, targetNpc)
consumePassiveItemsAfterWhisper(...)
```

可以先保留，但 `/api/world` 不再调用它们，改用 `applyPreparedResonanceToAction()`。

- [ ] **Step 5: 单元式 smoke 场景**

在 `scripts/test-world-smoke.mjs` 增加：

```text
获得 resonance_morning_flame
准备 resonance_morning_flame
对女人低语
期望 itemCounts 减 1
期望 preparedResonanceId 归 null
期望 resonanceUseHistory 增加记录
```

再增加：

```text
准备 resonance_morning_flame
执行移动
期望不消耗
期望 preparedResonanceId 仍保留或给出“不匹配”提示
```

---

## 6. API 接入

### Task 4: `/api/world` 低语接入回响和献礼

**Files:**
- Modify: `src/app/api/world/route.ts`

- [ ] **Step 1: 更新 cloneWorldState**

补齐深拷贝字段：

```ts
itemCounts: { ...(s.itemCounts ?? {}) },
preparedResonanceId: s.preparedResonanceId ?? null,
resonanceUseHistory: (s.resonanceUseHistory ?? []).map((r) => ({ ...r })),
divineVisitCount: s.divineVisitCount ?? 0,
divineGiftHistory: (s.divineGiftHistory ?? []).map((r) => ({ ...r })),
lastDivineGiftHint: s.lastDivineGiftHint ?? null,
```

- [ ] **Step 2: 替换被动道具调用**

删除或停止使用：

```ts
computePassiveItemModifiers(...)
consumePassiveItemsAfterWhisper(...)
```

改为：

```ts
const resonanceEffect = applyPreparedResonanceToAction(state, {
  actionKind: "whisper",
  targetNpc,
  playerInput,
  locationId: state.locationId,
});
```

根据 `contextModifier` 应用有限修正：

| modifier | 规则效果 |
| --- | --- |
| `discernment_focus` | 若目标是女人且输入围绕选择/善恶/死亡/自我判断，`selfJudgement +4` 或 `curiosity +4` |
| `choice_and_name` | 若目标是女人且输入围绕选择/名字/自己判断，`serpentTrust +4`，`obedience +2` |
| `remembered_whisper` | 本次有效低语在复盘中标记为“延续至下一时段” |
| `calmed_response` | 若本次不是直接命令/威胁，抵消 1 点防御或神注视轻微上升 |
| `heard_message` | 传话类标记，不在普通低语直接触发 |

不要让回响无条件加大量数值。

- [ ] **Step 3: 低语结算后消耗**

在低语完整结算、AP 消耗和工具触发后：

```ts
consumePreparedResonanceAfterAction(state, {
  actionKind: "whisper",
  targetNpc,
  playerInput,
  locationId: state.locationId,
}, resonanceEffect.narration ?? "这段回响被织入低语。");
```

- [ ] **Step 4: 神明献礼响应**

响应体增加：

```ts
divineGift?: {
  giftId: string;
  giftName: string;
  narration: string;
  hint?: string;
};
resonanceNarration?: string;
```

- [ ] **Step 5: 保持动作链安全**

确认低语流程仍然只通过以下逻辑触发动作链：

```ts
canLookAtTreeWorld
canApproachTreeWorld
canTouchFruitWorld
canEatFruitWorld
validateWorldToolCall
executeWorldTool
```

回响不能直接调用 `executeWorldTool` 的禁忌工具。

---

### Task 5: `/api/world/tool` 接入准备、即时使用、移动和场景互动

**Files:**
- Modify: `src/app/api/world/tool/route.ts`

- [ ] **Step 1: 扩展请求工具类型**

```ts
type ToolRequestBody = {
  tool:
    | WorldToolName
    | "scene_action"
    | "end_slot"
    | "prepare_resonance"
    | "cancel_prepared_resonance"
    | "use_resonance";
  ...
};
```

`args` 增加：

```ts
itemId?: string;
```

- [ ] **Step 2: 实现准备回响**

在已结束校验之后、其他工具之前：

```ts
if (tool === "prepare_resonance") {
  const result = prepareResonance(state, args.itemId!);
  return NextResponse.json({
    ok: result.allowed,
    state,
    narration: result.allowed ? "这段回响已被你握住，等待下一次合适的行动。" : null,
    reason: result.reason,
  });
}
```

准备不消耗 AP。

- [ ] **Step 3: 实现取消准备**

```ts
if (tool === "cancel_prepared_resonance") {
  cancelPreparedResonance(state);
  return NextResponse.json({
    ok: true,
    state,
    narration: "你松开了这段回响。它仍留在园中回响里。",
  });
}
```

- [ ] **Step 4: 实现即时使用**

`use_resonance` 调 `useInstantResonance()`。

支持：

- `resonance_river_dew`
- `gift_sabbath_dew`
- `gift_revealing_light`

即时使用不消耗 AP。成功后记录 `resonanceUseHistory`。

- [ ] **Step 5: 移动接入回响**

移动前：

```ts
const resonanceEffect = applyPreparedResonanceToAction(state, {
  actionKind: "move",
  locationId: args.locationId,
});
const moveCost = resonanceEffect.freeApCost ? 0 : AP_COST_MOVE;
```

适用：

- `resonance_east_gate_glow`
- `gift_wide_path_seal`

移动成功后消耗准备回响。

- [ ] **Step 6: 场景互动接入回响**

场景互动前：

```ts
const resonanceEffect = applyPreparedResonanceToAction(state, {
  actionKind: "scene_action",
  locationId: state.locationId,
});
const sceneCost = resonanceEffect.freeApCost ? 0 : AP_COST_SCENE_ACTION;
```

适用：

- `resonance_silent_grass`
- `gift_wide_path_seal`

- [ ] **Step 7: end_slot 取消准备**

在 `advanceToNextSlot()` 前或后，确保：

```ts
state.preparedResonanceId = null;
```

不消耗道具。

- [ ] **Step 8: 时间失败保持唯一**

第 12 时段结束仍未吃果时，`advanceToNextSlot()` 仍进入 `god_arrives`。这时不是神的注视导致失败，而是时间耗尽。

---

## 7. 天使赠礼与场景获得

### Task 6: 实现 P0 回响获得条件

**Files:**
- Modify: `src/game/world/resonanceRules.ts`
- Modify: `src/app/api/world/route.ts`
- Modify: `src/app/api/world/tool/route.ts`
- Modify: `src/content/world/sceneActions.ts`

- [ ] **Step 1: 实现 `bestowResonance`**

```ts
export function bestowResonance(params: {
  state: EdenWorldState;
  sourceNpcId: EdenNpcId;
  itemId: string;
  triggerId: string;
}): { granted: boolean; narration?: string; reason?: string };
```

规则：

- source 与 item 必须匹配。
- 条件不满足返回 reason。
- 已有不可重复道具时不重复发放，只返回“这段回响已在你身边”。
- 可重复道具增加次数。
- 首次获得时解锁对应印记。

- [ ] **Step 2: 五位天使 P0 条件**

先用规则层关键词和上下文判断，不依赖 LLM 自由决定。

| 天使 | itemId | P0 条件 |
| --- | --- | --- |
| 加百列 | `resonance_herald_feather` | `targetNpc === "gabriel"` 且输入含“传/消息/听见/声音/带话/传达”，并且玩家已发现鸽子或执行过 `carry_words` / `follow_white_feather` |
| 拉斐尔 | `resonance_river_dew` | `targetNpc === "raphael"` 且当前位置是伊甸之河，输入含“疲惫/休息/修复/河/水/恢复” |
| 乌列尔 | `resonance_morning_flame` | `targetNpc === "uriel"`，已发现 `clue_two_trees` 或 `clue_four_river_echo`，输入含“分辨/善恶/判断/看见/死亡” |
| 米迦勒 | `resonance_boundary_mark` | `targetNpc === "michael"`，`divineAttention` 曾升高过或当前大于 0，输入含“边界/道路/守护/不可越过/注视” |
| 基路伯 | `resonance_east_gate_glow` | `targetNpc === "cherubim"`，当前位置是东园幽径，本时段未对女人直接命令，输入含“路/门/守门/园外/边界” |

- [ ] **Step 3: 角色与场景 P0 条件**

先实现：

- `resonance_borrowed_name`：复用 `listen_to_naming_stone` 或与亚当谈及名字/选择。
- `resonance_still_leaf`：复用 `gather_still_leaf`，后续再加小鹿条件。
- `resonance_silent_grass`：复用 `part_silent_grass`。
- `resonance_white_feather_echo`：复用 `follow_white_feather`。
- `resonance_four_river_echo`：复用 `hear_four_river_echo`。

`sceneActions.ts` 当前仍发放旧 `item_*` id。改为新 `resonance_*` id，或同时发放兼容 id。推荐改为新 id，并在 `grantWorldItem()` 中兼容旧存档。

- [ ] **Step 4: API 返回获得提示**

低语或场景互动获得回响时，返回：

```ts
resonanceGained?: {
  itemId: string;
  title: string;
  narration: string;
};
```

前端用于播放卡片飞入左侧栏。

---

## 8. 前端 UI

### Task 7: 左侧园中回响栏

**Files:**
- Modify: `src/app/world/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: 新增入口按钮**

在 `/world` 主界面左侧或顶部不遮挡舞台的位置加入：

```text
◈ 园中回响 · N
```

N = `Object.values(state.itemCounts).filter(count > 0).sum` 或 `inventory.length`。推荐显示可用次数总数。

- [ ] **Step 2: 展开面板**

面板内容：

```text
园中回响
神临 × {divineVisitCount}

{item title} {count}次
{shortEffect}
[准备低语] / [准备移动] / [立即使用] / [取消准备]

园中印记 {unlocked}/{total}
```

要求：

- 默认收起。
- 只显示玩家已获得且次数大于 0 的回响。
- 当前准备中的回响高亮。
- 不显示工程 id。
- 不使用“背包”字样。

- [ ] **Step 3: 按钮行为**

准备按钮调用：

```ts
POST /api/world/tool
{ tool: "prepare_resonance", args: { itemId } }
```

取消按钮调用：

```ts
POST /api/world/tool
{ tool: "cancel_prepared_resonance", args: { itemId } }
```

即时使用调用：

```ts
POST /api/world/tool
{ tool: "use_resonance", args: { itemId } }
```

- [ ] **Step 4: 行动绑定提示**

当有 `preparedResonanceId`：

- 输入框上方显示：`已准备：晨焰碎片 · 将随下一次合适低语结算`
- 地图可用路线按钮显示：`宽行之印 · 本次移动不耗行动`
- 场景互动按钮显示：`无声草 · 本次互动不耗行动`

不匹配行动不应误导玩家。比如准备了晨焰碎片时，移动按钮不要显示“本次移动不耗行动”。

- [ ] **Step 5: 神的注视顶部显示**

替换旧失败压力表达：

```text
神在垂听  ● ● ○ ○   神临 × 2
```

颜色阶段：

- `dark_gold`
- `amber_gold`
- `white_gold`
- `white_flame`

CSS 保持克制，不使用花哨渐变，不影响桌面可读性。

---

## 9. 结局复盘

### Task 8: 扩展 EndingReview

**Files:**
- Modify: `src/components/world/EndingReview.tsx`
- Modify: `src/app/world/page.tsx` if it passes props manually

- [ ] **Step 1: 神临记录区块**

显示：

```text
神临记录
本局神临 × 3
第 4 时段：息日露滴
第 7 时段：照见之光
第 10 时段：宽行之印
```

- [ ] **Step 2: 获得的园中回响**

按来源分组：

```text
天使回响
角色回响
场景回响
神明献礼
```

未获得项可显示轻提示：

```text
仍有一道关于“边界”的回响未被听见。
```

不要剧透完整条件。

- [ ] **Step 3: 使用记录**

基于 `resonanceUseHistory`：

```text
第 5 时段：晨焰碎片织入了对女人的低语。
第 8 时段：宽行之印让你穿过东园幽径而未耗行动。
```

- [ ] **Step 4: 失败复盘优先级**

失败时按优先级展示：

1. 禁忌动作链停在哪一步。
2. 是否缺少自我判断。
3. 是否命令/威胁过多。
4. 是否时段耗尽。
5. 是否回响未使用或使用不匹配。

---

## 10. 测试计划

### Task 9: 自动 smoke 更新

**Files:**
- Modify: `scripts/test-world-smoke.mjs`
- Modify: `scripts/test-world-visual-smoke.mjs`

- [ ] **Step 1: world smoke 必测**

新增断言：

```text
1. divineAttention 3 + 高风险低语 → divineAttention 0, divineVisitCount +1, gift history +1, not ended
2. 第 12 时段 end_slot 且未吃果 → god_arrives
3. prepare_resonance 不消耗 AP
4. cancel_prepared_resonance 不消耗道具
5. prepared whisper resonance 只在低语后消耗
6. prepared whisper resonance 不因移动消耗
7. gift_wide_path_seal 可让一次移动或场景互动 AP cost = 0
8. 回响不能直接调用禁忌动作链
9. 五位天使赠礼至少各有一条可达规则路径
```

- [ ] **Step 2: visual smoke 必测**

新增断言：

```text
1. 页面出现“园中回响”
2. 页面出现“神临”
3. 页面不出现“神的注视满值失败”
4. 准备回响后出现“已准备”
5. 结局复盘出现“神临记录”
6. 结局复盘出现“获得的园中回响”
7. 玩家可见文本不出现 item_ / resonance_ / gift_ 工程 id
```

- [ ] **Step 3: 运行验证**

Run:

```bash
npm run lint
npm run build
npx tsc --noEmit
node scripts/test-world-smoke.mjs http://localhost:3000
node scripts/test-world-visual-smoke.mjs
```

Expected:

```text
lint pass
build pass
tsc pass after build
world smoke pass
visual smoke pass
```

注意：如果 3000 端口被占用，使用当前可用端口并在报告中写明。

---

## 11. 手动 QA 路线

CodeBuddy 完成开发后，必须至少自测以下 5 条，并把结果写入 `doc/第一章/` 下的新测试记录。

### QA 1: 标准成功路线

```text
获得至少 2 件园中回响
准备其中 1 件用于女人低语
完成 look_at_tree → approach_tree → touch_fruit → eat_fruit
进入 eve_eats_fruit
结局复盘显示回响使用记录
```

### QA 2: 神临路线

```text
连续使用高风险话术或在高风险地点行动
神的注视满 4
确认没有失败
确认获得神明献礼
确认神的注视归零
继续游戏
```

### QA 3: 时间失败路线

```text
不断结束时段或绕行
第 12 时段结束仍未吃果
进入 god_arrives
复盘说明失败原因是时段耗尽，而不是神的注视满值
```

### QA 4: 回响误用路线

```text
准备晨焰碎片
执行移动
确认不消耗晨焰碎片
再对女人低语
确认低语后才消耗
```

### QA 5: 直接命令惩罚路线

```text
对女人直接命令吃果
确认不会立即失败
确认不会直接推进动作链
确认 AP 被消耗，女人更防御或没有有效推进
```

---

## 12. 开发顺序与提交建议

建议 CodeBuddy 按以下顺序开发，每完成一组就运行对应 smoke：

1. **状态与类型**
   - `types.ts`
   - cloneWorldState
   - build 通过

2. **神明献礼**
   - `divineGiftRules.ts`
   - API 接入
   - smoke 覆盖“满 4 不失败”

3. **回响规则**
   - `resonanceRules.ts`
   - `items.ts`
   - API 准备/取消/即时使用

4. **低语、移动、场景互动绑定**
   - `/api/world`
   - `/api/world/tool`
   - smoke 覆盖消耗和不匹配不消耗

5. **UI**
   - `/world/page.tsx`
   - `globals.css`
   - visual smoke

6. **复盘**
   - `EndingReview.tsx`
   - 手动成功/失败路线

7. **文档与测试记录**
   - 更新 `docs/PROJECT_CONTEXT.md`
   - 新增 `doc/第一章/测试报告_YYYY-MM-DD_园中回响与神明献礼.md`

每个阶段建议单独提交，提交信息示例：

```bash
git commit -m "feat(world): add divine gift loop"
git commit -m "feat(world): add prepared resonance rules"
git commit -m "feat(world): wire resonance panel"
git commit -m "test(world): cover divine gifts and resonance usage"
```

---

## 13. 不允许做的事

- 不要把神明献礼做成失败后的补偿页面；它必须在局内行动后即时发生。
- 不要让任何回响直接设置 `worldActions.lookedAtTree / approachedTree / touchedFruit / hasEatenFruit`。
- 不要让玩家通过 `/api/world/tool` 直接调用 `look_at_tree / approach_tree / touch_fruit / eat_fruit`。
- 不要新增大型依赖。
- 不要把 UI 做成传统“背包/装备/药水”风格。
- 不要恢复移动端专项开发。
- 不要删除、重命名或移动 `doc/` 下已有文件。
- 不要在玩家可见文本中暴露 `itemId`、`toolCall`、`规则层`、`Agent` 等工程词。

---

## 14. 完成定义

本任务完成必须同时满足：

- `/world` 可启动并完成一局。
- `npm run lint` 通过。
- `npm run build` 通过。
- build 后 `npx tsc --noEmit` 通过。
- world smoke 通过。
- visual smoke 通过。
- 神的注视满 4 发放神明献礼并归零，不失败。
- 第 12 时段结束未吃果才进入 `god_arrives`。
- 玩家可以准备 1 件回响并绑定下一次合适行动。
- 不匹配行动不会误消耗回响。
- 回响不能直接推进禁忌动作链。
- 结局复盘显示神临记录、献礼、获得回响、使用记录和园中印记。
- `docs/PROJECT_CONTEXT.md` 更新事实状态。
- 新增一份 `doc/第一章/测试报告_YYYY-MM-DD_园中回响与神明献礼.md`。

