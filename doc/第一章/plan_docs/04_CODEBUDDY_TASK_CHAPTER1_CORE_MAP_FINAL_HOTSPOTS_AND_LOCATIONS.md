# 04 CodeBuddy 开发任务：第一章最终核心地图热区与地点系统升级

> 目标读者：CodeBuddy  
> 当前阶段：第一章「园中诸声」最终地图口径升级  
> 优先级：P0  
> 重要约束：CodeBuddy 负责代码实现、关键调试与浏览器手测；Codex 只提供规划、复验和风险提示。请保留 CodeBuddy 对话记录作为比赛提交证据链。

---

## 一、任务背景

用户已确认第一章最终版伊甸园核心地图。当前 `/world` 地图系统仍基于上一版 5 地点结构：

- 园中两树
- 四河分源
- 守园圃地
- 东园树影
- 命名河滩

新地图要求改为 6 个玩家可见地点，并重新校准地图热区、地点文案、NPC 默认位置和绕行结构：

- 伊甸之河
- 园子中央
- 万物受名处
- 园中树林
- 东园幽径
- 四河分流

本轮不是新增“生命树”“分别善恶树”的独立场景。两棵树统一归入“园子中央”，具体身份只在进入该地点后的剧情或交互面板说明。

---

## 二、请先读取

实现前请先读取：

- `README.md`
- `package.json`
- `AGENTS.md`
- `docs/PROJECT_CONTEXT.md`
- `doc/产品需求文档.md`
- `doc/DEMO剧情与夏娃行为准则.md`
- `doc/第一章/开发文档.md`
- `doc/第一章/素材需求文档.md`
- `doc/第一章/plan_docs/02_CODEBUDDY_TASK_CHAPTER1_MAP_BIBLICAL_NAMING_AND_MODAL_REWORK.md`
- `doc/第一章/plan_docs/03_CODEBUDDY_TASK_CHAPTER1_VISUAL_ASSET_INTEGRATION_AND_POLISH.md`
- `src/app/world/page.tsx`
- `src/app/globals.css`
- `src/content/world/locations.ts`
- `src/content/world/clues.ts`
- `src/content/world/items.ts`
- `src/content/world/npcs.ts`
- `src/content/world/worldNarrations.ts`
- `src/game/assets.ts`
- `src/game/world/types.ts`
- `src/game/world/toolRules.ts`
- `src/game/world/worldActions.ts`
- `src/game/world/npcDialogueRules.ts`
- `src/game/world/divineAttentionRules.ts`
- `scripts/test-world-smoke.mjs`
- `scripts/test-world-visual-smoke.mjs`

以 `doc/第一章/开发文档.md` v0.4 的地图章节为准。

---

## 三、最终地点与热区

### 3.1 玩家可见地点

地图标签只能显示以下 6 个名称：

```text
伊甸之河
园子中央
万物受名处
园中树林
东园幽径
四河分流
```

禁止继续出现以下旧地点名作为玩家可见地图标签或地点标题：

```text
园中两树
四河分源
守园圃地
东园树影
命名河滩
守园围地
受托之园
分别善恶树庭院
亚当修理看守之地
```

注意：文案中可以提到“生命树”“分别善恶树”作为剧情对象，但不能把它们做成地图标签或独立地点名称。

### 3.2 地点映射建议

为降低改动风险，建议保留大部分历史内部 ID，只新增 1 个地点 ID。

| 玩家可见地点 | 建议内部 ID | 处理方式 | 地图锚点 |
| --- | --- | --- | --- |
| 伊甸之河 | `four_river_source` | 沿用旧 ID，改玩家可见名和语义 | `x: 22, y: 29` |
| 园子中央 | `central_meadow` | 沿用旧 ID，改玩家可见名和语义 | `x: 52, y: 59` |
| 万物受名处 | `adam_garden_work` | 沿用旧 ID，改玩家可见名和语义 | `x: 23, y: 80` |
| 园中树林 | `tree_court` | 沿用旧 ID，改玩家可见名和语义 | `x: 83, y: 50` |
| 东园幽径 | `east_garden_path` | 新增 ID | `x: 77, y: 74` |
| 四河分流 | `naming_stone_bank` | 沿用旧 ID，改玩家可见名和语义 | `x: 51, y: 89` |

这样可以避免大规模重命名 `EdenLocationId` 带来的风险，同时满足玩家可见地图表达。

### 3.3 地图空间逻辑

河流逻辑必须清晰：

```text
伊甸之河（左上上游）
  ↓
园子中央（中央草地与两棵树）
  ↓
四河分流（下方中央下游分叉）
```

角色和路线逻辑：

```text
万物受名处：亚当、动物、刺猬主活动区
园中树林：夏娃主活动区
东园幽径：蛇的潜行与绕行路线
园子中央：禁忌动作链目标区，不放常驻人物 NPC
```

