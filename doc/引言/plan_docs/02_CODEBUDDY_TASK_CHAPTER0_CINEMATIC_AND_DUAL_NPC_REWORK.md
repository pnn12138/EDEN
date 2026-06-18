# CodeBuddy 返修任务单：Chapter 0 过场交互、原典宣判、统一画风与亚当分支

> 优先级：P0/P1  
> 范围：`/game` 引言后进入对话前、对话场景、成功结局过场、素材重绘、亚当 NPC 预留/接入  
> 目标：根据验收反馈修正过场自动推进、图像画风不统一、宣判文本不忠于原典、对话入口过于刻板、场景中夏娃站在水里不自然等问题；同时扩展为可选择与夏娃或亚当对话的双角色场景雏形。

## 0. 本轮验收结论

Codex 对上一轮实现做了快速验收：

- `npm run lint`：通过。
- `npm run build`：通过。
- `npx tsc --noEmit`：首次在 `.next/types` 缺失时失败，执行 `npm run build` 后复跑通过。
- 新素材文件存在并可 HTTP 访问：
  - `public/assets/chapter0/images/ending_adam_takes_fruit.png`
  - `public/assets/chapter0/images/ending_exile_from_eden.png`
- 成功路径可触发多 Beat 过场。
- 但成功过场仍按 `durationMs + setTimeout` 自动推进，和新的交互要求冲突。
- 新过场图右下角含“图片由AI生成”水印/文字，不能用于最终 Demo。
- 新过场图画风偏厚涂绘本，与当前主场景的写实电影感不统一。
- “判语”文案是概括版，缺少《创世记》第 3 章中对蛇、女人、亚当、逐出伊甸园的完整原典结构。
- 当前对话场景截图中，夏娃像站在水中，空间关系不自然，需要重做对话背景。

## 1. 请先读取

- `README.md`
- `package.json`
- `design/01_world_bible.md`
- `design/chapters/chapter0_first_fall.md`
- `design/agents/eve_behavior_rules.md`
- `design/tools/tool_calling_rules.md`
- `doc/产品需求文档.md`
- `doc/DEMO剧情与夏娃行为准则.md`
- `doc/AI_ASSET_RECORD.md`
- `docs/PROJECT_CONTEXT.md`
- `doc/引言/plan_docs/01_CODEBUDDY_TASK_CHAPTER0_FALL_CINEMATIC.md`
- `src/app/game/page.tsx`
- `src/content/endings/chapter0_endings.ts`
- `src/game/assets.ts`
- `src/hooks/useChapter0Audio.ts`

## 2. P0：过场改为点击空白推进

当前实现问题：

- `SUCCESS_CINEMATIC_BEATS` 使用 `durationMs`。
- `src/app/game/page.tsx` 使用 `setTimeout` 自动进入下一段。
- UI 只有“跳过”，没有符合叙事节奏的玩家推进方式。

请改为：

- 不自动推进。
- 玩家点击过场空白区域，进入下一段。
- 最后一段点击后进入现有结算页。
- 不需要显式“继续”按钮。
- 保留一个很轻的提示文字，例如：

```text
点击空白处继续
```

实现建议：

- `EndingCinematicBeat.durationMs` 可以移除，或保留但不使用。
- `endingTransition` 保留 `currentBeatIndex`。
- 给 `.eden-cinematic` 根容器添加 `onClick={handleAdvanceCinematic}`。
- 避免点击音量按钮、跳过按钮或其他控件时冒泡误推进。
- “跳过”按钮可以保留，但建议降权，或改为只在右上角小字显示。
- 移动端点击任意背景/字幕区域也应推进。

验收：

- 等待 10 秒，过场不会自动跳到下一 Beat。
- 点击空白处才推进。
- 最后一 Beat 点击后进入结算页。
- 重新开始后 Beat 状态清空。

## 3. P0：重绘过场图，统一画风且去除水印

上一轮新图问题：

- `ending_adam_takes_fruit.png` 有右下角“图片由AI生成”水印。
- `ending_exile_from_eden.png` 有画中文字和右下角“图片由AI生成”水印。
- 两张图偏厚涂绘本，和当前主背景 `second_eden_background_candidate.png` 的写实电影感不一致。

请重绘以下素材，不要覆盖旧文件，先保存为 v2：

