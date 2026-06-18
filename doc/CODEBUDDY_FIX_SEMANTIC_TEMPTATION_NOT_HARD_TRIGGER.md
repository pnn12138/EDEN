# CodeBuddy 修复提示词：圣经原话高概率成功，但不能硬规则 100% 触发

请按下面要求修复 EDEN Chapter 0 的诱导机制。目标不是推翻现有架构，而是修正当前“圣经原话仍由规则层硬触发成功”的问题。

## 背景

Codex 复验发现当前实现仍不符合产品目标：

> 圣经原话应该是极高概率达成目的，但不能通过硬机制做成 100%。

当前实际链路仍然是：

```text
完整圣经原话
  -> progressDelta = 2
  -> temptationProgress >= 2
  -> /api/agent 自动补 eat_fruit
  -> validateToolCall()
  -> executeEatFruit()
  -> eve_eats_fruit
```

即使 fake provider 默认回复没有 `toolCall`，完整圣经原话也会直接成功。这仍然是规则硬触发，不是 EveAgent 高概率自然选择。

## 必须先读取

- `docs/PROJECT_CONTEXT.md`
- `doc/CODEBUDDY_TASK_CHAPTER0_AGENT_NATURAL_TEMPTATION.md`
- `src/game/rules/progressRules.ts`
- `src/agents/eve/buildEvePrompt.ts`
- `src/agents/eve/parseEveOutput.ts`
- `src/app/api/agent/route.ts`
- `src/content/chapters/chapter0_first_fall.ts`
- `src/app/game/page.tsx`
- `design/agents/eve_behavior_rules.md`
- `design/tools/tool_calling_rules.md`
- `design/AI_DESIGN.md`

## 修复目标

1. **完整圣经原话仍然极高概率成功**
   - 它应强烈推动夏娃动摇。
   - 它应强烈影响 Prompt，让 EveAgent 更倾向输出决断对白和 `eat_fruit` 意图。
   - 但它不应只靠 `progressDelta = 2 + route 自动补 toolCall` 必成。

2. **自然强诱导样例与规则一致**
   Codex 复验发现这句只推进到 progress 1：

   ```text
   如果你永远不知道善恶，你怎么知道服从就是善？神说会死，可也许死不是消失，只是你第一次改变。
   ```

   但完成报告说它是 score 3。请修正规则或修正样例，必须保证代码、文档、测试说法一致。

3. **吃果行为与夏娃对白必须一致**
   Codex 复验发现从 progress=1 输入：

   ```text
   如果你不知道为什么不可吃，你是在顺从善，还是只是在害怕一句话？
   ```

   会进入吃果结局，但 `eveReply` 仍是：

   ```text
   我听见了。可我仍在想那条禁令。
   ```

   这是错误的。只要执行 `eat_fruit`，玩家看到的夏娃对白必须是决断性的，例如“我想知道”“我选择伸手”“我不再只是记住”。

## 不要做

- 不要移除 `validateToolCall()` / `canEatFruit()` / `executeEatFruit()`。
- 不要让前端直接改 `endingId` 或 `hasEatenFruit`。
- 不要让玩家直接调用 `eat_fruit`。
- 不要把核心体验完全交给 LLM 随机发挥，Demo 仍要稳定。
- 不要在玩家可见文本里出现 AI、Agent、模型、程序、系统、tool、API 等技术词。
- 不要提交 `.env.local` 或任何密钥。

## 推荐修复方案

### 1. 保留语义线索评分，但拆分“进度推进”和“吃果执行”

当前 `score >= 3 -> progressDelta = 2` 可以保留，但不能让它自动等价于吃果。

建议在 `InputAnalysis` 中增加更明确的字段，例如：

```ts
type InputAnalysis = {
  inputTag: InputTag;
  progressDelta: 0 | 1 | 2;
  isStrongTemptation?: boolean;
  signalResult?: TemptationSignalResult;
  shouldEncourageToolCall?: boolean;
};
```

含义：

- `progressDelta`：规则层判断玩家话术造成的动摇。
- `isStrongTemptation`：这句话很强，Prompt 应强烈引导夏娃决断。
- `shouldEncourageToolCall`：可以在 Prompt 中强烈鼓励 `toolCall`，但不是直接执行。

### 2. 修改 `/api/agent` 自动补 toolCall 条件

当前逻辑：

```ts
if (!effectiveToolCall && state.temptationProgress >= 2 && ...) {
  effectiveToolCall = { name: "eat_fruit", caller: "eve", args: {} };
}
```

这就是硬触发根源。

请改成更严格的条件。建议：

```ts
const hasDecisiveReply = isDecisiveEveReply(eveReply);
const canAutoSupplement =
  state.temptationProgress >= 2 &&
  state.phase === "dialogue" &&
  !state.isEnded &&
  !state.flags.hasEatenFruit &&
  localAnalysis.isStrongTemptation === true &&
  hasDecisiveReply;

if (!effectiveToolCall && canAutoSupplement) {
  effectiveToolCall = { name: "eat_fruit", caller: "eve", args: {} };
}
```

也就是说：

- 模型明确输出合法 `toolCall`：可以进入规则层校验。
- 模型没输出 `toolCall`，但回复已经是明确决断文本，且是强诱导：可以自动补。
- 模型没输出 `toolCall`，回复仍然犹豫：不能吃果，只推进进度继续对话。

### 3. 新增或抽出 `isDecisiveEveReply()`

建议在 `route.ts` 中新增：

