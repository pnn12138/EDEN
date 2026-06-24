# CodeBuddy 修复任务：第一章新增 NPC 的地图与场景可视化接入

## 背景

用户反馈：“地图中并没有接入新的 NPC”。Codex 复查确认：上一轮修复让新增 NPC 进入了数据、工具和部分 UI，但地图弹层仍只显示地点热点，不显示每个地点的 NPC；场景舞台也只渲染了部分新增角色。

当前状态：
- `src/content/world/locations.ts` 已配置 `dayNpcs / nightNpcs`。
- `src/content/world/npcs.ts` 已配置新增 NPC 元数据。
- `/world` 右侧“此处可见”列表可显示 `currentNpcs`。
- 但地图弹层没有显示 NPC。
- 场景舞台只单独渲染了 `cherubim`、`deer`、`dove`、`fox`，没有可视化 `gabriel`、`raphael`、`uriel`、`michael`、`sheep`，`tree_of_life` 也被排除在可见交互之外。

## 必修目标

### 1. 地图弹层显示每个地点的 NPC

文件：`src/app/world/page.tsx`

在地图弹层底部的选中地点详情框中，新增一行“此时可见”，按当前 `state.timeOfDay` 显示该地点对应 `dayNpcs` 或 `nightNpcs`：

- 显示 NPC 名称 chip：例如 `加百列`、`拉斐尔`、`鸽子`。
- 过滤规则与场景一致：白天只读 `dayNpcs`，夜晚只读 `nightNpcs`。
- `forbidden_tree` 和 `tree_of_life` 可以在地图详情中作为“世界对象”显示，但不要作为可低语对象显示。
- 当前地点和非当前地点都应能看到“该地点此时有哪些角色/对象”，方便玩家规划路线。

建议函数：

```ts
function getLocationNpcsByTime(locationId: EdenLocationId, timeOfDay: TimeOfDay): EdenNpcId[] {
  const loc = EDEN_LOCATIONS[locationId];
  return timeOfDay === "day" ? loc.dayNpcs : loc.nightNpcs;
}
```

### 2. 场景舞台补齐所有新增 NPC 的可见表达

文件：
- `src/app/world/page.tsx`
- `src/app/globals.css`
- 必要时 `src/game/assets.ts`

当前只看到：
- `cherubim`
- `deer`
- `dove`
- `fox`

需要补齐：
- `gabriel`：伊甸之河白天可见，传达天使。
- `raphael`：伊甸之河白天/夜晚可见，安抚天使。
- `uriel`：园中树林白天/夜晚可见，光照天使。
- `michael`：四河分流白天/夜晚可见，后果天使。
- `sheep`：万物受名处白天可见。
- `tree_of_life`：园子中央白天/夜晚作为世界对象可见，不可低语。

如果暂时没有独立透明立绘，可以先用“可见标记 + 名称 + 短动作”的方式呈现，但必须在场景舞台上明显可见，不能只存在于右侧列表。

建议实现：
- 天使类可暂时复用 `watchingAngelSprite`，但通过 CSS class 区分位置、大小、色调和标签：
  - `.eden-stage-angel--gabriel`
  - `.eden-stage-angel--raphael`
  - `.eden-stage-angel--uriel`
  - `.eden-stage-angel--michael`
- 动物/世界对象用稳定的小型场景标记：
  - `.eden-stage-sheep`
  - `.eden-stage-tree-of-life`
- 所有按钮/标记必须 `stopPropagation()`，不要误触发退出对话状态。
- 可低语 NPC 点击后应进入对话框；不可低语对象只显示环境反馈或禁用状态。

### 3. 右侧“此处可见”列表区分可低语与不可低语

文件：`src/app/world/page.tsx`

当前禁用按钮容易让玩家以为没接入。请优化：
- 可低语：正常按钮。
- 不可低语动物/对象：显示为灰色 chip 或“观察对象”，不要像失败按钮。
- 鸽子保留“让鸽子传话”工具按钮。
- 狐狸保留“评估话术”工具按钮。

### 4. 补充 smoke 断言，防止视觉接入空转

文件：
- `scripts/test-world-visual-smoke.mjs`
- `scripts/test-world-smoke.mjs`

新增静态断言：
- `page.tsx` 包含 `gabriel`、`raphael`、`uriel`、`michael`、`sheep`、`tree_of_life` 的场景渲染逻辑。
- 地图详情框包含 NPC 列表渲染逻辑，例如 `eden-map-npc-list`。
- CSS 包含新增 class：
  - `.eden-stage-angel--gabriel`
  - `.eden-stage-angel--raphael`
  - `.eden-stage-angel--uriel`
  - `.eden-stage-angel--michael`
  - `.eden-stage-sheep`
  - `.eden-stage-tree-of-life`
  - `.eden-map-npc-list`
  - `.eden-map-npc-chip`

新增 API/规则断言：
- 白天选中 `four_river_source`，地图 NPC 列表应包含 `gabriel`、`raphael`。
- 夜晚选中 `four_river_source`，地图 NPC 列表应包含 `raphael`、`dove`，不包含 `gabriel`。
- 白天选中 `adam_garden_work`，应包含 `adam`、`hedgehog`、`deer`、`sheep`。
- 夜晚选中 `adam_garden_work`，不包含 `sheep`。
- 白天/夜晚选中 `naming_stone_bank`，包含 `michael`、`dove`。

## 验收命令

```bash
npm run lint
npm run build
npx tsc --noEmit
node scripts/test-world-smoke.mjs http://localhost:<port>
node scripts/test-world-visual-smoke.mjs
```

## 验收标准

- 玩家打开地图弹层，选中任意地点时，可以直接看到该地点当前昼夜时段的 NPC / 世界对象。
- 玩家进入每个地点时，场景舞台上至少有可见的新增 NPC 表达，不只是右侧列表。
- 所有新增 NPC 的视觉接入有 smoke 断言覆盖。
- 不改变核心规则：新增 NPC 不直接推进夏娃吃果；禁忌动作链仍只由影响夏娃的低语触发。
