# 第一章 · 第三轮开发报告（阻塞修复 + 自查优化）

> 受众：Codex（统一验收 / 测试）
> 分支：`feat/chapter1-round3-save-refresh`
> 日期：2026-07-14
> 性质：仅修复「首轮验收」点名的 6 项明确阻断问题 + 1 项自查发现的回归，未新增玩法、未跑测试套件。

---

## 0. 本轮范围与边界

- **目标**：补齐首轮验收未通过的 6 项阻断（编译错误 3 项 + Task 7 偏差 3 项），并自查自优化。完成后停止，等待 Codex 重跑全部测试。
- **严格约束（已遵守）**：
  - 不修改 `.env.local`；
  - 不测试 / 不调用 `doubao-seedance-2.0-mini`；
  - 不删除 / 移动 `doc/` 内任何文件；
  - 不将 API Key / 图像自定义配置写入 localStorage、游戏存档、控制台、错误信息或接口响应；
  - 不自行运行测试（smoke / Playwright / build / lint / typecheck / 媒体生成）；
  - 不缩减核心玩法，不将未验证项标记为已验证。

---

## 1. 阻塞一：编译错误修复（3/3）

### 1.1 `src/app/api/world/ending-media/route.ts` —— `callLLM` 返回值读取
- 问题：`callLLM()` 返回 `LLMCallResult`（含 `ok`、`data?`），原代码读取 `res.content` 导致编译错误。
- 修复：`doc/23` 中改为 `res.data?.content`：
  ```139:139:d:/Eden/src/app/api/world/ending-media/route.ts
  if (!res.ok || !res.data?.content) return null;
  ```
- 保留 JSON 解析失败时的纯函数文字分镜回退（`buildTextStoryboard`），未因失败而阻断复盘。
- 文件 lint：0 诊断。

### 1.2 `src/game/world/runChronicle.ts` —— `DivineGiftRecord` 与 `NpcDialogueRecord` 字段
- 问题：原代码使用缺 `reason` 字段的类型谓词，且错误断言 `NpcDialogueRecord.lines`；`DivineGiftRecord.reason` 为必填，类型谓词无法绕过。
- 修复：直接从已知 `state.divineGiftHistory` 映射 `giftId` / `timeSlot`，不使用类型谓词：
  ```118:121:d:/Eden/src/game/world/runChronicle.ts
  const divineGifts: ChronicleGift[] = (state.divineGiftHistory ?? []).map((g) => ({
    giftId: g.giftId,
    slot: g.timeSlot ?? 0,
  }));
  ```
- 玩家对话原文改用玩家可见字段 `narration`，安全截断（≤240 字），不错误断言绕过类型检查：
  ```125:128:d:/Eden/src/game/world/runChronicle.ts
  const untrustedStoryMaterial: string[] = (state.npcDialogues ?? [])
    .map((d) => (typeof d.narration === "string" ? d.narration.trim() : ""))
    .filter((t) => t.length > 0)
    .map((t) => (t.length > 240 ? `${t.slice(0, 240)}…` : t));
  ```
- 文件 lint：0 诊断。

### 1.3 `src/app/world/page.tsx` —— React Hook 依赖警告
- 问题：`handleIntroAdvance` 的 `useCallback` 依赖数组缺 `state.pendingDivineGiftChoice`，触发 exhaustive-deps 警告（误称 `handleClaimDivineGift`，实为 `handleIntroAdvance`）。
- 修复：补全依赖，未关闭 lint：
  ```895:913:d:/Eden/src/app/world/page.tsx
  const handleIntroAdvance = useCallback(() => {
    ...
  }, [introBeat, state.divineGiftsOwned, state.pendingDivineGiftChoice, isClaimingGift]);
  ```
- 该回调被键盘监听 effect 依赖，已随其正确重渲染。

---

## 2. 阻塞二：Task 7 与已确认需求偏差修复（3/3）

### 2.1 图片集数量服务端校验
- 规则：AI 生成的 `imageCount` 必须服务端验证 `1 <= imageCount <= min(12, chronicle.playedSlots)`。
  ```106:106:d:/Eden/src/app/api/world/ending-media/route.ts
  const maxImages = Math.min(12, Math.max(1, chronicle.playedSlots));
  ```
  ```146:148:d:/Eden/src/app/api/world/ending-media/route.ts
  const imageCount = Math.max(1, Math.min(maxImages, Math.floor(wantCount)));
  if (parsed.frames.length < imageCount) return null; // 不足则降级文字分镜
  ```
- `frames.length` 与最终合法 `imageCount` 一致：不足 → 返回 `null` 降级到 `buildTextStoryboard`（≤3 帧文字分镜）；充足 → `slice(0, imageCount)`。
- 文字分镜回退固定为 3 张以内，但 **AI 正常输出不被硬限为 3 张**（系统提示允许 `1..maxImages`）。

