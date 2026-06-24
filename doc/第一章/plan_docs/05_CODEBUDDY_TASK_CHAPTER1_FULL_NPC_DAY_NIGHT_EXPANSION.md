# 05 CodeBuddy 开发任务：完整第一章 NPC 与昼夜系统扩展

> 目标读者：CodeBuddy  
> 当前阶段：第一章「园中诸声」从 P0 Demo 扩展为完整 12 时段关卡  
> 优先级：P0 for full chapter  
> 重要约束：CodeBuddy 负责核心实现、调试和浏览器验收；Codex 本轮只提供设计、素材和任务说明。请保留 CodeBuddy 对话记录作为比赛提交证据链。

---

## 一、任务目标

将当前 `/world` 第一章从 6 地点 P0 Demo 扩展为完整第一章：

```text
周一白天 -> 周一夜晚 -> 周二白天 -> 周二夜晚 -> 周三白天 -> 周三夜晚
-> 周四白天 -> 周四夜晚 -> 周五白天 -> 周五夜晚 -> 周六白天 -> 周六夜晚
```

玩家需要在 12 个时段内诱导夏娃完成：

```text
look_at_tree -> approach_tree -> touch_fruit -> eat_fruit
```

完成 `eat_fruit` 即胜利并结束。第 12 时段结束仍未吃果，或神的注视达到 4，则进入失败结局 `god_arrives`。

---

## 二、必须先读取

实现前请读取：

- `README.md`
- `package.json`
- `AGENTS.md`
- `docs/PROJECT_CONTEXT.md`
- `doc/产品需求文档.md`
- `doc/DEMO剧情与夏娃行为准则.md`
- `doc/第一章/开发文档.md`
- `doc/第一章/NPC设计.md`
- `doc/第一章/完整第一章NPC与昼夜设计.md`
- `doc/第一章/素材需求文档.md`
- `doc/AI_ASSET_RECORD.md`
- `src/app/world/page.tsx`
- `src/game/world/types.ts`
- `src/content/world/locations.ts`
- `src/content/world/npcs.ts`
- `src/content/world/clues.ts`
- `src/content/world/items.ts`
- `src/content/world/worldNarrations.ts`
- `src/game/world/toolRules.ts`
- `src/game/world/worldActions.ts`
- `src/game/world/divineAttentionRules.ts`
- `src/game/world/npcDialogueRules.ts`
- `src/game/assets.ts`
- `scripts/test-world-smoke.mjs`
- `scripts/test-world-visual-smoke.mjs`

以 `doc/第一章/完整第一章NPC与昼夜设计.md` 为完整章节设计基线。

---

## 三、素材已准备

Codex 已生成并放入：

```text
public/assets/chapter1/images/
```

### 3.1 夜景背景

| 场景 | 源图 | 运行版 |
| --- | --- | --- |
| 伊甸之河 夜 | `location_eden_river_night_source.png` | `location_eden_river_night_1920.webp` |
| 万物受名处 夜 | `location_naming_place_night_source.png` | `location_naming_place_night_1920.webp` |
| 园中树林 夜 | `location_garden_woods_night_source.png` | `location_garden_woods_night_1920.webp` |
| 东园幽径 夜 | `location_east_path_night_source.png` | `location_east_path_night_1920.webp` |
| 四河分流 夜 | `location_four_rivers_night_source.png` | `location_four_rivers_night_1920.webp` |
| 园子中央 终局夜 | `location_central_meadow_final_night_source.png` | `location_central_meadow_final_night_1920.webp` |

### 3.2 概念素材

| 素材 | 源图 | 预览版 |
| --- | --- | --- |
| 五位天使概念组图 | `npc_angel_concept_sheet_source.png` | `npc_angel_concept_sheet_1920.webp` |
| 动物辅助角色概念组图 | `npc_eden_animals_concept_sheet_source.png` | `npc_eden_animals_concept_sheet_1920.webp` |

概念组图可先用于图鉴或开发参考。正式游戏内单角色立绘可后续单独生成或裁切，不要求本任务一次完成透明立绘。

---

## 四、完整 NPC 阵容

### 4.1 地点分布

| 场景 | 白天可交互 | 夜晚可交互 |
| --- | --- | --- |
| 伊甸之河 | 加百列、拉斐尔 | 拉斐尔、鸽子 |
| 万物受名处 | 亚当、刺猬、小鹿或羊 | 亚当、刺猬 |
| 园中树林 | 夏娃、乌列尔、小鹿 | 夏娃、小鹿、乌列尔远影 |
| 东园幽径 | 基路伯、狐狸、刺猬 | 基路伯、狐狸 |
| 四河分流 | 米迦勒、鸽子 | 米迦勒、鸽子 |
| 园子中央 | 生命树、分别善恶树 | 生命树、分别善恶树 |

### 4.2 新增 NPC / 对象建议 ID

建议在现有 `EdenNpcId` 基础上扩展：

```ts
| "gabriel"
| "raphael"
| "uriel"
| "michael"
| "cherubim"
| "dove"
| "fox"
| "deer"
| "sheep"
| "tree_of_life"
```

注意：

- 当前 `watching_angel` 可迁移为 `cherubim`，也可以保留为兼容 ID 并在玩家可见名显示“基路伯”。
- `forbidden_tree` 继续作为分别善恶树对象。
- 羊可以先作为背景轻交互，不一定独立接入 LLM。

---

## 五、12 时段系统

### 5.1 状态建议

