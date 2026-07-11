# 第一章·园中诸声 UI/玩法优化 开发任务文档（CodeBuddy 可直接照改版）
**文档编号**：14（Codex 校正版 v3 · 开发就绪）
**校正依据**：Codex 2026-07-11 逐项核对 `src/app/world/page.tsx`、`src/game/world/*`、`src/content/world/*`、`src/app/api/polish/route.ts`、`src/app/globals.css`、会话 `019f47c6`
**开发主体**：CodeBuddy ｜ **验收主体**：Codex
**当前基线**（#55b）：`npx tsc --noEmit`/`npm run lint`/`npm run build` 0 错误；`test-world-smoke.mjs` 203/0；`test-world-visual-smoke.mjs` 238/238；e2e 3/3
**铁律**：不改 Chapter 0 闭环；不删 `doc/` 内除本文档外文件；不硬编码密钥；移动端不作验收；保留所有 `data-testid`；改状态机须先同步 `design/`。

---

## 零、校正要点（原方案 vs 实际代码）

| 原方案 | 实际 | 处理 |
|--------|------|------|
| 改 `CurrentLocationModal/CurrentGoalModal/GardenVoiceModal` | 三文件不存在，全为 `page.tsx` 内联（HUD:1685 / 侧栏:1696 / 面板:1722） | 见 T2 |
| T1.2 移除自动弹出 | 「园中之声」本就是常驻面板；仅「当前目标」自动出现 | 见 T2 |
| T2.2 移动端适配 | 移动端已弃用 | 移除 |
| T3.2 润色按钮置灰 | `page.tsx:2827` 已 `!activeNpc` | 已实现，跳过 |
| T3 润色走 client.ts+world/route | 独立走 `api/polish/route.ts` | 见 T4 |
| T3.4 恢复 token 统计/复用 duel | duel 统计字符数非 token；polish 无 usage | 改为新增 |
| T4.1 还原三数值属性 | 三数值已存在；天使/刺猬为硬编码假值 | 见 T5 |
| T4.2 献礼 3 选 1 | 会话 019f47c6 设计 6 献礼+三选一；代码仅 2 献礼 | 见 T6（7 献礼重建） |

---

## 一、执行总览（5 阶段，每阶段跑第十一章门禁）

| 阶段 | 任务 | 目标 | 预估 |
|------|------|------|------|
| A | T1 立绘槽位系统 | 6 槽位+分配器+渲染重构 | 2.5h |
| B | T3 刺猬位置 + T2 顶部 UI | 数据一致+布局校验 | 1h |
| C | T4 润色优化 | 静态 loading+人设传参+token 统计 | 1.5h |
| D | T5 双维度统一 + T5.4 门禁分散 + T7 立绘 | 心智双维度+洞察分散+美术 | 2.5h |
| E | T6 神明献礼重建（P0 最大） | 7 献礼+三选一+递进+集满顶点；注视语义反转 | 4h |

T1 先行（渲染基础）；T6 独立（改核心注视机制，须先改 `design/`）。

---

## 二、T1 立绘槽位系统（阶段 A）

### 2.1 新建 `src/game/world/stageSlots.ts`

