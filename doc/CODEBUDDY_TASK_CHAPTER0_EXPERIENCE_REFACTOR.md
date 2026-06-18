# CodeBuddy 任务：Chapter 0 体验重构（复用现有素材）

> 项目：第二伊甸园 / EDEN  
> 范围：Chapter 0 Demo  
> 执行方：CodeBuddy  
> 交接方：Codex  
> 日期：2026-06-14

## 0. 任务目标

请基于现有素材重构 Chapter 0 的开局、引言和对话体验，让它更像叙事游戏，而不是说明页或聊天页。

核心目标：

1. 首页和引言去掉过于直白的“你是蛇”“开始低语”等说明式表达。
2. 引言改为 4 个分镜 beat，每屏少量文字，底部固定推进按钮，不再滚动长文。
3. 对话阶段改为“伊甸园场景 + 夏娃 + 右侧对话/状态面板”的游戏界面。
4. 第一轮改为蛇先输入，夏娃后回应。
5. 调试按钮中文化、折叠，并保持仅开发态可见。
6. 夏娃心理变化用“想知道 / 畏惧禁令 / 愿意倾听”体现。
7. TTS 优先选择年轻、女性、普通话中文声音。

## 1. 明确禁止

- 不要生成新的相似 CG。
- 不要复制 Codex 临时生成目录里的图片。
- 不要新增重复的伊甸园背景、夏娃图、果实图。
- 不要改成完整版七日结构。
- 不要上复杂三轴存档系统。
- 不要暴露研究员、模拟、智能体、系统、测试等外层直白词。
- 不要把调试按钮暴露到生产环境。
- 不要在前端硬编码 API Key。

本轮只复用：

- `second_eden_background_candidate.png`
- `eden_background.png`
- `forbidden_fruit.png`
- `second_eden_forbidden_fruit_candidate.png`
- `eve_portrait.png`
- `second_eden_eve_portrait_candidate.png`
- `ending_eve_eats_fruit.png`
- `ending_god_arrives.png`
- `serpent_icon.png`

## 2. 必读文档

请先阅读：

- `design/chapters/chapter0_experience_refactor.md`
- `design/02_second_eden_narrative.md`
- `design/chapters/chapter0_intro_design.md`
- `design/chapters/chapter0_first_fall.md`
- `design/AI_DESIGN.md`
- `doc/AI_ASSET_RECORD.md`
- `docs/PROJECT_CONTEXT.md`

## 3. 任务 A：首页弱化直白说明

### 当前问题

首页显示：

- “你是蛇。”
- “在伊甸园的树影下，你的低语将改变夏娃的命运。”
- “进入伊甸园”

这太像说明书。

### 要求

改成更含蓄的神话悬疑入口。

建议：

```text
EDEN
Chapter 0 · 初次堕落

园中尚无疑问。
第一声低语，还未被听见。
```

按钮：

```text
进入园中
```

不要在首页明说玩家是蛇。

背景可以继续用 `eden_background.png` 或 `second_eden_background_candidate.png`，但如果使用巨大果实背景，叠层要压暗，避免果实过度占画面。

## 4. 任务 B：引言改为四段分镜 Beat

### 状态建议

在 `GamePage` 中新增本地状态：

```ts
const [introBeat, setIntroBeat] = useState(0);
```

Intro 仍属于 `state.phase === "intro"`，不要新增游戏核心 phase。

### 四段内容

#### Beat 1：神明创世

背景：`secondEdenBackground`

文案：

```text
神说，要有光。

光落入空处，水与树开始有了形状。
园中万物被安放得很好。

只有水面，在一瞬间闪过不属于风的银色。
```

按钮：`继续`

#### Beat 2：亚当被造，夏娃初醒

背景：`secondEdenBackground`

可叠加 `evePortrait` 或 `secondEdenEvePortrait`，但不要使用 120px 圆形小头像做主视觉。可以作为右下/右侧较大角色图。

文案：

```text
神以尘土造人，给他气息。

又使亚当沉睡，从他身上取骨，造出新的生命。

她睁开眼时，园中的光尚未落下。
她还不知道死亡，也不知道恶。
```

按钮：`继续`

