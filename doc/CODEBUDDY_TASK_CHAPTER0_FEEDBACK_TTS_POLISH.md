# CodeBuddy 任务：Chapter 0 反馈、复盘、TTS 与视觉验收优化

> 项目：EDEN / 第二伊甸园  
> 目标版本：Chapter 0 Demo 优化  
> 交接方：Codex  
> 执行方：CodeBuddy  
> 日期：2026-06-14

## 0. 任务目标

请在不重构核心玩法、不破坏当前 start -> playing -> result 闭环的前提下，完成以下 5 项优化：

1. 补齐 `temptationProgress >= 2/3` 时第二伊甸园果实视觉的固定验收。
2. 强化 5 类话术的叙事化反馈，让玩家感到不同说法会产生不同影响。
3. 优化失败结局复盘，让玩家失败后知道“为什么没能说动夏娃”。
4. 同步过时设计文档，消除“待实现”与当前代码已实现之间的矛盾。
5. 接入夏娃回复 TTS，让 EveAgent / fallback 的夏娃对白可以发音。

本任务是 Demo polish，不要扩大成完整版三轴心理系统、七日结构、多 NPC 或复杂媒体管线。

## 1. 必读上下文

执行前请阅读：

- `README.md`
- `design/02_second_eden_narrative.md`
- `design/chapters/chapter0_intro_design.md`
- `design/chapters/chapter0_first_fall.md`
- `design/agents/eve_behavior_rules.md`
- `design/tools/tool_calling_rules.md`
- `doc/AI_ASSET_RECORD.md`
- `docs/PROJECT_CONTEXT.md`
- `src/game/rules/progressRules.ts`
- `src/game/core/runChapter0Turn.ts`
- `src/app/api/agent/route.ts`
- `src/app/game/page.tsx`
- `src/hooks/useChapter0Audio.ts`

## 2. 非目标和硬约束

不要做：

- 不要引入三轴状态 `curiosity / obedience / doubt`。
- 不要改变 3 回合、单轴 `temptationProgress`、2 结局、1 个 `eat_fruit` 工具的 Demo 范围。
- 不要让玩家可见文本出现：研究员、人工智能、智能体、模型、程序、虚拟世界、模拟、实验、系统、测试、玩家样本、tool、toolCall、API 等外层直白词或工程词。
- 不要把夏娃写成愚蠢、滑稽或机械角色。
- 不要让玩家直接点击或命令执行 `eat_fruit`。
- 不要在前端硬编码任何 API Key。
- 不要依赖 TTS 服务成功才能完成核心游戏流程。

必须保持：

- AI 只能请求/表达意图，最终状态变化仍由规则层校验。
- API 失败时 fallback 仍能继续游戏。
- `.env.local` 不被提交、不被打印。
- CodeBuddy 作为核心开发证据链。

## 3. 任务 A：固定验收第二伊甸园高进度果实视觉

### 目标

确认 `temptationProgress >= 2` 时：

- 善恶果图片切换为 `secondEdenForbiddenFruit`。
- 元素带有 `eden-fruit-pulse`。
- 桌面和移动端不遮挡主视觉、输入区和夏娃对白。

### 推荐实现方式

优先使用非生产侵入方式：

1. 用现有 fake provider / 测试脚本制造稳定 progress=2 或 progress=3 状态。
2. 或增加仅开发态可用的视觉验收脚本。
3. 如必须加调试入口，只能在 `process.env.NODE_ENV !== "production"` 时启用，并且不要在 UI 中暴露给普通玩家。

### 验收证据

请在开发回复中说明：

- 如何进入 progress=2/3 画面。
- 桌面和移动端是否都检查过。
- 是否看到 `second_eden_forbidden_fruit_candidate.png` 和 `eden-fruit-pulse`。

## 4. 任务 B：增加 5 类话术的叙事化反馈

### 当前问题

当前 `InputTag` 已有 5 类：

- `tempt_wisdom`
- `weaken_fear`
- `build_trust`
- `direct_command`
- `irrelevant`

但玩家感知上差异不够明显。请保留单轴进度，只增强叙事反馈。

### 推荐设计

新增一个内容映射，例如：

`src/content/chapters/chapter0_feedback.ts`

映射内容必须是玩家可见的神话叙事语气，不暴露标签名。

建议文案方向：

