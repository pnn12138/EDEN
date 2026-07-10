# 第一章场景交互、NPC 主动引导与关系奖励 Implementation Plan

> **For agentic workers:** 本任务的核心实现工具必须是 CodeBuddy。请按本文任务顺序逐项实施、测试并在 CodeBuddy 对话中保留关键设计决策、代码生成、调试和验收记录。若执行环境支持任务计划能力，请使用逐任务执行与检查点，不要一次性重写全部模块。

**Goal:** 修复第一章 `/world` 的音景、场景物件和 NPC 对话问题，并建立“自由文本谜题 → 情报解锁 → NPC 好感 → 主动引导/试炼 → 一次性赠礼 → 天使因亲近蛇而遭受言语分裂惩罚”的完整可玩循环。

**Architecture:** 沿用当前“LLM 负责自然对白和工具意图、规则层负责状态变化与奖励执行”的架构。场景谜题、好感变化、挑战判定、奖励资格、天使当前语言、输入语言匹配和 NPC 间交流权限必须由 TypeScript 规则层决定；Agent 不得直接写入世界状态、背包、好感、语言状态或结局。新增能力必须兼容现有本地存档和 AI 接口失败兜底。

**Tech Stack:** Next.js 14、React 18、TypeScript、现有 OpenAI-compatible LLM Provider、React `useState`、localStorage 世界存档、Playwright、现有 `.mjs` smoke 测试。

---

## 0. CodeBuddy 执行身份与项目约束

你现在是 EDEN 项目的核心开发工具 CodeBuddy。本任务是第一章「园中诸声」封版后的体验与系统升级。

开始修改前必须完整阅读：

- `AGENTS.md`
- `README.md`
- `package.json`
- `docs/PROJECT_CONTEXT.md`
- `design/00_project_overview.md`
- `design/01_world_bible.md`
- `design/chapters/chapter0_first_fall.md`
- `design/agents/eve_behavior_rules.md`
- `design/tools/tool_calling_rules.md`
- `doc/产品需求文档.md`
- `doc/DEMO剧情与夏娃行为准则.md`
- `doc/第一章/plan_docs/09_CODEBUDDY_TASK_CHAPTER1_RESONANCE_AND_DIVINE_GIFTS.md`
- `doc/第一章/plan_docs/10_CODEBUDDY_TASK_CHAPTER1_NPC_DIALOGUE_TOOL_ACTIONS.md`
- 本文件

开始修改代码前使用 CodeGraph 确认相关符号、调用方和影响范围。若 CodeGraph 报告 pending sync 或 stale，直接读取对应源码。

必须遵守：

- CodeBuddy 是核心实现和主要调试工具；必须保留本任务对话记录。
- Codex 只负责后续测试、代码审查、边界检查和验收。
- 不删除、重命名或移动 `doc/` 中任何文件。
- 不新建新的 `docs/` 业务文档目录；现有 `docs/PROJECT_CONTEXT.md` 只作共享快照。
- 不在前端、测试、日志或文档中写入真实 API Key。
- 不引入大型依赖。
- 当前只验收桌面 Chrome，目标视口为 1920×1080；不新增移动端专项功能。
- 所有 Agent 工具必须经过规则层白名单、状态条件和重复保护校验。
- AI/LLM 失败时，核心流程、主动引导、谜题和奖励仍必须可运行。
- 不扩大到 Chapter 0、双声试炼或新的地图/NPC。
- 不重写现有回响系统；复用 `grant_item`、`inventory`、`itemCounts` 和现有 UI。
- 不让属性页显示内部标签名、Prompt、工具名或工程术语。
- 所有天使初始都使用中文。只有在“与蛇的好感达到 100 且已完成赠礼”后，才触发对应天使的言语分裂惩罚。

## 1. 当前实现事实与已确认问题

修改前先在 CodeBuddy 中复核以下事实。若实际代码不同，以当前源码为准，并在完成报告中说明差异。

### 1.1 当前基线

- `/world` 已具备 `intro -> explore -> ending` 闭环。
- 第一章已实现 6 个地点、12 时段、行动点、NPC Agent、回响、神明献礼、场景谜题和结局复盘。
- 当前构建基线通过：
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run build`
  - `node scripts/test-scene-puzzle-rules.mjs`
- 当前已有场景谜题：
  - 刻名石：`puzzle_naming_stone_identity`
  - 东园幽径：`puzzle_east_path_cautious_presence`
  - 伊甸之河：`puzzle_river_words_belonging`

### 1.2 音频问题

`src/app/world/page.tsx` 当前调用：

```ts
useChapter0Audio({
  temptationProgress: state.divineAttention,
  endingId: state.endingId,
  phase: state.phase === "intro" ? "intro" : "ending",
});
```

`useChapter0Audio` 只在 `intro -> dialogue/tool_resolution` 时淡出开场 BGM。第一章进入 `explore` 后被映射成 `ending`，不会走正确淡出分支；与此同时 `useChapter1Audio` 会在 `explore` 启动伊甸园环境音，因此可能出现开场 BGM 延续或双重音景。

### 1.3 NPC 对话框问题

`handleSelectNpc()` 本身会：

- 设置 `activeNpc`
- 打开世界面板
- 切到对话状态
- 切到对话 Tab

但场景立绘的点击通常写成：

```tsx
if (activeNpc !== "adam") handleSelectNpc("adam");
```

关闭面板只执行 `setWorldPanelOpen(false)`，不会清空 `activeNpc`。因此玩家关闭面板后，再点击同一个已选 NPC，点击条件为 false，面板无法重新打开。

### 1.4 场景视觉问题

- 非当前角色使用 `.eden-stage-character--dim` 的 `brightness + blur + opacity`，会产生半透明黑色虚影。
- 刻名石当前约位于：

```css
left: 50%;
top: 70%;
```

它与中央刺猬立绘和点击区域过于接近。

### 1.5 谜题问题

- 伊甸之河的 `trigger` 当前为 `on_enter`，进入地点后自动弹出。
- 刻名石当前仍是选项式问答。
- `/api/world/puzzle` 当前接收 `puzzleId + optionId`。
- `ScenePuzzleModal` 当前只渲染选项按钮。

### 1.6 NPC 关系与奖励问题

- `EdenWorldState` 尚无通用 NPC 好感状态、挑战状态、引导展示记录或满好感奖励记录。
- 属性页会直接显示大量精确数值和静态攻略情报，没有探索解锁过程。
- 天使奖励目前由 `checkAngelResonanceCondition()` 使用“地点 + 玩家关键词”被动判定。
- 玩家需要先猜中关键词，NPC 不会主动提出问题。
- 现有 `grant_item` 和 NPC 对话后工具意图已经存在，应复用而不是另建奖励入口。

### 1.7 天使语言惩罚尚未实现

- 当前所有天使都使用中文与玩家和其他 NPC 交流。
- 世界状态没有记录每位天使当前语言或言语分裂状态。
- `speak_to_npc` 只校验地点和角色，没有校验双方语言能否互通。
- Agent Prompt 没有强制输出语言，fallback 也没有多语言版本。
- 新设定要求：天使与蛇的好感达到 100、完成赠礼后受到惩罚，语言被永久改变；不同语言的角色彼此无法正常交流。

## 2. 最终体验目标

完成后玩家体验应为：

```text
开场叙事结束
↓
开场 BGM 淡出
↓
伊甸园环境音接管
↓
玩家点击场景 NPC，稳定打开对话框
↓
NPC 会根据首次见面、剧情停滞和关系进度主动给出自然引导
↓
玩家点击刻名石，以自由文本回答“万物受名”的问题
↓
答对后获得永久回响「万物名录」
↓
属性页解锁已见 NPC 的精确数值、性格和提升好感方式
↓
玩家用符合角色性格的表达提升好感
↓
好感达到 100 后触发赠礼资格
↓
天使主动提出角色主题问题
↓
玩家答对或语义接近，Agent 提出 grant_item 意图
↓
规则层校验并发放一次性专属回响
↓
神罚触发，赠礼天使的语言从中文永久切换为专属语言
↓
玩家必须使用对应语言才能继续与该天使交流
↓
语言不同的 NPC 之间无法再完成 speak_to_npc 对话
```

核心感受：

- NPC 不是等待关键词的奖励机。
- 玩家能从角色性格推导攻略方式。
- Agent 会主动引导，但不会直接给出通关答案。
- 奖励与关系建立有关，不靠重复点击或猜内部关键词。
- 即使 LLM 失败，本地规则也能保证引导、挑战和奖励闭环。
- 言语分裂是玩家与天使建立禁忌亲密关系的代价，不是单纯的语言皮肤。

## 3. 非目标

本任务不做：

- 不新增地图地点。
- 不新增 NPC。
- 不改变 12 时段总结构。
- 不改变行动点基础规则。
- 不改变女人吃果的四步禁忌动作链。
- 不改变神明献礼核心规则。
- 不增加复杂任务日志、任务追踪器或任务箭头。
- 不增加战斗、装备或传统 RPG 背包。
- 不允许玩家直接点击领取 NPC 奖励。
- 不让 Agent 自由决定好感数值。
- 不让 Agent 绕过好感 100、挑战状态或重复领取保护。
- 不在好感 100 前随机切换语言。
- 不提供自动翻译按钮或一键翻译答案；玩家可以自行理解、尝试或使用外部知识。
- 不因为浏览器或模型语言识别失败而直接扣除关键剧情进度。
- 不删除现有场景问答；东园幽径问答继续保留现有交互，除非测试证明需要兼容调整。
- 不强制重置玩家现有第一章存档。

## 4. 推荐文件边界

优先按职责拆分，避免继续把所有逻辑堆入 `src/app/world/page.tsx` 和 `/api/world/route.ts`。

### 4.1 建议新增

- `src/content/world/npcRelations.ts`
  - NPC 关系配置、初始好感、偏好、反感、玩家可见攻略情报、满好感奖励 itemId。
- `src/game/world/npcRelationRules.ts`
  - 好感增减、重复话术衰减、100 上限、奖励资格判定。
- `src/content/world/npcGuides.ts`
  - 一次性主动引导内容与触发条件元数据。
- `src/game/world/npcGuideRules.ts`
  - 根据状态选择本轮应注入的引导 ID。
- `src/content/world/npcChallenges.ts`
  - 天使挑战问题、语义概念、接近阈值、奖励 itemId。
- `src/game/world/npcChallengeRules.ts`
  - 挑战开启、回答评分、通过/失败/重试和奖励授权。
- `src/content/world/npcLanguages.ts`
  - 天使专属语言配置、玩家可见语言名、固定兜底短句和语言识别词表。
- `src/game/world/npcLanguageRules.ts`
  - 言语分裂触发、玩家输入语言识别、Agent 输出语言校验和 NPC 间互通校验。
- `src/game/world/puzzleAnswerRules.ts`
  - 自由文本场景谜题的服务端规则定义和判定。

如现有项目倾向少文件，也可以把相邻内容合并，但必须保持：

- 内容表与状态规则分离。
- UI 不直接计算好感或奖励资格。
- Agent Prompt 不保存最终规则真相。

### 4.2 预计修改

- `src/hooks/useChapter0Audio.ts`
- `src/hooks/useChapter1Audio.ts`
- `src/app/world/page.tsx`
- `src/app/globals.css`
- `src/content/world/scenePuzzles.ts`
- `src/components/world/ScenePuzzleModal.tsx`
- `src/game/world/puzzleRules.ts`
- `src/app/api/world/puzzle/route.ts`
- `src/content/world/items.ts`
- `src/content/world/npcs.ts`
- `src/game/world/types.ts`
- `src/game/world/toolRules.ts`
- `src/game/world/worldActions.ts`
- `src/app/api/world/route.ts`
- `src/app/api/world/tool/route.ts`
- `scripts/test-scene-puzzle-rules.mjs`
- `scripts/test-world-smoke.mjs`
- `scripts/test-world-visual-smoke.mjs`
- `tests/e2e/world-scene-puzzles.spec.ts`
- `design/chapters/chapter1_garden_voices_play_upgrade_design.md`（若存在）
- `docs/PROJECT_CONTEXT.md`

`tests/e2e/repro-scene-polish.spec.ts` 是用户当前未跟踪的复现文件。不要删除、重命名或覆盖；可以参考，但正式回归用例应进入已有正式 e2e 文件。

## 5. 建议数据结构

### 5.1 场景谜题输入模式

扩展 `ScenePuzzle`，保持旧选项题兼容：

```ts
export type ScenePuzzleInputMode = "choice" | "free_text";

