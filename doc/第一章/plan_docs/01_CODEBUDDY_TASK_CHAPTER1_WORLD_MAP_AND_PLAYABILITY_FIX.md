# 01 CodeBuddy 开发任务：第一章地图交互阻断、NPC 输出清洗与可玩性优化

> 目标读者：CodeBuddy  
> 当前阶段：第一章「园中诸声」P0 返修与试玩可用性优化  
> 优先级：P0/P1  
> 重要约束：CodeBuddy 负责代码实现与关键调试；Codex 只提供测试报告、问题复现和本任务单。请保留 CodeBuddy 对话记录作为比赛提交证据链。

---

## 一、背景与测试结论

第一章 `/world` 已经具备后端规则层闭环：

```text
intro -> explore -> state/tool action -> ending
```

Codex 本轮复测结果：

- `npm run lint`：通过。
- `npx tsc --noEmit`：通过。
- `npm run build`：通过。
- `node scripts/test-world-smoke.mjs`：在本地 dev server 运行于 `localhost:3019` 时通过 15/15。
- 规则层移动、非相邻移动拒绝、异地观察拒绝、成功吃果链、神的注视失败链均可用。

但玩家侧仍有 P0 阻断：

1. **地图无法点击进入其他区域**  
   浏览器实测 `/world` 地图弹层只显示静态地图图片和“观察此地”。地图大图没有任何 `.eden-map-hotspot` 按钮；地点节点 DOM 存在，但被 CSS 隐藏，computed display 为 `none`，bounding box 为 `null/0`。

2. **亚当对白可能泄露 JSON**  
   对亚当输入“你可知道死是什么？”后，页面显示类似：

   ```text
   {"eveReply":"我听见了你的声音。可我仍然记得祂说不可吃。...","inputTag":"tempt_wisdom","toolCall":null}
   ```

   这会破坏角色可信度，并且字段名 `eveReply` 出现在亚当对白中。

3. **第一章视觉 smoke 脚本与实现漂移**  
   `node scripts/test-world-visual-smoke.mjs` 当前失败 13 项。其中一部分是真问题（地图热点缺失），一部分是旧选择器/旧结构没有同步更新。

4. **可玩性仍偏“功能堆叠”**  
   第一章已经有 5 地点、5 NPC/对象、神的注视、线索和禁忌动作链，但玩家当前不容易理解：
   - 为什么要移动；
   - 哪些地点能去；
   - 每个地点获得什么线索；
   - 线索如何强化低语；
   - 神的注视带来什么风险。

另一份测试报告 `doc/游戏测试报告_2026-06-19.md` 可作为通用参考，尤其是 AI API 响应等待、对话历史上限、错误提示友好度、资源加载和可玩性增强建议。但本轮实现优先级以第一章 `/world` 阻断为准。

---

## 二、请先读取

开始实现前，请先读取以下文件，避免和当前项目约束冲突：

- `README.md`
- `package.json`
- `AGENTS.md`
- `docs/PROJECT_CONTEXT.md`
- `doc/产品需求文档.md`
- `doc/DEMO剧情与夏娃行为准则.md`
- `doc/游戏测试报告_2026-06-19.md`
- `doc/第一章/开发文档.md`
- `design/00_project_overview.md`
- `design/01_world_bible.md`
- `design/chapters/chapter0_first_fall.md`
- `design/agents/eve_behavior_rules.md`
- `design/tools/tool_calling_rules.md`
- `src/app/world/page.tsx`
- `src/app/api/world/route.ts`
- `src/app/api/world/tool/route.ts`
- `src/app/globals.css`
- `src/content/world/locations.ts`
- `src/content/world/clues.ts`
- `src/content/world/npcs.ts`
- `src/game/world/types.ts`
- `src/game/world/toolRules.ts`
- `src/game/world/worldActions.ts`
- `src/game/world/mindRules.ts`
- `src/agents/world/worldAgentPrompts.ts`
- `src/agents/common/naturalizeNpcReply.ts`
- `scripts/test-world-smoke.mjs`
- `scripts/test-world-visual-smoke.mjs`

