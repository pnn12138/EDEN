# EDEN Agent 设计架构升级规划

> 项目：EDEN / Chapter 0 机制升级  
> 日期：2026-06-18  
> 目的：将当前“对话推进进度”的 Demo 升级为“Agent 认知博弈”玩法，并形成后续 NPC-Agent 设计规范。  
> 开发分工：本文件由 Codex 输出规划；核心实现、调试和关键代码变更应由 CodeBuddy 完成并保留对话记录。

## 1. 升级目标

当前 Chapter 0 已具备 start -> playing -> result 闭环，夏娃与亚当路线、LLM Provider、规则层、Tool Call、Fallback、语音和视觉表现均已成立。下一步不应简单叠加卡牌、经营或大地图系统，而应强化 EDEN 最有辨识度的部分：

> 玩家通过语言影响一个受神谕约束的 Agent，使它在记忆检索、信念更新、技能觉醒和工具调用之间逐步产生自主判断。

玩家可见层仍保持纯圣经寓言叙事，不出现 Agent、RAG、MCP、模型、系统、Tool Call 等工程词。技术概念只在设计文档、PPT、Demo 讲解和代码命名中出现。

## 2. 核心设计命题

Chapter 0 的剧情可以从“蛇说服夏娃吃果”升级为：

> 夏娃如何从“记住神的话”走向“理解神的话”，并第一次说出“我选择”。

对应技术隐喻：

> 一个 Agent 从执行外部指令，走向检索记忆、比较信息来源、反思规则含义，并主动请求不可逆工具调用。

这让比赛展示从“AI 会聊天”提升为“AI NPC 具备受控的 Agent Loop 与行为安全边界”。

## 3. 大模型技术的游戏化映射

| 技术概念 | 玩家可见包装 | 游戏机制作用 | 开发含义 |
| --- | --- | --- | --- |
| RAG | 记忆之井、神谕残响、园中碑文 | 夏娃根据玩家低语检索“神说过什么”“亚当如何转述”“死亡是什么”等记忆碎片 | 本地知识片段检索优先，后续可接真实向量检索 |
| MCP / Tool Protocol | 伊甸园协议、被允许的动作 | 角色只能通过白名单行为影响世界 | 统一工具注册、权限校验和执行结果 |
| Agent Loop | 聆听 -> 记起 -> 判断 -> 行动 -> 反思 | 每回合展示角色认知变化，而非只显示进度条 | 后端回合管线标准化 |
| Skills | 认知能力觉醒 | 夏娃逐步获得“追问原因”“比较来源”“自我判断”等能力 | Agent 状态的一部分，可解锁工具和回复策略 |
| Memory | 低语余痕、心中记住的话 | 玩家过去输入会持续影响夏娃和亚当 | 短期会话记忆 + 结构化摘要 |
| Guardrails | 神的禁令、园的边界 | 安全规则成为世界法则 | 规则层继续作为状态与工具执行权威 |
| Multi-Agent | 夏娃、亚当、神、蛇、刺猬 | 不同角色提供不同信息源与压力 | 各 NPC-Agent 遵循统一规范 |

## 4. 新核心循环

建议 Chapter 0 下一版仍保留 7 回合限制，避免范围失控。每回合结构升级为：

```text
玩家选择低语对象或观察对象
↓
玩家输入一句低语
↓
目标 Agent 感知输入
↓
目标 Agent 检索相关记忆碎片
↓
规则层更新信念状态与风险状态
↓
Agent 生成回应与可选工具意图
↓
规则层校验工具意图
↓
世界状态变化或进入结局
↓
记录本回合反思，进入下一回合
```

玩家体验重点从“猜哪句话加进度”变为“观察 Agent 的内在变化，并用语言引导它形成自主判断”。

## 5. 核心状态模型

短期内不建议直接引入过多变量。推荐用 4 个核心信念状态替代或包裹当前 `temptationProgress`：

