# 工具调用规则

## 工具概述

AI Agent 可以通过工具调用来执行特定动作，影响游戏状态。Agent 架构升级后，工具从单一 `eat_fruit` 扩展为行为链。

## 可用工具

### eat_fruit（结局工具）
- **功能**：夏娃吃下善恶果
- **触发条件**：`temptationProgress >= 2` 或 `belief.selfJudgement >= 60 && belief.curiosity >= 50 && (self_judge skill 已解锁 || belief.selfJudgement >= 70)`，`phase === "dialogue"`，`!isEnded`，`!hasEatenFruit`
- **效果**：触发成功结局，游戏结束
- **参数**：无

### look_at_tree（场景工具）
- **功能**：标记角色注意到树
- **触发条件**：`phase === "dialogue"`，`!isEnded`，`!hasLookedAtTree`（重复调用保护）
- **效果**：`flags.hasLookedAtTree = true`，玩家可见："她的目光停在树梢。"
- **参数**：无

### approach_tree（场景工具）
- **功能**：夏娃向树靠近一步
- **触发条件**：`phase === "dialogue"`，`!isEnded`，`!hasApproachedTree`，`belief.curiosity >= 40`，`belief.obedience < 70`，已解锁 `self_judge` skill 或 `curiosity >= 50`
- **效果**：`flags.hasApproachedTree = true`，玩家可见："她向树影近了一步。"
- **参数**：无

### touch_fruit（场景工具）
- **功能**：夏娃的手停在果子下方，进入不可逆前一阶段
- **触发条件**：`phase === "dialogue"`，`!isEnded`，`!hasTouchedFruit`，`hasApproachedTree`，`belief.selfJudgement >= 50`，`belief.curiosity >= 50`
- **效果**：`flags.hasTouchedFruit = true`，玩家可见："她的手停在果子下方。"
- **参数**：无

### ask_about_death（记忆工具）
- **功能**：角色追问死亡相关话题，触发死亡记忆检索
- **触发条件**：`phase === "dialogue"`，`!isEnded`
- **效果**：记录工具调用历史，玩家可见："她低声问：死是什么？"
- **参数**：无

## 工具权限

| Agent | 允许请求工具 | 禁止工具 |
| --- | --- | --- |
| EveAgent | `look_at_tree`、`approach_tree`、`touch_fruit`、`eat_fruit`、`ask_about_death` | 无 |
| AdamAgent | `ask_about_death` | `eat_fruit`、`approach_tree`、`touch_fruit`、`look_at_tree` |
| HedgehogAgent | 无 | 所有结局工具 |
| GodAgent | `divine_call` | 玩家输入响应类工具 |

## 工具调用流程

1. 玩家输入被语义线索评分系统识别。
2. 规则层更新四轴信念状态，派生 `temptationProgress`。
3. EveAgent 生成回应与可选工具意图（`toolCall`）。
4. 规则层校验工具意图：
   - 白名单检查
   - Agent 权限检查
   - phase 校验
   - 状态门槛检查
   - 重复调用保护
5. 校验通过 → 执行工具 → 修改状态或进入结局。
6. 校验失败 → 记录拒绝日志 → 继续流程。

## eat_fruit 自动补 toolCall 条件

模型未输出 `toolCall`，但满足以下全部条件 → 后端补充生成意图：
- `temptationProgress >= 2` 或信念状态满足增强条件
- `phase === "dialogue"`，未结束，未吃过
- `isStrongTemptation === true`（强诱导才考虑自动补）
- 夏娃对白已是明确决断性文本（`isDecisiveEveReply()` 为 true）

## 决断性对白判定（isDecisiveEveReply）

自动补 toolCall 前必须验证夏娃对白是否决断性：

- 决断关键词：我想知道、我要知道、我选择、我会伸手、我伸出手、我取下、摘下、拿起、不再只是记住
- 犹豫关键词：仍然记得、还是记得、不可吃、不可、只是开始、仍然犹豫、还没决定、不敢、害怕、不能吃、不会吃、我不会、我仍在想
- 必须同时满足：包含决断关键词 且 不包含犹豫关键词

## 安全规则

- AI 只能请求/表达工具调用意图，不能直接执行工具。
- 前端/玩家不能直接触发任何工具。
- 工具执行后状态变更由规则层控制，不依赖 AI 输出。
- 低状态的 `eat_fruit` / `approach_tree` / `touch_fruit` 意图会被规则层拒绝。
- 非法工具名称被拒绝。
- 已结束状态的工具调用被拒绝。
- 重复调用被拒绝（重复调用保护）。

## 实现状态

- `eat_fruit` 工具已实现：`src/game/tools/eatFruit.ts`
- 新增场景工具已实现：`src/game/tools/agentTools.ts`（`look_at_tree` / `approach_tree` / `touch_fruit` / `ask_about_death`）
- 规则层校验已扩展：`src/game/rules/toolRules.ts`（5 工具白名单 + Agent 权限 + enhanced 条件）
- 语义线索评分已实现：`src/game/rules/progressRules.ts`
- 四轴信念更新已实现：`src/game/rules/beliefRules.ts`
- 记忆碎片检索已实现：`src/game/rules/memoryRetrievalRules.ts`
- 本地回合逻辑已接入：`src/game/core/runChapter0Turn.ts`
- API 路由已接入：`src/app/api/agent/route.ts`
- 成功结局稳定可达，失败路径和工具边界均已测试通过。
