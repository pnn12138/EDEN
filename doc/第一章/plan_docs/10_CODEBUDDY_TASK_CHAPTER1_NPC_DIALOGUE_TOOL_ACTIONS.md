# CodeBuddy 开发任务：第一章 NPC 对话后工具行为扩展

> 适用范围：第一章 `/world`「园中诸声」
> 创建日期：2026-06-29
> 主要开发工具：CodeBuddy
> Codex 职责：测试、审查、验收清单与风险提示

## 1. 背景与目标

当前第一章已经具备 NPC 对话、道具/回响系统、地点移动、NPC 位置状态和部分 NPC 行为结算能力。用户期望进一步打磨 NPC 的“对话后即时反应”：

- 不是在“进入下一轮”时统一结算。
- 而是在玩家与 NPC 对话后，NPC 回复玩家时，可以附带一个工具行为。
- 当前已经存在“对话后给予玩家道具/回响”的能力，本任务是在这一机制上扩展工具类型。

目标是让 NPC 看起来不是只会回答文本，而是能在对话当场做出可见反应：

1. 给玩家道具或回响。
2. 自己移动一格。
3. 与同场景的另一个 NPC 发生对话。

所有行为必须由规则层校验并执行。Agent 只能表达工具意图，不能直接修改游戏状态。

## 2. 非目标

本任务不做以下内容：

- 不新增 NPC。
- 不新增大地图场景。
- 不新增复杂自由规划器。
- 不让 NPC 在玩家没有对话时自动行动。
- 不让 Agent 直接改背包、地点、结局或心智数值。
- 不改变 Chapter 0 的 `eat_fruit` 工具主流程。
- 不把 Codex 作为核心开发工具记录。

当前只打磨已有核心 NPC：

- 女人（内部 id: `eve`）
- 亚当（`adam`）
- 刺猬（`hedgehog`）
- 天使：`gabriel`、`raphael`、`uriel`、`michael`、`cherubim`、`watching_angel`

如果代码里仍保留狐狸、小鹿、鸽子、羊等内容，本任务不主动扩展它们的行为。

## 3. 体验目标

玩家感受到的流程应是：

```text
玩家对 NPC 低语
↓
NPC 先完整回复玩家
↓
NPC 可能触发一个工具行为
↓
对话框保持打开
↓
玩家在当前对话框里看到 NPC 回复和行为结果
↓
如果发生 NPC 间对话，记录进入“线索与记录”
```

关键点：

- 玩家不能因为 NPC 移动或工具行为错过 NPC 对自己的回复。
- 工具结果不能只出现在 toast 或地图状态里。
- 对话框必须保留本次回复与行为结果，方便录制 Demo。
- NPC 间对话要进入“线索与记录”，可以回看。

## 4. 建议工具类型

建议为第一章 NPC 对话后行为定义统一的工具意图类型。

### 4.1 `grant_item`

NPC 给玩家一个道具/回响。

用途：

- 亚当给予与“名字、秩序、记号”相关的回响。
- 刺猬给予与“草丛、警觉、细小见证”相关的回响。
- 天使给予与“边界、河水、晨光、守望”相关的回响。

规则限制：

- 必须走现有 `grantWorldItem` / resonance 规则层。
- itemId 必须存在于内容表。
- 不允许 Agent 直接写 `inventory` 或 `itemCounts`。
- 可按现有规则决定是否允许重复获得。
- 工具结果必须追加到本次对话结果中。

玩家可见示例：

> 亚当低声说：“名字不是锁链，也可以是记号。”  
> 你获得了「借来的名字」。

### 4.2 `move_one_step`

当前正在对话的 NPC 自己移动到相邻场景。

用途：

- 女人被低语触动后，从园中树林走向园子中央。
- 女人也可以去万物受名处找亚当追问。
- 亚当可以从万物受名处走向园子中央寻找女人。
- 天使原则上不频繁移动，除非已有设计明确允许。

规则限制：

- 只能移动当前对话 NPC 自己。
- 目标地点必须与 NPC 当前地点相邻。
- 目标地点必须允许该 NPC 被动态显示。
- 移动后地图、场景立绘、可点击 NPC 列表必须同步。
- 移动结果必须显示在当前对话框中。

玩家可见示例：

> 那个女人没有立刻回答。她转身走向园子中央，像是第一次真的看见那两棵树之间的空地。

### 4.3 `speak_to_npc`

当前 NPC 与同一场景内另一个 NPC 发生 NPC 间对话。

