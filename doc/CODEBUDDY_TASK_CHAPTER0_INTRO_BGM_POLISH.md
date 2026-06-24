# CodeBuddy Task: Chapter 0 引言音乐与开场体验优化

> 任务用途：交给 CodeBuddy 执行开发、调试和验证。  
> Codex 角色：需求整理、测试验收、风险提示。  
> 目标：让 `/game` 的创世引言阶段具备背景音乐，并让引言到对话阶段的听觉过渡更完整。

---

## 0. 给 CodeBuddy 的总提示词

你是本项目的核心开发工具 CodeBuddy。请基于本文件完成 Chapter 0 Demo 引言音乐接入与开场体验优化，并保留完整 CodeBuddy 对话记录，供比赛提交时作为开发证据链。

本任务只做“引言音乐与开场体验优化”，不要顺手大改核心玩法、结局规则、LLM Provider、Agent 架构或右侧浮窗面板。右侧面板、人物/蛇信息架构、EveAgent prompt 深度优化可作为后续独立任务处理。

请严格遵守：

```text
1. 不在前端硬编码任何 API Key 或服务密钥。
2. 不删除、移动、重命名 doc/ 目录内已有文件。
3. 不让浏览器端直接引用 doc/ 引言素材路径，正式运行资源必须放到 public/assets/。
4. 音频缺失或浏览器阻止播放时，游戏不能报错，必须静默降级。
5. 玩家可见文本不得出现 AI / Agent / NPC / 模型 / 程序 / 沙盒 / 系统 等元叙事词。
6. 核心闭环 start -> playing -> result 不得被破坏。
7. CodeBuddy 负责实现；Codex 后续只做测试和验收。
```

---

## 1. 必读上下文

开始修改前请阅读：

```text
README.md
package.json
AGENTS.md
design/00_project_overview.md
design/01_world_bible.md
design/chapters/chapter0_first_fall.md
design/agents/eve_behavior_rules.md
design/tools/tool_calling_rules.md
doc/赛题规则.md
doc/产品需求文档.md
doc/DEMO剧情与夏娃行为准则.md
doc/引言/素材需求文档.md
docs/PROJECT_CONTEXT.md
```

重点关注：

```text
1. Chapter 0 当前是 7 回合核心试玩章节。
2. 引言阶段为四段 Beat：创世光被造 -> 园被安置 -> 亚当与夏娃 -> 禁令与第一声低语。
3. 当前 useChapter0Audio 只在 dialogue/ending 相关阶段处理环境音和音效，还没有 intro BGM。
4. `doc/引言/素材需求文档.md` 已定义 `genesis_creation_bgm.mp3` 作为创世引言音乐。
```

---

## 2. 已准备素材

用户已找到创世引言背景音乐：

```text
源文件：
D:\Eden\doc\引言\audio\freesound_community-ethereal-ambient-music-55115.mp3

文件大小：
1,559,520 bytes，约 1.49 MiB

目标运行文件名：
genesis_creation_bgm.mp3

目标运行路径：
public/assets/chapter0/audio/genesis_creation_bgm.mp3
```

请将源文件复制到目标运行路径，并保持目标文件名稳定。不要让页面直接引用 `D:\Eden\doc\引言\audio\...`。

如果目标文件已存在，请比较大小或试听确认后再覆盖；不要误删其他音频。

---

## 3. 体验目标

玩家进入 `/game` 后，引言阶段应有低音量、神圣克制、空旷缓慢的背景音乐，服务以下体验：

```text
1. Beat 1 “起初，地是空虚混沌”开始后，玩家感到创世的空旷与神圣。
2. 音乐不抢正文阅读，不盖过点击、低语和结局音效。
3. 玩家继续点击 Beat 时，音乐不中断。
4. 从引言进入对话阶段时，创世音乐平滑淡出，伊甸园环境音平滑接管。
5. 关闭声音按钮可以停止所有当前音乐；再次开启后能按当前阶段恢复对应音乐。
6. 重新开始游戏回到 intro 时，音乐状态合理重置，不叠加播放多个实例。
```

