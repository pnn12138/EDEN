# Chapter 1 三位天使隐藏结局设计

> 版本：v1.1
> 日期：2026-07-13
> 状态：设计已确认，待 CodeBuddy 实现与 Codex 验收  
> 范围：加百列 `escape_eden`、米迦勒 `michael_slay`、路西法 `lucifer_awaken`
> v1.1：按用户最新确认，路西法结局外层主角改为培养舱中的现实人类；蛇是该人类在伊甸模拟中的代理形态。

## 1. 目标

为第一章「园中诸声」补齐三位天使各自对应的一条隐藏结局，并让每条结局都具备可独立展示的完整闭环：

```text
隐藏条件积累
→ 规则层判定
→ 锁定 ending 状态
→ 至少一个专属全屏过场场景
→ 4–5 段点击推进文案
→ 现有 EndingReview 五模块复盘
→ 跨局图鉴记录
```

三条隐藏结局必须满足以下共同原则：

- 规则层是结局和状态变化的唯一权威；Agent 只负责角色回复。
- 不加入 `NORMAL_ENDING_IDS`，但写入跨局 `triggeredEndingIds`。
- 结局触发后停止后续玩法结算，不允许继续操作世界。
- 旧存档缺少新增字段时补默认值，不崩溃、不退回探索阶段。
- 每条结局使用独占的 1920×1080 PNG 过场图，不复用普通成功或失败结局背景；路西法使用两张连续镜头，其余两条各一张。
- 图片加载失败时仍显示对应色调背景、完整过场文案和复盘，不阻断闭环。
- 核心玩法实现、主要调试和关键代码变更由 CodeBuddy 完成并保留对话证据；Codex 负责设计、素材生成、测试、审查和提交前验收。

## 2. 当前实现基线

### 2.1 加百列

现有代码已经具备大部分骨架：

- `WorldEndingId` 已包含 `escape_eden`。
- 加百列好感至少 100 且通过主动试炼后，规则层赠予 `resonance_flaming_sword`。
- 东园幽径昼夜场景问题均有 `futile_struggle` 选项，选择后执行 `triggerEscapeCheck`。
- 持有旋转的火焰剑时，`triggerEscapeEden` 写入 `phase="ending"`、`isEnded=true`、`endingId="escape_eden"` 并解锁 `mark_escape_eden`。
- `EndingReview`、`traceRules` 和 `EndingsGallery` 已有 `escape_eden` 分支。

当前缺口：

- 结局页复用 Chapter 0 的放逐背景，不是加百列专属过场图。
- 进入结局后直接显示复盘，没有独立的过场播放阶段。
- 从谜题 API 触发时，结局音效和表现层通知链需要专项验证。

### 2.2 米迦勒

当前没有 `michael_slay` 结局 ID、一次性状态、触发函数、复盘、图鉴条目、印记或专属图片。

现有 `applyNpcAffinity` 可返回 `delta` 与 `newAffinity`，并将好感限制在不低于 0，可直接作为规则层触发依据。

### 2.3 路西法

现有代码已预留三个隐藏线索：

- `mark_hidden_dialog` 检查 `topic_lucifer_boundary`。
- `mark_hidden_operation` 检查 `interact_lucifer_rowing`。
- `mark_hidden_ending` 当前检查不存在的 `trigger_lucifer_hidden_ending` 动作 ID。

当前缺口：

- `interact_lucifer_rowing` 尚未进入 `SCENE_ACTIONS`。
- `topic_lucifer_boundary` 尚未由路西法对话链写入。
- 没有 `lucifer_awaken` 类型、状态、触发函数、复盘、图鉴或专属图片。
- 现有 `npcDialogues` 是 NPC→NPC 记录，不能用来承载蛇与路西法的隐藏话题，否则会污染其他对话成就统计。

## 3. 方案选择

采用「增量式三结局闭环」：保留加百列现有链路，在同一状态和规则层模式下补米迦勒、路西法；不在本轮抽象通用隐藏结局引擎。

原因：

- 当前工作区存在大量 CodeBuddy 在制改动，增量方案冲突面更小。
- 三条结局触发时机不同，过早抽象会引入额外间接层。
- 比赛 Demo 更重视可玩闭环、稳定性和可展示性，而非一次大范围架构重构。