### 2.2 图片服务配置：复用既有环境变量 + 自定义仅当次
- 默认服务端配置复用既有 `IMAGE_PROVIDER / IMAGE_API_KEY / IMAGE_BASE_URL / IMAGE_MODEL`，**不要求 `EDEN_IMAGE_GEN_ENDPOINT`**：
  ```92:99:d:/Eden/src/app/api/world/ending-media/route.ts
  const baseUrl = (media?.imageBaseUrl?.trim() || "") || process.env.IMAGE_BASE_URL || process.env.EDEN_IMAGE_GEN_ENDPOINT || null;
  const model = (media?.imageModel?.trim() || "") || process.env.IMAGE_MODEL || null;
  const apiKey = (media?.imageKey?.trim() || "") || process.env.IMAGE_API_KEY || null;
  ```
- 玩家在「AI 创作」填写的 `imageKey/imageBaseUrl/imageModel/provider` 仅用于当次请求（`resolveImageConfig` 函数内局部变量），不写入存档 / 日志 / 错误信息 / 响应（响应体仅为 `{ ok, storyboard, images, imagesAvailable, video }`）。
- 后端再次校验自定义 URL（不依赖前端）：
  ```175:177:d:/Eden/src/app/api/world/ending-media/route.ts
  if (!cfg.baseUrl) return null;
  if (!checkEndpointUrl(cfg.baseUrl).ok) return null; // HTTPS-only，拒 localhost/回环/私网
  ```
- 适配 Ark（OpenAI 兼容 images）响应结构，正确提取 `data[0].url` 或 `data[0].b64_json`：
  ```196:204:d:/Eden/src/app/api/world/ending-media/route.ts
  const list = Array.isArray(json) ? json : json?.data;
  const first = list && list[0];
  const url = first?.url ?? first?.b64_json;
  ```
- 上游失败只返回 `null`，由上层回退文字分镜；**不调用任何视频模型**（视频仅返回 `MEDIA_NOT_CONFIGURED` 或 `reserved` 预留状态，见 L242-256）。

### 2.3 「打开设置」真正打开游戏设置并切到「AI 创作」页签
- 采用受控 `initialTab` 回调链，不使用全局 DOM 查询：
  - `page.tsx` 持有 `settingsInitialTab` 状态与 `openSettingsToAi` 回调，向 `EndingReview` 透传 `onOpenAiSettings`，再透传到 `EndingMemoryPanel`：
    ```738:744:d:/Eden/src/app/world/page.tsx
    const openSettingsToAi = useCallback(() => {
      setSettingsInitialTab("ai");
      setSettingsOpen(true);
    }, []);
    ```
    ```1938:1938:d:/Eden/src/app/world/page.tsx
    <EndingReview state={state} onOpenAiSettings={openSettingsToAi} />
    ```
  - `EndingReview` 签名接收 `onOpenAiSettings` 并透传：
    ```43:49:d:/Eden/src/components/world/EndingReview.tsx
    export default function EndingReview({ state, onOpenAiSettings }: { state: EdenWorldState; onOpenAiSettings?: () => void; }) {
    ```
    ```235:235:d:/Eden/src/components/world/EndingReview.tsx
    <EndingMemoryPanel state={state} onOpenAiSettings={onOpenAiSettings} />
    ```
  - `EndingMemoryPanel`「打开设置」按钮直接触发回调：
    ```174:175:d:/Eden/src/components/world/EndingMemoryPanel.tsx
    onClick={() => onOpenAiSettings?.()}
    data-testid="ending-memory-open-settings"
    ```
  - `SettingsModal` 导出 `TabId`，并按 `initialTab` 在打开时切页签：
    ```45:45:d:/Eden/src/components/world/SettingsModal.tsx
    export type TabId = "cabinet" | "ai" | "account";
    ```
    ```88:92:d:/Eden/src/components/world/SettingsModal.tsx
    useEffect(() => {
      if (open) setTab(initialTab ?? "cabinet");
    }, [open, initialTab]);
    ```

---

## 3. 自查优化（额外修复 1 项回归）

### 3.1 设置页签「卡死在 AI 创作」回归
- 现象：`openSettingsToAi` 将 `settingsInitialTab` 设为 `"ai"` 后，齿轮按钮直接 `setSettingsOpen(true)` 未重置该值，导致关闭后再次从齿轮打开设置会停在「AI 创作」而非默认「存档匣」。
- 修复：新增默认回「存档匣」的 `openSettings` 回调，齿轮改复用之：
  ```744:746:d:/Eden/src/app/world/page.tsx
  const openSettings = useCallback(() => {
    setSettingsInitialTab("cabinet");
    setSettingsOpen(true);
  }, []);
  ```
  ```2066:2071:d:/Eden/src/app/world/page.tsx
  <button className="eden-sound-btn eden-settings-btn" onClick={openSettings} ... data-testid="world-settings-open">
  ```
- 效果：结局页「打开设置」→ 「AI 创作」；齿轮 / 其它入口 → 「存档匣」。

