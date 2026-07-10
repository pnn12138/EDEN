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