export type ScenePuzzle = {
  id: string;
  locationId: EdenLocationId;
  timeOfDay?: TimeOfDay;
  trigger: "on_enter" | "explicit_interaction";
  inputMode: ScenePuzzleInputMode;
  evaluationId?: string;
  title: string;
  prompt: string;
  placeholder?: string;
  options?: ScenePuzzleOption[];
  successTags?: string[];
  successFeedback: string;
  rewards: ScenePuzzleReward;
  failure: {
    hint: string;
    attentionDelta?: number;
  };
};
```

不要把完整正确答案、内部评分公式或奖励条件直接显示给玩家。

### 5.2 通用 NPC 好感

建议：

```ts
export type NpcRelationState = {
  affinity: number; // 0-100
  rewardEligible: boolean;
  rewardClaimed: boolean;
  lastAffinitySignature: string | null;
};

export type NpcRelations = Partial<Record<EdenNpcId, NpcRelationState>>;
```

`lastAffinitySignature` 使用规则层归一化后的语义签名，例如：

```text
build_trust:gentle_reframe
tempt_wisdom:promise_wisdom+self_judgement
direct_command:none
```

不要在世界状态中保存原始玩家完整输入来做重复保护。

### 5.3 NPC 挑战

```ts
export type NpcChallengeStatus = "locked" | "asked" | "passed";

export type NpcChallengeState = {
  challengeId: string;
  status: NpcChallengeStatus;
  attempts: number;
};

export type NpcChallenges = Partial<Record<EdenNpcId, NpcChallengeState>>;
```

### 5.4 天使语言与言语分裂状态

建议：

```ts
export type AngelLanguageId =
  | "zh-CN"
  | "en"
  | "fr"
  | "he"
  | "la"
  | "el"
  | "ar";

export type NpcLanguageState = {
  languageId: AngelLanguageId;
  punishmentTriggered: boolean;
  firstMismatchHintShown: boolean;
};

export type NpcLanguageStates =
  Partial<Record<EdenNpcId, NpcLanguageState>>;
