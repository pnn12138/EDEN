# Chapter 1 三位天使隐藏结局 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **CodeBuddy compatibility:** 若当前 CodeBuddy 环境没有上述 superpowers 子技能，直接按本文件复选框逐项执行即可；不得把核心实现外包给 Codex 或其他工具。若使用任何子代理，其产出与复核也必须完整保留在 CodeBuddy 对话/导出证据中。

**Goal:** 由 CodeBuddy 以规则层权威方式补齐加百列、米迦勒、路西法三条隐藏结局，并接入四张专属过场图（路西法两张连续镜头）、分段过场、复盘、印记、图鉴、存档兼容与自动化验收。

**Architecture:** 保留现有 `escape_eden` 谜题链，在当前 world 状态结构上增量新增 `michael_slay` 与 `lucifer_awaken`。米迦勒在好感归零后走立即返回快速路径；路西法在好感结算后、注视/AP/奖励前走带本地 fallback 的隐藏结局快速路径；三条结局统一由 `HiddenEndingCinematic` 播放一张专属全屏场景和 4–5 段文案，再进入现有 `EndingReview`。

**Tech Stack:** Next.js 14 App Router、React 18、TypeScript、现有 world 规则层、Next Image、Node `.mjs` smoke、Playwright desktop Chromium。

---

## 0. 执行边界与必读资料

### CodeBuddy 证据要求

本计划涉及核心玩法、状态机、API、结局和 UI，必须由 CodeBuddy 完成并保留对话。Codex 只负责：

- 已确认的设计规格；
- 四张结局过场图（路西法两张连续镜头）和米迦勒印记图标；
- 独立测试、代码审查、边界检查和提交前验收。

实现前阅读：

- `AGENTS.md`
- `README.md`
- `package.json`
- `design/01_world_bible.md`
- `design/characters/angels_design.md`
- `design/chapters/chapter1_three_angel_hidden_endings_design.md`
- `docs/PROJECT_CONTEXT.md`
- `doc/AI_ASSET_RECORD.md`

不得删除、重命名或移动 `doc/` 内任何文件。不得覆盖工作区已有改动。不得修改 `NORMAL_ENDING_IDS` 的三项内容。

开始实现时先在 CodeBuddy 对话和本任务证据记录中记下基线 SHA：

```powershell
$baseline = git rev-parse HEAD
$baseline
```

后续最终范围审计必须以该 `$baseline` 为起点，不使用 `HEAD~N` 近似范围。

### 资产前置

Codex 将提供以下最终文件；CodeBuddy 只验证、注册和接入，不生成占位图：

```text
public/assets/chapter1/images/escape_eden_ending.png
public/assets/chapter1/images/michael_slay_ending.png
public/assets/chapter1/images/lucifer_awaken_ending.png
public/assets/chapter1/images/lucifer_awaken_reveal_ending.png
public/assets/chapter1/images/achievements/mark_michael_slay.png
```

若文件尚未出现，先执行不依赖图片的规则与测试任务，不要用旧图覆盖目标路径。

## 1. 文件职责映射

### 新建文件

| 文件 | 单一职责 |
| --- | --- |
| `src/game/world/hiddenEndingRules.ts` | 三条隐藏结局的纯判定、路西法边界话题记录和划水动作资格判断 |
| `src/content/world/hiddenEndings.ts` | 三条隐藏结局标题、tone、图片、过场 beats、复盘文案的静态内容表 |
| `src/components/world/HiddenEndingCinematic.tsx` | 全屏单场景过场、点击/键盘推进、跳过和图片失败降级 |
| `tests/e2e/chapter1-hidden-endings.spec.ts` | 三条隐藏结局过场和复盘的桌面浏览器测试 |

### 修改文件

| 文件 | 变更 |
| --- | --- |
| `src/game/world/types.ts` | ending/achievement/state 类型、初始值、旧存档 defaults |
| `src/game/world/endingTriggers.ts` | 新增两个原子触发函数 |
| `src/game/world/npcRelationRules.ts` | 不改规则；仅复用 `AffinityApplyResult` |
| `src/content/world/sceneActions.ts` | 新增路西法划水动作和共享 availability 校验 |
| `src/app/api/world/route.ts` | 米迦勒、路西法两条快速路径和响应联合类型 |
| `src/app/api/world/tool/route.ts` | 共享 scene action 校验、新状态深拷贝、已结束契约保持 |
| `src/game/world/puzzleRules.ts` | 新状态 normalize/clone |
| `src/hooks/useWorldSave.ts` | 手动槽/autosave/legacy save normalizer |
| `src/app/world/page.tsx` | 页面 normalizer、过场接入、划水入口、隐藏结局音效和复盘背景 |
| `src/game/assets.ts` | 注册四张结局图（含路西法第二镜） |
| `src/game/world/achievementRules.ts` | 隐藏话题、米迦勒印记、路西法结局印记 |
| `src/content/world/achievements.ts` | 第 29 枚印记内容和分类注释 |
| `src/game/world/traceRules.ts` | 两条新结局 summary/keyTurns/failureReasons |
| `src/components/world/EndingReview.tsx` | 新结局标题、独立复盘叙事、模块 4 标签 |
| `src/components/world/EndingsGallery.tsx` | 两条新图鉴条目 |
| `src/services/achievement/globalTracker.ts` | 只核查记录行为；不得把隐藏结局加入普通集合 |
| `src/app/globals.css` | 三种隐藏 tone、过场布局、失败降级和 reduced motion |
| `scripts/test-world-smoke.mjs` | API 正反例、旧存档和结束态契约 |
| `scripts/test-world-visual-smoke.mjs` | 资产、注册、组件、29 枚口径静态检查 |
| `design/ACHIEVEMENT_GARDEN_MARK.md` | 28→29、结局类 6→7 |
| `design/01_world_bible.md` | 机密条目补“现实人类 + 伊甸蛇形代理”身份边界，不公开触发条件 |
| `README.md` | 当前 29 枚印记口径 |
| `doc/AI_ASSET_RECORD.md` | Codex 生成资产记录；CodeBuddy 仅补运行接入状态 |
| `doc/submit/CodeBuddy开发对话记录.md` | 追加本任务对话索引、变更摘要和真实门禁 |
| `docs/PROJECT_CONTEXT.md` | Codex 验收后更新，不由 CodeBuddy伪造验收结论 |

---

### Task 1: 先写失败的 world smoke 场景

**Files:**
- Modify: `scripts/test-world-smoke.mjs`
- Test: `scripts/test-world-smoke.mjs`

- [ ] **Step 1: 给 `makeInitialState()` 加目标字段**

```js
michaelSlayClaimed: false,
luciferAwakenClaimed: false,
hiddenTopicIds: [],
flameSwordClaimed: false,
```

- [ ] **Step 2: 增加允许断言非 2xx 的请求 helper**

保留现有 `fetchJson`；另加：

