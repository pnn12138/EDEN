# 第一章 · 最终验收前修复开发报告（Round 3 Final）

> 受众：Codex（统一复测）
> 分支：`feat/chapter1-round3-save-refresh`
> 日期：2026-07-14
> 性质：同步 E2E 测试到新流程/新文案 + 本轮新增功能最小自动化 + 图片生成配置兼容性修复。
> 约束：不回退已确认新设计；不调用真实视频/图片接口；完成开发与测试同步后交付 Codex 复测。

---

## 0. 已确认口径（保持不变，已核对）

- 基础行动点为 **4**（`src/game/world/types.ts` `actionPoints: 4`）。
- 园中档案四页签：**印记 / 回响 / 结局 / 园中律则**（`GardenCodex.tsx` TABS）。
- 东园白天题：**东风所传**（`scenePuzzles.ts` `puzzle_east_path_cautious_presence_day`）。
- 设置打开默认页：**存档匣**（非账号）。
- 开局必须完成神明献礼三选一后进入探索（gift-choice-card 流程）。
- 不调用 `doubao-seedream-2.0-mini`（路由仅返回 `not_configured` / `reserved`，永不发起真实视频调用）。

---

## 1. 图片生成配置兼容性修复（核心代码改动）

### 1.1 新增纯函数模块 `src/lib/endingImageGen.ts`
- `defaultImageSizeFor(provider, model)`：Ark / Seedream / volcengine → **`2K`**；其它 OpenAI 兼容 → `1024x1024`。
- `resolveImageSize(media, env)`：解析顺序 **玩家 `imageSize` > 服务端 `IMAGE_SIZE` > 按 provider/model 推断**。
- `clampImageCount(requested, playedSlots)`：**服务端校验 `1 <= count <= min(12, playedSlots)`**（此前由 route 内联，现抽出复用并单测）。
- `toDisplayableImageUrl(raw)`：直链原样返回；裸 base64（Ark `b64_json`）→ `data:image/png;base64,...`；已是 `data:` 原样返回。
- 该模块无 `@/` 依赖，供 route 与 Playwright 单测复用。

### 1.2 `src/app/api/world/ending-media/route.ts`
- 导入上述纯函数。
- `resolveImageConfig` 增加 `size` 字段（来源经 `resolveImageSize`）。
- `generateStoryboardWithLLM`：`imageCount = clampImageCount(wantCount, playedSlots)`。
- `tryGenerateImage`：请求体 `size: cfg.size`（**不再硬编码 `1024x1024`**）；后端二次 `checkEndpointUrl` 保留；响应解析优先 `data[0].url`，其次 `data[0].b64_json` 经 `toDisplayableImageUrl` 转可显示 URL。
- `imageProvider` 现在**实际参与**默认尺寸推断（不再形成无效设置）。
- 服务端 Key 仅存于 `cfg` 局部变量，未写入存档/URL/日志/响应。

### 1.3 `src/lib/endingMediaSettings.ts`
- `EndingMediaSettings` 增加 `imageSize: string`；`defaultEndingMediaSettings` 增 `imageSize: ""`。
- 载入/保存逻辑自动兼容（基于 `defaultEndingMediaSettings` 展开），无需改校验。

### 1.4 `src/components/world/SettingsModal.tsx`
- AI 创作表单新增「图像尺寸」输入（placeholder 提示「空=服务端默认；Ark/Seedream 用 2K」）。

---

## 2. E2E 测试同步到新流程与新文案

| 文件 | 修改要点 |
|---|---|
| `tests/e2e/chapter1-mechanics.spec.ts` | 设置测试改为：默认打开到**存档匣**（断言 `world-save` 可见、`settings-account` 默认不渲染），需账号内容时再点「账号」页签验证。 |
| `tests/e2e/garden-codex.spec.ts` | `enterExplore` 统一为 gift-choice-card 流程（识别并选择 `gift-choice-card`、关闭开场/场景/献礼通知、等待献礼 toast）；页签断言改为 **印记 / 回响 / 结局 / 园中律则**。 |
| `tests/e2e/world-scene-puzzles.spec.ts` | 东园题断言改为 **东风所传**，按真实 4 选项/per_option 奖励更新（选「伏地辨认…」→ 获得 `resonance_echo_of_beings`），AP 断言改为 **4**（基础，未取白天 AP 上限加成时进入下一轮恢复为 4）。 |
| `tests/e2e/repro-scene-polish.spec.ts` | 删除「固定点击五次引言」旧写法，改为 gift-choice-card 流程。 |
| `tests/e2e/world-scene-puzzles.mobile.spec.ts` | 删除「固定点击五次引言」旧写法，改为 gift-choice-card 流程并关闭遮罩。 |

> 所有 `enterExplore/startFreshChapter` 现已统一：推进引言时识别并选择 `gift-choice-card`，再关闭开场/场景/献礼通知，**不再使用固定点击五次引言**。

---

## 3. 本轮新增功能的最小自动化覆盖（新文件）

### 3.1 `tests/e2e/divine-attention-rules.spec.ts`（园中律则）
- **白天付费移动解锁「白日步痕」**：`moveTo` 真实移动 → 断言 `unlockedDivineAttentionRuleIds` 含 `paid_day_move`；写入槽位后到 `/garden` → 切「园中律则」页签，断言「白日步痕」可见、「夜言传远」不泄露、存在被隐藏的律则卡片（`.eden-rule-card--locked`）。
- **夜晚付费对话解锁「夜言传远」**：`进入下一轮` 直至 `timeOfDay==="night"`，与亚当低语（消耗 AP 的成功对话）→ 轮询断言 `unlockedDivineAttentionRuleIds` 含 `paid_night_dialogue`。

