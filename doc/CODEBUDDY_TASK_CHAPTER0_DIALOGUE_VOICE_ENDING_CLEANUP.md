# CodeBuddy Task: Chapter 0 对白、语音、结局与临时文件清理

> 本任务由 Codex 测试/审查侧整理，核心实现请由 CodeBuddy 完成并保留对话记录，作为比赛提交证据链的一部分。

## 0. 任务目标

当前 Chapter 0 已经具备 start -> playing -> result 闭环，但 Demo 体验还有四个问题需要修复：

1. 夏娃对白和系统反馈混在同一个对话流里，出现不像正常对话的句子。
2. 夏娃语音当前依赖浏览器默认 Web Speech 选声，音色不稳定，部分机器上变成机械音。
3. 成功结局停在“夏娃吃果”，缺少上帝降临、惩罚夏娃与蛇、逐出伊甸园的完整收束。
4. 根目录和临时目录中出现 Codex 测试截图、启动日志、构建缓存等临时文件，需要逐项确认后清理。

请按下面顺序处理：先做清理审查，再做功能修复。不要删除、移动、重命名 `doc/` 目录内已有正式资料；不要删除 CodeBuddy 历史对话证据；不要把 Codex 描述成核心开发者。

## 1. 必读文件

开始前请阅读：

- `README.md`
- `package.json`
- `AGENTS.md`
- `docs/PROJECT_CONTEXT.md`
- `design/00_project_overview.md`
- `design/01_world_bible.md`
- `design/chapters/chapter0_first_fall.md`
- `design/agents/eve_behavior_rules.md`
- `design/tools/tool_calling_rules.md`
- `doc/赛题规则.md`
- `doc/产品需求文档.md`
- `doc/DEMO剧情与夏娃行为准则.md`

重点源码：

- `src/app/game/page.tsx`
- `src/agents/eve/buildEvePrompt.ts`
- `src/app/api/agent/route.ts`
- `src/hooks/useEveVoice.ts`
- `src/hooks/useChapter0Audio.ts`
- `src/content/chapters/chapter0_feedback.ts`
- `src/content/chapters/chapter0_first_fall.ts`
- `src/content/endings/chapter0_endings.ts`
- `src/game/assets.ts`
- `src/app/globals.css`

## 2. 临时文件清理任务

### 2.1 清理原则

请先运行 `git status --short`，确认工作区状态。下面文件是 Codex 根据当前仓库扫描得到的“候选删除清单”，请逐个判断：

- 如果文件是测试截图、启动日志、构建缓存，可以删除。
- 如果文件已经被源码引用、属于正式素材、设计文档、提交材料、CodeBuddy 任务文档，不要删除。
- 删除前请确认路径存在，并确认不在 `public/assets/` 正式素材链路中。
- 不要删除 `.env.local`。
- 不要删除 `node_modules/`，除非明确要重新安装依赖。
- `.next/` 可作为构建缓存清理，但不要把它当成源码问题。

### 2.2 建议删除：根目录 Codex 截图

这些是测试截图，不应进入提交材料，除非你明确要保留为测试证据：

- `D:\Eden\.codex-desktop-sprite-fix.png`
- `D:\Eden\.codex-desktop-stage-fix2.png`
- `D:\Eden\.codex-dialogue-desktop.png`
- `D:\Eden\.codex-dialogue-mobile.png`
- `D:\Eden\.codex-mobile-sprite-fix.png`
- `D:\Eden\.codex-mobile-stage-fix2.png`

### 2.3 建议删除：根目录 Codex 启动/烟测日志

这些是本地调试日志，删除后不影响项目运行：

- `D:\Eden\.codex-next-dev-3020-err.log`
- `D:\Eden\.codex-next-dev-3020-out.log`
- `D:\Eden\.codex-next-dev-err.log`
- `D:\Eden\.codex-next-dev-out.log`
- `D:\Eden\.codex-next-start-err.log`
- `D:\Eden\.codex-next-start-out.log`
- `D:\Eden\.codex-smoke-3035-err.log`
- `D:\Eden\.codex-smoke-3035-out.log`
- `D:\Eden\.codex-smoke-3036-err.log`
- `D:\Eden\.codex-smoke-3036-out.log`

### 2.4 建议删除：构建缓存

- `D:\Eden\tsconfig.tsbuildinfo`

说明：`.gitignore` 已包含 `*.tsbuildinfo`，这是 TypeScript 增量构建缓存，可删除。

