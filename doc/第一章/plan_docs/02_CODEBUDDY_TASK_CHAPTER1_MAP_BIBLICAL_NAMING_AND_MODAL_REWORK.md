# 02 CodeBuddy 开发任务：第一章地图原典命名与地图弹层交互重构

> 目标读者：CodeBuddy  
> 当前阶段：第一章「园中诸声」地图 UI / 命名 / 可玩性返修  
> 优先级：P0  
> 重要约束：CodeBuddy 负责代码实现与关键调试；Codex 只提供设计修订和任务单。请保留 CodeBuddy 对话记录作为比赛提交证据链。

---

## 一、任务背景

当前 `/world` 地图已经可显示热点，但玩家测试反馈表明仍有四个问题：

1. **地点命名不符合原典关系**  
   “分别善恶树庭院”不应作为独立地区名出现。《创世记》2:9 写明生命树和分别善恶树都在园子当中，因此两棵树应归入“园中两树”这一核心地点。

2. **部分地名过于工程化或拗口**  
   “亚当修理看守之地”更像说明句，不像地图地名。需要根据《创世记》2:15 的“修理、看守”含义，改为更短、更像地点的名称。

3. **地图弹层可读性问题**  
   右上角关闭按钮颜色与背景冲突；地图显示比例导致部分内容无法完整看清。

4. **地图交互需要从“点即移动”改为“先选择，再确认进入”**  
   地图下方不再显示 5 个并列地点卡片。点击地图热点后，下方只显示当前选择地点详情，右侧根据状态显示“进入 / 当前位置 / 无法进入”。

---

## 二、原典依据

实现前请阅读以下经文，并只把它们作为地图命名和空间关系依据，不把经文长段原文直接塞进 UI。