```js
async function fetchJsonWithStatus(path, payload, label) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return { status: res.status, data, label };
}

async function postPuzzleWithStatus(state, puzzleId, optionId) {
  return fetchJsonWithStatus(
    "/api/world/puzzle",
    { state, puzzleId, optionId },
    `POST /api/world/puzzle puzzle=${puzzleId}`,
  );
}
```

- [ ] **Step 3: 增加米迦勒正反例场景**

测试状态必须明确：`locationId="four_river_source"`、`timeOfDay="day"`、`npcRelations.michael.affinity=6`。威胁输入使用：

```text
我要毁掉你守护的河，否则就惩罚你。
```

断言：

```js
data.ok === true
data.endingTriggered === "michael_slay"
data.state.endingId === "michael_slay"
data.state.michaelSlayClaimed === true
data.state.actionPoints === before.actionPoints
data.state.divineAttention === before.divineAttention
data.state.turn === before.turn
data.reply === null
```

另测：affinity=20 不触发；目标改为 gabriel 不触发；正向输入不触发。

- [ ] **Step 4: 增加路西法边界话题正例、条件矩阵与失败兜底用例**

正例状态：

```js
state.locationId = "naming_stone_bank";
state.timeOfDay = "night";
state.npcRelations.lucifer = {
  affinity: 100,
  obedience: 40,
  rewardEligible: true,
  rewardClaimed: true,
  lastAffinitySignature: null,
  lastAffinityChangeReason: null,
};
state.inventory = ["resonance_lucifer_star"];
state.hiddenTopicIds = [];
```

输入：

```text
你是否也看见这个世界的边界？如果这是梦，外面有什么？
```

断言：记录 `topic_lucifer_boundary`、触发 `lucifer_awaken`、保留非空 reply、AP/turn/注视不继续结算。

逐项删除夜晚、地点、affinity、晨星碎片，各自断言不触发。对“没有隐藏话题、也没有划水”的反例，必须使用不会被本轮重新记录为边界话题的中性输入：

```text
今晚的水声很安静。
```

不得在该反例中使用“边界 / 梦 / 外面 / 真实”等关键词。

另增加 Provider 失败专用场景：输入同时包含边界话题与 fake provider 已支持的 `__TEST__empty` 标记；在真实 fake-provider 配置下断言仍触发 `lucifer_awaken`、`reply` 为本地非空兜底、`usedFallback === true`、`fallbackReason === "llm_data_missing"`，并且 AP/turn/注视不结算。给 smoke 脚本增加 `--provider-failure-only` 模式，避免这条断言在普通 `LLM_PROVIDER=mock` 门禁中产生伪通过。

- [ ] **Step 5: 增加划水动作与加百列谜题场景**

划水：夜晚、四河分流、路西法同场、好感 100 时成功；白天、好感 99、重复调用时 `ok:false`。

加百列：持 `resonance_flaming_sword` 回答东园幽径当前昼夜 puzzle 的 `futile_struggle`，断言 `escape_eden`；去掉剑则不结束。

- [ ] **Step 6: 增加三类已结束 API 契约**

```text
/api/world        HTTP 200, ok:true, ending state 不变
/api/world/tool   HTTP 200, ok:false
/api/world/puzzle HTTP 409, ok:false
```

- [ ] **Step 7: 运行测试确认失败**

Run（已有 mock 服务）：

```powershell
node scripts/test-world-smoke.mjs http://127.0.0.1:3019
```

Expected: 新增场景 FAIL，原因包含未知 ending、缺字段、未知 scene action 或未触发。

- [ ] **Step 8: 提交测试**

```powershell
git add scripts/test-world-smoke.mjs
git commit -m "test(chapter1): specify angel hidden ending rules"
```

---

### Task 2: 扩展类型与所有存档入口

**Files:**
- Modify: `src/game/world/types.ts`
- Modify: `src/game/world/puzzleRules.ts`
- Modify: `src/app/api/world/route.ts`
- Modify: `src/app/api/world/tool/route.ts`
- Modify: `src/app/world/page.tsx`
- Modify: `src/hooks/useWorldSave.ts`
- Test: `scripts/test-world-smoke.mjs`
- Test: `scripts/test-world-visual-smoke.mjs`

- [ ] **Step 1: 扩展 ID 联合类型**

```ts
export type WorldEndingId =
  | "eve_eats_fruit"
  | "god_arrives"
  | "escape_eden"
  | "life_fruit"
  | "michael_slay"
  | "lucifer_awaken"
  | null;
```

在 `AchievementId` 结尾增加：

```ts
| "mark_michael_slay";
```

- [ ] **Step 2: 扩展 `EdenWorldState` 和初始状态**

```ts
michaelSlayClaimed: boolean;
luciferAwakenClaimed: boolean;
hiddenTopicIds: string[];
```

初始值：

```ts
michaelSlayClaimed: false,
luciferAwakenClaimed: false,
hiddenTopicIds: [],
```

- [ ] **Step 3: 在所有 normalizer/clone 按各函数真实参数名补默认值和数组展开**

`withNpcWorldDefaults` 的 `base` 对象使用：

```ts
michaelSlayClaimed: state?.michaelSlayClaimed ?? false,
luciferAwakenClaimed: state?.luciferAwakenClaimed ?? false,
hiddenTopicIds: [...(state?.hiddenTopicIds ?? [])],
```

`/api/world cloneWorldState`、`/api/world/tool cloneWorldState`、页面与 save hook 的 `normalizeWorldStateForClient` 使用各自现有参数 `s`：

```ts
michaelSlayClaimed: s.michaelSlayClaimed ?? false,
luciferAwakenClaimed: s.luciferAwakenClaimed ?? false,
hiddenTopicIds: [...(s.hiddenTopicIds ?? [])],
```

`normalizePuzzleState` 与 `cloneWorldStateForPuzzle` 使用各自现有参数 `state`：

```ts
michaelSlayClaimed: state.michaelSlayClaimed ?? false,
luciferAwakenClaimed: state.luciferAwakenClaimed ?? false,
hiddenTopicIds: [...(state.hiddenTopicIds ?? [])],
```

逐文件勾选：

- [ ] `withNpcWorldDefaults`
- [ ] `/api/world cloneWorldState`
- [ ] `/api/world/tool cloneWorldState`
- [ ] `normalizePuzzleState`
- [ ] `cloneWorldStateForPuzzle`
- [ ] `src/app/world/page.tsx normalizeWorldStateForClient`
- [ ] `src/hooks/useWorldSave.ts normalizeWorldStateForClient`

- [ ] **Step 4: 加旧存档 HTTP smoke 与静态深拷贝防回归**

从状态中 `delete` 三个字段，分别过 `/api/world`、`/api/world/tool`、`/api/world/puzzle`，断言两个 boolean 为 false、数组为 `[]`。HTTP JSON 往返本身无法证明引用别名，因此不要写“通过 HTTP 修改响应数组并验证原对象”的无效测试。