```ts
import type { EdenNpcId } from "@/game/world/types";

export type StageSlotRole =
  | "center-main" | "flank-left" | "flank-right"
  | "back-left" | "back-right" | "foreground";

export type StageSlot = {
  id: 1 | 2 | 3 | 4 | 5 | 6;
  role: StageSlotRole;
  left: string; bottom: string; zIndex: number; maxWidth: string;
};

export const STAGE_SLOTS: StageSlot[] = [
  { id: 1, role: "center-main", left: "42%", bottom: "6%",  zIndex: 4, maxWidth: "clamp(220px,26vw,340px)" },
  { id: 2, role: "flank-left",  left: "12%", bottom: "5%",  zIndex: 3, maxWidth: "clamp(180px,20vw,280px)" },
  { id: 3, role: "flank-right", left: "70%", bottom: "5%",  zIndex: 3, maxWidth: "clamp(180px,20vw,280px)" },
  { id: 4, role: "back-left",   left: "4%",  bottom: "20%", zIndex: 2, maxWidth: "clamp(150px,16vw,200px)" },
  { id: 5, role: "back-right",  left: "82%", bottom: "20%", zIndex: 2, maxWidth: "clamp(150px,16vw,200px)" },
  { id: 6, role: "foreground",  left: "28%", bottom: "0%",  zIndex: 5, maxWidth: "clamp(110px,12vw,160px)" },
];

const WORLD_OBJECTS = new Set<EdenNpcId>(["forbidden_tree", "tree_of_life"]);
const ANGELS = new Set<EdenNpcId>(["gabriel", "michael", "lucifer"]);

export type StagePlacement = { slot: StageSlot; npcId: EdenNpcId };

/** 把在场 NPC 分配到 6 槽位；世界对象进 backgroundObjects（不占槽位） */
export function allocateStageSlots(
  presentNpcs: EdenNpcId[],
  activeNpc: EdenNpcId | null,
): { placements: StagePlacement[]; backgroundObjects: EdenNpcId[] } {
  const backgroundObjects = presentNpcs.filter((n) => WORLD_OBJECTS.has(n));
  const characters = presentNpcs.filter((n) => !WORLD_OBJECTS.has(n));

  // 排序：activeNpc 首位；其余 天使->刺猬->其他
  const rest = characters.filter((n) => n !== activeNpc).sort((a, b) => {
    const w = (n: EdenNpcId) => (ANGELS.has(n) ? 0 : n === "hedgehog" ? 1 : 2);
    return w(a) - w(b);
  });
  const ordered = activeNpc && characters.includes(activeNpc)
    ? [activeNpc, ...rest] : rest;

  // 槽位消费顺序：1 center-main -> 4,5 back -> 6 foreground -> 2,3 flank
  const slotOrder: StageSlot["id"][] = [1, 4, 5, 6, 2, 3];
  const placements: StagePlacement[] = [];
  for (let i = 0; i < Math.min(ordered.length, 6); i++) {
    placements.push({ slot: STAGE_SLOTS[slotOrder[i] - 1], npcId: ordered[i] });
  }
  if (ordered.length > 6) console.warn("[stageSlots] 超 6 个角色，截断:", ordered.slice(6));
  return { placements, backgroundObjects };
}
```

### 2.2 扩 `NPC_SPRITE`（`page.tsx:369`）补入天使

```ts
const NPC_SPRITE: Partial<Record<EdenNpcId, { src: string; alt: string; w: number; h: number }>> = {
  eve:      { src: CHAPTER0_IMAGES.eveFullbodySprite,  alt: "女人",   w: 380, h: 760 },
  adam:     { src: CHAPTER0_IMAGES.adamFullbodySprite, alt: "亚当",   w: 320, h: 640 },
  hedgehog: { src: CHAPTER1_IMAGES.hedgehogRoundedSprite, alt: "刺猬", w: 1254, h: 1254 },
  gabriel:  { src: CHAPTER1_IMAGES.gabrielSprite, alt: "加百列", w: 1023, h: 1537 },
  michael:  { src: CHAPTER1_IMAGES.michaelSprite,  alt: "米迦勒", w: 1023, h: 1537 },
  lucifer:  { src: CHAPTER1_IMAGES.luciferSprite,  alt: "路西法", w: 1023, h: 1537 },
};
```

### 2.3 重构渲染（`page.tsx:1787-1920` 6 段条件块 -> 槽位驱动）

```tsx
const { placements, backgroundObjects } = useMemo(
  () => allocateStageSlots(currentNpcs, activeNpc),
  [currentNpcs, activeNpc],
);

// 世界对象（背景层，保留原 CSS div）
{backgroundObjects.includes("tree_of_life") && (
  <div className="eden-stage-world-object eden-stage-tree-of-life" />
)}

// 角色立绘：槽位驱动
{placements.map(({ slot, npcId }) => (
  <button
    key={npcId}
    className={`eden-stage-slot eden-stage-slot--${slot.id} ${activeNpc === npcId ? "eden-stage-slot--active" : "eden-stage-slot--dim"}`}
    style={{ left: slot.left, bottom: slot.bottom, zIndex: slot.zIndex, maxWidth: slot.maxWidth }}
    onClick={(e) => {
      e.stopPropagation();
      if (npcId === "hedgehog") { handleHedgehogClick(); return; } // 保留双击逻辑
      handleNpcInteract(npcId);
    }}
    aria-label={`与${NPC_SPRITE[npcId]?.alt ?? ""}低语`}
    data-testid={npcId === "hedgehog" ? "scene-action-hedgehog" : `world-stage-${npcId}`}
    tabIndex={activeNpc === npcId ? -1 : 0}
  >
    <Image src={NPC_SPRITE[npcId]!.src} alt={NPC_SPRITE[npcId]!.alt}
      width={NPC_SPRITE[npcId]!.w} height={NPC_SPRITE[npcId]!.h}
      className={`eden-stage-slot-img ${ANGEL_SET.has(npcId) ? "eden-stage-slot-img--angel" : ""}`}
      priority={npcId === activeNpc} />
  </button>
))}
```