- Genesis 2:8-15：神在东方的伊甸栽园；园中有各样树；生命树和分别善恶树在园中；河从伊甸流出并分为四道；人被安置在园中修理看守。  
  参考：[BibleGateway Genesis 2:8-15 KJV](https://www.biblegateway.com/passage/?search=Genesis+2%3A8-15&version=KJV)
- Genesis 3:22-24：逐出之后，园东边有基路伯和发火焰的剑守住生命树道路。  
  参考：[BibleGateway Genesis 3:22-24 KJV](https://www.biblegateway.com/passage/?search=Genesis+3%3A22-24&version=KJV)

关键设计结论：

- 生命树与分别善恶树都属于园中央，不拆成“分别善恶树庭院”。
- “修理看守”是亚当职责，不适合原样作为地名。
- 四河是地图方向和空间感的重要信号。
- 东边基路伯是逐出后的边界意象，第一章 P0 可用“东园树影”承载风险感，但不要误写成分别善恶树所在地。

---

## 三、先读取

请先读取：

- `README.md`
- `package.json`
- `AGENTS.md`
- `docs/PROJECT_CONTEXT.md`
- `doc/产品需求文档.md`
- `doc/DEMO剧情与夏娃行为准则.md`
- `doc/第一章/开发文档.md`
- `doc/第一章/plan_docs/01_CODEBUDDY_TASK_CHAPTER1_WORLD_MAP_AND_PLAYABILITY_FIX.md`
- `src/app/world/page.tsx`
- `src/app/globals.css`
- `src/content/world/locations.ts`
- `src/game/world/types.ts`
- `src/game/world/toolRules.ts`
- `src/game/world/worldActions.ts`
- `scripts/test-world-smoke.mjs`
- `scripts/test-world-visual-smoke.mjs`

重点以 `doc/第一章/开发文档.md` v0.3 的地图章节为准。

---

## 四、P0 修复 1：重命名玩家可见地点

### 4.1 新地点名

请优先改玩家可见名称、短描述、地图标签、地点详情、观察文案和结局复盘文案。内部 ID 可以暂时不改，避免破坏规则层和测试脚本。

| 内部 ID | 旧玩家可见名 | 新玩家可见名 | 定位 |
| --- | --- | --- | --- |
| `central_meadow` | 园中央 | 园中两树 | 生命树与分别善恶树同在园中，是主线目标地点 |
| `four_river_source` | 四河源头 | 四河分源 | 河从伊甸流出并分为四道的方向感地点 |
| `adam_garden_work` | 亚当修理看守之地 | 守园圃地 | 亚当履行修理、看守职责的情报地点 |
| `tree_court` | 分别善恶树庭院 | 东园树影 | 风险、静默、天使远影地点，不是善恶树所在地 |
| `naming_stone_bank` | 命名石滩 | 命名河滩 | 动物命名、刺猬、低风险线索地点 |

### 4.2 文案方向

建议改 `src/content/world/locations.ts`：

```ts
central_meadow: {
  name: "园中两树",
  shortDesc: "生命树与分别善恶树同在园中",
}
```

```ts
four_river_source: {
  name: "四河分源",
  shortDesc: "河水从园中流出，在这里分为四道",
}
```

```ts
adam_garden_work: {
  name: "守园圃地",
  shortDesc: "亚当受命修理、看守园子的地方",
}
```

```ts
tree_court: {
  name: "东园树影",
  shortDesc: "风声和羽翼远影经过的边界",
}
```

```ts
naming_stone_bank: {
  name: "命名河滩",
  shortDesc: "动物被带到亚当面前命名的水边",
}
```

### 4.3 禁忌动作链位置

`look_at_tree -> approach_tree -> touch_fruit -> eat_fruit` 的主地点应是 `central_meadow`（玩家可见“园中两树”），不是 `tree_court`（玩家可见“东园树影”）。

请检查：

- `src/game/world/toolRules.ts`
- `src/game/world/worldActions.ts`
- `src/game/world/mindRules.ts`
- `src/content/world/clues.ts`
- `scripts/test-world-smoke.mjs`

如果当前规则仍要求 `tree_court` 才能触发善恶树动作，请改为 `central_meadow`，并同步测试。

---

## 五、P0 修复 2：地图弹层交互重构

### 5.1 目标流程

地图热点点击不再直接移动。

新流程：

```text
打开地图
↓
点击地图上的某个圆点
↓
下方详情框显示该地点名称、描述、状态
↓
玩家点击右侧按钮确认
↓
只有可直达地点才调用 move_to_location
```

### 5.2 删除五个并列地点卡片

地图底部不再显示五个地点方框。

改为一个详情框：

```text
┌─────────────────────────────────────────────┐
│ 园中两树                                    │ [当前位置]
│ 生命树与分别善恶树同在园中。这里是选择的中心。 │
│ 状态：你在这里                              │
└─────────────────────────────────────────────┘
```

或：

```text
┌─────────────────────────────────────────────┐
│ 四河分源                                    │ [进入]
│ 河水从园中流出，在这里分为四道。             │
│ 状态：可从园中两树前往                      │
└─────────────────────────────────────────────┘
```

或：

```text
┌─────────────────────────────────────────────┐
│ 东园树影                                    │ [无法进入]
│ 风声和羽翼远影经过的边界。                  │
│ 状态：需要先前往园中两树                    │
└─────────────────────────────────────────────┘
```

### 5.3 状态按钮规则

| 选中地点状态 | 右侧按钮文案 | 可点击 | 行为 |
| --- | --- | --- | --- |
| 当前地点 | 当前位置 | 否 | 不移动 |
| 可直达地点 | 进入 | 是 | 调用 `handleToolCall("move_to_location", { locationId })` |
| 不可直达地点 | 无法进入 | 否 | 不移动；详情文案说明需先前往哪个地点 |

如果要允许点击“无法进入”按钮，也只能显示提示，不允许绕过规则层。

### 5.4 选中状态

新增前端状态：

```ts
const [selectedMapLocationId, setSelectedMapLocationId] = useState<EdenLocationId>(state.locationId);
```

建议：

- 打开地图时默认选中当前位置。
- 点击热点只更新 `selectedMapLocationId`。
- 成功移动后关闭地图，或保持打开但同步选中新的当前位置。二选一即可，推荐成功移动后关闭地图，回到主场景。
- 如果当前位置变化，下一次打开地图默认选中新的当前位置。

### 5.5 不可直达提示

详情框里要解释“为什么不能进入”，不要只写“无法进入”。

建议函数：

```ts
function getMapTravelStatus(selectedId, currentId) {
  if (selectedId === currentId) return { kind: "current", label: "你在这里" };
  if (EDEN_LOCATIONS[currentId].connections.includes(selectedId)) {
    return { kind: "reachable", label: `可从${EDEN_LOCATIONS[currentId].name}前往` };
  }
  return { kind: "blocked", label: "需要先前往园中两树" };
}
```

若后续连接关系不全都经由园中两树，再扩展为根据 graph 计算最近相邻节点。P0 可先写成“需要先前往园中两树”。

---

## 六、P0 修复 3：地图显示完整

### 6.1 当前问题

截图中地图被横向裁切，右侧和底部区域显示不完整。当前 `object-fit: cover` 和过窄/过矮的容器会导致地图内容被裁掉。

### 6.2 修复目标

打开地图后，应尽量看完整张地图，包括：

- 左侧四河区域；
- 中央两树；
- 右侧东园树影；
- 下方命名河滩；
- 地图边缘不被明显裁切。

### 6.3 推荐 CSS

对地图图片改为完整显示优先：

```css
.eden-map-image-wrap {
  aspect-ratio: 1672 / 941;
  max-height: min(62vh, 620px);
}

.eden-map-image {
  object-fit: contain;
  background: #0e140f;
}
```

如果使用 Next Image inline style，目前 `style={{ objectFit: "cover" }}` 会覆盖 CSS，需要同步改为：

```tsx
style={{ objectFit: "contain" }}
```

注意：地图热点坐标以百分比定位时，`object-fit: contain` 可能因留黑边导致坐标偏移。P0 推荐让 `.eden-map-image-wrap` 使用与原图一致的 `aspect-ratio: 1672 / 941`，避免留边。

---

## 七、P0 修复 4：关闭按钮样式

### 7.1 当前问题

右上角关闭按钮是浅色大方块，和地图背景、整体暗金风格冲突，也显得像浏览器窗口控件。

### 7.2 修复目标

关闭按钮应：

- 与地图弹层同属暗金/深绿风格；
- 不遮挡地图内容；
- hover 时有清楚反馈；
- `×` 图标颜色与背景对比足够；
- 不要使用过大的纯白按钮。

### 7.3 推荐样式

```css
.eden-map-close {
  width: 42px;
  height: 42px;
  padding: 0;
  border-radius: 999px;
  border: 1px solid rgba(216, 200, 160, 0.32);
  background: rgba(8, 12, 9, 0.72);
  color: #ead9ad;
  font-size: 1.35rem;
  line-height: 1;
}

.eden-map-close:hover {
  background: rgba(216, 200, 160, 0.14);
  border-color: rgba(216, 200, 160, 0.56);
}
```

---

## 八、视觉状态规则

保留地图圆点状态，但它们只表示选中/当前位置/可达性，不直接执行移动：

| 状态 | 圆点表现 |
| --- | --- |
| 当前地点 | 实心亮圈 |
| 选中地点 | 外圈加亮或轻微放大 |
| 可直达地点 | 亮色空心圈 |
| 不可直达地点 | 红色空心圈 |

建议新增：

```css
.eden-map-hotspot--selected::before {
  transform: translate(-50%, -50%) scale(1.18);
}
```

如果当前地点同时被选中，优先显示当前位置实心圈。

---

## 九、不要做的事

- 不要把“分别善恶树庭院”继续作为玩家可见地名。
- 不要把分别善恶树从园中央拆出去。
- 不要让点击地图圆点直接移动。
- 不要在详情框里显示五个并列卡片。
- 不要绕过 `/api/world/tool` 或 `validateWorldToolCall`。
- 不要让不可直达地点通过前端直接进入。
- 不要把 CodeBuddy 之外的工具写成核心开发证据。
- 不要删除、重命名、移动 `doc/` 目录内已有文件。
- 不要新增大型依赖。
- 不要在玩家可见文本中出现 AI、Agent、模型、程序、系统、工具调用、规则层、JSON、API、测试、沙盒等工程词。

---

## 十、推荐给 CodeBuddy 的直接提示词

```text
请根据 `doc/第一章/开发文档.md` v0.3 和本任务单，重构第一章 `/world` 地图命名和地图弹层交互。请保留 CodeBuddy 对话记录作为比赛提交证据链。

核心目标：
1. 根据《创世记》2:8-15 修正玩家可见地名：
   - central_meadow -> 园中两树
   - four_river_source -> 四河分源
   - adam_garden_work -> 守园圃地
   - tree_court -> 东园树影
   - naming_stone_bank -> 命名河滩
   不要再显示“分别善恶树庭院”；生命树与分别善恶树都在园中两树。

2. 禁忌动作链地点回到 `central_meadow` / “园中两树”，不要依赖 `tree_court` / “东园树影”。

3. 重构地图弹层：
   - 点击地图热点只选中地点，不直接移动。
   - 移除底部五个并列地点卡片。
   - 下方改为单个选中地点详情框。
   - 详情框右侧按钮按状态显示：
     - 当前地点：当前位置，不可点；
     - 可直达地点：进入，可点；
     - 不可直达地点：无法进入，不可点，并说明需要先前往园中两树。
   - 真正移动仍必须调用 `/api/world/tool`，不可前端直接改 state.locationId。

4. 优化地图显示：
   - 地图必须尽量完整显示，不要裁掉右侧、底部或边缘。
   - 优先使用原图比例 1672/941。
   - 将地图图片 objectFit 从 cover 改为 contain 或保证同等完整显示效果。

5. 优化右上角关闭按钮：
   - 不要使用白色大方块；
   - 改为暗金/深绿风格圆形或小按钮；
   - hover/focus 清楚可见。

6. 同步更新测试：
   - scripts/test-world-smoke.mjs
   - scripts/test-world-visual-smoke.mjs
   要覆盖新地名、选中详情框、圆点不直接移动、详情按钮进入、不可进入状态。

请先读取：
- README.md
- AGENTS.md
- docs/PROJECT_CONTEXT.md
- doc/第一章/开发文档.md
- doc/第一章/plan_docs/02_CODEBUDDY_TASK_CHAPTER1_MAP_BIBLICAL_NAMING_AND_MODAL_REWORK.md
- src/app/world/page.tsx
- src/app/globals.css
- src/content/world/locations.ts
- src/game/world/toolRules.ts
- src/game/world/worldActions.ts
- scripts/test-world-smoke.mjs
- scripts/test-world-visual-smoke.mjs

完成后运行：
- npm run lint
- npm run build
- node scripts/test-world-smoke.mjs
- node scripts/test-world-visual-smoke.mjs

浏览器验收：
1. 打开 `/world`，进入伊甸园。
2. 地图上不再出现“分别善恶树庭院”“亚当修理看守之地”。
3. 地图能完整显示，右侧和底部不被裁掉。
4. 点击“四河分源”圆点时不直接移动，下方详情框显示四河分源信息。
5. 从当前位置可达时，详情框右侧显示“进入”，点击后才移动。
6. 点击不可直达地点时，详情框右侧显示“无法进入”，不会移动。
7. 当前位置详情按钮显示“当前位置”。
8. 关闭按钮视觉不再是白色大方块。
9. 成功/失败主流程仍可达。
```

---

## 十一、验收标准

### 11.1 地名验收

- `/world` 地图、地点详情、当前位置、观察文案不出现“分别善恶树庭院”。
- `/world` 地图、地点详情、当前位置、观察文案不出现“亚当修理看守之地”。
- 五个 P0 玩家可见地名为：园中两树、四河分源、守园圃地、东园树影、命名河滩。
- “分别善恶树”只作为园中两树内的对象出现，不作为独立地点。

### 11.2 地图交互验收

- 点击地图圆点只更新选中详情，不直接移动。
- 下方只显示一个选中地点详情框，不显示五个并列地点卡片。
- 可达地点详情按钮显示“进入”，点击后移动。
- 当前地点详情按钮显示“当前位置”，不可移动。
- 不可直达地点详情按钮显示“无法进入”或“需绕行”，不会移动。
- 移动仍走 `/api/world/tool` 和规则层。

### 11.3 视觉验收

- 地图显示完整，不明显裁掉右侧、底部或边缘。
- 关闭按钮不再是白色大方块。
- 当前地点、选中地点、可达地点、不可达地点状态可区分。
- 地图弹层保持桌面浏览器优先，移动端不作为当前验收范围。

### 11.4 回归验收

- `npm run lint` 通过。
- `npm run build` 通过。
- `node scripts/test-world-smoke.mjs` 通过。
- `node scripts/test-world-visual-smoke.mjs` 通过。
- 正向诱导仍能触发 `eve_eats_fruit`。
- 直接命令/高风险输入仍能触发神的注视失败。
- 非相邻移动仍被拒绝。