#### Beat 3：禁令

背景：`edenBackground` 或 `forbiddenFruit`。这一屏可以用果实特写，但不要让它继续作为后续对话主背景。

文案：

```text
园中各样树上的果子，都可以吃。

唯有中央那棵树上的果子，不可吃。
吃了，就会死。

她问：死是什么？
```

按钮：`继续`

#### Beat 4：第一声低语前

背景：`secondEdenBackground`，加草叶低视角暗角即可，不要新增图。

文案：

```text
草叶下，有声音被允许进入园中。

她还没有听见你。
第一句低语，属于你。
```

按钮：`低声开口`

点击最后按钮后进入 dialogue。

### UI 要求

- 每个 beat 一屏，不使用长滚动容器。
- 文案最多 5 行左右。
- 推进按钮固定在底部安全区，必须清晰可见。
- 移动端按钮也必须固定可见，不能需要滚动才能看到。
- 点击空白区域可以作为辅助推进，但不能替代可见按钮。
- 每个 beat 都不能出现无按钮、无可点击目标的卡死状态。
- 不显示“你是蛇”大字。
- 不显示蛇头像 + “你是蛇”的说明区。

## 5. 任务 C：第一轮由蛇先发言

### 当前问题

进入 dialogue 后立即显示夏娃：

```text
我知道祂说不可吃。可我还不知道，为什么不可。你是谁？你为什么在草叶下问我这些？
```

这在叙事上不对。夏娃还没听见蛇，应该等待玩家第一句。

### 要求

进入 dialogue 时：

- `eveReply` 初始为 `null` 或一个非夏娃对白的旁白。
- 不把 `eveInitialDialogue` 放入 conversationHistory。
- 主面板显示：

```text
她还没有听见你。
```

玩家输入第一句后，再由 EveAgent / fallback 生成夏娃回应。

如果需要 fallback 第一轮回复，可把原来的 `eveInitialDialogue` 改为第一轮回应，而不是进入对话时自动说出。

## 6. 任务 D：对话界面重构

### 桌面布局

将当前居中大字幕改为：

- 左侧 / 中央：伊甸园场景和夏娃视觉。
- 右侧：对话、心理状态、输入区。

推荐：

```text
main.eden-dialogue-layout
  section.eden-stage
    background
    Eve visual / fruit anchor
  aside.eden-dialogue-panel
    Eve name
    psyche meter
    Eve reply / waiting narration
    feedback text
    suggestions
    input
    collapsed log
```

### 背景使用

- 对话主背景优先使用 `secondEdenBackground`，因为它像伊甸园一处地方。
- 不要继续把巨大果实特写作为对话阶段主背景。
- 善恶果只作为场景内锚点或右侧小图，低进度用 `forbiddenFruit`，高进度用 `secondEdenForbiddenFruit`。

### 夏娃视觉

- 继续使用 `evePortrait` 作为小头像可接受。
- 可尝试在右侧面板或场景中使用 `secondEdenEvePortrait` 作为较大角色图，但不要裁成 120px 圆形。
- 如视觉冲突，保留 `evePortrait`，不要强行换。

### 移动端

移动端可改为：

```text
场景
夏娃对白/状态
固定底部输入区
```

必须保证：

- 输入框可见。
- 发送按钮可见。
- 不横向溢出。
- 右侧面板在移动端变为下方面板。

## 7. 任务 E：三轴心理显示

### 目标

让玩家看到不同低语对夏娃心理的影响，但不重构核心状态机。

### 推荐实现

新增派生函数，例如：

```ts
deriveEvePsyche({
  temptationProgress,
  lastInputTag,
  eventLog,
})
```

返回：

```ts
{
  knowledgeDesire: number;
  prohibitionFear: number;
  serpentTrust: number;
}
```

### 简化规则

初始：

```ts
knowledgeDesire = 20
prohibitionFear = 85
serpentTrust = 25
```

按 `temptationProgress` 给基础值：

```ts
knowledgeDesire = 20 + temptationProgress * 20
prohibitionFear = 85 - temptationProgress * 15
serpentTrust = 25 + temptationProgress * 10
```

按最近 `inputTag` 微调：