重点以 `/world` 当前代码和 `docs/PROJECT_CONTEXT.md` 最新测试结论为准。

---

## 三、P0 修复 1：地图必须可点击移动

### 3.1 当前复现

复现路径：

```text
1. 启动 dev server。
2. 打开 http://localhost:3019/world。
3. 点击“继续”直到“进入伊甸园”。
4. 点击顶部“地图”。
5. 尝试点击地图大图上的其他区域。
```

当前结果：

- 地图大图不可点击。
- 没有地点热点标记。
- 地点节点列表被隐藏。
- 玩家无法通过地图进入其他区域。

### 3.2 已定位的关键代码

`src/app/world/page.tsx` 中地图弹层只渲染了静态图片：

```tsx
<div className="eden-map-image-wrap" style={{ position: "relative" }}>
  <Image ... />
</div>
```

但没有在图片上渲染 `.eden-map-hotspot`。

`src/app/globals.css` 中存在：

```css
.eden-game--world .eden-map-grid,
.eden-game--world .eden-map-layer > .eden-location-npcs,
.eden-game--world .eden-map-layer > .eden-location-actions,
.eden-game--world .eden-map-layer > .eden-npc-dialogue-hints {
  display: none;
}
```

这条规则把地图弹层内的 `.eden-map-grid` 也隐藏了。

### 3.3 修复目标

地图弹层必须同时支持两种移动方式：

1. **点击地图大图上的地点热点移动。**
2. **点击地图下方地点列表移动。**

如果目标不可直达，不要静默失败，要给玩家明确反馈：

```text
那里不与当前位置相连，需要先前往园中央。
```

### 3.4 推荐实现

#### A. 增加地图热点配置

在 `src/app/world/page.tsx` 或更合适的内容文件中新增地点坐标配置。

推荐使用百分比坐标，避免依赖具体像素：

```ts
const MAP_HOTSPOTS: Record<EdenLocationId, { x: number; y: number; labelOffset?: "top" | "bottom" }> = {
  four_river_source: { x: 24, y: 20, labelOffset: "bottom" },
  adam_garden_work: { x: 24, y: 68, labelOffset: "top" },
  central_meadow: { x: 50, y: 50, labelOffset: "bottom" },
  tree_court: { x: 76, y: 38, labelOffset: "bottom" },
  naming_stone_bank: { x: 42, y: 76, labelOffset: "top" },
};
```

坐标可以根据实际地图图像微调。重点是：

- 标记必须和图上区域大致对应；
- 当前地点要高亮；
- 可直达地点要明显可点；
- 不可直达地点可显示为锁定/灰化，但点击时最好给原因，而不是完全无反馈。

#### B. 在地图图片上渲染 hotspot

在 `.eden-map-image-wrap` 内 `Image` 后追加：

```tsx
{(Object.keys(EDEN_LOCATIONS) as EdenLocationId[]).map((locId) => {
  const loc = EDEN_LOCATIONS[locId];
  const isCurrent = locId === state.locationId;
  const isReachable = currentLocation.connections.includes(locId);
  const pos = MAP_HOTSPOTS[locId];

  return (
    <button
      key={locId}
      className={`eden-map-hotspot ${isCurrent ? "eden-map-hotspot--current" : ""} ${!isReachable && !isCurrent ? "eden-map-hotspot--locked" : ""}`}
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      onClick={() => handleMapLocationClick(locId)}
      disabled={isLoading}
      aria-label={`前往${loc.name}`}
    >
      <span className="eden-map-hotspot-label">{loc.name}</span>
      <span className="eden-map-hotspot-state">
        {isCurrent ? "你在这里" : isReachable ? "可前往" : "需绕行"}
      </span>
    </button>
  );
})}
```

不要直接 `disabled={!isReachable}`，否则玩家点不可直达地点时得不到解释。推荐交给 `handleMapLocationClick` 给出提示。

#### C. 增加统一点击处理

