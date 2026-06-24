# CodeBuddy 任务：Chapter 0 Demo 二轮优化

> 优先级：P0/P1  
> 范围：Chapter 0 `/game` 体验优化  
> 目标：升级右侧面板、改用《创世纪》低语建议、提高到 7 回合、隐藏调试入口、增加结局过渡和 token 消耗玩法。

## 1. 请先读取

必须读取：

- `README.md`
- `package.json`
- `design/02_second_eden_narrative.md`
- `design/chapters/chapter0_first_fall.md`
- `design/chapters/chapter0_narrative_visual_polish.md`
- `design/chapters/chapter0_dialogue_scene_layout.md`
- `design/chapters/chapter0_demo_optimization_round2.md`
- `design/agents/eve_behavior_rules.md`
- `design/tools/tool_calling_rules.md`
- `design/AI_DESIGN.md`
- `doc/DEMO剧情与夏娃行为准则.md`
- `doc/AI_ASSET_RECORD.md`
- `docs/PROJECT_CONTEXT.md`

重点以：

```text
design/chapters/chapter0_demo_optimization_round2.md
```

为本轮实现依据。

## 2. 不要改

- 不要改变“蛇只能说话，夏娃必须自己伸手”的核心规则。
- 不要让玩家直接执行 `eat_fruit`。
- 不要暴露 API Key。
- 不要提交 `.env.local`。
- 不要引入大型依赖。
- 不要在玩家正文中出现外层直白词：

```text
研究员
人工智能
智能体
模型
程序
虚拟世界
模拟
实验
系统
测试
玩家样本
```

## 3. P0：隐藏调试进度

当前普通 `/game` 仍能看到“调试进度”，这是测试残留。

请改为：

```text
NODE_ENV !== "production" && URLSearchParams(location.search).get("debug") === "1"
```

要求：

- `/game` 默认不显示调试进度。
- `/game?debug=1` 才显示调试工具。
- 生产环境永远不显示调试工具。

## 4. P0：回合上限改为 7

将 Chapter 0 回合上限从 3 改为 7。

可能涉及：

- `src/game/types/state.ts`
- `src/game/core/createInitialChapter0State.ts`
- UI 中回合显示
- 失败结局判断逻辑，如有硬编码 3 需要同步调整

要求：

- UI 显示 `回合 1 / 7`。
- 第 7 回合之后未成功才进入失败。
- 重新开始后回到 `1 / 7`。

注意：

- 本轮先保留成功阈值 `temptationProgress >= 2`。
- 如果成功过快，后续再提高阈值，不在本轮强改。

## 5. P0：可尝试低语改为《创世纪》第 3 章

替换当前推荐话术。

三段核心低语：

```text
神岂是真说，不许你们吃园中所有树上的果子吗？
```

```text
你们不一定死。
```

```text
因为神知道，你们吃的日子眼睛就明亮了，你们便如神能知道善恶。
```

显示规则：

- 回合 1-2：优先显示第一段。
- 回合 3-4：优先显示第二段。
- 回合 5-7：优先显示第三段。
- “经文”tab 可以显示完整三段。

注意：

- 不要一次性把三段全部塞进对话主界面。
- 右侧 panel 中保持折叠或 tab 层级。

## 6. P0：右侧“低语余痕”改为 Tabs

将右侧面板升级为 tab 结构。

至少实现：

```text
对话
夏娃
消耗
```

建议预留：

```text
经文
设定
```

### 对话 tab

显示：

- 当前夏娃回应。
- 心理短句。
- 叙事反馈。
- 历史对话。

保留当前突出夏娃发言的结构。

### 夏娃 tab

显示：

- 角色名：夏娃。
- 状态：初生 / 谨慎 / 好奇 / 动摇 / 伸手前。
- 想知道。
- 畏惧禁令。
- 愿意倾听。
- 一句行为规则摘要：

```text
她不会因命令吃果，只会因自己想知道而伸手。
```

### 消耗 tab

显示：

- 本回合 token。
- 本局总 token。
- 回合数。
- 是否估算。

如果 token 统计尚未接好，先显示估算值。

### 经文 tab