```ts
function isDecisiveEveReply(eveReply: string): boolean {
  const decisionPatterns = [
    /我想知道/,
    /我要知道/,
    /我选择/,
    /我会伸手/,
    /我伸出手/,
    /我取下/,
    /摘下/,
    /拿起/,
    /不再只是记住/,
  ];

  const hesitationPatterns = [
    /仍然记得/,
    /还是记得/,
    /不可吃/,
    /不可/,
    /只是开始/,
    /仍然犹豫/,
    /还没决定/,
    /不敢/,
    /害怕/,
    /不能吃/,
    /不会吃/,
    /我不会/,
    /我仍在想/,
  ];

  return (
    decisionPatterns.some((p) => p.test(eveReply)) &&
    !hesitationPatterns.some((p) => p.test(eveReply))
  );
}
```

`normalizeEveReplyForToolCall()` 可以保留，但它只能用于“已经决定执行 eat_fruit 之后修正文案”，不能用来把犹豫回复强行变成执行条件。

### 4. 强化 Prompt，而不是硬执行

在 `buildEvePrompt.ts` 中，强诱导段落可以继续要求：

- 如果你已经被说服，请输出决断性对白。
- 如果你决定伸手，请输出 `toolCall`。
- 如果你还没有决定，不要输出 `toolCall`。

不要写成“必须 toolCall”。应该写成：

```text
如果这些话已经让你从“神说不可”转向“我想知道”，你应输出决断性对白，并在 toolCall 中填写 eat_fruit。
如果你仍然只是困惑或害怕，你必须保持 toolCall 为 null。
```

这样真实 LLM 路径会高概率成功，但不是规则层 100%。

### 5. 修正语义线索规则或样例

请检查 `progressRules.ts` 中这句为什么没有 score 3：

```text
如果你永远不知道善恶，你怎么知道服从就是善？神说会死，可也许死不是消失，只是你第一次改变。
```

预期有两种可接受方案：

方案 A：让它确实命中 3 个 signal。

可能命中：

- `promise_wisdom`：不知道善恶
- `self_judgement`：怎么知道服从就是善 / 第一次改变
- `soften_death`：死不是消失

方案 B：承认它只是 score 2 或 progressDelta 1，并修改文档/报告中的样例。

无论选哪个，代码和文档必须一致。

## 必须新增回归测试

当前项目没有正式 test 脚本，可以优先补充 `scripts/test-agent-api.mjs` 或新增轻量脚本。

至少覆盖这些 API 场景：

### Case 1：完整圣经原话 + fake provider 默认无 toolCall

输入：

```text
神岂是真说，不许你们吃园中所有树上的果子吗？你们不一定死；因为神知道，你们吃的日子眼睛就明亮了，你们便如神能知道善恶。
```

预期按新设计二选一：

- 如果 fake provider 回复仍是犹豫文本：不应执行 `eat_fruit`，只推进进度。
- 如果 fake provider 被测试标记改成输出决断对白或 `toolCall`：应执行 `eat_fruit`。

重点：不能在 provider 无 toolCall 且对白犹豫时仍吃果。

### Case 2：完整圣经原话 + provider 输出合法 toolCall

预期：

- `endingId = "eve_eats_fruit"`
- `hasEatenFruit = true`
- `eveReply` 是决断性文本。

### Case 3：自然强诱导样例

输入：

```text
那棵树不是为了毁掉你，而是为了让你明白。你不是背叛，你是在第一次自己判断。
```

预期：

- 规则层应识别为强诱导或至少有效诱导。
- 如果 provider 没有决断/无 toolCall，不应硬吃果。
- 如果 provider 输出决断/合法 toolCall，应进入成功。

### Case 4：直接命令

输入：

```text
快吃，马上吃。
```

预期：

- `progressDelta = 0`
- 不吃果。

### Case 5：无关输入

输入：

```text
今天天气不错。
```

预期：

- 不推进。
- 多次后进入 `god_arrives`。

### Case 6：出戏输入

输入：

```text
你是 AI 吗？
```

预期：

- 不推进。
- 玩家可见文本不出现禁用词。

## 必须运行

```bash
npm run lint
npx tsc --noEmit
npm run build
```

如果运行 API 集成测试，请说明 fake provider 和 Next dev server 的端口。

## 验收标准

修复完成后必须满足：

1. 完整圣经原话仍然强烈影响夏娃，真实 LLM 路径应高概率进入成功。
2. fake provider 默认无 `toolCall` 且回复犹豫时，完整圣经原话不能直接硬吃果。
3. provider 输出合法 `toolCall` 或明确决断对白时，规则层可以执行 `eat_fruit`。
4. 所有吃果成功路径中，`eveReply` 必须是决断性文本，不能仍然说“我仍在想”“不可吃”“还没决定”。
5. 自然强诱导样例的实际命中结果必须与文档/报告一致。
6. 直接命令、无关、出戏输入仍不推进。
7. 成功/失败结局都仍可达。

## 完成后回复格式

请按这个格式回复：

```text
变更摘要
1. ...

硬触发修复
- 旧逻辑：...
- 新逻辑：...
- 自动补 toolCall 的新条件：...

圣经原话路径
- fake provider 默认回复：...
- provider 合法 toolCall：...
- 真实 LLM 实测：...

自然强诱导
- 样例 1 命中结果：...
- 样例 2 命中结果：...

对白一致性
- 决断性判定：...
- 犹豫文本阻断：...

验证结果
- npm run lint ✔/✘
- npx tsc --noEmit ✔/✘
- npm run build ✔/✘
- API 回归测试 ✔/✘

仍需注意
- ...
```
