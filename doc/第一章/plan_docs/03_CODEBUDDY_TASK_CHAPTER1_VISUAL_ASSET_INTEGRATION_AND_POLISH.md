# 03 CodeBuddy 开发任务：第一章视觉素材接入与场景表现优化

> 目标读者：CodeBuddy  
> 当前阶段：第一章「园中诸声」视觉优化与素材接入  
> 优先级：P0/P1  
> 重要约束：CodeBuddy 负责代码实现、页面接入、视觉回归和关键调试；Codex 只提供素材候选、测试建议和本任务单。请保留 CodeBuddy 对话记录作为比赛提交证据链。

---

## 一、任务背景

第一章 `/world` 已完成 P0 可玩闭环和地图交互返修：

- 5 个 P0 地点已可通过地图弹层选择并确认进入。
- 玩家可见地名已按原典关系改为：园中两树、四河分源、守园圃地、东园树影、命名河滩。
- 禁忌动作链已回到“园中两树”，不再把“东园树影”当作善恶树终局地点。
- `npm run lint`、`npm run build`、`npx tsc --noEmit`、`test-world-smoke`、`test-world-visual-smoke` 在上一轮均已通过。

当前问题不再是缺玩法，而是视觉表达仍使用较早版本素材：

- `src/game/assets.ts` 中 `CHAPTER1_IMAGES` 仍指向 5 张旧地点背景：`location_*.png`。
- 新生成的 5 张 v3 背景更贴近 Chapter 0 已定 Demo 场景图，但还没有接入。
- 守望天使当前主要是 CSS 光柱 / 符号表现，已有透明立绘候选可以提升辨识度。
- 刺猬已有用户确认更喜欢的圆润版透明立绘，应优先替换第一章命名河滩中的刺猬表现。
- 分别善恶树对象透明图质量一般，暂不建议直接接入；应优先让“园中两树”完整背景承担主视觉。

结论：**可以进入第一章视觉接入阶段，不建议继续大规模生图。** 本轮目标是把已有素材变成可运行、可验收、可录屏的正式视觉表现。

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
- `doc/AI_ASSET_RECORD.md`
- `doc/第一章/plan_docs/01_CODEBUDDY_TASK_CHAPTER1_WORLD_MAP_AND_PLAYABILITY_FIX.md`
- `doc/第一章/plan_docs/02_CODEBUDDY_TASK_CHAPTER1_MAP_BIBLICAL_NAMING_AND_MODAL_REWORK.md`
- `src/game/assets.ts`
- `src/app/world/page.tsx`
- `src/app/globals.css`
- `src/content/world/locations.ts`
- `src/content/world/npcs.ts`
- `scripts/test-world-smoke.mjs`
- `scripts/test-world-visual-smoke.mjs`

重点以 `doc/第一章/开发文档.md` v0.3、当前 `/world` 实现和 `docs/PROJECT_CONTEXT.md` 最新测试结论为准。

---

## 三、本轮推荐接入素材

### 3.1 P0：5 张地点背景 v3

优先接入以下 5 张候选图：

```text
public/assets/chapter1/images/location_central_meadow_v3_candidate.png
public/assets/chapter1/images/location_four_river_source_v3_candidate.png
public/assets/chapter1/images/location_adam_garden_work_v3_candidate.png
public/assets/chapter1/images/location_tree_court_v3_candidate.png
public/assets/chapter1/images/location_naming_stone_bank_v3_candidate.png
```

当前规格：

```text
尺寸：2848x1600
格式：PNG / RGB
单张体积：约 4.5MB - 6.5MB
```

接入前建议先导出网页友好版，避免 `/world` 切地点时加载过重：

```text
location_central_meadow_v3_1920.webp
location_four_river_source_v3_1920.webp
location_adam_garden_work_v3_1920.webp
location_tree_court_v3_1920.webp
location_naming_stone_bank_v3_1920.webp
```

建议规格：

```text
尺寸：1920x1080
格式：WebP 或高质量 JPEG
单张目标体积：500KB - 1.2MB
```

如项目工具链或部署平台对 WebP 有兼容顾虑，可以使用 JPEG；不要继续使用 6MB 级 PNG 作为第一优先运行图。

### 3.2 P0：圆润版刺猬透明立绘

优先替换第一章 `/world` 中命名河滩的刺猬立绘：

```text
public/assets/chapter1/images/npc_hedgehog_rounded_final.png
```

源图存档：

```text
public/assets/chapter1/images/npc_hedgehog_rounded_source.png
```

当前规格：

```text
尺寸：1254x1254
格式：PNG / RGBA
透明通道：有效，四角透明
```

接入要求：

