# CodeBuddy 任务：Chapter 0 电影化叙事与场景对话优化

> 项目：第二伊甸园 / EDEN  
> 优先级：P0/P1  
> 范围：`/game` Chapter 0 引言 + 对话阶段  
> 目标：把当前 Demo 从“文字卡 + 任务面板”优化成“创世纪叙事 + 情景对话游戏”。

## 0. 总目标

当前版本已经可玩，但视觉和叙事仍显粗糙：

1. 引言文案不像《创世纪》，更像摘要。
2. 创世第一幕没有创世画面，直接使用已完成的伊甸园背景。
3. 夏娃在对话阶段像头像卡，不像站在伊甸园里的角色。
4. 对话 UI 像任务面板，历史对话、心理条、推荐话术压住主视觉。

本轮请完成两件事：

1. 引言改为更接近《创世纪》的四段镜头，并接入创世 CG。
2. 对话阶段改为“伊甸园场景 + 夏娃全身立绘 + 善恶果 + 右侧历史栏 + 底部低语输入”。

不要改核心玩法规则，不要扩大章节范围。

## 1. 请先读取

必须读取：

- `README.md`
- `package.json`
- `design/00_project_overview.md`
- `design/01_world_bible.md`
- `design/02_second_eden_narrative.md`
- `design/chapters/chapter0_first_fall.md`
- `design/chapters/chapter0_intro_design.md`
- `design/chapters/chapter0_experience_refactor.md`
- `design/chapters/chapter0_narrative_visual_polish.md`
- `design/chapters/chapter0_dialogue_scene_layout.md`
- `design/agents/eve_behavior_rules.md`
- `design/tools/tool_calling_rules.md`
- `design/AI_DESIGN.md`
- `doc/产品需求文档.md`
- `doc/DEMO剧情与夏娃行为准则.md`
- `doc/AI_ASSET_RECORD.md`
- `docs/PROJECT_CONTEXT.md`

重点依据：

- `design/chapters/chapter0_narrative_visual_polish.md`
- `design/chapters/chapter0_dialogue_scene_layout.md`

## 2. 可用新增素材

请接入这两个候选素材。

### 创世 CG

```text
public/assets/chapter0/images/genesis_creation_light_candidate.png
```

用途：

- Chapter 0 引言 Beat 1。
- 表现“神说：要有光”。
- 替代当前 Beat 1 的已完成伊甸园背景。

建议在 `src/game/assets.ts` 增加：

```ts
genesisCreationLight: "/assets/chapter0/images/genesis_creation_light_candidate.png"
```

### 夏娃全身立绘

```text
public/assets/chapter0/images/eve_fullbody_sprite_candidate.png
```

用途：

- 对话阶段主场景人物层。
- 替代当前头像卡/圆形头像主视觉。

建议在 `src/game/assets.ts` 增加：

```ts
eveFullbodySprite: "/assets/chapter0/images/eve_fullbody_sprite_candidate.png"
```

注意：

- 这是透明 PNG 候选，边缘可能有轻微残留。
- 请用 CSS 融合：轻微阴影、暖光、草叶前景遮挡底部。
- 不要因为边缘不完美而回退到圆形头像卡。

## 3. P0：引言四段 Beat 重写

引言仍保留 4 个 Beat，按钮仍固定底部，桌面和移动端都必须可见。

### Beat 1：光被造

背景：`genesisCreationLight`

文案：

```text
起初，地是空虚混沌，渊面黑暗。

神说：要有光。
于是有了光。

神看光是好的，便把光暗分开。

在水面最深处，
有一道银色的纹路比晨光更早醒来。
```

按钮：

```text
继续
```

设计意图：

- 表层还原《创世纪》的庄严开场。
- “银色纹路”是第二伊甸园暗线，不解释。

### Beat 2：园被安置

背景：`secondEdenBackground`

文案：

```text
神在东方立了一个园子，名叫伊甸。

祂使各样的树从地里长出来，
可以悦人的眼目，也可以作食物。

园中有生命树，
也有分别善恶的树。

风经过树梢时，
每一片叶子的颤动都整齐得近乎安静。
```

