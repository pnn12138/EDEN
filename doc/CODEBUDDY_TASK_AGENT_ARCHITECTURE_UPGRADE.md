# CodeBuddy 任务单：Agent 架构升级与自主意识机制

> 日期：2026-06-18  
> 来源设计：`design/AGENT_ARCHITECTURE_UPGRADE.md`  
> 任务性质：核心玩法与 AI 功能实现，应由 CodeBuddy 完成并保留完整对话记录。  
> Codex 角色：后续测试、审查、边界条件检查和提交前验收。

## 1. 任务目标

将 Chapter 0 从“玩家输入 -> 诱惑进度 -> 结局”升级为“玩家低语 -> Agent 检索记忆 -> 信念变化 -> 技能觉醒 -> 工具调用 -> 结局”的 Agent 认知博弈。

玩家可见文本仍保持圣经寓言风格，不出现 Agent、RAG、MCP、Tool Call、模型、系统、API 等工程词。

## 2. 必读文档

- `AGENTS.md`
- `README.md`
- `design/AGENT_ARCHITECTURE_UPGRADE.md`
- `design/AI_DESIGN.md`
- `design/chapters/chapter0_first_fall.md`
- `design/agents/eve_behavior_rules.md`
- `design/agents/adam_behavior_rules.md`
- `design/tools/tool_calling_rules.md`
- `doc/产品需求文档.md`
- `doc/DEMO剧情与夏娃行为准则.md`
- `docs/PROJECT_CONTEXT.md`

## 3. 实现原则

1. 保留当前 start -> playing -> result 闭环。
2. 保留现有成功/失败结局稳定性。
3. 不引入大型依赖；第一版 RAG 使用本地结构化记忆碎片，不接向量数据库。
4. 规则层仍是状态变化和工具执行的唯一权威。
5. LLM 只能输出意图，不能直接执行工具或写入最终状态。
6. API 失败时必须继续 fallback。
7. 不在前端或源码中硬编码任何真实 Key。
8. CodeBuddy 完成核心实现并保留对话记录，便于比赛提交。

## 4. 建议开发顺序

### Step 1：新增 Agent 通用类型

建议新增或扩展：

- `src/game/types/agent.ts`
- `src/game/types/state.ts`
- `src/game/types/tool.ts`

新增概念：

- `BeliefState`
- `AgentSkill`
- `MemoryFragment`
- `AgentToolPermission`
- `AgentTurnOutput`

保留当前 `temptationProgress`，短期作为兼容字段。

### Step 2：新增本地记忆碎片库

建议新增：

- `src/content/memory/chapter0_memory_fragments.ts`
- `src/game/rules/memoryRetrievalRules.ts`

第一版记忆类型：

- `divine_command`
- `adam_retelling`
- `death_trace`
- `fruit_aura`
- `self_reflection`
- `serpent_history`

根据玩家输入意图检索 1-3 条片段，传入 EveAgent / AdamAgent Prompt。

### Step 3：新增四轴信念更新规则

建议新增：

- `src/game/rules/beliefRules.ts`

四轴：

- `curiosity`
- `obedience`
- `trustInSerpent`
- `selfJudgement`

派生状态：

- `riskAwareness`
- `divineAttention`

要求：

- 单回合变化设上限。
- direct command / irrelevant 不应推进自主意识。
- 强诱导也不能绕过工具校验。

### Step 4：扩展工具链

建议扩展：

- `src/game/tools/`
- `src/game/rules/toolRules.ts`

新增工具：

- `look_at_tree`
- `approach_tree`
- `touch_fruit`

保留：

- `eat_fruit`

后续可加：

- `warn_eve`
- `reject_serpent`
- `divine_call`

每个工具必须有：

- 白名单权限。
- phase 校验。
- 状态门槛。
- 重复调用保护。
- 玩家可见叙事文案。

### Step 5：升级 EveAgent Prompt

修改：

- `src/agents/eve/buildEvePrompt.ts`
- `src/agents/eve/parseEveOutput.ts`
- `src/agents/eve/eveAgent.ts`

