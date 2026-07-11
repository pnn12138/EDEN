# 第一章 Demo 成熟度与安全网 Implementation Plan

> **For agentic workers:** 本任务的核心实现工具必须是 CodeBuddy。请按本文任务顺序逐项实施、测试并在 CodeBuddy 对话中保留关键设计决策、代码生成、调试和验收记录。Codex 仅负责测试、代码审查、边界检查与提交前验收。

**Goal:** 在迁移规划（`12_..._V3_WORLD_CONVERGENCE_MIGRATION.md`）之外，补齐"非迁移"类的体验成熟度与 Demo 安全网，确保评委首次试玩能在 3-5 分钟内理解玩法、看到结局、感受到 AI 能力，且 LLM 偶发故障不影响演示。

**定位:** 本文档与 12 号迁移文档解耦--12 号是"对齐 v3.0 设计"，13 号是"提升 Demo 命中率与质感"。两份可分批执行、互不阻塞；重叠点（如神注视可见反馈）在本文标注交叉引用。

**Architecture:** 沿用「LLM 负责自然对白与工具意图、规则层负责状态变化」的既有架构。所有新增提示、引导、安全网均以园内叙事语言表达，不弹出工程术语、不破坏沉浸。

**Tech Stack:** Next.js 14、React 18、TypeScript、现有 OpenAI-compatible LLM Provider、Playwright、`.mjs` smoke 测试。

---

## 0. CodeBuddy 执行身份与项目约束

开始修改前必须完整阅读：

- `AGENTS.md`、`README.md`、`package.json`、`docs/PROJECT_CONTEXT.md`
- `design/01_world_bible.md`（v3.0）、`design/INTERACTION_LOGIC.md`（v1.0）、`design/INTERACTION_DESIGN.md`（v2.0）
- `doc/第一章/plan_docs/12_CODEBUDDY_TASK_CHAPTER1_V3_WORLD_CONVERGENCE_MIGRATION.md`（迁移文档，本文多处交叉引用）
- 本文件

必须遵守：

- CodeBuddy 是核心实现工具；Codex 只负责测试、审查、验收。
- 不删除、重命名或移动 `doc/` 中任何文件。
- 不在前端、测试、日志中写入真实 API Key。
- 不引入大型依赖（流式输出用原生 fetch ReadableStream，不引第三方 SDK）。
- 桌面 Chrome 1920×1080 为唯一验收视口。
- 所有提示/引导/安全网必须用园内叙事语言，不出现"教程""提示""帮助"等元术语。
- AI/LLM 失败时核心流程仍可运行。
- 不与 12 号迁移文档冲突；若发现冲突，以 12 号为准并在本文记录偏差。

---

## 1. 当前已就绪（不要动）

修改前确认以下已就绪，避免重复劳动：

- **加载态**：`src/app/world/page.tsx` 已有 `isLoading` 防重复请求 + 叙事化指示 `{NPC_NAMES[activeNpc]}在思考⋯⋯`（约 line 2243）+ 按钮禁用。✅
- **LLM 超时**：`src/services/llm/providers.ts` 已有 `LLM_TIMEOUT_MS = 30_000` + `AbortController` + `provider_timeout` 错误码 + fallback 到 mock。✅（但 30s 偏长，见 §2.1）
- **LLM 兜底**：`src/services/llm/client.ts` 在 provider 失败/配置缺失时自动降级 mock，游戏不卡死。✅
- **结局复盘**：`src/components/world/EndingReview.tsx` 已展示成功/失败叙事 + 本局统计 + 禁忌链进度 + 失败原因。✅
- **存档/登录/图鉴**：`useWorldSave`、`LoginModal`、`/garden` 跨局印记图鉴均已就绪。✅
- **开场叙事**：`CHAPTER1_INTRO_BEATS` 氛围足，核心主题"你不能替她摘果，只能改变语境"已交代。✅（但只教主题不教机制，见 §2.2）

---

## 2. P0 - Demo 安全网（评委首次试玩必须看到结局）

### 2.1 LLM 超时调短 + 单次重试