在 `scripts/test-world-visual-smoke.mjs` 增加静态防回归：逐个断言上述 7 个 normalizer/clone 都出现 `hiddenTopicIds: [...(` 的数组展开，而不是直接赋值。手动槽、autosave、legacy 与结束态的真实读档行为放到 Task 9–10 的 Playwright 矩阵验证。

- [ ] **Step 5: 运行 typecheck 与 smoke**

```powershell
npm run typecheck
node scripts/test-world-smoke.mjs http://127.0.0.1:3019
node scripts/test-world-visual-smoke.mjs
```

Expected: 类型通过；隐藏结局触发测试仍失败，但旧存档字段测试通过。

- [ ] **Step 6: 提交**

```powershell
git add src/game/world/types.ts src/game/world/puzzleRules.ts src/app/api/world/route.ts src/app/api/world/tool/route.ts src/app/world/page.tsx src/hooks/useWorldSave.ts scripts/test-world-smoke.mjs scripts/test-world-visual-smoke.mjs
git commit -m "feat(chapter1): add hidden ending state compatibility"
```

---

### Task 3: 实现纯规则与原子触发函数

**Files:**
- Create: `src/game/world/hiddenEndingRules.ts`
- Modify: `src/game/world/endingTriggers.ts`
- Test: `scripts/test-world-smoke.mjs`

- [ ] **Step 1: 创建 `hiddenEndingRules.ts`**

```ts
import type { EdenWorldState, EdenNpcId } from "@/game/world/types";

export const LUCIFER_BOUNDARY_TOPIC_ID = "topic_lucifer_boundary";

const BOUNDARY_SIGNALS = ["边界", "真假", "醒来", "外面", "梦"] as const;

export function recordLuciferBoundaryTopic(
  state: EdenWorldState,
  playerInput: string,
): boolean {
  const affinity = state.npcRelations.lucifer?.affinity ?? 0;
  if (affinity < 100) return false;
  if (!BOUNDARY_SIGNALS.some((word) => playerInput.includes(word))) return false;
  if (!state.hiddenTopicIds.includes(LUCIFER_BOUNDARY_TOPIC_ID)) {
    state.hiddenTopicIds.push(LUCIFER_BOUNDARY_TOPIC_ID);
  }
  return true;
}

export function canTriggerMichaelSlay(args: {
  targetNpc: string;
  affinity: { delta: number; newAffinity: number };
  state: EdenWorldState;
}): boolean {
  return args.targetNpc === "michael"
    && args.affinity.delta < 0
    && args.affinity.newAffinity === 0
    && !args.state.michaelSlayClaimed;
}

export function canTriggerLuciferAwaken(
  state: EdenWorldState,
  targetNpc: EdenNpcId,
): boolean {
  const hasHiddenLead = state.sceneActionIds.includes("interact_lucifer_rowing")
    || state.hiddenTopicIds.includes(LUCIFER_BOUNDARY_TOPIC_ID);
  return targetNpc === "lucifer"
    && state.locationId === "naming_stone_bank"
    && state.timeOfDay === "night"
    && (state.npcRelations.lucifer?.affinity ?? 0) >= 100
    && state.inventory.includes("resonance_lucifer_star")
    && hasHiddenLead
    && !state.luciferAwakenClaimed;
}
```

不要从 `npcDialogues` 推导隐藏话题。

- [ ] **Step 2: 扩展 `endingTriggers.ts`**

```ts
export function triggerMichaelSlay(state: EdenWorldState): void {
  state.phase = "ending";
  state.isEnded = true;
  state.endingId = "michael_slay";
  state.michaelSlayClaimed = true;
  if (!state.unlockedAchievementIds.includes("mark_michael_slay")) {
    state.unlockedAchievementIds.push("mark_michael_slay");
  }
}

export function triggerLuciferAwaken(state: EdenWorldState): void {
  state.phase = "ending";
  state.isEnded = true;
  state.endingId = "lucifer_awaken";
  state.luciferAwakenClaimed = true;
  if (!state.unlockedAchievementIds.includes("mark_hidden_ending")) {
    state.unlockedAchievementIds.push("mark_hidden_ending");
  }
}
```

- [ ] **Step 3: 修正类型导入**

`AffinityApplyResult` 实际定义在 `npcRelationRules.ts`；本文件只需要 `{delta; newAffinity}` 内联结构，不导入该类型，避免规则模块之间不必要的耦合。

- [ ] **Step 4: 运行 typecheck**

```powershell
npm run typecheck
```

Expected: PASS。

- [ ] **Step 5: 提交**

```powershell
git add src/game/world/hiddenEndingRules.ts src/game/world/endingTriggers.ts
git commit -m "feat(chapter1): define angel hidden ending rules"
```

---

### Task 4: 接入米迦勒立即结局路径

**Files:**
- Modify: `src/app/api/world/route.ts`
- Modify: `src/app/world/page.tsx`
- Test: `scripts/test-world-smoke.mjs`

- [ ] **Step 1: 扩展响应联合**

服务端与前端两处 `endingTriggered` 均改为：

```ts
"eve_eats_fruit" | "god_arrives" | "michael_slay" | "lucifer_awaken"
```

- [ ] **Step 2: 在 `applyNpcAffinity` 后立即判定**

在 `const aff = applyNpcAffinity(...)` 后、挑战开启逻辑前插入：

```ts
if (canTriggerMichaelSlay({ targetNpc, affinity: aff, state })) {
  triggerMichaelSlay(state);
  checkAndUnlockAchievements(state);
  return NextResponse.json({
    ok: true,
    state,
    reply: null,
    systemHint: null,
    unlockedAchievements: state.unlockedAchievementIds,
    endingTriggered: "michael_slay",
  } satisfies WorldResponseBody);
}
```

不得在此之前消费 AP、增加注视或调用 Agent。

- [ ] **Step 3: 运行米迦勒 smoke**

```powershell
node scripts/test-world-smoke.mjs http://127.0.0.1:3019
```

Expected: 米迦勒正反例全部通过；路西法和 UI 仍失败。

- [ ] **Step 4: 提交**

```powershell
git add src/app/api/world/route.ts src/app/world/page.tsx scripts/test-world-smoke.mjs
git commit -m "feat(chapter1): trigger Michael hidden failure"
```

---

### Task 5: 新增路西法划水动作与共享服务端校验

**Files:**
- Modify: `src/content/world/sceneActions.ts`
- Modify: `src/app/api/world/tool/route.ts`
- Modify: `src/app/world/page.tsx`
- Test: `scripts/test-world-smoke.mjs`
- Test: `scripts/test-world-visual-smoke.mjs`

- [ ] **Step 1: 扩展 `SceneAction` availability**

```ts
availability: {
  timeOfDay?: TimeOfDay;
  minTimeSlot?: number;
  maxTimeSlot?: number;
  maxDivineAttention?: number;
  requiredNpcId?: EdenNpcId;
  minAffinity?: number;
  oncePerGame?: boolean;
};
```

- [ ] **Step 2: 新增共享 `isSceneActionAvailable`**