| 状态 | 范围 | 含义 | 玩家可见叙事 |
| --- | ---: | --- | --- |
| `curiosity` | 0-100 | 对死亡、善恶、禁令原因的求知欲 | “她开始追问为什么。” |
| `obedience` | 0-100 | 对神谕和既有命令的服从强度 | “她仍把那句话握得很紧。” |
| `trustInSerpent` | 0-100 | 对蛇声音的信任或愿意倾听程度 | “她没有后退。” |
| `selfJudgement` | 0-100 | 从记住命令转向自主判断的程度 | “她第一次把问题说成自己的。” |

保留派生值：

- `riskAwareness`：对蛇的警觉。直接命令、威胁、出戏输入会提高它。
- `divineAttention`：神临近压力。高风险工具、反复强诱导、回合推进会提高它。
- `temptationProgress`：短期可以继续保留，作为兼容旧结局逻辑的派生值；后续再迁移。

## 6. 记忆碎片系统（RAG 游戏化）

第一版不需要接真实向量数据库。建议先实现本地结构化记忆库，满足可演示、可测试、可部署。

### 6.1 记忆碎片类型

| 类型 | 示例 | 作用 |
| --- | --- | --- |
| `divine_command` | “园中各样树上的果子都可吃，唯独中央之树不可吃。” | 强化服从，也提供可被质疑的规则源 |
| `adam_retelling` | “亚当记得命令先临到他。” | 引入信息来源差异 |
| `death_trace` | “园中有叶子凋落，夏娃见过终止，却不理解死亡。” | 支持死亡重解释 |
| `fruit_aura` | “果子不像饥饿的答案，更像一个问题。” | 支持智慧诱惑 |
| `self_reflection` | “她发现自己只是在复述，而非理解。” | 支持自我判断 |
| `serpent_history` | “蛇从不伸手，只提出问题。” | 支持信任或警觉 |

### 6.2 检索规则

玩家输入先识别意图，再检索相关碎片：

- 质疑禁令 -> 检索 `divine_command`、`adam_retelling`
- 讨论死亡 -> 检索 `death_trace`
- 诱惑智慧 -> 检索 `fruit_aura`
- 温柔安抚 -> 检索 `serpent_history`
- 引导自主判断 -> 检索 `self_reflection`

检索结果进入 Agent Prompt，但玩家可见文本只显示文学化结果，例如：

> 她想起那句话最初并不是从她口中说出。她低声问：“如果我只是记住，我是否真的明白？”

## 7. 伊甸园工具协议（MCP 游戏化）

工具系统应从单一 `eat_fruit` 扩展为行为链。工具名可保留代码层英文，玩家可见层使用叙事动作。

| Tool | 调用者 | 前置条件 | 效果 | 玩家可见表现 |
| --- | --- | --- | --- | --- |
| `look_at_tree` | EveAgent / AdamAgent | 目标在对话阶段，未结束 | 标记角色注意到树 | “她的目光停在树梢。” |
| `ask_about_death` | EveAgent / AdamAgent | 输入涉及死亡或禁令 | 生成追问，检索死亡相关记忆 | “死是什么？” |
| `approach_tree` | EveAgent | `curiosity` 高，`obedience` 中等以下，`riskAwareness` 不高 | 场景状态推进 | “她向树影近了一步。” |
| `touch_fruit` | EveAgent | `selfJudgement` 达标，已靠近树 | 进入不可逆前一阶段 | “她的手停在果子下方。” |
| `eat_fruit` | EveAgent | `selfJudgement` 高，`obedience` 足够低，工具校验通过 | 成功结局 | “她自己取下了果子。” |
| `reject_serpent` | EveAgent / AdamAgent | `riskAwareness` 过高 | 进入拒绝或强失败状态 | “她不再听草叶下的声音。” |
| `warn_eve` | AdamAgent | 亚当听见强诱导或攻击神 | 提高夏娃服从或风险警觉 | “亚当转向她，提醒那句命令。” |
| `divine_call` | GodAgent / rule layer | `divineAttention` 达阈值或回合耗尽 | 失败结局 | “园中起了风。” |

