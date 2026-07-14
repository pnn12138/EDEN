# 19 · 第一章人工测试第三轮：四槽位存档 / 万物名录即时刷新 / 昼夜独立交互 等

> 面向：CodeBuddy / 开发执行
> 范围：第一章 `/world` 人工测试第三轮反馈的 7 项功能修改
> 基线分支：`main`（commit `5f8f009`，承接 18 号文档三场景修复之后）
> 文档性质：代码影响分析 + 根因定位 + 修复规划 + 回归测试清单
> 优先级：P0 存档四槽位 / P0 万物名录即时刷新 · P1 东园幽径昼夜独立 / P1 返回主页 / P1 地图头像 · P2 刻名石弹窗 / P2 注视值图标

---

## 0. 概述

本文档基于对当前仓库（`main` @ `5f8f009`）的逐行核查，确认 7 项需求对应的代码现状、根因与修复方案。**核心原则**：存档安全优先（旧存档迁移、四槽位互不污染）、道具效果即时生效（不依赖后续对话）、昼夜场景交互状态彼此独立（白天/夜晚各自完成一次）。

本轮涉及 7 项需求：

| 优先级 | 需求 | 当前状态 |
|---|---|---|
| P0 | 四槽位存档、读取与覆盖 | ❌ 单存档，单按钮保存/读取 |
| P0 | "万物名录"获得后立即刷新全部已见 NPC 属性 | ⚠️ 判定依赖 `encounteredNpcIds`，仅低语才填充，刺猬常未入列 |
| P1 | 东园幽径昼夜交互位置及独立完成状态 | ⚠️ 昼夜共用一套坐标 + 一个完成标记 |
| P1 | 设置中增加"返回主页" | ❌ 仅有保存/读取/重新开始 |
| P1 | "众生回声"地图头像显示优化 | ⚠️ `object-fit:cover` 无 `object-position`，头部被裁 |
| P2 | 刻名石问题弹窗 UI 优化 | ⚠️ freetext 容器无 gap，输入框与按钮紧贴 |
| P2 | 注视值左侧图标的含义与信息提示优化 | ⚠️ 水滴 SVG 无可见名称，与"注视值"累计文本混淆 |

---

## 1. 代码影响分析（开发前必读）

> 对应需求文档第四节"开发 Agent 执行要求"的 7 个分析点。

### 1.1 当前设置弹窗与存档逻辑所在文件

| 文件 | 职责 | 关键行 |
|---|---|---|
| `src/components/world/SettingsModal.tsx` | 设置浮窗：账号 + 保存/读取/重新开始 | 全文 1-147 |
| `src/components/world/SaveControl.tsx` | 顶部工具栏存档控制（旧版，已被 SettingsModal 取代，保留核查） | 全文 1-75 |
| `src/hooks/useWorldSave.ts` | 存档 hook：`save` / `load` / `reset` + 5 分钟自动保存 | `useWorldSave` 65-163 |
| `src/app/world/page.tsx` | 主页面，调用 `useWorldSave`，向 SettingsModal 传 `onSave/onLoad/onReset` | 见 1.2 |
| `src/app/page.tsx` | 主页（`/`），读存档 key 判断 `hasSave`，"读取最近存档"跳 `/world` | 12, 26, 53-66 |

设置弹窗当前结构（`SettingsModal.tsx:111-142`）：账号区 + 存档区（保存 / 读取 / 重新开始 三个按钮 + 保存状态点）。**没有"返回主页"按钮**，也没有槽位选择 UI。

### 1.2 当前存档数据结构及本地存储方式

- **单存档结构**：整个 `EdenWorldState` 直接 `JSON.stringify` 写入 localStorage 的**一个 key**。
- **存储键**：`WORLD_STATE_STORAGE_KEY = "eden:chapter1:world-state:v2"`（`useWorldSave.ts:36`）。
- **状态类型**：`EdenWorldState` 定义于 `src/game/world/types.ts:321-466`，含约 50 个字段（玩家名无、章节、时段、行动点、注视值、NPC 位置、关系、道具、印记、`completedScenePuzzleIds` 等）。
- **读取链路**：`tryNormalize`（`useWorldSave.ts:54-63`）→ `normalizeWorldStateForClient`（`useWorldSave.ts:14-33`）→ `normalizePuzzleState`（`puzzleRules.ts:44-55`）。
- **自动保存**：每 5 分钟写一次当前 state（`useWorldSave.ts:110-125`）。
- **旧存档兜底函数** `withNpcWorldDefaults`（`types.ts:595-686`）—— ⚠️ **读取链路不调用它**，仅服务端 `cloneWorldState`（`route.ts:262-303`）部分使用。

> ⚠️ **关键陷阱（见项目记忆 `eden-save-normalize-gotcha`）**：新增 `EdenWorldState` 标量字段时，必须在 **4 处**显式补 `?? 默认`：① `normalizePuzzleState`、② `normalizeWorldStateForClient`、③ `cloneWorldStateForPuzzle`（`puzzleRules.ts:57-91`）、④ `cloneWorldState`（`route.ts`）。同时在 `initialEdenWorldState` 设默认值。读取该字段的计算函数内部也应 `?? 默认` 双保险。

### 1.3 顶部未知图标绑定的数据字段

顶部栏（`page.tsx:1761-1804`）从左到右三段：

| 区域 | 内容 | 绑定字段 | 代码 |
|---|---|---|---|
| `eden-header-left` | EDEN 标题 → 章节标签 → **`DivineAttentionViz`** | — | `page.tsx:1762-1775` |
| `eden-header-center` | 时段徽章 → **`eden-ap-dots`（●○）** → 进入下一轮 | `state.actionPoints` / `getEffectiveMaxActionPoints` | `page.tsx:1776-1803` |
| `eden-header-right` | 回响 / 地图 / 印记 / 对话框 / 设置 | — | `page.tsx:1805+` |

**"注视值左侧图标" = `DivineAttentionViz` 内的 4 个水滴 SVG**（`src/components/world/DivineAttentionViz.tsx:25-43`，类名 `eden-attention-droplet`，CSS `globals.css:6827-6846`，16×22px，水滴/火焰形，金色 + 脉冲发光）：
- **绑定字段**：`state.divineAttention`（`DivineAttentionLevel` 0-4，`types.ts:81`），渲染时 `level={state.divineAttention}`（`page.tsx:1768`）。
- 4 个水滴，点亮数 = 当前注视等级（0-4）。
- 水滴**右侧**紧跟"注视值：`{cumulative}/{nextThreshold}`"进度文本（`DivineAttentionViz.tsx:85-87`），绑定 `state.divineAttentionCumulative` 与 `getEffectiveDivineThreshold(state)`。
- 水滴已有 `title={`神的注视等级：${safeLevel} / 4`}`（`DivineAttentionViz.tsx:63`），但**仅悬停可见，无可见名称**。

**结论：该图标代表"神的注视等级"（0-4 当前阶段），不是行动点。** 玩家混淆原因：水滴数（0-4 等级）与紧邻的"注视值：X/Y"（累计/阈值）是**两个不同数值**，且水滴形状（火焰/叶片）不直观。

行动点图标是另一组：`eden-ap-dots`（`page.tsx:1780-1790`），渲染 `●`/`○` 字符，已有 `title={`行动点 ${actionPoints}/${max}`}`，绿色/灰色圆点，位于时段徽章右侧（**注视值右侧**，非左侧）。

### 1.4 道具效果和 NPC 属性页的刷新机制

- **万物名录** = 道具 `resonance_living_names`（`src/content/world/items.ts:215`），由刻名石问题 `puzzle_naming_stone_identity` 奖励（`scenePuzzles.ts:122`）。
- **属性页判定逻辑**（`page.tsx:2543-2561`）：
  ```ts
  const hasLivingNames = (state.itemCounts?.["resonance_living_names"] ?? 0) > 0;
  const encountered = state.encounteredNpcIds.includes(mindTabNpc);
  const showNumbers = hasLivingNames && encountered;   // 解锁精确数值
  const showRelation = showNumbers && hasBond(mindTabNpc); // 牵绊道具解锁深层关系
  ```