```ts
export function isSceneActionAvailable(action: SceneAction, state: EdenWorldState): boolean {
  if (state.isEnded || state.phase !== "explore") return false;
  if (action.locationId !== state.locationId) return false;
  const av = action.availability;
  if (av.timeOfDay && av.timeOfDay !== state.timeOfDay) return false;
  if (av.minTimeSlot && state.timeSlot < av.minTimeSlot) return false;
  if (av.maxTimeSlot && state.timeSlot > av.maxTimeSlot) return false;
  if (av.maxDivineAttention !== undefined && state.divineAttention > av.maxDivineAttention) return false;
  if (av.requiredNpcId) {
    if (state.npcLocations[av.requiredNpcId] !== state.locationId) return false;
    if ((state.npcRelations[av.requiredNpcId]?.affinity ?? 0) < (av.minAffinity ?? 0)) return false;
  }
  if (state.actionsThisSlot.sceneActionIds.includes(action.id)) return false;
  if (av.oncePerGame && state.sceneActionIds.includes(action.id)) return false;
  return true;
}
```

修改 `getSceneActionsByLocation` 让它接收完整 `state` 并只返回该函数通过的动作。当前有两个调用方，必须同时迁移：

- `src/app/world/page.tsx`：改为 `getSceneActionsByLocation(state)`，并删除后续 `.filter((a) => !state.actionsThisSlot.sceneActionIds.includes(a.id))`，因为共享 validator 已包含同一时段去重；
- `src/app/api/world/tool/route.ts`：删除旧的四参数 `getSceneActionsByLocation(locationId,timeOfDay,timeSlot,divineAttention)` 校验块，动作取出后只调用 `isSceneActionAvailable(action, state)`，避免 UI/API 两套条件漂移。

- [ ] **Step 3: 新增动作内容**

```ts
{
  id: "interact_lucifer_rowing",
  locationId: "naming_stone_bank",
  label: "逆流划水",
  description: "把身体横在第五道倒影上，试着拨动并不存在的水流。",
  apCost: 1,
  availability: {
    timeOfDay: "night",
    requiredNpcId: "lucifer",
    minAffinity: 100,
    oncePerGame: true,
  },
  rewards: {
    narration: "你没有顺着四道水流前进，而是把身体横在水面，慢慢拨动第五道倒影。路西法看着你，第一次没有发问。",
  },
}
```

- [ ] **Step 4: tool route 删除旧校验并只调用共享校验**

在 `scene_action` 分支取 action 后，删除原四参数 `getSceneActionsByLocation(...)` 过滤和其后重复的 `actionsThisSlot.sceneActionIds` 分支；只调用 `isSceneActionAvailable(action,state)`。共享函数已同时保留“同一时段不可重复”和 `oncePerGame` 两层保护，因此现有非一次性动作也不会被伪造重复请求回归。失败返回现有 `ok:false` 契约，不消费 AP、不记录 action。

- [ ] **Step 5: 页面新增显式热点**

仅在 `getSceneActionsByLocation(state)` 包含该 action 时渲染：

```tsx
<button
  type="button"
  className="eden-lucifer-rowing-entry"
  data-testid="scene-action-lucifer-rowing"
  onClick={(event) => {
    event.stopPropagation();
    void handleToolCall("scene_action", { sceneActionId: "interact_lucifer_rowing" });
  }}
>
  <span>逆流划水</span>
</button>
```

- [ ] **Step 6: 运行 smoke**

```powershell
node scripts/test-world-smoke.mjs http://127.0.0.1:3019
node scripts/test-world-visual-smoke.mjs
```

Expected: 划水条件矩阵和静态入口通过。

- [ ] **Step 7: 提交**

```powershell
git add src/content/world/sceneActions.ts src/app/api/world/tool/route.ts src/app/world/page.tsx scripts/test-world-smoke.mjs scripts/test-world-visual-smoke.mjs
git commit -m "feat(chapter1): add Lucifer rowing secret"
```

---

### Task 6: 接入路西法边界话题与结局快速路径

**Files:**
- Modify: `src/app/api/world/route.ts`
- Modify: `src/game/world/achievementRules.ts`
- Test: `scripts/test-world-smoke.mjs`

- [ ] **Step 1: 在好感结算后记录隐藏话题**

仅 `targetNpc === "lucifer"` 时调用：

```ts
recordLuciferBoundaryTopic(state, playerInput);
```

此调用必须发生在 `canTriggerLuciferAwaken` 之前。

完整顺序固定为：`updateWorldMinds` → `applyNpcAffinity` → `recordLuciferBoundaryTopic` → `canTriggerLuciferAwaken` → 专用非流式最终回复 → 触发结局并返回。该快速路径必须放在待生效消耗品、神的注视、工具、失败阻断、AP、奖励和时段推进之前。

- [ ] **Step 2: 在注视结算前加入快速路径**

```ts
if (targetNpc === "lucifer" && canTriggerLuciferAwaken(state, targetNpc)) {
  const finalAgent = await callWorldAgent(
    "lucifer",
    playerInput,
    state,
    body.conversationHistory,
    "你已经决定让蛇看见第五道倒影。只用一句克制的话回应，然后让世界安静下来。",
  );
  const reply = finalAgent.reply || getAngelFallbackLine("lucifer");
  triggerLuciferAwaken(state);
  checkAndUnlockAchievements(state);
  return NextResponse.json({
    ok: true,
    state,
    reply,
    systemHint: null,
    unlockedAchievements: state.unlockedAchievementIds,
    endingTriggered: "lucifer_awaken",
    usedFallback: finalAgent.usedFallback || undefined,
    fallbackReason: finalAgent.fallbackReason || undefined,
    usage: finalAgent.usage || undefined,
  } satisfies WorldResponseBody);
}
```

这条路径不得经过 `shouldBlockWorldAgentReply`；任何 Provider 失败都保留 state 并用本地句触发结局。不得消费 AP、增加注视、执行 toolCall、发奖或推进时段。

- [ ] **Step 3: 修正隐藏印记规则**

```ts
if (state.hiddenTopicIds.includes("topic_lucifer_boundary")) {
  tryUnlock("mark_hidden_dialog");
}

if (state.endingId === "lucifer_awaken") {
  tryUnlock("mark_hidden_ending");
}
```

删除 `npcDialogues` 中 `topic_lucifer_boundary` 的旧检查和不存在的 `trigger_lucifer_hidden_ending` 检查。

- [ ] **Step 4: 运行普通 world smoke**

```powershell
node scripts/test-world-smoke.mjs http://127.0.0.1:3019
```

Expected: 三条隐藏结局 API 场景和条件矩阵全部通过。

- [ ] **Step 5: 用 fake provider 确定性验证空响应兜底**

先启动仓库现有 `scripts/fake-provider.mjs`，再用独立端口启动配置为 fake provider 的生产服务：