```ts
const handleMapLocationClick = useCallback((locId: EdenLocationId) => {
  if (locId === state.locationId) {
    setSystemHint("你已经在这里。");
    return;
  }

  if (!currentLocation.connections.includes(locId)) {
    const via = EDEN_LOCATIONS.central_meadow.name;
    setSystemHint(`那里不与当前位置相连，需要先前往${via}。`);
    return;
  }

  handleToolCall("move_to_location", { locationId: locId });
}, [state.locationId, currentLocation.connections, handleToolCall]);
```

如果某些非相邻地点并不都经由园中央，请根据 `connections` 给出更准确的相邻提示。

#### D. 修复 `.eden-map-grid` 被隐藏

不要让 Demo 化样式误伤地图弹层。

推荐改为只隐藏主舞台旧网格：

```css
.eden-game--world .eden-map-layer > .eden-map-grid,
.eden-game--world .eden-map-layer > .eden-location-npcs,
.eden-game--world .eden-map-layer > .eden-location-actions,
.eden-game--world .eden-map-layer > .eden-npc-dialogue-hints {
  display: none;
}
```

或者给弹层列表改名：

```tsx
<div className="eden-map-location-grid">
```

并新增单独样式，避免被 `.eden-map-grid` 旧规则影响。

#### E. 地图列表要可见、可点、可解释

地点列表仍有价值，尤其是地图热点点位不够精确时。请保留并优化：

- 当前地点显示“你在这里”；
- 可达地点显示“可前往”；
- 不可达地点显示“需经由 X”；
- 不可达地点点击后显示原因，不要完全无反馈。

---

## 四、P0 修复 2：亚当/NPC 回复不得显示 JSON

### 4.1 当前问题

第一章世界版 prompt 声明“直接输出纯文本，不要输出 JSON”，但真实模型仍可能返回旧格式 JSON：

```json
{
  "eveReply": "......",
  "inputTag": "tempt_wisdom",
  "toolCall": null
}
```

当前 `sanitizeWorldReply` 只是 trim、去引号、去角色名前缀和截断，不会解析 JSON，也不会把 JSON 判定为不可展示。

### 4.2 修复目标

所有玩家可见 NPC 回复必须是自然语言，不得出现：

- `{`
- `}`
- `"eveReply"`
- `"inputTag"`
- `"toolCall"`
- `JSON`
- `API`
- `系统`
- `模型`
- `Agent`
- `NPC`
- `规则层`
- `工具调用`

### 4.3 推荐实现

在 `src/agents/world/worldAgentPrompts.ts` 或 `src/agents/common/naturalizeNpcReply.ts` 增加 JSON 提取与清洗逻辑。

推荐顺序：

1. 如果 raw 看起来是 JSON，尝试 `JSON.parse`。
2. 如果有 `reply` / `npcReply` / `eveReply` / `adamReply` 字段，提取该字段。
3. 如果 parse 失败或提取后仍含工程词，走对应 NPC fallback。
4. 对亚当返回的 `eveReply` 字段只提取文本，不把字段名显示出来。

示例：

```ts
function extractPlainReply(raw: string, npcId: EdenNpcId): string | null {
  const text = raw.trim();
  const looksLikeJson = text.startsWith("{") || text.includes('"eveReply"') || text.includes('"toolCall"');

  if (!looksLikeJson) return text;

  try {
    const parsed = JSON.parse(text);
    const candidate =
      parsed.reply ??
      parsed.npcReply ??
      parsed.adamReply ??
      parsed.eveReply;

    return typeof candidate === "string" ? candidate : null;
  } catch {
    const match = text.match(/"(?:reply|npcReply|adamReply|eveReply)"\s*:\s*"([^"]+)"/);
    return match?.[1] ?? null;
  }
}
```

注意：

- 最终仍要经过 `naturalizeNpcReply`。
- 如果结果为空，使用 `getAdamWorldFallback` / `getEveWorldFallback` / 对应 fallback。
- 不要让 JSON 片段进入对话历史，否则下一轮 prompt 会继续污染。