> 刺猬双击逻辑（原 `page.tsx:1824` 的 `hedgehogClickCountRef`/`hedgehogClickTimerRef`）抽成 `handleHedgehogClick()`，行为不变，`data-testid="scene-action-hedgehog"` 保留。

### 2.4 CSS（`src/app/globals.css`）新增

```css
.eden-stage-slot { position:absolute; background:transparent; border:none; padding:0; cursor:pointer; transition:filter .8s ease,opacity .8s ease; }
.eden-stage-slot img { width:100%; height:auto; object-fit:contain; pointer-events:none; }
.eden-stage-slot--dim { opacity:.78; filter:saturate(.85) brightness(.95) drop-shadow(0 0 14px rgba(255,228,170,.16)); }
.eden-stage-slot--active img { opacity:.92; filter:saturate(1) brightness(1.05) drop-shadow(0 0 22px rgba(255,228,170,.3)); }
.eden-stage-slot-img--angel { opacity:.78; } /* 远影 */
```
废弃旧 `.eden-stage-angel--gabriel/--michael/--lucifer` 的 position 规则（保留可删）。

### 2.5 步骤
1. 建 `stageSlots.ts`，`npx tsc --noEmit` 通过。
2. 扩 `NPC_SPRITE`，抽 `handleHedgehogClick`。
3. 替换 `page.tsx:1787-1920` 为槽位渲染。
4. 加 CSS，删旧 angel position。
5. 跑 smoke + 视觉 smoke + 人工多 NPC 同屏（园子中央 Eve+Adam+树）。

验收：≤6 立绘无重叠；切换场景/NPC 移动后分配正确；刺猬双击/天使低语/树点击保留；`data-testid` 不变。

---

## 三、T2 顶部 UI（阶段 B）

- **布局校验**（`page.tsx:1573` `<header class="eden-header">` 三段 left/center/right，SaveControl 在 right）：1280/1440/1920 三档校验无重叠；若 1280 挤压仅微调间距，不重构三段。
- **「当前目标」侧栏**（`page.tsx:1696`，`showObjectiveHint = isExploreActive && !state.hasDismissedObjectiveHint`）：确认首次进 explore 提示一次、关闭后同局不再自动出现（现状已是 `hasDismissedObjectiveHint` 控制，校验逻辑正确即可）。
- **「园中之声」/「当前位置」**：保持常驻语义，不弹窗化、不加关闭按钮。「当前位置」场景切换可加一次性淡入高亮（CSS transition，可选）。

验收：1280px+ 顶部无重叠；无错误弹窗化常驻组件。

---

## 四、T3 刺猬位置（阶段 B）

- `src/game/world/types.ts:480`：`hedgehog: "east_garden_path"` -> `"adam_garden_work"`（万物受名处，对齐 `worldHedgehogRules` 叙事「万物受名处的草丛」）。
- `src/content/world/locations.ts`：从 `east_garden_path` 的 `defaultNpcs/dayNpcs/nightNpcs` 移除 `hedgehog`（加百列独占）；`adam_garden_work` 保留 `hedgehog`。检查 `tree_court` 是否也列刺猬，按设计保留或清理，确保动态 state 与静态列表一致。
- 检查 `npcScheduleRules` 无刺猬移动调度覆盖新初始位置。

验收：进「万物受名处」刺猬显示且叙事一致；动态 state 与静态 NPC 列表不矛盾。

---

## 五、T4 润色优化（阶段 C）

### 5.1 移除旋转动画（`globals.css:6633`）
```css
/* 删除 .eden-btn--polish-busy 的 animation: eden-polish-spin... 与 @keyframes eden-polish-spin */
.eden-btn--polish-busy { opacity:.7; } /* 静态：仅降透明度 + 「润色中…」文字 */
```

