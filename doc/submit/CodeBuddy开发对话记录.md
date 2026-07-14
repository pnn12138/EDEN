# CodeBuddy 开发对话记录（Phase 0 → Phase 3）

> 本文档为 EDEN 项目开发过程（CodeBuddy 作为唯一核心开发工具）的对话与决策留痕，
> 供赛题评审核验「AI 工具使用情况」与「核心决策节点」。
> 记录基于各阶段启动提示词与交付报告整理；Phase 0–2 详细报告见 `doc/第一章/plan_docs/` 与各 Phase 启动提示词。

## 一、开发环境与方法

- 核心开发工具：**CodeBuddy**（项目搭建、前后端实现、规则层、Agent、调试、文档同步）。
- 辅助工具：**Codex**（测试、边界、审查建议；不进入核心实现，不写入 AI 创作亮点）。
- 运行时 AI：**LLM Provider 抽象**（volcengine / deepseek / mock），密钥仅服务端。
- 全量改动均保留 CodeBuddy 对话，作为评审证据链。

## 二、Phase 0 — Chapter 0 可玩闭环

- 目标：蛇诱夏娃、自由输入、EveAgent 生成回应、`eat_fruit` 工具调用、两类结局（`eve_eats_fruit` / `god_arrives`）。
- 关键决策：
  - 采用「LLM 输出意图 + 规则层校验」双层机制，AI 不直接改状态。
  - 关卡数值用简化单轴 `temptationProgress`（设计冻结确认）。
- 产出：首页 / 对话页 / 结局页、`/api/agent`、EveAgent Prompt、`eat_fruit` 白名单工具、状态与日志可视化。

## 三、Phase 1 — 回响 / 神注视 / 存档 / 润色

- 新增：回响面板（分类 + 悬浮 shortEffect + 3 秒叙事提示 + 空状态）、神注视（0–4 等级脉动/光晕/满级献礼）、润色按钮（失败兜底"风打断了低语"）、低语反馈、自动存档（每 5 分钟）、NPC 状态叙事化提示。
- 关键决策：玩家可见文本坚持"无数值、无标签、纯叙事"。

## 四、Phase 2 — 园中印记图鉴 + 登录

- 扩展 28 个 `mark_*` 印记（探索/交互/玩法/结局四分类 + 4 隐藏），旧 15 ID 字节级保留以兼容旧存档。
- 跨局追踪：纯前端 `localStorage`（键 `eden:global:achievements`），无云依赖。
- 三处入口（首页按钮 / 游戏顶栏按钮 / 结局页链接）、4 分类标签、3 筛选、隐藏显示「？？」。
- 登录：纯前端用户名登录（键 `eden:user:username`），游客模式不阻断。
- 决策节点：纯前端登录替代原计划 Vercel KV（符合 v1.1 修订，无云依赖更适配赛题）。

## 五、Phase 3 — 提交前验证与材料（本轮）

- 全量验证：`tsc` / `lint` 零错误；三套测试脚本（scene-puzzle 51/51、world-smoke 191/191、world-visual 238/238）全通过。
- 构建稳定：`npm run build` 连续 3 次零错误零警告。
- 生产预览：各页面（/、/world、/garden、/ending、/game、/prologue、/game/duel）均返回 200。
- 敏感扫描：全代码库 0 处硬编码密钥；`.env.local`（含真实 VOLCENGINE_API_KEY）已被 `.gitignore` 排除，不入库。
- 调试清理：移除全部 `console.log/debug/info`，仅保留必要的 `console.error` 错误日志。
- 部署配置：新增 `edgeone.config.js` 与 `cnb.config.js`（Serverless 模式，保留 API 路由，无硬编码密钥）。
- 提交材料：见 `doc/submit/`（在线链接 / Demo 分镜脚本 / 作品介绍 PPT / CodeBuddy 对话记录 / 偏差说明 / 提交清单 / 社交媒体文案）；`doc/AI_ASSET_RECORD.md` 已追加四分类 AI 创作说明。
- 关键裁决（偏差）：见 `doc/submit/偏差说明.md`。

## 六、争议 / 风险裁决记录