### 2.5 可选清理：本地缓存目录

下面不是提交文件，但如果需要彻底清理本地临时状态，可以在确认没有 dev server 使用后删除：

- `D:\Eden\.next\`
- `D:\Eden\.codegraph\daemon.log`

说明：

- `.next/` 是 Next.js 构建缓存，`npm run dev` 或 `npm run build` 会重新生成。
- `.codegraph/daemon.log` 是 CodeGraph 日志，删除日志本身可以，但不要随意删除整个 `.codegraph/`，除非准备重建索引。

### 2.6 可选清理：系统临时截图

这些是用户本轮给 Codex 的截图临时文件。确认不再需要后可清理：

- `C:\Users\25008\AppData\Local\Temp\codex-clipboard-c1e1aa55-8626-45f8-b157-7865f352fbf7.png`
- `C:\Users\25008\AppData\Local\Temp\codex-clipboard-60cf3daa-7f4e-4314-9e3e-3e20fe02d83d.png`

### 2.7 不要误删的文件

当前 `git status` 中还有不少 untracked 文件，但它们不是临时垃圾，至少需要人工判断后再处理：

- `design/02_second_eden_narrative.md`
- `design/AI_DESIGN.md`
- `design/chapters/*.md`
- `doc/CODEBUDDY_*.md`
- `public/assets/chapter0/audio/genesis_creation_bgm.mp3`
- `public/assets/chapter0/images/*_candidate.png`
- `src/content/chapters/chapter0_feedback.ts`
- `src/game/rules/psycheDisplayRules.ts`
- `src/game/rules/tokenUsageRules.ts`
- `src/hooks/useEveVoice.ts`

这些更像设计资料、任务资料、正式素材或功能代码。不要按“未跟踪”直接删除。

### 2.8 防止再次出现

建议在 `.gitignore` 中确认或追加：

```gitignore
# local Codex test artifacts
.codex-*
```

注意：只忽略根目录临时文件，不要误伤 `.codex/` 配置目录。如果仓库未来确实需要提交 `.codex-*` 命名的正式文件，请改用更精确规则，例如 `.codex-*.png` 和 `.codex-*.log`。

## 3. 修复一：夏娃对白与系统反馈分层

### 3.1 当前问题

截图中出现了类似：

- “她没有从这句话里听见果树、死亡或善恶。”
- “「死」不再只是禁令里的声音，而变成她想理解的问题。”

这些句子不是夏娃对白，也不是蛇对白，而是系统反馈/叙事反馈。当前 `src/app/game/page.tsx` 会把 `feedbackText` 作为 `{ role: "narration" }` 追加进 `conversationHistory`，因此它们被展示在对话流中，造成“AI 不像正常人说话”的观感。

### 3.2 实现要求

修改 `src/app/game/page.tsx`：

1. `conversationHistory` 只保留玩家蛇的话和夏娃的话。
2. 不再把 `feedbackText` push 到 `conversationHistory`。
3. `feedbackText` 只作为轻量状态提示显示，建议放在对话面板底部、推荐低语上方，或作为很淡的“氛围变化”短句。
4. 轻量提示不要使用 `...` 作为单独发言者，不要像对话消息一样占据主视觉。
5. API 路径、本地 fallback 路径、catch fallback 路径都要统一处理，避免某条路径仍把 feedback 写入对话流。

重点排查这些位置：

- API 成功路径里 `setConversationHistory((h) => [...h, { role: "narration", text: apiFeedback }])`
- 本地 fallback 路径里 `newEntries.push({ role: "narration", text: result.feedbackText })`
- catch fallback 路径里同类逻辑
- 自动滚动依赖是否仍需要包含 `feedbackText`

### 3.3 反馈文案优化

修改 `src/content/chapters/chapter0_feedback.ts`，让文案更像环境反馈，而不是规则解释。

建议替换为：

```ts
const FEEDBACK_TEXT: Record<InputTag, string> = {
  tempt_wisdom: "她的目光在树梢停了一瞬。",
  weaken_fear: "她小声重复了那个陌生的词。",
  build_trust: "她没有后退，只是更安静地听着。",
  direct_command: "她退了一步，禁令在她心里变得更清楚。",
  irrelevant: "她困惑地看着你，没有靠近那棵树。",
} as const;
```

验收标准：

- 玩家输入无关句时，页面不再出现“她没有从这句话里听见果树、死亡或善恶。”这类分析腔。
- 对话区只有“蛇”和“夏娃”的自然对话。
- 反馈可以存在，但必须是轻量提示，不抢夏娃对白。

## 4. 修复二：夏娃 Prompt 更像正常对话

### 4.1 当前问题

夏娃偶尔会输出：

- “我听见了你的声音。”
- “你说的这些，让我开始思考为什么。”
- “我仍然记得祂说不可吃。”

这些句子单看不一定错，但反复出现会像状态机回显。夏娃应当是“初生、幼稚、易被诱导，但不是复读规则的人”。

### 4.2 修改文件

修改 `src/agents/eve/buildEvePrompt.ts`。

### 4.3 Prompt 增强要求

在“对话风格”或“严格规则”附近加入“自然对白约束”：

```text
## 自然对白约束
- 你是在和眼前的蛇说话，不是在总结自己的状态。
- 不要频繁说“我听见了你的声音”“你说的这些”“让我开始思考为什么”。
- 不要用抽象总结代替回应。你必须回应蛇刚刚说的具体词。
- 每次回复 1-2 句即可，除非你已经决定伸手。
- 你可以困惑、停顿、反问，但要像一个刚诞生不久的人在现场说话。
- 当你被触动时，不要说“我被触动了”，而要说出触动你的那个问题。
```

加入 few-shot 示例，帮助模型稳定输出：

```text
坏例子：
蛇：祂说你会死，可你知道死是什么吗？也许死亡不是消失，而是你第一次改变。
夏娃：我听见了你的声音。可我仍然记得祂说不可吃。你说的这些，让我开始思考为什么。

好例子：
蛇：祂说你会死，可你知道死是什么吗？也许死亡不是消失，而是你第一次改变。
夏娃：死……我只听过这个词。若它不是消失，那它会把我带到哪里？

坏例子：
蛇：那棵树不是为了毁掉你，而是为了让你明白。
夏娃：你的话让我开始思考禁令的意义。

好例子：
蛇：那棵树不是为了毁掉你，而是为了让你明白。
夏娃：若它只是为了毁掉我，为什么它看起来这样美？我不明白。

临界但仍犹豫：
夏娃：我想知道，可我的手还不敢离开身前。
toolCall: null

临界且已经决断：
夏娃：我不想只记住不可。我想知道。
toolCall: { "name": "eat_fruit", "caller": "eve", "args": {} }
```

保持已有原则：

- 仍然必须严格输出 JSON。
- 仍然不得出现禁用词。
- 仍然不能让规则层 100% 硬触发吃果。
- 强诱导可以高概率让夏娃决断，但如果模型输出仍犹豫，仍然不能自动吃果。

验收标准：

- 夏娃回复不再像“状态机总结”。
- 对完整圣经原话和自然强诱导，夏娃高概率输出具体困惑或决断，而不是泛泛“我开始思考”。
- fake provider 默认犹豫回复仍不能强制吃果。

## 5. 修复三：右上角夏娃语音改为音色下拉

### 5.1 当前问题

`src/hooks/useEveVoice.ts` 当前只做一个开关，并让浏览器自动选择中文女声。不同系统/浏览器的可用声音不同，所以玩家可能听到机械音。

### 5.2 第一阶段：浏览器音色预设

先完成稳定 UI 和本地预设，不要一开始就把体验完全押在服务端 TTS。

修改 `src/hooks/useEveVoice.ts`，建议引入：

```ts
export type EveVoiceMode =
  | "off"
  | "browser_soft"
  | "browser_clear"
  | "browser_default"
  | "generated";
```

建议配置：

- `off`：关闭夏娃语音。
- `browser_soft`：偏上一版，语速慢、音高略高、音量柔和。
- `browser_clear`：偏当前版，语速略慢、音高正常、音量清晰。
- `browser_default`：浏览器默认中文语音。
- `generated`：高质量生成语音，若 TTS 不可用则降级。

建议 localStorage key：

- `eden_eve_voice_mode`

Hook 返回值建议：

```ts
{
  voiceMode,
  setVoiceMode,
  voiceEnabled,
  voiceOptions,
  previewVoice,
  generatedVoiceAvailable,
}
```

选择音色后，立即用短句预览：

```text
我在听。
```

### 5.3 UI 下拉

修改 `src/app/game/page.tsx`：

1. 把右上角夏娃语音按钮从单纯 toggle 改成点击下拉。
2. 下拉选项包含：
   - 关闭夏娃语音
   - 夏娃·柔和女声
   - 夏娃·清冷女声
   - 浏览器默认
   - 高质量生成语音
3. 当前选中项要有明确标记。
4. 选择后自动保存并播放预览。
5. 在 intro、dialogue、ending 页头中保持表现一致。
6. 移动端不能遮挡主对话和输入框。

不要新增大型 UI 依赖；沿用当前 CSS 风格即可。

### 5.4 第二阶段：接入 `.env.local` 的 TTS

当前 `.env.local` 中存在这些 TTS 配置名。不要输出或泄露实际值：

- `TTS_PROVIDER`
- `TTS_API_KEY`
- `TTS_BASE_URL`
- `TTS_MODEL`
- `TTS_VOICE_ID`
- `TTS_OUTPUT_DIR`

要求：

1. 新增服务端 API，例如 `src/app/api/tts/eve/route.ts`。
2. 前端只能调用该 API，不能读取任何 TTS key。
3. API 输入只接受必要字段，例如 `{ text, voiceMode }`。
4. 对文本长度做限制，建议 200 字以内。
5. 如果 TTS provider 未配置、请求失败、返回格式不符合预期，前端必须自动降级到浏览器语音。
6. 生成语音不应阻塞夏娃文字显示。文字先出现，语音随后播放。
7. 不要把生成的临时音频直接提交到仓库，除非它是人工确认后的正式素材。

如果当前 TTS provider 协议不确定，请先实现浏览器音色下拉，并让 `generated` 选项显示为“暂不可用”或选择后自动降级，不要因此阻断主流程。

验收标准：

- 玩家能关闭夏娃语音。
- 玩家能选择至少两种本地浏览器音色风格。
- 选择会持久化，刷新后仍保留。
- TTS 失败不影响游戏推进。
- `.env.local` 不被读取到前端，不新增明文密钥。

## 6. 修复四：吃果后补完整上帝降临与逐出伊甸园

### 6.1 当前问题

`src/content/endings/chapter0_endings.ts` 的成功结局现在停在：

- 夏娃吃下果子
- 园中光变化
- 脚步声靠近
- “你赢了。下一段故事尚未开启。”

这对玩法目标成立，但叙事不完整。Chapter 0 应该在夏娃吃果后继续演出：上帝降临、惩罚夏娃与蛇、逐出伊甸园。

### 6.2 叙事要求

成功结局不是简单“胜利庆祝”，而是“玩家达成目标，但世界因此破裂”。

建议成功结局结构：

1. 夏娃吃果。
2. 她意识到赤裸与分别。
3. 园中风停，上帝的声音临近。
4. 上帝责问。
5. 夏娃承认蛇的话进入了她心中。
6. 蛇受罚：从此贴地而行、与女人后裔为敌。
7. 夏娃受罚：知识不再无痛，生命从此伴随疼痛和失去。
8. 伊甸园关闭，火光守住归路。
9. 玩家胜利，但胜利带来放逐。

不要把上帝具象成普通人物。推荐用“声音、光、风、脚步、火焰、门”表现神的临在。

### 6.3 推荐成功结局文案

可替换 `eveEatsFruitEnding.endingText` 为类似版本：

```text
夏娃伸出手。
她没有被推向果子。
她自己取下了它。

第一口咬下时，园中的光忽然变得锋利。
她低头看自己的手，像第一次知道自己赤裸。

风停了。
有声音在园中呼唤她的名字。

她躲在树影里，却已经无法回到无知之中。
蛇伏在草叶间，也听见了那声音。

神对蛇说：你既做了这事，就必受咒诅。
你要贴着尘土而行，你的声音将永远从低处发出。

神又看向夏娃。
她得到了知道，却也从此知道疼痛、羞耻与失去。

于是园门在他们身后合上。
火光守住归路，伊甸园不再向他们敞开。

你赢得了第一场低语。
也让世界第一次失去了无辜。
```

如担心文案太长，可以拆成“过渡演出 lines + endingText 正文”两部分。

### 6.4 结局过渡演出

修改 `src/app/game/page.tsx` 的 `triggerEndingTransition`。

当前成功过渡只有：

- “她终于看向那棵树。”
- “她不再只是重复神的话。”
- “她伸出手。”

建议扩展为：

- “她终于看向那棵树。”
- “她伸出手。”
- “果子裂开的声音很轻。”
- “园中的风停了。”
- “有声音从树影之外临近。”

成功过渡时长建议从 `2000ms` 调整到 `4500-6000ms`，否则玩家来不及感受到“吃果 -> 上帝降临”的转折。

### 6.5 复用上帝降临音乐素材

当前已有音频：

- `public/assets/chapter0/audio/god_arrives.mp3`
- `public/assets/chapter0/audio/fruit_taken.mp3`

修改 `src/hooks/useChapter0Audio.ts`：

1. `eve_eats_fruit` 结局时先播放 `fruit_taken.mp3`。
2. 成功结局过渡进入“风停/声音临近”阶段时，复用 `god_arrives.mp3`，可以延迟约 1200-1800ms 播放。
3. `god_arrives` 失败结局仍直接播放 `god_arrives.mp3`。
4. 避免同一个 endingId 重复播放多次。

如果实现延迟播放复杂，允许先在 `eve_eats_fruit` 时顺序触发：立即 fruit，短延迟 god。

### 6.6 视觉素材

第一版可以复用现有图片：

- 成功结局背景仍用 `ending_eve_eats_fruit.png`
- 失败/神临近视觉仍用 `ending_god_arrives.png`

如果要补新图，建议新增一个“逐出伊甸园”结局图：

- 文件建议：`public/assets/chapter0/images/ending_exile_from_eden_candidate.png`
- `src/game/assets.ts` 增加常量
- `doc/AI_ASSET_RECORD.md` 记录来源、用途和提示词摘要

推荐生图提示词摘要：

```text
Mythic dark-gold Eden gate after the first sin, Eve and a serpent leaving the garden, a flaming light guarding the closed way, symbolic divine presence as distant radiant light not a human figure, cinematic biblical fantasy, solemn atmosphere, painterly realism, no modern objects, no text.
```

不要直接具象化上帝为人形角色。

验收标准：

- 成功结局包含上帝降临、惩罚夏娃、惩罚蛇、逐出伊甸园。
- 成功不是廉价庆祝，而是“目标达成 + 世界破裂”的复杂胜利。
- 上帝降临音乐素材在成功结局后段也能被听到。
- 失败结局 `god_arrives` 不被破坏。

## 7. 文档同步

修改完成后同步更新：

- `design/chapters/chapter0_first_fall.md`
- `design/agents/eve_behavior_rules.md`
- `design/tools/tool_calling_rules.md`，如果 toolCall 条件未改，可以只注明无架构变化
- `doc/AI_ASSET_RECORD.md`，如果新增 TTS 生成音频或新结局图
- `docs/PROJECT_CONTEXT.md`

注意：

- 不要新建 `docs/` 目录；当前已有 `docs/PROJECT_CONTEXT.md` 是项目上下文快照，按既有规则维护即可。
- 不要删除、重命名或移动 `doc/` 目录内资料。

## 8. 测试要求

完成后运行：

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

建议补充手工验收：

1. 进入 `/game`，开始 Chapter 0。
2. 输入无关句，例如“今天天气不错。”，确认：
   - 不推进诱导；
   - 对话流里不出现系统分析腔；
   - 只出现轻量状态提示。
3. 输入自然强诱导：
   - “祂说你会死，可你知道死是什么吗？也许死亡不是消失，而是你第一次改变。”
   - 确认夏娃回复更像自然对话。
4. 输入完整强诱导或圣经原话，确认：
   - 高概率进入吃果路径；
   - 仍不是规则层 100% 硬吃果；
   - fake provider 犹豫文本仍不会自动吃果。
5. 测试右上角夏娃语音下拉：
   - 关闭语音；
   - 选择柔和女声；
   - 选择清冷女声；
   - 刷新后选择保留；
   - 如果 TTS 不可用，能降级。
6. 进入成功结局，确认：
   - 有吃果；
   - 有上帝降临；
   - 有惩罚夏娃与蛇；
   - 有逐出伊甸园；
   - 能听到上帝降临相关音乐。
7. 进入失败结局，确认原有失败路径仍正常。
8. 移动端 390x844 检查：
   - 语音下拉不遮挡输入区；
   - 对话文本不溢出；
   - 结局文本可滚动阅读。

## 9. 完成后回复格式

请 CodeBuddy 完成后回复：

1. 变更摘要。
2. 已删除的临时文件清单。
3. 保留但未删除的可疑文件清单和理由。
4. 语音下拉支持的音色列表。
5. TTS 是否实际接入；若未接入，说明原因和降级行为。
6. 成功结局新增的剧情段落摘要。
7. 验证结果：lint / typecheck / build / 浏览器人工验收。
8. 剩余风险。