建议音量：

```text
创世引言 BGM：0.12 - 0.22
伊甸园环境音：保持当前 0.15 或按实际听感微调
发送/进度/结局音效：保持清晰，但不能刺耳
```

---

## 4. 实现范围

### 4.1 素材路径

请更新或确认：

```text
public/assets/chapter0/audio/genesis_creation_bgm.mp3
src/game/assets.ts
src/hooks/useChapter0Audio.ts
src/app/game/page.tsx
doc/引言/素材需求文档.md
doc/AI_ASSET_RECORD.md
docs/PROJECT_CONTEXT.md
```

`src/game/assets.ts` 建议新增：

```ts
genesisCreationBgm: "/assets/chapter0/audio/genesis_creation_bgm.mp3"
```

如果 `useChapter0Audio.ts` 目前内部仍使用私有 `AUDIO_PATHS` 常量，可以选择：

```text
方案 A：继续在 hook 内部维护 AUDIO_PATHS，并新增 genesisCreationBgm。
方案 B：改为从 `CHAPTER0_AUDIO` 读取路径。
```

优先选择与现有代码风格一致、改动最小的方案。

### 4.2 Hook 行为

请扩展 `useChapter0Audio`，使它支持 intro 阶段。

推荐参数从当前：

```ts
isDialogueStarted: boolean
```

扩展为更明确的阶段输入，例如：

```ts
phase: "intro" | "dialogue" | "tool_resolution" | "ending"
```

或保留现有参数并新增：

```ts
isIntroActive: boolean
```

实现规则：

```text
1. intro 阶段使用 genesis_creation_bgm.mp3。
2. dialogue / tool_resolution 阶段使用 eden_ambient_loop.mp3。
3. ending 阶段停止背景循环音，并播放对应结局音效。
4. 从 intro -> dialogue 时，genesis BGM 淡出，eden ambient 淡入或直接低音量启动。
5. 从任意阶段关闭声音时，暂停所有音频。
6. 重新开启声音时，只恢复当前阶段应该播放的背景音，不同时播放两首。
7. restart 回到 intro 时，停止旧音频并按 intro 规则准备播放。
8. 音频元素只创建一次，组件卸载时全部 pause。
9. 音频文件缺失、浏览器自动播放拦截或 play() reject 时，不抛出未捕获错误。
```

浏览器自动播放限制处理：

```text
不要依赖页面加载自动播放。
可以在玩家第一次点击 intro 画面、点击“继续”、按 Enter/Space，或点击声音按钮后尝试播放。
如果第一次尝试被浏览器拦截，静默忽略；下一次用户交互再尝试。
```

建议新增内部工具：

```ts
function fadeAudio(audio, targetVolume, durationMs)
function stopAndReset(audio)
```

如果不想引入复杂工具，也可以用简单的定时器做 800-1200ms 淡出；但必须清理 timer，避免内存泄漏或多个 fade 同时运行。

### 4.3 页面接入

请在 `src/app/game/page.tsx` 中把当前 `state.phase` 传给音频 hook。

当前 intro 阶段的交互包括：

```text
1. 点击整个 intro 页面推进 beat。
2. 点击底部按钮推进 beat。
3. Enter / Space 推进 beat。
4. 声音按钮切换声音。
```

请保证这些用户动作都可以作为“解锁音频”的触发点。不要让玩家必须额外点一次隐藏按钮才能听到音乐。

### 4.4 文档同步

请更新：

```text
doc/引言/素材需求文档.md
doc/AI_ASSET_RECORD.md
docs/PROJECT_CONTEXT.md
```

`doc/引言/素材需求文档.md` 中 `AUD006` 应从 `NEEDED` 改为 `READY` 或 `SOURCE_READY`，并记录源文件名：

```text
freesound_community-ethereal-ambient-music-55115.mp3
```

如果许可证、作者、原始链接尚未确认，请不要编造，写：

```text
许可证：待确认
是否需署名：待确认
来源链接：TODO: confirm
```