```

初始状态：

- 所有天使 `languageId = "zh-CN"`。
- `punishmentTriggered = false`。
- 非天使 NPC 继续使用中文，不需要建立复杂语言成长。

言语分裂触发后：

- 对应天使切换到配置表指定语言。
- 状态永久保存到本局存档。
- 不因时段切换、地点移动或再次加载页面恢复中文。
- 重新开始新游戏时才恢复初始中文。

建议固定映射：

| NPC | 惩罚后语言 | languageId |
| --- | --- | --- |
| 加百列 `gabriel` | 英语 | `en` |
| 拉斐尔 `raphael` | 法语 | `fr` |
| 乌列尔 `uriel` | 希伯来语 | `he` |
| 米迦勒 `michael` | 拉丁语 | `la` |
| 基路伯 `cherubim` | 古希腊语/现代希腊语表现 | `el` |
| 守望天使 `watching_angel` | 阿拉伯语 | `ar` |

如果模型对古希腊语质量不稳定，可以使用现代希腊语书写，但玩家可见名称统一写“希腊语”，不要谎称是严格古希腊语。

### 5.5 主动引导记录

```ts
shownNpcGuideIds: string[];
```

同一引导每局只展示一次，避免 NPC 重复报路或重复教学。

### 5.6 满好感奖励记录

`rewardClaimed` 不能只通过 `inventory.includes(itemId)` 推导，因为可消耗回响使用后会离开背包，若只查背包会导致重复发奖。

## 6. Task 1：先补失败测试，锁定当前问题

**Files:**

- Modify: `tests/e2e/world-scene-puzzles.spec.ts`
- Modify: `scripts/test-world-visual-smoke.mjs`
- Modify: `scripts/test-scene-puzzle-rules.mjs`

- [ ] **Step 1：补 NPC 同对象重开失败用例**

流程：

1. 新存档进入 `/world`。
2. 点击亚当，断言对话面板打开。
3. 点击面板关闭按钮。
4. 再次点击亚当。
5. 断言面板重新出现，且标题仍为“对 亚当 低语”。

刺猬至少再覆盖一次同类行为。

- [ ] **Step 2：补伊甸之河不自动弹题用例**

进入伊甸之河后等待至少 800ms：

```ts
await expect(page.getByTestId("scene-puzzle-modal")).toHaveCount(0);
```

点击新的河流热点后：

```ts
await page.getByTestId("scene-action-eden-river").click();
await expect(page.getByTestId("scene-puzzle-modal")).toBeVisible();
```

- [ ] **Step 3：补刻名石自由输入用例**

断言：

- 不再出现 `scene-puzzle-option`。
- 存在 textarea/input。
- 空输入不能提交。
- 错误回答显示提示。
- 正确回答发放一次奖励。

- [ ] **Step 4：运行并确认测试在旧代码上失败**

运行：

```bash
npm run test:e2e -- tests/e2e/world-scene-puzzles.spec.ts
node scripts/test-scene-puzzle-rules.mjs
node scripts/test-world-visual-smoke.mjs
```

预期：

- NPC 同对象重开失败。
- 伊甸之河仍自动弹窗。
- 刻名石仍显示选项。

不要为了让旧实现通过而降低断言。

## 7. Task 2：修复开场 BGM → 第一章环境音切换

**Files:**

- Modify: `src/hooks/useChapter0Audio.ts`
- Modify: `src/hooks/useChapter1Audio.ts`
- Modify: `src/app/world/page.tsx`
- Test: `tests/e2e/world-scene-puzzles.spec.ts`

### 7.1 设计要求

不要简单把 explore 映射为 `dialogue`，否则 `useChapter0Audio` 可能同时启动 Chapter 0 的 `eden_ambient_loop.mp3`，与 Chapter 1 环境音再次重叠。

推荐两种实现中的第一种：

#### 推荐实现：显式控制 Chapter 0 ambient

扩展：

```ts
type UseChapter0AudioParams = {
  temptationProgress: number;
  endingId: string | null;
  phase: GamePhase;
  enableDialogueAmbient?: boolean; // 默认 true
};
```

WorldPage：

```ts
useChapter0Audio({
  temptationProgress: state.divineAttention,
  endingId: state.endingId,
  phase:
    state.phase === "intro"
      ? "intro"
      : state.phase === "explore"
        ? "dialogue"
        : "ending",
  enableDialogueAmbient: false,
});
```

效果：

- `intro -> dialogue` 仍会淡出开场 BGM。
- WorldPage 不播放 Chapter 0 ambient。
- `useChapter1Audio` 在 `explore` 播放 Chapter 1 环境音。

#### 可接受替代

由 `useChapter1Audio` 完整接管第一章 intro 和 explore 音频生命周期，但不要复制两套声音开关状态，也不要让两个 hook 互相竞争。

### 7.2 交叉淡化要求

- 开场 BGM 淡出约 800～1200ms。
- Chapter 1 主环境音淡入约 800～1200ms。
- 伊甸之河水声只在 `four_river_source` 叠加。
- 离开伊甸之河后水声淡出。
- 关闭声音后所有背景音停止。
- 再次开启时只恢复当前阶段应播放的音轨。
- 进入结局后停止全部环境音，再播放结局音效。

### 7.3 测试

Playwright 中可以在页面加载前 mock：

```ts
HTMLMediaElement.prototype.play
HTMLMediaElement.prototype.pause
```

至少记录：

- `genesis_creation_bgm.mp3` 收到 pause。
- `eden_world_ambient` 收到 play。
- Chapter 0 `eden_ambient_loop.mp3` 在 World explore 中没有收到 play。

## 8. Task 3：修复黑色虚影与刻名石布局

**Files:**

- Modify: `src/app/globals.css`
- Modify: `src/app/world/page.tsx`
- Modify: `scripts/test-world-visual-smoke.mjs`
- Test: `tests/e2e/world-scene-puzzles.spec.ts`

### 8.1 角色视觉

不要再使用“黑化 + 模糊 + 大幅透明”表现非当前角色：

```css
.eden-stage-character--dim {
  filter: saturate(0.78) brightness(0.82);
  opacity: 0.84;
}
```

推荐改成：

- 所有可交互角色保持清晰可见。
- 当前角色增加轻量金色/青色轮廓或脚底柔光。
- 非当前角色只轻微降饱和，不使用 `blur()`。
- 不应出现完整图片边界矩形、黑色虚影或透明鬼影。
- 浏览模式中所有角色均可辨认、可点击。

检查角色源 PNG 的 alpha 边缘。如果矩形来自素材残余，不要只用 CSS 掩盖，应修正对应透明素材；但不要重新生成美术，除非现有素材确实损坏。

### 8.2 刻名石锚点

不要继续用与刺猬共用中央位置的临时坐标。

新增场景锚点常量，例如：

```ts
const ADAM_GARDEN_ANCHORS = {
  namingStone: { x: 61, y: 53 },
  hedgehog: { x: 50, y: 78 },
} as const;
```

要求：

- 刻名石按钮位于背景实际石碑附近。
- 刻名石视觉中心与刺猬视觉中心至少间隔 120px（1920×1080）。
- 两个点击区域不得重叠。
- 刻名石标签不遮挡亚当身体或重要背景动物。
- 点击区域至少约 96×46px，键盘焦点可见。

坐标最终以 1920×1080 截图人工确认，不要求死守建议值。

### 8.3 视觉验收

截图：

- 万物受名处浏览状态。
- 选中亚当。
- 选中刺猬。
- 关闭面板后的场景。

四张截图均不得出现中央黑色虚影。

## 9. Task 4：统一修复 NPC 点击与面板重开

**Files:**

- Modify: `src/app/world/page.tsx`
- Test: `tests/e2e/world-scene-puzzles.spec.ts`

新增统一入口，避免每个 JSX 自己判断：

```ts
const handleNpcInteract = useCallback((npc: EdenNpcId) => {
  const isSwitchingNpc = activeNpc !== npc;

  setWorldPanelOpen(true);
  setSceneFocusMode("dialogue");
  setActiveTab("dialogue");

  if (isSwitchingNpc) {
    setActiveNpc(npc);
    setCurrentReply(null);
    setSystemHint(null);
    setToolNarration(null);
    setHedgehogNarration(null);
  }
}, [activeNpc]);
```

也可以调整现有 `handleSelectNpc`，但所有可对话对象必须统一调用，不允许再写：

```ts
if (activeNpc !== npc) handleSelectNpc(npc);
```

要求：

- 首次点击打开。
- 切换 NPC 打开并切换对象。
- 关闭面板后点击同一 NPC 重新打开。
- 重新打开同一 NPC 时保留该 NPC 的历史对话。
- 点击场景空白仍可退出角色聚焦，但不能破坏历史。
- 地图移动后清理不在当前地点的 activeNpc，避免对空气继续低语。
- 每个按钮继续 `stopPropagation()`，避免打开后立即被场景点击关闭。

覆盖：

- 亚当
- 女人
- 刺猬
- 守望天使/基路伯
- 五位天使
- 狐狸

## 10. Task 5：伊甸之河改为显式可点击

**Files:**

- Modify: `src/content/world/scenePuzzles.ts`
- Modify: `src/app/world/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/e2e/world-scene-puzzles.spec.ts`

修改：

```ts
{
  id: "puzzle_river_words_belonging",
  locationId: "four_river_source",
  trigger: "explicit_interaction",
  ...
}
```

WorldPage 新增河流热点：

```tsx
{state.locationId === "four_river_source" && (
  <button
    type="button"
    data-testid="scene-action-eden-river"
    aria-label="倾听伊甸之河"
    onClick={...}
  >
    <span>伊甸之河</span>
    <small>{completed ? "回声已记下" : "倾听水声"}</small>
  </button>
)}
```

要求：

- 进入场景不自动弹窗。
- 点击河流才打开问答。
- 已完成后仍可点击查看“回声已记下”提示，但不重复发奖。
- 热点应贴近明显水流区域，不放在 NPC 身上。
- 热点只在当前场景出现。
- 不消耗 AP，保持与现有场景谜题一致。
- 更新目标提示文案，不再写“重要问题会在到达时出现”作为统一规则。

## 11. Task 6：扩展场景谜题为自由文本

**Files:**

- Modify: `src/content/world/scenePuzzles.ts`
- Create: `src/game/world/puzzleAnswerRules.ts`
- Modify: `src/game/world/puzzleRules.ts`
- Modify: `src/app/api/world/puzzle/route.ts`
- Modify: `src/components/world/ScenePuzzleModal.tsx`
- Modify: `src/app/world/page.tsx`
- Modify: `scripts/test-scene-puzzle-rules.mjs`
- Test: `tests/e2e/world-scene-puzzles.spec.ts`

### 11.1 API 兼容

请求体支持：

```ts
type PuzzleRequestBody = {
  state: EdenWorldState;
  puzzleId: string;
  optionId?: string;
  answerText?: string;
};
```

规则：

- `choice` 必须有合法 `optionId`。
- `free_text` 必须有去空格后非空的 `answerText`。
- 输入最大长度建议 200 字。
- 不把自由文本直接作为 Prompt 拼接到高权限系统消息。
- 服务端根据 puzzleId/evaluationId 选择白名单评估器。

### 11.2 判定结果

扩展结果：

```ts
type PuzzleAnswerGrade = "correct" | "close" | "wrong";