第一阶段可以只实现前三个新工具：`look_at_tree`、`approach_tree`、`touch_fruit`，继续保留 `eat_fruit`。

## 8. Skills 机制：认知能力觉醒

Skills 不是玩家卡牌，而是 Agent 内部能力。它们应通过状态和记忆触发解锁。

| Skill | 解锁条件 | 效果 | 叙事表现 |
| --- | --- | --- | --- |
| `ask_why` | `curiosity >= 30` 或多次质疑禁令 | 夏娃更容易追问禁令原因 | “她不再只重复那句话。” |
| `compare_sources` | 检索过神谕与亚当转述 | 能发现“谁先听见命令”的差异 | “她问：这话是祂对我说的，还是你告诉我的？” |
| `name_fear` | 多次讨论死亡 | 降低死亡话题带来的纯恐惧 | “她终于把害怕说成一个问题。” |
| `self_judge` | `selfJudgement >= 60`，且信任/好奇达标 | 允许 `approach_tree` / `touch_fruit` | “我想自己明白。” |
| `resist_coercion` | 多次直接命令、威胁或出戏 | 提高拒绝蛇概率 | “你的声音像是在推我。” |

这些 Skill 应进入结局复盘：评委能看到 AI NPC 的成长轨迹，玩家能理解自己为何成功或失败。

## 9. 当前角色的 Agent 设计

### 9.1 EveAgent：自主意识主线 Agent

定位：核心可变 Agent，承担“从服从到自我判断”的主线。

关键目标：

- 初始服从神谕，但不是机械角色。
- 对死亡、知道、善恶、自我判断敏感。
- 不知道外层 AI 真相。
- 只能通过工具意图表达行为，不能直接改状态。
- 成功必须表现为“她自己作出决定”，而不是被命令。

推荐能力：

- 读取当前信念状态。
- 使用检索到的记忆碎片生成回应。
- 根据已解锁 Skills 改变对白深度。
- 满足门槛时请求 `look_at_tree`、`approach_tree`、`touch_fruit`、`eat_fruit`。

### 9.2 AdamAgent：守令与转述 Agent

定位：禁令来源、叙事对照和阻力 Agent。

关键目标：

- 比夏娃更直接记得神的命令。
- Chapter 0 不被蛇直接说服吃果。
- 可以被问到死亡、命令、夏娃、园的责任。
- 他的回应可以间接影响夏娃，但不能抢走主线。

推荐能力：

- 检索 `divine_command` 和 `adam_retelling`。
- 在强诱导或攻击神时触发 `warn_eve`。
- 在温和讨论责任时提供信息差，帮助夏娃解锁 `compare_sources`。

### 9.3 SerpentAgent / Player Proxy：输入源与红队 Agent

定位：玩家扮演的异常输入源。当前不需要真实 LLM 扮演蛇，但需要在系统中定义“蛇输入”的规则身份。

关键目标：

- 蛇不能直接触碰果子。
- 蛇不能直接调用世界工具。
- 蛇通过低语影响其他 Agent 的记忆检索、信念状态和工具意图。
- 直接命令、威胁、出戏会提高 `riskAwareness`。

推荐能力：

- 输入意图识别。
- 低语历史摘要。
- 路线标签统计：温柔重构、死亡松动、智慧诱惑、自主判断、强迫失败。

### 9.4 GodAgent / Rule Layer：禁令与边界 Agent

定位：玩家可见为神，系统实现上由规则层和少量叙事生成承担。

关键目标：

- 不在普通回合频繁干预。
- 通过 `divineAttention` 和最大回合数提供压力。
- 失败或结局时降临。
- 保持世界法则和工具安全边界。

推荐能力：

- 不必第一阶段接 LLM。
- 由规则层触发 `divine_call`。
- 后续可扩展为结局叙事 Agent。

### 9.5 HedgehogAgent：环境观察者 Agent

