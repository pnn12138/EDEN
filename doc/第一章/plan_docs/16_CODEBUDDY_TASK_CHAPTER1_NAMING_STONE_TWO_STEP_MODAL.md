# 第一章·刻名石两步弹窗改造任务（CodeBuddy 执行版）

## 元信息
| 项 | 说明 |
|---|---|
| 任务版本 | v1.0 |
| 文档编号 | 16 |
| 依赖前置 | 基于当前 main 分支（commit `db61503` 之后的工作区状态）开发 |
| 影响范围 | 仅刻名石（`puzzle_naming_stone_identity`）的弹窗文案、输入框形式与提交后展示；不改动刻名石的判定/发奖/完成状态逻辑，不影响东园幽径、伊甸之河两个 choice 谜题 |
| 执行要求 | 按模块顺序开发，每模块完成后单独验证，最后统一跑门禁 |
| 铁律 | 保留所有 `data-testid`（除本文明确要求替换的）；不改 `doc/` 内除本文档外文件；不硬编码密钥；不改存档结构；不破坏旧存档兼容 |

---

## 一、背景与现状速览（供 CodeBuddy 建立上下文）

刻名石是开局场景（初始地点 `adam_garden_work`，见 `src/game/world/types.ts:493`）里的显式交互谜题。当前实现：

- **内容定义** `src/content/world/scenePuzzles.ts`：`puzzle_naming_stone_identity`，`inputMode: "free_text"`，`evaluationId: "naming_stone_meaning"`，标题「刻名石上的问题」，多行哲学式 prompt，placeholder「写下你对「名字」的理解（200字以内）…」，奖励 `clue_naming_stones` + `resonance_living_names`（万物名录）+ trust +2。
- **判定层** `src/game/world/puzzleAnswerRules.ts`：`naming_stone_meaning` 已是「任意非空输入即 `correct`」（模块 2 已移除对错判断）。
- **规则层** `src/game/world/puzzleRules.ts`：`applyFreeTextAnswer` 评估 → 发奖 → 写入 `completedScenePuzzleIds`。成功时 `result.feedback = puzzle.successFeedback`。
- **弹窗组件** `src/components/world/ScenePuzzleModal.tsx`：自由文本用 `<textarea>`（`data-testid="scene-puzzle-textarea"`），提交按钮文案「刻下回答」（`data-testid="scene-puzzle-submit"`）；成功后展示 `result.feedback` 结果块（`data-testid="scene-puzzle-feedback"`）+ 奖励列表 +「继续」按钮。
- **页面接入** `src/app/world/page.tsx`：
  - 刻名石入口按钮（`data-testid="scene-action-engraved-stone"`，class `eden-naming-stone-entry`，文案「刻名石 / 查看内容 / 已记下」），点击走 `handleNamingStoneClick`（约 1356 行）→ `openScenePuzzle` → `setActivePuzzle`。
  - `handlePuzzleChoose`（约 1380 行）POST `/api/world/puzzle`，成功后 `setPuzzleResult` / `setState` / 触发回响 Toast。
  - `handlePuzzleClose`（约 1430 行）`setActivePuzzle(null)`。
  - 弹窗渲染（约 2225 行）：`{activePuzzle && <ScenePuzzleModal ... />}`。
- **API** `src/app/api/world/puzzle/route.ts`：校验后调用 `applyScenePuzzleAnswer`，无改动需求。

> 关键结论：判定/发奖/完成态/Toast 全部由「自由文本 + 非空即正确」链路驱动。本次改造**复用这条链路**，只改弹窗的可见形态——把多行文本框换成单行姓名框，把「成功后的内嵌结果块 + 继续」换成「第二个叙事弹窗 + 离开」。

---

## 二、目标交互设计

玩家在开局场景点击「刻名石」入口后，依次出现两个简短弹窗：

### 第一个弹窗（刻名石）
| 元素 | 内容 |
|---|---|
| 标题 | `刻名石` |
| 正文 | `蛇望向石面。原本空白的石面上，缓缓浮现出一行字：「来者，留下你的名姓。」` 换行 `名字么……我叫什么来着？哦，我是——` |
| 输入框 | **单行**姓名输入框，placeholder `输入你的名字` |
| 确认按钮 | `留下名字`（loading 时显示「正在回应……」） |