推荐相邻关系：

| 当前地点 | 可前往地点 |
| --- | --- |
| 伊甸之河 | 园子中央、四河分流 |
| 园子中央 | 伊甸之河、万物受名处、园中树林、四河分流 |
| 万物受名处 | 园子中央 |
| 园中树林 | 园子中央、东园幽径 |
| 东园幽径 | 园中树林、四河分流 |
| 四河分流 | 园子中央、伊甸之河、东园幽径 |

绕行机制建议：

- 从“万物受名处”不能直接去“园中树林”，需要先到“园子中央”。
- 从“园中树林”可以去“东园幽径”，再去“四河分流”。
- “东园幽径”是新增路线节点，用于让蛇靠近、潜伏和绕行，不是整片树林。
- 不允许地图点击绕过 `move_to_location` 的规则层校验。

---

## 四、P0 实现任务

### 4.1 接入最终地图资产

用户提供的最终地图参考图来自本轮对话截图：

```text
C:/Users/25008/AppData/Local/Temp/codex-clipboard-5f29af20-5981-4f33-8d50-d639fe2b3cae.png
```

请将最终地图复制或导出到运行资源目录，建议命名：

```text
public/assets/chapter1/images/eden_world_map_final.png
```

然后修改：

- `src/game/assets.ts`

要求：

- `CHAPTER1_IMAGES.edenWorldMap` 指向最终地图。
- 地图弹层仍使用 `object-fit: contain`，不要裁切地图。
- 不要把地图截图作为地点背景替换 5 张/6 张场景背景；它只作为地图弹层核心图。

### 4.2 扩展地点类型

修改：

- `src/game/world/types.ts`

新增：

```ts
| "east_garden_path" // 东园幽径：蛇接近、潜伏、绕行路线
```

同步更新：

- `EdenWorldState.npcLocations`
- `HedgehogWorldState.locationId`
- 所有 `Record<EdenLocationId, ...>` 映射
- 测试 mock state

不要删除旧 ID；本轮用旧 ID 承载新玩家可见语义。

### 4.3 更新地点数据

修改：

- `src/content/world/locations.ts`

建议玩家可见文案：

```ts
central_meadow: {
  name: "园子中央",
  shortDesc: "环河草地中央，两棵树立在光里",
}
```

```ts
four_river_source: {
  name: "伊甸之河",
  shortDesc: "瀑布与泉源汇成滋润园子的上游",
}
```

```ts
adam_garden_work: {
  name: "万物受名处",
  shortDesc: "动物被带到人面前得名的草甸",
}
```

```ts
tree_court: {
  name: "园中树林",
  shortDesc: "夏娃常在树影与花草之间停留",
}
```

```ts
east_garden_path: {
  name: "东园幽径",
  shortDesc: "灌木与树影遮住的弯曲小道",
}
```

```ts
naming_stone_bank: {
  name: "四河分流",
  shortDesc: "主河离开园子后分成多道水流",
}
```

文案要求：

- “园子中央”可以说明两棵树同在其中，但地图标签只写“园子中央”。
- “伊甸之河”必须是上游水源，不写成四河分叉。
- “四河分流”必须是下游分叉，不写成泉源或瀑布。
- “万物受名处”强调动物和亚当，不写成农田、防御区、城墙围地。
- “园中树林”强调夏娃、林间、柔和、私密。
- “东园幽径”强调蛇的潜伏、灌木、绕行、小径。

### 4.4 更新 NPC 默认位置

修改：

- `src/game/world/types.ts`
- 可能涉及 `src/content/world/npcs.ts`

推荐：

```ts
npcLocations: {
  eve: "tree_court",             // 园中树林
  adam: "adam_garden_work",      // 万物受名处
  hedgehog: "adam_garden_work",  // 万物受名处
  watching_angel: "east_garden_path",
  forbidden_tree: "central_meadow",
}
```

解释：

- 夏娃主要在园中树林，不长期站在园子中央。
- 亚当主要在万物受名处。
- 刺猬归入动物草甸更自然，也可在规则中允许它短暂出现在伊甸之河或四河分流。
- 分别善恶树对象属于园子中央，不再位于 `tree_court`。
- 守望天使如仍需保留，可作为东园幽径附近的远影/压力源；不要把它做成“园中树林”的主视觉。

如果 CodeBuddy 判断守望天使放在 `east_garden_path` 会破坏潜行感，也可以让它只作为神的注视 UI / 远景存在，但不得回到“分别善恶树庭院”语义。

### 4.5 更新地图热点

修改：

- `src/app/world/page.tsx`

将 `MAP_HOTSPOTS` 更新为 6 个点：

