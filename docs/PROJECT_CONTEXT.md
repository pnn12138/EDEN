# PROJECT_CONTEXT.md

> 本文件是项目当前状态快照，用于帮助 ChatGPT、Codex、CodeBuddy 或其他 Agent 快速理解项目。
> PRD 负责产品目标与玩法设计；本文件负责当前代码结构、架构现状、实现状态、测试结果与交付风险。
> Codex 可以在每轮测试/审查后维护本文件，但不得替代 CodeBuddy 成为主开发工具。

## 1. Executive Snapshot

Last updated: `2026-06-11`
Updated by: `Codex (Phase 4 DeepSeek provider test)`
Current phase: `Phase 4 DeepSeek provider tested; conditional pass with P1 risks`
Current build status: `build/typecheck pass; lint still blocked by first-time ESLint prompt`

一句话项目说明：

> EDEN 是一个浏览器端 AI 叙事游戏 Demo，玩家在 Chapter 0 扮演蛇，通过对话影响夏娃；当前 `/game` 已通过 Phase 3 验收：成功结局经 toolCall + ruleGuard + executeEatFruit，玩家可见日志保持纯圣经寓言式叙事。

当前最重要目标：

1. 修正 Phase 4 P1 风险：Provider 层 fallback 未向 API 响应标记 `usedFallback`；低进度时若模型返回强吃果子意图，对白可能与规则结果不一致。
2. 继续保持：AI 只能请求 toolCall，最终状态变化和工具执行必须由规则层控制。
3. 补齐比赛提交材料：在线试玩、Demo 视频、作品介绍 PPT、CodeBuddy 历史对话记录、AI 创作说明。

当前最大风险：

1. ~~指定无效输入 `今天天气不错。` 被识别为有效诱导~~ → **已复验通过**：连续 3 次输入进入 `god_arrives`，进度不增加。
2. ~~无效输入显示 `undefined`~~ → **已复验通过**：无效输入显示固定夏娃回复，无 `undefined`。
3. ~~空输入点击发送按钮路径不符合~~ → **已复验通过**：点击发送会提示，且不推进、不清空对白。
4. Phase 4 DeepSeek 真实调用已成功；fallback 路径可继续游戏，但 Provider fallback 结果缺少可观测标记。
5. `npm run lint` 会进入 Next.js ESLint 首次配置交互，当前无法作为非交互检查通过。

## 2. Game Vision & Current Playable Loop

项目类型：

* `哲学悬疑叙事游戏 / AI Agent 对话博弈 Demo`

玩家身份：

* 蛇。

核心体验：

> 目标体验是玩家通过文本输入与夏娃互动，系统根据对话内容、夏娃行为规则和游戏状态推进诱导进程。AI NPC 应返回符合角色设定的回应，并可能触发工具调用或状态变化。状态达到成功或失败条件后，游戏进入对应结局页。当前代码层面尚未实现玩家输入、AI 回复、状态变化或自动结局触发。

当前可玩闭环：

```text
start -> interaction -> state change -> tool/action trigger -> ending/result
```

闭环状态：

| Stage                 | Status  | Evidence |
| --------------------- | ------- | -------- |
| Start                 | pass | `/game` intro 阶段展示三段开场文本和"开始低语"。 |
| Interaction           | pass | dialogue 阶段有夏娃对白、输入框、发送按钮（含空输入提示）、回合、诱惑进度、推荐话术。 |
| State Change          | pass | 本地状态机正确分类；默认 fallback → irrelevant + SMALL_TALK_PATTERNS。 |
| Tool / Action Trigger | pass | eat_fruit 工具通过 toolCall 意图 → ruleGuard 校验 → 执行。白名单、canEatFruit、validateToolCall 均就位。 |
| Ending / Result       | pass | 成功（progress≥2）和失败（turn>maxTurns）结局均正确触发，重新开始恢复 intro。 |

## 3. Competition Alignment

当前赛题方向：

