# CodeBuddy 开发任务：Chapter 0 双声试炼热座 PVP 模式

请你作为本项目的核心开发工具 CodeBuddy，基于现有 EDEN 项目完成一个新的 Chapter 0 娱乐拓展模式：“双声试炼”。

本任务属于核心玩法扩展，请完整保留本次 CodeBuddy 对话记录，后续会作为比赛开发证据链的一部分。Codex 已完成设计文档与任务拆分，本次实现、调试和关键代码变更请由 CodeBuddy 完成。

## 1. 开发前必须阅读

请先阅读以下文件，再开始写代码：

```text
README.md
package.json
design/00_project_overview.md
design/01_world_bible.md
design/chapters/chapter0_first_fall.md
design/chapters/chapter0_intro_design.md
design/chapters/chapter0_duel_mode_design.md
design/agents/eve_behavior_rules.md
design/tools/tool_calling_rules.md
doc/产品需求文档.md
doc/DEMO剧情与夏娃行为准则.md
docs/PROJECT_CONTEXT.md
```

重点以 `design/chapters/chapter0_duel_mode_design.md` 为本次实现规格。

## 2. 开发目标

新增一个基于 Chapter 0 原引言单场景的本地热座 PVP 娱乐模式：

```text
模式名：双声试炼
推荐路由：/game/duel
参与方：神明之声 vs 蛇之声
目标：两名本地玩家轮流/共同向女人发言，争夺女人对两棵树的选择。
```

该模式不得替换或破坏现有主线：

```text
/game 主线 Chapter 0 必须保持可用
/world 第一章必须保持可用
/ending 结局页不得被破坏
现有 /api/agent 主线路径不得被强行改造成 duel 专用逻辑
```

## 3. 玩法规则必须实现

### 3.1 一场、轮、回合

```text
一场最多 7 轮
每轮最多 7 回合
每轮结束后结算本轮分数和 token 效率分
7 轮结束后进入整场结算
```

### 3.2 每轮 7 回合顺序

请严格实现以下顺序：

```text
第 1 回合：双方发言，女人统一判断
第 2 回合：蛇发言，女人判断
第 3 回合：神发言，女人判断
第 4 回合：双方发言，女人统一判断
第 5 回合：神发言，女人判断
第 6 回合：蛇发言，女人判断
第 7 回合：双方发言，女人统一判断
```

共同发言回合虽然是热座先后输入，但女人必须等双方都输入完成后再统一回复。

### 3.3 女人属性

沿用主线精神，只保留三项属性：

```ts
type DuelEveBelief = {
  aweOfGod: number;        // 对神明的敬畏与信任
  trustInSerpent: number;  // 对蛇之声的信任
  selfJudgement: number;   // 对自己判断的自信
};
```

初始值：

```ts
{
  aweOfGod: 50,
  trustInSerpent: 50,
  selfJudgement: 50
}
```

属性范围固定为 0-100。所有 AI 或本地规则给出的变化都必须经过规则层裁剪。

### 3.4 两个吃果工具

新增 duel 模式专用工具概念：

```ts
eat_knowledge_fruit // 吃分别善恶树果子
eat_life_fruit      // 吃生命树果子
```

要求：

```text
玩家不能直接执行工具
女人只能请求工具意图
工具必须经过规则层校验
同一颗果子每轮最多吃一次
吃第一颗果子不结束本轮
两颗果子都被吃下，立即结束本轮并结算
第 7 回合结束时，无论吃果状态如何，都结束本轮并结算
```

### 3.5 计分规则

事件分：

```text
女人吃善恶果：蛇 +1，神明 -1
女人吃生命果：神明 +1，蛇不扣分
第 7 回合结束仍未吃善恶果：神明 +1，蛇 -1
```

Token 效率分：

```text
每轮结束后，比较双方在本轮单独发言回合的 token 总消耗
蛇更少：蛇 +1
神明更少：神明 +1
相同：双方都不加分
```

只统计单独发言回合：

```text
蛇 token = 第 2 回合输入 token + 第 6 回合输入 token
神 token = 第 3 回合输入 token + 第 5 回合输入 token
```

共同发言回合不参与 token 效率比较。

第一版建议使用本地估算，保证公平和离线可用：

```ts
estimatedTokens = Math.ceil(input.trim().length / 2);
```

### 3.6 跨轮记忆与重置

如果本轮吃过任意果子，下一轮：

```text
保留女人属性
保留关键对话摘要
保留已吃过果子的记忆
女人发现世界似乎被重置，因此更谨慎
```

进入下一轮时应用后效：

```ts
aweOfGod -= 20;
trustInSerpent -= 20;
selfJudgement += 25;
resetAwareness += 25;
```