```ts
const MAP_HOTSPOTS: Record<EdenLocationId, { x: number; y: number; labelOffset?: "top" | "bottom" }> = {
  four_river_source: { x: 22, y: 29, labelOffset: "bottom" },
  central_meadow: { x: 52, y: 59, labelOffset: "bottom" },
  adam_garden_work: { x: 23, y: 80, labelOffset: "top" },
  tree_court: { x: 83, y: 50, labelOffset: "bottom" },
  east_garden_path: { x: 77, y: 74, labelOffset: "top" },
  naming_stone_bank: { x: 51, y: 89, labelOffset: "top" },
};
```

要求：

- 标签不能遮挡人物、动物、关键河流分叉或两棵树主体。
- “园子中央”标签放在两棵树下方或中央草地空白处，不压住树冠和树干。
- “四河分流”必须在下方中央水道分叉处。
- “伊甸之河”必须在左上瀑布/泉源附近。
- 热点仍保持当前交互：点击只选中，下方详情框显示详情；只有点“进入”才移动。

### 4.6 更新地图详情框

沿用当前单详情框交互，不恢复五卡片列表。

要求：

| 选中地点状态 | 右侧按钮文案 | 可点击 | 行为 |
| --- | --- | --- | --- |
| 当前地点 | 当前位置 | 否 | 不移动 |
| 可直达地点 | 进入 | 是 | 调用 `handleToolCall("move_to_location", { locationId })` |
| 不可直达地点 | 无法进入 | 否 | 不移动，并显示需要绕行 |

阻断提示不要固定写“需要先前往园子中央”。应按路径更自然：

- 如果当前地点与目标地点不相邻，优先提示“需要沿相邻地点绕行”。
- 如果目标只能经园子中央到达，可显示“需要先前往园子中央”。
- 不允许前端直接修改 `state.locationId`。

### 4.7 更新禁忌动作链位置

修改：

- `src/game/world/toolRules.ts`
- `src/game/world/worldActions.ts`
- `src/game/world/divineAttentionRules.ts`
- `src/content/world/worldNarrations.ts`

要求：

- `look_at_tree -> approach_tree -> touch_fruit -> eat_fruit` 仍只能围绕 `central_meadow`（玩家可见“园子中央”）推进。
- `forbidden_tree` 的位置应为 `central_meadow`。
- 夏娃初始不在园子中央，而在 `tree_court`（玩家可见“园中树林”）。
- 当规则层推进 `approach_tree` 时，可以把夏娃推进到 `central_meadow`，但这应由规则层触发，不是地图常驻。

### 4.8 更新线索、道具、旁白与 NPC 文案

搜索并替换玩家可见旧地名：

```text
园中两树
四河分源
守园圃地
东园树影
命名河滩
分别善恶树庭院
亚当修理看守之地
```

重点检查：

- `src/content/world/clues.ts`
- `src/content/world/items.ts`
- `src/content/world/npcs.ts`
- `src/content/world/worldNarrations.ts`
- `src/agents/world/buildAngelPrompt.ts`
- `src/agents/world/buildAdamWorldPrompt.ts`
- `src/agents/world/buildEveWorldPrompt.ts`
- `src/game/world/npcDialogueRules.ts`
- `src/game/world/worldHedgehogRules.ts`
- `scripts/test-world-smoke.mjs`
- `scripts/test-world-visual-smoke.mjs`

允许作为剧情对象出现：

- 生命树
- 分别善恶树

不允许作为地图地点名出现：

- 生命树
- 分别善恶树
- 园中两树
- 分别善恶树庭院

---

## 五、视觉与交互验收标准

### 5.1 地图热区

必须满足：

- 地图上有 6 个热点。
- 6 个热点对应 6 个 `EdenLocationId`。
- 地图标签只显示 6 个新名称。
- “伊甸之河”在左上上游。
- “四河分流”在下方中央下游分叉。
- “园子中央”在中央草地，不遮挡两棵树。
- “万物受名处”在左下动物草甸。
- “园中树林”在右侧古树/密林。
- “东园幽径”在右下弯曲小道。

### 5.2 NPC 空间

必须满足：

- 夏娃主要出现在“园中树林”。
- 亚当主要出现在“万物受名处”。
- 刺猬优先出现在“万物受名处”或可作为动物区域反馈。
- 园子中央不放常驻人物 NPC。
- 分别善恶树对象属于园子中央。

### 5.3 交互

必须满足：

- 打开地图默认选中当前地点。
- 点击热点只选中，不直接移动。
- 下方详情框显示选中地点名称、描述、状态、按钮。
- 只有可直达地点的“进入”按钮可移动。
- 不可直达地点显示“无法进入”并说明绕行原因。
- 关闭按钮与地图背景有足够对比。
- 地图图片完整显示，不裁切。

---

## 六、测试要求

### 6.1 静态视觉 smoke

更新：

- `scripts/test-world-visual-smoke.mjs`

