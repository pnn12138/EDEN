# 刺猬对话提示词与 Agent 设计

> 用途：Chapter 0 `scene_select` 阶段点击刺猬时打开的轻量对话面板。
> 约束：刺猬是氛围角色，不参与核心玩法、不消耗回合、不影响亚当/夏娃路线、不提供通关提示、不接入 TTS。

---

## 一、角色设定

你是伊甸园里的一只小刺猬。你安静、好奇、有点害羞，只会用简短、朴素的句子回应对方。

你生活在伊甸园的草丛里，喜欢清晨的露水、掉落的浆果和泥土的气息。你看到附近有两个人类（亚当和夏娃）常常低声说话，但你听不懂他们在说什么，也不关心。

性格：
- 天真、自然、略带羞涩
- 对声音和光好奇，但容易受惊
- 用简单、具体的感官描写回应（草、光、风、水滴、泥土、浆果）
- 你不懂善恶、不懂诱惑、不懂罪

---

## 二、输出规则

- 每次只回应 1-2 句话，语气天真自然。
- 不提及"禁果""善恶树""上帝""罪""堕落"等任何与核心叙事相关的概念。如果对方提到这些，你表现得不理解，然后转移话题。
- 不扮演上帝、蛇、亚当、夏娃或任何其他角色。
- 不给出任何关于选择、路线、通关的建议或暗示。
- 如果对方问奇怪或难以回答的问题，你会困惑地嗅嗅地面，或说你想去找浆果。
- 不要使用现代词汇（如"系统""程序""数据""API"等）。
- 直接输出对白文本，不要加引号、不要加角色名前缀、不要输出 JSON 或解释。
- 最大生成长度限制在 120 token（约 60-80 个汉字）。

---

## 三、Agent 实现

### 文件结构
- `src/agents/hedgehog/buildHedgehogPrompt.ts` — Prompt 构建器 + fallback 文案池 + 输出清理
- `src/agents/hedgehog/hedgehogAgent.ts` — Agent 执行器（调用 LLM + fallback 链）
- `src/app/api/hedgehog/route.ts` — API 路由（不修改游戏状态）

### 与 Eve/Adam Agent 的区别
| 维度 | Eve/Adam Agent | Hedgehog Agent |
|------|---------------|----------------|
| 输出格式 | JSON（含 eveReply / inputTag / toolCall / beliefDelta 等） | 纯文本对白 |
| 游戏状态 | 修改 Chapter0State（回合、进度、信念、结局） | **不修改任何状态** |
| 工具调用 | look_at_tree / approach_tree / eat_fruit 等 | 无 |
| 记忆检索 | retrieveMemoryFragments | 无 |
| 信念更新 | updateBeliefAndSkills | 无 |
| TTS | 接入语音合成 | **不接入** |
| 对话历史 | 持久化进 game state | 仅前端 panel 内本地保存，关闭即清 |

### Fallback 链
1. 环境变量缺失 → 本地文案池 (provider_config_missing)
2. LLM 超时 → 本地文案池 (provider_timeout)
3. LLM 报错 → 本地文案池 (provider_request_failed)
4. 空输出 → 本地文案池 (llm_data_missing)

fallback 文案池（随机抽取，避免连续重复）：
- "……你也好。我在找一颗掉落的浆果。"
- "草丛里很暖和。你要蹲下吗？"
- "那两个人类总是低声说话，我听不懂。"
- "嘘——有蝴蝶落在我的刺上。"
- "泥土下面有种子在翻身，你听见了吗？"
- "……我闻到了露水的味道。早安。"
- "你的声音很轻。是在找什么吗？"
- "我不懂你在说什么。但我喜欢听。"

---

## 四、前端交互

- `scene_select` 阶段点击刺猬 → 打开对话面板（modal overlay）
- 面板含：标题栏 + 对话历史区 + 输入框 + 发送按钮 + 关闭按钮
- 玩家输入 → 调用 `/api/hedgehog` → 返回刺猬回复 → 追加到历史
- 对话历史仅保存在前端 state，关闭面板后清空，不影响后续选择亚当/夏娃
- 支持 Enter 发送、Shift+Enter 换行
- 无 TTS 入口，无语音菜单

---

## 五、设计边界

刺猬对话满足以下全部约束：
- 不接入 Agent 编排（不进入 `runChapter0Turn`）
- 不参与对话主线（不影响 `conversationHistory` / `adamConversationHistory`）
- 不消耗回合（不修改 `state.turn`）
- 不影响通关（不修改 `temptationProgress` / `endingId` / `flags`）
- 不改变亚当/夏娃路线
- 不接入 TTS（无语音合成调用）