- 第一章优先使用该圆润版，不再使用 `npc_hedgehog_sprite_v3_candidate.png`。
- Chapter 0 仍可继续使用原 `hedgehog_sprite_v2.png`，避免影响已稳定教程画面。
- 刺猬仍是氛围角色：不影响通关、不消耗核心回合、不接 TTS、不触发禁忌动作。
- 在命名河滩检查缩放、落脚点、边缘是否自然；不要让刺猬漂浮或压住输入区/右侧浮窗。

### 3.3 P0/P1：守望天使透明立绘

优先评估接入：

```text
public/assets/chapter1/images/npc_watching_angel_builtin_candidate.png
```

当前规格：

```text
尺寸：1254x1254
格式：PNG / RGBA
透明通道：有效，四角透明
```

接入要求：

- 只作为东园树影的远影 / 守卫 presence，不要表现为上帝。
- 不接 TTS。
- 不要放得过大，不要抢过夏娃、亚当和当前地点背景。
- 可以保留 CSS 光柱作为 fallback 或叠加氛围，但不要让光柱和透明立绘互相冲突。

### 3.4 暂不接入：分别善恶树对象透明候选

暂不建议直接接入：

```text
public/assets/chapter1/images/object_forbidden_tree_sprite_candidate.png
```

原因：

- 该图树叶边缘仍有颜色残留。
- 当前第一章设计要求“分别善恶树”不作为独立地区名出现，而是归入“园中两树”。
- P0 更需要稳定、统一的完整地点背景，而不是再叠一个可能破坏构图的单独树对象。

该素材保留为概念候选即可，不要删除。

---

## 四、P0 实现任务

### 4.1 生成网页友好版地点背景

请从 5 张 v3 PNG 候选导出 1920x1080 运行版，建议命名：

```text
public/assets/chapter1/images/location_central_meadow_v3_1920.webp
public/assets/chapter1/images/location_four_river_source_v3_1920.webp
public/assets/chapter1/images/location_adam_garden_work_v3_1920.webp
public/assets/chapter1/images/location_tree_court_v3_1920.webp
public/assets/chapter1/images/location_naming_stone_bank_v3_1920.webp
```

如选择 JPEG，则统一使用：

```text
*_v3_1920.jpg
```

不要覆盖原始 `*_v3_candidate.png`。原图保留作为素材源，压缩图作为运行图。

### 4.2 更新素材常量

建议在 `src/game/assets.ts` 中扩展或切换 `CHAPTER1_IMAGES`。

推荐做法：

```ts
export const CHAPTER1_IMAGES = {
  edenWorldMap: "/assets/chapter1/images/eden_world_map_v2.png",
  centralMeadow: "/assets/chapter1/images/location_central_meadow_v3_1920.webp",
  fourRiverSource: "/assets/chapter1/images/location_four_river_source_v3_1920.webp",
  adamGardenWork: "/assets/chapter1/images/location_adam_garden_work_v3_1920.webp",
  treeCourt: "/assets/chapter1/images/location_tree_court_v3_1920.webp",
  namingStoneBank: "/assets/chapter1/images/location_naming_stone_bank_v3_1920.webp",
  watchingAngelSprite: "/assets/chapter1/images/npc_watching_angel_builtin_candidate.png",
  hedgehogRoundedSprite: "/assets/chapter1/images/npc_hedgehog_rounded_final.png",
} as const;
```

如果最终决定先直接引用 PNG 候选图，也必须在代码注释里标明这是临时运行路径，后续仍需压缩。

### 4.3 替换第一章刺猬立绘

当前 `/world` 中刺猬仍引用：

```tsx
CHAPTER0_IMAGES.hedgehogSprite
```

请仅在第一章 `/world` 切到：

```tsx
CHAPTER1_IMAGES.hedgehogRoundedSprite
```

同时调整显示尺寸：

- 视觉上应是小型动物，不应接近夏娃 / 亚当体量。
- 建议宽度区间：`110px - 170px`，按桌面布局微调。
- 保持底部落在地面，避免悬浮。
- 点击热区要覆盖可见刺猬，不要超出太多。

### 4.4 接入守望天使透明立绘

当前 `/world` 的守望天使区域有 CSS presence / 符号表现。请评估替换或叠加为：

```tsx
CHAPTER1_IMAGES.watchingAngelSprite
```

建议表现：

- 只在 `tree_court`（玩家可见“东园树影”）或神的注视较高时明显出现。
- 远处、半透明、低饱和，偏“看见有守卫”而不是“可亲近角色”。
- 与 `divineAttention` 联动时，最多提高透明度、亮度或轻微光晕，不做大动画。
- 保留玩家可点击低语能力，但视觉上要让玩家理解它危险、冷静、不可诱导。

