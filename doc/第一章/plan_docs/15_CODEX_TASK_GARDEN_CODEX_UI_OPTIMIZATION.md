# Garden Codex UI Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/garden` 重构为 1200px 桌面档案台，提升层级、对比度和收藏反馈，同时确保 `/world` 游戏内印记浮窗完全不变。

**Architecture:** 保持现有数据流和组件 props，仅在 `GardenPage` 增加页面级档案壳层，并对现有组件做最小语义结构调整。所有新增视觉规则限定在 `.eden-garden-page` 下，避免共享 `AchievementGarden` 的全局样式影响游戏内 `compact` 浮窗。

**Tech Stack:** Next.js 14、React 18、TypeScript、Tailwind 项目中的原生 CSS、Node 静态 smoke、Playwright 桌面浏览器。

---

## 文件结构

- Create: `scripts/test-garden-codex-ui.mjs`：验证页面结构、样式作用域和不回归约束。
- Create: `tests/e2e/garden-codex.spec.ts`：以 1920×1080 验证档案页交互与 `/world` compact 浮窗基线。
- Modify: `src/app/garden/page.tsx`：增加连续档案面板语义壳层与页尾注脚归位。
- Modify: `src/components/world/GardenCodex.tsx`：补充统计/导航语义分组，不改变 props 和状态。
- Modify: `src/components/world/AchievementGarden.tsx`：补充工具栏分组与文本锁标，不改变筛选逻辑。
- Modify: `src/components/world/ItemsGallery.tsx`：补充回响卡片状态语义，不改变数据来源。
- Modify: `src/components/world/EndingsGallery.tsx`：补充结局卡状态语义，不改变结局内容。
- Modify: `src/app/globals.css`：新增且仅新增 `.eden-garden-page ...` 作用域的桌面样式覆盖。
- Modify: `docs/PROJECT_CONTEXT.md`：记录本轮 Codex UI 开发与验证结果。

### Task 1: 建立 UI 范围保护测试

**Files:**
- Create: `scripts/test-garden-codex-ui.mjs`
- Create: `tests/e2e/garden-codex.spec.ts`

- [ ] **Step 1: 写失败的静态 smoke**

脚本读取 `page.tsx`、三个图鉴组件和 `globals.css`，至少断言：

```js
check("/garden 使用档案面板壳层", gardenPage.includes('className="eden-garden-archive"'));
const scopedBlock = css.split("GARDEN CODEX DESKTOP START")[1]?.split("GARDEN CODEX DESKTOP END")[0] ?? "";
check("新规则块存在", scopedBlock.length > 0);
check("档案主体以 1200px 为基准", /\.eden-garden-page \.eden-garden-main\s*\{[^}]*max-width:\s*1200px/s.test(scopedBlock));
const selectorLines = scopedBlock.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.includes(".eden-") && (line.endsWith("{") || line.endsWith(",")));
check("新规则内每个普通选择器均有页面作用域", selectorLines.every((line) => line.startsWith(".eden-garden-page")));
check("印记工具栏只用于非 compact 分支", achievementGarden.includes("compact ?") && achievementGarden.includes('className="eden-achievement-toolbar"'));
check("compact 分支保留 emoji 锁标", achievementGarden.includes('compact ? "🔒" : "锁"'));
check("页面包含稳定加载态", gardenPage.includes("eden-garden-loading") && gardenPage.includes('aria-busy={!isLoaded}'));
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node scripts/test-garden-codex-ui.mjs`  
Expected: FAIL，缺少 `eden-garden-archive`、1200px 作用域样式和工具栏结构。

- [ ] **Step 3: 写 1920×1080 Playwright 失败验收**

`tests/e2e/garden-codex.spec.ts` 声明 `test.use({ viewport: { width: 1920, height: 1080 } })`，覆盖 `/garden` 壳层宽度、首屏统计/分页/工具栏/四张卡、三分页切换、筛选、搜索空态、返回和焦点。文件内复制 `chapter1-mechanics.spec.ts` 的 `enterExplore` helper（不要 import spec 文件），进入 `/world` 后验证 compact 分类/筛选仍为两个结构、锁标仍含 `🔒`、网格列宽与间距处于稳定范围。

Run: `npm run test:e2e -- tests/e2e/garden-codex.spec.ts --project=desktop-chromium`  
Expected: FAIL，缺少新壳层、加载态或非 compact 工具栏。

- [ ] **Step 4: 提交测试基线**

```bash
git add scripts/test-garden-codex-ui.mjs tests/e2e/garden-codex.spec.ts
git commit -m "test: add garden codex ui smoke"
```

### Task 2: 调整页面与组件语义结构

**Files:**
- Modify: `src/app/garden/page.tsx`
- Modify: `src/components/world/GardenCodex.tsx`
- Modify: `src/components/world/AchievementGarden.tsx`
- Modify: `src/components/world/ItemsGallery.tsx`
- Modify: `src/components/world/EndingsGallery.tsx`
- Test: `scripts/test-garden-codex-ui.mjs`

- [ ] **Step 1: 在页面中建立连续档案面板**

将返回入口、页首、`GardenCodex` 和提示包在：

```tsx
<section className="eden-garden-archive" aria-labelledby="garden-title">
  <div className="eden-garden-archive-head">...</div>
  <GardenCodex ... />
  <p className="eden-garden-hint">...</p>
</section>
```

标题增加 `id="garden-title"`。背景和数据读取逻辑保持原样。增加纯 UI 的 `isLoaded` 状态：初始为 `false`，同一个 `useEffect` 完成本地存档同步和三组数据写入后设为 `true`。加载前渲染固定最小高度的 `eden-garden-loading` 骨架并设置 `aria-busy={!isLoaded}`，加载完成后再渲染 `GardenCodex`，避免统计值和锁定状态闪变；该状态不得写入存档。

