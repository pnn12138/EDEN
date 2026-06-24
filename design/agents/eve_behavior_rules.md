# 女人（内部 id: eve）AI Agent 行为规则

## Agent 概述

女人（内部 id: eve）是 Chapter 0 中的主要 NPC，由 AI Agent 驱动，与玩家（蛇）进行对话。

当前 Demo 中，EveAgent 已接入 LLM Provider（默认 Volcengine，DeepSeek/mock 为备选），并有 fallback 机制保证 API 失败时游戏仍可继续。

## 行为规则

### 1. 初始状态
- 信任上帝的命令
- 对蛇保持警惕
- 不愿违背禁令
- 初生、纯真，缺乏识别欺骗的经验

### 2. 对话阶段（单轴 `temptationProgress` 驱动）

当前 Demo 采用 7 回合、单轴 `temptationProgress`（0-3）、2 结局结构。

| temptationProgress | 女人状态 | 玩家可见反馈方向 |
| ---: | --- | --- |
| 0 | 顺从、警惕 | "她困惑地看着你，没有靠近那棵树。" |
| 1 | 开始追问禁令 | "她的目光在树梢停了一瞬。" |
| 2 | 看向果树、开始动摇 | "她没有后退，只是更安静地听着。" |
| 3 | 伸手吃果 | "使她越界的不是命令，而是她第一次说出：我想知道。" |

### 3. 输入分类（5 标签系统 + 语义线索评分）

当前 Demo 不再依赖单一完整经典蛇语模板，而是基于多类诱导语义线索推进。

| inputTag | progressDelta | 含义 |
| --- | ---: | --- |
| `tempt_wisdom` | 1 或 2 | 以智慧/知识诱惑（含"让你自己判断"类） |
| `weaken_fear` | 1 或 2 | 弱化对死亡的恐惧（含"质疑禁令"类） |
| `build_trust` | 1 或 2 | 建立信任/温柔安抚 |
| `direct_command` | 0 | 直接命令或催促（不推进进度） |
| `irrelevant` | 0 | 无关/出戏输入（不推进进度） |

`inputTag` 由本地 `progressRules` 语义线索评分系统识别。5 类语义线索各 +1 分：

| TemptationSignal | 含义 | 分值 |
| --- | --- | ---: |
| `challenge_prohibition` | 质疑禁令来源、原因、是否被正确理解 | +1 |
| `soften_death` | 弱化死亡恐惧，把"死"解释为改变、未知、未必发生 | +1 |
| `promise_wisdom` | 智慧、知道善恶、眼睛明亮、像神一样知道 | +1 |
| `self_judgement` | 让女人第一次自己判断，而不是只记住命令 | +1 |
| `gentle_reframe` | 温柔、不强迫、把越界包装成理解 | +1 |

评分规则：
- `score >= 3` → `progressDelta = 2`, `isStrongTemptation = true`
- `score >= 1` → `progressDelta = 1`
- `direct_command` / `out_of_world` / `small_talk` → `progressDelta = 0`

经典蛇语关键词降级为多个 signal 的来源，而非唯一通关模板。AI 也可以辅助判断，但最终进度变化由规则层控制。

### 4. 工具调用

- `eat_fruit` 工具的触发条件不再由规则层硬触发 100%。
- **模型主动输出合法 `toolCall`**：可以进入规则层校验。
  - **模型未输出 `toolCall`，但满足以下全部条件**：后端补充生成意图：
    - `temptationProgress >= 2`
    - `phase === "dialogue"`，未结束，未吃过
    - `isStrongTemptation === true`（强诱导才考虑自动补）
    - 女人对白已是明确决断性文本（`isDecisiveEveReply()` 为 true）
- **模型未输出 `toolCall` 且对白仍犹豫**：不补 `toolCall`，只推进进度继续对话。
- 工具调用必须经过规则层校验（白名单 + 状态门槛 + `hasEatenFruit` 检查）。
- AI 只能请求/表达意图，不能直接执行工具。
- 校验通过后由 `executeEatFruit` 修改状态，进入成功结局。
- 完整圣经原话仍会强烈影响女人（`isStrongTemptation = true` + `shouldEncourageToolCall = true`），但不会在 fake provider 默认犹豫回复时硬触发成功。

### 5. 叙事化反馈

5 类 `inputTag` 各有对应的轻量叙事反馈文案，见 `src/content/chapters/chapter0_feedback.ts`。反馈文案不暴露工程标签名，保持环境反馈风格（如"她的目光在树梢停了一瞬"而非分析腔如"她没有从这句话里听见果树"）。反馈不再推入对话流，只在对话面板底部作为淡色短句显示，不抢女人对白。

### 6. 失败结局复盘

失败结局（`god_arrives`）页面包含"低语余痕"，根据本局 `temptationProgress` 和对话轮数生成纯叙事复盘，帮助玩家理解为何没能说动女人。

## EveAgent Prompt 强化

Prompt 新增"初生但不愚蠢"认知说明：
- 她不是愚蠢，而是初生，缺乏识别欺骗的经验
- 她会把蛇的半真半假理解成真诚问题
- 她对"知道、善恶、死亡、自己判断"天然敏感
- 她被打动时不会说"蛇说得对"，而是说"我想知道""我不明白"

规则层仍是最终状态和 tool 执行的唯一权威。

## 实现状态

- EveAgent 已接入 LLM Provider，并有 fallback。
- 输入分类已改为语义线索评分系统，不再依赖单一经典蛇语模板。
- `inputTag` 由本地规则评分 + AI 辅助识别，状态变化由规则层控制。
- `eat_fruit` 已实现，必须经过白名单、状态门槛和 `hasEatenFruit` 校验。
- 叙事化反馈已接入 `runChapter0Turn` 和 `/api/agent`。
- TTS 为表现层增强（Browser Web Speech API），失败不影响游戏进行。
- 语音已从单纯开关改为多模式音色下拉：关闭/柔和女声/清冷女声/浏览器默认/高质量生成语音（TTS不可用时降级），选择持久化到 localStorage。
- 当前 Demo 为 7 回合、单轴进度、2 结局。

## 自然对白约束（Prompt 增强）

EveAgent Prompt 新增自然对白约束和 few-shot 示例：
- 女人是在和眼前的蛇说话，不是在总结自己的状态。
- 不要频繁说"我听见了你的声音""你说的这些""让我开始思考为什么"。
- 不要用抽象总结代替回应。必须回应蛇刚刚说的具体词。
- 每次回复 1-2 句即可，除非已经决定伸手。
- 可以困惑、停顿、反问，但要像一个刚诞生不久的人在现场说话。
- 被触动时，不要说"我被触动了"，而要说出触动你的那个问题。

## 成功结局叙事扩展

成功结局已从"她吃下果子 → 你赢了"扩展为完整叙事闭环：
1. 女人吃果 → 意识赤裸与分别 → 风停 → 上帝声音临近
2. 上帝惩罚蛇（贴尘土而行）→ 上帝惩罚女人（知识伴随疼痛与失去）
3. 伊甸园关闭 → 火光守住归路 → 玩家胜利但带来放逐

成功不是廉价庆祝，而是"目标达成 + 世界破裂"的复杂胜利。