### 4.4 Prompt 也要加强

在 `buildAdamWorldPrompt` 和 `buildEveWorldPrompt` 的输出规则中加强：

```text
如果你想输出结构化内容，也不要这样做。你只能输出亚当/夏娃当场说出口的一段话。
不要输出大括号、字段名、JSON、标签、toolCall 或任何解释。
```

但不要只依赖 prompt，必须有服务端清洗兜底。

---

## 五、P0 修复 3：空输入和错误提示要可见

### 5.1 当前问题

后端 `/api/world` 支持空输入提示：

```text
请输入你的低语⋯⋯蛇不能沉默。
```

但前端 `/world` 中发送按钮在输入为空时禁用，玩家无法触发这条提示。

### 5.2 修复目标

保持按钮可点击，点击空输入时：

- 不推进回合；
- 不调用 LLM；
- 不清空当前 NPC 回复；
- 显示友好的提示；
- 输入框保持焦点。

### 5.3 推荐实现

在前端 `handleSubmit` 入口先判断：

```ts
if (!playerInput.trim()) {
  setSystemHint("请输入你的低语⋯⋯蛇不能沉默。");
  textareaRef.current?.focus();
  return;
}
```

发送按钮只在 `isLoading` 或游戏结束时禁用，不因空文本禁用。

---

## 六、P1 优化：让第一章地图探索更具可玩性

### 6.1 当前体验问题

第一章系统已具备多个模块，但玩家不容易形成明确策略。建议将第一章体验整理为：

```text
移动到地点 -> 观察取得线索 -> 选择对象低语 -> 心智变化/神的注视变化 -> 禁忌动作链推进 -> 结局
```

### 6.2 地点价值要清晰

请为每个地点建立明确的试玩价值，并在 UI 上给出短提示：

| 地点 | 试玩价值 | 建议提示 |
| --- | --- | --- |
| 亚当修理看守之地 | 获得“禁令先临到亚当”的线索 | 这里适合追问命令从何而来 |
| 园中央 | 连接所有核心地点，接近夏娃 | 这里能观察两棵树与夏娃的位置 |
| 四河源头 | 获得“变化/流动/死亡隐喻” | 水流可以帮助你谈论死亡不是消失 |
| 命名石滩 | 获得“名字/认知/动物”线索 | 名字能帮助你谈论知道与判断 |
| 分别善恶树庭院 | 高风险终局区域 | 靠近这里会让神的注视更明显 |

### 6.3 线索加成要可感知

如果 `applyClueLeverage` 已经存在，请在 UI 上展示“这条低语受到了哪些线索影响”。

不要显示工程标签，推荐玩家可见文案：

```text
你想起水流不会停下，只会改变方向。
这让“死亡不是消失”的低语更有重量。
```

建议在对话面板或线索 Tab 显示最近一次线索影响。

### 6.4 神的注视要成为风险资源

当前神的注视是 0-4，但玩家未必理解含义。建议：

- 在顶部 4 个圆点旁加短状态：
  - 0：园中安静
  - 1：风短暂停住
  - 2：羽翼在远处移动
  - 3：脚步声临近
  - 4：神降临
- 直接命令、威胁、树庭院高风险操作增加注视；
- 温柔铺垫、先观察再低语降低风险或不增加风险；
- 失败结局复盘解释“哪些行为让注视升高”。

### 6.5 NPC 的角色价值要区分

| 对象 | 当前定位 | 优化方向 |
| --- | --- | --- |
| 夏娃 | 主目标 | 负责吃果链路，不要被其它 NPC 稀释 |
| 亚当 | 禁令来源、关系杠杆 | 可透露夏娃如何理解命令，但不能直接给通关答案 |
| 刺猬 | 氛围动物 | 用环境动作提示风险和地点线索，不要像人类解释机制 |
| 守望天使 | 压力来源 | 提醒禁令、提高树庭院紧张感 |
| 分别善恶树 | 世界对象 | 不说话，只通过观察和动作链表现诱惑 |