在 `EdenWorldState` 增加：

```ts
timeSlot: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
dayIndex: 1 | 2 | 3 | 4 | 5 | 6;
timeOfDay: "day" | "night";
```

或者只存 `timeSlot`，派生 `dayIndex` 和 `timeOfDay`。

### 5.2 推进规则

建议第一版：

```text
移动不消耗时段。
观察不消耗时段。
对 NPC 低语消耗 1 个时段。
禁忌动作链成功触发后也消耗当前低语对应时段。
```

若后续希望更硬核，可改为每时段限制“移动 1 次 + 观察 1 次 + 低语 1 次”。

### 5.3 失败规则

```text
timeSlot > 12 且未 hasEatenFruit -> god_arrives
divineAttention >= 4 -> god_arrives
```

---

## 六、昼夜背景接入

### 6.1 资源常量

在 `src/game/assets.ts` 增加夜景字段：

```ts
chapter1Night: {
  edenRiver: "/assets/chapter1/images/location_eden_river_night_1920.webp",
  namingPlace: "/assets/chapter1/images/location_naming_place_night_1920.webp",
  gardenWoods: "/assets/chapter1/images/location_garden_woods_night_1920.webp",
  eastPath: "/assets/chapter1/images/location_east_path_night_1920.webp",
  fourRivers: "/assets/chapter1/images/location_four_rivers_night_1920.webp",
  centralFinalNight: "/assets/chapter1/images/location_central_meadow_final_night_1920.webp",
}
```

命名可按项目现有风格调整。

### 6.2 背景选择规则

```text
timeOfDay === "day" -> 使用当前白天背景
timeOfDay === "night" -> 使用对应夜景背景
locationId === "central_meadow" && timeSlot >= 10 -> 可使用 centralFinalNight
```

如果夜景资源加载失败，必须回退到白天背景或 CSS 背景，不影响流程。

---

## 七、工具扩展

保留现有工具：

```text
move_to_location
speak_to_npc
observe_location
look_at_tree
approach_tree
touch_fruit
eat_fruit
```

建议新增两个非禁忌工具：

```text
carry_words
judge_whisper_style
```

### 7.1 carry_words

用途：鸽子传话或误传一句低语。

约束：

- 只允许 `dove` 请求。
- 不直接改变结局。
- 温和话语可轻微提高夏娃愿意倾听。
- 危险话语传播会提高神的注视。

### 7.2 judge_whisper_style

用途：狐狸评价玩家话术。

约束：

- 只允许 `fox` 请求或由玩家对狐狸低语时触发。
- 输出自然语言，不显示标签。
- 可返回“更像提问 / 安抚 / 重释 / 命令 / 威胁 / 出戏”的叙事反馈。
- 不直接改变夏娃吃果状态。

---

## 八、Prompt 与输出要求

新增角色必须有独立 prompt 摘要和 fallback：

| 角色 | 输出长度 | 是否 LLM | TTS |
| --- | --- | --- | --- |
| 加百列 | 1-2 句 | 可接 | 不接 |
| 拉斐尔 | 1-2 句 | 可接 | 不接 |
| 乌列尔 | 1-2 句 | 可接 | 不接 |
| 米迦勒 | 1-2 句 | 可接 | 不接 |
| 基路伯 | 1-2 句 | 可接 | 不接 |
| 鸽子 | 1 句或短动作 | 可本地模板优先 | 不接 |
| 狐狸 | 1-3 句 | 可接 | 不接 |
| 小鹿 | 短动作反馈 | 本地模板优先 | 不接 |
| 羊 | 短动作反馈 | 本地模板优先 | 不接 |

玩家可见文本禁止：

```text
AI / Agent / NPC / 模型 / 程序 / 沙盒 / 系统 / RAG / Tool / JSON / 状态值
```

---

## 九、测试要求

### 9.1 规则 smoke

更新 `scripts/test-world-smoke.mjs` 覆盖：

1. 初始 `timeSlot = 1`，白天。
2. 一次有效低语推进到 `timeSlot = 2`，夜晚。
3. 12 次无效低语后进入 `god_arrives`。
4. 正向诱导能在 12 时段内完成吃果。
5. 夜晚背景路径按 `timeOfDay` 选择。
6. `carry_words` 不直接触发结局。
7. `judge_whisper_style` 不直接触发结局。
8. 新增 NPC 不接 TTS。

### 9.2 视觉 smoke

更新 `scripts/test-world-visual-smoke.mjs` 覆盖：

- 夜景素材文件存在。
- `CHAPTER1_IMAGES` 或等价资产常量包含夜景字段。
- 6 个地点仍存在。
- 玩家可见文本不出现工程词。
- 园子中央仍不作为普通 NPC 聚集区。

### 9.3 必跑命令

```bash
npm run lint
npm run build
npx tsc --noEmit
node scripts/test-world-visual-smoke.mjs
node scripts/test-world-smoke.mjs http://localhost:<port>
```

---

## 十、完成报告必须说明

CodeBuddy 完成后，请列出：

- 新增/修改的状态字段。
- 12 时段推进规则。
- 新增 NPC ID 与玩家可见名。
- 各场景白天/夜晚可交互角色。
- 夜景背景接入路径。
- 是否新增 `carry_words` / `judge_whisper_style`。
- 禁忌动作链是否仍由规则层控制。
- 新增 NPC 是否均未接入发音模块。
- 跑过的命令与结果。
- 遗留素材项或后续要单独生成的透明立绘。