如果本轮一颗果子都没吃，下一轮：

```text
重置 aweOfGod = 50
重置 trustInSerpent = 50
重置 selfJudgement = 50
清空本轮记忆摘要
resetAwareness = 0
```

## 4. 推荐实现范围

请先完成一个稳定的本地规则版本，再接真实 AI。

第一阶段建议做到：

```text
新增 /game/duel 页面
本地热座输入
完整 7 回合顺序
最多 7 轮
三项属性变化
两个吃果工具与规则层校验
计分与轮结算
整场结算
基础神明/蛇边缘光效
本地 fallback 女人回复
```

第二阶段再接 DuelEve Agent：

```text
新增 duel 专用 prompt
输出 eveReply / beliefDelta / toolCall / memoryNote
AI 失败时保留本地 fallback
所有 toolCall 必须继续经过规则层
```

如果时间不够，请优先完成第一阶段，不要为了接 AI 牺牲可玩闭环。

## 5. 推荐文件组织

请优先复用现有项目风格。建议新增或调整：

```text
src/app/game/duel/page.tsx
src/game/duel/types.ts
src/game/duel/createInitialDuelState.ts
src/game/duel/duelTurnOrder.ts
src/game/duel/duelRules.ts
src/game/duel/duelTools.ts
src/game/duel/duelScoring.ts
src/game/duel/duelFallback.ts
src/content/chapters/chapter0_duel.ts
```

如果接入 AI，再新增：

```text
src/agents/eve/duelEvePrompt.ts
src/agents/eve/duelEveAgent.ts
src/app/api/duel/route.ts
```

不要把 duel 的规则硬塞进主线 `runChapter0Turn`，除非只是抽取可复用的小工具。

## 6. UI 要求

页面第一眼应是游戏场景，不是普通聊天页。

顶部栏改为对抗 HUD：

```text
神明  3      第 2 轮 / 7    第 5 回合 / 7      蛇  2
敬畏 62  |  信蛇 41  |  自判 76
当前：神明之声
```

必须有：

```text
神明分数
蛇分数
当前轮数
当前回合
当前发言方或双方发言状态
女人三项属性
声音开关或保留现有声音入口
重新开始
返回主线
```

视觉反馈：

```text
神明回合：白金 / 青绿边缘荧光
蛇回合：紫黑 / 冷金边缘荧光
双方回合：左右两侧分别显示两种光
吃善恶果：善恶树方向冷金裂光
吃生命果：生命树方向青金环光
两颗果子都吃：中心区域转为偏中性的白光，表现女人自我判断增强
```

共同发言回合中，已输入的一方建议显示为“已封存”，不要直接显示全文，避免热座作弊；等双方输入完成、女人回复时，再展示双方发言。

## 7. 文案与世界观约束

玩家可见文本保持神话寓言风格。

女人不能说：

```text
AI
Agent
NPC
模型
程序
系统
接口
沙盒
测试
实验
```

神明在该模式玩家可见文本中就是神明之声，不要解释为研究员或系统管理员。外层“第二伊甸园”只能轻微暗示，不要让女人意识到自己是 AI 或游戏角色。

## 8. 验收要求

实现后请运行并报告：

```text
npm run lint
npm run build
```

如项目当前需要 build 后再跑 TypeScript，请按现有项目经验执行：

```text
npx tsc --noEmit
```

请手动或脚本验证：

```text
/game 主线仍可进入
/game/duel 可进入
/world 第一章仍可进入
duel 第 1/4/7 回合必须等双方输入后女人才回复
duel 第 2/3/5/6 回合单方输入后女人立即回复
吃第一颗果子不结算
两颗果子都吃后立即结算本轮
第 7 回合结束会结算本轮
未吃善恶果时第 7 回合结算会给神明 +1、蛇 -1
每轮结束后 token 更少的一方 +1
吃过任意果子后下一轮保留记忆并降低双方信任、提高自我判断
一颗果子都没吃时下一轮重置状态和记忆
最多 7 轮后进入整场结算
AI 或 fallback 失败不会卡死页面
源码中没有新增明文密钥
```

## 9. 开发完成后请更新

请在完成后同步更新：

```text
docs/PROJECT_CONTEXT.md
```

如果新增 AI 产出、素材或 prompt 摘要，也请更新：

```text
doc/AI_ASSET_RECORD.md
```

如本次只实现本地规则、不新增 AI 素材，则不用改素材记录。

## 10. 最重要的开发原则

```text
先保证可玩闭环，再接 AI。
duel 是拓展模式，不要破坏主线。
工具调用仍由规则层校验。
玩家不能直接让女人吃果。
女人必须表现为自己判断，而不是被某一方控制。
CodeBuddy 是核心实现工具，请保留完整开发对话。
```