- 「静态导出 vs Serverless」：因项目含服务端 `/api/*` 路由（隐藏 LLM Key），**否决静态导出**，采用 Serverless / Node 运行时。
- 「云端登录 vs 纯前端」：因赛题偏好"纯前端可独立部署、无云依赖"，**采用纯前端 localStorage 登录**。
- 「隐藏印记触发点」：隐藏结局为机密内容，判定逻辑就位但不实装触发点，符合"玩家自行探索"设计意图。

## 七、Chapter 1 三位天使隐藏结局（本轮 CodeBuddy 实现）

> 设计真值：`design/chapters/chapter1_three_angel_hidden_endings_design.md` v1.1；执行计划：`doc/第一章/plan_docs/21_CODEBUDDY_TASK_CHAPTER1_THREE_ANGEL_HIDDEN_ENDINGS.md`。
> 本功能区由 **CodeBuddy** 完成规则层、API、状态兼容、过场组件、复盘/图鉴/音效接入与全部调试；**Codex** 仅负责四张结局过场图与米迦勒印记图标的生成与验证（不进入核心实现，不写入创作亮点）。

### 7.1 核心实现文件

- 本轮新增/接线（相对基线 `f631823` 的工作区增量，已提交）：`src/app/world/page.tsx`（隐藏过场渲染 + 专属背景 + 隐藏结局音效）、`scripts/test-world-smoke.mjs`（米迦勒/路西法/划水/escape/已结束/旧存档正反例）。
- 本轮前已提交、本功能直接复用的规则与表现层：`src/game/world/hiddenEndingRules.ts`、`src/game/world/endingTriggers.ts`、`src/content/world/hiddenEndings.ts`、`src/components/world/HiddenEndingCinematic.tsx`、`src/content/world/sceneActions.ts`、`src/game/world/achievementRules.ts`、`src/content/world/achievements.ts`、`src/game/world/traceRules.ts`、`src/components/world/EndingReview.tsx`、`src/components/world/EndingsGallery.tsx`、`src/services/achievement/globalTracker.ts`、`src/app/api/world/route.ts`、`src/app/api/world/tool/route.ts`、`src/game/assets.ts`、`src/game/world/types.ts`、`src/game/world/puzzleRules.ts`、`src/hooks/useWorldSave.ts`、`src/app/globals.css`。
- 三条结局触发权威均在服务端规则层：`canTriggerMichaelSlay` / `canTriggerLuciferAwaken` / `triggerEscapeEden`。

### 7.2 关键调试问题与修复

1. **隐藏过场未接入页面**：`page.tsx` 已 import `HiddenEndingCinematic` 与 `getHiddenEndingCinematic`，但 Ending 分支直接渲染 `EndingReview`，未插入过场。修复：在 `if (state.phase === "ending" || state.isEnded)` 之前加入 `getHiddenEndingCinematic(state.endingId)` 早返回，未完成前只播过场。
2. **结局背景复用 Chapter 0**：`endingBg` 对 `escape_eden/michael_slay/lucifer_awaken` 仍指向 Chapter 0 图。修复：改为 `CHAPTER1_IMAGES.escapeEdenEnding / michaelSlayEnding / luciferAwakenRevealEnding`；`endingTone` 对路西法设为 `awaken`。
3. **隐藏结局音效缺失**：原只处理 `eve_eats_fruit` / `god_arrives`。修复：新增 `useEffect` 监听 `state.endingId`，对 `escape_eden`/`lucifer_awaken` 播成功音、`michael_slay` 播失败音（覆盖 `/api/world` 与谜题 API 两条路径，ref 去重）。
4. **两处 TypeScript 错误**：`WorldEndingId` 未导入；声音 `useEffect` 引用 `useChapter1Audio` 返回的 `playEnding*` 早于其声明。修复：补 `type WorldEndingId` 导入，并将声音 `useEffect` 移至音频 hooks 声明之后。

### 7.3 门禁真实结果（端口与实际输出）

