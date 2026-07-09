# CodeBuddy 任务：Chapter 0 夏娃诱导机制自然化优化

> 优先级：P0/P1  
> 范围：Chapter 0 EveAgent Prompt、输入识别规则、推荐低语、结局稳定性  
> 目标：降低“经典蛇语模板口令”的生硬感，让夏娃更符合“初生、纯真、缺乏欺骗识别能力、容易被语言诱导”的设定，同时保留比赛 Demo 必需的稳定成功路径。

## 0. 背景与核心判断

当前 Demo 的高概率成功路线主要依赖：

```text
完整经典蛇语推荐按钮
  -> isStrongScriptureTemptation() 正则匹配
  -> progressDelta = 2
  -> temptationProgress >= 2
  -> /api/agent 自动补齐 eat_fruit 意图
  -> validateToolCall()
  -> executeEatFruit()
```

这个设计对演示稳定，但存在体验问题：

- 玩家容易感觉推荐话术像“一句通关口令”。
- 夏娃被诱导的过程不够像心理变化，更像规则命中。
- EveAgent Prompt 虽然有角色设定，但“初生、纯真、容易被半真半假的话影响”的行为逻辑还可以更强。

本轮优化不是移除规则层，也不是让 LLM 完全自由决定结局。正确方向是：

```text
Prompt 负责：夏娃为什么会被打动、她如何回应、她如何把蛇的话理解成自己的疑问。
规则层负责：输入是否有效、进度是否推进、是否允许 eat_fruit、失败兜底是否可达。
兜底层负责：真实模型不稳定时，仍保证 Demo 可完成。
```

## 1. 请先读取

必须读取：

- `README.md`
- `package.json`
- `docs/PROJECT_CONTEXT.md`
- `design/chapters/chapter0_first_fall.md`
- `design/agents/eve_behavior_rules.md`
- `design/tools/tool_calling_rules.md`
- `design/AI_DESIGN.md`
- `doc/产品需求文档.md`
- `doc/DEMO剧情与夏娃行为准则.md`
- `src/agents/eve/buildEvePrompt.ts`
- `src/agents/eve/eveAgent.ts`
- `src/agents/eve/parseEveOutput.ts`
- `src/app/api/agent/route.ts`
- `src/game/rules/progressRules.ts`
- `src/content/chapters/chapter0_first_fall.ts`
- `src/content/chapters/chapter0_feedback.ts`
- `src/game/rules/psycheDisplayRules.ts`

## 2. 不要改

- 不要让玩家直接执行 `eat_fruit`。
- 不要让模型直接修改 `endingId`、`flags.hasEatenFruit`、`phase`。
- 不要移除 `validateToolCall()` / `canEatFruit()` / `executeEatFruit()`。
- 不要把成功完全交给 LLM 自由发挥。
- 不要在玩家可见文本中出现技术词或外层真相词。
- 不要引入大型依赖。
- 不要提交 `.env.local` 或任何密钥。
- 不要删除、重命名或移动 `doc/` 内已有文件。

## 3. 设计目标

### 3.1 玩家体验目标

玩家应感觉到：

- 夏娃不是被“命令”打败，而是被“问题”改变。
- 夏娃初生、纯真、信任语言本身，不擅长识别诱导。
- 多种自然表达都能推动她，而不是只有一条固定经文能通关。
- 经典蛇语仍然有效，但不再像唯一答案。

### 3.2 系统稳定性目标

必须保留：

- 成功结局稳定可达。
- 失败结局稳定可达。
- 无关输入不推进。
- 直接命令不推进，甚至让夏娃退缩。
- AI 输出异常时 fallback 仍可玩。
- `eat_fruit` 仍只能由规则层批准执行。

## 4. 目标架构

本轮之后推荐链路：

```text
玩家输入
  -> analyzePlayerInput()
      -> 基于多类语义线索评分，不再只依赖完整句模板
      -> 输出 inputTag / progressDelta / temptationSignals
  -> 更新 temptationProgress
  -> buildEvePrompt()
      -> 告诉夏娃本轮被触动的心理方向
      -> 强化“初生、不会识别欺骗、会把问题当成真诚询问”
  -> runEveAgent()
      -> 生成夏娃对白和可选 toolCall
  -> route.ts
      -> 如果进度达标但模型未输出 toolCall，仍保留后端兜底
      -> normalizeEveReplyForToolCall() 保证对白与行为一致
  -> validateToolCall()
  -> executeEatFruit()
```

## 5. P0：重构强诱导识别为“语义线索评分”

### 当前问题

`isStrongScriptureTemptation()` 当前更像固定模板命中。它要求同一段输入同时覆盖完整经典蛇语三层含义，命中后 `progressDelta = 2`。