### 3.2 `tests/e2e/save-slots.spec.ts`（存档匣四槽）
- 保存到空槽 1（**直接保存，无覆盖确认**）→ 脏状态后再次保存同槽（**出现覆盖确认**）→ 删除槽 1（**出现删除确认**，确认后回到「暂无存档」）→ 重新保存后制造脏状态再读取（**脏状态读取保护：出现读取确认**）。

### 3.3 `tests/e2e/ending-media.spec.ts`（结局 AI 创作）
- **纯函数单测**：`clampImageCount` 越界拒绝（<1 / 超过 min(12,playedSlots) 均被夹到合法区间）；`resolveImageSize`/`defaultImageSizeFor`（Ark/Seedream→2K、玩家/服务端优先、其它→1024x1024）；`toDisplayableImageUrl`（直链/`data:` 原样、裸 base64→`data:image/png;base64,...`）。
- **接口集成（不调用真实模型）**：`POST /api/world/ending-media` 无图像配置 → 返回 `storyboard.imageCount` 落在 `[1, min(12, playedSlots)]`、`images=[]`、`imagesAvailable=false`、视频状态为 `not_configured`/`reserved`。
- **UI 兜底**：无图像配置「生成图片集」→ 保留文字分镜卡片（`ending-memory-card-text`）；接口 500 失败 → 出现「打开设置」→ 点击后设置浮窗打开并切到 **AI 创作** 页签（断言 `aria-selected="true"` 与「图像 Provider」可见）。

---

## 4. 安全与约束确认

- `.env.local` 未改动；图片能力复用既有 `IMAGE_*` 环境变量（含 `IMAGE_SIZE` 新增读取）。
- 密钥：玩家自定义 `imageKey` 仅用于当次 `fetch`，不写存档/URL/日志/控制台/错误/响应。
- URL 校验：`checkEndpointUrl` 双重校验（前端+后端），仅 HTTPS，拒 localhost/回环/私网。
- 视频：`doubao-seedance-2.0-mini` 仅作预填标注「未验证」，路由绝不自动发起视频调用。
- `doc/` 未删除/移动任何文件；新设计（四页签、东风所传、默认存档匣、开局三选一）均未回退。

---

## 5. 未做真实外部媒体调用的原因

- 赛题与验收均要求**不调用真实图片/视频模型**（`doubao-seedream` 系列未验证、且密钥不应在测试链路外露）。
- 本轮对图片生成的验证通过**三层替代**完成，均由 Codex 统一复测：
  1. 纯函数单测（尺寸解析、`clampImageCount`、b64→dataURL）——不依赖网络；
  2. 接口集成测试拦截在「无图像配置」分支，验证服务端数量边界与文字分镜兜底；
  3. UI 失败路径用 `page.route` 拦截返回 500，验证「打开设置→AI 创作」与文字分镜保留。
- 真实 Ark `2K` 尺寸与 `b64_json` 解析逻辑已写入并以单测覆盖，但**未向任何外部端点发起真实请求**。

---

## 6. 修改文件清单

**源码（4）**
1. `src/lib/endingImageGen.ts`（新增）— 尺寸/数量/URL 纯函数。
2. `src/app/api/world/ending-media/route.ts` — 接入尺寸解析、数量校验、b64→dataURL。
3. `src/lib/endingMediaSettings.ts` — 增加 `imageSize` 字段与默认。
4. `src/components/world/SettingsModal.tsx` — AI 创作增加「图像尺寸」输入。

**测试（8）**
5. `tests/e2e/chapter1-mechanics.spec.ts` — 设置默认存档匣断言。
6. `tests/e2e/garden-codex.spec.ts` — enterExplore 统一 + 四页签断言。
7. `tests/e2e/world-scene-puzzles.spec.ts` — 东风所传 + AP=4 断言。
8. `tests/e2e/repro-scene-polish.spec.ts` — 去除固定五次点击。
9. `tests/e2e/world-scene-puzzles.mobile.spec.ts` — 去除固定五次点击。
10. `tests/e2e/divine-attention-rules.spec.ts`（新增）— 园中律则真实解锁 + 隐藏。
11. `tests/e2e/save-slots.spec.ts`（新增）— 四槽保存/覆盖/删除/脏读保护。
12. `tests/e2e/ending-media.spec.ts`（新增）— 数量校验单测 + 接口边界 + UI 兜底/打开设置。

> 未改动 `runChronicle.ts`、`EndingReview.tsx`、`EndingMemoryPanel.tsx`、`page.tsx`（上一轮已完成）、`lib/endingMediaSettings.ts` 之外的配置或 `doc/`。

---

## 7. 建议 Codex 复测命令

```bash
npm run typecheck            # 确认新增/改动 TS 通过
npx playwright test tests/e2e/garden-codex.spec.ts tests/e2e/chapter1-mechanics.spec.ts tests/e2e/world-scene-puzzles.spec.ts tests/e2e/repro-scene-polish.spec.ts tests/e2e/world-scene-puzzles.mobile.spec.ts
npx playwright test tests/e2e/divine-attention-rules.spec.ts tests/e2e/save-slots.spec.ts tests/e2e/ending-media.spec.ts
```

复测重点：
- 所有 `enterExplore/startFreshChapter` 走 gift-choice-card，无「固定五次点击」旧写法。
- 园中档案页签为 印记/回响/结局/园中律则；东园白天题为 东风所传；AP 基础为 4。
- 设置默认页为存档匣；存档匣四槽确认流完整。
- 结局「生成图片集」失败时保留文字分镜，「打开设置」切到 AI 创作。
- 图片数量服务端夹到 `[1, min(12, playedSlots)]`；Ark/Seedream 默认 2K；b64 转 data URL（单测覆盖）。