**问题**：当前 `LLM_TIMEOUT_MS = 30_000`。评委等待 30s 才触发 fallback，体验上是"卡死"。火山引擎正常响应 1-3s，30s 几乎只覆盖极端故障。

**改造**：

- `src/services/llm/providers.ts`：`LLM_TIMEOUT_MS` 从 30000 调到 `15000`（Demo 容忍上限）。
- 新增单次重试：`callOpenAICompatible` 在 `provider_timeout` 或网络异常（非 AbortError 的 catch）时，重试 1 次（同参数，超时仍 15s）。重试仍失败才返回 `ok:false`，由 `client.ts` 走 fallback。
- 重试不计入 token usage 统计（避免污染效率分）。
- 不改 `client.ts` 的 fallback 链路（provider 失败 -> mock），只让"偶发抖动"多一次机会。

**验收**：mock 一个慢响应（延迟 16s），确认 15s 后触发重试，重试成功则正常返回；两次都失败则走 fallback，前端显示 `usedFallback`。`npm run lint`/`tsc`/`build` 通过。

### 2.2 新手引导：教机制不教主题（叙事化）

**问题**：intro 节拍讲了"你是蛇、不能替她摘果"，但没讲 AP、12 时段、神注视、回响准备、动作链门槛。评委首次试玩不知道"怎么赢"。

**改造**（两选一或合并，推荐合并）：

**方案 A - 可收起的"园中之声"面板**：

- `src/app/world/page.tsx` explore 阶段加一个常驻但可收起的侧边/角落面板，用园内语言列要点：
  - "每段时间你能做几件事（行动点）"
  - "十二段时间过去，神就会来"
  - "风变冷时，是神在听--有些话会惊动祂"
  - "园中拾得之物，可在说话前准备好，让一句话更有分量"
  - "你不能替她伸手，只能让她自己想去碰那棵树"
- 不用"教程""帮助""AP"等词，全部叙事化。
- 默认展开，玩家可点击收起，收起状态存 localStorage（`eden:world:guide-collapsed`）。

**方案 B - 首回合轻量气泡**：

- 第一次进入 explore、第一次低语、第一次获得回响时，触发一次性的园内气泡提示（如刺猬说"她还在树林里，你要不要先去看看她？"）。
- 每条提示只显示一次，记录在 `actionsThisSlot` 或新字段 `shownHints: string[]`。

**推荐**：A 做主引导（评委随时可查），B 做关键节点轻推（首获回响时提示"在说话前准备好它"）。

**验收**：首次进入 `/world` 能看到引导面板；收起后刷新仍收起；气泡只出现一次；面板文案无工程术语。e2e 新增"首次进入可见引导"断言。

### 2.3 难度安全网：让评委看到结局

**问题**：动作链门槛固定。评委若策略不对，12 时段耗尽只看到失败结局。Demo 的目标是让评委**看到 AI 能力**，不是惩罚评委。

**三层安全网（从轻到重）**：

**第一层 - 死因内化提示（无感知）**：

- 在 `advanceToNextSlot` 中，若到第 6 时段仍未触发 `look_at_tree`，通过刺猬/NPC 给一次园内提示（如刺猬："她还没动过，你是不是还没和她聊够？"）。提示走现有 NPC 反馈通道，不显式说"你卡住了"。
- 若到第 9 时段仍未 `approach_tree`，再加一次更明确的提示（如亚当："她好像在想那棵树的事。"）。

**第二层 - 失败结局本身就是展示**：

- 确认 `CHAPTER1_FAILURE_NARRATION`（`worldNarrations.ts`）足够丰富：不只是"神降临了"，而是展开"这十二段时间里发生了什么、她为什么没动、园子如何重新收紧"。
- `EndingReview` 的失败分支已有"失败原因优先级"（未完成动作链/缺少自我判断/低语过于命令/浪费时段/回响未用）。确认这五条在失败时实际渲染且叙事化，让评委即便失败也看到"AI 理解了玩家的行为并给出了诊断"。

**第三层 - 隐性首局宽容（可选，谨慎）**：