### 4.5 保持地图弹层逻辑不变

本轮不要重构地图交互。保留 02 任务已经完成的交互：

```text
点击热点 -> 选择地点 -> 下方详情框 -> 点击“进入”
```

本轮只检查新背景接入后：

- 地图弹层不被背景和角色层影响。
- 右侧浮窗文字可读。
- 背景、角色、地图弹层层级稳定。

---

## 五、视觉方向与取舍标准

新背景必须服务第一章 P0 玩法，而不是单纯追求更漂亮。

### 5.1 统一风格

必须贴近：

```text
public/assets/chapter0/images/eden_dialogue_background_v2.png
```

关键词：

```text
半写实电影感
暗金绿色调
干地前景
可放置角色立绘
神话寓言感
轻微不安
```

避免：

```text
过亮梦幻仙境
明显科幻网格
现代建筑或现代物品
大面积纯色雾光
背景主体抢过 NPC
右侧面板文字读不清
```

### 5.2 地点辨识度

5 个地点接入后，玩家应能在不读长文的情况下大致感到差异：

| 地点 | 视觉重点 |
| --- | --- |
| 园中两树 | 中央目标区、两棵树、禁令与生命的张力 |
| 四河分源 | 水源、河流分叉、低风险观察 |
| 守园圃地 | 亚当看守、较安稳、有秩序 |
| 东园树影 | 边界、天使远影、压迫感 |
| 命名河滩 | 水边、动物、小生命、刺猬 |

如果某张 v3 背景接入后与地点语义明显不符，先记录问题，不要立即重新生成全套素材。只针对该单张后续补图。

---

## 六、不要做

本轮不要做以下事项：

- 不重构第一章核心玩法、状态机、禁忌动作链。
- 不更改 `EdenLocationId` 内部 ID。
- 不重新命名 5 个玩家可见地点；沿用 02 任务结果。
- 不把 `tree_court` 重新显示成“分别善恶树庭院”。
- 不把分别善恶树对象透明图直接叠到所有场景里。
- 不删除旧素材；旧图作为回滚路径保留。
- 不移动、重命名或删除 `doc/` 内已有文件。
- 不给守望天使、刺猬接 TTS。
- 不新增大型依赖。
- 不新增移动端开发目标；当前视觉验收以桌面浏览器为准。
- 不在前端硬编码任何 API Key 或模型密钥。

---

## 七、验收标准

### 7.1 自动检查

完成后请运行：

```bash
npm run lint
npm run build
npx tsc --noEmit
node scripts/test-world-visual-smoke.mjs
node scripts/test-world-smoke.mjs http://localhost:3000
```

注意：如果 `.next/types` 缺失，先执行 `npm run build`，再单独跑 `npx tsc --noEmit`。

### 7.2 浏览器桌面检查

使用桌面浏览器打开：

```text
http://localhost:3000/world
```

至少检查：

1. 进入 `/world` 后背景图正常显示，无空白、拉伸、明显糊图。
2. 依次进入 5 个地点，背景均切换到 v3 运行图。
3. 右侧浮窗文字可读，不被背景吞没。
4. 夏娃、亚当、刺猬、守望天使不漂浮、不互相遮挡、不压住低语输入。
5. 命名河滩显示圆润版刺猬，尺寸像“小动物”。
6. 东园树影显示天使 presence，压迫但不抢画面。
7. 地图弹层仍可打开、选中地点、确认进入。
8. 成功链和失败链仍可走通。
9. 玩家可见文本不出现：AI / Agent / NPC / 模型 / 程序 / 系统 / RAG / Tool 等工程词。
10. 控制台无资源 404、无 React hydration error、无阻断性异常。

### 7.3 资源检查

完成后确认：

- 运行图文件存在，且单张体积合理。
- `src/game/assets.ts` 指向存在的文件。
- 旧 `location_*.png`、`*_v3_candidate.png` 未删除。
- `doc/AI_ASSET_RECORD.md` 已把最终接入状态从“候选”更新为“已接入”或“运行版已接入”。
- `doc/第一章/素材需求文档.md` 已同步当前视觉接入状态。

---

## 八、建议提交说明

完成后可以在 CodeBuddy 对话和提交说明中概括为：

```text
完成第一章 /world 视觉素材接入：5 个地点背景切换到 v3 视觉方向并使用网页友好运行图；命名河滩刺猬替换为用户确认的圆润版透明立绘；东园树影加入守望天使远影表现；保留旧素材作为回滚路径。玩法规则、地图节点、禁忌动作链和新增 NPC 非 TTS 约束不变。
```

这能作为比赛提交材料中的“AI 生成游戏原画接入”证据点之一。