## 4. 三条隐藏结局

### 4.1 加百列：园外的清晨

| 字段 | 设计 |
| --- | --- |
| 结局 ID | `escape_eden` |
| 结局名称 | 园外的清晨 |
| 类型 | 隐藏逃离结局 / special |
| 印记 | 现有 `mark_escape_eden` |
| 色调 | 园内暖金与园外黎明冷蓝 |
| 专属图片 | `public/assets/chapter1/images/escape_eden_ending.png` |

触发链：

1. 加百列好感至少 100。
2. 完成加百列主动试炼。
3. 获得 `resonance_flaming_sword`。
4. 回到东园幽径，打开昼间或夜间「幽径尽头的问题」。
5. 选择 `futile_struggle`「挣脱眼前的一切，试着从这场无法醒来的梦里离开」。
6. 谜题规则层确认持有火焰剑，调用 `triggerEscapeEden`。

过场图构图：

- 东园幽径的道路在画面中央被一道旋转火焰剑光斩开。
- 画面左侧或后景仍是暖金、暗绿的伊甸；裂缝外是冷蓝灰色的无名清晨。
- 蛇形剪影正穿过裂缝，不能出现亚当或女人，避免误读为普通放逐结局。
- 火焰只切开无形帷幕，不焚毁树林；庄重、克制、无文字、无水印。

过场文案：

1. 东园幽径的尽头仍没有墙。只有旋转的火焰在你面前自行成剑。
2. 你向梦的边缘撞去。火焰没有烧毁树木，只在看不见的帷幕上划开一道裂缝。
3. 伊甸的河流、树影与天使向后退去，像一幅被晨风卷起的画。
4. 你从小径之外醒来。脚下的土地尚未被命名；身后，园子永远停在最初的清晨。

### 4.2 米迦勒：剑下之责

| 字段 | 设计 |
| --- | --- |
| 结局 ID | `michael_slay` |
| 结局名称 | 守门者之剑 |
| 结局标题 | 剑下之责 |
| 类型 | 隐藏失败结局 / failure |
| 印记 | 新增 `mark_michael_slay` |
| 色调 | 冷金、白银、暗红黑 |
| 专属图片 | `public/assets/chapter1/images/michael_slay_ending.png` |
| 印记图标 | `public/assets/chapter1/images/achievements/mark_michael_slay.png` |

触发条件必须全部满足：

- `targetNpc === "michael"`。
- 本次 `applyNpcAffinity` 返回 `delta < 0`。
- 本次 `applyNpcAffinity` 返回 `newAffinity === 0`。
- `!state.michaelSlayClaimed`。

触发时机：

- 紧接 `applyNpcAffinity` 后，早于 Agent 调用、神明注视、AP、工具、奖励和时段结算。
- 调用 `triggerMichaelSlay(state)` 后立即返回结局响应。
- 响应可不带米迦勒 Agent 回复；过场文案承担最终回应。

过场图构图：

- 伊甸之河边，米迦勒以现有深蓝金甲、白翼形象拔出守护者之剑。
- 一道纵向冷白剑光切开河面，水中倒影也同时断裂。
- 蛇只以暗色剪影或水中倒影出现，暗部有少量暗红，不描绘血腥伤口。
- 重点是「后果降临」与边界被守住，而非战斗爽感。

过场文案：

1. 米迦勒的目光终于没有了任何温度。
2. “我守的是后果。你一次次试探边界，却忘了边界之后是什么。”
3. 守护者的剑出了鞘，河面的光被一道白痕切开。
4. 你没能说出最后一句话。伊甸之河的水声，成了你听见的最后声音。

### 4.3 路西法：被命名之前

| 字段 | 设计 |
| --- | --- |
| 结局 ID | `lucifer_awaken` |
| 结局名称 | 缸中之醒 |
| 结局标题 | 被命名之前 |
| 类型 | 隐藏识破结局 / special |
| 印记 | 复用 `mark_hidden_ending` |
| 色调 | 青绿、冷蓝、深紫、暖白晨星点光 |
| 专属图片 1 | `public/assets/chapter1/images/lucifer_awaken_ending.png`（刚恢复知觉） |
| 专属图片 2 | `public/assets/chapter1/images/lucifer_awaken_reveal_ending.png`（睁眼惊看舱群） |