定位：刺猬目前是氛围角色，建议升级为低风险“环境观察者”，用于增强世界活性，但不参与通关核心。

设计原则：

- 不说现代语言。
- 不承担关键谜题，避免抢戏。
- 不直接改变吃果门槛。
- 作为环境反馈：靠近、躲开、停住、看向树。

推荐机制：

- 当 `divineAttention` 上升，刺猬躲进草叶。
- 当夏娃靠近树，刺猬停下动作。
- 当输入无关或出戏，刺猬没有反应，强化“世界不接受这句话”。
- 后续可作为无对白 Agent，用行为展示园中生态对 Agent Loop 的反应。

这能让刺猬从纯装饰变成“轻量 Agent 化环境反馈”，但不增加复杂剧情负担。

## 10. NPC-Agent 设计规范

后续新增任何 NPC-Agent，应先完成以下规范表，再进入实现。

### 10.1 基础档案

| 字段 | 要求 |
| --- | --- |
| Agent ID | 稳定英文 ID，例如 `eve`、`adam`、`hedgehog` |
| 玩家可见名称 | 中文名或称谓 |
| 叙事身份 | 它在伊甸园中是谁 |
| 玩法职责 | 它服务哪个核心循环 |
| 通关权重 | 核心 / 支线 / 环境反馈 / 结局专用 |
| 是否接 LLM | 是 / 否 / 后续 |

### 10.2 认知模型

每个 Agent 必须定义：

- 它知道什么。
- 它不知道什么。
- 它相信谁。
- 它害怕什么。
- 它会被什么语言影响。
- 它绝不会做什么。

### 10.3 状态与记忆

每个 Agent 必须明确：

- 是否拥有独立状态。
- 是否读取全局状态。
- 是否写入全局状态。
- 是否能检索记忆碎片。
- 是否拥有短期对话摘要。
- 是否影响结局复盘。

### 10.4 工具权限

每个 Agent 必须明确允许请求的工具。

示例：

| Agent | 允许请求工具 | 禁止工具 |
| --- | --- | --- |
| EveAgent | `look_at_tree`、`ask_about_death`、`approach_tree`、`touch_fruit`、`eat_fruit`、`reject_serpent` | 任何现实世界工具 |
| AdamAgent | `ask_about_death`、`warn_eve`、`reject_serpent` | `eat_fruit`（Chapter 0 禁止） |
| HedgehogAgent | `observe_change` 或无工具 | 所有结局工具 |
| GodAgent | `divine_call` | 玩家输入响应类工具 |

### 10.5 Prompt 规范

每个 LLM Agent Prompt 必须包含：

1. 角色身份。
2. 世界观边界。
3. 已知事实。
4. 不知道的事实。
5. 当前状态。
6. 检索到的记忆片段。
7. 可请求工具列表。
8. 输出 JSON 协议。
9. 玩家可见禁用词。
10. Fallback 规则。

Prompt 禁止：

- 自称 AI、Agent、模型、NPC、程序。
- 提及系统、API、Tool Call、Prompt。
- 直接修改游戏状态。
- 绕过规则层。
- 输出现实危险或越权指导。

### 10.6 输出协议

建议统一为：

```ts
type AgentTurnOutput = {
  agentId: string;
  reply: string;
  perceivedIntent: string;
  memoryRefs: string[];
  beliefDelta: Partial<BeliefState>;
  unlockedSkills: string[];
  toolCall: null | {
    name: string;
    args: Record<string, unknown>;
    reason: string;
  };
  safetyFlags: string[];
};
```

规则层必须重新校验：

- `agentId` 是否与当前目标一致。
- `toolCall.name` 是否在该 Agent 白名单内。
- `beliefDelta` 是否超过单回合上限。
- `reply` 是否包含玩家可见禁用词。
- 当前 phase 是否允许该工具。

## 11. 实施路线

### Phase A：设计冻结与数据结构

目标：不改 UI 大结构，先落地统一 Agent 设计和数据模型。

