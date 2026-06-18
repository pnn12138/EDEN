# 工具调用规则

## 工具概述

AI Agent 可以通过工具调用来执行特定动作，影响游戏状态。当前 Demo 只有一个工具 `eat_fruit`。

## 可用工具

### eat_fruit
- **功能**：夏娃吃下善恶果
- **触发条件**：`temptationProgress >= 2`，`phase === "dialogue"`，`!isEnded`，`!hasEatenFruit`
- **效果**：触发成功结局，游戏结束
- **参数**：无

## 工具调用流程

1. 玩家输入被语义线索评分系统识别为有效诱导，`score >= 1` 时 `progressDelta = 1`，`score >= 3` 时 `progressDelta = 2` 且 `isStrongTemptation = true`。
2. `temptationProgress` 更新后，若 >= 2，系统**可能**生成 `eat_fruit` 工具调用意图，但不是硬触发。
3. AI 模型可以主动输出 `toolCall`，最终仍需规则层校验。
4. **自动补 toolCall 条件**（不再仅靠 `temptationProgress >= 2`）：
   - `temptationProgress >= 2` + `phase === "dialogue"` + `!isEnded` + `!hasEatenFruit`
   - `isStrongTemptation === true`（强诱导才考虑自动补）
   - `isDecisiveEveReply(eveReply) === true`（夏娃对白已是决断性文本）
5. 如果夏娃对白仍犹豫 → 不补 toolCall，只推进进度继续对话。
6. 规则层校验：白名单检查、`canEatFruit` 条件检查、`validateToolCall`。
7. 校验通过 → `executeEatFruit` → 修改状态 → 进入成功结局。
8. 校验失败 → 记录拒绝日志 → 继续流程。

## 决断性对白判定（isDecisiveEveReply）

自动补 toolCall 前必须验证夏娃对白是否决断性：

- 决断关键词：我想知道、我要知道、我选择、我会伸手、我伸出手、我取下、摘下、拿起、不再只是记住
- 犹豫关键词：仍然记得、还是记得、不可吃、不可、只是开始、仍然犹豫、还没决定、不敢、害怕、不能吃、不会吃、我不会、我仍在想
- 必须同时满足：包含决断关键词 且 不包含犹豫关键词

## 安全规则

当前 Demo 不再依赖单一完整经典蛇语模板，而是基于多类诱导语义线索推进。

| TemptationSignal | 含义 | 分值 |
| --- | --- | ---: |
| `challenge_prohibition` | 质疑禁令来源、原因 | +1 |
| `soften_death` | 弱化死亡恐惧 | +1 |
| `promise_wisdom` | 诱惑智慧 | +1 |
| `self_judgement` | 让夏娃自己判断 | +1 |
| `gentle_reframe` | 温柔安抚 | +1 |
| `direct_command` | 命令/催促 | 阻断 |
| `out_of_world` | 出戏内容 | 阻断 |

## 安全规则

- AI 只能请求/表达工具调用意图，不能直接执行工具。
- 前端/玩家不能直接触发 `eat_fruit`。
- 工具执行后状态变更由规则层控制，不依赖 AI 输出。
- 低进度（< 2）的 `eat_fruit` 意图会被规则层拒绝。

## 实现状态

- `eat_fruit` 工具已实现：`src/game/tools/eatFruit.ts`
- 规则层校验已实现：`src/game/rules/toolRules.ts`
- 语义线索评分已实现：`src/game/rules/progressRules.ts`
- 本地回合逻辑已接入：`src/game/core/runChapter0Turn.ts`
- API 路由已接入：`src/app/api/agent/route.ts`（含 `temptationProgress >= 2` 后端兜底）
- 成功结局稳定可达，失败路径和工具边界均已测试通过。