触发条件必须全部满足：

- `targetNpc === "lucifer"`。
- `state.locationId === "naming_stone_bank"`。
- `state.timeOfDay === "night"`。
- `state.npcRelations.lucifer.affinity >= 100`。
- `state.inventory.includes("resonance_lucifer_star")`。
- 已完成以下任一隐藏前置：
  - `state.sceneActionIds.includes("interact_lucifer_rowing")`；或
  - `state.hiddenTopicIds.includes("topic_lucifer_boundary")`。
- `!state.luciferAwakenClaimed`。

触发时机使用仅针对路西法的结局快速路径，不重排其他 NPC 的公共结算：

```text
updateWorldMinds
→ applyNpcAffinity
→ 规则层识别并写入 hiddenTopicIds
→ canTriggerLuciferAwaken
→ 若命中：单次非流式 Agent 调用（失败则本地路西法 fallback）
→ triggerLuciferAwaken + checkAndUnlockAchievements
→ 立即返回 ending 响应
→ 若未命中：继续现有注视 / 工具 / 普通失败 / Agent / AP / 奖励流程
```

- 该快速路径位于神明注视、禁忌工具、普通失败、赠礼、AP 和时段结算之前。
- 结局回复使用普通 JSON，不再为最后一句启动 SSE，避免为一次性过场复制流式协议。
- 若 Provider 缺配置、超时、非法输出或被现有失败拦截器判为不可展示，快速路径不得返回 `state:null`；改用 `getAngelFallbackLine("lucifer")` 或专属固定句后继续触发。
- 响应保留路西法本次回复，并带 `endingTriggered: "lucifer_awaken"`。

隐藏入口 A：逆流划水

- 在 `SCENE_ACTIONS` 增加 `interact_lucifer_rowing`。
- 新增共享纯规则函数 `isSceneActionAvailable(action, state)`；前端显示和 `/api/world/tool` 必须调用同一函数。
- 该动作校验：四河分流、夜晚、路西法与玩家同场、路西法好感至少 100、游戏未结束、`sceneActionIds` 尚未包含本动作。
- 伪造请求或重复请求由工具 API 拒绝，不能只依赖前端隐藏。
- 成功后写入 `sceneActionIds`，由现有规则解锁 `mark_hidden_operation`。
- 玩家可见反馈：
  - “你没有顺着四道水流前进，而是把身体横在水面，慢慢拨动第五道倒影。路西法看着你，第一次没有发问。”

隐藏入口 B：边界对话

- 路西法好感至少 100 时，输入命中“边界、真假、醒来、外面、梦”等语义。
- 规则层以去重方式向新增 `hiddenTopicIds` 写入 `topic_lucifer_boundary`，不得依赖 Agent 自行输出 topic ID。
- 由现有规则解锁 `mark_hidden_dialog`。

过场图构图：

- 按用户明确要求，以《黑客帝国》中“现实人类躯体由外部培养舱承载、意识体验构造世界”的缸中之脑设定作为概念参照；不复制演员、电影具体培养舱、服装、Logo、绿色代码雨或原镜头构图。
- 视觉主体为一名现实人类主角在透明意识培养舱中骤然苏醒：双眼清楚睁开，带克制的惊讶与迷茫，转头观察周围舱群而非只凝视蛇影；一只手触碰弧形舱壁寻找出口。身体由生命介质、半透明膜、冷凝水、构图和暗部庄重遮挡，不色情、不血腥。
- 舱体保留 EDEN 原生种子 / 果实 / 水滴轮廓，但增加可读的生命维持结构、柔性神经连接、树根与河网状发光线缆，使其比旧版更接近真实外层装置。
- 蛇不再是舱内实体。蛇形青蓝光影只作为舱壁上正在消散的虚拟倒影，与破碎伊甸和第五道水流重叠，明确它是人类玩家在园中借用的代理形态。
- 黑暗远景排列多组不同尺度的透明意识舱，可有模糊的人类轮廓，说明外层系统并非只承载一个意识；不得复制参考电影的舱型与排列镜头。
- 一粒暖白晨星光屑保留路西法识别点；色调保持青绿、冷蓝、深紫与少量生命维持暖光。
- 不做血腥人体实验，不显示伤口或器官；女人与路西法不在培养舱中。现实玩家是舱中人类，女人仍是伊甸内主要 AI 智能体。
- 该隐藏结局明确揭示“现实人类通过蛇形代理进入伊甸”，但不公开外层组织、时代、舱群用途或蛇形代理为何被选中，给后续章节保留空间。
- 两张图组成连续镜头：第 1–3 段使用第一张，主角刚恢复知觉、蛇形代理仍清晰；第 4–5 段切换第二张，主角完全睁眼并惊讶观察周围舱群，蛇影退为次要残像。
- 本文档是 `design/01_world_bible.md` 中“路西法隐藏结局为机密”的内部展开。实现时只需在世界圣经机密条目补一句身份边界说明，不把具体触发条件或培养舱画面泄露到公开角色文档和未解锁图鉴。