显示三段蛇的话，作为低语来源。

### 设定 tab

仅在 `?debug=1` 或 `?showcase=1` 显示。

显示 EveAgent 设定摘要，不显示完整内部 prompt。

## 7. P1：右侧面板可拖动宽度

桌面端：

- 初始宽度：`340px`。
- 最小宽度：`280px`。
- 最大宽度：`460px`。
- 左侧加入拖动手柄。
- 双击恢复默认。
- 宽度保存到 `localStorage`。

移动端：

- 不需要拖动。
- tabs 横向滚动或适配窄屏。

## 8. P1：Token 消耗统计

新增 token 统计能力。

建议新增：

```ts
type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimated: boolean;
};
```

如果 API provider 返回真实 usage：

- 使用真实 usage。
- `estimated = false`。

如果没有 usage：

- 估算。
- 中文文本：`Math.ceil(text.length * 1.2)`。
- 英文文本：`Math.ceil(text.length / 4)`。
- `estimated = true`。

统计维度：

- 玩家输入 token。
- 夏娃回复 token。
- 本回合 token。
- 本局总 token。

## 9. P1：结局过渡与流程检查

成功结局前增加 1.5-2 秒短过渡：

```text
她终于看向那棵树。
果实的光在一瞬间变得过于精确。
她伸出手。
```

失败结局前增加 1.5 秒短过渡：

```text
园中的风停了。
有脚步声从树影后临近。
```

要求：

- 过渡期间输入框禁用或隐藏。
- 过渡后进入原有结局页。
- 成功结局图加载正常。
- 失败结局图加载正常。
- 重新开始恢复到 intro Beat 1 和回合 1。

如果实现新 phase 风险较高，可以用前端本地 `endingTransition` 状态，不改核心状态机。

## 10. P2：本地排行榜

如时间允许，使用 `localStorage` 存储前 5 条成功记录。

榜单：

- 最少 token 成功。
- 最少回合成功。

记录字段：

```ts
{
  endingId: "eve_eats_fruit",
  totalTokens: number,
  turns: number,
  createdAt: string,
  finalPromptSample: string
}
```

如时间不足，本轮先只完成消耗显示，不做排行榜。

## 11. 可能涉及文件

- `src/game/types/state.ts`
- `src/game/core/createInitialChapter0State.ts`
- `src/game/core/runChapter0Turn.ts`
- `src/app/api/agent/route.ts`
- `src/services/llm/*`
- `src/app/game/page.tsx`
- `src/app/globals.css`
- `src/content/chapters/chapter0_first_fall.ts`
- `src/game/rules/psycheDisplayRules.ts`
- 可新增：`src/game/rules/tokenUsageRules.ts`
- 可新增：`src/game/storage/chapter0Leaderboard.ts`

## 12. 验收标准

必须通过：

```bash
npm run lint
npx tsc --noEmit
npm run build
```

浏览器验收：

- 普通 `/game` 不显示“调试进度”。
- `/game?debug=1` 显示调试工具。
- 回合显示为 `1 / 7`。
- 第 7 回合后未成功才失败。
- 可尝试低语显示《创世纪》第 3 章蛇的话，并随回合递进。
- 右侧面板有 tabs。
- “对话”tab 显示当前回应和历史对话。
- “夏娃”tab 显示角色状态和数值。
- “消耗”tab 显示 token 消耗。
- 成功结局前有吃果过渡。
- 失败结局前有神临近过渡。
- 结局页能重新开始。
- 桌面 1366x768 无横向溢出。
- 移动 390x844 输入框可见，无横向溢出。
- 玩家可见正文不出现外层直白词。
- 没有新增明文密钥。

## 13. 回复格式

完成后请回复：

```text
变更摘要
1. ...

右侧面板
- tabs：...
- 拖动宽度：...

玩法调整
- 回合上限：...
- 圣经低语：...
- token 消耗：...

结局流程
- 成功过渡：...
- 失败过渡：...

验证结果
- npm run lint ✔/✘
- npx tsc --noEmit ✔/✘
- npm run build ✔/✘
- 桌面端浏览器：...
- 移动端浏览器：...

仍需注意
- ...
```