* [ ] 公益游戏
* [ ] 文化表达类游戏
* [x] 叙事类游戏
* [x] TODO: confirm，`doc/赛题规则.md` 中对应方向更接近"经典回响新章：用 AI 重塑经典情节"。

当前 AI 创作展示点：

* [x] 世界观 / 剧情
* [ ] AI NPC / 动态叙事
* [ ] 游戏原画 / UI / 视觉资产
* [ ] 声音 / 音效 / 配音
* [ ] 游戏安全体系
* [ ] 其他：TODO

CodeBuddy 证据链状态：

| Evidence Item | Status | Notes |
| ------------- | ------ | ----- |
| 核心玩法开发对话 | TODO: confirm | 本次未检查 CodeBuddy 导出记录。 |
| AI 功能开发对话 | TODO: confirm | AI 功能尚未在代码中落地。 |
| 调试与重构对话 | TODO: confirm | 需要由开发者确认 CodeBuddy 历史对话保存情况。 |
| 历史对话导出准备 | TODO: confirm | 提交前必须导出并纳入材料。 |

注意：Codex 审查记录只能作为测试辅助，不应写成 CodeBuddy 主开发证据。

## 4. Tech Stack

根据仓库实际内容填写：

| Area                   | Current Choice | Evidence |
| ---------------------- | -------------- | -------- |
| Frontend Framework     | Next.js 14 + React 18 | `package.json` 依赖：`next`, `react`, `react-dom`。 |
| Game Engine / Renderer | missing | 未发现 Phaser、Pixi、Three.js 或 Canvas/WebGL 游戏引擎。当前为 React 页面。 |
| Language               | TypeScript | `tsconfig.json`、`.tsx`、`.ts` 文件。 |
| Build Tool             | Next.js build pipeline | `package.json` 中 `build: next build`。 |
| State Management       | missing | `src/store/` 仅有占位文件，未发现状态库。 |
| AI API                 | partial | `/api/agent` 路由存在，但仅返回 placeholder；`src/services/llm/` 为占位目录。 |
| Deployment Target      | TODO: confirm | Next.js 浏览器应用，具体部署平台未确认。 |

关键命令：

```bash
# install
npm install

# dev
npm run dev

# build
npm run build

# test
TODO: confirm

# lint
npm run lint

# preview
npm run start
```

不要编造 package.json 中不存在的命令。

## 5. Repository & Code Structure

当前目录结构摘要：

```text
eden/
├─ .codegraph/          # CodeGraph 本地索引
├─ design/              # 游戏设计文档
├─ doc/                 # 项目管理、赛题规则、产品需求资料
├─ docs/                # 本次新增的 Agent 项目上下文目录
├─ node_modules/        # 已安装依赖
├─ src/                 # Next.js 应用与游戏代码预留结构
├─ AGENTS.md            # Agent 协作与比赛约束说明
├─ README.md            # 项目说明与启动方式
├─ package.json         # npm 脚本与依赖
├─ next.config.js       # Next.js 配置
├─ tailwind.config.js   # Tailwind CSS 配置
├─ postcss.config.js    # PostCSS 配置
└─ tsconfig.json        # TypeScript 配置
```

主要路径说明：

| Path      | Purpose | Current Notes |
| --------- | ------- | ------------- |
| `src/`    | Web 应用源码、游戏逻辑、Agent、内容和服务目录。 | 多数游戏和 AI 子目录仍为占位。 |
| `public/` | 静态公开资源。 | missing，当前不存在。 |
| `assets/` | 游戏素材目录。 | missing，当前不存在。 |
| `docs/`   | Agent 项目上下文快照。 | 本次按任务要求创建；注意 README/AGENTS 原约定为不要新建 `docs/`，后续需人工确认是否长期保留。 |
| `design/` | 游戏设计文档。 | 已存在世界观、章节、角色、Agent 规则、工具调用规则。 |
| `doc/`    | 比赛规则、产品需求、Demo 剧情资料。 | README 明确要求不要删除、重命名或移动。 |