提交（非空）→ 关闭第一个弹窗 → 打开第二个弹窗；同时照常走 API 判定/发奖/标记完成（保留现有交互逻辑）。

### 第二个弹窗（仅是一个念头）
| 元素 | 内容 |
|---|---|
| 标题 | `仅是一个念头` |
| 正文（动态） | `石面上浮现出：{玩家输入的名字}。仅是一瞬，文字便消失了，石面重新归于空白。` 其中 `{name}` 替换为玩家提交的姓名 |
| 按钮 | `离开` |

点击「离开」→ 关闭弹窗，刻名石入口标记为「已记下」。

> 设计要点：第二个弹窗**取代**原「内嵌结果块 + 继续」的成功展示位；奖励（万物名录等）仍照常发放，并通过既有「获得回响」Toast（独立 UI，非弹窗内）提示，不在第二个弹窗内额外罗列奖励。

---

## 三、改动范围总表

| 模块 | 文件 | 改动类型 | 要点 |
|---|---|---|---|
| 1 类型扩展 | `src/content/world/scenePuzzles.ts` | 类型新增 | `ScenePuzzle` 增加可选字段 `singleLine` / `submitText` / `secondStep` |
| 2 内容更新 | `src/content/world/scenePuzzles.ts` | 数据修改 | 刻名石条目：新标题/prompt/placeholder/单行/两步配置/`successFeedback` |
| 3 弹窗组件 | `src/components/world/ScenePuzzleModal.tsx` | 逻辑+渲染 | 单行 `<input>`；成功且有 `secondStep` 时渲染第二步 |
| 4 文案微调 | `src/game/world/puzzleAnswerRules.ts` | 文案 | 空输入 feedback 改为姓名语境 |
| 5 样式 | `src/app/globals.css` | 新增 | `.eden-scene-puzzle-input` 单行输入框样式 |
| 6 e2e 测试 | `tests/e2e/chapter1-mechanics.spec.ts` | 用例改写 | 刻名石用例改为两步弹窗断言 |

> **无需改动**：`src/game/world/puzzleRules.ts`、`src/app/api/world/puzzle/route.ts`、`src/app/world/page.tsx`（接入逻辑保持不变）、`scripts/test-scene-puzzle-rules.mjs`、`scripts/test-world-visual-smoke.mjs`、`scripts/test-world-smoke.mjs`。原因见各模块验收与第五节测试影响说明。

---

## 四、模块1：类型扩展（`src/content/world/scenePuzzles.ts`）

### 需求来源
单行输入与两步弹窗是刻名石专属需求，需在 `ScenePuzzle` 类型上以**可选字段**表达，保证对东园幽径、伊甸之河零影响。

### 具体实现
在 `ScenePuzzle` 类型末尾（`failure` 字段之后）追加：

```ts
export type ScenePuzzle = {
  id: string;
  locationId: EdenLocationId;
  timeOfDay?: TimeOfDay;
  trigger: "on_enter" | "explicit_interaction";
  inputMode: ScenePuzzleInputMode;
  /** 自由文本评估器 ID（free_text 时使用） */
  evaluationId?: string;
  title: string;
  prompt: string;
  /** 自由文本占位符 */
  placeholder?: string;
  options?: ScenePuzzleOption[];
  /** 自由文本判定成功标签（仅用于兼容展示，规则真相在 puzzleAnswerRules） */
  successTags?: string[];
  successFeedback: string;
  rewards: ScenePuzzleReward;
  failure: {
    hint: string;
    attentionDelta?: number;
  };
  // ---- 新增（可选）：单行输入 + 两步弹窗，仅刻名石使用 ----
  /** free_text 模式下渲染为单行 <input>（默认多行 textarea） */
  singleLine?: boolean;
  /** free_text 提交按钮文案（默认「刻下回答」） */
  submitText?: string;
  /** 成功后展示第二步弹窗（标题 / 正文模板 / 确认按钮文案） */
  secondStep?: {
    title: string;
    /** 正文模板，支持 {name} 占位符，替换为玩家提交文本 */
    promptTemplate: string;
    confirmText?: string;
  };
};
```

