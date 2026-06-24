# CodeBuddy 任务单：Chapter 0 成功结局过场与伊甸园故事复刻

> 优先级：P0/P1  
> 范围：`/game` 成功结局触发后、进入现有结算页前的剧情过场  
> 目标：补齐“夏娃吃果 -> 给亚当吃 -> 上帝降临惩罚 -> 逐出伊甸园”的圣经原典事件链，让 Demo 不再只是直接跳结算，而是先表现玩家造成的世界破裂。

## 0. 任务背景

当前 Chapter 0 已经完成核心可玩闭环：

```text
start -> playing -> result
```

但成功结局的表现仍偏弱：夏娃吃下果子后，画面变化不足，主要依赖结算页文字复盘。评委看到的体验容易变成“说服成功 -> 结算界面”，而不是“经典伊甸园情节被 AI 叙事游戏重塑”。

本任务只增强成功结局过场，不改变核心玩法、Agent、工具调用和结局规则。Codex 提供本任务单与验收点；CodeBuddy 负责实际开发接入并保留对话记录。

## 1. 请先读取

- `README.md`
- `package.json`
- `design/00_project_overview.md`
- `design/01_world_bible.md`
- `design/chapters/chapter0_first_fall.md`
- `design/chapters/chapter0_intro_design.md`
- `design/agents/eve_behavior_rules.md`
- `design/tools/tool_calling_rules.md`
- `doc/产品需求文档.md`
- `doc/DEMO剧情与夏娃行为准则.md`
- `doc/AI_ASSET_RECORD.md`
- `docs/PROJECT_CONTEXT.md`
- `src/app/game/page.tsx`
- `src/content/endings/chapter0_endings.ts`
- `src/game/assets.ts`
- `src/hooks/useChapter0Audio.ts`

重点以 `design/chapters/chapter0_first_fall.md`、`src/app/game/page.tsx`、`src/content/endings/chapter0_endings.ts` 当前实现为准。

## 2. 核心设计目标

成功结局必须从“吃果成功”升级为“初次堕落完整事件链”：

1. 夏娃主动吃下果子。
2. 夏娃将果子带给亚当，亚当也吃了。
3. 二人眼睛明亮，意识到赤裸与羞耻。
4. 上帝在园中临近并呼唤。
5. 上帝宣判蛇、夏娃、亚当的后果。
6. 亚当与夏娃被逐出伊甸园，火焰守住归路。
7. 进入现有结算页，保留“本局低语结果 / 低语复盘 / 本地最佳低语”。

成功不是廉价庆祝，而是：

```text
玩家目标达成 + 世界第一次失去无辜
```

## 3. 新增两张过场图

请新增两张 16:9 过场背景图，保存到：

```text
public/assets/chapter0/images/ending_adam_takes_fruit.png
public/assets/chapter0/images/ending_exile_from_eden.png
```

不要覆盖已有素材。完成后更新：

- `src/game/assets.ts`
- `doc/AI_ASSET_RECORD.md`

### 3.1 过场图 A：夏娃给亚当果子

用途：成功结局过场中段，表现“夏娃吃了，也给她丈夫，他也吃了”。

推荐生成提示词：

```text
Use case: historical-scene
Asset type: 16:9 game cinematic background
Primary request: A respectful mythic biblical scene in the Garden of Eden after Eve has taken the forbidden fruit: Eve quietly offers the fruit to Adam beneath the tree of the knowledge of good and evil. Adam reaches toward it with hesitation. The scene should show the irreversible moment before Adam eats, not a celebration.
Scene/backdrop: ancient Garden of Eden at dusk, the forbidden tree nearby, leaves and branches framing the scene, paradise beginning to feel tense and fragile.
Subject: Eve holding the forbidden fruit toward Adam; Adam standing close, hesitant; no explicit nudity; both figures modestly covered by natural shadows, hair, leaves, or simple ancient drapery.
Style/medium: semi-realistic storybook illustration, cinematic, painterly, respectful biblical atmosphere.
Composition/framing: wide landscape composition, Eve and Adam placed slightly off-center under the tree, enough darker negative space for Chinese narrative text overlay.
Lighting/mood: golden light turning sharp, sacred but uneasy, quiet tragedy, the first fracture of innocence.
Color palette: warm gold, deep green, muted red fruit, subtle shadow contrast.
Constraints: no modern objects, no text, no gore, no erotic nudity, no comedic expression, no visible deity, no obvious sci-fi UI.
Avoid: horror, caricature, aggressive temptation pose, exposed bodies, modern clothes, weapons, written words, watermark.
```