### 5.2 润色传人设/上下文（`src/app/api/polish/route.ts`）
请求体扩为 `{ text; npcId?; dialogueHistory? }`；按 `npcId` 取 `getNpcRelationProfile(npcId)?.playerVisible` 拼入 system prompt：
```ts
const POLISH_SYSTEM_PROMPT = "你是伊甸园中的蛇，将玩家输入润色为符合伊甸园内神话风格的低语，保持原意，短句，不用现代口语/网络语/辩论腔，不超过50字。";
// 若 npcId：
const profile = npcId ? getNpcRelationProfile(npcId as EdenNpcId) : null;
const persona = profile?.playerVisible;
const sys = persona
  ? `${POLISH_SYSTEM_PROMPT}\n对话对象：${persona.persona}，在意：${persona.caresAbout}。润色要贴合此角色语境。`
  : POLISH_SYSTEM_PROMPT;
const messages: ChatMessage[] = [
  { role: "system", content: sys },
  ...(dialogueHistory ?? []).slice(-4).map(m => ({ role: m.role, content: m.content } as ChatMessage)),
  { role: "user", content: source },
];
```
响应增加 token：`return Response.json({ ok: true, polished, tokens: result.data?.usage?.total_tokens ?? null });`

### 5.3 前端（`page.tsx:913 handlePolish`）
请求体加 `npcId: activeNpc ?? undefined` 与最近对话历史。新增累计 state：
```ts
const [polishTokensTotal, setPolishTokensTotal] = useState<number>(() =>
  Number(localStorage.getItem("eden:world:polish-tokens") ?? 0));
// handlePolish 成功后：
if (typeof data.tokens === "number") {
  const next = polishTokensTotal + data.tokens;
  setPolishTokensTotal(next);
  localStorage.setItem("eden:world:polish-tokens", String(next));
}
```
「蛇（我）」页签（`page.tsx:2358`）Buff 区上方加：
```tsx
<p className="eden-section-title">润色消耗</p>
<p style={{color:"#b7b08e",fontSize:"0.85rem"}}>本次 {lastPolishTokens ?? "-"} · 累计 {polishTokensTotal} token</p>
```

验收：无旋转动画；润色贴合对象语气；「蛇（我）」可见本次/累计 token；mock 无 usage 显示「-」；失败兜底保持原文。

---

## 六、T5 心智模型统一双维度（阶段 D）

### 6.1 状态层：天使/刺猬加 obedience（`src/game/world/types.ts` NpcRelationState）
```ts
export type NpcRelationState = {
  affinity: number;          // = serpentTrust 对玩家好感
  obedience: number;         // 对神信仰（天使/刺猬用，初值取世界圣经）
  rewardEligible: boolean;
  rewardClaimed: boolean;
  lastAffinitySignature: string | null;
};
```
`npcRelations.ts` angelProfile 初值补 obedience（米迦勒 95/加百列 85/路西法 40）；刺猬 60。`ensureRelation`（`npcRelationRules.ts:24`）fresh 对象补 `obedience: profile?.initialObedience ?? 50`。

### 6.2 `applyNpcAffinity`（`npcRelationRules.ts:62`）同步微调 obedience
```ts
// 在 relation.affinity = newAffinity; 之后：
if (npcId === "lucifer" && (inputTag === "tempt_wisdom") && strongHit) {
  relation.obedience = Math.max(0, relation.obedience - 3); // 路西法对质疑响应，幅度可调
}
// 忠诚天使/刺猬 obedience 不变
```