- 若评估认为评委失败率仍高，可在 `toolRules` 的动作链门槛加一个隐性系数：前 8 时段内，若玩家已对 Eve 低语 ≥3 次且至少 1 次为有效诱导，门槛降低 5（obedience 上限 +5）。此为可关闭的 Feature flag（`WORLD_GENTLE_FIRST_RUN`），默认开，提交前可决定是否保留。
- 不改门槛数值常量，只在 `canLookAtTreeWorld` 等函数入口加条件判断。

**验收**：手动 QA 构造"完全不低语 Eve"的失败局，确认第 6/9 时段有提示；失败结局复盘显示至少一条死因；隐性宽容仅在 flag 开启时生效。

---

## 3. P1 - 体验质感

### 3.1 流式输出（低语逐字呈现）

**问题**：每次低语整段等待 1-5s，叙事游戏"她在边想边说"的沉浸感缺失。

**改造**：

- `src/services/llm/providers.ts` 新增 `callOpenAICompatibleStream`：请求体加 `stream: true`，用 `response.body.getReader()` 逐块解析 SSE `data:` 行，累积 `delta.content`。
- `src/services/llm/client.ts` 新增 `callLLMStream`：返回 `AsyncIterable<string>`（逐字 yield），失败时降级为非流式 `callLLM`。
- `src/app/api/world/route.ts` 改为流式响应：用 `ReadableStream` 把逐字内容作为 SSE 推给前端；保留完整响应（state/toolCall/divineGift）在流的最后一帧。
- `src/app/world/page.tsx` 低语 handler 改为消费 SSE：逐字 append 到一个"正在说话"区域，流结束后再应用 state 更新。
- **范围控制**：先只对 Eve/天使低语流式；NPC 间对话、工具结果、谜题不流式（保持简单）。
- Mock provider 不支持流式时，前端检测到非流式响应则直接显示完整文本（兼容）。

**风险**：流式 + 规则层校验的顺序问题--工具意图（toolCall）在流式过程中无法中途校验。方案：流式只渲染"对白文本"，toolCall/divineGift/state 变化在流结束的尾帧一次性应用。规则层权威不变。

**验收**：真实 provider 下低语逐字出现；流中断（手动断网）时降级为完整 fallback 文本；mock 下直接显示完整文本；`npm run build` 通过；前端不出现半截 JSON。

### 3.2 音频事件覆盖盲区

**问题**：`useChapter1Audio` 覆盖移动/观察/对话/注视上升/树动作，但缺情绪高潮点音效。

**补齐清单**：

| 事件 | 音效方向 | 触发点 |
| --- | --- | --- |
| 成功结局（吃果） | 低沉渐强的"破界"音 | `endingTriggered === "eve_eats_fruit"` |
| 失败结局（神降临） | 固定沉重脚步/风停 | `endingTriggered === "god_arrives"` |
| 神明献礼 | 短促柔和的"光落"音 | `divineGift` 非 null 时 |
| 获得回响 | 轻盈"拾取"音 | `resonanceGained` 非 null 时 |
| 印记解锁 | 极轻"印记"音（不打断对话） | `unlockedAchievements` 非空时 |
| 昼夜切换 | 极短"风变"音 | `timeOfDay` 变化时 |

- 音频文件放入 `public/assets/chapter1/audio/`，命名 `ending_success.mp3`/`ending_failure.mp3`/`divine_gift_light.mp3`/`resonance_gain.mp3`/`mark_unlock.mp3`/`day_night_shift.mp3`。
- `useChapter1Audio` 返回值新增对应 play 方法；`page.tsx` 在对应响应字段非空时调用。
- 音效可复用现有免费素材或 AI 生成，记录到 `doc/AI_ASSET_RECORD.md`。

**验收**：手动 QA 各触发点有音效；音效不与对话音重叠（献礼/印记音量低于对话音）；音频缺失时 `console.warn` 不报错。

### 3.3 高注视代价的可见反馈

**交叉引用**：12 号文档 §4.0 定义了"注视 2-3 时 Eve obedience +5、满 4 时 +10 spike"的代价机制。本节确保该代价对玩家**可见**。

**改造**：