- **`encounteredNpcIds` 填充链路**：仅 `recordNpcEncounter`（`npcRelationRules.ts:41-45`）会写入，而它**只在 `applyNpcAffinity` 内被调用**（`npcRelationRules.ts:72`），`applyNpcAffinity` **只在低语 API `route.ts:448` 被调用**。
- **属性 Profile 构建**：`buildAttributeProfile`（`page.tsx:195-302`），刺猬分支（`page.tsx:223-234`）用 `rel?.obedience ?? 60` / `rel?.affinity ?? 35`。
- **刷新机制**：`handlePuzzleChoose` 调 `/api/world/puzzle`，成功后 `setState(result.state)`（`page.tsx:1426`）触发整页重渲染，属性页读 `state` 即更新。

**根因**：
1. `encounteredNpcIds` 仅在**低语**时填充。玩家"在场景里见到"（立绘出现）但未低语的 NPC 不在列 → 获得万物名录后这些 NPC 仍 `encountered=false` → `showNumbers=false`，需再低语一次才入列。这就是"部分 NPC 必须再完成一次对话后才变化"。
2. **刺猬**常通过场景互动 `interact_with_hedgehog`（`sceneActions.ts:34-46`，"观察刺猬"）接触，该路径**不走低语 API**，不调用 `recordNpcEncounter` → 刺猬可能永不入 `encounteredNpcIds` → `showNumbers` 永远 false →"完全没有变化"。
3. 判定本身（`hasLivingNames && encountered`）逻辑正确，问题在 `encountered` 的定义过窄（仅低语=已见）。

### 1.5 东园幽径交互点的坐标及完成状态保存方式

- **交互框渲染**：`page.tsx:1927-1942`，按钮类 `eden-east-path-entry`，点击调 `handleScenePuzzleClick("puzzle_east_path_cautious_presence")`。
- **坐标**：CSS `globals.css:6453-6472`，`position:absolute; left:78%; top:42%; transform:translate(-50%,-50%)` —— **昼夜共用同一坐标**，且写死在 CSS（非配置化）。
- **昼夜背景**：`getLocationBg`（`page.tsx:345-372`）按 `timeOfDay` 选 `eastGardenPath` / `eastGardenPathNight`，背景图不同。
- **完成状态**：`state.completedScenePuzzleIds: string[]`（`types.ts:442`），含 `puzzle_east_path_cautious_presence` 即完成。
- **完成判定**：`isScenePuzzleAvailable`（`puzzleRules.ts:97-101`）检查 `puzzle.timeOfDay` 与 `isScenePuzzleCompleted`。
- **谜题定义**：`scenePuzzles.ts:129-186`，`trigger:"explicit_interaction"`，`resolutionMode:"per_option"`，**未设 `timeOfDay`**（昼夜都触发），4 选项（众生回声 / 清醒之眼 / 双树残识 / 徒劳挣扎）。
- **UI 完成态**：`eastPathCompleted`（`page.tsx:1567-1570`）= `completedScenePuzzleIds.includes(puzzle.id)`，加 `--completed` 类。

**根因**：
1. 坐标昼夜共用一个 CSS 类，无法分别校准。
2. `completedScenePuzzleIds` 是扁平 `string[]`，一个 puzzleId 只能记录一次完成 → 白天完成后夜晚无法再完成。

### 1.6 地图 NPC 头像使用的组件、裁切方式和定位方式

- **组件**：`page.tsx:2999-3021`，`next/image` 的 `Image`，`width=28 height=28`，类 `eden-map-hotspot-avatar`。
- **立绘源**：`NPC_SPRITE`（`page.tsx:375-382`）—— **全身立绘**（如 eve 380×760、gabriel 1023×1537），头部在图片上方。
- **裁切方式**：CSS `globals.css:4671-4679`，`width:28px; height:28px; border-radius:50%; object-fit:cover;` —— ⚠️ **无 `object-position`**，默认 `50% 50%` 居中，圆形裁掉全身立绘中部（身体），**头部被裁掉**。
- **显示条件**：`state.unlockMapNpcLocations`（众生回声解锁，`page.tsx:2999`），即 `resonance_echo_of_beings` 道具（东园幽径 `echo_of_beings` 选项奖励，`scenePuzzles.ts:144-145`）。
- **头像源列表**：`getVisibleNpcsAtLocation(state, locId)`（`page.tsx:889-905`）按昼夜 + `npcLocations` 过滤。
- **聚合**：多名 NPC 同场景时，`.eden-map-hotspot-avatars`（`globals.css:4661-4670`）`display:flex; gap:4px`，水平排列，**不会重叠**（保持即可）。

### 1.7 是否需要进行旧存档迁移

**需要。** 当前单 key `eden:chapter1:world-state:v2` 改为四槽位后，旧存档必须迁移到"存档 1"，否则更新后玩家进度直接丢失。

迁移要点：
- 迁移点：`useWorldSave` 挂载时（`useWorldSave.ts:80-96` 的 useEffect）。
- 迁移逻辑：若旧 key 存在且 slot1 不存在 → 读旧 state → 经 `normalizeWorldStateForClient` 归一 → 写入 slot1 → 删除旧 key（或保留一个版本后删除，避免重复迁移）。
- **必须用读档链路的 `normalizeWorldStateForClient`，不能用 `withNpcWorldDefaults`**（见 1.2 陷阱）。
- `src/app/page.tsx`（主页）也读旧 key 判断 `hasSave`（`page.tsx:12,26`），需同步改为"任一 slot 有存档即 true"。

---

## 2. P0 · 四槽位存档系统

### 2.1 数据结构设计

**采用 4 个独立 key**（互相隔离，单槽损坏不影响其他）：

```ts
// src/hooks/useWorldSave.ts
export const SAVE_SLOTS = [1, 2, 3, 4] as const;
export type SaveSlotIndex = (typeof SAVE_SLOTS)[number];

// 每个 slot 的存储包装（不仅存 state，还存保存时间）
export type WorldSaveSlotData = {
  state: EdenWorldState;
  savedAt: string; // ISO 字符串，如 "2026-07-12T11:27:00.000Z"
  slotIndex: SaveSlotIndex;
};

// 存储 key 工具
export function slotKey(i: SaveSlotIndex): string {
  return `eden:chapter1:save:slot${i}`;
}
// 旧 key 保留常量用于迁移
export const LEGACY_WORLD_STATE_KEY = "eden:chapter1:world-state:v2";
```

**槽位摘要**（UI 展示用，从 state 计算 + savedAt）：

```ts
export type SaveSlotMeta = {
  index: SaveSlotIndex;
  empty: boolean;
  savedAtLabel: string | null;   // "11:27"
  chapterSceneLabel: string | null; // "第一章 · 东园幽径"
  timeSlotLabel: string | null;  // "第 6 时段 · 周三夜晚"
};
```

> 章节固定"第一章"；场景用 `LOCATION_NAMES[state.locationId]`；时段用已有的 `getTimeSlotDisplay(state.timeSlot, state.dayIndex, state.timeOfDay)`（`page.tsx` 已有，提到公共位置或就地调用）；保存时间由 `savedAt` 格式化。

### 2.2 useWorldSave 改造

将 `save`/`load`/`reset` 改为接受 `slotIndex`，新增 `getSlotMetas`、`hasAnySave`、`migrateLegacy`：