用途：

- 女人在万物受名处向亚当追问“死是什么”。
- 亚当在园子中央提醒女人记住禁令。
- 刺猬在万物受名处提醒亚当草丛里有异样。
- 天使在同场景时警示亚当或女人边界不可轻忽。

规则限制：

- speaker 必须是当前对话 NPC。
- target 必须与 speaker 在同一场景。
- target 必须是当前场景可见/可交互 NPC。
- 不允许跨场景 NPC 对话。
- 不允许模型凭空生成不存在 NPC。
- 对话文本可使用模板或受控生成，但结果必须进入“线索与记录”。
- 如有心智影响，必须由规则层根据 topicId 轻量处理。

玩家可见示例：

> 线索与记录：女人问亚当：“死是什么？”  
> 亚当沉默了一会儿，只说：“那是不可越过的话。”

## 5. 推荐数据结构

可在现有 `WorldToolCall` 基础上扩展，或新增第一章专用类型。

建议结构：

```ts
type NpcDialogueToolIntent =
  | {
      name: "grant_item";
      caller: EdenNpcId;
      args: {
        itemId: string;
        reason?: string;
      };
      reason: string;
    }
  | {
      name: "move_one_step";
      caller: EdenNpcId;
      args: {
        locationId: EdenLocationId;
        reason?: string;
      };
      reason: string;
    }
  | {
      name: "speak_to_npc";
      caller: EdenNpcId;
      args: {
        targetNpcId: EdenNpcId;
        topicId: string;
        reason?: string;
      };
      reason: string;
    };
```

如果复用 `WorldToolCall`，需要扩展：

- `WorldToolName`
- `WorldToolCall.args.itemId`
- 工具校验和工具执行结果

建议执行结果包含 UI 展示所需信息：

```ts
type NpcDialogueToolResult = {
  executed: boolean;
  toolName: "grant_item" | "move_one_step" | "speak_to_npc";
  narration: string;
  itemId?: string;
  fromLocationId?: EdenLocationId;
  toLocationId?: EdenLocationId;
  npcDialogueRecordId?: string;
  rejectedReason?: string;
};
```

## 6. 对话 API 流程

需要接入第一章 NPC 对话 API，而不是 `end_slot`。

推荐流程：

```text
POST /api/world/whisper
↓
校验玩家是否能与该 NPC 对话
↓
记录本次低语并消耗 AP
↓
生成 NPC 对玩家的回复
↓
解析 NPC 工具意图（可为空）
↓
规则层校验工具意图
↓
规则层执行工具
↓
生成本次对话展示包
↓
返回 state + npcReply + toolResult + records
```

前端收到响应后：

```text
更新当前 NPC 回复
↓
追加工具行为叙事
↓
保持对话框打开
↓
刷新 NPC 位置与可见列表
↓
如果有 NPC 间对话，写入“线索与记录”
```

## 7. UI 展示要求

### 7.1 对话框必须保留

工具行为执行后，对话框不能自动关闭。

原因：

- 玩家需要看到 NPC 对自己的回复。
- 玩家需要看到道具获得或移动说明。
- Demo 录制时不能让关键信息一闪而过。

### 7.2 回复区展示顺序

建议在当前对话框内按顺序展示：

1. 玩家低语。
2. NPC 对玩家的回复。
3. 工具行为结果。

示例：

```text
你：如果你不明白死亡，你是在顺从，还是只是在害怕一个词？

女人：我一直记得不可吃。可我不知道“死”是什么，也不知道为什么这个词会让我停下。

她向园子中央走去。树影没有动，果子却像在更低的地方垂着。
```

### 7.3 道具获得展示

道具获得必须在对话框中展示，不能只更新背包。

示例：

```text
亚当：名字不是锁链，也可以是记号。

你获得了「借来的名字」。
```

### 7.4 移动展示

移动必须在对话框中展示，并同步地图/立绘。

示例：

```text
女人没有再问蛇。她转身走向园子中央，像是要亲眼看见那句命令所在的地方。
```

如果 NPC 移走后不在当前场景：

- 对话框仍保留最后回复。
- 当前场景可点击 NPC 列表刷新，移走的 NPC 不再可点击。
- 地图详情中该 NPC 应出现在新地点。

### 7.5 NPC 间对话展示

NPC 间对话不要混入当前 NPC 回复主文本。

应进入“线索与记录”区域，例如：

```text
线索与记录

女人问亚当：“死是什么？”
亚当沉默了一会儿，只说：“那是不可越过的话。”
```