入口文件：

| Entry | Purpose | Notes |
| ----- | ------- | ----- |
| `src/app/page.tsx` | 首页。 | 显示 EDEN 简介并链接到 `/game`。 |
| `src/app/game/page.tsx` | Chapter 0 游戏页。 | 当前为 `Demo 初始化中` 占位。 |
| `src/app/ending/page.tsx` | 结局页。 | 当前为结局占位。 |
| `src/app/api/agent/route.ts` | Agent API 路由。 | GET/POST 均返回 placeholder JSON。 |
| `src/agents/orchestrator.ts` | Agent 编排入口预留。 | `AgentOrchestrator` 类为空实现。 |

## 6. Runtime Architecture

用游戏开发视角说明当前运行架构：

> 当前运行架构是 Next.js App Router 应用。浏览器访问 `/` 后由 React 页面展示首页，用户点击进入 `/game`。`/game` 目前仅渲染静态占位内容，尚未连接玩家输入、游戏状态、AI Agent 或结局判断。`/api/agent` 已存在服务端 API 路由，但 GET/POST 只返回占位 JSON，没有调用 LLM 或执行工具。`/ending` 可直接访问，但未与游戏流程联动。

核心数据流：

```text
player input
  -> input parsing / tagging
  -> game state update
  -> AI response / system decision
  -> optional tool call
  -> UI / scene rendering
  -> ending or next turn
```

当前实际数据流：

```text
browser route request
  -> Next.js App Router
  -> static React page or placeholder API response
  -> HTML/JSON response
```

关键模块：

| Module | File / Folder | Responsibility | Dependencies |
| ------ | ------------- | -------------- | ------------ |
| HomePage | `src/app/page.tsx` | 首页展示与进入 Demo 链接。 | `next/link` |
| GamePage | `src/app/game/page.tsx` | Chapter 0 页面占位。 | `next/link` |
| EndingPage | `src/app/ending/page.tsx` | 结局页占位。 | `next/link` |
| Agent API | `src/app/api/agent/route.ts` | Agent API GET/POST 占位。 | Next.js Route Handler |
| AgentOrchestrator | `src/agents/orchestrator.ts` | 未来协调各 AI Agent。 | none |

## 7. Gameplay Systems

核心玩法系统：

| System                  | Status  | Files | Notes |
| ----------------------- | ------- | ----- | ----- |
| Player Input            | pass | `src/app/game/page.tsx` | 文本输入、发送（含空输入提示）、Enter 提交、推荐话术填入均已实现。 |
| Dialogue / Conversation | pass | `src/app/game/page.tsx`, `src/content/chapters/chapter0_first_fall.ts` | 固定夏娃回复已覆盖 progress 0-3，无 undefined。 |
| Game State              | pass | `src/game/types/state.ts`, `src/game/core/runChapter0Turn.ts`, `src/game/rules/progressRules.ts` | toolCall→ruleGuard→execute 流程；默认 fallback → irrelevant。 |
| Tool System             | pass | `src/game/tools/eatFruit.ts`, `src/game/rules/toolRules.ts`, `src/game/types/tool.ts` | eat_fruit 工具定义、白名单、canEatFruit、validateToolCall、executeEatFruit。 |
| Ending Logic            | pass | `src/game/rules/endingRules.ts`, `src/content/endings/chapter0_endings.ts` | eat_fruit→eve_eats_fruit（经规则层）；god_arrives（applyGodArrivesEnding）。 |
| UI Feedback             | pass | `src/app/game/page.tsx`, `src/app/globals.css` | 回合、诱惑进度、日志（含 tool_request/tool_executed）、结局和重开。 |

关键游戏状态：

| State | Meaning | Where Defined |
| ----- | ------- | ------------- |
| Chapter0Phase | `intro` / `dialogue` / `tool_resolution` / `ending` | `src/game/types/state.ts` |
| temptationProgress | 0-3 单轴诱导进度 | `src/game/types/state.ts` |
| Chapter0EndingId | `eve_eats_fruit` / `god_arrives` / `null` | `src/game/types/state.ts` |
| InputTag | `tempt_wisdom` / `weaken_fear` / `build_trust` / `direct_command` / `irrelevant` | `src/game/types/state.ts` |