```ts
type UseWorldSaveOptions = {
  state: EdenWorldState;
  onLoad: (s: EdenWorldState) => void;
  onAfterLoad: () => void;
  onReset: () => void;
  onGoHome?: () => void; // P1 返回主页用
};

export function useWorldSave({ state, onLoad, onAfterLoad, onReset }: UseWorldSaveOptions) {
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastActiveSlot, setLastActiveSlot] = useState<SaveSlotIndex | null>(null);
  // dirty / loaded / ref 与原逻辑一致

  // ---- 挂载：迁移旧存档 + 自动读取 slot1（或上次活跃 slot）----
  useEffect(() => {
    migrateLegacy(); // 旧 key -> slot1
    const target = lastActiveSlot ?? 1;
    const data = readSlot(target);
    if (data) {
      onLoad(normalizeWorldStateForClient(data.state));
      setLastActiveSlot(target);
      setLastSavedAt(formatClock(new Date(data.savedAt)));
    }
    setLoaded(true);
    onAfterLoad();
  }, []);

  // ---- 读单个槽位 ----
  function readSlot(i: SaveSlotIndex): WorldSaveSlotData | null {
    try {
      const raw = window.localStorage.getItem(slotKey(i));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as WorldSaveSlotData;
      if (parsed.state?.chapterId !== "chapter1_garden_voices") return null;
      return parsed;
    } catch { return null; }
  }

  // ---- 写单个槽位 ----
  const save = useCallback((i: SaveSlotIndex) => {
    try {
      const data: WorldSaveSlotData = {
        state: stateRef.current,
        savedAt: new Date().toISOString(),
        slotIndex: i,
      };
      window.localStorage.setItem(slotKey(i), JSON.stringify(data));
      setLastActiveSlot(i);
      setLastSavedAt(formatClock());
      dirtyRef.current = false; setDirty(false);
    } catch { /* noop */ }
  }, []);

  // ---- 读单个槽位并恢复 ----
  const load = useCallback((i: SaveSlotIndex) => {
    const data = readSlot(i);
    if (data) {
      onLoad(normalizeWorldStateForClient(data.state));
      setLastActiveSlot(i);
      setLastSavedAt(formatClock(new Date(data.savedAt)));
      dirtyRef.current = false; setDirty(false);
    }
  }, [onLoad]);

  // ---- 四槽位摘要（UI 用）----
  const getSlotMetas = useCallback((): SaveSlotMeta[] => {
    return SAVE_SLOTS.map((i) => {
      const data = readSlot(i);
      if (!data) return { index: i, empty: true, savedAtLabel: null, chapterSceneLabel: null, timeSlotLabel: null };
      const s = data.state;
      return {
        index: i,
        empty: false,
        savedAtLabel: formatClock(new Date(data.savedAt)),
        chapterSceneLabel: `第一章 · ${LOCATION_NAMES[s.locationId]}`,
        timeSlotLabel: getTimeSlotDisplay(s.timeSlot, s.dayIndex, s.timeOfDay),
      };
    });
  }, []);

  // ---- 重新开始：清空全部 4 槽 + 旧 key + 辅助 key ----
  const reset = useCallback(() => {
    SAVE_SLOTS.forEach((i) => {
      try { window.localStorage.removeItem(slotKey(i)); } catch { /* noop */ }
    });
    try {
      window.localStorage.removeItem(LEGACY_WORLD_STATE_KEY);
      window.localStorage.removeItem("eden:world:global_intro_shown");
      window.localStorage.removeItem("eden:world:polish-tokens");
    } catch { /* noop */ }
    setLastSavedAt(null); setLastActiveSlot(null);
    dirtyRef.current = false; setDirty(false);
    onReset();
  }, [onReset]);

  // ---- 5 分钟自动保存：写入上次活跃槽（无则 slot1）----
  useEffect(() => {
    const id = window.setInterval(() => {
      const target = lastActiveSlotRef.current ?? 1;
      try {
        const data: WorldSaveSlotData = {
          state: stateRef.current,
          savedAt: new Date().toISOString(),
          slotIndex: target,
        };
        window.localStorage.setItem(slotKey(target), JSON.stringify(data));
        setLastSavedAt(formatClock());
        dirtyRef.current = false; setDirty(false);
      } catch { /* noop */ }
    }, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  // ---- 旧存档迁移 ----
  function migrateLegacy(): void {
    try {
      const legacy = window.localStorage.getItem(LEGACY_WORLD_STATE_KEY);
      if (!legacy) return;
      if (window.localStorage.getItem(slotKey(1))) return; // slot1 已有，不覆盖
      const parsed = JSON.parse(legacy) as EdenWorldState;
      if (parsed?.chapterId !== "chapter1_garden_voices") return;
      const normalized = normalizeWorldStateForClient(parsed);
      const data: WorldSaveSlotData = {
        state: normalized,
        savedAt: new Date().toISOString(),
        slotIndex: 1,
      };
      window.localStorage.setItem(slotKey(1), JSON.stringify(data));
      window.localStorage.removeItem(LEGACY_WORLD_STATE_KEY); // 迁移成功后删旧 key
    } catch { /* noop */ }
  }

  function hasAnySave(): boolean {
    return SAVE_SLOTS.some((i) => !!readSlot(i));
  }

  return { lastSavedAt, dirty, loaded, lastActiveSlot,
           save, load, reset, getSlotMetas, hasAnySave };
}
```

> `lastActiveSlotRef` 需用 `useRef` 同步 `lastActiveSlot`，供 setInterval 读取。`formatClock` 已有（`useWorldSave.ts:38-42`），扩展支持传入 `Date` 参数。

### 2.3 SettingsModal 改造：槽位选择 + 返回主页

新增两个子状态：`saveSlotPickerOpen` / `loadSlotPickerOpen`，以及"返回主页"二次确认。

**交互流程**：

1. **保存**：点击"保存" → 打开槽位选择面板（4 槽） →
   - 空槽位：直接写入。
   - 已有存档：`window.confirm("该槽位已有存档，是否覆盖？")` → 确认后写入。
   - 写入后刷新该槽摘要，关闭面板，提示"已保存到存档 N"。
2. **读取**：点击"读取" → 打开槽位选择面板（4 槽，**空槽禁用**） →
   - 点击已有存档：`window.confirm("读取存档将替换当前未保存的游戏进度，是否继续？")` → 确认后 `onLoad(slotIndex)`，关闭弹窗。
3. **返回主页**：点击"返回主页" → `window.confirm("尚未保存的进度可能会丢失，确定返回主页吗？")`（标题"返回主页"用弹窗内文案实现，原生 confirm 无标题）→ 确认后 `onGoHome()`，**不清存档、不触发 reset**。

**UI 结构建议**（在 SettingsModal 内，存档区改为）：

```tsx
<section className="eden-settings-section">
  <span className="eden-settings-section-title">存档</span>
  <div className="eden-settings-save-row">
    <button className="eden-btn eden-btn--primary" onClick={() => setPickerMode("save")}>保存</button>
    <button className="eden-btn eden-btn--ghost" onClick={() => setPickerMode("load")}>读取</button>
    <button className="eden-btn eden-btn--ghost" onClick={handleReset}>重新开始</button>
    <button className="eden-btn eden-btn--ghost eden-btn--home" onClick={handleGoHome}>返回主页</button>
  </div>
  <div className="eden-settings-save-status" data-testid="world-save-dot">{saveStatusText}</div>

  {pickerMode && (
    <div className="eden-save-slots">
      <div className="eden-save-slots-head">
        <span>{pickerMode === "save" ? "选择要保存的槽位" : "选择要读取的槽位"}</span>
        <button onClick={() => setPickerMode(null)}>×</button>
      </div>
      {slotMetas.map((m) => (
        <button
          key={m.index}
          className={`eden-save-slot ${m.empty ? "eden-save-slot--empty" : ""}`}
          disabled={pickerMode === "load" && m.empty}
          onClick={() => handlePickSlot(m)}
        >
          <span className="eden-save-slot-title">存档 {m.index}</span>
          {m.empty ? (
            <span className="eden-save-slot-empty-hint">暂无存档</span>
          ) : (
            <>
              <span className="eden-save-slot-scene">{m.chapterSceneLabel}</span>
              <span className="eden-save-slot-timeslot">{m.timeSlotLabel}</span>
              <span className="eden-save-slot-time">保存于 {m.savedAtLabel}</span>
            </>
          )}
        </button>
      ))}
    </div>
  )}
</section>
```