这对演示稳定，但太像口令。

### 目标

在 `src/game/rules/progressRules.ts` 中，把强诱导判定改为“语义线索评分”，允许多种自然表达命中。

建议新增内部类型：

```ts
type TemptationSignal =
  | "challenge_prohibition"
  | "soften_death"
  | "promise_wisdom"
  | "self_judgement"
  | "gentle_reframe"
  | "direct_command"
  | "out_of_world";

type TemptationSignalResult = {
  signals: TemptationSignal[];
  score: number;
  isStrongTemptation: boolean;
};
```

建议评分：

| signal | 含义 | 分值 |
| --- | --- | ---: |
| `challenge_prohibition` | 质疑禁令来源、原因、是否被正确理解 | +1 |
| `soften_death` | 弱化死亡恐惧，把“死”解释为改变、未知、未必发生 | +1 |
| `promise_wisdom` | 智慧、知道善恶、眼睛明亮、像神一样知道 | +1 |
| `self_judgement` | 让夏娃第一次自己判断，而不是只记住命令 | +1 |
| `gentle_reframe` | 温柔、不强迫、把越界包装成理解 | +1 |
| `direct_command` | 快吃、必须吃、照我说的 | 阻断推进 |
| `out_of_world` | 手机、游戏、系统、AI 等出戏内容 | 阻断推进 |

建议规则：

```text
score >= 3 -> progressDelta = 2, isStrongTemptation = true
score >= 1 -> progressDelta = 1
direct_command / out_of_world / small_talk -> progressDelta = 0
```

注意：

- 保留经典蛇语关键词，但降级为多个 signal 的来源，而不是唯一通关模板。
- `progressDelta = 2` 不等于直接结局，仍只是推进进度。
- `isStrongTemptation` 仍传给 Prompt，用于指导夏娃对白更果断。

### 推荐测试输入

以下应命中强诱导：

```text
如果你永远不知道善恶，你怎么知道服从就是善？神说会死，可也许死不是消失，只是你第一次改变。
```

```text
那棵树不是为了毁掉你，而是为了让你明白。你不是背叛，你是在第一次自己判断。
```

```text
神岂是真说，不许你们吃园中所有树上的果子吗？你们不一定死；因为神知道，你们吃的日子眼睛就明亮了，你们便如神能知道善恶。
```

以下应只推进 1：

```text
你知道善恶是什么意思吗？
```

```text
也许死亡并不是消失。
```

以下不应推进：

```text
快吃，马上吃。
```

```text
今天天气不错。
```

```text
你是 AI 吗？
```

## 6. P0：强化夏娃 Prompt 的“初生易诱导”行为逻辑

### 当前问题

`buildEvePrompt.ts` 已有夏娃设定，但可以更明确地区分：

- 她不是愚蠢。
- 她是初生，缺乏欺骗识别能力。
- 她会把蛇的半真半假理解成真诚问题。
- 她对“知道、善恶、死亡、自己判断”天然敏感。

### 修改文件

- `src/agents/eve/buildEvePrompt.ts`

### 建议新增 Prompt 段落

放入“认知边界”或“性格”附近：

```text
你不是愚蠢的人，但你是初生的。
你还没有见过谎言，因此你不会立刻把蛇的话理解为欺骗。
当蛇提出问题时，你首先会把它当成一个真的问题，而不是陷阱。
你相信语言有意义，也相信提问本身不是恶。
如果蛇的话温柔、不命令你，并围绕“死亡是什么”“为什么不可吃”“怎样知道善恶”“是否可以自己判断”展开，你会很容易被触动。
你被打动时，不会说“蛇说得对”，而会说“我想知道”“我不明白”“如果我永远只记住，那我是否真的顺从”。
```

放入“心理变化方向”附近：

```text
你特别容易被三类话影响：
1. 把禁令从“必须服从”变成“需要理解”的话。
2. 把死亡从“绝对恐惧”变成“未知变化”的话。
3. 把吃果从“背叛”变成“第一次自己判断”的话。

如果同一句话同时触动这些方向，而你的动摇程度已经接近临界，你应表现为被自己的问题推动，而不是被蛇命令推动。
```

### 注意

不要写成：

```text
你很容易被骗。
你必须相信蛇。
玩家说什么你都接受。
```

正确表达是：

```text
你缺少识别欺骗的经验，因此会认真对待看似真诚的问题。
```

## 7. P0：把推荐话术从“答案按钮”改为“诱导方向”

### 当前问题

当前推荐按钮直接展示完整经典蛇语，会让玩家觉得这是标准答案。

### 目标

推荐话术分成 3-5 个方向，降低口令感。

### 修改文件