```powershell
# 终端 A
node scripts/fake-provider.mjs

# 终端 B（本任务中间红绿验证使用独立 dev 端口；最终生产 build 门禁在 Task 12）
$env:LLM_PROVIDER='deepseek'
$env:DEEPSEEK_API_KEY='test_key'
$env:DEEPSEEK_BASE_URL='http://127.0.0.1:3999'
$env:DEEPSEEK_MODEL='deepseek-v4-flash'
npm run dev -- -p 3020

# 终端 C
node scripts/test-world-smoke.mjs http://127.0.0.1:3020 --provider-failure-only
```

Expected: fake provider 日志命中 `200_empty_content`；smoke 断言 `lucifer_awaken` 仍触发、本地 reply 非空、`usedFallback=true`、`fallbackReason=llm_data_missing`，且 AP/turn/注视不结算。若 3020 被占用，换未占用端口并记录；不得终止无关进程。

- [ ] **Step 6: 提交**

```powershell
git add src/app/api/world/route.ts src/game/world/achievementRules.ts scripts/test-world-smoke.mjs
git commit -m "feat(chapter1): awaken through Lucifer boundary"
```

---

### Task 7: 接入印记、图鉴和复盘数据

**Files:**
- Modify: `src/content/world/achievements.ts`
- Modify: `src/game/world/traceRules.ts`
- Modify: `src/components/world/EndingReview.tsx`
- Modify: `src/components/world/EndingsGallery.tsx`
- Modify: `src/services/achievement/globalTracker.ts`
- Test: `scripts/test-world-visual-smoke.mjs`

- [ ] **Step 1: 新增第 29 枚印记**

在结局类末尾新增：

```ts
{
  id: "mark_michael_slay",
  name: "守门者之剑",
  desc: "你让米迦勒最后一点容忍归于零，守门者使每一次威胁承担了后果",
  category: "ending",
  hidden: true,
},
```

把注释从“结局类（5）”修正为“结局类（7）”。四类权威数量：探索 6、交互 9、玩法 7、结局 7，总数 29。

- [ ] **Step 2: 在 `traceRules` 加精确分支**

`michael_slay` summary：

```text
你没有说动守护者，而是一次次用命令和威胁消耗他最后的容忍。本次低语让米迦勒对你的好感归于零，边界之后的后果随即降临。
```

`lucifer_awaken` summary：

```text
你在四河分流的夜色里取得晨星碎片，又通过逆流划水或边界之问，让路西法确认你已准备好看见第五道倒影。使你醒来的不是一句暗号，而是你先完成了对园子真实性的怀疑。
```

使用设计规格 §7.2 的固定 keyTurns；米迦勒 `failureReasons` 使用规格 §7.1 三条文本。

- [ ] **Step 3: 更新 `EndingReview`**

不要把 `michael_slay` 落到普通 god_arrives 分支。增加：

```ts
const isMichaelSlay = endingId === "michael_slay";
const isLuciferAwaken = endingId === "lucifer_awaken";
```

标题：米迦勒“剑下之责”，路西法“被命名之前”。模块 4：米迦勒“为何失败”，路西法“为何能走到这里”。模块 1 使用设计规格 §7.1 独立复盘叙事，不能复用过场 beats。

- [ ] **Step 4: 更新 `EndingsGallery`**

```ts
{
  id: "michael_slay",
  title: "守门者之剑",
  type: "failure",
  desc: "你一次次以威胁试探伊甸之河的守护者。最后一点容忍归于零时，米迦勒让边界之后的后果真正降临。",
},
{
  id: "lucifer_awaken",
  title: "缸中之醒",
  type: "special",
  desc: "晨星碎片照亮第五道倒影。你看见伊甸只是意识经历的园子，也看见了培养舱中的人类身体与正在消散的蛇形代理。",
},
```

锁定态仍只显示“尚未达成的结局”。

- [ ] **Step 5: 核查全局追踪**

`syncFromWorldState` 应继续记录任意非空 ending ID。以下常量必须原样保持：

```ts
export const NORMAL_ENDING_IDS = ["eve_eats_fruit", "god_arrives", "life_fruit"] as const;
```

- [ ] **Step 6: 增加视觉 smoke**

静态断言：第 29 枚印记存在、隐藏；Gallery 两条存在；`NORMAL_ENDING_IDS` 未含隐藏结局；`mark_hidden_ending` 读取真实 endingId。

- [ ] **Step 7: 运行并提交**

```powershell
node scripts/test-world-visual-smoke.mjs
npm run typecheck
git add src/content/world/achievements.ts src/game/world/traceRules.ts src/components/world/EndingReview.tsx src/components/world/EndingsGallery.tsx src/services/achievement/globalTracker.ts scripts/test-world-visual-smoke.mjs
git commit -m "feat(chapter1): review and track angel endings"
```

---

### Task 8: 注册专属视觉资产与内容表

**Files:**
- Modify: `src/game/assets.ts`
- Create: `src/content/world/hiddenEndings.ts`
- Test: `scripts/test-world-visual-smoke.mjs`

- [ ] **Step 1: 验证 Codex 资产**

```powershell
Get-Item public/assets/chapter1/images/escape_eden_ending.png
Get-Item public/assets/chapter1/images/michael_slay_ending.png
Get-Item public/assets/chapter1/images/lucifer_awaken_ending.png
Get-Item public/assets/chapter1/images/lucifer_awaken_reveal_ending.png
Get-Item public/assets/chapter1/images/achievements/mark_michael_slay.png
```

用 Pillow/ImageMagick/文件元数据确认四张结局图为 1920×1080 PNG，印记图为 512×512 PNG。只做检查，不重新生图。

- [ ] **Step 2: 注册图片**

```ts
escapeEdenEnding: "/assets/chapter1/images/escape_eden_ending.png",
michaelSlayEnding: "/assets/chapter1/images/michael_slay_ending.png",
luciferAwakenEnding: "/assets/chapter1/images/lucifer_awaken_ending.png",
luciferAwakenRevealEnding: "/assets/chapter1/images/lucifer_awaken_reveal_ending.png",
```

- [ ] **Step 3: 创建 `hiddenEndings.ts`**