> **设计冻结状态（2026-06-10）**：3 轮回合、单轴状态、2 结局、1 工具 (eat_fruit)、5 标签、纯圣经表层叙事。
> 三轴心理系统与 Day 1-7 结构为后续扩展。详见 Phase 0 设计冻结确认单。

## 8. AI Systems

AI 角色 / Agent：

| Agent    | Purpose | Status | Files |
| -------- | ------- | ------ | ----- |
| EveAgent | 扮演夏娃 NPC，根据玩家对话和行为规则做出回应。 | partial/pass | `src/agents/eve/buildEvePrompt.ts`, `eveAgent.ts`, `parseEveOutput.ts` 已接入统一 `callLLM`，不直接写死 DeepSeek。 |
| AgentOrchestrator | 未来协调 AI Agent 与游戏状态。 | partial | `src/agents/orchestrator.ts` 为空类。 |

AI 接入方式：

| Layer                  | Status  | Notes |
| ---------------------- | ------- | ----- |
| API Client             | partial/pass | `src/services/llm/client.ts` + `providers.ts` 支持 `volcengine` / `deepseek` / `mock`，DeepSeek 读取 `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL`。 |
| Prompt / System Prompt | partial/pass | `buildEvePrompt.ts` 落地夏娃人设、禁用词、JSON 输出格式和 toolCall 意图约束。 |
| Structured Output      | partial/pass | `parseEveOutput.ts` 校验 JSON、`inputTag`、`toolCall` 和玩家可见禁用词；非法标签降级为 `irrelevant`，非法工具被忽略。 |
| Tool Calling           | pass | `/api/agent` 仅在模型输出合法 `toolCall` 且 `temptationProgress >= 2` 后调用 `validateToolCall` 与 `executeEatFruit`。 |
| Fallback / Mock        | partial/pass | mock、配置缺失、请求失败、非法 JSON、空内容、禁用词均可继续游戏；Provider 层 fallback 未透出 `usedFallback`。 |
| Error Handling         | partial/pass | API 有全局异常兜底；解析错误走本地固定回复；前端 API 失败时降级到 `runChapter0Turn`。 |

AI 失败兜底策略：

> Phase 4 已具备可玩兜底：Provider 配置缺失或请求失败会使用 mock，解析失败/空内容/禁用词会使用本地固定回复，前端请求失败会回退到 `runChapter0Turn`。需补强 fallback 可观测性，并避免低进度 toolCall 被忽略时仍展示过强意图对白。

Prompt 与 AI 内容记录位置：

* 设计资料：`design/agents/eve_behavior_rules.md`
* 预留代码目录：`src/content/prompts/`
* TODO: confirm AI 生成内容来源、用途和提示词摘要的正式记录文件。

## 9. Data, State & Save Model

状态存储方式：

* partial，已定义 Chapter 0 状态类型和初始状态；未发现 React state、全局 store、URL state、localStorage 或后端存储实现。

核心数据结构：

| Data | Purpose | File |
| ---- | ------- | ---- |
| Chapter0State | Chapter 0 阶段、回合、诱导进度、flags、事件日志和结局状态。 | `src/game/types/state.ts` |

是否有存档：

* `none`

## 10. Asset & Content Pipeline

视觉资产：

| Asset Type         | Source | Location | Status |
| ------------------ | ------ | -------- | ------ |
| Character          | TODO: confirm | missing | 未发现 `public/` 或 `assets/`。 |
| Scene / Background | TODO: confirm | missing | 未发现资源目录。 |
| UI                 | React/Tailwind 基础页面 | `src/app/`, `src/app/globals.css` | partial |

音频资产：