**Props 扩展**：

```ts
type SettingsModalProps = {
  open: boolean; onClose: () => void;
  auth: AuthState | null; onLoginClick: () => void; onLogout: () => void;
  onSave: (slotIndex: SaveSlotIndex) => void;       // 改为带 slotIndex
  onLoad: (slotIndex: SaveSlotIndex) => void;       // 改为带 slotIndex
  onReset: () => void;
  onGoHome: () => void;                              // 新增
  slotMetas: SaveSlotMeta[];                         // 新增：由 page.tsx 传入 getSlotMetas()
  lastSavedAt: string | null; dirty: boolean;
};
```

**视觉**：`eden-btn--home`（返回主页）危险等级低于"重新开始"——用 ghost 样式，不加红色/橙色警示边框，与"读取"同色阶。

### 2.4 page.tsx 接线

- `useWorldSave` 解构新增 `getSlotMetas`、`onGoHome` 处理。
- `onGoHome`：`() => router.push("/")`（`useRouter` from `next/navigation`，page.tsx 顶部已有）。
- 向 `SettingsModal` 传 `slotMetas={getSlotMetas()}`、`onSave={(i)=>save(i)}`、`onLoad={(i)=>load(i)}`、`onGoHome`。
- **注意**：`getSlotMetas()` 每次渲染都读 4 次 localStorage，可接受（弹窗打开时才渲染）；或用 `useState` + 打开弹窗时 `setSlotMetas(getSlotMetas())` 缓存。

### 2.5 主页 `src/app/page.tsx` 同步

- `WORLD_SAVE_KEY` 常量（`page.tsx:12`）改为遍历 `slotKey(1..4)` 判断 `hasSave`：
  ```ts
  const hasAnySave = () => SAVE_SLOTS.some((i) => {
    try { return !!window.localStorage.getItem(`eden:chapter1:save:slot${i}`); }
    catch { return false; }
  });
  ```
- `handleReadSave`（`page.tsx:53-56`）跳 `/world`，`useWorldSave` 挂载时自动读 slot1（或上次活跃槽）。
- "读取最近存档"按钮 `disabled` 改为 `!hasAnySave()`。

### 2.6 存档内容完整性核查

对照需求"存档至少应完整保存和恢复"清单，逐项核查 `EdenWorldState`（`types.ts:321-466`）已覆盖：

| 需求项 | 对应字段 | 状态 |
|---|---|---|
| 玩家名称 | ⚠️ **无 `playerName` 字段** | 需新增（见 2.7） |
| 章节/日期/时段/场景 | `chapterId` / `dayIndex` / `timeSlot` / `timeOfDay` / `locationId` | ✅ |
| 行动点、注视值 | `actionPoints` / `maxActionPoints` / `divineAttention` / `divineAttentionCumulative` | ✅ |
| NPC 所在位置 | `npcLocations` | ✅ |
| NPC 已见/属性/关系 | `encounteredNpcIds` / `eveMind` / `adamMind` / `npcRelations` / `hedgehog` | ✅ |
| 已获得道具 | `inventory` / `itemCounts` | ✅ |
| 道具效果是否启用 | `pendingConsumableEffects` / `divineGiftsOwned` / 各 unlock 标志 | ✅ |
| 已解锁印记 | `unlockedAchievementIds` | ✅ |
| 已完成场景问题 | `completedScenePuzzleIds` + 本轮新增昼夜字段（见 §3） | ✅ |
| 昼夜分别完成的交互记录 | ⚠️ 当前扁平 `completedScenePuzzleIds`，需扩展（见 §3） | ⚠️ |
| 对话及剧情进度 | `npcDialogues` / `corruptionTrace` / `toolCallHistory` / `worldActions` | ✅ |
| 地图解锁状态 | `unlockMapNpcLocations` / `unlockTreeNames` | ✅ |

### 2.7 玩家名称字段（刻名石留名）

刻名石问题让玩家输入名字（`scenePuzzles.ts:107`），但当前**未持久化到 state**。需求"存档至少保存玩家名称"要求补：

```ts
// types.ts · EdenWorldState 新增
playerName: string; // 刻名石留名，默认 ""

// initialEdenWorldState
playerName: "",

// 4 处 normalize 补兜底（见 1.2 陷阱）
playerName: s.playerName ?? "",
```

在 `puzzleRules.ts` 的 `applyFreeTextAnswer` 成功分支（`puzzleRules.ts:399-426`）写入：
```ts
if (puzzle.id === "puzzle_naming_stone_identity" && answerText.trim()) {
  next.playerName = answerText.trim();
}
```

> 若需求未强制要求刻名石名字回显到存档摘要，可仅持久化不展示。槽位摘要暂不展示玩家名（需求示例未列）。

---

## 3. P0 · "万物名录"获得后立即刷新全部已见 NPC 属性

### 3.1 根因（详见 1.4）

`showNumbers = hasLivingNames && encountered`，其中 `encountered = encounteredNpcIds.includes(npc)`。`encounteredNpcIds` **仅在低语时**通过 `recordNpcEncounter` 填充。导致：
- 场景里见过但未低语的 NPC 不入列 → 获得万物名录后不立即解锁，需再低语一次。
- 刺猬常经 `interact_with_hedgehog` 场景互动接触，不走低语 → 永不入列 → 永不解锁。

### 3.2 修复方案：拓宽"已见"定义

**核心改动：玩家进入某地点时，把该地点当前可见 NPC 全部标记为已见。** 这让"已见"= "与玩家同场出现过"，符合玩家直觉，且使万物名录解锁真正即时。

#### 3.2.1 新增工具函数（规则层）

在 `src/game/world/npcRelationRules.ts` 新增：

```ts
/**
 * 标记当前地点可见 NPC 为已见（进入场景 / 进入游戏时调用）。
 * 与低语时的 recordNpcEncounter 共用，确保万物名录对"已见"角色即时生效。
 */
export function recordEncounterForVisibleNpcs(
  state: EdenWorldState,
  locationId: EdenLocationId,
): void {
  const loc = EDEN_LOCATIONS[locationId];
  if (!loc) return;
  const visible = state.timeOfDay === "day" ? loc.dayNpcs : loc.nightNpcs;
  for (const npcId of visible) {
    // 仅标记真正在此地的 NPC（与 getVisibleNpcsAtLocation 一致）
    if (state.npcLocations[npcId] === locationId) {
      recordNpcEncounter(state, npcId);
    }
  }
}
```

> `EDEN_LOCATIONS` 从 `@/content/world/locations` 导入。`recordNpcEncounter` 已存在（`npcRelationRules.ts:41`）。

#### 3.2.2 在 move_to_location 完成后调用

服务端 `src/app/api/world/route.ts` 中 `move_to_location` 结算后（找到 `state.locationId = args.locationId` 赋值处），追加：

```ts
recordEncounterForVisibleNpcs(state, state.locationId);
```

#### 3.2.3 游戏初始 / 读档后补标记

- `initialEdenWorldState` 初始地点 `adam_garden_work`（`types.ts:508`），初始 `encounteredNpcIds: []`（`types.ts:562`）。在游戏首次进入 `explore` 阶段时（或 `onAfterLoad` 后），对当前地点调一次 `recordEncounterForVisibleNpcs`。
- 实现位置：`page.tsx` 中 `onAfterLoad` 回调，或服务端首次 `move_to_location` / `observe_location` 时。**推荐服务端**（保证规则层权威）。
- 读档后：旧存档 `encounteredNpcIds` 可能缺漏，读档后对 `state.locationId` 调一次补标记即可（在 `useWorldSave` 的 `onLoad` 之后或 `onAfterLoad` 内）。