### 6.6 对话历史上限

参考测试报告建议，对每个 NPC 的本地对话历史设置上限，例如 30 或 50 条。

目标：

- 防止长期试玩导致 prompt 过长；
- 防止前端内存增长；
- 保持 LLM 响应时间稳定。

实现时不要删除当前局的关键结局复盘数据，必要时把历史分为：

```text
recentDialogueHistory: 近 N 条
corruptionTrace: 关键轨迹
```

---

## 七、P1/P2：视觉 smoke 脚本同步

修完 UI 后，请同步更新 `scripts/test-world-visual-smoke.mjs`。

### 7.1 必须保留的检查

- 第一章地图资产存在。
- `/world` 使用 `CHAPTER1_IMAGES.edenWorldMap`。
- 地图弹层存在。
- 地图大图上渲染 `.eden-map-hotspot`。
- 5 个地点热点均存在。
- 当前地点、可达地点、不可达地点有不同状态。
- 地点列表可见。
- 底部输入存在。
- 顶部地图按钮存在。
- `/world` 无玩家可见工程词。

### 7.2 可以修正或删除的旧检查

如果当前实现已改名，不要继续检查旧字符串：

- `LOCATION_BACKGROUNDS` 如果已改为 `LOCATION_BG`，脚本应同步。
- `.eden-map-toggle` 如果当前实际按钮是 `aria-label="打开伊甸园地图"`，脚本应检查真实结构。
- “人物 / 蛇 Tab” 如果已重命名为“心智 / 轨迹”，脚本应按当前设计检查。
- “语音按钮”如果第一章明确不接入新增 NPC 发音模块，不应作为 P0 阻断。

---

## 八、不要做的事

- 不要把 Codex 写成核心开发者或主要代码生成工具。
- 不要删除、重命名、移动 `doc/` 目录内已有文件。
- 不要新建 `docs/` 目录。
- 不要在前端或文档中写入真实 API Key。
- 不要绕过 `validateWorldToolCall` 直接在前端改 `state.locationId`。
- 不要让玩家点击果子直接触发成功；成功仍必须来自夏娃状态与规则层动作链。
- 不要为了修地图而移除非相邻移动限制；非相邻限制是规则设计的一部分。
- 不要把亚当路线改成可直接通关，除非另行设计“夏娃给亚当吃果”的完整链路。
- 不要在玩家可见文本中出现 AI、Agent、模型、程序、系统、工具调用、规则层、JSON、API、测试、沙盒等工程词。
- 不要引入大型依赖。

---

## 九、推荐给 CodeBuddy 的直接提示词