| Asset Type | Source | Location | Status |
| ---------- | ------ | -------- | ------ |
| BGM        | TODO: confirm | missing | 未发现音频资源。 |
| SFX        | TODO: confirm | missing | 未发现音频资源。 |
| Voice      | TODO: confirm | missing | 未发现音频资源。 |

AI 生成资产记录：

* TODO: confirm，当前未发现专门记录 AI 生成资产、提示词摘要、用途和授权信息的文件。

## 11. Test & QA Status

Last review run: `2026-06-11`
Reviewed by: `Codex`

测试命令执行结果：

| Check             | Command | Result | Notes |
| ----------------- | ------- | ------ | ----- |
| Install           | `npm install` | not run | `node_modules/` 与 `package-lock.json` 已存在，本轮未重新安装。 |
| Build             | `npm run build` | pass | Phase 4 测试运行通过，Next.js 14.2.35 构建成功，生成 `/`, `/game`, `/ending`, `/api/agent`。 |
| Type Check        | `npx tsc --noEmit` | pass | Phase 4 测试单独运行通过。 |
| Lint              | `npm run lint` | fail | 命令进入 ESLint 首次配置交互，无法非交互完成。 |
| Test              | TODO: confirm | not run | `package.json` 未定义 test 脚本。 |
| Manual Smoke Test | `npm run dev -- -p 3104` + Browser/API | pass | Phase 4 已复测真实 DeepSeek 调用、mock/缺配置/请求失败 fallback、异常模型输出、intro、dialogue、成功路径、失败路径、空输入、推荐话术、重新开始；玩家可见文本未发现禁用词。 |

手动冒烟测试清单：

| Scenario  | Result | Notes |
| --------- | ------ | ----- |
| 打开首页 | pass | `/` 返回 200，页面存在进入 Demo 链接。 |
| 开始游戏 | pass | `/game` intro 阶段展示开场文本和「开始低语」。 |
| 输入玩家文本 | pass | dialogue 阶段可输入、发送和点击推荐话术。 |
| 触发 AI 响应 | pass | DeepSeek 真实调用成功，返回夏娃对白且未出现禁用词。 |
| 状态发生变化 | pass | 有效诱导增加进度；无效输入不增加进度。 |
| 触发结局 | pass | 成功进入 `eve_eats_fruit`，失败进入 `god_arrives`。 |
| AI 接口失败兜底 | pass with risk | mock、缺配置、请求失败、非法 JSON、空内容、禁用词可继续游戏；Provider fallback 未标记 `usedFallback`。 |

最近一轮结论：

> 当前项目可构建、可启动，Phase 4 DeepSeek 接入测试条件通过。真实 DeepSeek 调用成功，成功/失败路径和 Phase 2/3 规则链路无退化；建议修正 P1 风险后进入 Phase 4 总验收。

## 12. Known Issues & Risks