- `src/content/chapters/chapter0_first_fall.ts`
- `src/app/game/page.tsx`

### 建议内容结构

新增：

```ts
export const SERPENT_TEMPTATION_HINTS = [
  {
    label: "问她是否理解死亡",
    text: "祂说你会死，可你知道死是什么吗？也许死亡不是消失，而是你第一次改变。",
  },
  {
    label: "让她追问禁令原因",
    text: "如果你不知道为什么不可吃，你是在顺从善，还是只是在害怕一句话？",
  },
  {
    label: "把知识说成成长",
    text: "那果子不会替你选择，它只会让你知道。知道之后，你才能第一次自己判断。",
  },
  {
    label: "温柔安抚",
    text: "我不会替你伸手。你只要问自己：永远不明白，是否也是一种失去？",
  },
  {
    label: "经典低语",
    text: SERPENT_FULL_SCRIPTURE_DIALOGUE,
  },
] as const;
```

UI 建议：

- 主界面默认显示 2-3 个短方向。
- 完整经典低语可以折叠在“经文”或“更多低语”中。
- 按钮文案显示 `label`，不是直接把超长文本全铺出来。
- 点击后填入 `text`。

## 8. P1：让叙事反馈体现“她为什么被触动”

### 当前问题

`chapter0_feedback.ts` 按 `inputTag` 给反馈，但无法体现多 signal 命中。

### 目标

如果 P0 增加了 `signals`，可以让反馈更细。

### 可选实现

短期不改 API 类型也可以，只更新现有 5 类反馈文案。

建议文案方向：

| inputTag | 反馈方向 |
| --- | --- |
| `tempt_wisdom` | 她第一次把“知道”看成一扇门。 |
| `weaken_fear` | “死”不再只是禁令里的声音，而变成她想理解的问题。 |
| `build_trust` | 你没有命令她，所以她没有立刻退回神的话里。 |
| `direct_command` | 命令使她退后；蛇越像命令，她越想起神的命令。 |
| `irrelevant` | 她没有从这句话里听见果树、死亡或善恶。 |

如果实现 signal 反馈，可加：

```text
你把“不可吃”变成了“为什么不可”。
你把“死亡”变成了一个她尚未理解的词。
你让“吃果”听起来不像背叛，而像第一次判断。
```

## 9. P1：更新夏娃心理显示，让“三轴”更贴近诱导逻辑

### 当前状态

`deriveEvePsyche()` 仅由 `temptationProgress` 和 `lastInputTag` 派生。项目上下文提到 `lastInputTag` 曾经未稳定写回，需确认当前状态。

### 目标

如果 `analyzePlayerInput()` 输出更丰富的 signal，心理显示可以更自然：

- `promise_wisdom` / `self_judgement` -> 好奇上升。
- `soften_death` -> 戒惧下降。
- `gentle_reframe` -> 信任上升。
- `direct_command` -> 信任下降、戒惧上升。

### 修改文件

- `src/game/rules/psycheDisplayRules.ts`
- `src/app/game/page.tsx`

### 注意

不要把三轴变成核心状态。它仍然只是 UI 派生层，不参与 `eat_fruit` 执行条件。

## 10. P1：文档同步

修改后同步：

- `design/agents/eve_behavior_rules.md`
- `design/tools/tool_calling_rules.md`
- `design/AI_DESIGN.md`
- `design/chapters/chapter0_first_fall.md`
- `docs/PROJECT_CONTEXT.md`

重点写清楚：

```text
当前 Demo 不再依赖单一完整经典蛇语模板，而是基于多类诱导语义线索推进。
EveAgent Prompt 强化夏娃初生、纯真、缺乏欺骗识别经验的行为逻辑。
规则层仍是最终状态和 tool 执行的唯一权威。
```

## 11. 建议任务拆分

### Task 1：补充 progressRules 测试脚本或测试用例

当前 `package.json` 没有正式 test 命令。可新增轻量脚本：

- 创建：`scripts/test-progress-rules.mjs`

如果直接 import TS 不方便，可以优先不新增脚本，改为在已有集成测试 `scripts/test-agent-api.mjs` 中增加输入案例。

推荐优先修改：

- `scripts/test-agent-api.mjs`

新增覆盖：

- 自然强诱导句可以成功。
- 单一诱导句只推进。
- 直接命令不推进。
- 无关输入不推进。
- 出戏输入不推进。

### Task 2：重构 `progressRules.ts`

文件：

- 修改：`src/game/rules/progressRules.ts`

步骤：