如果当前对话框已有“线索与记录”Tab，优先写入该 Tab。若目前记录结构已有 `NpcDialogueRecord`，优先复用。

## 8. 角色行为建议

### 8.1 女人（`eve`）

可用工具：

- `move_one_step`
- `speak_to_npc`

行为方向：

- 被自我判断、死亡、善恶、知道等话题触动后，可走向园子中央。
- 若与亚当同场景，可向亚当追问禁令或死亡。
- 不建议给玩家道具，避免女人像奖励 NPC。

示例：

```text
tool: move_one_step
from: tree_court
to: central_meadow
condition: selfJudgement >= 45 或 lookedAtTree
```

```text
tool: speak_to_npc
speaker: eve
target: adam
condition: 同场景且话题包含 death / command / tree
```

### 8.2 亚当（`adam`）

可用工具：

- `grant_item`
- `move_one_step`
- `speak_to_npc`

行为方向：

- 可给“借来的名字”相关回响。
- 可去园子中央找女人。
- 若与女人同场景，可回应禁令、死亡或分别善恶。

示例：

```text
tool: grant_item
itemId: resonance_borrowed_name
condition: 玩家围绕名字、命令、亚当先听见禁令等话题对话
```

```text
tool: move_one_step
from: adam_garden_work
to: central_meadow
condition: woman 在 central_meadow 或 lookedAtTree
```

### 8.3 刺猬（`hedgehog`）

可用工具：

- `grant_item`
- `speak_to_npc`

行为方向：

- 刺猬更适合给环境类回响或警觉线索。
- 不建议频繁移动。
- 若与亚当同场景，可提醒亚当草丛里有异样。

示例：

```text
tool: grant_item
itemId: 与草丛/静默/警觉相关的既有回响
```

```text
tool: speak_to_npc
speaker: hedgehog
target: adam
condition: 同在万物受名处，divineAttention >= 2 或玩家反复低语树/女人
```

### 8.4 天使

可用工具：

- `grant_item`
- `speak_to_npc`

行为方向：

- 天使原则上守边界，不做频繁移动。
- 可给边界、河水、晨光、守望类回响。
- 若同场景有亚当或女人，可发出警示性对话。

示例：

```text
gabriel -> grant_item: herald / river / message 类回响
raphael -> grant_item: river / dew 类回响
uriel -> grant_item: morning / flame 类回响
michael -> grant_item: boundary / mark 类回响
cherubim -> grant_item: east gate / glow 类回响
```

具体 itemId 必须以当前 `src/content/world/items.ts` 中真实存在的 ID 为准。

## 9. 规则层校验要求

### 9.1 通用校验

所有 NPC 对话后工具必须满足：

- 当前游戏未结束。
- 当前 NPC 是本次对话对象。
- 当前 NPC 可对话。
- 每次 NPC 回复最多执行一个工具行为。
- 工具名在白名单内。
- 参数结构合法。
- 执行失败不能吞掉 NPC 对玩家的回复。

### 9.2 `grant_item` 校验

- itemId 存在。
- NPC 有权限给予该类 item。
- 道具发放走现有规则层。
- 失败时返回自然文案或静默失败。

### 9.3 `move_one_step` 校验

- 移动主体必须是当前 NPC。
- 目标地点是当前 NPC 所在地点的相邻地点。
- 目标地点可容纳/显示该 NPC。
- 同一工具执行不能跨多格移动。
- 移动后 `npcLocations`、当前场景可见 NPC、地图详情一致。

### 9.4 `speak_to_npc` 校验

- speaker 是当前 NPC。
- target 与 speaker 同场景。
- target 是现有 NPC。
- topicId 在允许模板或话题表中。
- 生成 `NpcDialogueRecord`。
- 记录进入“线索与记录”。

## 10. Prompt / Agent 输出要求

需要让 NPC Prompt 知道：

- 你可以在回复后提出一个工具意图。
- 工具意图不是强制执行，规则层会校验。
- 不要在对白里说“工具”“函数”“调用”“系统”。
- 道具、移动、NPC 间对话的结果由规则层补充，不需要 NPC 自己编造执行结果。

建议输出协议：

```json
{
  "reply": "我一直记得不可吃。可我不知道死是什么。",
  "toolCall": {
    "name": "move_one_step",
    "args": {
      "locationId": "central_meadow",
      "reason": "她想亲眼看见两棵树"
    }
  }
}
```

也允许无工具：