### 验收
✅ `npx tsc --noEmit` 0 错误（新增字段全为可选，向后兼容）<br>
✅ 东园幽径 / 伊甸之河条目不引用新字段，行为不变

---

## 五、模块2：刻名石内容更新（`src/content/world/scenePuzzles.ts`）

### 需求来源
将刻名石条目的文案与配置改为两步弹窗所需形态。

### 具体实现
把 `SCENE_PUZZLES` 数组里 `id: "puzzle_naming_stone_identity"` 的整条替换为：

```ts
{
  id: "puzzle_naming_stone_identity",
  locationId: "adam_garden_work",
  trigger: "explicit_interaction",
  inputMode: "free_text",
  evaluationId: "naming_stone_meaning",
  title: "刻名石",
  prompt:
    "蛇望向石面。原本空白的石面上，缓缓浮现出一行字：「来者，留下你的名姓。」\n名字么……我叫什么来着？哦，我是——",
  placeholder: "输入你的名字",
  singleLine: true,
  submitText: "留下名字",
  secondStep: {
    title: "仅是一个念头",
    promptTemplate:
      "石面上浮现出：{name}。仅是一瞬，文字便消失了，石面重新归于空白。",
    confirmText: "离开",
  },
  successTags: ["understanding"],
  successFeedback:
    "石上的字一闪而逝，归于空白。但那一瞬你看见了——名字让一个生命被看见、被理解。你记住了「万物名录」。",
  rewards: {
    clueId: "clue_naming_stones",
    itemId: "resonance_living_names",
    trustDelta: 2,
  },
  failure: {
    hint: "石面没有回应。先说出你想被记住的名字。",
  },
},
```

### 说明
- `inputMode` 仍为 `free_text`、`evaluationId` 不变 → 判定/发奖/完成态链路零改动。
- `successFeedback` 用于成功后的回响 Toast（`handlePuzzleChoose` 里 `narration: result.feedback`），改为与「字一闪而逝」叙事一致的短句；万物名录仍在此句中点明。
- `failure.hint` 与空输入 feedback 仅在直接调用 API 的极端路径出现（UI 上空输入时提交按钮禁用，见模块3），改为姓名语境保持文案一致。
- prompt 中 `\n` 配合弹窗 `whiteSpace: pre-line` 在「石上字」与「蛇的内心」之间换行；末尾「——」引导视线到下方输入框。
- 标点统一使用中文全角（「」、——、……），与既有文案风格一致。

### 验收
✅ 标题字段为 `刻名石`；placeholder 为 `输入你的名字`；`singleLine: true`；`submitText: 留下名字`<br>
✅ `secondStep.title` 为 `仅是一个念头`；`promptTemplate` 含 `{name}` 占位符；`confirmText: 离开`<br>
✅ 奖励字段（`clueId`/`itemId`/`trustDelta`）与改造前一致，不丢奖

---

## 六、模块3：弹窗组件重构（`src/components/world/ScenePuzzleModal.tsx`）

### 需求来源
- 第一步：单行 `<input>` 替代 `<textarea>`，提交按钮文案取 `submitText`。
- 提交成功且配置了 `secondStep`：渲染第二步（标题/动态正文/「离开」按钮），**取代**原内嵌结果块 + 「继续」按钮。
- 保留现有弹窗结构（backdrop、close ×、kicker、title、prompt 容器、options 分支、result 块对非两步谜题的兼容）。

### 具体实现
用以下内容**整文件替换** `src/components/world/ScenePuzzleModal.tsx`：