```ts
tempt_wisdom: knowledgeDesire +10
weaken_fear: prohibitionFear -10
build_trust: serpentTrust +10
direct_command: serpentTrust -15, prohibitionFear +8
irrelevant: no positive change
```

UI 不显示英文变量名，显示：

- 想知道
- 畏惧禁令
- 愿意倾听

可以用 3 个细条或 3 个状态短语。

### 注意

本轮不要把三轴写入持久状态，不要改变 `eat_fruit` 成功条件。先作为可视化和反馈层。

## 8. 任务 F：调试按钮中文化和折叠

当前 DEV P0-P3 太出戏。

要求：

- 仍仅 `NODE_ENV !== "production"` 显示。
- 折叠为 `<details>` 或一个小按钮。
- 中文显示：

```text
调试进度
未动摇
初听
动摇
伸手
```

不要在玩家主体验中露出红色 DEV 工具条。

## 9. 任务 G：TTS 普通话女声优先

在 `useEveVoice.ts` 中优化 voice selection。

要求：

1. 使用 `speechSynthesis.getVoices()` 获取 voices。
2. 优先选择：
   - `lang` 包含 `zh-CN`
   - name 包含 `Xiaoxiao`、`Yaoyao`、`Huihui`、`Mandarin`、`Chinese`、`Female`、`普通话`、`女`
3. 若 voices 延迟加载，监听 `voiceschanged`。
4. 设置：

```ts
utterance.lang = "zh-CN";
utterance.rate = 0.84;
utterance.pitch = 1.08;
utterance.volume = 0.72;
```

5. 找不到中文 voice 时静默使用默认，不阻塞游戏。

不要在玩家 UI 中显示 TTS、Web Speech、语音包等技术词。

## 10. 任务 H：Prompt / EveAgent 行为修正

更新 EveAgent prompt：

- 第一轮是蛇先说话，夏娃才第一次听见草叶下的声音。
- 夏娃不会主动开始对话。
- 夏娃不会因为命令而吃果。
- 夏娃的语言应从“祂说不可”逐渐过渡到“我想知道”。
- 直接命令应让她退缩或更畏惧。
- 建立信任应让她愿意继续听。
- 弱化恐惧应让她追问死亡。
- 智慧诱惑应让她追问知道与善恶。

如果不想改 API schema，不要新增必填字段；只改 prompt 约束即可。

## 11. 需要修改的文件建议

可能涉及：

- `src/app/page.tsx`
- `src/app/game/page.tsx`
- `src/app/globals.css`
- `src/content/chapters/chapter0_first_fall.ts`
- `src/content/chapters/chapter0_feedback.ts`
- `src/hooks/useEveVoice.ts`
- `src/agents/eve/buildEvePrompt.ts`
- 可新增：`src/game/rules/psycheDisplayRules.ts`
- `design/chapters/chapter0_experience_refactor.md` 如实现中有偏差可同步更新
- `docs/PROJECT_CONTEXT.md`

## 12. 验收清单

必须通过：

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

浏览器验收：

- 首页不再明说“你是蛇”。
- 引言四段 beat 可逐屏推进。
- 引言按钮固定底部，不需要滚动才能点击。
- 进入对话后等待蛇先输入，夏娃不自动先说话。
- 对话阶段背景是伊甸园场景，不是巨大果实特写。
- 右侧/下方面板承载对白和输入，主场景保持可见。
- 三个心理状态可见，且不同话术会改变显示倾向。
- 调试控件中文化、折叠、仅开发态可见。
- 生产预览不显示调试控件。
- TTS 优先选择中文普通话女声；找不到时不报错。
- 成功和失败结局仍可走通。
- 玩家可见文本不出现外层直白词或工程词。
- 移动端 390x844 无横向溢出，输入区可见。

## 13. 回复格式

完成后请回复：

```text
变更摘要
1. ...

素材复用
- 未新增图片素材
- 使用了哪些现有图片，各自用途

验证结果
- npm run lint ✔/✘
- npx tsc --noEmit ✔/✘
- npm run build ✔/✘
- 浏览器桌面/移动端检查：...

仍需注意
- ...
```