#### 3.2.4 刺猬一致性

刺猬已在 `adam_garden_work` / `tree_court` 的 `dayNpcs` / `nightNpcs`（`locations.ts:101-102, 121-122`）。3.2.1 的函数会自动标记刺猬为已见（当玩家在万物受名处/园中树林时）。**刺猬不再需要特殊代码分支**，与其他 NPC 走同一判定。

#### 3.2.5 属性页判定保持不变

`page.tsx:2543-2546` 的 `showNumbers = hasLivingNames && encountered` **逻辑正确，无需改**。改的是 `encountered` 的填充时机（拓宽到场景进入），使获得万物名录瞬间对所有已见 NPC 立即 true。

#### 3.2.6 即时刷新验证

`handlePuzzleChoose` 成功后 `setState(result.state)`（`page.tsx:1426`）已触发整页重渲染。属性 Tab 若此时打开，`hasLivingNames` 立即变 true，`encountered` 已在之前场景进入时标记好 → 立即显示精确数值。**无需额外刷新指令**，但需回归测试确认属性 Tab 在获得道具瞬间打开即正确。

### 3.3 验收用例

| 步骤 | 预期 |
|---|---|
| 先见到 NPC-A/B/C（进入其场景）但只低语过 A，再获万物名录 | A/B/C 属性页全部立即显示精确数值（B/C 因 3.2.1 已入 encountered） |
| 获得万物名录后再进入新场景见到 NPC-D | D 首次出现即标记已见，属性页立即显示完整信息 |
| 未见过的 NPC（从未同场景） | 不提前出现在属性页"此处可见"或仍锁定 |
| 刺猬 | 与其他 NPC 规则一致，进入万物受名处即解锁 |
| 保存 → 刷新页面 → 读取 | 效果不丢失，`encounteredNpcIds` 正确恢复 |
| 无需再低语一次 | 获得道具瞬间即生效 |

---

## 4. P1 · 东园幽径昼夜交互位置及独立完成状态

### 4.1 昼夜分别坐标（配置化）

**当前**：`.eden-east-path-entry`（`globals.css:6453`）`left:78%; top:42%` 昼夜共用。

**改为**：坐标绑定场景变体（白天/夜晚），用 CSS 类区分 + 内联 style 兜底：

```css
/* globals.css */
.eden-east-path-entry { /* 保留通用样式，去掉写死坐标 */ }
.eden-east-path-entry--day   { left: 78%; top: 42%; }   /* 白天人工校准 */
.eden-east-path-entry--night { left: 76%; top: 38%; }   /* 夜晚人工校准 */
```

> 具体百分比需开发时对照白天/夜晚背景图（`CHAPTER1_IMAGES.eastGardenPath` / `eastGardenPathNight`）人工校准——对准"小路延伸尽头"，不遮挡 NPC/标题/河流。

`page.tsx:1927-1942` 渲染处加昼夜类：

```tsx
<button
  type="button"
  className={`eden-east-path-entry eden-east-path-entry--${state.timeOfDay} ${
    eastPathCompleted ? "eden-east-path-entry--completed" : ""
  }`}
  ...
>
```

> 用相对百分比坐标，避免不同屏幕尺寸偏移。

### 4.2 昼夜独立完成状态

**当前**：`completedScenePuzzleIds` 是扁平 `string[]`，`puzzle_east_path_cautious_presence` 只能完成一次。

**方案**：拆成两个 puzzleId，昼夜各一。这是最贴合现有架构（`isScenePuzzleAvailable` 已按 `puzzle.timeOfDay` 过滤）的改法。

#### 4.2.1 scenePuzzles.ts 拆分

```ts
// src/content/world/scenePuzzles.ts
// 原 puzzle_east_path_cautious_presence 拆为两个，各设 timeOfDay
{
  id: "puzzle_east_path_cautious_presence_day",
  locationId: "east_garden_path",
  timeOfDay: "day",                      // ← 新增
  trigger: "explicit_interaction",
  inputMode: "choice",
  resolutionMode: "per_option",
  title: "幽径尽头的问题",
  prompt: "...",                          // 白天/夜晚可同文案，或分别润色
  options: [ /* 与原 4 选项一致 */ ],
  successFeedback: "", rewards: {}, failure: { hint: "" },
},
{
  id: "puzzle_east_path_cautious_presence_night",
  locationId: "east_garden_path",
  timeOfDay: "night",                     // ← 新增
  trigger: "explicit_interaction",
  inputMode: "choice",
  resolutionMode: "per_option",
  title: "幽径尽头的问题",
  prompt: "...",
  options: [ /* 与原 4 选项一致 */ ],
  successFeedback: "", rewards: {}, failure: { hint: "" },
},
```

> 4 个选项（众生回声 / 清醒之眼 / 双树残识 / 徒劳挣扎）昼夜各保留一份。`per_option` 模式下每选项独立结算，核心奖励（如 `resonance_echo_of_beings` + `unlockMapNpcLocations`）昼夜各领一次——若需求要求"全局限一次"，需在选项 effect 里加全局已持判断；**当前需求"昼夜各完成一次"指 puzzle 各完成一次，道具可各自发放**（与现状一致，不改）。

#### 4.2.2 page.tsx 改动

- `eastPathPuzzle`（`page.tsx:1567-1570`）改为按昼夜选 puzzleId：
  ```ts
  const eastPathPuzzleId = state.timeOfDay === "day"
    ? "puzzle_east_path_cautious_presence_day"
    : "puzzle_east_path_cautious_presence_night";
  const eastPathPuzzle = getScenePuzzleById(eastPathPuzzleId);
  const eastPathCompleted = eastPathPuzzle
    ? state.completedScenePuzzleIds.includes(eastPathPuzzle.id)
    : false;
  ```
- 点击 handler（`page.tsx:1933`）改为 `handleScenePuzzleClick(eastPathPuzzleId)`。
- `handleScenePuzzleClick`（`page.tsx:1381-1399`）的完成提示文案表（`page.tsx:1386-1389`）两个新 id 都映射到"前方仍旧空无一物。"
- 已完成时按钮仍可点（给提示），但不打开弹窗——保持现状（`--completed` 类 + 提示）。

#### 4.2.3 完成互斥验证

`isScenePuzzleAvailable`（`puzzleRules.ts:97-101`）已检查 `puzzle.timeOfDay !== state.timeOfDay` 则不可用。拆分后：
- 白天在 east_garden_path：只有 `_day` puzzle 可用（`_night` 被 timeOfDay 过滤）。
- 白天完成 `_day` → `completedScenePuzzleIds` 含 `_day`。
- 夜晚再到 east_garden_path：`_day` 被 timeOfDay 过滤，`_night` 未完成 → 可点击完成。
- 反之亦然。**昼夜互不锁定**。✓

#### 4.2.4 旧存档迁移

旧存档 `completedScenePuzzleIds` 含 `puzzle_east_path_cautious_presence`（旧 id）。读档时需迁移为"昼夜都已完成"（保守：旧存档默认昼夜都做过）或"仅白天完成"。**推荐保守迁移**：在 `normalizeWorldStateForClient` / `withNpcWorldDefaults` 中：

```ts
// 旧 id 迁移：旧存档完成过东园幽径 -> 视为白天已完成（夜晚仍可做一次）
if (base.completedScenePuzzleIds.includes("puzzle_east_path_cautious_presence")) {
  if (!base.completedScenePuzzleIds.includes("puzzle_east_path_cautious_presence_day")) {
    base.completedScenePuzzleIds.push("puzzle_east_path_cautious_presence_day");
  }
  base.completedScenePuzzleIds = base.completedScenePuzzleIds
    .filter((id) => id !== "puzzle_east_path_cautious_presence");
}
```

> 迁移点必须落在读档链路（`normalizePuzzleState` / `normalizeWorldStateForClient`），见 1.2 陷阱。

### 4.3 测试组合（对应需求表）

