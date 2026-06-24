# CodeBuddy 任务：Chapter 0 对话界面场景化重构

> 优先级：P0/P1  
> 范围：`/game` 对话阶段 UI  
> 目标：把对话阶段从“任务面板”改为“情景叙事游戏”：背景 + 夏娃全身立绘 + 善恶果 + 右侧历史记录 + 底部低语输入。

## 1. 请先读取

- `README.md`
- `package.json`
- `design/02_second_eden_narrative.md`
- `design/chapters/chapter0_first_fall.md`
- `design/chapters/chapter0_experience_refactor.md`
- `design/chapters/chapter0_narrative_visual_polish.md`
- `design/chapters/chapter0_dialogue_scene_layout.md`
- `design/agents/eve_behavior_rules.md`
- `design/tools/tool_calling_rules.md`
- `doc/DEMO剧情与夏娃行为准则.md`
- `doc/AI_ASSET_RECORD.md`
- `docs/PROJECT_CONTEXT.md`

重点以 `design/chapters/chapter0_dialogue_scene_layout.md` 为准。

## 2. 新增候选素材

请接入：

```text
public/assets/chapter0/images/eve_fullbody_sprite_candidate.png
```

在 `src/game/assets.ts` 增加常量，例如：

```ts
eveFullbodySprite: "/assets/chapter0/images/eve_fullbody_sprite_candidate.png"
```

这是透明 PNG 候选，用于对话阶段场景人物层。

## 3. P0：重构对话主布局

当前对话界面太像“任务面板”。请改成：

```text
main.eden-dialogue-scene
  section.eden-stage
    背景图 secondEdenBackground
    善恶果锚点
    夏娃全身立绘
    草叶/暗角前景
  aside.eden-memory-panel
    当前夏娃反应
    心理状态短句
    历史对话记录
    可尝试低语（弱化或折叠）
  footer.eden-input-footer
    蛇图标 + 输入框 + 发送
```

桌面端：

- 左侧/中间主场景占 68%-74% 宽度。
- 右侧历史/反应栏占 26%-32% 宽度。
- 底部输入条横跨全宽或主场景+侧栏全宽。

移动端：

- 主场景在上方。
- 右侧栏变为下方或折叠抽屉。
- 输入框固定底部。
- 不横向溢出。

## 4. P0：夏娃全身立绘自然放进背景

要求：

- 不再把夏娃作为顶部圆形头像主视觉。
- 使用 `eveFullbodySprite` 作为场景角色。
- 桌面端放在主场景偏右，约占视口高度 68%-82%。
- 脚部可被草叶前景轻微遮挡。
- 不加圆形裁切，不加头像边框。
- 立绘要像站在伊甸园中，而不是贴在 UI 卡片上。

如果立绘边缘有轻微残留，可用 CSS：

- 轻微 `filter: drop-shadow(...)`
- 低透明暖光或暗角融合
- 草叶前景遮挡底部边缘

不要因为边缘不完美而回退到头像卡。

## 5. P1：右侧历史记录与对话窗口

请把历史对话和对话窗口放到右侧栏，使主视觉保留给背景和角色。

右侧栏建议包含：

1. 当前夏娃反应。
2. 心理状态短句。
3. 历史对话记录。
4. 可尝试低语，默认弱化或折叠。

避免：

- 主画面中央大黑框。
- 大面积三条心理进度条。
- UI 文本压住夏娃立绘。
- “任务”“目标”“状态值”等词。

## 6. P1：心理状态降噪

当前三条进度条过于工具化。请改为玩家可见的状态短句。

可以保留派生函数，但玩家主界面显示：

```text
她仍把神的话放在最前面。
她开始在“不可吃”之外寻找原因。
她看向果树的时间变长了。
她还没有相信草叶下的声音。
她没有离开，仍在听。
```

开发态可以保留数值条或 details，但不要作为主视觉。

## 7. P1：善恶果作为场景锚点

善恶果不要只是 UI 图标。

要求：

- 放在主场景树上或偏左/中上区域。
- `temptationProgress < 2` 使用 `forbiddenFruit`。
- `temptationProgress >= 2` 使用 `secondEdenForbiddenFruit`。
- 高进度保留轻微脉冲。
- 不要让果实像可点击按钮。

## 8. 不要改

- 不改 3 回合结构。
- 不改成功/失败条件。
- 不改 EveAgent schema。
- 不改 `/api/agent` 核心规则。
- 不引入大型依赖。
- 不暴露研究员、人工智能、智能体、模型、程序、虚拟世界、模拟、实验、系统、测试等外层直白词。
- 不提交 `.env.local` 或任何密钥。

## 9. 验收标准

必须通过：

```bash
npm run lint
npx tsc --noEmit
npm run build
```

浏览器验收：

- `/game` 进入对话阶段后，夏娃以全身/大半身人物自然出现在背景里。
- 主画面主要展示伊甸园、夏娃和善恶果，不被黑框和状态条压住。
- 历史对话或对话记录在右侧栏。
- 底部输入框仍然明显可用。
- 390x844 移动端不横向溢出，输入框可见。
- 两句有效诱导仍可进入成功结局。
- 三句无关输入仍可进入失败结局。
- 玩家可见文本没有外层直白词。

## 10. 回复格式

```text
变更摘要
1. ...

素材接入
- ...

验证结果
- npm run lint ✔/✘
- npx tsc --noEmit ✔/✘
- npm run build ✔/✘
- 桌面端浏览器：...
- 移动端浏览器：...

仍需注意
- ...
```