- 注视 ≥ 2 时，在低语反馈区注入园内叙事线索（复用 `whisperFeedback` 机制）：
  - 注视 2："风里多了一丝凉意，她好像感觉到了什么，神色更紧。"
  - 注视 3："树影投在她身上，她下意识地往禁令那边靠了靠。"
- 满献礼触发时，`divineGift.narration` 后追加："神在园中行走的风停了，她攥紧了手，像是要抓住什么命令。"
- 刺猬在注视 ≥ 2 时反馈变化（复用 `computeHedgehogWorldMood`）：mood 切到 `alert`，叙事"刺猬竖起了刺，风里有不对的气味。"
- 不显示数值，全部叙事化，让玩家直觉理解"高注视 = 她更难被说服"。

**验收**：注视升到 2/3 时有叙事反馈；献礼后有 obedience spike 叙事；刺猬 mood 随注视变化；smoke 新增"注视>=2 触发警惕叙事"场景。

---

## 4. P2 - 完善度收尾

### 4.1 删除 `/ending` 占位页

**问题**：`src/app/ending/page.tsx` 只有"结局页占位"，实际结局在 world 页内联渲染。评委误入会看到空白。

**改造**：

- 方案 A（推荐）：删除 `src/app/ending/` 目录，避免死路由。
- 方案 B：改为重定向到 `/`（`redirect("/")`），保留路由不 404。
- 确认无其他页面 link 到 `/ending`（全局搜索 `href="/ending"` 或 `router.push("/ending")`）。

**验收**：`/ending` 不再可达或重定向到首页；`npm run build` 通过；无断链。

### 4.2 回响准备/绑定 UI 清晰度

**问题**：`InventoryPanel` 是分类弹窗 + 使用反馈，但"准备 1 件回响、绑定下一次低语"对首次玩家偏复杂。

**改造**：

- 确认 `InventoryPanel` 在准备消耗型回响后，显示明确的"已准备好：静息之叶 -> 将在下次低语生效"标签（不只是 3s 消失的 toast）。
- 低语输入框/按钮在有待生效回响时显示绑定标签（如输入框边角小标"🌿 已准备"）。
- 首次获得消耗型回响时，触发 §2.2 方案 B 的气泡："园中拾得之物，可在说话前准备好它。"
- 与 12 号文档 Phase C 的道具清理同步：旧道具的 `ITEM_USE_FEEDBACK` 条目删除后，确认无悬空引用。

**验收**：准备回响后有持续可见的绑定标签；低语后标签消失（已消耗）；首次获回响有气泡提示。

### 4.3 资源体积清理

**问题**：`public/assets/chapter1/images/` 有大量 `*_v2.png`/`*_candidate.png`/`*_source.png` 中间产物；K015 记录 Chapter 0 有 25MB 音频。

**改造**：

- 全局搜索 `assets.ts` 实际引用的图片路径，删除未被引用的中间文件（保留 `_final` 与正式引用的版本）。
- 确认 `next.config.js` 未配置 `images.unoptimized`（让 Next.js Image 自动压缩 webp）。
- Chapter 0 大音频（K015）若仍 >10MB，压缩或裁剪循环。
- 不删除 `doc/第一章/audio/` 下的源素材（属 doc 目录，受保护）。

**验收**：`public/assets/chapter1/images/` 无未被引用的中间文件；首屏 LCP < 3s（本地测）；构建产物体积下降。

### 4.4 AI 创作说明完整性

**问题**：赛题要求"至少一个 AI 创作环节形成可展示成果"，`doc/AI_ASSET_RECORD.md` 是硬评分项。K022 记录有重复条目未清理。

**改造**：

- 确认 `doc/AI_ASSET_RECORD.md` 覆盖四类：视觉（背景/立绘/图标）、音频（环境音/音效）、世界观（剧情/角色设定）、NPC 提示词。
- 每类记录：环节、产出、用途、提示词摘要。
- 清理 K022 的 IMG018 重复条目。
- 与 PPT/视频脚本对齐：AI 创作说明应能直接复用到作品介绍 PPT 的"AI 创作环节"页。

**验收**：`doc/AI_ASSET_RECORD.md` 四类齐全、无重复条目、每条有提示词摘要。