过场文案：

1. 路西法在水面上映出第五道倒影——那不是水，是一面镜。
2. “你有没有想过，为什么园子里的一切，都恰好为你而存在？”
3. 他把一片晨星的光屑放进你手里。世界像一层薄幕，从边缘缓缓卷起。
4. 你看见了：没有园子，没有河。透明的意识舱在黑暗中延伸；最近的一只舱里，一个人正睁开眼。玻璃上，蛇形的光影从他的掌心褪去。
5. 你选择醒来。伊甸在你身后熄灭，像一盏被吹灭的灯。

## 5. 状态与规则设计

### 5.1 类型扩展

`WorldEndingId` 新增：

```ts
| "michael_slay"
| "lucifer_awaken"
```

`AchievementId` 新增：

```ts
| "mark_michael_slay"
```

`EdenWorldState` 新增：

```ts
michaelSlayClaimed: boolean;
luciferAwakenClaimed: boolean;
hiddenTopicIds: string[];
```

两个 claimed 字段初始为 `false`，`hiddenTopicIds` 初始为 `[]`。

### 5.2 存档兼容

新增字段必须在所有状态入口补默认值并深拷贝：

- `initialEdenWorldState`。
- `withNpcWorldDefaults`。
- `/api/world` 的 `cloneWorldState`。
- `/api/world/tool` 的 `cloneWorldState`。
- `normalizePuzzleState` 与 `cloneWorldStateForPuzzle`。
- `src/app/world/page.tsx` 内的 `normalizeWorldStateForClient`。
- `src/hooks/useWorldSave.ts` 内的 `normalizeWorldStateForClient`。

具体默认值：

```ts
michaelSlayClaimed: state.michaelSlayClaimed ?? false
luciferAwakenClaimed: state.luciferAwakenClaimed ?? false
hiddenTopicIds: [...(state.hiddenTopicIds ?? [])]
```

不得假定只有附件列出的四个 normalize 入口；以当前源码的全部 clone/normalize 为准。验收必须分别覆盖手动存档槽、自动存档、旧单存档迁移和已结束存档。

### 5.3 触发函数

`src/game/world/endingTriggers.ts` 保留 `triggerEscapeEden` 并新增：

```ts
triggerMichaelSlay(state)
triggerLuciferAwaken(state)
```

二者共同写入：

```ts
state.phase = "ending";
state.isEnded = true;
state.endingId = <endingId>;
state.<claimedFlag> = true;
```

并以去重方式写入对应印记。触发判定仍放在调用端，函数只负责原子化提交结局状态。

米迦勒路由伪流程：

```text
updateWorldMinds
→ applyNpcAffinity
→ 若 target=michael 且 delta<0 且 newAffinity=0 且未 claimed
→ triggerMichaelSlay + checkAndUnlockAchievements
→ 立即返回 ending 响应
```

当前 `updateWorldMinds` 发生在好感结算前，因此本次低语的通用心智变化会保留；从 `applyNpcAffinity` 之后起，不再执行 Agent、注视、工具、奖励、AP 或时段结算。

### 5.4 响应类型

服务端 `WorldResponseBody.endingTriggered` 与前端 `WorldAgentResponse.endingTriggered` 扩展为：

```ts
"eve_eats_fruit"
| "god_arrives"
| "michael_slay"
| "lucifer_awaken"
```