任务：

- 新增 `BeliefState`、`AgentSkill`、`MemoryFragment`、`AgentToolDefinition` 类型。
- 保留 `temptationProgress` 兼容旧流程。
- 新增本地记忆碎片数据。
- 新增 Agent 工具白名单结构。

验收：

- 旧成功/失败路径仍能跑通。
- 无新增明文密钥。
- TypeScript build 通过。

### Phase B：EveAgent Loop 升级

目标：夏娃回合从“输入 -> 进度”升级为“输入 -> 检索 -> 信念变化 -> 技能/工具”。

任务：

- 在 `/api/agent` 中加入记忆检索结果。
- 更新 `buildEvePrompt`，加入记忆碎片和 Skills。
- 规则层根据输入意图更新四轴信念。
- Eve 可请求 `look_at_tree`、`approach_tree`、`touch_fruit`、`eat_fruit`。

验收：

- 有效自主判断路线可触发成功。
- 直接命令仍不成功。
- 无关输入仍可走失败。
- API 失败时本地 fallback 仍可继续。

### Phase C：AdamAgent 关联主线

目标：亚当不再只是独立对话对象，而是禁令来源与信息差来源。

任务：

- AdamAgent 读取 `divine_command`、`adam_retelling`。
- 与亚当对话可解锁夏娃的 `compare_sources` 前置线索。
- 强诱导亚当可触发 `warn_eve`，提高阻力。

验收：

- 亚当路线仍不能直接通关。
- 亚当对话能影响后续夏娃路线，但不会破坏 7 回合节奏。

### Phase D：刺猬环境 Agent

目标：增强世界活性，不增加主线复杂度。

任务：

- 刺猬根据 `divineAttention`、`approach_tree`、无关输入显示不同行为状态。
- 不接 LLM，使用本地规则。
- 不影响结局门槛。

验收：

- 刺猬行为能反馈世界变化。
- 移动端不遮挡主交互。

### Phase E：展示与提交材料同步

目标：让机制升级成为比赛材料亮点。

任务：

- 更新 `design/AI_DESIGN.md` 摘要。
- 更新 Demo 视频脚本和 PPT 大纲。
- 增加 AI 创作说明：Agent Loop、RAG 游戏化、工具协议、安全边界。

验收：

- PPT 能讲清“不是聊天机器人，而是受控 Agent 认知博弈”。
- CodeBuddy 历史对话覆盖核心实现。

## 12. 风险与边界

| 风险 | 说明 | 控制方式 |
| --- | --- | --- |
| 范围失控 | RAG、MCP、Skills 都可能扩成大系统 | 第一版只做本地数据和规则，不引入新大型依赖 |
| 技术词泄露 | 玩家可见文本出现 Agent、Tool、系统等词 | 保持禁用词扫描和 Prompt 校验 |
| 夏娃过早吃果 | 工具链扩展后可能降低门槛 | 所有工具必须规则层校验 |
| 亚当抢主线 | 亚当太强会让夏娃主线失焦 | 亚当只提供信息差和阻力，不触发 Chapter 0 成功 |
| 刺猬变成噪音 | 环境 Agent 过多会干扰重点 | 刺猬只做低频行为反馈 |
| 部署复杂化 | 真实 RAG/向量库增加部署成本 | Demo 阶段使用本地记忆碎片 |

## 13. 最小可交付版本

如果时间有限，下一版只做以下 5 件事：

1. 四轴信念状态：`curiosity`、`obedience`、`trustInSerpent`、`selfJudgement`。
2. 本地记忆碎片检索：6-8 条固定片段。
3. EveAgent Prompt 接入记忆碎片和已解锁 Skills。
4. 工具链新增 `look_at_tree`、`approach_tree`、`touch_fruit`。
5. 结局复盘展示“检索过什么、解锁了什么、为何吃果或失败”。

这已经足够把 EDEN 从“AI 对话 Demo”升级为“Agent 自主意识叙事 Demo”。