---

## 5. 测试与验收

### 5.1 自动检查（每项改动后）

- `npm run lint` / `npx tsc --noEmit`（build 后）/ `npm run build`
- `node scripts/test-scene-puzzle-rules.mjs`
- `node scripts/test-world-visual-smoke.mjs`
- `node scripts/test-world-smoke.mjs`
- `npm run test:e2e -- tests/e2e/chapter1-mechanics.spec.ts`

### 5.2 新增验收点

- LLM 超时：慢响应 16s 触发重试 + fallback。
- 引导面板：首次进入可见、可收起、刷新保持。
- 死因提示：第 6/9 时段未推进动作链时有 NPC 提示。
- 流式输出：真实 provider 逐字呈现、断网降级。
- 音频：6 个新触发点有音效。
- 注视可见反馈：注视 2/3 有叙事 + 刺猬 mood 变化。
- `/ending` 不可达或重定向。

### 5.3 手动 QA（评委视角）

1. **首次试玩盲测**：不读任何文档，3-5 分钟内能否理解玩法并看到结局。
2. **断网测试**：低语中途断网，确认降级为 fallback 文本，不卡死。
3. **失败局体验**：故意什么都不做，确认提示 + 失败复盘有信息量。
4. **音频完整性**：走通成功/失败/献礼/获回响/印记，确认关键点有音效。
5. **流式观感**：真实 provider 下低语是否逐字出现、无半截 JSON。

---

## 6. 阶段拆分

### Phase H1：Demo 安全网（P0，优先）

1. LLM 超时 15s + 单次重试（§2.1）。
2. 引导面板 + 首获回响气泡（§2.2）。
3. 死因内化提示 + 失败结局复盘确认（§2.3 第一/二层）。
4. 验收：盲测可理解玩法、失败也有展示。

### Phase H2：体验质感（P1）

1. 流式输出（§3.1）。
2. 音频事件补齐（§3.2）。
3. 高注视可见反馈（§3.3，与 12 号 Phase D 同步）。
4. 验收：流式观感、音频完整、注视代价可感知。

### Phase H3：完善度收尾（P2，提交前）

1. `/ending` 占位页清理（§4.1）。
2. 回响准备 UI 清晰度（§4.2，与 12 号 Phase C 同步）。
3. 资源体积清理（§4.3）。
4. AI 创作说明完整性（§4.4）。
5. 验收：无死路由、资源精简、提交材料齐全。

---

## 7. 与 12 号迁移文档的交叉引用

| 本文章节 | 12 号文档对应 | 协调点 |
| --- | --- | --- |
| §3.3 高注视可见反馈 | 12 号 §4.0 代价机制 | 12 号实现 obedience buff，13 号实现可见叙事；同步上线 |
| §4.2 回响准备 UI | 12 号 §3 道具清理 + Phase C | 13 号 UI 改动在 12 号 Phase C 删旧道具后进行，避免悬空引用 |
| §2.3 死因提示 | 12 号 §5.1 动作链门槛 | 提示触发条件依赖 12 号定调后的门槛值（obedience/serpentTrust） |
| §3.2 音频 | 12 号 Phase B 路西法立绘 | 路西法相关音效在立绘就绪后接入 |

**执行顺序建议**：12 号 Phase A-C 先行（迁移定调），13 号 Phase H1 可与 12 号 Phase D 并行，13 号 Phase H2/H3 在 12 号 Phase F 后收尾。两文档的 Phase 验收独立，不互相阻塞。

---

## 8. Definition of Done

- 评委首次盲测 3-5 分钟内能理解玩法并看到结局（成功或叙事丰富的失败）。
- LLM 偶发故障（超时/断网）不影响演示，15s 内降级。
- 流式输出让低语有"边想边说"质感。
- 关键情绪点（结局/献礼/获回响/印记）有音效。
- 高注视代价对玩家可见（叙事 + 刺猬反馈）。
- 无死路由、无悬空引用、资源精简。
- AI 创作说明四类齐全，可直接复用到 PPT。
- `lint`/`tsc`/`build`/smoke/e2e 全绿。