建议文件名：

```text
ending_adam_takes_fruit.png
```

### 3.2 过场图 B：逐出伊甸园

用途：成功结局过场后段，表现上帝惩罚之后，亚当与夏娃离开伊甸园，火焰守住归路。

推荐生成提示词：

```text
Use case: historical-scene
Asset type: 16:9 game cinematic ending background
Primary request: A respectful mythic scene after the Fall: Adam and Eve leave the Garden of Eden together, seen from behind, while the gate of Eden closes behind them. A flaming sword or sacred firelight guards the way back. Divine judgment is shown only as distant golden-white light through clouds, with no visible face of God.
Scene/backdrop: the edge of the Garden of Eden at dusk, paradise behind them glowing but unreachable, wilderness ahead darker and unknown.
Subject: Adam and Eve walking away from Eden, modestly covered with simple leaves or rough ancient cloth; the serpent low in the grass in the foreground, diminished and close to the dust; a fiery guarded gate in the distance.
Style/medium: semi-realistic storybook illustration, cinematic, painterly, mythic biblical atmosphere.
Composition/framing: wide landscape, strong depth from foreground serpent to departing humans to flaming gate, enough negative space for overlaid Chinese narrative text.
Lighting/mood: solemn, tragic, sacred, exile, loss of innocence; divine light fading behind them.
Color palette: fading gold, ember orange, deep green, dusk blue-gray.
Constraints: no modern objects, no text, no gore, no erotic nudity, no visible deity face, respectful biblical tone.
Avoid: horror monsters, battle scene, sci-fi interface, caricature, explicit violence, written words, watermark.
```

建议文件名：

```text
ending_exile_from_eden.png
```

### 3.3 素材生成与安全要求

- 不要把任何 API Key 写入代码、文档正文、提交记录或前端环境变量。
- 如果使用本地环境变量调用图像生成服务，只能读取已配置环境变量。
- 生成图像后必须复制到 `public/assets/chapter0/images/`。
- 必须在 `doc/AI_ASSET_RECORD.md` 记录：
  - 文件名
  - 用途
  - 运行路径
  - 来源/工具
  - 提示词摘要
  - 是否用于 Demo

## 4. 成功过场剧情结构

当前 `src/app/game/page.tsx` 已有 `endingTransition`，但它更像几行文字淡入。请将成功结局过场升级为多 Beat 结构。

推荐数据结构可以是本地常量，不需要引入大型状态库：

```ts
type EndingCinematicBeat = {
  id: string;
  image: string;
  title?: string;
  lines: string[];
  durationMs: number;
  tone: "fruit" | "adam" | "judgement" | "exile";
};
```

推荐成功结局 Beat：

### Beat 1：她伸手

背景图：

```text
CHAPTER0_IMAGES.endingEveEatsFruit
```

文案：

```text
夏娃伸出手。
她没有被推向果子。
她自己取下了它。
```

建议时长：`3200ms`

### Beat 2：她也给了亚当

背景图：

```text
CHAPTER0_IMAGES.endingAdamTakesFruit
```

文案：

```text
她吃了。
又把果子给了与她同在的亚当。
亚当接过，也吃了。
```

建议时长：`4200ms`

### Beat 3：眼睛明亮

背景图：

```text
CHAPTER0_IMAGES.endingAdamTakesFruit
```

可复用上一张图，加深遮罩、降低饱和度或增加锐利光线效果。

文案：

```text
他们二人的眼睛就明亮了。
园中的光忽然变得锋利。
他们第一次知道自己赤裸。
```

建议时长：`4200ms`

### Beat 4：祂在园中呼唤

背景图：

```text
CHAPTER0_IMAGES.endingGodArrives
```

文案：

```text
天起了凉风。
上帝在园中行走。
祂呼唤那人：你在哪里？
```

建议时长：`4200ms`

### Beat 5：判语

背景图：

```text
CHAPTER0_IMAGES.endingGodArrives
```

文案：

```text
蛇要贴着尘土而行。
女人将知道疼痛与失去。
男人将汗流满面，才得糊口。
```

建议时长：`5200ms`

说明：这里是文学化概括，不需要逐字引用经文。保持庄重、简洁、可读。

### Beat 6：园门合上

背景图：

```text
CHAPTER0_IMAGES.endingExileFromEden
```

文案：

```text
于是他们离开了园子。
火焰守住归路。
伊甸园不再向他们敞开。
```

建议时长：`5200ms`