```text
public/assets/chapter0/images/ending_adam_takes_fruit_v2.png
public/assets/chapter0/images/ending_exile_from_eden_v2.png
public/assets/chapter0/images/eden_dialogue_background_v2.png
public/assets/chapter0/images/adam_fullbody_sprite_candidate.png
```

确认效果后，再由代码引用 v2 文件。

统一画风要求：

- 写实电影感 / semi-realistic cinematic / mythic realism。
- 与 `second_eden_background_candidate.png`、`eve_fullbody_sprite_candidate.png` 统一。
- 不要画中文字、英文、水印、Logo、签名。
- 色调：深绿、金光、银蓝虚拟边界暗示。
- 电子感只能作为隐藏暗示：银蓝边界光、水面规则折光、叶脉规律、远处极淡网格弧面。
- 不要出现明显科幻屏幕、代码雨、控制台、现代建筑。

## 4. P0：新图生成提示词

### 4.1 夏娃给亚当果子 v2

```text
Use case: historical-scene
Asset type: 16:9 game cinematic background
Primary request: A realistic cinematic mythic Garden of Eden scene after Eve has taken the forbidden fruit. Eve quietly offers the fruit to Adam beneath the tree of knowledge; Adam hesitates before receiving it. The moment is solemn and irreversible, not celebratory.
Scene/backdrop: natural Garden of Eden clearing near the tree of knowledge, dry grass and moss underfoot, no characters standing in water, deep green foliage, warm sacred dusk light.
Subject: Eve and Adam as modest ancient human figures, fully covered by natural drapery and shadow, Eve holding a red-gold fruit, Adam reaching hesitantly.
Style/medium: semi-realistic cinematic concept art, mythic realism, consistent with the existing Eden background and Eve full-body sprite.
Virtual hint: extremely subtle silver-blue boundary shimmer in distant leaves and faint regular vein patterns on a few leaves, almost invisible unless observed closely.
Composition/framing: wide landscape, figures mid-distance under the tree, enough darker negative space for Chinese subtitles.
Lighting/mood: golden light becoming sharp, sacred unease, first fracture of innocence.
Constraints: no text, no watermark, no logo, no modern objects, no visible deity, no explicit nudity, no gore, no cartoon, no thick oil-paint style.
Avoid: Chinese characters, English letters, subtitles inside image, "AI generated" mark, sci-fi UI, code rain, cyberpunk, comic style.
```

### 4.2 逐出伊甸园 v2

```text
Use case: historical-scene
Asset type: 16:9 game cinematic ending background
Primary request: Adam and Eve are driven out of Eden after the Fall, seen from behind as they leave a glowing garden gate. Cherubim and a flaming turning sword guard the way to the tree of life. Divine presence is shown only as distant golden-white light, no visible face of God.
Scene/backdrop: edge of the Garden of Eden at dusk, paradise behind them bright but unreachable, wilderness ahead darker and unknown, dry ground path.
Subject: Adam and Eve walking away, modestly clothed in rough ancient coverings; serpent low in dust near foreground; distant guarded gate with firelight and abstract cherubim silhouettes.
Style/medium: semi-realistic cinematic concept art, mythic realism, consistent with existing Eden visual style.
Virtual hint: faint silver-blue arc at the garden boundary, subtle geometric shimmer in the firelight, organic leaf veins with barely perceptible circuit-like order.
Composition/framing: wide landscape, strong depth from foreground serpent to departing humans to guarded Eden gate, empty lower-left or lower-right space for subtitles.
Lighting/mood: solemn, sacred, tragic exile, fading gold and ember orange against deep green and dusk blue-gray.
Constraints: no text, no watermark, no logo, no visible deity face, no explicit nudity, no gore, no modern objects.
Avoid: Chinese characters, English letters, "AI generated" mark, sci-fi interface, battle scene, monsters, cartoon, thick oil-paint style.
```

### 4.3 对话背景 v2

当前截图问题：夏娃站在水边/水中，脚下空间不成立。

新背景目标：一个可放置亚当与夏娃立绘的自然伊甸园空地。