```tsx
import { useState } from "react";
import type { ScenePuzzle } from "@/content/world/scenePuzzles";
import type { ScenePuzzleAnswerResult } from "@/game/world/puzzleRules";

type ScenePuzzleChoicePayload = { optionId: string };
type ScenePuzzleFreeTextPayload = { answerText: string };
export type ScenePuzzleChoosePayload =
  | ScenePuzzleChoicePayload
  | ScenePuzzleFreeTextPayload;

type ScenePuzzleModalProps = {
  puzzle: ScenePuzzle;
  result: ScenePuzzleAnswerResult | null;
  isLoading?: boolean;
  onChoose: (payload: ScenePuzzleChoosePayload) => void;
  onClose: () => void;
};

const SINGLE_LINE_MAX_LENGTH = 24;

export default function ScenePuzzleModal({
  puzzle,
  result,
  isLoading = false,
  onChoose,
  onClose,
}: ScenePuzzleModalProps) {
  const hasSucceeded = result?.success === true;
  const isFreeText = puzzle.inputMode === "free_text";
  const isSingleLine = isFreeText && puzzle.singleLine === true;
  const hasSecondStep = Boolean(puzzle.secondStep);
  const showSecondStep = hasSucceeded && hasSecondStep;
  const [freeText, setFreeText] = useState("");
  const trimmed = freeText.trim();

  const secondStepTitle = puzzle.secondStep?.title ?? puzzle.title;
  const secondStepPrompt = puzzle.secondStep
    ? puzzle.secondStep.promptTemplate.replace(/\{name\}/g, trimmed || "……")
    : "";
  const secondStepConfirm = puzzle.secondStep?.confirmText ?? "离开";
  const submitLabel = puzzle.submitText ?? "刻下回答";

  return (
    <div className="eden-scene-puzzle-backdrop" role="presentation">
      <section
        className="eden-scene-puzzle-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="eden-scene-puzzle-title"
        data-testid="scene-puzzle-modal"
      >
        <button
          type="button"
          className="eden-scene-puzzle-close"
          onClick={onClose}
          aria-label="关闭问答"
          data-testid="scene-puzzle-close"
        >
          x
        </button>

        <p className="eden-scene-puzzle-kicker">场景问题</p>
        <h2
          id="eden-scene-puzzle-title"
          className="eden-scene-puzzle-title"
          data-testid="scene-puzzle-title"
        >
          {showSecondStep ? secondStepTitle : puzzle.title}
        </h2>
        <p
          className="eden-scene-puzzle-prompt"
          data-testid="scene-puzzle-prompt"
          style={{ whiteSpace: "pre-line" }}
        >
          {showSecondStep ? secondStepPrompt : puzzle.prompt}
        </p>

        {!showSecondStep && isFreeText && (
          <div className="eden-scene-puzzle-freetext" aria-label="自由回答">
            {isSingleLine ? (
              <input
                type="text"
                className="eden-scene-puzzle-input"
                value={freeText}
                placeholder={puzzle.placeholder ?? ""}
                maxLength={SINGLE_LINE_MAX_LENGTH}
                disabled={isLoading || hasSucceeded}
                onChange={(event) => setFreeText(event.target.value)}
                data-testid="scene-puzzle-input"
              />
            ) : (
              <textarea
                className="eden-scene-puzzle-textarea"
                value={freeText}
                placeholder={puzzle.placeholder ?? "写下你的回答……"}
                disabled={isLoading || hasSucceeded}
                onChange={(event) => setFreeText(event.target.value)}
                data-testid="scene-puzzle-textarea"
                rows={5}
              />
            )}
            <button
              type="button"
              className="eden-btn eden-btn--primary eden-scene-puzzle-submit"
              disabled={isLoading || hasSucceeded || trimmed.length === 0}
              onClick={() => onChoose({ answerText: trimmed })}
              data-testid="scene-puzzle-submit"
            >
              {isLoading ? "正在回应……" : submitLabel}
            </button>
          </div>
        )}

        {!showSecondStep && !isFreeText && (
          <div className="eden-scene-puzzle-options" aria-label="回答选项">
            {(puzzle.options ?? []).map((option) => {
              const selected = result?.selectedOptionId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`eden-scene-puzzle-option ${selected ? "eden-scene-puzzle-option--selected" : ""}`}
                  disabled={isLoading || hasSucceeded}
                  onClick={() => onChoose({ optionId: option.id })}
                  data-testid="scene-puzzle-option"
                  data-option-id={option.id}
                >
                  {option.text}
                </button>
              );
            })}
          </div>
        )}

        {!showSecondStep && result && (
          <div
            className={`eden-scene-puzzle-result ${
              result.success ? "eden-scene-puzzle-result--success" : "eden-scene-puzzle-result--failure"
            }`}
            data-testid="scene-puzzle-feedback"
          >
            <p>{result.feedback}</p>
            {result.rewards.length > 0 && (
              <ul className="eden-scene-puzzle-rewards" data-testid="scene-puzzle-reward">
                {result.rewards.map((reward, index) => (
                  <li key={`${reward.type}-${reward.id ?? reward.title}-${index}`}>
                    {reward.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {showSecondStep ? (
          <button
            type="button"
            className="eden-btn eden-btn--primary eden-scene-puzzle-confirm"
            onClick={onClose}
            data-testid="scene-puzzle-confirm"
          >
            {secondStepConfirm}
          </button>
        ) : (
          hasSucceeded && (
            <button
              type="button"
              className="eden-btn eden-btn--primary eden-scene-puzzle-confirm"
              onClick={onClose}
            >
              继续
            </button>
          )
        )}
      </section>
    </div>
  );
}
```