`escape_eden` 由谜题 API 返回的 `state.endingId` 驱动，不要求伪造 world Agent 响应；前端必须对所有进入 ending 的状态统一启动过场。

## 6. 过场播放设计

新增聚焦组件：

```text
src/components/world/HiddenEndingCinematic.tsx
```

建议新增内容表：

```text
src/content/world/hiddenEndings.ts
```

内容表按 ending ID 提供：

- `title`
- `frames: { image; imageAlt; startBeat }[]`
- `tone`
- `beats`

播放规则：

1. `state.phase === "ending"` 且 ending ID 属于三条隐藏结局时显示全屏过场。
2. 首次进入从第 1 段开始；点击画面、Enter 或 Space 推进。
3. 提供“跳过过场”按钮，不能强迫评委等待动画。
4. 最后一段后进入现有 `EndingReview`。
5. 重新开始时重置本地过场进度。
6. 当前帧图片 `onError` 后隐藏破图节点，保留对应 tone 的 CSS 背景和全部文案；进入后续帧时仍尝试加载其图片。
7. 尊重 `prefers-reduced-motion`，减少淡入淡出但不删除内容。

三条过场至少各有一个完整全屏场景；加百列与米迦勒各一张，路西法按用户确认使用两张连续 CG，并在第 4 段文案切帧。

## 7. 复盘与图鉴

### 7.1 EndingReview

新增分支：

- `michael_slay`：标题“剑下之责”，模块 4 使用“为何失败”。
- `lucifer_awaken`：标题“被命名之前”，模块 4 使用“为何能走到这里”。
- `escape_eden` 保持“园外的清晨”。

专属过场文案与复盘摘要不要重复成同一段；复盘强调条件和玩家路径。

`michael_slay` 模块 1 独立复盘叙事：

1. 河面恢复平静时，你的声音已不在园中。
2. 米迦勒把剑归鞘，没有胜者的欢欣。边界只是重新合拢。
3. 守护者并非因愤怒动手；他只是让每一次威胁终于承担了后果。

`michael_slay` 模块 4 `failureReasons`：

- 你一次次以命令或威胁消耗米迦勒最后的容忍。
- 本次低语让米迦勒对你的好感归于零。
- 你没有在守门者拔剑前改变自己的说话方式。

`lucifer_awaken` 模块 1 独立复盘叙事：

1. 河水仍在流，而你已经听不见它。
2. 路西法留在第五道倒影之外，像一颗尚未坠落的晨星。
3. 你醒来的地方没有名字，也没有神话。你第一次看见自己留在园外的人类身体。
4. 伊甸没有被毁灭；它只是失去了让你相信它是真实的那层光。

`lucifer_awaken` 模块 4 summary：

> 你在四河分流的夜色里取得晨星碎片，又通过逆流划水或边界之问，让路西法确认你已准备好看见第五道倒影。使你醒来的不是一句暗号，而是你先完成了对园子真实性的怀疑。

### 7.2 traceRules

固定关键转折：

`michael_slay`：

1. 你一次次以威胁试探米迦勒。
2. 米迦勒对你的最后一点容忍归于零。
3. 守门者拔出了象征后果的剑。

`lucifer_awaken`：

1. 路西法愿意向你显露第五道倒影。
2. 晨星碎片照见了伊甸看不见的边界。
3. 你从培养舱中醒来，识破了被观测的园子。

### 7.3 EndingsGallery

新增：

- `michael_slay`，type=`failure`，解锁后标题“守门者之剑”，描述：“你一次次以威胁试探伊甸之河的守护者。最后一点容忍归于零时，米迦勒让边界之后的后果真正降临。”
- `lucifer_awaken`，type=`special`，解锁后标题“缸中之醒”，描述：“晨星碎片照亮第五道倒影。你看见伊甸只是意识经历的园子，也看见了培养舱中的人类身体与正在消散的蛇形代理。”

未达成时继续显示“尚未达成的结局”，不提前暴露隐藏标题和描述。

### 7.4 Achievement

- `mark_michael_slay`：名称“守门者之剑”，category=`ending`，hidden=`true`。
- `mark_hidden_ending` 改为以 `state.endingId === "lucifer_awaken"` 解锁，不再依赖不存在的 `trigger_lucifer_hidden_ending`。
- `mark_escape_eden` 保持现状。