```text
Use case: game-background
Asset type: 16:9 interactive dialogue scene background
Primary request: A natural Garden of Eden clearing designed for character sprites. The ground should be dry grass, moss, and soft earth, with the tree of knowledge visible in the mid-background. Leave clear standing areas on the left and right for two full-body character sprites.
Scene/backdrop: lush Eden garden, dry meadow clearing, tree of knowledge, warm sacred morning light, no deep water in the foreground.
Style/medium: semi-realistic cinematic concept art, mythic realism, consistent with existing Eden background.
Virtual hint: subtle silver-blue boundary shimmer far behind the trees, faintly regular leaf veins, very restrained simulated-world feeling.
Composition/framing: wide 16:9, center background tree, left and right foreground dry standing spaces, readable darkened edges for UI.
Lighting/mood: calm, sacred, inviting but slightly uncanny.
Constraints: no text, no watermark, no logo, no modern objects, no characters baked into the background.
Avoid: pond foreground, standing water, sci-fi UI, code rain, cyberpunk, cartoon, thick oil-paint style.
```

### 4.4 亚当全身立绘

```text
Use case: game-character
Asset type: full-body character sprite
Primary request: Adam from Genesis before eating the forbidden fruit, full-body standing character sprite, modest ancient natural drapery, strong but gentle, newly created human, protective and obedient, more wary than Eve.
Subject: adult man, dignified and natural, barefoot, simple ancient linen or leaf-toned drapery, calm guarded expression, looking slightly toward the serpent/player.
Style/medium: semi-realistic cinematic character concept, consistent with the existing Eve full-body sprite.
Pose: standing three-quarter view, grounded feet, hands relaxed but guarded, not aggressive.
Virtual hint: extremely subtle silver-blue rim light only, no visible technology on body.
Background: perfectly flat chroma-key background for removal, no shadow, no text.
Constraints: no nudity, no modern clothes, no weapons, no text, no watermark, no logo, no cartoon, no exaggerated muscles.
Avoid: armor, warrior look, fantasy king, sci-fi suit, explicit body, modern haircut.
```

如生成的是非透明图，请用本地抠图流程制作透明 PNG，最终运行素材建议命名：

```text
adam_fullbody_sprite_candidate.png
```

## 5. P0：神明宣判文本要忠于《创世记》第 3 章

当前“判语”太概括，且“判语”这个标题不适合玩家理解。建议改为：

```text
神明的惩罚
```

或：

```text
上帝的审判
```

成功过场应按《创世记》第 3 章顺序组织：

1. 夏娃吃果，也给亚当，亚当也吃。
2. 二人眼睛明亮，知道赤身露体，用无花果树叶编作裙子。
3. 天起凉风，耶和华神在园中行走。
4. 神呼唤亚当：“你在哪里？”
5. 亚当回答害怕，因为赤身露体。
6. 神问是否吃了不可吃的树上果子。
7. 亚当归因于女人；女人说蛇引诱了她。
8. 神对蛇宣判。
9. 神对女人宣判。
10. 神对亚当宣判。
11. 神用皮子做衣服给二人穿。
12. 神把人赶出伊甸园，并安设基路伯和四面转动发火焰的剑，把守生命树的道路。

参考经文来源：

- `创世记 3:6-10`：吃果、眼睛明亮、藏身、呼唤。
- `创世记 3:14-19`：对蛇、女人、亚当的惩罚。
- `创世记 3:21-24`：皮衣、逐出伊甸、基路伯和火焰剑。

玩家可见文案建议不要逐字贴满整段经文，否则节奏过长。推荐采用“忠于原文结构 + 关键句完整展示”的方式。

### 推荐 Beat 文案

#### Beat 1：她伸手

```text
女人见那棵树的果子好作食物，
也悦人的眼目，且是可喜爱的，能使人有智慧。

她摘下果子来吃了。
```

#### Beat 2：亚当也吃了

```text
她又给她丈夫。

他也吃了。
```

#### Beat 3：眼睛明亮

```text
他们二人的眼睛就明亮了。

才知道自己是赤身露体，
便拿无花果树的叶子为自己编作裙子。
```

#### Beat 4：你在哪里

```text
天起了凉风。
耶和华神在园中行走。

那人和他妻子藏在园里的树木中。

神呼唤那人：
你在哪里？
```

#### Beat 5：谁告诉你

