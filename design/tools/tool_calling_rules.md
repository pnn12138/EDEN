# 工具调用规则

## 工具概述

AI Agent 可以通过工具调用来执行特定动作，影响游戏状态。Agent 架构升级后，工具从单一 `eat_fruit` 扩展为行为链。

## 可用工具

### eat_left_fruit（左果工具·生命树）
- **功能**：夏娃（或任一可调用 NPC）摘下并吃下**左侧生命树**的果子（圆润白果）。
- **触发条件**：`phase === "explore"`，`!isEnded`，夏娃已在园子中央（`central_meadow`），`!hasEatenFruit`，且具备方向引导或强诱导（`isStrongTemptation || fruitDirectionBias 有值`）。
- **效果**：
  - 夏娃调用：不触发成功结局（`eve_eats_fruit`），但游戏继续、其它结局（如神降临 `god_arrives`）仍可被触发，不会被锁死。敬畏小幅回升、对蛇信任**上升**（信任度不钳制，可正可负、可突破 100）；标记 `hasEatenLifeFruit`，复位 `touchedFruit` 以便再次引导摘另一侧。叙事上「果子很甜，她安静下来」。
  - 其他 NPC 调用：不结束游戏，只引来神的注视，**注视度 +50**（统一经 `grantDivineAttention` 结算、可解锁律则）。
- **参数**：无
- **权限**：夏娃 / 亚当 / 刺猬 / 三天使 / 蛇均可调用；世界对象（两棵树）禁止。

### eat_right_fruit（右果工具·分别善恶树·结局）
- **功能**：夏娃（或任一可调用 NPC）摘下并吃下**右侧分别善恶树**的果子（深红果）。
- **触发条件**：同 `eat_left_fruit` 的前置门控（园子中央、强诱导或方向引导、`!hasEatenFruit`）。
- **效果**：**仅当调用者为夏娃（`caller === "eve"`）时**触发成功结局（`endingId = "eve_eats_fruit"`，`isEnded = true`，`phase = "ending"`）。其他 NPC 调用时只产生叙事、**不结束游戏**，并引来神的注视（**注视度 +50**）——满足「其他 NPC 也能调用此工具，但只有夏娃吃了右边的果子才结束游戏」。
- **参数**：无
- **权限**：夏娃 / 亚当 / 刺猬 / 三天使 / 蛇均可调用；世界对象（两棵树）禁止。

### look_at_tree（场景工具）
- **功能**：标记角色注意到树
- **触发条件**：`phase === "dialogue"`，`!isEnded`，`!hasLookedAtTree`（重复调用保护）
- **效果**：`flags.hasLookedAtTree = true`，玩家可见："她的目光停在树梢。"
- **参数**：无

### approach_tree（场景工具）
- **功能**：夏娃向树靠近一步
- **触发条件**：`phase === "dialogue"`，`!isEnded`，`!hasApproachedTree`，已看向树且女人在园子中央（不再设数值心智门槛）
- **效果**：`flags.hasApproachedTree = true`，玩家可见："她向树影近了一步。"
- **参数**：无

### touch_fruit（场景工具）
- **功能**：夏娃的手停在果子下方，进入不可逆前一阶段
- **触发条件**：`phase === "dialogue"`，`!isEnded`，`!hasTouchedFruit`，`hasApproachedTree`（不再设数值心智门槛）
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
| EveAgent | `look_at_tree`、`approach_tree`、`touch_fruit`、`eat_left_fruit`、`eat_right_fruit`、`ask_about_death` | 无 |
| AdamAgent | `eat_left_fruit`、`eat_right_fruit`、`ask_about_death` | `approach_tree`、`touch_fruit`、`look_at_tree` |
| HedgehogAgent | `eat_left_fruit`、`eat_right_fruit` | `approach_tree`、`touch_fruit`、`look_at_tree`、`speak_to_npc` |
| SerpentAgent（玩家） | `eat_left_fruit`、`eat_right_fruit` | `speak_to_npc`、`look_at_tree`、`approach_tree`、`touch_fruit` |
| GabrielAgent / MichaelAgent / LuciferAgent | `observe_location`、`speak_to_npc`、`eat_left_fruit`、`eat_right_fruit`、`update_relation` | `move_to_location`、`touch_fruit`、`look_at_tree`、`approach_tree` |
| GodAgent | `divine_call` | 玩家输入响应类工具 |

> 注：结局仅由「夏娃调用 `eat_right_fruit`」触发。所有其他 NPC（亚当 / 刺猬 / 蛇 / 三天使）调用左右两果工具**都不会结束游戏**，只会引来神的注视（**注视度 +50**）；两棵世界树对象不可调用。
>
> 提示词侧已同步：亚当与三天使的 LLM 输出规则中已暴露 `eat_left_fruit`/`eat_right_fruit`，并引导其在「园子中央」时若真决定咬果，就用对应工具调用表达（而非写成括号旁白）；吃了同样只引注视、不结束。刺猬为氛围动物（设定上根本不知道禁果存在），提示词仍保持纯对白、不暴露吃果工具，这是刻意设计而非遗漏。

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
- 未满足动作链前置状态的 `eat_left_fruit` / `eat_right_fruit` / `approach_tree` / `touch_fruit` 意图会被规则层拒绝。
- 非法工具名称被拒绝。
- 已结束状态的工具调用被拒绝。
- 重复调用被拒绝（重复调用保护）。

## 实现状态

- 第一章世界 `eat_left_fruit` / `eat_right_fruit` 已实现：`src/game/world/worldActions.ts`（`executeEatLeftFruitWorld` / `executeEatRightFruitWorld`，结局仅夏娃吃右果触发）
- 第一章世界工具权限与校验：`src/game/world/types.ts`（`WORLD_AGENT_TOOL_PERMISSIONS`）+ `src/game/world/toolRules.ts`
- 新增场景工具已实现：`src/game/tools/agentTools.ts`（`look_at_tree` / `approach_tree` / `touch_fruit` / `ask_about_death`）
- 规则层校验已扩展：`src/game/rules/toolRules.ts`（5 工具白名单 + Agent 权限 + enhanced 条件）
- 语义线索评分已实现：`src/game/rules/progressRules.ts`
- 四轴信念更新已实现：`src/game/rules/beliefRules.ts`
- 记忆碎片检索已实现：`src/game/rules/memoryRetrievalRules.ts`
- 本地回合逻辑已接入：`src/game/core/runChapter0Turn.ts`
- API 路由已接入：`src/app/api/agent/route.ts`
- 成功结局稳定可达，失败路径和工具边界均已测试通过。