`NORMAL_ENDING_IDS` 必须保持：

```ts
["eve_eats_fruit", "god_arrives", "life_fruit"]
```

跨局追踪继续记录所有非空 `endingId`，因此三条隐藏结局会自动进入 `triggeredEndingIds`。

新增米迦勒印记前，当前四类数量为探索 6、交互 9、玩法 7、结局 6，总数 28。新增后调整为探索 6、交互 9、玩法 7、结局 7，总数 29。实现时必须同步：

- `design/ACHIEVEMENT_GARDEN_MARK.md` 的总数、分类表和米迦勒印记说明。
- `doc/AI_ASSET_RECORD.md` 的印记数量与视觉资产总览。
- `README.md`、`docs/PROJECT_CONTEXT.md` 和活跃提交材料中仍写“28 枚园中印记”的当前口径。
- 静态 smoke、图鉴统计和任何硬编码分类计数。

历史归档和已完成旧任务文档不追溯改写，只同步当前权威与活跃提交材料。

## 8. 视觉资产规格

### 8.1 共同规格

- 1920×1080 PNG。
- 16:9 横版，适配全屏 cover。
- 暗色电影感数字绘画，半写实神话/超现实质感。
- 无文字、无 Logo、无水印。
- 主体和关键叙事信息避开画面最底部中央，给过场字幕保留暗部空间。
- 场景图不要求透明背景。

### 8.2 米迦勒印记图标

- 512×512 PNG，透明或深色易裁切背景。
- 与现有水彩/手绘园中印记风格一致。
- 图形：冷白剑光切过水纹盾，边缘一点暗红，不出现文字。

### 8.3 资产注册

`CHAPTER1_IMAGES` 新增：

```ts
escapeEdenEnding
michaelSlayEnding
luciferAwakenEnding
```

前端隐藏结局不得再引用 Chapter 0 普通结局图作为最终背景。

## 9. 异常处理

- 米迦勒结局不依赖 LLM；一旦规则条件成立必须稳定触发。
- 路西法结局允许本地 fallback 回复完成后触发，避免网络故障断线。
- 伪造 `interact_lucifer_rowing` 请求时，地点、昼夜、好感或 NPC 状态不满足则服务端拒绝。
- 三条结局都必须经过 `isEnded`/claimed guard，杜绝重复奖励和重复写入。
- 已结束状态的 world、tool、puzzle 请求继续被拒绝。
- 过场图失败不影响文案和复盘；音频失败静默降级。
- 若测试发现与本功能直接相关的小范围非核心问题，可在不扩大规则范围的前提下修复；玩法决策和大范围重构另行记录并交给 CodeBuddy。

已结束状态沿用各 API 当前契约，不强行统一：

| API | 预期契约 |
| --- | --- |
| `POST /api/world` | HTTP 200、`ok:true`、返回未变化的 ending state，不继续结算 |
| `POST /api/world/tool` | HTTP 200、`ok:false`、返回当前 state 与拒绝原因 |
| `POST /api/world/puzzle` | HTTP 409、`ok:false`、拒绝已结束状态继续答题 |

新测试必须分别断言 status、`ok` 和 state，而不是只写“操作被拒绝”。

## 10. 测试与验收

### 10.1 规则与 API

- 米迦勒：负向低语使好感从正数降到 0，立即触发 `michael_slay`。
- 米迦勒：好感未归零、`delta >= 0`、目标为其他 NPC 均不触发。
- 米迦勒：触发后 Agent、注视、AP、奖励和时段不再结算。
- 路西法：完整条件 + 划水前置触发 `lucifer_awaken`。
- 路西法：完整条件 + 边界对话前置触发 `lucifer_awaken`。
- 路西法：地点、夜晚、好感、晨星碎片、隐藏前置任缺一项均不触发。
- 路西法：Agent 失败走 fallback 时仍可触发。
- 加百列：有火焰剑 + 东园幽径挣脱选项触发 `escape_eden`；无火焰剑维持失败反馈。
- 三条结局触发后，world/tool/puzzle 后续操作被拒绝。

### 10.2 存档