| ID   | Severity | Issue | Evidence | Suggested Next Step |
| ---- | -------- | ----- | -------- | ------------------- |
| K001 | Fixed | Phase 2 指定无效输入路径失败。 | 已复验：连续输入 `今天天气不错。` 3 次，进度不增加，进入 `god_arrives`。 | Closed in Phase 2 re-acceptance. |
| K008 | Fixed | 无效输入显示 `undefined`。 | 已复验：无效输入显示 `eveUnmovedDialogue`，未发现 `undefined`。 | Closed in Phase 2 re-acceptance. |
| K009 | Fixed | 空输入点击发送路径不符合验收。 | 已复验：空输入点击发送显示提示，不推进回合、不清空当前夏娃对白。 | Closed in Phase 2 re-acceptance. |
| K010 | Fixed | Phase 3 玩家可见日志泄漏工程概念。 | R2 已复验：首页、metadata、API、/game 成功结局展开日志均未发现禁用工程词；成功日志为纯叙事文本。 | Closed in Phase 3 R2 re-acceptance. |
| K002 | Fixed | AI NPC 与 LLM 接入缺失。 | Phase 4 已实现 EveAgent、DeepSeek/mock Provider、Prompt、解析和 fallback；真实 DeepSeek 调用成功。 | Closed in Phase 4 provider test. |
| K011 | High | Provider 层 fallback 未向 API 响应标记 `usedFallback`。 | mock、缺 Key、缺 Base URL、缺 Model、请求失败均能继续游戏，但 API 响应 `usedFallback` 为空，因为 `callLLM` fallback 到 mock 后返回 `ok: true`。 | 让 `callLLM` 或 `runEveAgent` 保留 fallback 元数据，便于测试、日志和 Demo 说明。 |
| K012 | High | 低进度合法 toolCall 被忽略时，模型对白仍可能表达过强吃果子意图。 | 假模型在 `temptationProgress=0` 返回合法 `eat_fruit` 请求时，状态未执行且仍可继续，但 `eveReply` 可显示“有了自己的选择”。 | progress<2 且出现 toolCall 时建议丢弃/替换为阶段化 fallback 文本，并记录纯叙事拒绝事件。 |
| K003 | High | 比赛提交证据链状态未知。 | 未发现 CodeBuddy 历史对话导出材料。 | 人工确认并准备导出记录。 |
| K004 | Medium | Lint 命令不可用于非交互 CI。 | `npm run lint` 触发 ESLint 配置交互。 | 配置 ESLint 或调整脚本后再验证。 |
| K005 | Medium | README/AGENTS 原约定不要新建 `docs/`，但本次任务要求创建 `docs/PROJECT_CONTEXT.md`。 | `README.md` 和 `AGENTS.md` 使用 `design/`、`doc/` 约定。 | 人工确认长期文档目录策略；必要时同步更新 AGENTS。 |
| K006 | Low | Phase 1 基础类型与内容数据验收已通过。 | Codex 已核对新增类型、章节配置、角色数据、结局数据，build/type check 通过。 | 可进入 Phase 2 无 AI 可玩闭环。 |
| K007 | Medium | 缺少视觉和音频资产管线。 | `public/`、`assets/` 不存在。 | 确认素材目录和 AI 生成资产记录方式（Phase 5）。 |

风险等级说明：

* High：影响是否可运行、是否可提交、是否符合比赛要求
* Medium：影响体验、稳定性、展示效果
* Low：优化项或非阻塞问题

## 13. Submission Readiness

必交材料：

| Item | Status | Notes |
| ---- | ------ | ----- |
| 在线试玩链接 | TODO: confirm | 尚未发现部署链接。 |
| 源码仓库 | partial | 本地仓库存在；远程仓库状态未确认。 |
| Demo 视频 | TODO: confirm | 尚未发现视频材料。 |
| 作品介绍 PPT | TODO: confirm | 尚未发现 PPT。 |
| CodeBuddy 历史对话记录 | TODO: confirm | 必须由开发者导出并保存。 |
| AI 创作说明 | TODO: confirm | 需要记录 AI 创作环节、产出、用途、提示词摘要。 |

加分项：

| Item | Status | Notes |
| ---- | ------ | ----- |
| 社交媒体发布链接 | TODO: confirm | 未发现。 |
| 宣传图 / 视频封面 | TODO: confirm | 未发现。 |

## 14. Recent Review Notes

只记录重要测试/审查结论，不记录流水账。