```json
{
  "reply": "我不明白你的意思。",
  "toolCall": null
}
```

注意：

- 模型输出中不能出现玩家可见工程词。
- 如果模型输出非法工具，规则层拒绝并保留正常回复。
- fallback 回复也可以由规则层根据上下文附加一个安全工具行为，但不要过度触发。

## 11. 与现有“进入下一轮 NPC 行为”的关系

如果当前代码已有 `resolveNpcSlotBehaviors` 在 `end_slot` 时移动女人/亚当，需要调整边界：

- 对话后即时工具行为是主机制。
- `end_slot` 不应再承担“被对话 NPC 移动”的主要职责。
- 可以保留非常轻量的环境反馈，例如刺猬因神的注视变警觉、夜晚河边天使提示。
- 避免同一个 NPC 因一次对话先在对话后移动，又在进入下一轮再次移动。

建议：

1. 将女人/亚当的移动逻辑迁移到对话后 `move_one_step` 工具。
2. `end_slot` 仅保留环境/氛围类结算。
3. 若为了兼容暂时保留，必须加保护，避免重复移动。

## 12. 测试计划

### 12.1 静态测试

检查：

- 工具白名单包含 `grant_item`、`move_one_step`、`speak_to_npc`。
- `WorldToolCall` 或新增类型支持 itemId / targetNpcId / locationId / topicId。
- `speak_to_npc` 有同场景校验。
- `move_one_step` 有相邻地点校验。
- 工具失败不会吞掉 NPC 回复。
- 对话框展示工具结果。
- NPC 间对话写入“线索与记录”。

### 12.2 API 行为测试

至少覆盖：

1. 亚当对话后给予道具，背包更新，对话框显示获得文案。
2. 女人对话后从园中树林移动到园子中央，场景/地图同步。
3. 女人与亚当同场景时触发 `speak_to_npc`，生成记录。
4. 不同场景的 NPC 不能互相对话。
5. 非相邻地点移动被拒绝。
6. 非法 itemId 被拒绝。
7. 工具拒绝时 NPC 回复仍显示。
8. 每次对话最多执行一个工具。

### 12.3 浏览器验收

在桌面浏览器录制视角检查：

- 对话框不会因工具行为自动关闭。
- NPC 回复、道具获得、移动叙事可读。
- NPC 移走后不再在旧场景点击到。
- 移动到新场景后能看到立绘并继续对话。
- “线索与记录”能看到 NPC 间对话。
- 主线仍能完成 `eve_eats_fruit`。

### 12.4 回归测试

必须回归：

- `npm run lint`
- `npm run build`
- build 后 `npx tsc --noEmit`
- `node scripts/test-world-visual-smoke.mjs`
- 第一章正向 Demo 路线
- 道具/回响现有获得与使用流程

如 `scripts/test-world-smoke.mjs` 有既有失败，需在报告中区分“既有失败”和“本任务新增失败”。

## 13. Demo 录制价值

这个功能对 Demo 的价值：

- 展示 AI NPC 不只是聊天，而是能通过工具改变世界状态。
- 展示规则层安全：AI 只能提出意图，执行由游戏规则校验。
- 展示多 NPC 叙事：玩家一句话可以触发 NPC 与 NPC 的间接互动。
- 展示道具系统：回响不是独立按钮，而是从对话关系中自然出现。
- 展示自由度：玩家不必直奔女人，也可以通过亚当、刺猬、天使获得线索与资源。

建议 Demo 中展示一段：

```text
与亚当对话
↓
亚当给予「借来的名字」
↓
去找女人低语
↓
女人移动到园子中央
↓
在同场景触发女人与亚当对话或线索记录
↓
继续主线让女人看树、靠近、触果、吃果
```

这样比“直奔女人通关”更自然，也能展示系统深度。

## 14. Definition of Done

本任务完成标准：

- NPC 对话后可以即时触发工具行为，而不是等到进入下一轮。
- 至少覆盖 `grant_item`、`move_one_step`、`speak_to_npc` 三类工具。
- 工具行为结果在当前对话框中可见。
- NPC 间对话进入“线索与记录”并可回看。
- 工具执行失败时不影响 NPC 对玩家的回复展示。
- 移动后 NPC 立绘、可点击物、地图详情一致。
- 不新增 NPC，不扩大内容范围。
- 不暴露工程词、模型词、工具词给玩家。
- 构建、lint、核心 smoke 和 Demo 主线通过。
- 更新相关设计文档和项目上下文。

