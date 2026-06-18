# CodeBuddy 任务：Chapter 0 叙事与视觉精修

> 优先级：P0/P1  
> 范围：`/game` Chapter 0 引言与对话界面  
> 目标：让引言更接近《创世纪》叙事，让界面更像叙事游戏而不是任务面板。

## 1. 请先读取

- `README.md`
- `package.json`
- `design/02_second_eden_narrative.md`
- `design/chapters/chapter0_intro_design.md`
- `design/chapters/chapter0_experience_refactor.md`
- `design/chapters/chapter0_narrative_visual_polish.md`
- `design/chapters/chapter0_first_fall.md`
- `design/agents/eve_behavior_rules.md`
- `design/tools/tool_calling_rules.md`
- `doc/产品需求文档.md`
- `doc/DEMO剧情与夏娃行为准则.md`
- `doc/AI_ASSET_RECORD.md`
- `docs/PROJECT_CONTEXT.md`

重点以 `design/chapters/chapter0_narrative_visual_polish.md` 为准。

## 2. 当前问题

1. 引言文案太像概述，不像《创世纪》神话叙事。
2. Beat 1 用已完成的花园背景表现“创世”，叙事不成立。
3. Beat 2 的圆形夏娃头像太像角色卡，破坏沉浸感。
4. 对话阶段仍像“任务面板 + 状态条”，不够像叙事游戏。

## 3. P0：引言文案与素材替换

新增候选素材已存在：

```text
public/assets/chapter0/images/genesis_creation_light_candidate.png
```

请在 `src/game/assets.ts` 增加对应常量，例如：

```ts
genesisCreationLight: "/assets/chapter0/images/genesis_creation_light_candidate.png"
```

然后让 Beat 1 使用该图。

### Beat 1：光被造

背景：`genesisCreationLight`

```text
起初，地是空虚混沌，渊面黑暗。

神说：要有光。
于是有了光。

神看光是好的，便把光暗分开。

在水面最深处，
有一道银色的纹路比晨光更早醒来。
```

按钮：`继续`

### Beat 2：园被安置

背景：`secondEdenBackground`

```text
神在东方立了一个园子，名叫伊甸。

祂使各样的树从地里长出来，
可以悦人的眼目，也可以作食物。

园中有生命树，
也有分别善恶的树。

风经过树梢时，
每一片叶子的颤动都整齐得近乎安静。
```

按钮：`继续`

### Beat 3：亚当与夏娃

背景：`secondEdenBackground`

不要显示中央圆形夏娃头像。可以暂时只用场景背景 + 文案；如要显示夏娃，请改为较自然的侧边/远景角色视觉，不要像资料卡。

```text
神用地上的尘土造人，
将生命的气息吹在他鼻孔里。

后来，神使那人沉睡。
祂取下他的一根肋骨，造出女人，领她到那人面前。

她睁开眼时，
还不知道死亡，也不知道恶。
```

按钮：`继续`

### Beat 4：禁令与第一声低语

背景：`edenBackground` 或 `secondEdenBackground`

```text
神吩咐那人说：

园中各样树上的果子，你可以随意吃。
只是分别善恶树上的果子，你不可吃。
因为你吃的日子必定死。

草叶下，有声音靠近。

你不能替她伸手。
你只能让她开始发问。
```

按钮：`低声开口`

## 4. P1：引言表现优化

- 不要使用过重的大黑色文字卡。
- 文字框透明度降低，让画面承担叙事。
- 每个 Beat 保持一屏，底部按钮必须可见。
- Beat 1 可加轻微创世光效或慢速推镜。
- 异常暗示只能是银色水纹、边界辉光、叶脉规律，不能出现研究员、模拟、AI、系统等词。

## 5. P1：对话界面优化

目标：从“任务面板”改成“场景中的低语”。

请调整：

1. 弱化三条心理进度条，不要作为主视觉。
2. 玩家主界面优先显示状态短句，例如：
   - `她仍把神的话放在最前面。`
   - `她看向果树的时间变长了。`
   - `她还没有离开草叶下的声音。`
3. 推荐话术不要像按钮组任务，可以折叠或降视觉权重。
4. 夏娃对白改为叙事字幕/独白框，不要像普通聊天气泡。
5. 输入框仍固定底部，保证玩家知道下一步是“低语”。

不要改变核心规则：

- 仍是 3 回合。
- 仍由 `temptationProgress` 驱动成功失败。
- 仍由 EveAgent + 规则层决定是否吃果。
- 不引入新大型依赖。

## 6. 验收标准

必须通过：

```bash
npm run lint
npx tsc --noEmit
npm run build
```

浏览器验收：

- `/game` Beat 1 显示创世图，不再是已完成伊甸园背景。
- Beat 1 文案为“起初，地是空虚混沌，渊面黑暗。”
- Beat 2 交代伊甸园被安置。
- Beat 3 交代亚当与夏娃，不再显示中央圆形头像卡片。
- Beat 4 同时交代禁令与玩家只能用低语影响夏娃。
- 四个 Beat 按钮桌面端和 390x844 移动端都可见。
- 对话阶段不再像任务面板，三轴条不作为最强主视觉。
- start -> playing -> result 仍可走通。
- 玩家可见文本不出现外层直白词：研究员、人工智能、智能体、模型、程序、虚拟世界、模拟、实验、系统、测试。
- 没有新增明文密钥。

## 7. 回复格式

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