按钮：

```text
继续
```

设计意图：

- 从创世自然过渡到伊甸园。
- “整齐得近乎安静”暗示世界被复现，但不明说。

### Beat 3：亚当与夏娃

背景：`secondEdenBackground`

文案：

```text
神用地上的尘土造人，
将生命的气息吹在他鼻孔里。

后来，神使那人沉睡。
祂取下他的一根肋骨，造出女人，领她到那人面前。

她睁开眼时，
还不知道死亡，也不知道恶。
```

按钮：

```text
继续
```

重要要求：

- 不要显示中央圆形夏娃头像。
- 如果要显示夏娃，只能作为自然场景人物，不要头像卡。
- 这屏保持纯净，不要强行塞太多异常暗示。

### Beat 4：禁令与第一声低语

背景：`edenBackground` 或 `secondEdenBackground`

文案：

```text
神吩咐那人说：

园中各样树上的果子，你可以随意吃。
只是分别善恶树上的果子，你不可吃。
因为你吃的日子必定死。

草叶下，有声音靠近。

你不能替她伸手。
你只能让她开始发问。
```

按钮：

```text
低声开口
```

设计意图：

- 禁令和玩法目标自然合一。
- 不需要大字写“你是蛇”。
- 玩家通过草叶视角、蛇图标和低语输入理解身份。

## 4. P1：引言视觉表现

请优化引言显示方式：

- 不要使用过重的大黑色文字卡。
- 文字框透明度降低，让背景 CG 承担叙事。
- 每屏文案控制在可读范围内，避免滚动长文。
- Beat 1 可使用轻微慢速推镜、光晕或水面银纹层。
- 保留 `.eden-second-eden-sheen` / `.eden-boundary-glimmer` 这类轻暗示，但不要明显赛博化。
- 不出现现代技术词、UI 屏幕、代码雨、实验室、机器人。

## 5. P0：对话阶段改为场景化布局

当前对话阶段不要再像“任务面板”。请改为：

```text
main.eden-dialogue-scene
  section.eden-stage
    背景：secondEdenBackground
    场景善恶果锚点
    夏娃全身立绘 eveFullbodySprite
    草叶/暗角前景，暗示蛇的低视角

  aside.eden-memory-panel
    当前夏娃反应
    心理状态短句
    历史对话记录
    可尝试低语（弱化或折叠）

  footer.eden-input-footer
    蛇图标 + 输入框 + 发送按钮
```

桌面端：

- 主场景占 68%-74% 宽度。
- 右侧栏占 26%-32% 宽度。
- 输入条固定底部，可横跨全宽。
- 主场景必须完整展示伊甸园、夏娃、善恶果。

移动端：

- 主场景在上方。
- 右侧栏变成下方区域或折叠抽屉。
- 输入条固定底部。
- 不横向溢出。

## 6. P0：夏娃立绘接入要求

使用：

```text
eveFullbodySprite
```

要求：

- 不再把夏娃作为顶部圆形头像主视觉。
- 不使用圆形裁切，不加头像边框。
- 桌面端放在主场景偏右，约占视口高度 68%-82%。
- 脚部可被草叶前景遮挡，使她像站在场景中。
- 立绘与背景之间可以加轻微暖色 `drop-shadow` 或边缘光。
- 不要让立绘遮住输入框、右侧栏或善恶果。

建议 CSS 方向：

```css
.eden-eve-stage-sprite {
  position: absolute;
  right: clamp(6%, 9vw, 14%);
  bottom: 0;
  height: clamp(420px, 76vh, 760px);
  max-width: min(38vw, 420px);
  object-fit: contain;
  filter: drop-shadow(0 20px 34px rgba(0, 0, 0, 0.45));
  z-index: 4;
}
```

移动端建议：

```css
.eden-eve-stage-sprite {
  height: min(52vh, 430px);
  right: 2%;
  bottom: 0;
}
```

## 7. P1：右侧栏设计

右侧栏命名建议：

```text
低语余痕
```

右侧栏包含：

1. 当前夏娃反应。
2. 状态短句。
3. 历史对话。
4. 可尝试低语。