Prompt 需要加入：

- 当前信念状态。
- 检索到的记忆碎片。
- 已解锁 Skills。
- 可请求工具列表。
- 输出协议。
- 玩家可见禁用词。

输出不允许直接改最终状态。

### Step 6：让 AdamAgent 参与主线但不抢主线

修改：

- `src/agents/adam/`
- `src/content/chapters/adam_responses.ts`
- `/api/agent` 路由中的 `targetNpc:"adam"` 分支

目标：

- 亚当可提供禁令来源信息。
- 亚当路线不能直接通关。
- 与亚当对话可为夏娃解锁 `compare_sources` 提供前置线索。
- 强诱导亚当可能触发阻力，增加 `obedience` 或 `riskAwareness`。

### Step 7：刺猬作为环境反馈 Agent

修改：

- `src/app/game/page.tsx`
- `src/app/globals.css`
- 可新增 `src/game/rules/environmentAgentRules.ts`

目标：

- 刺猬根据世界状态改变行为表现。
- 不接 LLM。
- 不改变结局门槛。
- 不遮挡移动端主交互。

示例：

- `divineAttention` 高：刺猬躲入草叶。
- 夏娃 `approach_tree`：刺猬停住看向树。
- 无关输入：刺猬无反应。

### Step 8：更新结局复盘

修改：

- `src/game/rules/endingSummaryRules.ts`
- `src/content/endings/chapter0_endings.ts`
- `src/app/ending/page.tsx` 或当前结局展示逻辑

复盘新增：

- 本局检索过的记忆。
- 解锁过的认知 Skill。
- 触发过的工具链。
- 成功或失败的关键原因。

## 5. 验收标准

### 核心流程

- 首页进入游戏正常。
- 引言、场景选择、对话、结局过场、结算页正常。
- 夏娃路线可稳定进入 `eve_eats_fruit`。
- 无关输入可稳定进入 `god_arrives`。
- 亚当路线不能直接通关。

### Agent 机制

- 有效低语会触发至少一次记忆检索。
- 夏娃信念状态会随输入变化。
- 至少一个 Skill 可被解锁。
- 至少一个新增工具在成功路径中被调用，例如 `look_at_tree` 或 `approach_tree`。
- `eat_fruit` 仍必须经过规则层校验。

### 安全与降级

- LLM 失败时游戏可继续。
- 非法 tool 名称被拒绝。
- 低状态门槛的 `eat_fruit` 被拒绝。
- 玩家可见文本不出现：Agent、RAG、MCP、Tool Call、API、模型、程序、系统、测试、研究员、模拟、实验。
- `.env.local` 不被提交。

### 技术检查

运行：

```bash
npm run lint
npx tsc --noEmit
npm run build
```

如无测试脚本，不要编造 `npm test`。

## 6. 建议提交材料同步

实现完成后同步更新：

- `design/AI_DESIGN.md`
- `design/agents/eve_behavior_rules.md`
- `design/agents/adam_behavior_rules.md`
- `design/tools/tool_calling_rules.md`
- `doc/DEMO_VIDEO_SCRIPT.md`
- `doc/PPT_OUTLINE.md`
- `docs/PROJECT_CONTEXT.md`

PPT 建议新增表述：

> EDEN 将 RAG、工具协议、Agent Loop 和 Skills 游戏化为“记忆之井、伊甸园协议、昼夜反思循环与认知觉醒”，让夏娃从服从命令逐步走向自主判断。

## 7. 交给 Codex 的后续验收点

CodeBuddy 完成实现后，请让 Codex 做以下验收：

1. 源码审查：状态变化是否仍由规则层控制。
2. API 测试：真实 Provider、mock Provider、fallback 路径。
3. 工具边界：低门槛、非法工具、重复调用、已结束状态。
4. 浏览器 smoke：桌面和移动端主流程。
5. 玩家可见禁用词扫描。
6. 提交材料缺口检查。