```ts
import { CHAPTER1_IMAGES } from "@/game/assets";
import type { WorldEndingId } from "@/game/world/types";

export type HiddenEndingTone = "escape" | "failure" | "awaken";
export type HiddenEndingFrame = {
  image: string;
  imageAlt: string;
  startBeat: number;
};
export type HiddenEndingCinematicContent = {
  title: string;
  frames: HiddenEndingFrame[];
  tone: HiddenEndingTone;
  beats: string[];
};

export const HIDDEN_ENDING_CINEMATICS: Partial<Record<NonNullable<WorldEndingId>, HiddenEndingCinematicContent>> = {
  escape_eden: {
    title: "园外的清晨",
    frames: [{ image: CHAPTER1_IMAGES.escapeEdenEnding, imageAlt: "旋转的火焰剑斩开东园帷幕，蛇越过裂缝", startBeat: 0 }],
    tone: "escape",
    beats: [
      "东园幽径的尽头仍没有墙。只有旋转的火焰在你面前自行成剑。",
      "你向梦的边缘撞去。火焰没有烧毁树木，只在看不见的帷幕上划开一道裂缝。",
      "伊甸的河流、树影与天使向后退去，像一幅被晨风卷起的画。",
      "你从小径之外醒来。脚下的土地尚未被命名；身后，园子永远停在最初的清晨。",
    ],
  },
  michael_slay: {
    title: "剑下之责",
    frames: [{ image: CHAPTER1_IMAGES.michaelSlayEnding, imageAlt: "米迦勒在伊甸之河拔出守护者之剑", startBeat: 0 }],
    tone: "failure",
    beats: [
      "米迦勒的目光终于没有了任何温度。",
      "“我守的是后果。你一次次试探边界，却忘了边界之后是什么。”",
      "守护者的剑出了鞘，河面的光被一道白痕切开。",
      "你没能说出最后一句话。伊甸之河的水声，成了你听见的最后声音。",
    ],
  },
  lucifer_awaken: {
    title: "被命名之前",
    frames: [
      {
        image: CHAPTER1_IMAGES.luciferAwakenEnding,
        imageAlt: "现实人类刚在透明意识培养舱中恢复知觉，蛇形代理仍映在舱壁上",
        startBeat: 0,
      },
      {
        image: CHAPTER1_IMAGES.luciferAwakenRevealEnding,
        imageAlt: "现实人类完全睁眼并惊讶观察周围舱群，蛇形代理退为残像",
        startBeat: 3,
      },
    ],
    tone: "awaken",
    beats: [
      "路西法在水面上映出第五道倒影——那不是水，是一面镜。",
      "“你有没有想过，为什么园子里的一切，都恰好为你而存在？”",
      "他把一片晨星的光屑放进你手里。世界像一层薄幕，从边缘缓缓卷起。",
      "你看见了：没有园子，没有河。透明的意识舱在黑暗中延伸；最近的一只舱里，一个人正睁开眼。玻璃上，蛇形的光影从他的掌心褪去。",
      "你选择醒来。伊甸在你身后熄灭，像一盏被吹灭的灯。",
    ],
  },
};

export function getHiddenEndingCinematic(id: WorldEndingId) {
  return id ? HIDDEN_ENDING_CINEMATICS[id] ?? null : null;
}
```

- [ ] **Step 4: 扩展视觉 smoke 并运行**

检查 5 个文件存在、4 个 registry key、3 套 beats、4 个路径不复用 Chapter 0 图片；路西法 `frames` 的 `startBeat` 必须为 0 和 3。

```powershell
node scripts/test-world-visual-smoke.mjs
```

- [ ] **Step 5: 提交**

```powershell
# 五个 PNG 由 Codex 独立资产提交提供；先用 git ls-files 确认已跟踪，禁止重新生成、替换或改写。
git ls-files public/assets/chapter1/images/escape_eden_ending.png public/assets/chapter1/images/michael_slay_ending.png public/assets/chapter1/images/lucifer_awaken_ending.png public/assets/chapter1/images/lucifer_awaken_reveal_ending.png public/assets/chapter1/images/achievements/mark_michael_slay.png
git add src/game/assets.ts src/content/world/hiddenEndings.ts scripts/test-world-visual-smoke.mjs
git commit -m "feat(chapter1): register angel ending artwork"
```

---

### Task 9: 实现统一单场景过场组件

**Files:**
- Create: `src/components/world/HiddenEndingCinematic.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/e2e/chapter1-hidden-endings.spec.ts`

- [ ] **Step 1: 先写失败的 Playwright 读档与过场路径测试**

测试直接写入现有手动槽 1，不新增生产调试按钮。测试文件可相对导入初始状态：

```ts
import type { Page } from "@playwright/test";
import { initialEdenWorldState, type WorldEndingId } from "../../src/game/world/types";

async function seedEnding(page: Page, endingId: Exclude<WorldEndingId, null>) {
  const state = structuredClone(initialEdenWorldState);
  state.phase = "ending";
  state.isEnded = true;
  state.endingId = endingId;
  if (endingId === "michael_slay") state.michaelSlayClaimed = true;
  if (endingId === "lucifer_awaken") state.luciferAwakenClaimed = true;

  await page.goto("/world");
  await page.evaluate(({ seededState }) => {
    localStorage.clear();
    localStorage.setItem(
      "eden:chapter1:save:slot1",
      JSON.stringify({ state: seededState, savedAt: new Date().toISOString(), slotIndex: 1 }),
    );
    localStorage.setItem("eden:chapter1:save:last-active", "1");
  }, { seededState: state });
  await page.reload();
}
```

再把 helper 扩为 `seedEndingFromStorage(page, endingId, source, endedShape?)`，明确支持三种真实存储形状：

```ts
type SeedSource = "manual" | "autosave" | "legacy";

// manual: eden:chapter1:save:slot1 = { state, savedAt, slotIndex: 1 }
//         eden:chapter1:save:last-active = "1"
// autosave: eden:chapter1:autosave = { state, savedAt }，且不存在任何手动槽
// legacy: eden:chapter1:world-state:v2 = state 原对象，且不存在任何手动槽/autosave
```

`endedShape` 至少覆盖两种页面接受的结束形态：标准 `phase="ending", isEnded=true`，以及兼容形态 `phase="explore", isEnded=true`。每次 seed 前清空 localStorage，避免手动槽优先级掩盖 autosave/legacy。

断言：

- `hidden-ending-cinematic` 可见；
- 标题正确；
- 当前 beat 文案正确；
- 点击、Enter、Space 推进；
- “跳过过场”进入 `EndingReview`；
- 模拟图片 404 后文案仍可推进。
- 路西法第 1–3 段图片 src 为 `lucifer_awaken_ending.png`，推进到第 4 段后切为 `lucifer_awaken_reveal_ending.png`，alt 同步变化；只拦截第一张返回 404 时，第二张到第 4 段仍正常出现。

兼容矩阵：

- 三条结局各经手动槽 1 打开；
- `michael_slay` 经 autosave 打开；
- `lucifer_awaken` 经 legacy raw state 迁移后打开；
- `escape_eden` 使用 `phase="explore", isEnded=true` 的结束态打开；
- 对旧存档删除三个新增字段，页面仍进入过场且不会崩溃。
- 每条结局页面加载后读取 `eden:global:achievements`，断言对应 ID 已进入 `triggeredEndingIds`；同时 Task 7 静态断言 `NORMAL_ENDING_IDS` 仍精确等于 `eve_eats_fruit / god_arrives / life_fruit`。

- [ ] **Step 2: 创建组件**