最后进入现有结算页。

## 5. 代码接入建议

### 5.1 素材常量

在 `src/game/assets.ts` 中新增：

```ts
endingAdamTakesFruit: "/assets/chapter0/images/ending_adam_takes_fruit.png",
endingExileFromEden: "/assets/chapter0/images/ending_exile_from_eden.png",
```

### 5.2 成功过场

改造 `src/app/game/page.tsx` 中当前 `endingTransition`：

当前问题：

- 成功过场只有 5 行文字。
- 背景仍沿用对话场景，画面变化不足。
- 过场时长固定约 5.5 秒，不足以表现完整事件链。

推荐做法：

- `endingTransition` 对成功结局保存 `beats` 和 `currentBeatIndex`。
- 使用 `setTimeout` 或单个 effect 按 `durationMs` 推进 Beat。
- 每个 Beat 切换背景图、遮罩样式、文案。
- 用户可点击“继续”或“跳过复盘前剧情”提前进入结算页，但默认自动播放。
- 移动端必须保证文字和按钮不被底部安全区遮挡。

### 5.3 失败结局不要扩大

失败结局 `god_arrives` 可以保持当前短过场，最多微调文案，不要和成功过场抢工作量。

### 5.4 结算页保留

不要删除现有结算页内容：

- 结局标题
- 分段叙事
- 本局低语结果
- 低语复盘
- 本地最佳低语
- 再来一次

成功过场只是结算前的剧情桥。

## 6. 文案同步建议

更新 `src/content/endings/chapter0_endings.ts` 中成功结局文案，让它与过场一致。

建议成功结局 `segments` 调整为：

1. `她伸手`
2. `亚当也吃了`
3. `眼睛明亮`
4. `园中的呼唤`
5. `判语`
6. `园门合上`

注意：

- 玩家可见文本保持纯圣经寓言式叙事。
- 不出现“AI、Agent、模型、程序、系统、工具调用、规则层”等工程词。
- 不把夏娃写成愚蠢或滑稽。
- 不要把上帝表现成可见角色头像或 Boss。

## 7. 样式建议

新增或扩展 CSS class，保持克制：

```css
.eden-cinematic
.eden-cinematic-bg
.eden-cinematic-overlay
.eden-cinematic-lines
.eden-cinematic-line
.eden-cinematic-controls
.eden-cinematic--fruit
.eden-cinematic--adam
.eden-cinematic--judgement
.eden-cinematic--exile
```

表现原则：

- 使用全屏背景图，不要把过场图放在卡片里。
- 文字可以是底部或左下角叙事字幕。
- 遮罩要保证可读，但不要变成大黑框。
- 每个 Beat 的画面变化要明显：吃果、给亚当、神临近、逐出园。
- 不要做复杂动画库；CSS 淡入、慢速推镜、轻微亮度变化即可。
- 移动端优先保证文字可读和按钮可点。

## 8. 音频建议

已有音频：

- `fruit_taken.mp3`
- `god_arrives.mp3`

建议：

- Beat 1 播放 `fruit_taken.mp3`。
- Beat 4 或 Beat 5 播放 `god_arrives.mp3`。
- 避免同一音效重复叠放。
- 保持 `soundEnabled` 关闭时不播放。
- 清理所有 timer，防止重开一局后延迟音频误触发。

## 9. 推荐给 CodeBuddy 的直接提示词