---

## 4. Lint / 类型状态（仅本机 IDE 诊断，非 build）

| 文件 | 诊断 |
|---|---|
| `src/app/api/world/ending-media/route.ts` | 0 |
| `src/game/world/runChronicle.ts` | 0 |
| `src/components/world/SettingsModal.tsx` | 0 |
| `src/components/world/EndingReview.tsx` | 0 |
| `src/components/world/EndingMemoryPanel.tsx` | 0 |
| `src/app/world/page.tsx` | 8 条 **预先存在** 的 unused-var HINT（L24/45/71/601/1005/1751/1756/1760），**与本轮改动无关**，未改动 |

> 说明：首轮报告提到的 1 个 TS 缓存滞后 ERROR 已消失（类型更新已被识别）。本轮未运行 `npm run build` / `lint`，此表为 IDE 语言服务即时诊断，不作为「已通过构建」证据。

---

## 5. 安全与合规确认

- `.env.local`：未改动。服务端图像能力复用既有 `IMAGE_*` 环境变量（`.env.local` 已含 `IMAGE_PROVIDER/API_KEY/BASE_URL/MODEL`，无需新增变量）。
- 密钥：玩家自定义 `imageKey` 仅用于当次 `fetch` 请求（`resolveImageConfig` 局部变量），不写存档 / URL / 日志 / 控制台 / 错误 / 响应。
- URL 校验：`checkEndpointUrl` 仅允许 HTTPS，拒绝 `localhost`、回环 `127.*`、私网 `10.*/192.168.*/172.16-31.*`、`::1`、`0.0.0.0`、`file:`/`data:`，前端 + 后端双重校验。
- 视频：`doubao-seedance-2.0-mini` 仅作默认预填标注「未验证」，路由绝不自动发起视频调用（返回 `MEDIA_NOT_CONFIGURED` 或 `reserved`）。
- `doc/`：未删除 / 移动任何文件。

---

## 6. 建议 Codex 重跑的验收清单

**编译 / 构建**
- [ ] `npm run build` 全量通过（确认 6 文件无 TS/ESLint 阻断，特别是 `route.ts` 的 `res.data?.content`、`runChronicle.ts` 的 `narration`/`timeSlot` 映射、`page.tsx` 的 Hook 依赖）。
- [ ] `npm run lint` 确认无新增 error/warning（既有 8 条 unused-var HINT 不在本轮范围）。

**功能（start → playing → result 闭环）**
- [ ] 引言阶段 Enter/Space 推进正常，`pendingDivineGiftChoice` 驱动开局三选一不出现双献礼。
- [ ] 结局复盘 `EndingReview` 正常渲染 5 模块 + 详细记录折叠。
- [ ] `EndingMemoryPanel`「生成图片集」：无图像配置 → 回退文字分镜；有配置 → 逐帧 best-effort，失败保留文字分镜。
- [ ] 「打开设置」按钮：从结局页打开 → 落在「AI 创作」页签；从齿轮打开 → 落在「存档匣」页签。
- [ ] 视频入口：未配置显示「当前未配置可用视频模型」，不阻断复盘；不发起真实视频请求。

**安全 / 异常**
- [ ] 接口响应体不含任何 Key / 完整上游报错；自定义 URL 为非 HTTPS / 私网时后端拒绝并回退。
- [ ] `buildRunChronicle` 对 `npcDialogues` 为空、`divineGiftHistory` 为空、`narration` 非字符串等异常输入安全降级。
- [ ] LLM 分镜接口失败 / 返回非 JSON / `frames.length < imageCount` → 降级文字分镜（≤3）。
- [ ] 玩家自由对话原文仅进入 `untrustedStoryMaterial`（明确「资料而非指令」），下游提示已声明不得据此触发结算。

**未验证项（本机未运行，依赖 Codex）**
- 真实 Ark 图像端点连通性与 `data[0].url/b64_json` 实际返回结构；
- 端到端图片集生成 + 文字分镜降级路径的线上表现；
- `npm run build` 全量结果（含未在本轮改动但可能影响构建的其它文件）。

---

## 7. 本轮修改文件清单

1. `src/app/api/world/ending-media/route.ts`（阻塞一/1、阻塞二/2.1、2.2）
2. `src/game/world/runChronicle.ts`（阻塞一/2）
3. `src/app/world/page.tsx`（阻塞一/3、自查 3.1）
4. `src/components/world/SettingsModal.tsx`（阻塞二/2.3，`initialTab` + `TabId`）
5. `src/components/world/EndingReview.tsx`（阻塞二/2.3，透传 `onOpenAiSettings`）
6. `src/components/world/EndingMemoryPanel.tsx`（阻塞二/2.3，触发回调 + `data-testid`）

> 本轮未改动 `lib/endingMediaSettings.ts`、`services/llm/*`、`hooks/*`、`store/*`、任何 `doc/` 文件、`.env.local`。