### 行为说明
- **第一步**：`showSecondStep` 为 false，渲染 `puzzle.title`（刻名石）/`puzzle.prompt`/单行 `<input>`（`scene-puzzle-input`）/提交按钮（`scene-puzzle-submit`，文案「留下名字」）。空输入时按钮禁用，无法提交。
- **提交**：`onChoose({ answerText: trimmed })` → 父组件 `handlePuzzleChoose` 走 API → 成功后 `setPuzzleResult(result)` 使 `hasSucceeded=true` → 因 `secondStep` 存在，`showSecondStep` 变 true。
- **第二步**：渲染 `secondStep.title`（仅是一个念头）/`secondStepPrompt`（`{name}` 已替换为 `trimmed`，即玩家输入的名字）/「离开」按钮（`scene-puzzle-confirm`）。原内嵌结果块与「继续」按钮在此模式下不渲染。
- **关闭**：「离开」或 close × 调 `onClose` → `handlePuzzleClose` → `setActivePuzzle(null)`，弹窗卸载，`useState` 重置。刻名石入口因 `completedScenePuzzleIds` 已含该 id 而显示「已记下」。
- **对 choice 谜题零影响**：choice 谜题无 `secondStep`，`showSecondStep` 恒为 false，走原 options + result + 继续 分支。
- **`scene-puzzle-textarea` testid 保留**：仅刻名石从 textarea 切到 input；若未来有别的 free_text 谜题未设 `singleLine`，仍用 textarea。

### 验收
✅ 点击刻名石 → 弹窗标题「刻名石」，单行输入框可见（`scene-puzzle-input`），placeholder「输入你的名字」，按钮「留下名字」<br>
✅ 空输入时「留下名字」禁用；输入名字后可提交<br>
✅ 提交后弹窗切换为标题「仅是一个念头」，正文含「石面上浮现出：{输入的名字}。」，按钮「离开」<br>
✅ 点击「离开」弹窗关闭，刻名石入口变「已记下」；回响 Toast 照常出现<br>
✅ 东园幽径 / 伊甸之河弹窗行为不变（options + 结果块 + 继续）

---

## 七、模块4：判定层文案微调（`src/game/world/puzzleAnswerRules.ts`）

### 需求来源
`naming_stone_meaning` 的空输入 feedback 文案「请写下你的回答。」改为姓名语境，保持文案一致。**判定逻辑不变**（任意非空即 correct）。

### 具体实现
定位 `evaluateFreeTextAnswer` 内 `naming_stone_meaning` 分支（约 81-93 行），将空输入返回的 feedback：

```ts
return { grade: "wrong", feedback: "请写下你的回答。" };
```

改为：

```ts
return { grade: "wrong", feedback: "请先输入你的名字。" };
```

> 其余 `EVALUATORS.naming_stone_meaning` 的 `successFeedback`/`closeFeedback`/`failureFeedback` 在成功路径上不会被使用（`applyFreeTextAnswer` 成功时取 `puzzle.successFeedback`），可不动；如需文案统一可一并改为姓名叙事，但不强制。

### 验收
✅ `evaluateFreeTextAnswer("", "naming_stone_meaning")` 仍返回 `grade: "wrong"`（测试只断言 grade，不受影响）<br>
✅ 非空输入仍返回 `grade: "correct"`

---

## 八、模块5：样式（`src/app/globals.css`）

### 需求来源
单行输入框需要与既有 textarea 一致的深色统一风格。

### 具体实现
在 `.eden-scene-puzzle-textarea::placeholder` 规则之后（约 6466 行后）追加：