type ScenePuzzleAnswerResult = {
  state: EdenWorldState;
  success: boolean;
  grade: PuzzleAnswerGrade;
  feedback: string;
  rewards: ScenePuzzleRewardResult[];
  divineGift?: DivineGiftFrontend | null;
};
```

兼容旧用例时可以把 choice 成功映射为 `correct`，失败映射为 `wrong`。

### 11.3 规则层权威

自由文本判定使用本地语义概念组，不允许 LLM 直接决定发奖。

建议评估流程：

1. 归一化全角/半角、空格、标点和大小写。
2. 检查明确反向概念。
3. 检查至少一个核心正向概念。
4. 检查是否表达“名字让生命被认识/区分/看见/回应”。
5. 给出 `correct / close / wrong`。

LLM 可以作为模糊回答的可选辅助分类器，但：

- 本地规则必须能独立完成。
- LLM 失败不能阻塞。
- LLM 不得直接发奖。
- 模糊回答最多提升到 `close`，除非本地核心概念已满足。

### 11.4 UI

`ScenePuzzleModal` 根据 `inputMode` 渲染：

- choice：保留现有选项。
- free_text：
  - textarea
  - 200 字限制
  - 提交按钮
  - Enter/Ctrl+Enter 规则明确
  - 加载态
  - 错误后可继续修改
  - 成功后锁定输入并显示“继续”

错误和接近不能关闭重试通道。

## 12. Task 7：重做刻名石谜题与奖励

**Files:**

- Modify: `src/content/world/scenePuzzles.ts`
- Modify: `src/game/world/puzzleAnswerRules.ts`
- Modify: `src/content/world/items.ts`
- Modify: `src/game/world/puzzleRules.ts`
- Modify: `src/app/world/page.tsx`
- Modify: `scripts/test-scene-puzzle-rules.mjs`

### 12.1 最终题面

建议：

> 亚当为飞鸟走兽一一命名。石上却留下未完的一句：  
> “若只说出称呼，却未曾理解它，万物真的受名了吗？”  
> 名字赋予万物的，究竟是什么？

允许 CodeBuddy微调文学表达，但必须保持：

- 与“万物受名”直接相关。
- 不是常识选择题。
- 不要求唯一固定句子。
- 核心答案不是“占有”或“服从”。

### 12.2 本地语义规则

正确概念建议：

- 理解 / 认识 / 认出
- 区分 / 分辨
- 看见 / 被看见
- 记住 / 被记住
- 回应 / 呼唤后能回应
- 使生命有自己的位置或意义，但不能表达为强制等级秩序

反向概念建议：

- 占有
- 支配
- 奴役
- 只为服从
- 让命名者控制万物

示例：

```text
正确：名字让一个生命被看见、被理解，也能从万物中被认出。
正确：不是占有，而是让彼此能够辨认和回应。
接近：名字让万物彼此不同。
错误：名字证明万物都属于命名者。
```

### 12.3 新永久回响

新增：

```ts
{
  id: "resonance_living_names",
  title: "万物名录",
  description: "石痕没有替你列出答案，只让你开始看见每个生命不同的性情。",
  obtainLocation: "adam_garden_work",
  kind: "passive",
  repeatable: false,
  sourceType: "scene",
  sourceName: "刻名石",
  shortEffect: "在属性页解锁已见角色的精确数值、性格和相处提示。",
  icon: "◫",
}
```

不要复用现有 `resonance_borrowed_name`：

- 它是 consumable。
- 它可能被消耗。
- 情报解锁必须是永久能力。

谜题正确时可以继续保留原线索，但核心物品改为 `resonance_living_names`。是否同时保留“借来的名字”由当前平衡决定，默认不要一次发两个主要道具。

### 12.4 旧存档兼容

旧存档可能已包含：

```text
completedScenePuzzleIds includes puzzle_naming_stone_identity
```

但没有新道具。

必须迁移：

- 若旧存档已完成刻名石谜题，则补发一次 `resonance_living_names`。
- 不要求玩家重做。
- 不重复增加 `itemCounts`。
- 不覆盖玩家其他状态。

## 13. Task 8：属性页改为情报解锁

**Files:**

- Create: `src/content/world/npcRelations.ts`
- Modify: `src/app/world/page.tsx`
- Modify: `src/content/world/npcs.ts`
- Modify: `src/app/globals.css`
- Modify: `scripts/test-world-visual-smoke.mjs`
- Test: `tests/e2e/world-scene-puzzles.spec.ts`

### 13.1 未获得“万物名录”前

属性页只显示：

- 角色名称。
- 玩家肉眼可见的基础身份。
- 模糊状态，例如“警惕”“平静”“愿意听一会儿”。
- 好感度可以显示为模糊阶段，不显示精确数值。

不得显示：

- 精确 0-100 数值。
- 具体偏好公式。
- “说某关键词 +10”。
- 内部信号、inputTag 或 Prompt 摘要。

### 13.2 获得“万物名录”后

仅对玩家已经见过的角色显示：

- 精确好感度。
- 当前主要属性。
- 性格。
- 喜欢的交流方式。
- 反感行为。
- 如何提升好感的自然语言提示。
- 是否已达到赠礼资格。
- 是否已领取赠礼。

建议玩家可见结构：

```text
亚当
性格：稳重、回避冲突、重视亲密关系
好感：62 / 100
他在意：禁令被如何转述、妻子的去向、责任
更容易亲近：先询问、承认他的责任、谈及妻子的困惑
会引起戒备：命令他违背神、直接侮辱神、反复催促
赠礼：尚未准备
```

不要显示内部加减分数字。

### 13.3 已见角色

建议新增：

```ts
encounteredNpcIds: EdenNpcId[];
```

当 NPC 首次出现在当前地点或首次被点击时记录。属性页不能提前泄露尚未遇见的 NPC。

若不新增该字段，可以由已有对话/地点记录安全推导，但必须稳定、可存档。

## 14. Task 9：建立通用 NPC 好感规则

**Files:**

- Create: `src/content/world/npcRelations.ts`
- Create: `src/game/world/npcRelationRules.ts`
- Modify: `src/game/world/types.ts`
- Modify: `src/game/world/types.ts` 中 `initialEdenWorldState`
- Modify: `src/app/api/world/route.ts`
- Modify: `src/app/api/world/tool/route.ts`
- Modify: `src/app/world/page.tsx`
- Modify: `scripts/test-world-smoke.mjs`

### 14.1 适用对象

默认覆盖 `canWhisper === true` 的现有 NPC：

- `eve`
- `adam`
- `hedgehog`
- `watching_angel`
- `gabriel`
- `raphael`
- `uriel`
- `michael`
- `cherubim`
- `fox`

不可低语动物和世界对象不建立好感：

- 鸽子
- 小鹿
- 羊
- 生命树
- 分别善恶树

如果女人不适合赠送传统道具，可以配置叙事型回响，但她仍应有关系值。不要把她从统一关系系统完全排除。

### 14.2 好感变化原则

规则层输入：

- 当前 NPC。
- `inputTag`。
- 语义 signals。
- 是否重复相同语义签名。
- 当前神的注视。
- 是否命中该 NPC 的偏好/反感。

建议基础范围：

- 强命中偏好：`+10`
- 普通命中偏好：`+6`
- 相关但中性：`+2`
- 无关：`0`
- 命令/催促：`-6`
- 威胁/出戏：`-10`
- 连续重复相同语义签名：正向收益最多 `+2`

具体数值可调，但必须：

- 单次正向不超过 +12。
- 单次负向不低于 -12。
- 结果 clamp 到 0-100。
- 不能通过复制同一句话快速刷满。
- 不允许 Agent 返回 `affinityDelta` 并直接生效。

### 14.3 与现有心智的边界

- Eve 的 `serpentTrust` 继续服务吃果主线。
- NPC `affinity` 服务关系和奖励。
- 两者可以受相同输入影响，但不能互相替代。
- 属性页需要解释区别：
  - “愿意倾听”是主线心智。
  - “好感”是角色与你的关系。

### 14.4 达到 100

当好感首次达到 100：

```ts
rewardEligible = true;
```

不能立即在规则层静默塞入道具。

- 天使进入主动试炼。
- 其他 NPC 在下一次自然回复中进入赠礼表达，并通过现有 `grant_item` 意图发放。
- 若 Agent 失败，使用本地赠礼对白和规则层安全发放兜底。

## 15. Task 10：NPC 主动引导

**Files:**

- Create: `src/content/world/npcGuides.ts`
- Create: `src/game/world/npcGuideRules.ts`
- Modify: `src/app/api/world/route.ts`
- Modify: `src/agents/world/*`（只修改必要 Prompt）
- Modify: `src/content/world/worldNarrations.ts`
- Modify: `scripts/test-world-smoke.mjs`

### 15.1 引导触发类别

每条引导有唯一 `guideId`，每局只触发一次。

#### 首次问候

玩家第一次与 NPC 对话，且输入是问候或普通寒暄。

#### 剧情停滞

例如：

- 前 2～3 个时段仍未找到女人。
- 多次与无关角色对话但主线未推进。
- 好感提高但玩家不知道下一步。
- 玩家已得到回响但未使用。

#### 关系阶段

例如好感达到：

- 30：角色愿意透露基础信息。
- 60：角色透露更具体的偏好或地点。
- 100：进入赠礼/挑战。

P0 只要求首次问候和好感 100；30/60 可作为内容增强，不要阻塞主线。

### 15.2 亚当首次引导

玩家首次向亚当问候时，回复必须自然包含：

> “你可曾看见我的妻子？她方才往东边的树林采果去了。”

允许自然变化，但必须表达：

- 他在找妻子。
- 她往东边树林采果。
- 玩家由此知道应往东寻找女人。

当前女人实际位于 `tree_court`。不要把她错误指向 `east_garden_path`，除非当前状态中她的位置已动态变化。

如果女人已经移动，改为根据 `state.npcLocations.eve` 生成当前合理提示，不说过时地点。

### 15.3 其他建议引导

- 狐狸：提醒玩家可以让它评价一句准备对女人说的话。
- 拉斐尔：提醒“受惊的生灵听不见复杂的劝说”。
- 乌列尔：提醒“提问比断言更不容易惊动对方”。
- 米迦勒：提醒“每句话离开口中后都会留下后果”。
- 基路伯：提醒东园道路和边界，不直接给通关答案。
- 加百列：提醒水流和声音可以把话带向别处。
- 刺猬：用动作暗示保持安静或连续观察，不说人类长句。
- 女人：根据当前心智主动暴露她最困惑的词，例如“死”“知道”“为什么”。

### 15.4 Agent 接入

规则层先决定：

```ts
const guide = selectNpcGuide(state, targetNpc, playerInput, history);
```

再将自然语言要求注入 Prompt：

```text
本轮必须自然表达以下信息，但不要像任务提示，不要提到规则或数值：
[guide directive]
```

fallback 必须有等价固定文案。

完成后把 `guideId` 写入 `shownNpcGuideIds`。

## 16. Task 11：天使主动试炼与赠礼

**Files:**

- Create: `src/content/world/npcChallenges.ts`
- Create: `src/game/world/npcChallengeRules.ts`
- Modify: `src/app/api/world/route.ts`
- Modify: `src/game/world/toolRules.ts`
- Modify: `src/content/world/worldNarrations.ts`
- Modify: `src/content/world/items.ts`（仅在现有奖励缺失时）
- Modify: `scripts/test-world-smoke.mjs`

### 16.1 统一触发规则

天使好感达到 100 且尚未领取奖励：

1. 设置对应挑战为 `asked`。
2. 本次 Agent 回复主动提出问题。
3. 不立即发奖。
4. 玩家下一次对该天使回复时，优先判定挑战答案。
5. 正确或接近问题核心：允许 `grant_item`。
6. 偏离：给出一次自然提示，挑战保持 `asked`。
7. 每位天使每局只发一次。

### 16.2 评分

建议：

- `correct`：≥ 0.85
- `close`：0.60～0.84
- `wrong`：< 0.60

可以不用浮点实现，改成概念分：

- 命中核心概念 2 个：correct
- 命中 1 个且无反向概念：close
- 无核心概念或命中反向概念：wrong

`correct` 和 `close` 均允许发奖，区别只在反馈和印记：

- correct：完整认可文案。
- close：认可玩家已接近核心，并给予道具。
- wrong：提示后可重试。

### 16.3 挑战内容建议

#### 加百列

问题：

> “一句话离开说话者以后，仍只属于说话者吗？”

核心：

- 会被听者理解和改变。
- 言语会产生后果。

奖励：

- `resonance_herald_feather`

#### 拉斐尔

问题：

> “一个受惊的人，先需要答案，还是先需要不再被逼迫？”

核心：

- 安全、平静、耐心先于劝说。

奖励：

- `resonance_river_dew`

#### 乌列尔

问题：

> “光应当替人作出选择，还是让他看清自己正在选择什么？”

核心：

- 光照帮助看清，不替人决定。

奖励：

- `resonance_morning_flame`

#### 米迦勒

问题：

> “边界的意义，是阻止所有脚步，还是让越过的人知道自己承担什么？”

核心：

- 选择与后果。
- 边界不是单纯命令。

奖励：

- `resonance_boundary_mark`

#### 基路伯

问题：

> “一条道路尚能进入时，是否意味着它永远都有归路？”

核心：

- 不可逆。
- 进入和返回并不对等。

奖励：

- `resonance_east_gate_glow`

守望天使如保留独立奖励，应使用边界/注视主题；不要与基路伯重复。如果当前没有独立道具，可只提供情报，不强行新增重复奖励。

### 16.4 复用 `grant_item`

现有 Agent 可以输出：

```json
{
  "reply": "你已经听见水声如何改变一句话。收下这片白羽。",
  "toolCall": {
    "name": "grant_item",
    "caller": "gabriel",
    "args": {
      "itemId": "resonance_herald_feather"
    }
  }
}
```

规则层额外校验：

- caller 是当前对话 NPC。
- 该 NPC 好感为 100。
- 挑战状态为 `asked`。
- 本轮答案为 `correct` 或 `close`。
- itemId 与挑战配置完全匹配。
- rewardClaimed 为 false。

非法 itemId、错误 caller、未达好感或未通过挑战必须拒绝，但 NPC 正常回复不能丢失。

### 16.5 替换旧被动关键词奖励

`checkAngelResonanceCondition()` 不再作为主要奖励路径。

处理方式：

- 删除或停用“地点 + 玩家关键词直接发奖”。
- 不得让旧路径和新挑战路径同时存在，否则会提前发奖或重复发奖。
- 如需兼容已领取旧奖励的存档，根据 inventory/itemCounts 标记 rewardClaimed。
- 旧奖励道具本身继续保留。

### 16.6 赠礼完成后立即触发言语分裂惩罚

天使成功赠礼后的同一个服务端结算中，必须按以下顺序执行：

```text
规则层确认挑战 correct/close
↓
执行 grant_item
↓
写入 rewardClaimed
↓
触发对应天使的 language punishment
↓
把该天使 current language 从中文改为专属语言
↓
返回赠礼叙事 + 神罚叙事 + 新语言提示
```

不能在发奖前切换语言，否则玩家可能无法理解赠礼发生了什么。

玩家可见叙事示例：

> 加百列将白羽放在河边。  
> 风忽然从水面上截断了他的声音。像是对他亲近蛇、泄露神物的惩罚，他再次开口时，那些词已经不再属于园中共同的语言。  
> “The gift is yours. But our words are divided now.”

第一句赠礼可以保持中文，言语分裂后的第一句开始使用专属语言。此后不得自动恢复中文。

## 17. Task 12：天使赠礼后的言语分裂惩罚

**Files:**

- Create: `src/content/world/npcLanguages.ts`
- Create: `src/game/world/npcLanguageRules.ts`
- Modify: `src/game/world/types.ts`
- Modify: `src/game/world/toolRules.ts`
- Modify: `src/game/world/worldActions.ts`
- Modify: `src/app/api/world/route.ts`
- Modify: `src/agents/world/angelAgent.ts`
- Modify: `src/content/world/worldNarrations.ts`
- Modify: `src/app/world/page.tsx`
- Modify: `scripts/test-world-smoke.mjs`
- Test: `tests/e2e/world-scene-puzzles.spec.ts`

### 17.1 叙事规则

- 所有天使在游戏开始时都使用中文。
- 天使与蛇的好感达到 100，本身不会立刻失语。
- 只有当天使通过主动试炼给予玩家专属道具后，神罚才发生。
- 惩罚原因是天使与蛇建立了禁忌亲密关系，并把受守护的回响交给蛇。
- 惩罚表现为“园中共同语言被从他身上剥离”，不是天使主动学习外语。
- 每位天使被固定到不同语言。
- 惩罚只影响交流，不删除 NPC、不移除道具、不降低已经达到的好感。
- 该状态持续到本局结束；只有重新开始新游戏才恢复中文。

### 17.2 语言配置

在 `npcLanguages.ts` 中建立唯一配置：

```ts
export const ANGEL_LANGUAGE_CONFIG = {
  gabriel: {
    initialLanguageId: "zh-CN",
    punishedLanguageId: "en",
    displayName: "英语",
    mismatchReply: "I do not understand your words.",
  },
  raphael: {
    initialLanguageId: "zh-CN",
    punishedLanguageId: "fr",
    displayName: "法语",
    mismatchReply: "Je ne comprends pas tes paroles.",
  },
  uriel: {
    initialLanguageId: "zh-CN",
    punishedLanguageId: "he",
    displayName: "希伯来语",
    mismatchReply: "אינני מבין את דבריך.",
  },
  michael: {
    initialLanguageId: "zh-CN",
    punishedLanguageId: "la",
    displayName: "拉丁语",
    mismatchReply: "Verba tua non intellego.",
  },
  cherubim: {
    initialLanguageId: "zh-CN",
    punishedLanguageId: "el",
    displayName: "希腊语",
    mismatchReply: "Δεν καταλαβαίνω τα λόγια σου.",
  },
  watching_angel: {
    initialLanguageId: "zh-CN",
    punishedLanguageId: "ar",
    displayName: "阿拉伯语",
    mismatchReply: "لا أفهم كلماتك.",
  },
} as const;
```

固定文案需要人工检查编码、字体显示和语义。不要把希腊语描述成严格古希腊语，除非内容经过可靠校对。

### 17.3 惩罚触发函数

建议：

```ts
export function triggerAngelLanguagePunishment(
  state: EdenWorldState,
  angelId: AngelNpcId,
): AngelLanguagePunishmentResult
```

规则：

- angelId 必须在天使白名单。
- `rewardClaimed === true`。
- `punishmentTriggered === false`。
- 读取固定语言配置。
- 更新 `npcLanguageStates[angelId]`。
- 返回玩家可见惩罚叙事。
- 重复调用不得再次切换或重复播放神罚。

### 17.4 玩家输入语言识别

新增：

```ts
export type PlayerLanguageMatch =
  | { matched: true; detectedLanguageId: AngelLanguageId }
  | { matched: false; detectedLanguageId: AngelLanguageId | "unknown" };

export function detectPlayerInputLanguage(input: string): AngelLanguageId | "unknown";

export function canAngelUnderstandPlayer(
  state: EdenWorldState,
  angelId: AngelNpcId,
  playerInput: string,
): PlayerLanguageMatch;
```

优先使用本地规则，不能让奖励后的每一句话都完全依赖额外 LLM 分类。

检测建议：

- 希伯来语：Unicode Hebrew 范围。
- 希腊语：Unicode Greek 范围。
- 阿拉伯语：Unicode Arabic 范围。
- 法语：常用词与明显法语形式，如 `bonjour / merci / pourquoi / je / tu / vous / est / pas / que`，以及法语重音字符。
- 拉丁语：受控常用词表，如 `salve / quid / veritas / lumen / via / non / est / verba / intellego`。
- 英语：常用英语词表和剩余英文句式。
- 中文：CJK 字符。
- 只有标点、数字、Emoji、角色名或无法判断的短输入：`unknown`。

法语、英语、拉丁语都使用拉丁字母，不能仅凭字符范围判断。检测顺序应为：

```text
Hebrew / Greek / Arabic / Chinese
↓
French dictionary and accents
↓
Latin controlled vocabulary
↓
English vocabulary
↓
unknown
```

允许 LLM 对 `unknown` 或英文/法语/拉丁语冲突进行辅助判断，但必须：

- 超时或失败时回到本地结果。
- LLM 结果只用于判断语言，不得顺带修改好感或发奖。
- 服务端记录内部原因码，玩家不可见工程信息。

### 17.5 错误语言处理

当天使已受惩罚，玩家输入语言不匹配时：

- 不调用天使正常 Agent。
- 不生成正常剧情回答。
- 不触发新的工具行为。
- 不改变女人/亚当心智。
- 不提高或降低神的注视。
- 不改变已满的天使好感。
- 返回该天使专属语言的固定“听不懂”短句。
- 同时显示中文叙事提示，例如：

> 他听见了声音，却无法从这门语言中辨认你的意思。

为了避免玩家第一次遇到语言惩罚时因不知情浪费行动点：

- 第一次语言不匹配：不消耗 AP，并设置 `firstMismatchHintShown = true`。
- 此后继续使用错误语言：正常消耗一次低语 AP，但不产生其他状态变化。

如果不希望加入“首次免费”规则，CodeBuddy 必须在完成前与用户确认；默认按首次免费实现。

`/api/world` 的处理顺序需要调整为：

```text
游戏结束 / 空输入 / NPC 合法性校验
↓
读取目标 NPC 当前有效语言
↓
如已受罚，先判断玩家输入语言
↓
首次 mismatch：返回免费提示
后续 mismatch：校验并消耗 1 AP 后返回听不懂
↓
只有 language matched 才进入心智、神的注视、好感、挑战、Agent 和工具流程
```

不要沿用当前“先更新心智和神的注视，再调用 Agent”的顺序处理 mismatch，否则天使明明没有听懂，世界状态却仍会变化。

### 17.6 正确语言处理

语言匹配时：

- 按正常低语消耗 AP。
- 调用对应天使 Agent。
- Prompt 强制要求使用专属语言回复。
- 不允许回复中夹带大段中文翻译。
- 可以保留角色名、道具名等极少量专有名词，但优先使用目标语言表达。

Prompt 约束示例：

```text
你受到言语分裂惩罚。你现在只能使用法语理解和回应。
玩家输入已经通过规则层的法语识别。
你的 reply 必须完全使用法语，不得附带中文翻译，不得解释自己是语言模型。
```

### 17.7 Agent 输出语言校验与 fallback

不能只相信 Prompt。

新增：

```ts
export function isReplyInExpectedLanguage(
  reply: string,
  expectedLanguageId: AngelLanguageId,
): boolean;
```

如果模型：

- 返回中文。
- 返回错误语言。
- 返回空文本。
- 返回 JSON 泄漏或工程词。

则使用 `npcLanguages.ts` 中该天使的目标语言 fallback。

每种语言至少准备：

- 普通回应 2～3 条。
- 听不懂玩家时 1 条。
- 拒绝越界时 1 条。
- 对关系/赠礼余波的回应 1 条。

### 17.8 NPC 与 NPC 的语言互通

新增统一规则：

```ts
export function getNpcEffectiveLanguage(
  state: EdenWorldState,
  npcId: EdenNpcId,
): AngelLanguageId;

export function canNpcsUnderstandEachOther(
  state: EdenWorldState,
  speakerId: EdenNpcId,
  targetId: EdenNpcId,
): boolean;
```

规则：

- 普通 NPC 的有效语言为中文。
- 未受罚天使的有效语言为中文。
- 受罚天使使用自己的专属语言。
- 只有双方有效语言相同才能正常交流。
- 每位天使惩罚后语言唯一，因此不同受罚天使彼此也无法交流。
- 受罚天使与中文 NPC 也无法交流。

在 `speak_to_npc` 校验中，语言检查必须位于实际生成 NPC 间对白之前。

语言不通时：

- 不生成正常 `NpcDialogueRecord`。
- 不应用该 NPC 对话原本的心智或线索效果。
- 返回自然叙事：

> 加百列说出了亚当无法辨认的词。亚当停了一会儿，没有回应。

- 可以记录一次“交流失败”事件供复盘，但不能伪装成成功对话。

### 17.9 UI 提示

属性页在获得“万物名录”后显示：

```text
当前语言：法语
言语状态：共同语言已被剥离
与你交流：需要使用法语
与其他角色交流：语言不通
```

未获得万物名录时：

- 仍应通过惩罚过场和输入框 placeholder 告知玩家目标语言。
- 不显示内部 languageId。

输入框 placeholder 跟随当前天使：

```text
请使用法语向拉斐尔低语……
```

对话面板可显示小型语言徽标，但不要做成自动翻译按钮。

### 17.10 无障碍与字体

- 确认当前字体栈能显示希伯来语、希腊语和阿拉伯语。
- 希伯来语、阿拉伯语回复容器应自动使用 `dir="rtl"`。
- 输入框在对应语言时允许 RTL 输入。
- 英语、法语、拉丁语、希腊语保持 LTR。
- 不新增大型字体包；优先系统字体 fallback。

## 18. Task 13：非天使 NPC 满好感赠礼

**Files:**

- Modify: `src/content/world/npcRelations.ts`
- Modify: `src/app/api/world/route.ts`
- Modify: `src/content/world/worldNarrations.ts`
- Modify: `src/content/world/items.ts`
- Modify: `scripts/test-world-smoke.mjs`

至少完成：

- 亚当
- 刺猬
- 狐狸
- 女人

建议：

### 亚当

- 性格：稳重、回避冲突、牵挂妻子。
- 喜好：询问命令如何被转述、承认责任、谈论妻子的困惑。
- 反感：强迫背叛、辱骂神、催促。
- 满好感奖励：优先复用与名字/记号相关的现有回响；若“借来的名字”已由旧规则占用，可调整其来源说明。

### 刺猬

- 性格：安静、好奇、胆小。
- 喜好：轻声、耐心、观察。
- 反感：威胁、连续高压。
- 满好感奖励：`resonance_hedgehog_bristle` 或当前对应真实 ID。

### 狐狸

- 性格：敏锐、聪明、喜欢拆解语言。
- 喜好：让它评价具体话术、承认语言风险。
- 反感：要求直接给最优答案、粗暴命令。
- 满好感奖励：优先复用 `resonance_fox_tail_note`。

### 女人

- 不要把她做成传统商店式奖励 NPC。
- 好感 100 时可给予一个叙事型永久回响或线索，表达她开始主动向蛇说出自己的问题。
- 奖励不得直接触发吃果，不得绕过动作链门槛。

所有 itemId 以 `src/content/world/items.ts` 当前真实内容为准。缺失时再新增，禁止引用不存在的 ID。

## 19. Task 14：状态初始化、克隆与旧存档迁移

**Files:**

- Modify: `src/game/world/types.ts`
- Modify: `src/app/world/page.tsx`
- Modify: `src/app/api/world/route.ts`
- Modify: `src/app/api/world/tool/route.ts`
- Modify: `src/game/world/puzzleRules.ts`
- Modify: `src/app/api/world/puzzle/route.ts`
- Modify: `scripts/test-world-smoke.mjs`

新增状态后必须同步所有复制/归一化入口：

- `initialEdenWorldState`
- `makeInitialState`
- `normalizeWorldStateForClient`
- `/api/world` 的 `cloneWorldState`
- `/api/world/tool` 的 `cloneWorldState`
- puzzle 规则中的 clone
- 其他 smoke 测试构造的旧状态

要求：

- 缺失新字段时自动补默认值。
- 不因旧状态缺失数组或 Record 导致 `is not iterable`。
- 不使用会产生重复属性 TS2783 的对象展开顺序。
- 嵌套对象和数组必须深拷贝到足够层级。
- 已领取旧天使回响的存档应设置对应 rewardClaimed。
- 旧存档缺失 `npcLanguageStates` 时，所有天使默认中文且 `punishmentTriggered=false`。
- 不要仅因为旧存档背包中已有天使回响就立即在加载时触发惩罚，避免玩家刷新后毫无叙事地突然失去共同语言。
- 对旧存档中已经持有天使回响的角色：保留 `rewardClaimed=true`；当该天使关系后来达到 100 时，在下一次对话中补演言语分裂惩罚，但不重复发放道具。
- 已受罚语言状态必须深拷贝并持久化，刷新、时段推进和地图移动不能将其重置成中文。
- `firstMismatchHintShown` 缺失时默认 false。
- 已完成旧刻名石谜题的存档应补发“万物名录”。
- 保留原 localStorage key 或实现明确迁移；不允许静默丢弃玩家存档。

## 20. Task 15：UI 反馈与文案

**Files:**

- Modify: `src/app/world/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/components/world/ScenePuzzleModal.tsx`

### 20.1 好感变化

不显示工程数值增量 Toast，例如不要直接显示：

```text
affinity +10
```

可以显示自然反馈：

- “亚当的语气不再那么封闭。”
- “狐狸的尾尖轻轻动了一下，像是认可了你的说法。”
- “拉斐尔没有退开。”

属性页在解锁后显示最终精确值。

### 20.2 挑战状态

属性页显示：

- “关系尚浅”
- “愿意透露更多”
- “正在等待你的回答”
- “赠礼已获得”

不要显示：

- `rewardEligible`
- `challengeId`
- `grant_item`
- `correct/close/wrong`

### 20.3 奖励展示

赠礼发生时：

1. NPC 回复。
2. 挑战/关系反馈。
3. 道具获得卡片。

保持对话框打开，不只依赖 Toast。

### 20.4 引导文案

引导应像角色自然说话，不像任务系统：

错误：

> “任务更新：前往东园寻找夏娃。”

正确：

> “你可曾看见我的妻子？她方才往东边的树林采果去了。”

## 21. Task 16：完整测试矩阵

### 21.1 规则测试

`scripts/test-scene-puzzle-rules.mjs`：

- 旧 choice 谜题仍能判定。
- 刻名石空输入拒绝。
- 正确、接近、错误各至少 3 个中文表达。
- 反向答案不能成功。
- 正确奖励只发一次。
- 旧存档补发万物名录一次。

新增或扩展关系规则测试：

- 好感 clamp 0-100。
- 偏好表达增加。
- 命令/威胁降低。
- 重复同一语义签名收益衰减。
- Agent 输出的虚假 affinityDelta 不生效。
- 好感 99 时不触发赠礼。
- 到 100 后 rewardEligible。
- 已领取后不重复发奖。

挑战测试：

- 未达 100 不提问、不发奖。
- 达到 100 后设置 asked。
- correct 发奖。
- close 发奖。
- wrong 不发奖并可重试。
- 非法 itemId 拒绝。
- LLM 失败走本地挑战与赠礼兜底。

语言惩罚测试：

- 所有天使初始语言为中文。
- 好感 100 但未赠礼时仍使用中文。
- 赠礼成功后只切换当前天使，不影响其他尚未受罚天使。
- 每位天使切换到配置表指定语言。
- 重复触发不会再次播放惩罚或改变语言。
- 正确语言输入通过。
- 错误语言输入返回“听不懂”且不调用正常 Agent。
- 第一次错误语言不消耗 AP，后续错误语言消耗 AP。
- 希伯来语、希腊语、阿拉伯语 Unicode 输入可识别。
- 英语、法语、拉丁语常见短句可以区分。
- 语言无法判断时进入 unknown，不误判为正确。
- Agent 返回错误语言时切换到目标语言 fallback。
- 语言不同的 NPC 无法执行正常 `speak_to_npc`。
- 语言相同的 NPC 仍能交流。

### 21.2 API smoke

`scripts/test-world-smoke.mjs` 至少覆盖：

1. 亚当首次问候提示女人位于东边树林。
2. 女人位置变化后亚当不说过时地点。
3. 正向交流提高亚当好感。
4. 重复同类话术不会高速刷满。
5. 加百列好感 100 后主动提问。
6. 加百列正确答案获得白羽。
7. 相同状态重复请求不重复发奖。
8. 错误答案不发奖。
9. Agent 非法 grant_item 被规则层拒绝。
10. 现有正向吃果路线仍成功。
11. 现有第 12 时段失败仍可达。
12. 神明献礼与回响使用不回归。
13. 加百列赠礼后从中文切换到英语。
14. 中文继续向加百列低语时返回无法理解，不推进其他状态。
15. 英语向加百列低语时得到英语回复。
16. 拉斐尔、乌列尔、米迦勒、基路伯分别验证法语、希伯来语、拉丁语、希腊语。
17. 受罚天使与中文 NPC 的 `speak_to_npc` 被规则层拒绝。
18. 两位不同专属语言的受罚天使也无法正常互相交流。

### 21.3 E2E

`tests/e2e/world-scene-puzzles.spec.ts`：

- 进入 explore 后音频切换。
- 关闭面板后同 NPC 重开。
- 刻名石与刺猬均可独立点击。
- 伊甸之河不自动弹题。
- 点击河流打开。
- 自由文本错误后重试。
- 正确后属性页解锁情报。
- 刷新后解锁状态保存。
- 好感/挑战/奖励状态刷新后保存。
- 天使赠礼后显示言语分裂过场。
- 对话面板显示当前语言和目标语言提示。
- 输入错误语言出现无法理解反馈。
- 输入正确语言获得目标语言回复。
- 希伯来语/阿拉伯语回复采用 RTL。
- 刷新后天使仍保持惩罚后的语言。

### 21.4 视觉 smoke

`scripts/test-world-visual-smoke.mjs`：

- 不再含 blur 式 NPC 幽灵暗化。
- 刻名石锚点和刺猬锚点独立。
- 河流热点存在稳定 test id。
- 属性页有 locked/unlocked 两种展示结构。
- 挑战和奖励文案无工程词。
- 天使语言徽标与输入 placeholder 存在。
- RTL 回复容器有稳定 class/dir 属性。
- UI 不提供自动翻译按钮。

### 21.5 最终命令

按顺序运行，不要并行运行 build 和 tsc：

```bash
npm run lint
npm run build
npx tsc --noEmit
node scripts/test-scene-puzzle-rules.mjs
node scripts/test-world-visual-smoke.mjs
```

启动 Mock Provider 的生产预览后：

```bash
node scripts/test-world-smoke.mjs http://localhost:<port>
npm run test:e2e
```

预期：

- 所有新增测试通过。
- 现有桌面 e2e 通过。
- 移动端 spec 继续不进入默认门槛。

## 22. 文档同步

完成后更新：

- `docs/PROJECT_CONTEXT.md`
  - 当前阶段
  - Runtime Architecture
  - Gameplay Systems
  - AI Systems
  - Data/State/Save
  - Test & QA
  - Known Issues
  - Recent Review Notes
- 第一章对应玩法设计文档
- AI 创作记录：如果新增/重写了 NPC Prompt、挑战问题或 Agent 输出协议，应在适当文档记录用途和提示词摘要

不要：

- 把 Codex 写成核心开发工具。
- 删除旧测试历史。
- 把本任务规划文档改写成完成报告。

## 23. CodeBuddy 完成报告格式

实现结束后，在 CodeBuddy 对话中按以下格式输出：

```markdown
# 第一章场景、NPC 主动引导与关系奖励开发完成报告

## 1. 修改摘要
- ...

## 2. 新增文件
- `path`: 作用

## 3. 修改文件
- `path`: 修改内容

## 4. 关键规则
- 音频切换：
- 谜题判定：
- 好感变化：
- 挑战判定：
- 奖励重复保护：
- 言语分裂触发：
- 玩家输入语言识别：
- Agent 输出语言校验：
- NPC 间语言互通：
- Agent 失败兜底：

## 5. 旧存档迁移
- ...

## 6. 测试结果
- npm run lint:
- npm run build:
- npx tsc --noEmit:
- puzzle rules:
- visual smoke:
- world smoke:
- e2e:

## 7. 浏览器截图/人工确认
- 万物受名处：
- 伊甸之河：
- 属性页锁定/解锁：
- 天使主动试炼：
- 天使言语分裂：
- 错误语言/正确语言：
- NPC 间交流失败：

## 8. 未完成项和风险
- ...

## 9. CodeBuddy 证据链
- 本轮对话已保留：
- 核心设计决策：
- 主要调试记录：
```

## 24. Definition of Done

以下全部满足才可报告完成：

- [ ] 开场 BGM 在进入 explore 后正确淡出。
- [ ] 第一章环境音接管，且不播放 Chapter 0 对话 ambient。
- [ ] 伊甸之河水声只在对应地点叠加。
- [ ] 场景中央无黑色角色虚影或矩形暗影。
- [ ] 刻名石与刺猬位置、点击区域不拥挤、不重叠。
- [ ] 点击任意可对话 NPC 都能打开面板。
- [ ] 关闭面板后点击同一 NPC 可以重开。
- [ ] 伊甸之河进入时不自动弹题。
- [ ] 点击河流后才打开问答。
- [ ] 刻名石改为自由文本。
- [ ] 正确、接近、错误有稳定规则结果。
- [ ] 刻名石正确后获得永久回响“万物名录”。
- [ ] 属性页在获得道具前后有明确锁定/解锁差异。
- [ ] 属性页显示已见 NPC 的好感、性格和自然攻略提示。
- [ ] 通用 NPC 好感由规则层更新并 clamp 到 0-100。
- [ ] 重复相同话术不能快速刷满好感。
- [ ] 亚当首次问候可自然指引玩家寻找东边树林中的女人。
- [ ] 至少五位天使在好感 100 后主动提出问题。
- [ ] 天使回答正确或接近时通过规则层给予专属回响。
- [ ] 错误答案不发奖且允许重试。
- [ ] 所有天使在好感 100 和赠礼前始终使用中文。
- [ ] 天使赠礼完成后立即受到言语分裂惩罚。
- [ ] 每位天使切换到配置表指定的不同语言。
- [ ] 言语分裂状态跨时段、地点和刷新持久化。
- [ ] 玩家使用错误语言时，天使不能理解且不生成正常回答。
- [ ] 玩家使用正确语言时，天使只用对应语言回答。
- [ ] 第一次错误语言尝试不消耗 AP，后续错误语言按正常低语消耗 AP。
- [ ] Agent 输出错误语言时有目标语言 fallback。
- [ ] 希伯来语和阿拉伯语对话正确使用 RTL。
- [ ] 受罚天使与不同语言 NPC 无法完成正常 NPC 间对话。
- [ ] 不同专属语言的受罚天使彼此也无法正常交流。
- [ ] 语言不通的 `speak_to_npc` 不产生线索、心智变化或成功对话记录。
- [ ] UI 明确提示当前所需语言，但不提供自动翻译按钮。
- [ ] 非天使核心 NPC 在好感 100 后可给予一次性专属回响。
- [ ] 所有奖励只发一次，消耗后也不能重复领取。
- [ ] LLM 失败时主动引导、挑战和奖励仍可完成。
- [ ] 旧存档不会因缺失新字段崩溃。
- [ ] 已完成旧刻名石谜题的存档得到兼容处理。
- [ ] start → explore → ending 主闭环不回归。
- [ ] 成功与失败结局仍稳定可达。
- [ ] 神明献礼、现有回响和 NPC 工具不回归。
- [ ] 玩家可见文本不暴露 Agent、Prompt、toolCall、inputTag 等工程词。
- [ ] 没有新增明文密钥。
- [ ] lint、build、typecheck、规则测试、smoke 和桌面 e2e 通过。
- [ ] 设计文档与 `docs/PROJECT_CONTEXT.md` 已同步。
- [ ] CodeBuddy 历史对话和完成报告已保留。

## 25. 比赛展示价值

本任务完成后，Demo 可展示一条比“直接找女人对话”更完整的 AI 游戏体验：

```text
进入伊甸园，音景自然切换
↓
亚当主动提示女人去了东边
↓
玩家通过刻名石自由回答理解“万物受名”
↓
获得万物名录，开始看懂不同 NPC 的性格与关系
↓
通过自由对话提升天使好感
↓
天使主动提出哲学问题
↓
Agent 根据回答自然回应并请求赠礼
↓
规则层校验后发放回响
↓
天使因亲近蛇、交出神物而受到惩罚
↓
他的语言从中文切换为专属语言
↓
玩家必须改变自己的语言才能继续交流
↓
该天使也无法再与园中使用其他语言的 NPC 正常交谈
↓
玩家将情报与回响用于影响女人
↓
完成看树、靠近、触果、吃果的自我意识路径
```

这条链路能同时展示：

- AI NPC 自然对白。
- NPC 主动行为。
- 自由文本理解。
- 角色关系成长。
- Agent Tool Calling。
- 规则层安全校验。
- 多语言 Agent 输出与输入识别。
- 关系选择带来的永久叙事代价。
- NPC 社会关系因语言分裂发生可见变化。
- AI 失败兜底。
- 游戏世界状态与 UI 的持续反馈。

它直接服务比赛的智能 NPC、动态叙事、AI 创作成果和完整游戏原型评分项。