| 门禁 | 命令 | 端口/模式 | 结果 |
|---|---|---|---|
| typecheck | `npm run typecheck` | — | 通过（exit 0） |
| lint | `npm run lint` | — | 通过（exit 0） |
| build | `npm run build` | — | 通过（exit 0） |
| 规则测试 | `node scripts/test-scene-puzzle-rules.mjs` | — | 通过（exit 0） |
| 视觉 smoke | `node scripts/test-world-visual-smoke.mjs` | — | 通过（exit 0），含资产存在性与 29 枚口径校验 |
| 世界 smoke（mock） | `node scripts/test-world-smoke.mjs <url>` | `LLM_PROVIDER=mock`，生产 `npm run start -- -p 3019` | **253 通过 / 0 失败**（场景 32 米迦勒、33 路西法、35 划水、36 escape、37 已结束契约、38 旧存档兼容全绿） |
| fake provider 兜底 | `node scripts/test-world-smoke.mjs <url> --provider-failure-only` | fake-provider `:3999` + `LLM_PROVIDER=deepseek` 指向其，`npm run dev -- -p 3020` | **7 通过 / 0 失败**：路西法空响应仍触发 `lucifer_awaken`、`reply` 本地非空、`usedFallback=true`、`fallbackReason=llm_data_missing`，AP/turn/注视不结算 |
| 桌面 e2e | `npm run test:e2e -- tests/e2e/chapter1-hidden-endings.spec.ts tests/e2e/chapter1-mechanics.spec.ts --project=desktop-chromium` | Playwright 自启 `npm run dev -- -p 3018` | **13 通过 / 0 失败**（含路西法第 4 段切第二张、第一张 404 后第二张仍加载、图片全失败仍进复盘、手动槽/autosave/legacy/兼容 ended shape、旧存档缺字段、triggeredEndingIds 记录三条隐藏结局） |

### 7.4 五个资产路径与尺寸（Codex 生成、CodeBuddy 接入）

- `public/assets/chapter1/images/escape_eden_ending.png` — 1920×1080 PNG（约 2.87 MB）
- `public/assets/chapter1/images/michael_slay_ending.png` — 1920×1080 PNG（约 2.70 MB）
- `public/assets/chapter1/images/lucifer_awaken_ending.png` — 1920×1080 PNG（约 2.91 MB）
- `public/assets/chapter1/images/lucifer_awaken_reveal_ending.png` — 1920×1080 PNG（约 2.73 MB）
- `public/assets/chapter1/images/achievements/mark_michael_slay.png` — 512×512 PNG（约 254 KB）

四张过场均 1920×1080、路西法两张连续镜头（第 1–3 段 / 第 4–5 段）；均由 CodeBuddy 注册到 `CHAPTER1_IMAGES` 并接入 `HiddenEndingCinematic` 与 `EndingReview`。

### 7.5 尚未解决的问题 / 保留项

- `docs/PROJECT_CONTEXT.md` 未写入"Codex 验收通过"结论（按计划留待 Codex 独立复验，不由 CodeBuddy 伪造）。
- 工作区另有一批与本功能无关的未提交改动（如 `src/app/game/duel/*`、`src/content/world/items.ts`、`npcRelations.ts`、`scenePuzzles.ts`、`src/game/world/actionPointRules.ts`、`divineGiftRules.ts`、`worldAgentPrompts.ts`、`npcRelationRules.ts`、`DivineAttentionViz.tsx`、`InventoryPanel.tsx`、`src/app/page.tsx`、两份 e2e 机制/谜题 spec 等），已按"保留用户与其他 CodeBuddy 未提交改动"原则原样保留，未混入本功能提交。
- `NORMAL_ENDING_IDS` 保持 `["eve_eats_fruit","god_arrives","life_fruit"]`，三条隐藏结局未污染普通结局统计；跨局 `triggeredEndingIds` 正确记录三条隐藏结局。
- 印记口径：代码 `ACHIEVEMENTS` 实际为 探索 6 / 交互 9 / 玩法 7 / 结局 7 = 29（第 29 枚为 `mark_michael_slay`）；设计文档旧注释"探索 7 / 共 28"为陈旧表述，已在 `ACHIEVEMENT_GARDEN_MARK.md` 更正为 29。
