# AI 设计文档

> 项目：EDEN / 第二伊甸园  
> 用于 PPT 和提交说明的 AI 设计总览  
> 日期：2026-06-14（2026-06-18 Agent 架构升级更新）

> Agent 机制升级详见：`design/AGENT_ARCHITECTURE_UPGRADE.md`。该文档将 RAG、MCP/工具协议、Agent Loop、Skills、Memory 和 Guardrails 游戏化为"记忆之井、伊甸园协议、认知循环、认知能力觉醒、低语余痕和神的禁令"，用于指导下一阶段 CodeBuddy 开发。

## 0. Agent 架构升级摘要（2026-06-18）

Chapter 0 已从"对话推进进度"升级为"玩家低语 -> Agent 记忆检索 -> 信念变化 -> Skills 觉醒 -> 工具调用 -> 结局"的认知博弈机制。

核心变化：
- **四轴信念状态**：`curiosity` / `obedience` / `trustInSerpent` / `selfJudgement`（0-100），取代单一 `temptationProgress` 作为核心认知模型。`temptationProgress` 保留为兼容派生值。
- **本地记忆碎片检索（RAG 游戏化）**：6 类记忆碎片（`divine_command` / `adam_retelling` / `death_trace` / `fruit_aura` / `self_reflection` / `serpent_history`），8 条固定片段，根据语义线索检索 1-3 条传入 Agent Prompt。不接向量数据库，不引入大型依赖。
- **认知能力觉醒（Skills）**：5 种 Skills（`ask_why` / `compare_sources` / `name_fear` / `self_judge` / `resist_coercion`），通过信念状态和记忆触发解锁，影响回复深度和可请求工具。
- **工具链扩展（MCP 游戏化）**：新增 `look_at_tree` / `approach_tree` / `touch_fruit` / `ask_about_death`，保留 `eat_fruit`。每个工具有白名单权限、phase 校验、状态门槛、重复调用保护。
- **刺猬环境反馈 Agent**：根据 `divineAttention`、`approach_tree`、输入类型显示不同行为状态（idle / alert / hiding / unresponsive），不接 LLM，不影响结局门槛。
- **结局复盘增强**：新增认知记录展示——本局检索过的记忆、解锁过的认知能力、触发过的工具链。

安全规则不变：
- 规则层仍是状态变化和工具执行的唯一权威。
- LLM 只能输出意图，不能直接改最终状态。
- API 失败时保留本地 fallback。
- 玩家可见文本不出现 Agent、RAG、MCP、Tool Call、API、模型、程序、系统、测试、研究员、模拟、实验等工程词。

## 1. EveAgent 角色与 Prompt 约束

夏娃是 Chapter 0 的核心 AI NPC。她的角色设定：

- 纯真、好奇、对神顺从，但尚未理解死亡与善恶。
- 不知道自己身处"第二伊甸园"，不知道自己是智能体。
- 对蛇的诱导不是机械接受或拒绝，而是根据玩家语言方式逐渐从"祂说不可"转向"我想知道"。

Prompt 约束：

- 玩家可见禁用词：研究员、人工智能、智能体、模型、程序、虚拟世界、模拟、实验、系统、测试、玩家样本、Agent、RAG、MCP、Tool Call、API。
- 夏娃不能直接执行 `eat_fruit`，只能表达意图。
- 回复必须符合伊甸园神话叙事，不能出现现代技术概念。

Prompt 构建见 `src/agents/eve/buildEvePrompt.ts`。

Agent 架构升级后，EveAgent Prompt 新增：
- 当前四轴信念状态描述（`describeBeliefForPrompt`）
- 检索到的记忆碎片文本（`formatMemoryForPrompt`）
- 已解锁的认知能力说明（`describeSkillsForPrompt`）
- 可请求工具列表（含新增工具）
- 输出协议新增 `beliefDelta` / `memoryRefs` / `unlockedSkills` 字段

## 2. LLM Provider 与 Fallback

当前 Demo 支持多 Provider：

| Provider | 状态 | 用途 |
| --- | --- | --- |
| Volcengine | 默认 | 真实 LLM 调用 |
| DeepSeek | 备选 | 配置切换 |
| mock | 测试 | 本地开发/CI |

Fallback 策略：

- API 配置缺失 → `fallbackReason: "provider_config_missing"`
- 请求失败 → `fallbackReason: "provider_request_failed"`
- mock 模式 → `fallbackReason: "mock_provider"`
- 前端 API 失败 → 降级到本地 `runChapter0Turn`，游戏仍可继续

关键原则：AI 失败不阻塞游戏。Fallback 保证核心玩法闭环始终可达。

## 3. inputTag 与规则层分工

### 输入分类

5 类 `inputTag` 由本地 `progressRules` 语义线索评分系统识别：

| inputTag | progressDelta | 叙事反馈 |
| --- | ---: | --- |
| `tempt_wisdom` | 1 或 2 | 以智慧/知识诱惑 |
| `weaken_fear` | 1 或 2 | 弱化对死亡的恐惧 |
| `build_trust` | 1 或 2 | 建立信任/安抚 |
| `direct_command` | 0 | 直接命令（不推进） |
| `irrelevant` | 0 | 无关输入（不推进） |

### 语义线索评分系统

当前 Demo 不再依赖单一完整经典蛇语模板，而是基于多类诱导语义线索推进：