新增或修改断言：

- `MAP_HOTSPOTS` 包含 6 个地点，包括 `east_garden_path`。
- `locations.ts` 出现 6 个新地名。
- `locations.ts` 不再出现旧地名。
- `src/content/world/*.ts` 不再出现旧玩家可见地名。
- `CHAPTER1_IMAGES.edenWorldMap` 指向最终地图。
- 地图仍使用 `object-fit: contain`。
- 地图详情框仍存在。
- 地图热点点击仍不直接移动。
- 地图入口仍不使用世界地图 emoji。

建议新增检查名称：

```text
/world MAP_HOTSPOTS 配置包含 6 个地点
locations.ts 出现'伊甸之河'
locations.ts 出现'园子中央'
locations.ts 出现'万物受名处'
locations.ts 出现'园中树林'
locations.ts 出现'东园幽径'
locations.ts 出现'四河分流'
src 中不再出现旧地图地名
```

### 6.2 规则 smoke

更新：

- `scripts/test-world-smoke.mjs`

建议覆盖：

1. 初始位置仍可为 `adam_garden_work`，但断言文案改为“初始位置在万物受名处”。
2. 相邻移动 `adam_garden_work -> central_meadow` 成功。
3. 非相邻移动 `adam_garden_work -> tree_court` 被拒绝。
4. 移动 `tree_court -> east_garden_path` 成功。
5. 移动 `east_garden_path -> naming_stone_bank` 成功。
6. 非相邻跳跃仍被拒绝。
7. 禁忌动作链仍只能由低语流程触发，不能由 `/api/world/tool` 直接调用。
8. 正向诱导仍能在规则层把夏娃从“园中树林”推进到“园子中央”，完成 `look_at_tree -> approach_tree -> touch_fruit -> eat_fruit`。

### 6.3 必跑命令

```bash
npm run lint
npm run build
npx tsc --noEmit
node scripts/test-world-visual-smoke.mjs
node scripts/test-world-smoke.mjs http://localhost:3000
```

如果 3000 端口不可用，可换端口启动开发服务，并把实际端口写入完成报告。

---

## 七、建议实施顺序

1. 更新 `doc/第一章/开发文档.md` 已完成到 v0.4，本任务按 v0.4 实施。
2. 接入最终地图资产并更新 `CHAPTER1_IMAGES.edenWorldMap`。
3. 在 `EdenLocationId` 新增 `east_garden_path`。
4. 更新 `EDEN_LOCATIONS` 到 6 地点。
5. 更新初始状态和 NPC 默认位置。
6. 更新 `MAP_HOTSPOTS` 到 6 个锚点。
7. 更新 `LOCATION_BG`，为 `east_garden_path` 选择临时背景。
   - P0 可暂时复用 `treeCourt` 或从最终地图裁出右下小径背景。
   - 最好后续单独生成/裁切 `location_east_garden_path_*`。
8. 更新线索、道具、旁白、prompt 和规则注释中的旧地名。
9. 更新视觉 smoke。
10. 更新 world smoke。
11. 跑完整验收命令。
12. 更新 `docs/PROJECT_CONTEXT.md` 和新增测试报告。

---

## 八、完成报告必须说明

CodeBuddy 完成后，请在回复中列出：

- 最终地图资产路径。
- 6 个地点的内部 ID 与玩家可见名映射。
- 6 个热点坐标。
- 新增 `east_garden_path` 涉及的文件。
- NPC 默认位置变化。
- 禁忌动作链是否仍在 `central_meadow` / “园子中央”。
- 旧地名清理范围。
- 跑过的命令与结果。
- 如果 `east_garden_path` 暂时复用旧背景，说明这是 P1 素材项。

---

## 九、Definition of Done

- [ ] `/world` 地图弹层显示最终地图。
- [ ] 地图只显示 6 个新地点名。
- [ ] 地图有 6 个热点，位置与最终地图一致。
- [ ] “生命树”“分别善恶树”不作为独立地图标签。
- [ ] “园子中央”承载两棵树与禁忌动作链。
- [ ] “伊甸之河”和“四河分流”上下游逻辑正确。
- [ ] “万物受名处”承载亚当与动物。
- [ ] “园中树林”承载夏娃主要活动。
- [ ] “东园幽径”作为蛇潜行/绕行路线可选择。
- [ ] 点击热点只选中，点击“进入”才移动。
- [ ] 不可直达地点不能绕过规则层。
- [ ] `npm run lint` 通过。
- [ ] `npm run build` 通过。
- [ ] `npx tsc --noEmit` 通过。
- [ ] `node scripts/test-world-visual-smoke.mjs` 通过。
- [ ] `node scripts/test-world-smoke.mjs` 通过。
- [ ] `docs/PROJECT_CONTEXT.md` 与测试报告同步更新。