| 白天 | 夜晚 | 预期 | 实现 |
|---|---|---|---|
| 未完成 | 未完成 | 两边均可点击 | 两 puzzleId 都不在 completed，timeOfDay 各匹配一个 |
| 已完成 | 未完成 | 仅夜晚可点击 | 白天 `_day` 在 completed + timeOfDay 过滤 `_night` |
| 未完成 | 已完成 | 仅白天可点击 | 对称 |
| 已完成 | 已完成 | 两边均不可重复领取 | 两 puzzleId 都在 completed |

---

## 5. P1 · 设置中增加"返回主页"

### 5.1 实现

详见 §2.3 的 `onGoHome` 与"返回主页"按钮。核心：

- `SettingsModal` 新增 `onGoHome` prop + 按钮（ghost 样式，危险等级低于"重新开始"）。
- 二次确认：`window.confirm("尚未保存的进度可能会丢失，确定返回主页吗？")`。
- `page.tsx` 传入 `onGoHome={() => router.push("/")}`。
- **不清存档、不触发 reset**——`router.push("/")` 跳主页，四槽存档保留；主页"读取最近存档"仍可读回。

### 5.2 与"重新开始"区分

| 操作 | 行为 | 视觉 |
|---|---|---|
| 重新开始 | `reset()`：清空全部 4 槽 + 旧 key + 辅助 key | ghost，警示文案"所有进度会丢失" |
| 返回主页 | `router.push("/")`：不清任何存档 | ghost，常规文案"尚未保存的进度可能会丢失" |

> 两者按钮相邻放置，"返回主页"样式不使用红/橙警示色，避免与"重新开始"混淆。

---

## 6. P1 · "众生回声"地图 NPC 头像优化

### 6.1 根因（详见 1.6）

`.eden-map-hotspot-avatar`（`globals.css:4671-4679`）`object-fit:cover` 无 `object-position` → 默认居中裁切全身立绘中部 → 头部被圆形裁掉。

### 6.2 修复方案：配置化头像焦点

#### 6.2.1 默认向上偏移（CSS）

```css
/* globals.css · 4671 */
.eden-map-hotspot-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  object-position: 50% 20%;   /* ← 新增：焦点上移，优先显示头部 */
  border: 1.5px solid rgba(246, 219, 144, 0.7);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  background: rgba(13, 18, 14, 0.5);
}
```

`50% 20%` 对全身立绘通常能框住头部+面部。不同体型可单独覆盖（见 6.2.2）。

#### 6.2.2 角色级焦点配置（按需）

在 `NPC_SPRITE`（`page.tsx:375-382`）扩展 `objectPosition` 字段，渲染时内联：

```ts
const NPC_SPRITE: Partial<Record<EdenNpcId, {
  src: string; alt: string; w: number; h: number;
  objectPosition?: string; // 地图头像焦点，默认 "50% 20%"
}>> = {
  eve:      { src: ..., alt: "女人", w: 380, h: 760,  objectPosition: "50% 18%" },
  adam:     { src: ..., alt: "亚当", w: 320, h: 640,  objectPosition: "50% 20%" },
  hedgehog: { src: ..., alt: "刺猬", w: 1254, h: 1254, objectPosition: "50% 35%" }, // 刺猬近方形，焦点略下
  gabriel:  { src: ..., alt: "加百列", w: 1023, h: 1537, objectPosition: "50% 15%" },
  michael:  { src: ..., alt: "米迦勒", w: 1023, h: 1537, objectPosition: "50% 15%" },
  lucifer:  { src: ..., alt: "路西法", w: 1023, h: 1537, objectPosition: "50% 15%" },
};
```

`page.tsx:3008-3016` 渲染处加内联 style：

```tsx
<Image
  key={id}
  src={sprite.src}
  alt={EDEN_NPCS[id].name}
  width={28}
  height={28}
  className="eden-map-hotspot-avatar"
  title={EDEN_NPCS[id].name}
  style={{ objectPosition: sprite.objectPosition ?? "50% 20%" }}
/>
```

> **不修改主场景立绘位置**（主场景用独立 className，不受影响）。仅改地图小头像焦点。

#### 6.2.3 立即刷新

地图头像显示条件 `state.unlockMapNpcLocations`（`page.tsx:2999`）读 state，获得众生回声后 `setState` 触发重渲染，头像立即出现。NPC 移动后 `npcLocations` 变化，`getVisibleNpcsAtLocation` 重算，头像同步更新。**无需额外刷新**。

### 6.3 验收

- 天使（gabriel/michael/lucifer）、刺猬、eve/adam 头像头部完整可见。
- 获得众生回声后地图立即显示头像。
- NPC 移动场景后头像位置同步。
- 读档后头像与 `npcLocations` 一致。
- 多名 NPC 同场景：`.eden-map-hotspot-avatars` flex 排列不重叠（保持）。
- 头像不遮挡场景名称/可前往/需绕行文字（头像在 `top:-14px` 上方，标签在下方，已分离）。

---

## 7. P2 · 刻名石问题弹窗 UI 优化

### 7.1 根因（详见 ScenePuzzleModal.tsx + globals.css）

- `.eden-scene-puzzle-modal`（`globals.css:6525-6536`）`padding:24px`，`max-height` + `overflow-y:auto`（已支持滚动）。
- `.eden-scene-puzzle-freetext` **无任何 CSS**（grep 无匹配）→ 默认 block，无 gap → 输入框与"留下名字"按钮**紧贴**。
- `.eden-scene-puzzle-submit` 也无独立 CSS（继承 `eden-btn--primary`，无 margin）。
- `.eden-scene-puzzle-prompt`（`globals.css:6562-6567`）`margin:14px 0 18px`，正文与输入框间距尚可但偏紧。

### 7.2 修复方案（纯 CSS，不改组件结构与文案）

#### 7.2.1 弹窗内边距与滚动

```css
/* globals.css · 6525 */
.eden-scene-puzzle-modal {
  position: relative;
  width: min(560px, 100%);
  max-height: min(720px, calc(100vh - 48px));
  overflow-y: auto;
  padding: 28px 24px 32px;   /* ← 上 28 / 下 32，增加上下留白 */
  border: 1px solid rgba(214, 186, 112, 0.34);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(25, 35, 27, 0.98), rgba(9, 13, 10, 0.98));
  box-shadow: 0 28px 90px rgba(0, 0, 0, 0.48);
  color: rgba(244, 232, 199, 0.96);
  display: flex;
  flex-direction: column;     /* ← 标题/关闭不被挤压 */
}
```

#### 7.2.2 freetext 容器：输入框与按钮拉开间距

```css
/* globals.css · 新增（紧邻 6636 刻名石自由文本区块） */
.eden-scene-puzzle-freetext {
  display: flex;
  flex-direction: column;
  gap: 16px;                  /* ← 输入框与按钮之间 16px */
  margin-top: 4px;            /* ← 与正文之间增加间距 */
  margin-bottom: 8px;
}

.eden-scene-puzzle-submit {
  width: 100%;
  margin-top: 0;              /* gap 已接管，避免双重间距 */
}

/* 正文与输入框间距再加（针对刻名石 prompt） */
.eden-scene-puzzle-modal .eden-scene-puzzle-prompt {
  margin-bottom: 20px;        /* ← 原 18px 略增 */
}
```

#### 7.2.3 标题/关闭按钮不被挤压

`display:flex; flex-direction:column` 后，`max-height + overflow-y:auto` 滚动时，标题（`eden-scene-puzzle-title`）与关闭按钮（`eden-scene-puzzle-close`，`position:absolute` `top:12px right:12px`）随内容一起滚动。若需求要求"标题和关闭按钮不被挤压"（即滚动时固定），可把标题区改为 sticky：