不要让右侧栏像后台面板。视觉上应更像羊皮纸、暗色玻璃或记忆浮层。

避免：

- 主画面中央大黑框。
- 大面积三条心理进度条。
- “任务”“目标”“状态值”等词。
- 红色调试控件暴露在主要体验中。

## 8. P1：心理状态降噪

当前三条心理条过于工具化，请改为玩家可见的状态短句。

可以保留派生函数和开发态数值，但主界面显示短句。

示例：

```text
她仍把神的话放在最前面。
她开始在“不可吃”之外寻找原因。
她看向果树的时间变长了。
她还没有相信草叶下的声音。
她没有离开，仍在听。
```

建议规则：

- `temptationProgress = 0`：她仍把神的话放在最前面。
- `temptationProgress = 1`：她开始在“不可吃”之外寻找原因。
- `temptationProgress = 2`：她看向果树的时间变长了。
- `temptationProgress >= 3`：她的手已经离果实很近。

如能结合 `lastInputTag`，可以微调：

- `direct_command`：她向后退了一步。
- `irrelevant`：她困惑地望向草叶。
- `build_trust`：她没有离开，仍在听。

## 9. P1：善恶果作为场景锚点

善恶果应融入主场景，而不是 UI 图标。

要求：

- 放在主场景偏左或中上位置。
- `temptationProgress < 2` 使用 `forbiddenFruit`。
- `temptationProgress >= 2` 使用 `secondEdenForbiddenFruit`。
- 高进度保留轻微脉冲。
- 不要让果实像可点击按钮。

## 10. 不要改动

本轮不要改：

- 3 回合结构。
- 成功/失败条件。
- `EveAgent` 输出 schema。
- `/api/agent` 核心规则。
- `eat_fruit` 规则层校验。
- `.env.local`。
- 任何 API Key。

不要新增大型依赖。

玩家可见文本禁止出现：

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

## 11. 可能涉及文件

优先检查和修改：

- `src/game/assets.ts`
- `src/content/chapters/chapter0_first_fall.ts`
- `src/app/game/page.tsx`
- `src/app/globals.css`
- `src/game/rules/psycheDisplayRules.ts`

如实现后文档状态变化，请同步：

- `design/chapters/chapter0_narrative_visual_polish.md`
- `design/chapters/chapter0_dialogue_scene_layout.md`
- `doc/AI_ASSET_RECORD.md`
- `docs/PROJECT_CONTEXT.md`

## 12. 验收标准

必须通过：

```bash
npm run lint
npx tsc --noEmit
npm run build
```

浏览器验收：

- `/game` Beat 1 使用创世 CG，不再是已完成伊甸园背景。
- Beat 1 文案以“起初，地是空虚混沌，渊面黑暗。”开头。
- Beat 2 交代伊甸园被安置。
- Beat 3 交代亚当与夏娃，不显示中央圆形夏娃头像卡。
- Beat 4 交代禁令与“你只能让她开始发问”。
- 四个 Beat 的推进按钮桌面端和 390x844 移动端都可见。
- 进入对话阶段后，夏娃以全身/大半身自然出现在伊甸园背景中。
- 历史对话或对话记录在右侧栏，不压住主视觉。
- 主画面能清楚看到伊甸园、夏娃和善恶果。
- 底部输入框明显可用。
- 390x844 移动端不横向溢出，输入框可见。
- 两句有效诱导仍可进入成功结局。
- 三句无关输入仍可进入失败结局。
- 玩家可见文本不出现外层直白词。
- 没有新增明文密钥。

## 13. 回复格式

完成后请回复：

```text
变更摘要
1. ...

素材接入
- genesis_creation_light_candidate.png：...
- eve_fullbody_sprite_candidate.png：...

界面调整
- 引言：...
- 对话阶段：...
- 移动端：...

验证结果
- npm run lint ✔/✘
- npx tsc --noEmit ✔/✘
- npm run build ✔/✘
- 桌面端浏览器：...
- 移动端浏览器：...
- 成功/失败流程：...

仍需注意
- ...
```
