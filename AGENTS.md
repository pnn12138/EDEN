# AGENTS.md

## Project Goal

EDEN 是面向「AI CAN DO IT｜腾讯云黑客松 游戏开发挑战赛」的浏览器端 AI 叙事游戏原型。目标是完成一个可在线试玩、可独立运行、具备 start -> playing -> result 闭环，并能体现 AI 创作能力的作品。

当前 Demo 方向：Chapter 0 中玩家扮演蛇，通过对话影响夏娃，并走向成功或失败结局。

## Contest Constraints

* 作品必须是完整、可独立运行的游戏原型。
* 作品必须能部署到浏览器环境，并提供在线试玩链接。
* CodeBuddy 是核心开发工具。
* 必须保留 CodeBuddy 历史对话，作为评审依据之一。
* 至少一个 AI 创作环节要形成可展示成果，例如世界观剧情、AI NPC、游戏原画、音视频、安全体系等。
* 最终需要准备在线链接、源码仓库、Demo 视频、作品介绍 PPT、CodeBuddy 历史对话记录。
* 本仓库约定使用 `design/` 存放游戏设计文档，使用 `doc/` 存放项目管理与赛题资料；不要新建 `docs/` 目录。

## AI Tool Usage Policy

* CodeBuddy：核心开发、代码生成、调试、AI 功能实现、关键代码变更。
* Codex：测试、代码审查、Bug 复现、边界条件检查、架构风险提示、提交前验收。
* Codex 不应替代 CodeBuddy 完成主要实现，也不要被描述为核心开发者或主要代码生成工具。
* 所有核心玩法实现、AI 功能实现、主要调试与关键代码变更，应通过 CodeBuddy 完成并保留对话记录。
* 若 Codex 发现问题，应输出问题清单给开发者，再由开发者通过 CodeBuddy 修复。

## Repository Map

* `src/` 游戏与 Web 应用源码。
* `src/app/` Next.js App Router 页面和 API 路由。
* `src/app/page.tsx` 首页入口。
* `src/app/game/page.tsx` Chapter 0 游戏页面入口。
* `src/app/ending/page.tsx` 结局页面入口。
* `src/app/api/agent/route.ts` Agent API 占位路由。
* `src/agents/` AI Agent 编排与角色 Agent 代码。
* `src/agents/eve/` 夏娃 Agent 相关实现预留目录。
* `src/game/` 核心玩法逻辑、规则、工具和类型预留目录。
* `src/components/` 对话、布局、日志、场景、状态等 UI 组件预留目录。
* `src/content/` 章节、角色、结局、提示词、场景内容预留目录。
* `src/services/` LLM 接入与日志服务预留目录。
* `src/store/` 前端状态管理预留目录。
* `src/styles/` 样式预留目录。
* `src/tests/` 测试预留目录。
* `design/` 游戏设计文档区。
* `design/00_project_overview.md` 项目概述。
* `design/01_world_bible.md` 世界观设定。
* `design/agents/eve_behavior_rules.md` 夏娃行为规则。
* `design/chapters/` 章节设计。
* `design/characters/` 角色设定。
* `design/tools/tool_calling_rules.md` 工具调用规则。
* `doc/` 项目管理、产品需求、赛题规则、Demo 剧情资料；不要删除、重命名或移动其中任何文件。
* `package.json` 依赖与脚本配置。
* `next.config.js` Next.js 配置。
* `tailwind.config.js` Tailwind CSS 配置。
* `tsconfig.json` TypeScript 配置。

## Must Read Before Making Changes

* `README.md`
* `package.json`
* `design/00_project_overview.md`
* `design/01_world_bible.md`
* `design/chapters/chapter0_first_fall.md`
* `design/agents/eve_behavior_rules.md`
* `design/tools/tool_calling_rules.md`
* `doc/赛题规则.md`
* `doc/产品需求文档.md`
* `doc/DEMO剧情与夏娃行为准则.md`
* 建议创建：`design/ARCHITECTURE.md`
* 建议创建：`design/AI_DESIGN.md`
* 建议创建：`design/SUBMISSION_CHECKLIST.md`

## Development Commands

* Install: `npm install`
* Dev: `npm run dev`
* Build: `npm run build`
* Lint: `npm run lint`
* Test: `TODO: confirm`，当前 `package.json` 未定义测试脚本。
* Preview: `npm run start`，需先执行 `npm run build`；如部署平台使用其他预览命令，需确认。

## Coding Rules

* 不要在前端代码中硬编码 API Key、模型密钥、云服务密钥。
* 新增功能前必须确认它服务于核心玩法闭环。
* 修改游戏状态机、AI NPC、存档结构、资源加载逻辑时，要同步更新相关设计文档。
* AI 生成内容要记录来源、用途和提示词摘要，方便后续 PPT 与提交说明复用。
* 保持游戏在 AI 接口失败时仍有兜底体验，例如固定回复、本地剧情分支或可继续操作的失败提示。
* 不要引入大型依赖，除非明确必要，并能说明它对比赛 Demo 的直接价值。
* 保持浏览器端可部署，不要依赖本地私有服务才能完成核心体验。
* 不要删除、重命名或移动 `doc/` 目录内文件。

## Testing and Review Role for Codex

* 生成测试点和提交前检查清单。
* 检查核心流程：start -> playing -> result。
* 检查浏览器兼容性、构建问题和部署风险。
* 检查异常状态、空数据、AI 接口失败、资源加载失败。
* 检查是否新增明文密钥或敏感配置。
* 检查提交材料缺口，包括在线链接、Demo 视频、PPT、CodeBuddy 历史对话记录和 AI 创作说明。
* 输出问题清单和风险说明，不直接进行大规模业务代码修改。

## Definition of Done

一次任务完成前必须确认：

* 项目可以启动。
* 构建不失败。
* 核心玩法流程可走通。
* 没有新增明文密钥。
* 没有破坏 CodeBuddy 主开发证据链。
* 相关文档已同步。
* 能说明本次改动对比赛评分项的价值。

## Submission Readiness Checklist

* 在线试玩链接。
* 源码仓库。
* Demo 视频。
* 作品介绍 PPT。
* CodeBuddy 历史对话记录。
* AI 创作说明，包括 AI 创作环节、产出、用途和提示词摘要。
* 社交媒体发布链接，如准备加分项。

## Project Context Maintenance

* `docs/PROJECT_CONTEXT.md` is the shared project snapshot for agents.
* Codex must read it before every test/review task.
* Codex must update it after every test/review round.
* PRD remains the source of product truth.
* CodeGraph is used for code-structure discovery.
* CodeBuddy remains the primary implementation tool.

## CodeGraph Usage

CodeGraph is used only as a local code-structure index to help agents understand the repository.

Before reviewing or modifying code, agents should prefer CodeGraph for:
- repository file structure
- symbol search
- callers / callees
- impact analysis
- affected test discovery

Agents should not treat CodeGraph as a source of product truth. Product decisions come from PRD and docs.

If CodeGraph reports pending sync or stale files, agents must read the source files directly before making conclusions.

Codex may use CodeGraph for testing, review, and risk analysis, but CodeBuddy remains the primary development tool for implementation.