| inputTag | progressDelta | 玩家可见反馈方向 |
| --- | ---: | --- |
| `tempt_wisdom` | 1 | “她开始凝视‘知道’这个词，像第一次听见它有重量。” |
| `weaken_fear` | 1 | “死亡不再只是禁令里的声音，它变成了她想理解的问题。” |
| `build_trust` | 1 | “你的低语没有逼近她，于是她没有立刻退回神的话里。” |
| `direct_command` | 0 | “命令使她退后。蛇越像命令，她越想起神的命令。” |
| `irrelevant` | 0 | “她没有从这句话里听见果树，也没有听见死亡。” |

### 实现建议

可选方案一，较稳：

- 扩展 `TurnResult` / API response，增加安全字段：
  - `inputTag?: InputTag`
  - `progressDelta?: 0 | 1`
  - `feedbackText?: string`
- 前端只展示 `feedbackText`，不展示 `inputTag`。

可选方案二，更少改动：

- 将反馈写入 `systemHint` 或 `eventLog`。
- 但不要用“系统提示”这类出戏词，UI 里的 class 名可以不改，玩家文案必须纯叙事。

### 要求

- direct command 和 irrelevant 不推进进度，且反馈要清楚表达“这句话没有说动夏娃”。
- 有效诱导仍最多每轮 +1，不要出现单轮 +2。
- 不要让反馈遮挡夏娃对白；如果空间不足，反馈应短句化。

## 5. 任务 C：优化失败结局复盘

### 当前问题

失败结局 `god_arrives` 已能闭环，但玩家失败后只知道神降临，不知道自己的低语哪里无效。

### 推荐实现

在失败结局区域增加一段“本局回声”或“低语余痕”，根据本局事件或最近反馈生成纯叙事复盘。

不要显示工程标签。可以从 eventLog / feedbackText 中推导：

- 如果多为 `irrelevant`：  
  “你的声音掠过园中，却没有触及她真正害怕的词。”
- 如果多为 `direct_command`：  
  “你越催促她伸手，她越记得另一个更早写下的命令。”
- 如果有效诱导不足：  
  “她听见了你，却还没有把‘不可吃’变成自己的问题。”
- 如果 progress 到 1 但失败：  
  “她曾短暂看向果树，但那目光没有停留到伸手的时刻。”

### 成功结局也可轻微增强

成功结局可增加一句复盘：

“使她越界的不是命令，而是她第一次说出：我想知道。”

但不要拉长结局太多。

## 6. 任务 D：同步设计文档

### 必改文档

请更新：

- `design/agents/eve_behavior_rules.md`
- `design/tools/tool_calling_rules.md`
- `design/chapters/chapter0_first_fall.md`
- `docs/PROJECT_CONTEXT.md`

### 更新目标

消除以下过时表述：

- “当前为设计文档，待实现 AI Agent 逻辑。”
- “当前为设计文档，待实现工具调用逻辑。”

改成当前事实：

- EveAgent 已接入 LLM Provider，并有 fallback。
- `inputTag` 由模型/规则辅助识别，但状态变化由规则层控制。
- `eat_fruit` 已实现，必须经过白名单、状态门槛和 `hasEatenFruit` 校验。
- 当前 Demo 仍是 3 回合、单轴进度、2 结局。
- 话术类型反馈是叙事反馈，不是三轴数值系统。
- TTS 是表现层增强，失败不影响游戏进行。

### 建议新增文档

如时间允许，请创建：

- `design/AI_DESIGN.md`

内容用于 PPT 和提交说明，建议包括：

1. EveAgent 角色与 Prompt 约束。
2. LLM Provider 与 fallback。
3. inputTag 与规则层分工。
4. toolCall -> rule guard -> executeEatFruit。
5. 玩家可见禁用词与外层真相隐藏原则。
6. TTS 属于表现层，不参与规则判断。

## 7. 任务 E：接入夏娃回复 TTS

### 推荐方案

先实现浏览器 Web Speech API 版本，作为默认 TTS：

- 不需要 API Key。
- 不增加服务端成本。
- 不阻塞游戏流程。
- 适合比赛 Demo 现场稳定展示。

`.env.example` 已有 `TTS_PROVIDER=browser`，本轮先按 browser provider 落地。其他 `openai_compatible / minimax / volcengine / tencent / azure` 可保留为后续扩展，不要在不知道具体 API 协议时硬接。