### 6.3 显示层：`buildAttributeProfile`（`page.tsx:181`）全 NPC 改双维度 2 行
```ts
function buildAttributeProfile(npcId, worldState): AttributeProfile {
  const rel = worldState.npcRelations?.[npcId];
  const relProfile = getNpcRelationProfile(npcId);
  switch (npcId) {
    case "eve": return {
      title: EDEN_NPCS.eve.name, subtitle: EDEN_NPCS.eve.shortDesc,
      summary: "她仍记得禁令，但每一次温柔的追问都会让她更想理解死亡、善恶与自己的判断。",
      rows: [
        { label: "对神信仰", value: worldState.eveMind.obedience, tone: "obedience" },
        { label: "对玩家好感", value: worldState.eveMind.serpentTrust, tone: "trust" },
      ],
      notes: ["主要目标","可推进自我意识路径"],
    };
    case "adam": return {
      title: "亚当", subtitle: EDEN_NPCS.adam.shortDesc,
      summary: "他亲自听过命令，更难被蛇诱导；但他特别听那个女人的话。",
      rows: [
        { label: "对神信仰", value: worldState.adamMind.obedience, tone: "obedience" },
        { label: "对玩家好感", value: clampPercent(100 - worldState.adamMind.suspicionTowardSerpent), tone: "trust" },
      ],
      notes: ["情报对象","特别听夏娃的话","不可触发吃果结局"],
    };
    case "hedgehog": return {
      title: "刺猬", subtitle: EDEN_NPCS.hedgehog.shortDesc,
      summary: "它不能给出答案，只会用细小的动作回应园中的风、脚步和危险。",
      rows: [
        { label: "对神信仰", value: rel?.obedience ?? 60, tone: "obedience" },
        { label: "对玩家好感", value: rel?.affinity ?? 35, tone: "trust" },
      ],
      notes: ["氛围生灵","不推进结局"],
    };
    case "gabriel": return angelProfile("gabriel", rel, relProfile);
    case "michael":  return angelProfile("michael", rel, relProfile);
    case "lucifer":  return angelProfile("lucifer", rel, relProfile);
    // forbidden_tree / tree_of_life / default(serpent) 保留各自 2 行
  }
}
function angelProfile(name, rel, p) {
  const init = { gabriel:{o:85,a:15}, michael:{o:95,a:5}, lucifer:{o:40,a:30} }[name];
  return {
    title: EDEN_NPCS[name].name, subtitle: EDEN_NPCS[name].shortDesc,
    summary: p?.playerVisible.persona ?? "",
    rows: [
      { label: "对神信仰", value: rel?.obedience ?? init.o, tone: "obedience" },
      { label: "对玩家好感", value: rel?.affinity ?? init.a, tone: "trust" },
    ],
    notes: [p?.playerVisible.caresAbout ?? ""],
  };
}
```
**删除所有第三行风味项**（声音敏锐度/后果感知/可能性感知/小兽警觉/自判/对女人牵挂）。Eve/Adam 既有心智逻辑**不改**（规则4），仅显示投影双维度。未解锁模糊态（`fuzzyStage`）保留。

### 6.4 同步 `design/`
更新 `01_world_bible.md §3` 已是双维度（无需改）；新增说明「天使/刺猬 obedience 初值对齐圣经，路西法响应质疑信号」。

验收：全 NPC 显示双维度 2 行且数值真实；Eve/Adam 逻辑未改；无第三行假属性。

---

## 七、T5.4 洞察门禁分散（阶段 D）

`page.tsx:2253` 改 `showDetailed` 为分层：
```ts
const hasLivingNames = (state.itemCounts?.["resonance_living_names"] ?? 0) > 0;
const encountered = state.encounteredNpcIds.includes(mindTabNpc);
const showNumbers = hasLivingNames && encountered;          // 万物名录：解锁双维度数值
// 牵绊道具解锁该 NPC 深层关系（曾获得 = usedItemIds 或 inventory）
const BOND_ITEM: Record<EdenNpcId,string> = {
  eve:"resonance_her_voice", adam:"resonance_quiet_stone", michael:"resonance_river_dew",
  gabriel:"resonance_herald_feather", lucifer:"resonance_lucifer_star", hedgehog:"resonance_hedgehog_bristle",
};
const hasBond = (n:EdenNpcId) => {
  const id = BOND_ITEM[n]; if(!id) return false;
  return state.inventory.includes(id) || state.usedItemIds.includes(id);
};
const showRelation = showNumbers && hasBond(mindTabNpc);   // 深层关系情报
```
- `showNumbers` 控制 2 行数值进度条；`showRelation` 控制「关系」区（persona/caresAbout/closerWhen/waryWhen/赠礼）。
- 未解锁仍显示模糊态 + 提示「获得万物名录/对应牵绊后可见更多」。

验收：万物名录只解锁数值；持对应牵绊道具才显示深层关系；消耗后洞察不丢失；不新增状态字段。

---

## 八、T6 神明献礼系统重建（阶段 E，P0 最大）