`doc/AI_ASSET_RECORD.md` 也需要补充该音频条目，说明：

```text
用途：Chapter 0 创世引言背景音乐
运行路径：public/assets/chapter0/audio/genesis_creation_bgm.mp3
源素材路径：doc/引言/audio/freesound_community-ethereal-ambient-music-55115.mp3
```

---

## 5. 不在本任务内处理

以下问题已由 Codex 记录在 `docs/PROJECT_CONTEXT.md` 的 K027，但本任务不要求一次性完成：

```text
1. 右侧面板改可拖动浮窗。
2. Tabs 改为“对话 / 人物 / 蛇 / 设定”。
3. 删除经文 Tab。
4. token 改为“词元”并移除“约”。
5. 对话与本局记录合并。
6. EveAgent prompt 深度重写。
7. 三段经文原话必胜规则。
8. 左侧善恶果小图素材误用。
```

如你判断某项必须顺手修才能完成引言体验，请先说明原因，并保持改动最小。

---

## 6. 验收标准

### 6.1 自动检查

必须通过：

```bash
npm run lint
npx tsc --noEmit
npm run build
```

如果 `package.json` 没有测试脚本，不要编造 `npm test` 结果。

### 6.2 浏览器手动验收

请启动本地预览后检查：

```text
1. 打开 /game，进入 intro 第一屏。
2. 第一次点击页面或“继续”后，创世引言音乐开始播放。
3. 连续推进四段 Beat，音乐不中断、不重复叠加。
4. 点击声音按钮，音乐停止；再次点击，当前阶段音乐恢复。
5. 进入对话阶段后，创世引言音乐淡出，伊甸园环境音接管。
6. 成功结局和失败结局仍能播放对应结局音效。
7. 点击重新开始后回到 intro，不出现两首背景音乐同时播放。
8. 移动端 390x844 下 intro 仍能推进，声音按钮可用，无横向溢出。
9. 控制台没有音频相关未捕获异常。
10. 缺失音频时游戏仍可继续，只允许 console.warn，不允许页面崩溃。
```

### 6.3 回归路径

不要破坏：

```text
1. /game 普通模式不显示调试工具。
2. /game?debug=1 显示调试工具。
3. UI 显示回合 N / 7。
4. 两句有效诱导仍可进入 eve_eats_fruit。
5. 七句无关输入仍可进入 god_arrives。
6. 玩家可见文本不出现 AI / Agent / NPC / 模型 / 程序 / 沙盒 / 系统。
```

---

## 7. 完成报告格式

完成后请按以下格式回复：

```text
完成报告

1. 修改文件
- public/assets/chapter0/audio/genesis_creation_bgm.mp3：从 doc/引言/audio/... 复制
- src/game/assets.ts：新增 genesisCreationBgm 路径
- src/hooks/useChapter0Audio.ts：说明 intro BGM、淡入淡出、声音开关、异常兜底改动
- src/app/game/page.tsx：说明如何传入 intro/dialogue 阶段与用户交互触发
- doc/引言/素材需求文档.md：说明 AUD006 状态
- doc/AI_ASSET_RECORD.md：说明素材记录
- docs/PROJECT_CONTEXT.md：说明上下文更新

2. 验证结果
- npm run lint：通过 / 失败原因
- npx tsc --noEmit：通过 / 失败原因
- npm run build：通过 / 失败原因
- 浏览器手动检查：列出检查结果

3. 注意事项
- 音频许可证是否仍待确认
- 是否存在浏览器自动播放限制
- 是否还有需要 Codex 复验的问题
```

---

## 8. 推荐实现顺序

```text
1. 复制音频到 public/assets/chapter0/audio/genesis_creation_bgm.mp3。
2. 更新音频路径常量。
3. 扩展 useChapter0Audio 支持 intro BGM。
4. 在 GamePage 接入 phase / isIntroActive。
5. 做声音按钮、restart、ending 的回归处理。
6. 同步素材与项目上下文文档。
7. 运行 lint / tsc / build。
8. 浏览器手动验收 intro 音乐、阶段切换、重启和移动端。
```