```css
/* 刻名石单行姓名输入框 */
.eden-scene-puzzle-input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid rgba(220, 200, 150, 0.3);
  border-radius: 8px;
  background: rgba(12, 18, 12, 0.8);
  color: #e8d8b8;
  font-size: 0.95rem;
  line-height: 1.5;
}

.eden-scene-puzzle-input::placeholder {
  color: rgba(232, 216, 184, 0.5);
}

.eden-scene-puzzle-input:focus {
  outline: none;
  border-color: rgba(241, 216, 143, 0.58);
  background: rgba(12, 18, 12, 0.92);
}

.eden-scene-puzzle-input:disabled {
  opacity: 0.7;
  cursor: default;
}
```

### 验收
✅ 单行输入框为深色半透明、金色描边风格，与 textarea / 选项按钮视觉统一<br>
✅ 聚焦时描边高亮；禁用时降低透明度

---

## 九、模块6：e2e 测试更新（`tests/e2e/chapter1-mechanics.spec.ts`）

### 需求来源
原「刻名石自由文本」用例（约 96-112 行）依赖 `scene-puzzle-textarea` 与 `scene-puzzle-feedback`，二者在两步弹窗下不再出现，需改写为两步弹窗断言。

### 具体实现
将 `test("刻名石自由文本：提交中文理解可成功并获得回响", ...)` 整段替换为：

```ts
  test("刻名石两步弹窗：输入名字后展示一念之间并获得回响", async ({ page }) => {
    await startFreshChapter(page);

    const stone = page.getByTestId("scene-action-engraved-stone");
    await expect(stone).toBeVisible();
    await stone.click();

    // 第一步：刻名石
    await expect(page.getByTestId("scene-puzzle-modal")).toBeVisible();
    await expect(page.getByTestId("scene-puzzle-title")).toHaveText("刻名石");
    const nameInput = page.getByTestId("scene-puzzle-input");
    await expect(nameInput).toBeVisible();
    await nameInput.fill("低语者");
    await page.getByTestId("scene-puzzle-submit").click();

    // 回响 Toast 仍出现（万物名录照常发放）
    await expect(page.locator(".eden-resonance-gained-toast")).toBeVisible();

    // 第二步：仅是一个念头
    await expect(page.getByTestId("scene-puzzle-title")).toHaveText("仅是一个念头");
    await expect(page.getByText("石面上浮现出：低语者。")).toBeVisible();
    await page.getByTestId("scene-puzzle-confirm").click();

    // 弹窗关闭，刻名石标记为已记下
    await expect(page.getByTestId("scene-puzzle-modal")).toHaveCount(0);
    await expect(stone).toContainText("已记下");
  });
```

### 验收
✅ 该用例在 `npm run test:e2e -- tests/e2e/chapter1-mechanics.spec.ts --project=desktop-chromium` 下通过<br>
✅ 同文件「伊甸之河」「NPC 重开」「设置浮窗」用例不受影响

---

## 十、测试影响说明（为何部分测试无需改动）

| 测试文件 | 是否需改 | 原因 |
|---|---|---|
| `scripts/test-scene-puzzle-rules.mjs` | 否 | 断言均针对 `grade`/`success`/`alreadyCompleted`/`inventory`/`itemCounts`，不涉及弹窗 UI 文案；`evaluateFreeTextAnswer` 空输入仍 `wrong`、非空仍 `correct`；`applyScenePuzzleAnswer` 发奖与「只发一次」逻辑不变；`SCENE_PUZZLES.length===3` 不变 |
| `scripts/test-world-visual-smoke.mjs` | 否 | 关键断言：3 个 puzzle id 仍在 `scenePuzzles.ts`（256 行）；`eden-naming-stone-entry` + `handleNamingStoneClick` 仍在 `page.tsx`（258 行）；`刻名石` 文本仍在（263 行，入口按钮 `<span>刻名石</span>` 保留）；`ScenePuzzleModal`+`activePuzzle` 仍在（260 行）；CSS `.eden-scene-puzzle-modal`+`.eden-scene-puzzle-option` 仍在（266 行，options 分支保留） |
| `scripts/test-world-smoke.mjs` | 否 | 仅引用 `naming_stone_bank` 地点（四河分流），与刻名石谜题无关 |
| `tests/e2e/chapter1-mechanics.spec.ts` | **是** | 刻名石用例改写（模块6） |