> **先改 `design/`**：`01_world_bible.md §3` 注视语义改「正向累计资源」；`RESONANCE_FULL_DESIGN.md` 2 献礼 -> 7 献礼。再改码。

### 8.1 类型（`src/game/world/types.ts`）
```ts
export type DivineGiftId =
  | "gift_all_seduction_up" | "gift_attention_accel" | "gift_resonance_double"
  | "gift_threshold_cut" | "gift_free_move" | "gift_whisper_anywhere"
  | "gift_awaken_desire";

// 注视改累计：保留 divineAttention(0-4) 作 viz 当前等级，新增累计计数
divineAttention: DivineAttentionLevel;        // 0-4 viz
divineAttentionCumulative: number;            // 累计点（never reset），驱动三选一
divineGiftsOwned: DivineGiftId[];             // 已选献礼
divineVisitCount: number;                     // = divineGiftsOwned.length（兼容旧字段）
```
`DEPRECATED_ITEMS` 加入旧 `gift_revealing_light`/`gift_wide_path_seal`（存档迁移）。

### 8.2 规则层 `src/game/world/divineGiftRules.ts`（重写）
```ts
export const DIVINE_GIFT_THRESHOLDS = [2, 4, 6, 8, 10, 12]; // 累计注视点触发第 2~7 个三选一
export const DIVINE_GIFT_POOL: DivineGiftId[] = [
  "gift_all_seduction_up","gift_attention_accel","gift_resonance_double",
  "gift_threshold_cut","gift_free_move","gift_whisper_anywhere","gift_awaken_desire",
];

/** 从未选过的献礼中随机抽 3 个供三选一 */
export function rollGiftChoices(owned: DivineGiftId[]): DivineGiftId[] {
  const remain = DIVINE_GIFT_POOL.filter(g => !owned.includes(g));
  return remain.sort(() => Math.random() - 0.5).slice(0, 3);
}

/** 是否达到下一次三选一阈值（开局后第 N 个，N=owned.length） */
export function shouldTriggerGiftChoice(state: EdenWorldState): boolean {
  const owned = state.divineGiftsOwned.length;
  if (owned >= 7) return false;
  if (owned === 0) return false; // 开局单独触发
  const threshold = DIVINE_GIFT_THRESHOLDS[owned - 1];
  return state.divineAttentionCumulative >= threshold;
}

/** 选定一个献礼（玩家三选一点击） */
export function claimDivineGift(state: EdenWorldState, giftId: DivineGiftId): void {
  if (state.divineGiftsOwned.includes(giftId)) return;
  state.divineGiftsOwned.push(giftId);
  state.divineVisitCount = state.divineGiftsOwned.length;
  state.divineGiftHistory.push({ timeSlot: state.timeSlot, giftId, reason: "三选一" });
  // 集满顶点：全 NPC 对玩家好感=100
  if (state.divineGiftsOwned.length >= 7) applyGiftCapstone(state);
}

/** 集满 7：强制全 NPC 对玩家好感=100（obedience 不变） */
export function applyGiftCapstone(state: EdenWorldState): void {
  state.eveMind.serpentTrust = 100;
  state.adamMind.suspicionTowardSerpent = 0; // =>100
  for (const npc of ["gabriel","michael","lucifer","hedgehog"] as EdenNpcId[]) {
    const r = state.npcRelations[npc] ?? (state.npcRelations[npc] = { affinity:0, obedience:50, rewardEligible:false, rewardClaimed:false, lastAffinitySignature:null });
    r.affinity = 100; r.rewardEligible = true;
  }
}
```
删除旧 `triggerDivineGiftIfFull`/`resolveDivineGift`/`grantDivineGift`（或保留 `grantDivineGift` 兼容但不再用于自动发放）。

### 8.3 注视累计（`divineAttentionRules.ts`）
`applyDivineAttention` 改为同时更新累计：
```ts
export function applyDivineAttention(state: EdenWorldState, delta: number): void {
  state.divineAttention = Math.max(0, Math.min(4, state.divineAttention + delta)) as DivineAttentionLevel;
  state.divineAttentionCumulative = Math.max(0, state.divineAttentionCumulative + delta);
}
```
`computeDivineAttentionDelta` 不变（仍算单次增量）。`天眷隐声`献礼生效时 delta *= 1.5（在调用处或 modifier 里）。