```css
.eden-scene-puzzle-modal {
  /* overflow-y:auto 保留在 modal */
}
/* 标题与 kicker 不 sticky（内容短时不影响）；如需固定关闭按钮： */
.eden-scene-puzzle-close {
  position: absolute;         /* 已是 absolute，相对 modal */
  top: 12px; right: 12px;
  z-index: 2;
}
```

> 关闭按钮 `position:absolute` 相对 modal 定位，滚动时会在 modal 视口内固定（因为 modal 是定位上下文）。若 modal 内滚动，按钮随内容滚——可改为把标题+关闭包一个 sticky header。**推荐最小改动**：保持现状（刻名石内容不长，一般不滚动），仅当正文过长滚动时接受关闭按钮随滚（仍可点击）。如严格需求，再包 sticky header。

#### 7.2.4 输入框/按钮不超出弹窗

`.eden-scene-puzzle-input`（`globals.css:6655`）`width:100%` + `box-sizing`（需确认全局 `box-sizing:border-box`，Next 模板通常有）。`padding:28px 24px 32px` 保证左右 24px 内边距，输入框 `width:100%` 不溢出。按钮 `eden-btn--primary` 通常 `width:100%`。

#### 7.2.5 提交按钮空输入禁用（已实现，核查）

`ScenePuzzleModal.tsx:105`：`disabled={isLoading || hasSucceeded || trimmed.length === 0}` —— ✅ 已禁用空提交，无需改。

### 7.3 布局顺序核查（对应需求推荐顺序）

当前 `ScenePuzzleModal.tsx:43-180` 顺序：kicker（场景问题）→ title（刻名石）→ prompt（第一段+第二段，`whiteSpace:pre-line`）→ freetext（输入框 + 留下名字按钮）→ 结果/确认。**已与需求推荐顺序一致**，仅间距需调（见 7.2）。

### 7.4 验收

- 1366×768 / 1920×1080 / 1440×900 下弹窗不拥挤、不溢出。
- 输入框与"留下名字"按钮之间有清晰间距（16px）。
- 按钮下方有底部留白（32px）。
- 正文过长时弹窗内容可滚动，标题/关闭按钮可点击。
- 黑金视觉风格不变，文案与核心流程不变。
- 空输入时按钮禁用。

---

## 8. P2 · 注视值左侧图标说明优化

### 8.1 根因（详见 1.3）

注视值左侧的 4 个水滴 SVG（`eden-attention-droplet`，`DivineAttentionViz.tsx:25-43`）绑定 `state.divineAttention`（0-4 等级），但：
1. 形状（水滴/火焰/叶片）不直观，玩家无法判断代表什么。
2. 仅 `title` 悬停提示"神的注视等级：N/4"，无可见名称。
3. 水滴数（0-4 等级）与紧邻的"注视值：X/Y"（累计/阈值）是两个不同数值，加剧混淆。

**确认：该图标代表"神的注视等级"（`state.divineAttention`，0-4），不是行动点。** 行动点是另一组 `eden-ap-dots`（●○，`page.tsx:1780`），已有清晰 `title`。

### 8.2 修复方案：增加可见名称 + 明确数值

#### 8.2.1 水滴旁加可见标签（DivineAttentionViz.tsx）

在 `eden-attention-stage`（`DivineAttentionViz.tsx:61-69`）后追加一个可见文本标签：

```tsx
<span
  className={`eden-attention-stage eden-attention-stage--viz eden-attention-stage--l${safeLevel}`}
  title={`神的注视等级：${safeLevel} / 4`}
  aria-label={`神的注视等级 ${safeLevel} 级`}
>
  {Array.from({ length: 4 }, (_, i) => (
    <Droplet key={i} active={i < safeLevel} index={i} />
  ))}
</span>
<span className="eden-attention-stage-label" aria-hidden="true">
  注视 {safeLevel}/4
</span>
```

#### 8.2.2 CSS

```css
/* globals.css · 紧邻 eden-attention-droplet 区块 */
.eden-attention-stage-label {
  margin-left: 4px;
  font-size: 0.72rem;
  color: rgba(201, 177, 115, 0.82);
  letter-spacing: 0;
  white-space: nowrap;
}
```

#### 8.2.3 区分"等级"与"累计注视值"

进度文本（`DivineAttentionViz.tsx:85-87`）"注视值：{cumulative}/{nextThreshold}" 已说明累计。加水滴标签"注视 N/4"后，两个数值语义清晰：
- 水滴 + "注视 N/4" = 当前注视等级（阶段表现，0-4）
- 进度条"注视值：X/Y" = 累计注视点 / 下一次献礼阈值

> 若担心"注视 N/4"与"注视值 X/Y"仍混淆，可把水滴标签改为"注视等级 N/4"，进度条文本保持"注视值"。**推荐**：水滴标签用"注视等级 N/4"更明确。

#### 8.2.4 即时刷新

水滴 `level={state.divineAttention}`（`page.tsx:1768`）读 state，低语/进入下一时段/获得上限道具后 `setState` 触发重渲染，水滴数与标签立即同步。**无需额外刷新**。需回归测试：
- 读取存档后水滴数 = `state.divineAttention`。
- 进入下一时段（注视归零逻辑）后水滴刷新。
- 获得增加注视上限类道具后（如 `gift_attention_accel` 影响增量，不影响等级上限 4）水滴正确。

### 8.3 验收

- 玩家无需试错即知水滴代表"神的注视等级"，当前 N/4。
- 水滴数与 `state.divineAttention` 一致。
- 悬停仍有详细 title。
- 读取存档/进入下一时段/获得道具后立即刷新。

---

## 9. 涉及文件清单

| 文件 | 改动 | 关联需求 |
|---|---|---|
| `src/hooks/useWorldSave.ts` | 四槽位 + 迁移 + getSlotMetas + onGoHome | P0 存档 / P1 返回主页 |
| `src/components/world/SettingsModal.tsx` | 槽位选择 UI + 返回主页按钮 | P0 存档 / P1 返回主页 |
| `src/components/world/SaveControl.tsx` | （核查，可能同步或废弃） | P0 存档 |
| `src/app/world/page.tsx` | 接线 onGoHome / slotMetas / 昼夜 puzzleId / 头像焦点 / 注视标签 | P0/P1/P2 |
| `src/app/page.tsx` | hasSave 改为遍历四槽 | P0 存档 |
| `src/game/world/types.ts` | 新增 `playerName` 字段 + 初始值 + normalize 4 处 | P0 存档 |
| `src/game/world/puzzleRules.ts` | normalize 补 `playerName`；旧 east_path id 迁移 | P0 存档 / P1 昼夜 |
| `src/game/world/npcRelationRules.ts` | 新增 `recordEncounterForVisibleNpcs` | P0 万物名录 |
| `src/app/api/world/route.ts` | move_to_location 后调 recordEncounter；cloneWorldState 补 `playerName` | P0 万物名录 |
| `src/content/world/scenePuzzles.ts` | 拆 east_path 为 day/night 两个 puzzleId | P1 昼夜 |
| `src/components/world/DivineAttentionViz.tsx` | 水滴旁加可见标签 | P2 注视图标 |
| `src/app/globals.css` | east-path 昼夜坐标 / 头像 object-position / 刻名石弹窗间距 / 注视标签 | P1/P2 |
| `src/content/world/items.ts` | （核查万物名录说明文案，不改） | — |

---

## 10. 回归测试清单（开发完成后必检）

> **执行状态（CodeBuddy，2026-07-12）**：7 项需求已实现并通过 `npm run lint` 与 `npm run build`（无错误）。
> 提交于分支 `feat/chapter1-round3-save-refresh`（commit `0e32f6b`）。
> 下方 `[x]` 表示**代码实现完成且构建/类型校验通过**；带「(需手测)」者为交互行为，需在浏览器中按场景回归确认。
> 关键约束均遵守：存档迁移落在读档链路 normalizer、新增 `playerName` 在 4 处补兜底、刺猬无特殊分支、东园幽径拆两个带 timeOfDay 的 puzzleId、昼/夜坐标与头像焦点均配置化、刻名石仅改 CSS。