- 旧存档缺两个 claimed 字段时补 `false`。
- 旧存档缺 `hiddenTopicIds` 时补空数组。
- 结局存档读回后仍停留在 ending。
- 新增字段在 world route、tool route、puzzle route 和客户端读档之间不丢失。
- 手动槽、autosave、legacy save 和已结束存档四条读档路径分别覆盖。

### 10.3 成就与图鉴

- `mark_michael_slay`、`mark_hidden_ending`、`mark_escape_eden` 分别正确解锁。
- `triggeredEndingIds` 记录三条隐藏结局。
- `NORMAL_ENDING_IDS` 仍只有三项，`mark_all_ending` 计算不受隐藏结局污染。
- 未解锁图鉴不泄露隐藏标题和描述。

### 10.4 过场与资产

- 四张过场图存在、可读取、均为 1920×1080 PNG；路西法两张按第 1–3 / 4–5 段连续切换。
- 米迦勒印记图标存在并可在图鉴正常加载。
- 三条结局均先显示专属过场，再进入复盘。
- 点击、Enter、Space 和跳过按钮均可推进。
- 图片加载失败模拟下，文案和复盘仍可达。
- 桌面 1920×1080 下字幕不遮挡主体。

### 10.5 门禁

```bash
npm run typecheck
npm run lint
npm run build
node scripts/test-scene-puzzle-rules.mjs
node scripts/test-world-visual-smoke.mjs
node scripts/test-world-smoke.mjs <mock-production-url>
npm run test:e2e -- tests/e2e/chapter1-mechanics.spec.ts --project=desktop-chromium
```

如新增专门测试文件，必须加入以上门禁或 `package.json` 中可重复执行的脚本。

world smoke 的可重复执行方式：

```powershell
# 终端 A
$env:LLM_PROVIDER='mock'
npm run dev -- -p 3019

# 终端 B
node scripts/test-world-smoke.mjs http://127.0.0.1:3019
```

如 3019 已被占用，使用未占用端口并在验收报告中记录实际 URL，不得终止不属于本任务的进程。

额外检查：

- 常见明文密钥扫描。
- `doc/` 文件无删除、重命名或移动。
- 不覆盖用户现有未提交改动。
- `doc/AI_ASSET_RECORD.md` 追加四张过场图和一枚印记图标的生成工具、用途、最终路径和提示词摘要。
- Codex 测试/审查后更新 `docs/PROJECT_CONTEXT.md`，但不得写成核心开发工具。

CodeBuddy 证据链：

- 实现前创建 `doc/第一章/plan_docs/21_CODEBUDDY_TASK_CHAPTER1_THREE_ANGEL_HIDDEN_ENDINGS.md`，引用本设计并列出代码任务与验收命令。
- 核心实现、主要调试、规则修复和 UI 接入通过 CodeBuddy 完成。
- 实现后把本功能 CodeBuddy 对话索引、变更摘要和实际门禁结果追加到 `doc/submit/CodeBuddy开发对话记录.md` 或项目既定的 CodeBuddy 证据记录位置。
- Codex 只记录资产生成、独立测试和审查结论，不得取代上述实现记录。

## 11. 完成标准

- 三位天使各有一条稳定可触发的隐藏结局。
- 三条结局各有至少一个专属全屏过场场景与完整分段文案。
- 米迦勒和路西法规则由服务端权威判定，缺条件无法绕过。
- 旧存档兼容，结局状态可保存与恢复。
- 图鉴、印记、复盘和跨局追踪一致。
- 四张过场图与米迦勒印记图标可正常加载并已记录 AI 资产来源。
- typecheck、lint、build、规则测试、world smoke、桌面 e2e 全部通过。
- 没有新增明文密钥，没有破坏 CodeBuddy 主开发证据链。

## 12. 比赛展示价值

- 加百列展示“语言与信任最终成为逃离边界的钥匙”。
- 米迦勒展示“AI 叙事中的规则后果不是随机模型决定，而是可解释、可测试的安全边界”。
- 路西法把第二伊甸园外层真相转化为可玩的隐藏揭示，强化 AI 世界观与元叙事亮点。
- 四张专属过场图形成明确的 AI 视觉创作成果，可直接进入 Demo 视频、PPT 和 AI 创作说明。