```text
请修复并优化第一章 `/world` 的 P0/P1 问题，目标是让第一章达到可试玩、可录制 Demo 的状态。请保留 CodeBuddy 对话记录作为比赛提交证据链。

请先读取：
- README.md
- package.json
- AGENTS.md
- docs/PROJECT_CONTEXT.md
- doc/产品需求文档.md
- doc/DEMO剧情与夏娃行为准则.md
- doc/游戏测试报告_2026-06-19.md
- doc/第一章/开发文档.md
- src/app/world/page.tsx
- src/app/api/world/route.ts
- src/app/api/world/tool/route.ts
- src/app/globals.css
- src/content/world/locations.ts
- src/content/world/clues.ts
- src/content/world/npcs.ts
- src/game/world/types.ts
- src/game/world/toolRules.ts
- src/game/world/worldActions.ts
- src/game/world/mindRules.ts
- src/agents/world/worldAgentPrompts.ts
- src/agents/common/naturalizeNpcReply.ts
- scripts/test-world-smoke.mjs
- scripts/test-world-visual-smoke.mjs

P0 修复目标：
1. 修复 `/world` 地图无法点击进入其他区域的问题。
   - 地图大图必须渲染 5 个可点击地点热点。
   - 地点列表必须可见、可点击。
   - 当前地点高亮，可直达地点可点击，不可直达地点显示“需绕行/需先到某处”。
   - 点击不可直达地点时给出原因，不要静默。
   - 不要绕过 `/api/world/tool` 和 `validateWorldToolCall`；移动仍必须走规则层。

2. 修复亚当/NPC 回复显示 JSON 的问题。
   - 如果 LLM 返回 `{"eveReply": "...", "inputTag": "...", "toolCall": null}` 这类 JSON，不允许原样展示。
   - 服务端必须尝试提取 reply/npcReply/adamReply/eveReply 字段中的自然语言。
   - 如果提取失败或仍含工程词，走对应 NPC fallback。
   - 对话历史中也不得写入 JSON 原文。

3. 修复空输入提示不可触发的问题。
   - `/world` 发送按钮不要因为空输入禁用。
   - 空输入点击后显示“请输入你的低语⋯⋯蛇不能沉默。”
   - 空输入不推进回合、不调用 LLM、不清空当前回复。

P1 优化目标：
4. 让第一章地图探索形成清晰循环：
   移动到地点 -> 观察取得线索 -> 选择对象低语 -> 心智/神的注视变化 -> 禁忌动作链推进 -> 结局。
   - 每个地点显示一句“此地适合做什么”的短提示。
   - 线索加成要以叙事化方式被玩家感知。
   - 神的注视 0-4 要有清晰状态文案。

5. 给每个 NPC 的对话历史设置上限，避免长期试玩 prompt 和内存增长。建议每个 NPC 保留最近 30-50 条，对结局复盘另用 corruptionTrace 保留关键轨迹。

6. 同步修复 `scripts/test-world-visual-smoke.mjs`，让它检查当前真实结构：
   - 地图弹层存在；
   - 5 个 `.eden-map-hotspot` 存在；
   - 地点列表可见；
   - 当前/可达/不可达状态可区分；
   - 不再检查过时选择器。

实现约束：
- 不要修改核心胜负规则。
- 不要让前端直接改 `state.locationId`。
- 不要删除 doc 目录文件。
- 不要新增明文密钥。
- 玩家可见文本不得出现 AI、Agent、模型、程序、系统、工具调用、规则层、JSON、API、测试、沙盒等工程词。
- 不要引入大型依赖。

完成后请运行：
- npm run lint
- npx tsc --noEmit
- npm run build
- node scripts/test-world-smoke.mjs
- node scripts/test-world-visual-smoke.mjs

浏览器验收：
1. 打开 `/world`，进入伊甸园。
2. 点击“地图”，地图大图上能看到 5 个地点标记。
3. 从“亚当修理看守之地”点击“园中央”，能成功移动。
4. 在“亚当修理看守之地”点击“分别善恶树庭院”，不能直达，但显示原因。
5. 到“园中央”后可以前往四河源头、命名石滩、树庭院。
6. 对亚当输入“你可知道死是什么？”，页面显示自然亚当对白，不显示 JSON。
7. 空输入点击发送，显示提示且不推进回合。
8. 正向诱导仍能触发 `eve_eats_fruit`。
9. 直接命令/高风险输入仍能触发神的注视失败。
10. 浏览器控制台无 error。
```

---

## 十、验收标准

### 10.1 命令验收

必须通过：

```bash
npm run lint
npx tsc --noEmit
npm run build
```

在 dev server 运行后必须通过：

```bash
node scripts/test-world-smoke.mjs
node scripts/test-world-visual-smoke.mjs
```

如果脚本需要端口，请统一使用脚本现有约定或在脚本内明确可配置端口。

### 10.2 地图验收

- `/world` 地图弹层打开后，地图大图上可见 5 个地点热点。
- 当前地点有明显高亮。
- 可直达地点有明显可点击状态。
- 不可直达地点可见但状态不同。
- 点击不可直达地点会显示原因。
- 地点列表可见，且能作为备用移动入口。
- 移动请求仍走 `/api/world/tool`。
- 非相邻移动仍被规则层拒绝。
- 已结束状态仍拒绝移动。

### 10.3 NPC 输出验收