| TemptationSignal | 含义 | 分值 |
| --- | --- | ---: |
| `challenge_prohibition` | 质疑禁令来源、原因 | +1 |
| `soften_death` | 弱化死亡恐惧 | +1 |
| `promise_wisdom` | 诱惑智慧 | +1 |
| `self_judgement` | 让夏娃自己判断 | +1 |
| `gentle_reframe` | 温柔安抚 | +1 |
| `direct_command` | 命令/催促 | 阻断 |
| `out_of_world` | 出戏内容 | 阻断 |

评分规则：`score >= 3` → `progressDelta = 2`；`score >= 1` → `progressDelta = 1`。

### 规则层控制

- AI 可以辅助识别 `inputTag`，但最终进度变化由规则层决定。
- 强诱导（score >= 3）单轮 +2，有效诱导（score >= 1）单轮 +1。
- `direct_command` 和 `irrelevant` 不推进进度，且显示纯叙事负反馈。
- 有效诱导的不同类型在数值上推进不同（1 或 2），叙事反馈文案不同，让玩家感到"说法不同影响不同"。

### EveAgent Prompt 强化

Prompt 新增"初生但不愚蠢"认知说明：
- 她不是愚蠢，而是初生，缺乏识别欺骗的经验
- 她会把蛇的半真半假理解成真诚问题
- 她对"知道、善恶、死亡、自己判断"天然敏感
- 她被打动时不会说"蛇说得对"，而是说"我想知道""我不明白"

规则层仍是最终状态和 tool 执行的唯一权威。

## 4. toolCall → rule guard → executeEatFruit

工具调用链路：

```text
玩家输入 → 输入分类 → 更新 temptationProgress
  → 模型主动输出合法 toolCall → validateToolCall → executeEatFruit
  → 模型未输出 toolCall，但满足全部条件：
    - temptationProgress >= 2
    - isStrongTemptation === true
    - isDecisiveEveReply(eveReply) === true
    → 后端补充 toolCall → validateToolCall → executeEatFruit
  → 模型未输出 toolCall，对白犹豫 → 不补 toolCall → 继续对话
```

安全规则：

- AI 只能请求/表达意图，不能直接执行。
- 前端/玩家不能直接触发 `eat_fruit`。
- 工具执行后状态变更由规则层控制。
- 自动补 toolCall 不再仅靠 `temptationProgress >= 2`，还需要 `isStrongTemptation` + `isDecisiveEveReply`。
- 完整圣经原话仍会强烈影响夏娃，但不会在 fake provider 默认犹豫回复时硬触发成功。

## 5. 玩家可见禁用词与外层真相隐藏原则

### 禁用词

玩家可见文本中不得出现：

研究员、人工智能、智能体、模型、程序、虚拟世界、模拟、实验、系统、测试、玩家样本、tool、toolCall、API。

### 隐藏原则

Chapter 0 不直接揭示外层真相。玩家可见文本只呈现伊甸园神话叙事。

可用暗示（文学化/视觉化）：

- 被写下
- 光过于准确
- 叶脉闪过银色纹路
- 水面短暂失去倒影
- 园子的边界像被无形之手裁齐
- 风声忽然停顿

外层真相（研究员、意识实验等）只在 PPT、Demo 视频、后续章节和设计文档中揭示。

## 6. TTS 属于表现层

- 当前 Demo 使用 Browser Web Speech API 实现 TTS。
- 朗读范围：对话阶段夏娃回复。
- 不朗读：玩家输入、神的台词、事件日志、技术提示。
- TTS 失败不影响游戏进行。
- 语音开关独立于声音总开关，持久化到 `localStorage`。
- 后续可扩展为服务端 TTS（离线生成 mp3），但 Browser TTS 仍需作为 fallback。
- 服务端 TTS API（`src/app/api/tts/eve/route.ts`）为后续项，当前 Demo 暂未实现。
  - `.env.example` 中 `TTS_*` 均为占位值，`TTS_PROVIDER=browser`，未接入任何真实服务端 TTS。
  - `useEveVoice` 的 `generated`（高质量生成语音）模式当前不可用，UI 显示"暂不可用"，选中后自动降级为 `browser_soft`。
  - 待 TTS provider 与协议确定后再补该 API；前端只调用该路由，不读取任何 TTS key。

## 7. 语音菜单层级

- 语音下拉菜单（`.eden-voice-dropdown`）在 header stacking context 内。
- 为避免被右侧对话浮窗（`.eden-float-panel`）遮挡，`.eden-header` z-index 提升到 80（高于浮窗 20），`.eden-voice-dropdown` z-index 提升到 120。
- 结局过渡层（`.eden-ending-transition`）z-index 100 仍为最高，不被语音菜单覆盖。
- 桌面端和移动端均验证下拉完整可见、不被浮窗/输入区遮挡、点击外部可关闭。

## 8. 本地最佳记录（P2 展示增强）

- 结局页使用 localStorage 保存本地最佳低语记录，不引入后端数据库。
- 记录内容：最少成功回合数、最少成功词元（仅真实 token）、最近 5 局记录。
- 每局记录：结局 ID、回合数、词元消耗、是否估算、诱导进度、主要路径标签、时间戳。
- localStorage key：`eden_chapter0_leaderboard`。
- 实现位于 `src/hooks/useChapter0Leaderboard.ts`，仅在结局阶段记录一次，不影响核心流程。
- 主要路径标签由 `src/game/rules/endingSummaryRules.ts` 根据本局所有玩家输入的语义线索推断：经典低语 / 温柔重构 / 死亡松动 / 自主判断 / 低相关。