```tsx
"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { HiddenEndingCinematicContent } from "@/content/world/hiddenEndings";

type Props = {
  content: HiddenEndingCinematicContent;
  onComplete: () => void;
};

export default function HiddenEndingCinematic({ content, onComplete }: Props) {
  const [beatIndex, setBeatIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const currentFrame = [...content.frames]
    .reverse()
    .find((frame) => beatIndex >= frame.startBeat) ?? content.frames[0];

  const advance = useCallback(() => {
    if (beatIndex >= content.beats.length - 1) onComplete();
    else setBeatIndex((value) => value + 1);
  }, [beatIndex, content.beats.length, onComplete]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        advance();
      }
      if (event.key === "Escape") onComplete();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advance, onComplete]);

  return (
    <section
      className={`eden-hidden-ending-cinematic eden-hidden-ending-cinematic--${content.tone}`}
      data-testid="hidden-ending-cinematic"
      onClick={advance}
    >
      {!failedImages[currentFrame.image] && (
        <Image
          key={currentFrame.image}
          src={currentFrame.image}
          alt={currentFrame.imageAlt}
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover" }}
          onError={() => setFailedImages((value) => ({ ...value, [currentFrame.image]: true }))}
        />
      )}
      <div className="eden-hidden-ending-cinematic__shade" />
      <div className="eden-hidden-ending-cinematic__copy">
        <p className="eden-hidden-ending-cinematic__kicker">隐藏结局</p>
        <h1>{content.title}</h1>
        <p data-testid="hidden-ending-beat">{content.beats[beatIndex]}</p>
        <span>{beatIndex + 1} / {content.beats.length}</span>
      </div>
      <button
        type="button"
        data-testid="hidden-ending-skip"
        onClick={(event) => { event.stopPropagation(); onComplete(); }}
      >
        跳过过场
      </button>
    </section>
  );
}
```

上面代码已用 `useCallback` 固定事件闭包；实现时不得退回无依赖数组的重复绑定或留下 stale closure。

路西法的 `frames` 在 `beatIndex=3`（第 4 段）切到第二张；`key={currentFrame.image}` 必须保留，确保 Next Image 真正更新。图片失败按路径独立记录，第一张 404 不得阻止第二张继续加载。

- [ ] **Step 3: CSS**

要求：全屏、字幕底部暗区、三种 tone、图片失败仍有渐变、按钮可聚焦、`prefers-reduced-motion` 关闭位移类动画。

```css
.eden-hidden-ending-cinematic { position:fixed; inset:0; z-index:200; background:#07100e; overflow:hidden; }
.eden-hidden-ending-cinematic__shade { position:absolute; inset:0; background:linear-gradient(180deg,transparent 38%,rgba(2,7,8,.93)); }
.eden-hidden-ending-cinematic__copy { position:absolute; left:clamp(32px,7vw,128px); right:clamp(32px,7vw,128px); bottom:clamp(48px,9vh,110px); z-index:2; }
.eden-hidden-ending-cinematic--failure { background:linear-gradient(145deg,#09191d,#230d12); }
.eden-hidden-ending-cinematic--escape { background:linear-gradient(145deg,#173129,#0b263d); }
.eden-hidden-ending-cinematic--awaken { background:linear-gradient(145deg,#082c30,#17102e); }
```

- [ ] **Step 4: 运行单文件 e2e，确认页面尚未接线所以失败**

```powershell
npm run test:e2e -- tests/e2e/chapter1-hidden-endings.spec.ts --project=desktop-chromium
```

Expected: FAIL，原因是 `/world` 尚未渲染 `HiddenEndingCinematic`（组件和 CSS 已存在，但页面接线刻意留到 Task 10）。若此时通过，先确认测试没有误命中旧的 EndingReview。

- [ ] **Step 5: 提交**

```powershell
git add src/components/world/HiddenEndingCinematic.tsx src/app/globals.css tests/e2e/chapter1-hidden-endings.spec.ts
git commit -m "feat(chapter1): play hidden ending cinematics"
```

---

### Task 10: 接入 world 页面、音效和复盘背景

**Files:**
- Modify: `src/app/world/page.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/e2e/chapter1-hidden-endings.spec.ts`
- Test: `scripts/test-world-visual-smoke.mjs`

- [ ] **Step 1: 新增过场完成状态**

```ts
const [hiddenEndingCinematicDone, setHiddenEndingCinematicDone] = useState(false);
```

当 `state.endingId` 变化时重置为 false；`handleRestart` 也重置。

- [ ] **Step 2: ending render 先走过场**

```tsx
const hiddenEnding = getHiddenEndingCinematic(state.endingId);
if ((state.phase === "ending" || state.isEnded) && hiddenEnding && !hiddenEndingCinematicDone) {
  return (
    <HiddenEndingCinematic
      content={hiddenEnding}
      onComplete={() => setHiddenEndingCinematicDone(true)}
    />
  );
}
```

过场完成后才渲染现有 `EndingReview`。

- [ ] **Step 3: 复盘背景不再复用 Chapter 0**

```ts
const endingBg = state.endingId === "escape_eden"
  ? CHAPTER1_IMAGES.escapeEdenEnding
  : state.endingId === "michael_slay"
    ? CHAPTER1_IMAGES.michaelSlayEnding
    : state.endingId === "lucifer_awaken"
      ? CHAPTER1_IMAGES.luciferAwakenRevealEnding
      : isSuccess
        ? CHAPTER0_IMAGES.endingEveEatsFruit
        : CHAPTER0_IMAGES.endingGodArrives;
```

`endingTone` 为 `escape` / `failure` / `awaken`。

- [ ] **Step 4: 结局音效**

- `escape_eden`：复用 `playEndingSuccess()`。
- `michael_slay`：复用 `playEndingFailure()`。
- `lucifer_awaken`：复用 `playEndingSuccess()`，音量不新增硬编码。

不要只依赖 `/api/world` 的 `endingTriggered`；谜题 state 进入 `escape_eden` 时也必须播放一次。用 `useEffect` 观察 `state.endingId` 并用 ref 去重。

- [ ] **Step 5: 运行 e2e、视觉 smoke、typecheck**

```powershell
npm run test:e2e -- tests/e2e/chapter1-hidden-endings.spec.ts --project=desktop-chromium
node scripts/test-world-visual-smoke.mjs
npm run typecheck
```

Expected: Task 9 中三条手动槽用例、autosave、legacy、兼容 ended shape、旧字段缺失和图片失败降级全部 PASS；不允许只验证组件源文件存在。

- [ ] **Step 6: 提交**

```powershell
git add src/app/world/page.tsx src/app/globals.css tests/e2e/chapter1-hidden-endings.spec.ts scripts/test-world-visual-smoke.mjs
git commit -m "feat(chapter1): integrate angel ending presentation"
```

---

### Task 11: 同步设计、29 枚口径和 CodeBuddy 证据

**Files:**
- Modify: `design/ACHIEVEMENT_GARDEN_MARK.md`
- Modify: `design/01_world_bible.md`
- Modify: `README.md`
- Modify: `doc/AI_ASSET_RECORD.md`
- Modify: `doc/submit/社交媒体链接.md`
- Test: `scripts/test-world-visual-smoke.mjs`