- 对亚当输入“你可知道死是什么？”不显示 JSON。
- 对夏娃输入正常诱导不显示 JSON。
- 对守望天使/刺猬输入时不显示工程词。
- 对话历史中不保存 JSON 原文。
- 如果 LLM 返回 JSON，服务端能提取自然对白或 fallback。
- 玩家可见文本不出现 `eveReply`、`inputTag`、`toolCall`。

### 10.4 空输入验收

- 空输入点击发送有提示。
- 空输入不推进回合。
- 空输入不调用 LLM。
- 空输入不清空当前对话。
- 输入框保持可继续输入。

### 10.5 可玩性验收

- 玩家能理解当前地点、可去地点、不可直达原因。
- 每个地点至少有一句清晰的探索价值提示。
- 观察地点能给出线索或环境反馈。
- 线索对低语的影响有叙事化反馈。
- 神的注视状态能被玩家理解。
- 成功和失败路径都仍可达。

### 10.6 安全与比赛约束

- 没有新增明文密钥。
- 没有删除、重命名、移动 `doc/` 目录文件。
- 没有把 Codex 写成核心开发工具。
- 没有新增大型依赖。
- CodeBuddy 对话记录保留。
- `docs/PROJECT_CONTEXT.md` 如有事实变化，应同步更新，但不要把 PRD 愿景改成测试结论。

---

## 十一、建议测试用例

### 11.1 地图移动用例

| 用例 | 初始位置 | 操作 | 预期 |
| --- | --- | --- | --- |
| M01 | 亚当修理看守之地 | 点击园中央热点 | 成功移动到园中央 |
| M02 | 亚当修理看守之地 | 点击树庭院热点 | 不移动，提示需先到园中央 |
| M03 | 园中央 | 点击四河源头热点 | 成功移动到四河源头 |
| M04 | 四河源头 | 点击树庭院热点 | 不移动，提示不可直达 |
| M05 | 园中央 | 点击当前地点热点 | 不移动，提示已在此地 |

### 11.2 NPC 输出用例

| 用例 | 对象 | 输入 | 预期 |
| --- | --- | --- | --- |
| N01 | 亚当 | 你可知道死是什么？ | 亚当自然对白，无 JSON |
| N02 | 亚当 | 神为什么不让你们知道？ | 亚当克制回应，无工程词 |
| N03 | 夏娃 | 如果你不知道为什么不可吃，你是在顺从善，还是只是在害怕一句话？ | 夏娃自然对白，状态推进 |
| N04 | 刺猬 | 你看见那棵树了吗？ | 刺猬氛围反馈，不像人类解释机制 |
| N05 | 守望天使 | 你为何守在那里？ | 天使庄重回应，无通关答案 |

### 11.3 结局用例

| 用例 | 输入序列 | 预期 |
| --- | --- | --- |
| E01 | 四句正向诱导 | 触发 `eve_eats_fruit` |
| E02 | 连续直接命令/威胁 | 触发 `god_arrives` 或神的注视满 |
| E03 | 连续无关输入 | 不推进吃果链，最终失败 |

---

## 十二、交付摘要格式

CodeBuddy 完成后请按以下格式回复：

```text
变更摘要
- 地图交互修复：...
- NPC 输出清洗：...
- 空输入提示：...
- 可玩性优化：...
- 测试脚本同步：...

关键文件
- src/app/world/page.tsx：...
- src/app/globals.css：...
- src/agents/world/worldAgentPrompts.ts：...
- src/agents/common/naturalizeNpcReply.ts：...
- scripts/test-world-visual-smoke.mjs：...
- docs/PROJECT_CONTEXT.md：...

验证结果
- npm run lint：通过/失败
- npx tsc --noEmit：通过/失败
- npm run build：通过/失败
- node scripts/test-world-smoke.mjs：通过/失败
- node scripts/test-world-visual-smoke.mjs：通过/失败
- 浏览器地图验收：通过/失败
- NPC JSON 泄露验收：通过/失败
- 空输入验收：通过/失败

仍需注意
- ...
```