> 提交前仍需实际跑一遍以上三个脚本，确认全绿。

---

## 十一、整体验收清单

### 1. 静态检查
✅ `npx tsc --noEmit` 0 错误<br>
✅ `npm run lint` 无错误（警告可保留）<br>
✅ `npm run build` 构建成功

### 2. 自动化测试
✅ `node scripts/test-scene-puzzle-rules.mjs` 全绿（断言数不变）<br>
✅ `node scripts/test-world-visual-smoke.mjs` 全绿<br>
✅ `node scripts/test-world-smoke.mjs` 全绿<br>
✅ `npm run test:e2e -- tests/e2e/chapter1-mechanics.spec.ts --project=desktop-chromium` 全部通过（含改写后的刻名石用例）

### 3. 功能回归（人工）
✅ 开局进入 `adam_garden_work`，点击「刻名石」→ 第一个弹窗（标题「刻名石」、单行输入、按钮「留下名字」）<br>
✅ 输入名字提交 → 第二个弹窗（标题「仅是一个念头」、正文含输入的名字、按钮「离开」），回响 Toast 出现<br>
✅ 点击「离开」→ 弹窗关闭，入口变「已记下」；再次点击入口给出「已经被记下」提示而不重开<br>
✅ 东园幽径自动弹窗、伊甸之河显式弹窗行为不变<br>
✅ 旧存档兼容：读取已完成的存档，刻名石入口显示「已记下」，不报错

---

## 十二、注意事项

1. **不动判定/发奖/完成态逻辑**：`inputMode` 保持 `free_text`、`evaluationId` 保持 `naming_stone_meaning`；`puzzleRules.ts` / `api/world/puzzle/route.ts` / `page.tsx` 接入逻辑不改。奖励（万物名录 / 线索 / 好感）照常发放，仅展示形态变化。
2. **保留 testid**：`scene-puzzle-modal` / `scene-puzzle-title` / `scene-puzzle-prompt` / `scene-puzzle-submit` / `scene-puzzle-close` / `scene-puzzle-option` / `scene-puzzle-feedback` / `scene-puzzle-reward` / `scene-action-engraved-stone` 全部保留；新增 `scene-puzzle-input`（单行输入）、`scene-puzzle-confirm`（第二步「离开」按钮，复用既有 confirm class）。
3. **kicker 保留**：两步弹窗均保留顶部小标签「场景问题」（属既有结构，最小改动）；如设计上希望第二步隐藏可后续单独调整，本次不做。
4. **第二步正文取本地 `freeText.trim()`**：弹窗组件在提交后不卸载，`freeText` 保留所输入名字，用于 `{name}` 替换；关闭后重新打开因组件卸载而重置。
5. **空输入提交按钮禁用**：单行模式下 `trimmed.length === 0` 时「留下名字」禁用，空输入失败路径在 UI 不可达；判定层空输入 feedback 仅为兜底。
6. **标点统一**：中文全角（「」、——、……），与既有文案一致；`promptTemplate` 中 `{name}` 为占位符，正则 `/\{name\}/g` 全量替换。
7. **不改 `doc/` 内除本文档外文件**；不提交临时日志/未用资源。

---

## 十三、给 CodeBuddy 的执行建议

1. **顺序**：模块1（类型）→ 模块2（内容）→ 模块3（弹窗组件）→ 模块4（判定文案）→ 模块5（CSS）→ 模块6（e2e）。每模块完成后 `npx tsc --noEmit`。
2. **先类型后内容**：模块1 加完可选字段再改模块2 数据，避免 TS 报未知字段。
3. **模块3 用整文件替换**：本文给出的 `ScenePuzzleModal.tsx` 是完整新文件，直接覆盖；替换后逐项核对 testid 与 choice 分支未变。
4. **模块6 改完务必跑 e2e**：这是唯一断言变化的测试，确认两步弹窗切换与「已记下」状态正确。
5. **门禁**：最后统一跑第十节四个脚本 + tsc/lint/build；任一红则修复后再提交。
6. **提交信息**：`[优化] 第一章刻名石改为两步弹窗（刻名石 → 仅是一个念头）`，备注保留判定/发奖逻辑不变。