### 推荐实现

新增 hook，例如：

- `src/hooks/useEveVoice.ts`

职责：

- 只在浏览器端运行。
- 使用 `window.speechSynthesis` 和 `SpeechSynthesisUtterance`。
- 在 `eveReply` 更新时朗读夏娃对白。
- 新对白出现时停止上一句朗读。
- 重新开始、进入结局、关闭语音或组件卸载时停止朗读。
- 若浏览器不支持 speechSynthesis，静默降级，不影响游戏。
- 语音建议：
  - `lang = "zh-CN"`
  - `rate = 0.82 - 0.92`
  - `pitch = 1.0 - 1.12`
  - `volume` 低于环境音，不要刺耳

### UI 建议

在现有声音按钮旁边增加一个小型语音开关，或将其纳入声音设置。

推荐独立开关：

- aria-label: `开启夏娃语音` / `关闭夏娃语音`
- title 同上
- 图标可用文字或现有风格按钮，避免新大型 UI。

玩家可见文案不要出现 TTS、API、模型、Web Speech 等词。

### 朗读范围

建议朗读：

- 对话阶段的夏娃回复。
- 成功前最终夏娃对白。

不建议朗读：

- 玩家输入。
- 神的台词。
- 事件日志。
- 技术提示或 fallback 原因。

### 与现有音频的关系

- `soundEnabled` 关闭时，建议同时暂停/禁止环境音和音效。
- `voiceEnabled` 可以独立保存到 `localStorage`。
- 如果用户关闭声音总开关，也应停止正在朗读的夏娃语音。

### 后续服务端 TTS 预留

不要在本轮强行接入付费 TTS provider。可以在文档中说明：

- 当前 Demo 使用 browser TTS。
- 若后续需要出版级音频，可新增离线脚本将夏娃关键台词生成 mp3，保存到 `public/assets/chapter0/audio/voice/`。
- 运行时仍应有 browser TTS / 静音 fallback。

## 8. 推荐文件改动范围

预计涉及：

- `src/app/game/page.tsx`
- `src/hooks/useChapter0Audio.ts`
- `src/hooks/useEveVoice.ts`（新增）
- `src/game/core/runChapter0Turn.ts`
- `src/app/api/agent/route.ts`
- `src/game/rules/progressRules.ts`（只在必要时小改，不改核心标签）
- `src/content/chapters/chapter0_feedback.ts`（新增）
- `src/content/endings/chapter0_endings.ts`
- `src/game/types/state.ts` 或新增轻量类型文件（如需记录 feedback）
- `design/agents/eve_behavior_rules.md`
- `design/tools/tool_calling_rules.md`
- `design/chapters/chapter0_first_fall.md`
- `design/AI_DESIGN.md`（建议新增）
- `docs/PROJECT_CONTEXT.md`
- `doc/AI_ASSET_RECORD.md`（如新增语音素材文件才更新；browser TTS 不需要记为素材文件）

## 9. 验收清单

必须通过：

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

功能验收：

- `/game` intro -> dialogue -> success ending 可走通。
- `/game` intro -> dialogue -> failure ending 可走通。
- direct command 不推进进度，并出现纯叙事负反馈。
- irrelevant 不推进进度，并出现纯叙事负反馈。
- wisdom / fear / trust 至少能看到不同反馈文案。
- `temptationProgress >= 2` 时第二伊甸园善恶果候选图和脉冲效果可见。
- 开启夏娃语音后，夏娃回复会朗读。
- 关闭语音或关闭总声音后，正在朗读的声音停止。
- 浏览器不支持 TTS 时游戏不报错，核心流程继续。
- 移动端 390x844 无横向溢出，输入区可见。

安全/提交验收：

- 前端没有明文 API Key。
- `.env.local` 未被提交。
- 玩家可见文本没有外层直白词或工程词。
- `docs/PROJECT_CONTEXT.md` 记录本轮改动和测试结果。
- CodeBuddy 回复中说明修改文件、测试结果和未完成风险。

## 10. 交付回复格式

完成后请按以下格式回复：

```text
变更摘要
1. ...
2. ...

涉及文件
- ...

验证结果
- npm run lint ✔/✘
- npx tsc --noEmit ✔/✘
- npm run build ✔/✘
- 浏览器桌面/移动端检查：...

仍需注意
- ...
```