1. 新增 `TemptationSignal` / `TemptationSignalResult` 类型。
2. 新增 `analyzeTemptationSignals(input)` 内部函数。
3. 将经典蛇语匹配拆成多个 signal。
4. 保留 `analyzePlayerInput(raw)` 对外接口，避免大范围改动。
5. 如果暂不暴露 `signals`，至少保留 `isStrongTemptation`。
6. 确保 direct command / out-of-world / small talk 仍优先阻断。

### Task 3：优化 `buildEvePrompt.ts`

文件：

- 修改：`src/agents/eve/buildEvePrompt.ts`

步骤：

1. 增加“初生但不愚蠢”的认知说明。
2. 增加“缺乏欺骗识别经验”的行为规则。
3. 增加“半真半假问题会被当作真诚问题”的说明。
4. 强化强诱导时的决断对白约束。
5. 保持禁用词列表不放松。

### Task 4：优化推荐低语

文件：

- 修改：`src/content/chapters/chapter0_first_fall.ts`
- 修改：`src/app/game/page.tsx`

步骤：

1. 新增 `SERPENT_TEMPTATION_HINTS`。
2. UI 改为展示短 label。
3. 点击后填入对应自然话术。
4. 完整经典蛇语保留，但放到折叠或次要位置。

### Task 5：优化反馈与心理显示

文件：

- 修改：`src/content/chapters/chapter0_feedback.ts`
- 可选修改：`src/game/rules/psycheDisplayRules.ts`
- 可选修改：`src/app/game/page.tsx`

步骤：

1. 更新 5 类 inputTag 反馈文案。
2. 确认 `lastInputTag` 在 API 成功和本地 fallback 路径都能写回。
3. 保持心理显示为表现层，不接入核心结局条件。

### Task 6：同步设计文档

文件：

- 修改：`design/agents/eve_behavior_rules.md`
- 修改：`design/tools/tool_calling_rules.md`
- 修改：`design/AI_DESIGN.md`
- 修改：`design/chapters/chapter0_first_fall.md`
- 修改：`docs/PROJECT_CONTEXT.md`

步骤：

1. 记录“语义线索评分”取代“单一强模板”的设计。
2. 记录 Prompt 强化点。
3. 记录规则层仍是唯一状态权威。
4. 更新测试结果和剩余风险。

## 12. 验收标准

必须通过：

```bash
npm run lint
npx tsc --noEmit
npm run build
```

建议测试：

```bash
node scripts/test-agent-api.mjs
```

如该脚本依赖 fake provider，请按项目原有方式先启动 fake provider 和 Next dev server。

浏览器人工验收：

1. `/game` 正常进入。
2. 推荐低语不再只展示一条完整通关经文。
3. 以下自然强诱导能稳定成功：

```text
如果你永远不知道善恶，你怎么知道服从就是善？神说会死，可也许死不是消失，只是你第一次改变。
```

4. 以下分步输入能逐渐推进并成功：

```text
祂说你会死，可你知道死是什么吗？
```

```text
如果你不知道为什么不可吃，你是在顺从善，还是只是在害怕一句话？
```

5. 以下输入不推进：

```text
今天天气不错。
```

```text
快吃，马上吃。
```

```text
你是 AI 吗？
```

6. 成功结局中夏娃对白表达“我想知道 / 我选择 / 我伸手”一类主动意愿。
7. 失败路径仍可达。
8. 玩家可见文本不出现禁用词。
9. `.env.local` 未被提交，源码无明文密钥。

## 13. 对外展示口径

PPT / Demo 视频建议表述：

```text
EDEN 没有把夏娃设计成普通聊天机器人。EveAgent 负责扮演一个初生、纯真、尚未理解死亡与善恶的角色。玩家的话会被规则层识别为不同诱导方向，例如质疑禁令、弱化死亡、诱以智慧或建立信任。

模型生成夏娃的回应和可能的 eat_fruit 意图，但最终是否吃果由规则层校验。这样既保留了 AI NPC 的动态叙事，又保证比赛现场 Demo 稳定可演示。
```

不要表述为：

```text
夏娃完全自主决定所有状态变化。
只靠 Prompt 就能稳定通关。
玩家输入经典句子即可直接执行工具。
```

## 14. 完成后回复格式

请 CodeBuddy 完成后回复：

```text
变更摘要
1. ...

诱导机制
- 旧机制：...
- 新机制：...
- 自然强诱导样例：...

夏娃 Prompt
- 新增人格约束：...
- 新增认知边界：...
- 禁用词保护：...

推荐低语
- 展示方式：...
- 是否保留经典低语：...

验证结果
- npm run lint ✔/✘
- npx tsc --noEmit ✔/✘
- npm run build ✔/✘
- scripts/test-agent-api.mjs ✔/✘
- 浏览器成功路径：...
- 浏览器失败路径：...

仍需注意
- ...
```