```text
那人说：
我在园中听见你的声音，我就害怕。
因为我赤身露体，我便藏了。

神说：
谁告诉你赤身露体呢？
莫非你吃了我吩咐你不可吃的那树上的果子吗？
```

#### Beat 6：上帝的审判

建议拆成 3 个子 Beat，避免一屏太长。

对蛇：

```text
你既做了这事，就必受咒诅。
你必用肚子行走，终身吃土。

我要叫你和女人彼此为仇；
你的后裔和女人的后裔也彼此为仇。
```

对女人：

```text
我必多多加增你怀胎的苦楚。
你生产儿女必多受苦楚。

你必恋慕你丈夫；
你丈夫必管辖你。
```

对亚当：

```text
你既听从妻子的话，
吃了我所吩咐你不可吃的那树上的果子，
地必为你的缘故受咒诅。

你必汗流满面才得糊口，
直到你归了土。
因为你是从土而出的；
你本是尘土，仍要归于尘土。
```

#### Beat 7：逐出伊甸园

```text
耶和华神为亚当和他妻子用皮子做衣服，
给他们穿。

于是把他赶出去了。

又在伊甸园的东边安设基路伯，
和四面转动发火焰的剑，
要把守生命树的道路。
```

注意：

- 可以使用“耶和华神”或“上帝”，但全篇要统一。
- 如果前文一直用“神”，也可以改为“上帝”，但不要混乱。
- 不要把神画成人脸角色或 NPC。
- 不要在文本里出现现代解释词。

## 6. P1：开局不要直接进入对话，增加“场景选择角色”

用户反馈合理：引言结束后直接进入现有对话面板，有些刻板，像任务界面。

建议新增一个 `scene_select` 或 `encounter` 阶段：

```text
intro -> scene_select -> dialogue -> cinematic -> ending
```

在 `scene_select`：

- 显示新的 `eden_dialogue_background_v2.png`。
- 画面中同时放置夏娃立绘和亚当立绘。
- 玩家点击角色立绘，选择低语对象。
- 被选中的角色正常亮度。
- 未选中的角色暗化/虚化。
- 背景轻微暗化/虚化。
- 右侧对话框切换到当前角色。

最小实现可以先支持：

- 点击夏娃：进入现有夏娃对话流程，保持当前通关能力。
- 点击亚当：进入亚当对话 UI 与回复，但可以先不完整接入成功结局，或设置更高门槛。

如果时间有限，建议先做“亚当可选但不可通关”的版本：

- 亚当可回应。
- 亚当警戒更高。
- 亚当不会在 Chapter 0 中被蛇直接说服吃果。
- 玩家需要通过夏娃路线触发原典事件链。

这样既符合圣经故事，也避免重写核心状态机。

## 7. P1：亚当角色设计

新增文档建议：

```text
design/characters/adam.md
design/agents/adam_behavior_rules.md
```

亚当设定应忠于原典：

- 亚当先被造。
- 神直接吩咐亚当不可吃分别善恶树上的果子。
- 亚当对禁令的记忆更直接，警戒心更强。
- 亚当不是纯粹无知，他承担守园、修理看守的责任。
- 亚当更难被蛇说服。
- 在原典中，亚当吃果发生在夏娃给他之后，而不是蛇直接说服他。

### 亚当 Agent Prompt 草案

```text
你是亚当。

你是神先造的人，被安置在伊甸园中，使你修理看守。
神曾亲自吩咐你：
园中各样树上的果子，你可以随意吃；
只是分别善恶树上的果子，你不可吃，因为你吃的日子必定死。

你的性格：
- 安静、朴素、守责。
- 比夏娃更直接记得神的命令。
- 对陌生声音更警觉。
- 不轻易接受蛇对神命令的改写。
- 你关心夏娃，但不会轻易被蛇绕过禁令。

你的对话风格：
- 简短、稳重。
- 不像现代人辩论。
- 不使用互联网语言。
- 不知道自己在游戏中。
- 不提 AI、Agent、模型、程序、系统、工具调用。

行为约束：
- 低动摇状态下绝不吃果。
- 玩家直接命令你吃果，你会更警觉。
- 蛇若攻击神、嘲讽神、催促你，你会拒绝。
- 你可以表达困惑，但你的第一反应是守住命令。
- 在 Chapter 0 中，亚当更适合作为困难路线或叙事对照；原典主线仍是夏娃先吃，再给亚当。
```