### 8.4 道具（`src/content/world/items.ts`）
删除旧 `gift_revealing_light`/`gift_wide_path_seal` 定义；新增 7 个 `kind: "passive"` 献礼（title/description/shortEffect/icon）。`resonanceRules`/`computePassiveItemModifiers`（`itemRules.ts:99`）接入 7 种被动效果：
- `gift_all_seduction_up`：低语效果系数 ×1.35
- `gift_attention_accel`：注视 delta ×1.5
- `gift_resonance_double`：回响效果 ×2
- `gift_threshold_cut`/`gift_awaken_desire`：在 Eve 提示词注入对应句（构建 prompt 处判断 `divineGiftsOwned.includes(...)`）
- `gift_free_move`：移动 AP cost = 0
- `gift_whisper_anywhere`：低语同场景校验放行

### 8.5 前端（`page.tsx`）
- **开局三选一**：`handleIntroAdvance`（`page.tsx:768`）末拍进 explore 前，若 `divineGiftsOwned.length===0` 弹三选一弹窗（`rollGiftChoices`），选后 `claimDivineGift` 再 `phase:"explore"`。
- **递进三选一**：低语/行动后若 `shouldTriggerGiftChoice(state)`，弹三选一弹窗。
- **集满顶点**：`claimDivineGift` 后若 length===7，播放顶点演出（全 NPC 好感=100 提示）。
- `DivineAttentionViz`：改为显示累计进度 `divineAttentionCumulative` / 下一阈值。
- 旧 `divineGiftToast`（`page.tsx:1942`）改为三选一弹窗复用或保留为选中提示。

### 8.6 成就（`src/content/world/achievements.ts:256`）
`divine_gift_first` desc 改「首次三选一获得献礼」；`divine_gift_three` 改「累计获 3 献礼」；新增 `divine_gift_all`「集满 7 献礼，神完全眷顾」。

### 8.7 步骤
1. 改 `design/`（world bible §3 + RESONANCE_FULL_DESIGN）。
2. `types.ts`：扩 DivineGiftId + 累计字段 + 存档迁移。
3. `divineGiftRules.ts` 重写；`divineAttentionRules.ts` 改累计。
4. `items.ts` 7 passive + `resonanceRules`/modifier 接入。
5. `page.tsx` 三选一弹窗 + 递进 + 顶点 + viz。
6. 成就调整。
7. smoke/visual smoke 覆盖三选一/递进/集满。

验收：开局三选一可选 1；递进注视触发后续三选一；集满 7 全 NPC 好感=100；7 种被动效果生效；旧 2 献礼移除无残留；`design/` 同步。

---

## 九、T7 路西法立绘（阶段 D）
- 替换 `public/assets/chapter1/images/npc_lucifer_sprite.png` 为银蓝/暗金风格，与加百列白金区分，符合「明亮温和带反叛感」。
- `src/game/assets.ts:63` 路径不变。接入 T1 槽位后确认同屏不混淆。
- AI 生成提示词记录到 AI 创作说明（提交材料）。

---

## 十、代码修改范围映射

| 任务 | 文件 | 说明 |
|------|------|------|
| T1 | `src/game/world/stageSlots.ts`（新） | 6 槽位 + `allocateStageSlots` |
| T1 | `src/app/world/page.tsx:369,1787-1920` | `NPC_SPRITE` 扩天使；渲染重构为槽位驱动 |
| T1 | `src/app/globals.css` | `.eden-stage-slot--1..6`；废弃旧 angel position |
| T2 | `src/app/world/page.tsx`（header/侧栏/HUD） | 布局校验；当前目标逻辑确认 |
| T3 | `src/game/world/types.ts:480` | 刺猬初始位置改 `adam_garden_work` |
| T3 | `src/content/world/locations.ts` | 刺猬归属与动态 state 一致 |
| T4 | `src/app/globals.css:6633` | 移除旋转动画 |
| T4 | `src/app/api/polish/route.ts` | 传人设/历史；透出 `tokens` |
| T4 | `src/app/world/page.tsx:913,2358` | 调用传参；token 累计与展示 |
| T5 | `src/game/world/types.ts` NpcRelationState + `npcRelationRules.ts` | 天使/刺猬加 `obedience`；路西法响应质疑 |
| T5 | `src/content/world/npcRelations.ts` | obedience 初值对齐圣经 |
| T5 | `src/app/world/page.tsx:181 buildAttributeProfile` | 全 NPC 双维度 2 行，删第三行 |
| T5.4 | `src/app/world/page.tsx:2253 showDetailed` | 分层：万物名录解锁数值；牵绊道具解锁深层关系 |
| T6 | `src/game/world/types.ts` | DivineGiftId 扩 7；注视累计字段；存档迁移 |
| T6 | `src/game/world/divineGiftRules.ts` + `divineAttentionRules.ts` | 三选一+抽样+集满顶点；注视正向累计 |
| T6 | `src/content/world/items.ts` + `src/game/world/resonanceRules.ts` | 7 献礼 passive；7 种被动增益 |
| T6 | `src/app/world/page.tsx`（intro+递进+顶点）+ `DivineAttentionViz` | 三选一弹窗 + 集满演出；注视累计进度 |
| T6 | `src/content/world/achievements.ts` | divine_gift 调整 + 集满成就 |
| T7 | `public/assets/chapter1/images/npc_lucifer_sprite.png` | 替换立绘 |

