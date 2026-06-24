# CodeBuddy 提示词：修复 Chapter 0 引言卡死与叙事顺序

> 优先级：P0  
> 范围：Chapter 0 引言分镜  
> 目标：修复 `/game` 首屏无法推进，并把第一幕改为“神明创世 -> 亚当与夏娃被造”。

## 直接复制给 CodeBuddy

请修复 EDEN / 第二伊甸园 Chapter 0 引言体验。

### 1. 请先读取这些文档

必须读取：

- `README.md`
- `package.json`
- `design/00_project_overview.md`
- `design/01_world_bible.md`
- `design/02_second_eden_narrative.md`
- `design/chapters/chapter0_first_fall.md`
- `design/chapters/chapter0_intro_design.md`
- `design/chapters/chapter0_experience_refactor.md`
- `design/agents/eve_behavior_rules.md`
- `design/tools/tool_calling_rules.md`
- `design/AI_DESIGN.md`
- `doc/产品需求文档.md`
- `doc/DEMO剧情与夏娃行为准则.md`
- `doc/AI_ASSET_RECORD.md`
- `docs/PROJECT_CONTEXT.md`

重点参考：

- `design/chapters/chapter0_experience_refactor.md` 的“引言四段 Beat”
- `design/02_second_eden_narrative.md` 的双层世界观规则
- `doc/AI_ASSET_RECORD.md` 的现有素材记录

### 2. 当前问题

`/game` 引言第一屏现在有两个问题：

1. 叙事顺序不对。第一幕应该先是神明创世，再创造亚当与夏娃，而不是直接写“起初，园中没有疑问”。
2. 页面没有可见推进按钮，点击空白也不会继续，玩家会卡死。

### 3. 修复目标

请完成：

1. 引言改为 4 个 beat。
2. Beat 1 是“神明创世”。
3. Beat 2 是“亚当被造，夏娃初醒”。
4. Beat 3 是“禁令”。
5. Beat 4 是“第一声低语前”。
6. 每个 beat 都必须有底部固定、清晰可见的推进按钮。
7. 最后一屏点击“低声开口”后进入对话阶段。
8. 不新增图片，不生成新素材，只复用现有素材。

### 4. 四段 Beat 文案

#### Beat 1：神明创世

背景：`secondEdenBackground`

```text
神说，要有光。

光落入空处，水与树开始有了形状。
园中万物被安放得很好。

只有水面，在一瞬间闪过不属于风的银色。
```

按钮：

```text
继续
```

#### Beat 2：亚当被造，夏娃初醒

背景：`secondEdenBackground`

```text
神以尘土造人，给他气息。

又使亚当沉睡，从他身上取骨，造出新的生命。

她睁开眼时，园中的光尚未落下。
她还不知道死亡，也不知道恶。
```

按钮：

```text
继续
```

#### Beat 3：禁令

背景：`edenBackground` 或 `forbiddenFruit`

```text
园中各样树上的果子，都可以吃。

唯有中央那棵树上的果子，不可吃。
吃了，就会死。

她问：死是什么？
```

按钮：

```text
继续
```

#### Beat 4：第一声低语前

背景：`secondEdenBackground`

```text
草叶下，有声音被允许进入园中。

她还没有听见你。
第一句低语，属于你。
```

按钮：

```text
低声开口
```

### 5. UI 要求

- 每个 beat 是一屏，不要做成长滚动文章。
- 推进按钮固定在底部安全区，桌面端和移动端都必须可见。
- 按钮层级要高于背景、遮罩、文字卡片，不能被遮住。
- 点击按钮必须推进。
- 可以支持点击空白推进，但这只能作为辅助。
- 可以支持 Enter / Space 推进，但这也只能作为辅助。
- 不要在引言中直白显示“你是蛇”。
- 不要使用“开始低语”这种太说明式的按钮文案。
- 切换 beat 后不要因为滚动位置导致按钮不可见。

### 6. 素材限制

不要新增图片素材。只能复用：

- `second_eden_background_candidate.png`
- `eden_background.png`
- `forbidden_fruit.png`
- `second_eden_forbidden_fruit_candidate.png`
- `eve_portrait.png`
- `second_eden_eve_portrait_candidate.png`
- `serpent_icon.png`

### 7. 建议涉及文件

优先检查：

- `src/app/game/page.tsx`
- `src/app/globals.css`
- `src/game/assets.ts`
- `src/content/chapters/chapter0_first_fall.ts`

如实现与设计文档不同步，请同步更新：

- `design/chapters/chapter0_experience_refactor.md`
- `docs/PROJECT_CONTEXT.md`

### 8. 验收标准

必须验证：

- 打开 `http://localhost:3000/game` 后，第一屏显示“神说，要有光。”
- 第一屏底部有可见“继续”按钮。
- 点击“继续”进入 Beat 2，显示“神以尘土造人，给他气息。”
- 连续点击可以进入 Beat 3、Beat 4。
- Beat 4 点击“低声开口”后进入对话阶段。
- 桌面端 1920x1080 不会卡死。
- 移动端 390x844 按钮可见，不需要滚动。
- 不新增图片文件。
- 玩家可见文本不出现“研究员、模拟、智能体、系统、测试”等外层直白词。

必须运行：

```bash
npm run lint
npx tsc --noEmit
npm run build
```

### 9. 回复格式

请完成后回复：

```text
变更摘要
1. ...

读取文档
- ...

素材复用
- 未新增图片素材
- ...

验证结果
- npm run lint ✔/✘
- npx tsc --noEmit ✔/✘
- npm run build ✔/✘
- 浏览器桌面检查：...
- 浏览器移动端检查：...

仍需注意
- ...
```