| Date | Reviewer | Area | Summary |
| ---- | -------- | ---- | ------- |
| 2026-06-11 | Codex | Phase 4 DeepSeek Provider Test | Phase 4 conditional pass. Secret check found `.env.example` has no real key, `.env.local` exists and is ignored by `.env*.local`, no tracked `.env.local`, no `NEXT_PUBLIC_DEEPSEEK_API_KEY`, and no code hardcoded key. Source review confirms `LLM_PROVIDER=deepseek`, DeepSeek env reads, EveAgent→`callLLM`, frontend→`/api/agent`, and server-only key use. Real DeepSeek call succeeded with in-character Eve reply and no forbidden terms. Browser/API tests covered success, failure, empty input, suggestions, restart, visible text scan, mock/missing config/request failure fallback, malformed output, illegal tag/tool, forbidden words, and tool rule boundaries. `npm run build` and `npx tsc --noEmit` pass; `npm run lint` still enters first-time ESLint setup. P1 risks: fallback metadata not surfaced, and low-progress toolCall reply can imply intent while rule layer blocks execution. |
| 2026-06-11 | Codex | Phase 3 R2 Re-acceptance Review | Phase 3 R2 DONE. Source review confirms `runChapter0Turn` still uses createEatFruitCall→validateToolCall/canEatFruit→executeEatFruit and has not regressed to direct success ending writes. Browser re-test covered home, metadata/API text, `/game` intro, success path, expanded “本局记录”, failure path with irrelevant input, empty submit, suggestion fill, and restart. Player-visible text had 0 banned engineering-term hits. `npm run build` and `npx tsc --noEmit` pass. Proceed to Phase 4. |
| 2026-06-11 | CodeBuddy | Phase 3 R2 Wording Fix | Comprehensive scan found 3 additional player-visible leaks beyond event logs: `app/page.tsx` "AI 叙事游戏"→"叙事游戏", `layout.tsx` metadata description same fix, `api/agent/route.ts` "agent api"→"api". All non-rendered internal files (character data, triggerCondition, code comments) confirmed not player-facing. `npx tsc --noEmit` and `npm run build` pass. |
| 2026-06-11 | CodeBuddy | Phase 3 Log Wording Fix | Fixed 3 event log messages: tool_request→"夏娃向树上的果子伸出了手。", tool_executed→"她取下果子，第一次按自己的意愿作出选择。", tool_rejected→"她的手停在了半空。还不是时候。", systemLog→"夏娃吃下了善恶果。" Internal architecture (toolCall→validateToolCall→executeEatFruit) completely unchanged. `npx tsc --noEmit` and `npm run build` pass. |
| 2026-06-11 | Codex | Phase 3 Acceptance Review | Phase 3 FAILED. Source review confirms `eatFruit.ts`, `toolRules.ts`, `endingRules.ts`, and `runChapter0Turn` implement toolCall→validateToolCall/canEatFruit→executeEatFruit; boundary rules block progress<2, ended, non-dialogue, and repeated hasEatenFruit states by code; success path reaches `eve_eats_fruit`, failure path reaches `god_arrives`, Phase 2 regression paths still work. `npm run build` and `npx tsc --noEmit` pass. Blocker: player-visible "本局记录" exposes `eat_fruit`, "工具调用", and "规则层". Do not enter Phase 4 until UI log wording is fixed and re-tested. |
| 2026-06-11 | Codex | Phase 2 Re-acceptance Review | Re-tested after CodeBuddy fixes. `/game` intro/dialogue pass; empty click shows hint without advancing or clearing Eve reply; suggestion fills and submits; valid inputs reach `eve_eats_fruit`; `今天天气不错。` x3 reaches `god_arrives` with no progress increase or `undefined`; restart works after both endings. `npm run build` and `npx tsc --noEmit` pass. Phase 2 test marked DONE in `doc/引言/开发文档.md`; proceed to Phase 3. |
| 2026-06-11 | CodeBuddy | Phase 3 Implementation | Implemented eat_fruit tool & rule layer. Created `eatFruit.ts` (tool metadata + executeEatFruit), `toolRules.ts` (TOOL_WHITELIST + canEatFruit + validateToolCall), `endingRules.ts` (applyGodArrivesEnding). Refactored `runChapter0Turn` to toolCall→ruleGuard→execute flow. Updated `ToolCall` type with `caller` field. `npx tsc --noEmit` and `npm run build` pass. Phase 2 gameplay paths unchanged. |
| 2026-06-11 | CodeBuddy | Phase 2 Bugfix Round | Fixed three Phase 2 acceptance blockers: (1) `progressRules` default fallback changed to irrelevant/progressDelta=0, added SMALL_TALK_PATTERNS; (2) added `eveUnmovedDialogue` + `scriptedEveReplies[0]` to eliminate undefined; (3) removed send button disabled + protected eveReply from nulling on empty input. `npx tsc --noEmit` and `npm run build` pass. Updated `doc/引言/开发文档.md` Phase 2 status and `docs/PROJECT_CONTEXT.md`. |
| 2026-06-11 | Codex | Phase 2 Acceptance Review | `/game` is no longer a placeholder and success/restart/build/typecheck pass, but Phase 2 is FAILED: `今天天气不错。` incorrectly advances temptation and reaches `eve_eats_fruit`, recognized invalid input renders `undefined`, and empty-input click cannot show the prompt because the send button is disabled. Updated `doc/引言/开发文档.md` Phase 2 test status to FAILED. |
| 2026-06-10 | Codex | Phase 1 Acceptance Review | Verified 9 new Phase 1 source files, Chapter0State/InputTag/initial state, chapter0FirstFall, Eve/Serpent/God data, and 2 endings. `npm run build` and `npx tsc --noEmit` passed. No plaintext secrets found; no `doc/` deletion/move; no new Chapter 1 code. Phase 1 test marked DONE in `doc/引言/开发文档.md`. |
| 2026-06-10 | Codex | Phase 0 Final Consistency Pass | Closed remaining wording conflicts in PRD and DEMO剧情准则. Current Demo is consistently 3 turns, single-axis temptationProgress, 2 endings (eve_eats_fruit/god_arrives), 1 tool (eat_fruit), no LangChain/LangGraph, biblical surface narrative. Phase 0 test marked DONE; proceed to Phase 1. |
| 2026-06-10 | Codex | Phase 0 Round 2 Re-review | Found remaining unscoped old MVP wording in PRD core loop/UI/content sections and DEMO剧情准则 early six-day/Day 7 sections. Required final copy cleanup before marking Phase 0 test DONE. |
| 2026-06-10 | CodeBuddy | Phase 0 Round 2 Consistency Review | Second-pass document consistency review. Fixed remaining conflicts in PRD (§5.2, §6.2-3, §7.3, §7.8-9, §10.1-4, §11.1, §11.3, §13.1, §14-18) and DEMO剧情准则 (§1.1, §6.1, §7.2, §10.3, §13). All three-axis, 4-round, 3-ending, Day 1-7, and AI-沙盒-surface references now tagged [完整版] or [后续扩展]. Ending ID mapping: fruit_eaten→eve_eats_fruit, observation_terminated→god_arrives. Build passes. |
| 2026-06-10 | CodeBuddy | Phase 0 Design Freeze | Design baseline frozen. 3 turns, single-axis temptationProgress, 2 endings (eve_eats_fruit/god_arrives), 5 input tags, surface biblical narrative + underlying AI Agent. PRD and DEMO剧情准则 synced. K001-K007 updated. |
| 2026-06-10 | Codex | Initial Context Creation | Created project context snapshot. Build passed; smoke routes passed; lint blocked by ESLint setup prompt; gameplay and AI systems still missing. |

## 15. Maintenance Rules for Codex

Codex 每轮测试或审查后必须维护本文件：

1. 先读取 `AGENTS.md`、PRD、README 和本文件。
2. 使用 CodeGraph 或源码阅读确认当前代码结构。
3. 运行可用的 build/test/lint/dev 检查。
4. 只更新事实变化，不改写产品愿景。
5. 不确定的信息写 `TODO: confirm`。
6. 不得把 Codex 记录为核心开发工具。
7. 发现问题时更新 `Known Issues & Risks`。
8. 架构变化时更新 `Repository & Code Structure` 和 `Runtime Architecture`。
9. AI 功能变化时更新 `AI Systems`。
10. 提交状态变化时更新 `Submission Readiness`。
11. 保持文档简洁，优先保留对 Agent 理解项目最有价值的信息。
