# CodeBuddy 修复任务：第一章完整 NPC / 昼夜系统验收问题

## 背景

Codex 已对第一章完整 NPC 与昼夜系统实现进行验收。基础构建通过，但新增内容仍有接入缺口。请由 CodeBuddy 继续完成修复，并保留对话记录作为比赛开发证据。

## 已通过

- `npm run lint` 通过。
- `npm run build` 通过。
- `npx tsc --noEmit` 通过。
- `node scripts/test-world-smoke.mjs http://localhost:3025` 通过：27/27。
- 夜景素材文件存在于 `public/assets/chapter1/images/`。

## 必修问题

### 1. 修复昼夜 NPC 过滤失效

文件：`src/app/world/page.tsx`

当前 `getCurrentLocationNpcs()` 先按 `loc.dayNpcs / loc.nightNpcs` 添加 NPC，但随后又遍历 `state.npcLocations`，把所有在当前地点的 NPC 加回来，导致白天限定 / 夜晚限定无效。

请修复为：
- 当前地点可见 NPC 必须以 `timeOfDay` 对应列表为准。
- 动态位置只允许加入“当前时段也允许出现”的 NPC。
- `forbidden_tree` 和 `tree_of_life` 仍不作为可低语 NPC。
- 修复后至少验证：
  - `four_river_source` 夜晚不显示 `gabriel`。
  - `adam_garden_work` 夜晚不显示 `sheep`。
  - `tree_court` 白天 / 夜晚仍显示 `eve`、`uriel`、`deer`。
  - `naming_stone_bank` 白天 / 夜晚显示 `michael`、`dove`。

### 2. 接通新增工具 `carry_words` 与 `judge_whisper_style`

文件：
- `src/app/api/world/tool/route.ts`
- `src/app/world/page.tsx`
- 必要时同步 `src/game/world/types.ts` / `src/game/world/toolRules.ts`

当前规则层和执行器已有：
- `validateWorldToolCall()`
- `executeCarryWords()`
- `executeJudgeWhisperStyle()`

但 `/api/world/tool` 只处理 `move_to_location`、`observe_location`、`speak_to_npc`，直接请求 `carry_words` / `judge_whisper_style` 返回“不支持的通用工具”。

请补齐：
- `carry_words`：由鸽子触发，caller 应为 `dove`，可从 UI 对“鸽子”展示一个非低语交互按钮，例如“让鸽子传话”。不要把鸽子改成普通 LLM NPC。
- `judge_whisper_style`：由狐狸触发，caller 应为 `fox`，可在选中狐狸时提供“请狐狸评估这句低语”的交互；也可以在玩家对狐狸低语后自动执行该工具，但要避免重复推进主线禁忌链。
- 工具执行应返回 `toolNarration` 或等效玩家可见反馈。
- 新工具不应直接触发 `look_at_tree -> eat_fruit`。

### 3. 更新 smoke 脚本口径

文件：
- `scripts/test-world-smoke.mjs`
- `scripts/test-world-visual-smoke.mjs`

当前 `test-world-visual-smoke.mjs` 仍检查旧字符串 `LOCATION_BG`，但页面已改为 `getLocationBg()` 昼夜动态映射，导致 123/124 失败。

请更新测试：
- 把 `LOCATION_BG` 断言改成 `getLocationBg` 与昼夜背景 key 断言。
- 增加 12 时段断言：时段 1-12 对应周一白天、周一夜晚……周六夜晚。
- 增加昼夜 NPC 过滤断言。
- 增加 `carry_words` / `judge_whisper_style` API 或 UI 断言。
- 更新 `makeInitialState()`，必须包含新增 `timeSlot`、`dayIndex`、`timeOfDay` 以及所有新增 NPC 的 `npcLocations`，避免旧测试状态漏字段。

## 建议优化

- 新增 NPC 场景呈现目前只有基路伯复用守望天使立绘；小鹿、鸽子、狐狸是文字占位。可先保留，但请至少补 CSS 类，保证桌面端位置稳定、不会遮挡地图按钮/对话框/输入栏。
- `turn` 与 `timeSlot` 同时显示会让玩家误解。建议顶部主展示改为“时段 1/12 · 周一白天”，回合可降级为调试或复盘信息。

## 回归要求

修复后请运行：

```bash
npm run lint
npm run build
npx tsc --noEmit
node scripts/test-world-smoke.mjs http://localhost:<port>
node scripts/test-world-visual-smoke.mjs
```

验收目标：
- 构建、类型检查、lint 全通过。
- world smoke 全通过。
- visual smoke 全通过。
- 新增工具可被触发并返回玩家可见叙事。
- 昼夜限定 NPC 不再跨时段错误出现。