---

## 十一、阶段验证门禁（每阶段结束必跑）

| 门禁 | 命令 | 标准 |
|------|------|------|
| 类型 | `npx tsc --noEmit` | 0 错误 |
| 规范 | `npm run lint` | 0 警告/错误 |
| 构建 | `npm run build` | EXIT=0 |
| 规则单测 | `node scripts/test-scene-puzzle-rules.mjs` | 全绿 |
| 视觉 smoke | `node scripts/test-world-visual-smoke.mjs` | ≥238 全绿 |
| world smoke | `node scripts/test-world-smoke.mjs` | ≥203 全绿 |
| e2e | `npm run test:e2e -- tests/e2e/chapter1-mechanics.spec.ts --project=desktop-chromium` | 3/3 |
| 玩法回归 | 人工 | 动作链/流式/成就/试炼/言语分裂/献礼 |

阶段 A 后必须先过 smoke+视觉 smoke+人工多 NPC 同屏无重叠再进 B；阶段 E 改注视核心，每子步骤跑 smoke。

---

## 十二、自校验清单（提交前全过）

- `npx tsc --noEmit` 0 错误；`npm run lint` 0；`npm run build` EXIT=0
- `test-world-smoke.mjs` ≥203；`test-world-visual-smoke.mjs` ≥238；e2e 3/3
- 核心玩法回归（动作链/流式/成就/试炼/言语分裂/献礼）
- 立绘槽位：多 NPC 同场景无重叠
- 所有 `data-testid` 不变；无新增明文密钥
- 不改 `doc/` 内除本文档外文件
- T5 双维度统一（Eve/Adam 仅显示投影不改逻辑）；T6 7 献礼+三选一+集满顶点且注视改累计（须先改 `design/`）；T5.4 门禁分散复用 usedItemIds 不新增状态
- 无超出范围修改

---

## 十三、提交要求
1. Commit：`[优化] 第一章 UI/玩法优化 完成T1-T7（按实际范围）`，备注阶段。
2. 不改 `doc/` 内除本文档外文件；不提交临时日志/未用资源。
3. T5/T6 涉及设计变更须同步 `design/` 并补 AI 创作说明。
4. 提交后通知 Codex 独立复验。

---

## 十四、给 CodeBuddy 的执行建议
1. **严格按阶段**：A(T1) -> B(T3+T2) -> C(T4) -> D(T5+T5.4+T7) -> E(T6)。T1 先行；T6 独立且最大。
2. **T1 保 testid**：smoke/视觉 smoke 大量断言 `data-testid`，重构逐个核对。
3. **T1 先建 `stageSlots.ts` 跑 tsc，再改 page.tsx 渲染，最后改 CSS**，每步跑 smoke。
4. **T6 须先改 `design/`**（world bible §3 注视语义 + RESONANCE_FULL_DESIGN 7 献礼）再改码；注视改累计、旧 2 献礼移除要彻底；每子步骤跑 smoke。
5. **T5 Eve/Adam 不改逻辑**（规则4），仅 `buildAttributeProfile` 显示投影双维度；天使/刺猬加 obedience。
6. **兜底优先**：T4 token 在 mock/无 usage 显示「-」，润色失败保持原文；T1 分配器超 6 截断并 warn；T6 三选一候选不足 3 个时全展示。