### 10.1 存档四槽位（P0）
- [x] 四个槽位可分别保存，槽位摘要正确显示（章节·场景 / 时段·昼夜 / 保存时间）。(需手测)
- [x] 空槽位显示"暂无存档"，读取时空槽禁用。
- [x] 覆盖已有存档弹二次确认；覆盖后只影响该槽，其他三槽不变。(需手测)
- [x] 读取存档弹二次确认；读取后完整恢复状态（位置/时段/AP/注视/NPC/道具/印记/完成记录）。(需手测)
- [x] 旧单存档（`eden:chapter1:world-state:v2`）更新后自动迁移到 slot1，进度不丢。(需手测)
- [x] 5 分钟自动保存写入上次活跃槽（无则 slot1）。
- [x] 主页"读取最近存档"在四槽任一有存档时可用。

### 10.2 返回主页（P1）
- [x] 设置弹窗有"返回主页"按钮，样式危险等级低于"重新开始"(ghost，无红/橙警示)。
- [x] 点击弹二次确认；确认后跳主页（`router.push("/")`），**四槽存档不清空**。
- [x] 主页"读取最近存档"可读回原进度。
- [x] "重新开始"仍清空全部存档，与"返回主页"不混淆。

### 10.3 万物名录（P0）
- [x] 先进多个场景见到 NPC（含未低语），再获万物名录：属性页全部已见 NPC 立即显示精确数值/性格/相处提示。(需手测)
- [x] 获得道具后再进新场景见新 NPC：首次同场即解锁完整信息。
- [x] 刺猬与其他 NPC 规则一致（进入万物受名处即解锁，无特殊分支）。
- [x] 未见过的 NPC 不提前出现/仍锁定。
- [x] 无需再低语一次（已见定义拓宽到场景进入）。
- [x] 保存 → 刷新页面 → 读取：效果不丢失（encounteredNpcIds 随存档持久化）。

### 10.4 东园幽径昼夜（P1）
- [x] 白天交互框坐标对准小路尽头，不遮 NPC/标题/河流；夜晚另校准(`--day`/`--night` 类)。(需手测)
- [x] 白天完成 → 夜晚仍可点击完成一次（反之亦然）。
- [x] 同一版本（白天或夜晚）完成后再次进入不重复打开问题/不重复领奖。
- [x] 四种组合（未未/已未/未已/已已）符合预期表。
- [x] 旧存档完成过东园幽径 → 迁移后白天标记完成，夜晚仍可做。
- [x] 昼夜完成状态写存档并正确恢复。

### 10.5 众生回声地图头像（P1）
- [x] 地图头像头部/面部完整可见（天使/刺猬/eve/adam，object-position 配置化）。(需手测)
- [x] 获得众生回声后地图立即显示头像。
- [x] NPC 移动场景后头像同步更新。
- [x] 读档后头像与 npcLocations 一致。
- [x] 多 NPC 同场景头像不重叠；不遮场景名称/可前往/需绕行。

### 10.6 刻名石弹窗（P2）
- [x] 1366×768 / 1920×1080 / 1440×900 下不拥挤、不溢出（纯 CSS 留白）。(需手测)
- [x] 输入框与"留下名字"按钮有间距（freetext gap 16px）；按钮下方有留白。
- [x] 正文过长可滚动，标题/关闭按钮可点击。
- [x] 空输入时按钮禁用（原逻辑已禁用，未改动）。
- [x] 黑金风格与文案不变。

### 10.7 注视值图标（P2）
- [x] 水滴旁有可见"注视等级 N/4"标签。
- [x] 水滴数 = `state.divineAttention`，与标签一致。
- [x] 读取存档/进入下一时段/获得道具后立即刷新。
- [x] 与行动点（●○）图标明确区分（文案"注视等级" vs "注视值"）。

### 10.8 整体
- [x] 页面刷新、退出主页、保存和读取后，上述状态均保持正确。(需手测)
- [x] `npm run lint` 无新增错误；`npm run build` 通过。

---

## 11. 执行提示词（供 CodeBuddy 启动）

```
执行 doc/第一章/plan_docs/19_CODEBUDDY_TASK_CHAPTER1_PLAYTEST_ROUND3_SAVE_AND_REFRESH.md 的开发任务。

基线：main @ 5f8f009。按 P0 → P1 → P2 顺序实现，每完成一项跑一次回归清单对应小节。

关键约束：
1. 存档迁移必须用读档链路 normalizer（normalizePuzzleState / normalizeWorldStateForClient），
   不能用 withNpcWorldDefaults（见项目记忆 eden-save-normalize-gotcha）。
2. 新增 EdenWorldState 标量字段（playerName）必须在 4 处补 ?? 默认：
   normalizePuzzleState、normalizeWorldStateForClient、cloneWorldStateForPuzzle、cloneWorldState(route.ts)，
   并设 initialEdenWorldState 默认值。
3. 万物名录修复不改属性页判定逻辑（showNumbers = hasLivingNames && encountered 已正确），
   只拓宽 encounteredNpcIds 填充时机（进入场景时标记可见 NPC），刺猬不写特殊分支。
4. 东园幽径昼夜独立用"拆两个 puzzleId（带 timeOfDay）"方案，不新增全局完成状态字段。
5. 地图头像焦点用配置化 objectPosition，不改主场景立绘位置。
6. 刻名石弹窗只改 CSS（间距/留白），不改组件结构与文案。
7. 昼夜坐标、头像焦点用配置化（CSS 类 / NPC_SPRITE 字段），不硬编码单角色分支。

完成后更新本文档"回归测试清单"勾选状态，并输出变更文件列表与测试结果。
```

---

## 附录 A · 关键代码定位速查

| 关注点 | 文件:行 |
|---|---|
| 存档 hook | `src/hooks/useWorldSave.ts:65-163` |
| 存档存储 key | `src/hooks/useWorldSave.ts:36` |
| 读档 normalizer（客户端） | `src/hooks/useWorldSave.ts:14-33` |
| 读档 normalizer（规则层） | `src/game/world/puzzleRules.ts:44-55` |
| 旧存档兜底（读档不调用） | `src/game/world/types.ts:595-686` |
| 设置弹窗 | `src/components/world/SettingsModal.tsx:111-142` |
| 主页存档判断 | `src/app/page.tsx:12,26,53-66` |
| 属性页万物名录判定 | `src/app/world/page.tsx:2543-2561` |
| encounteredNpcIds 填充 | `src/game/world/npcRelationRules.ts:41-45,72` |
| 低语调用 affinity | `src/app/api/world/route.ts:448` |
| 刺猬属性 profile | `src/app/world/page.tsx:223-234` |
| 东园幽径交互框 | `src/app/world/page.tsx:1927-1942` |
| 东园幽径坐标 CSS | `src/app/globals.css:6453-6472` |
| 东园幽径 puzzle 定义 | `src/content/world/scenePuzzles.ts:129-186` |
| 完成状态字段 | `src/game/world/types.ts:442` |
| 地图头像渲染 | `src/app/world/page.tsx:2999-3021` |
| 地图头像 CSS | `src/app/globals.css:4661-4679` |
| NPC_SPRITE 立绘源 | `src/app/world/page.tsx:375-382` |
| 顶部水滴图标 | `src/components/world/DivineAttentionViz.tsx:25-43,61-69` |
| 顶部行动点图标 | `src/app/world/page.tsx:1780-1790` |
| 刻名石弹窗组件 | `src/components/world/ScenePuzzleModal.tsx:43-180` |
| 刻名石弹窗 CSS | `src/app/globals.css:6525-6680` |
| 刻名石 puzzle（万物名录奖励） | `src/content/world/scenePuzzles.ts:99-128` |
| 昼夜背景选择 | `src/app/world/page.tsx:345-372` |
| 可见 NPC 计算 | `src/app/world/page.tsx:889-905` |