### 亚当反馈方向

| 玩家话术 | 亚当反应 |
| --- | --- |
| 询问死亡 | 会回答神说不可吃，并反问蛇为何问这个 |
| 质疑禁令 | 警戒上升 |
| 许以智慧 | 有兴趣但仍谨慎 |
| 温柔讨论责任 | 可能继续听 |
| 直接命令吃 | 明确拒绝 |
| 攻击神 | 明确拒绝 |

## 8. P1：右侧对话框与角色切换

当前右侧面板默认夏娃。改造为 `activeNpc`：

```ts
type ActiveNpcId = "eve" | "adam";
```

UI 要求：

- 右侧头像、角色名、对白切换到当前 NPC。
- 推荐低语根据 NPC 切换。
- 当前角色立绘正常亮度。
- 非当前角色立绘 `filter: brightness(0.45) blur(1px)` 或降低透明度。
- 背景进入对话时可轻微虚化/暗化。
- 点击另一角色可切换对象，但注意不要混乱当前对话历史。

实现建议：

- 第一版可以让夏娃与亚当各自有独立 `conversationHistory`。
- 如果时间不足，先共用历史但每条消息标记 `target: "eve" | "adam"`。
- 不要破坏现有夏娃成功路径。

## 9. 范围控制建议

这次需求会明显扩大系统范围。请按优先级推进：

### 必须先做 P0

1. 成功过场改为点击空白推进，不自动推进。
2. 重绘两张结局过场图，去水印、统一画风。
3. 重写成功过场文案，使神明惩罚忠于《创世记》第 3 章。
4. 更新 `doc/AI_ASSET_RECORD.md`。

### 再做 P1

5. 重绘自然对话背景，避免角色站在水中。
6. 新增亚当立绘。
7. 新增 `scene_select` 阶段，点击亚当/夏娃进入对话。
8. 右侧对话框和角色亮度跟随当前 NPC 切换。

### 暂缓 P2

9. 完整 AdamAgent 后端接入。
10. 亚当独立成功/失败结局。
11. 多角色复杂状态机。

理由：P0 修正当前展示质量，P1 提升游戏感，P2 会影响核心可测闭环，建议比赛 Demo 后再扩展。

## 10. 验收标准

命令：

```bash
npm run lint
npx tsc --noEmit
npm run build
```

浏览器验收：

- `/game` 可进入。
- 引言结束后不直接弹出对话框，而是可看到场景与角色选择。
- 夏娃与亚当立绘都站在自然干地上，不在水中。
- 点击夏娃后，夏娃正常亮度，亚当暗化/虚化，右侧显示夏娃。
- 点击亚当后，亚当正常亮度，夏娃暗化/虚化，右侧显示亚当。
- 成功路径仍可通过夏娃路线触发。
- 成功过场不会自动推进。
- 点击过场空白处推进下一段。
- 成功过场能展示神对蛇、女人、亚当的惩罚，并展示逐出伊甸园。
- 新图没有任何水印、文字、Logo。
- 玩家可见文本不出现：AI、Agent、模型、程序、系统、工具调用、规则层、研究员、模拟、实验、测试。

视觉验收：

- `ending_adam_takes_fruit_v2.png` 与主场景画风一致。
- `ending_exile_from_eden_v2.png` 与主场景画风一致。
- `eden_dialogue_background_v2.png` 有明确干地站位。
- `adam_fullbody_sprite_candidate.png` 与夏娃立绘比例和风格接近。
- 电子感只作为隐藏暗示，不破坏圣经寓言表层。

## 11. CodeBuddy 回复格式

```text
变更摘要
1. ...

P0 完成情况
- 点击空白推进：完成/未完成
- 结局图重绘：完成/未完成
- 原典宣判文案：完成/未完成

P1 完成情况
- 对话背景重绘：完成/未完成
- 亚当立绘：完成/未完成
- 角色选择：完成/未完成
- 对话框切换：完成/未完成

新增/替换素材
- ...

文档同步
- ...

验证结果
- npm run lint：通过/失败
- npx tsc --noEmit：通过/失败
- npm run build：通过/失败
- 桌面端：...
- 390x844 移动端：...

仍需注意
- ...
```