- [ ] **Step 2: 为一级结构补充语义包装**

在 `GardenCodex` 中给统计带增加可读标签，给分页和面板增加稳定类名/ARIA 关联；不移动统计计算，不改变 `TABS` 与 `tab` 状态。

- [ ] **Step 3: 把印记筛选合并为一条工具栏**

用现有 `compact` prop 做明确分支。`compact === true` 时必须保留改动前的分类栏、筛选栏、搜索 DOM 顺序、元素层级、类名与 `🔒` 锁标；仅 `compact === false` 的 `/garden` 分支使用：

```tsx
<div className="eden-achievement-toolbar">
  <div className="eden-achievement-tabs" role="tablist">...</div>
  <div className="eden-achievement-filters" aria-label="印记状态筛选">...</div>
  <input ... />
</div>
```

保留所有状态与筛选逻辑。非 compact 分支把 emoji 锁替换为纯文本/样式锁标：

```tsx
<span className="eden-achievement-card-lock" aria-hidden="true">锁</span>
```

compact 分支继续渲染 `🔒`。隐藏锁定印记在非 compact 分支只显示问号纹样与“尚未发现”，不显示“？？ / 尚未解锁”；compact 分支继续保持现有文案。

- [ ] **Step 4: 为卡片增加可访问状态**

印记、回响、结局卡根据状态添加 `aria-label` 或可读状态文本；不泄露隐藏印记名称和条件。

- [ ] **Step 5: 运行静态 smoke**

Run: `node scripts/test-garden-codex-ui.mjs`  
Expected: 结构断言通过，样式断言仍因 CSS 未实现而失败。

### Task 3: 实现桌面档案台视觉

**Files:**
- Modify: `src/app/globals.css`
- Test: `scripts/test-garden-codex-ui.mjs`

- [ ] **Step 1: 实现场景与 1200px 档案壳层**

在 `/* GARDEN CODEX DESKTOP START */` 与 `/* GARDEN CODEX DESKTOP END */` 标记之间新增规则。块内每个普通选择器必须以 `.eden-garden-page` 开头：固定背景、中心柔光遮罩、`max-width: 1200px`、14px 圆角、稳定深绿实色回退、细暗金边线和克制阴影。不得修改已有未作用域 `.eden-achievement-*` 基础规则。

- [ ] **Step 2: 重排页首统计与一级分页**

页首横跨全宽；统计改成四等分横向信息带；一级分页使用底边金线而非独立卡片。所有文字对比度以深绿实色回退为基准。

- [ ] **Step 3: 实现印记工具栏与四列网格**

同一工具栏中依次放分类、状态筛选和右侧搜索。印记网格固定四列，图标 64px，卡片使用一致最小高度。锁定、隐藏、解锁三种状态必须仅依赖本页作用域覆盖。

- [ ] **Step 4: 实现回响三列与结局单列宽卡**

回响按来源维持分组，卡片为三列；结局保持单列宽卡。即时/消耗/永驻只使用现有三种低饱和色。

- [ ] **Step 5: 增加交互反馈与降级**

为按钮、输入框和卡片增加清晰 `:focus-visible`；仅已解锁卡片使用轻微 hover 上浮；`prefers-reduced-motion` 下禁用位移。不要新增移动端 media query。

- [ ] **Step 6: 运行静态 smoke**

Run: `node scripts/test-garden-codex-ui.mjs`  
Expected: PASS，所有断言通过。

- [ ] **Step 7: 提交 UI 实现**

```bash
git add src/app/garden/page.tsx src/components/world/GardenCodex.tsx src/components/world/AchievementGarden.tsx src/components/world/ItemsGallery.tsx src/components/world/EndingsGallery.tsx src/app/globals.css scripts/test-garden-codex-ui.mjs
git commit -m "feat: refine garden codex desktop ui"
```

### Task 4: 回归验证与项目快照

**Files:**
- Test: `tests/e2e/garden-codex.spec.ts`
- Modify: `docs/PROJECT_CONTEXT.md`

- [ ] **Step 1: 完成实现后运行静态与项目级检查**

```bash
node scripts/test-garden-codex-ui.mjs
node scripts/test-world-visual-smoke.mjs
npm run lint
npm run build
npm run test:e2e -- tests/e2e/garden-codex.spec.ts --project=desktop-chromium
```

Expected: 全部退出码为 0；现有世界页视觉 smoke 保持全绿。

- [ ] **Step 2: 桌面浏览器补充目视验收**

在 1920×1080 检查：首屏包含页首、四项统计、一级分页、完整工具栏和至少一行卡片；依次切换三个分页；验证分类、状态筛选、搜索空态、返回首页和键盘焦点。

- [ ] **Step 3: 检查共享浮窗未回归**

进入 `/world` 打开园中印记浮窗，确认 `compact` 网格、间距、按钮和关闭流程仍与改动前一致。

- [ ] **Step 4: 检查敏感信息与范围**

Run: `git diff --check`，并搜索本轮 diff 中是否出现 API Key、secret 或移动端 media query。  
Expected: 无空白错误、无敏感信息、无移动端新增规则。

- [ ] **Step 5: 更新共享快照**

在 `docs/PROJECT_CONTEXT.md` 追加本轮改动、验证命令、结果和比赛展示价值；不重写历史记录。

- [ ] **Step 6: 最终提交**

```bash
git add docs/PROJECT_CONTEXT.md
git commit -m "docs: record garden codex ui verification"
```