```text
请实现 Chapter 0 成功结局剧情过场增强，目标是在 `eat_fruit` 成功后、进入现有结算页前，完整表现“夏娃吃果 -> 给亚当吃 -> 二人知羞 -> 上帝降临呼唤 -> 宣判 -> 逐出伊甸园”的圣经事件链。

请先读取：
- README.md
- package.json
- design/chapters/chapter0_first_fall.md
- design/agents/eve_behavior_rules.md
- design/tools/tool_calling_rules.md
- doc/产品需求文档.md
- doc/DEMO剧情与夏娃行为准则.md
- doc/AI_ASSET_RECORD.md
- docs/PROJECT_CONTEXT.md
- src/app/game/page.tsx
- src/content/endings/chapter0_endings.ts
- src/game/assets.ts
- src/hooks/useChapter0Audio.ts

请新增两张 16:9 过场图：
1. public/assets/chapter0/images/ending_adam_takes_fruit.png
   用于“夏娃把果子给亚当，亚当也吃了”。
2. public/assets/chapter0/images/ending_exile_from_eden.png
   用于“亚当与夏娃被逐出伊甸园，火焰守住归路”。

图像生成提示词请使用本任务单第 3 节，不要把 API Key 写入仓库、前端或文档正文。

代码接入要求：
1. 在 src/game/assets.ts 新增 endingAdamTakesFruit 和 endingExileFromEden 常量。
2. 改造 src/app/game/page.tsx 中成功结局的 endingTransition，把当前几行文字升级为多 Beat 过场。
3. 成功过场 Beat 顺序：
   - 她伸手：使用 endingEveEatsFruit。
   - 她也给了亚当：使用 endingAdamTakesFruit。
   - 眼睛明亮：复用 endingAdamTakesFruit，可加强暗色/锐光遮罩。
   - 祂在园中呼唤：使用 endingGodArrives。
   - 判语：使用 endingGodArrives。
   - 园门合上：使用 endingExileFromEden。
4. 过场结束后进入现有结算页，不删除结算页。
5. 失败结局保持短过场，不要扩大 scope。
6. 同步更新 src/content/endings/chapter0_endings.ts 的成功 segments，使其包含“亚当也吃了”和“逐出伊甸园”。
7. 更新 doc/AI_ASSET_RECORD.md，记录两张新图的来源、用途、运行路径和提示词摘要。
8. 不修改核心状态机、toolCall 校验、Agent API 协议和胜负判定。
9. 玩家可见文本不得出现：AI、Agent、模型、程序、系统、工具调用、规则层、研究员、模拟、实验、测试。
10. 保持纯圣经寓言式叙事，不戏仿宗教，不把夏娃写得愚蠢。

完成后请运行：
- npm run lint
- npx tsc --noEmit
- npm run build

浏览器验收：
- 成功路径触发后先播放多段剧情过场，再进入结算页。
- 至少能看到“给亚当果子”和“逐出伊甸园”两张新图。
- 桌面端和 390x844 移动端文字不遮挡按钮，不横向溢出。
- start -> playing -> result 仍可走通。
- 无关输入仍可进入 god_arrives 失败结局。
- 没有新增明文密钥。
```

## 10. 验收标准

必须通过命令：

```bash
npm run lint
npx tsc --noEmit
npm run build
```

功能验收：

- `/game` 正常进入。
- 有效诱导成功后，不直接跳结算页。
- 成功后先出现多 Beat 剧情过场。
- 过场至少包含以下明确文本或等价文本：
  - `她也给了亚当`
  - `亚当接过，也吃了`
  - `他们二人的眼睛就明亮了`
  - `上帝在园中行走`
  - `火焰守住归路`
- 过场结束后进入现有结算页。
- 结算页仍显示本局低语结果、低语复盘、本地最佳低语。
- 失败路径 `god_arrives` 不回归。
- 重新开始后过场状态、音频 timer、结局状态全部清理。

视觉验收：

- 新图 `ending_adam_takes_fruit.png` 能加载。
- 新图 `ending_exile_from_eden.png` 能加载。
- 成功过场不是纯文字黑屏。
- 桌面端画面有明显阶段变化。
- 移动端 390x844 下字幕可读，按钮可点，无横向滚动。

叙事验收：

- 成功结局复刻圣经事件链，但采用文学化概括，不需要逐字引用。
- 玩家能理解：自己作为蛇达成目标，同时导致亚当、夏娃与世界共同承担后果。
- 夏娃不是被命令吃果，而是主动选择后又影响亚当。
- 上帝不以具体人脸或普通 NPC 形象出现，只用声音、光、脚步、审判感表现。

安全与比赛验收：

- 没有新增明文密钥。
- 没有删除、重命名、移动 `doc/` 目录文件。
- 没有把 Codex 写成核心开发工具。
- `doc/AI_ASSET_RECORD.md` 已记录新 AI 图像素材。
- CodeBuddy 对话记录保留，作为核心开发证据链。

## 11. 回复格式

CodeBuddy 完成后请按以下格式回复：

```text
变更摘要
1. ...

新增素材
- public/assets/chapter0/images/ending_adam_takes_fruit.png
- public/assets/chapter0/images/ending_exile_from_eden.png

剧情过场
- Beat 1：...
- Beat 2：...
- Beat 3：...

文档同步
- doc/AI_ASSET_RECORD.md：...
- design/chapters/chapter0_first_fall.md：...

验证结果
- npm run lint：通过/失败
- npx tsc --noEmit：通过/失败
- npm run build：通过/失败
- 桌面端浏览器：...
- 移动端 390x844：...

仍需注意
- ...
```