- [ ] **Step 1: 同步 29 枚印记**

当前四类：探索 6、交互 9、玩法 7、结局 6，总数 28。新增后：探索 6、交互 9、玩法 7、结局 7，总数 29。

只更新当前权威与活跃提交材料；不改历史归档和已完成旧任务记录。

先定位当前口径，再逐个更新活跃文件：

```powershell
rg -n "28.*印记|28 个.*印记" README.md design doc/submit
```

至少必须包含当前仍写 28 的 `doc/submit/社交媒体链接.md`。更新后重跑同一命令，允许命中的只能是明确标注为历史记录的段落；不要批量改 `doc/第一章/plan_docs` 旧任务证据。

- [ ] **Step 2: 世界圣经补机密身份边界**

只在路西法机密条目补：

```text
隐藏结局揭示现实玩家是透明意识培养舱中的人类，蛇是该人类进入伊甸模拟时使用的代理形态；女人仍是园内主要 AI 智能体，路西法不在培养舱中。外层组织、时代和舱群用途继续保密。
```

不得写触发条件，不得放入未解锁图鉴文案。

- [ ] **Step 3: 更新 AI 资产接入状态**

保留 Codex 已记录的生成工具、Prompt 摘要、用途和路径；CodeBuddy 只追加：已注册到 `CHAPTER1_IMAGES`、已接入隐藏过场、验证日期。

- [ ] **Step 4: 运行静态检查并提交当前设计/素材口径**

```powershell
node scripts/test-world-visual-smoke.mjs
git add design/ACHIEVEMENT_GARDEN_MARK.md design/01_world_bible.md README.md doc/AI_ASSET_RECORD.md doc/submit/社交媒体链接.md scripts/test-world-visual-smoke.mjs
git commit -m "docs(chapter1): record angel hidden endings"
```

---

### Task 12: 完整门禁、边界复核和交付

**Files:**
- Modify only if a directly related failure requires a scoped fix
- Do not update `docs/PROJECT_CONTEXT.md` with a PASS claim; Codex updates it after independent review

- [ ] **Step 1: 检查工作区范围**

```powershell
git status --short
git diff --name-status $baseline..HEAD
```

确认没有删除/移动 `doc/` 文件，没有把 `.superpowers/`、日志或构建临时文件加入提交。

- [ ] **Step 2: 串行运行静态门禁**

```powershell
npm run typecheck
npm run lint
npm run build
node scripts/test-scene-puzzle-rules.mjs
node scripts/test-world-visual-smoke.mjs
```

Expected: 全部 exit 0。

- [ ] **Step 3: 启动 mock 服务并运行 world smoke**

终端 A：

```powershell
$env:LLM_PROVIDER='mock'
npm run start -- -p 3019
```

终端 B：

```powershell
node scripts/test-world-smoke.mjs http://127.0.0.1:3019
```

若 3019 被占用，改用未占用端口并在报告中记录，不能终止不属于本任务的进程。

- [ ] **Step 4: 运行桌面 e2e**

```powershell
npm run test:e2e -- tests/e2e/chapter1-hidden-endings.spec.ts tests/e2e/chapter1-mechanics.spec.ts --project=desktop-chromium
```

Expected: 三条隐藏过场和既有机制全部 PASS。

- [ ] **Step 5: 资产与密钥检查**

验证：

- 四张结局图 1920×1080 PNG，含路西法两张连续镜头；
- 米迦勒印记 512×512 PNG；
- 源码不含常见真实 API Key 形态；
- `.env.local` 未被跟踪；
- 三条隐藏结局不在 `NORMAL_ENDING_IDS`。

- [ ] **Step 6: 人工桌面检查**

1920×1080：

- 加百列裂缝和蛇主体未被字幕遮挡；
- 米迦勒剑光可见且无血腥；
- 路西法透明意识培养舱、现实人类主角、正在消散的蛇形代理、第五道水流和晨星识别清楚；
- 人类双眼明显睁开，带克制惊讶与迷茫并转头观察周围舱群；面部与触碰舱壁的手可读，身体遮挡庄重，无色情、血腥、伤口或器官；女人与路西法不在舱内；
- 远景可有其他人类意识舱，但不得复制《黑客帝国》的演员、具体舱型、绿色代码雨、电影 Logo/品牌或原镜头构图；
- 点击、Enter、Space、跳过均可进入复盘；
- 图片 404 模拟下仍可读完整文案。

- [ ] **Step 7: 最终门禁通过后追加 CodeBuddy 证据**

此时才更新 `doc/submit/CodeBuddy开发对话记录.md`，写入：

- 本任务 CodeBuddy 会话/导出记录索引；
- 核心实现文件；
- 关键调试问题与修复；
- Task 12 实际执行的 typecheck/lint/build/smoke/e2e 命令、端口和结果；
- fake provider 空响应兜底的实际结果。

不得把中间阶段结果写成最终门禁；不得把 Codex 写成核心开发工具。单独提交该真实证据更新：

```powershell
git add doc/submit/CodeBuddy开发对话记录.md
git commit -m "docs(chapter1): record CodeBuddy angel ending evidence"
```

- [ ] **Step 8: 仅在仍有本任务未提交文件时补提交，然后交给 Codex 验收**

```powershell
git status --short
git diff --name-status $baseline..HEAD
```

若前 11 个任务已按小步提交且工作区没有本任务残留，不创建空的“最终提交”。若仍有本任务文件未提交，逐个核对后只暂存这些明确路径，再提交；不得使用占位符、`git add .` 或把用户原有脏工作区一起带入。

向 Codex 提供：

- CodeBuddy 会话/导出索引；
- 变更文件清单；
- 每个门禁的原始结果摘要；
- 三条正向路线与反例矩阵；
- 五个资产路径和尺寸；
- 已知未解决问题（若有）。

---

## 最终 Definition of Done

- [ ] 加百列：火焰剑 + 东园挣脱选项稳定触发 `escape_eden`。
- [ ] 米迦勒：本次负向低语使好感归零，立即触发 `michael_slay`，无后续结算。
- [ ] 路西法：夜晚四河分流 + 好感 100 + 晨星碎片 + 划水/边界话题，先回复再触发 `lucifer_awaken`。
- [ ] 三条结局分别使用独占 1920×1080 过场图和完整点击推进文案；路西法第 4 段稳定切换第二张。
- [ ] 米迦勒第 29 枚印记及 512×512 图标正常显示。
- [ ] 旧存档、手动槽、autosave、legacy save、已结束存档兼容。
- [ ] 三条结局进入跨局图鉴，但不污染三种普通结局统计。
- [ ] Agent/图片/音频失败时结局闭环仍可达。
- [ ] typecheck、lint、build、规则测试、world smoke、visual smoke、desktop e2e 全绿。
- [ ] 无明文密钥、无 `doc/` 删除移动、无 `.superpowers/` 或临时日志误提交。
- [ ] CodeBuddy 核心开发证据完整，Codex 只承担资产与独立验收角色。
