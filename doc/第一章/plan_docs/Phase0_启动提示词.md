# Phase 0 启动提示词 - 交付 CodeBuddy 执行

> 直接复制以下全部内容粘贴到 CodeBuddy 对话中即可。

---

## 你的身份

你是 EDEN 项目的核心开发工具 CodeBuddy。现在开始执行第一章「园中诸声」开发执行规划的 Phase 0（准备阶段，0.5 天）。

## 必读文档（按顺序阅读，全部读完再动手）

1. `AGENTS.md` - 项目最高规则，严格遵守所有约束
2. `doc/第一章/plan_docs/伊甸园开发执行规划_正式版.md` - 完整开发规划（注意顶部 v1.1 修订说明，云服务相关任务已移除）
3. `docs/PROJECT_CONTEXT.md` - 项目当前状态快照
4. `design/01_world_bible.md` - 世界观顶层规则
5. `design/ACHIEVEMENT_GARDEN_MARK.md` - 印记系统设计（28 个印记）
6. `design/RESONANCE_FULL_DESIGN.md` - 园中回响设计
7. `design/INTERACTION_LOGIC.md` - 交互逻辑

阅读时使用 CodeGraph 确认以下文件的当前符号和调用方：
- `src/game/world/types.ts`（EdenWorldState、AchievementId）
- `src/content/world/achievements.ts`（当前 15 个印记）
- `src/content/world/items.ts`（当前道具列表）
- `src/game/world/achievementRules.ts`（当前解锁逻辑）
- `src/app/world/page.tsx`（当前游戏页面 UI 结构）

## 核心约束（不可违反）

1. 你是唯一开发执行方，保留完整对话记录
2. 非侵入式开发：禁止修改现有核心玩法逻辑（对话逻辑、心智计算、结局触发、动作链校验）
3. 不删除/修改 `doc/` 目录下任何原有文件
4. 不在前端代码中硬编码密钥
5. 本轮不接任何数据库/云服务，登录为纯前端 localStorage 方案
6. NPC 状态不新增字段（现有 obedience + serpentTrust + selfJudgement 保留不动）
7. 桌面浏览器优先，目标视口 1920x1080

## 本轮执行任务（Phase 0 共 3 个任务）

### Task 0.1：确认设计文档基线与冲突裁决（0.5 小时）

在对话中记录以下确认结果：
- D1 裁决：保留现有三维度心智（含 selfJudgement），不迁移不删除
- D2 裁决：保留现有全部 NPC，不删除不重命名
- D3 裁决：按设计文档实现 28 个印记（4 分类：探索 7 / 交互 9 / 玩法 7 / 结局 5，含 4 个隐藏）
- D4 裁决：按设计文档实现现有 19 个道具
- D5 裁决：按正文实现 4 个隐藏印记（非标题写的 8 个）
- 用 CodeGraph 确认 achievements.ts 当前 15 个印记、items.ts 当前道具数量，记录在对话中

验收标准：对话中明确记录 D1-D5 裁决结论 + CodeGraph 查询结果

### Task 0.2：创建新功能目录结构与占位文件（1 小时）

创建以下占位文件，每个导出可编译的空组件/空函数（不引入新依赖）：

```
src/components/world/AchievementGarden.tsx    # 图鉴组件占位
src/components/world/InventoryPanel.tsx       # 回响面板优化组件占位
src/components/world/DivineAttentionViz.tsx   # 神注视可视化组件占位
src/components/world/NpcStatusHint.tsx        # NPC 状态提示组件占位
src/components/world/SaveControl.tsx          # 存档控制组件占位
src/components/world/LoginPanel.tsx           # 登录 UI 组件占位（纯前端）
src/app/garden/page.tsx                       # 图鉴页面路由占位
src/content/world/whisperFeedback.ts          # 低语反馈文案占位
src/content/world/npcStatusHints.ts           # NPC 状态提示文案占位
```

每个占位组件示例：
```tsx
export default function AchievementGarden() {
  return null;
}
```

验收标准：
- 所有占位文件创建成功，可编译
- `npx tsc --noEmit` 通过
- `npm run lint` 通过
- 不修改任何现有文件

### Task 0.3：生成 28 个成就图标素材（2 小时）

使用项目内置生图工具，为 28 个印记生成 64x64 px PNG 透明背景图标，保存到 `public/assets/chapter1/images/achievements/` 目录。

图标风格：自然元素 + 园内物品，统一水彩/手绘风格，符合神话世界观。

按 4 分类生成（文件名 = 印记 ID + .png）：

**探索类（7 个）：**
- `mark_river_step.png` - 流水波纹
- `mark_all_resonance.png` - 回响碎片汇聚
- `mark_name_stone.png` - 刻名石
- `mark_moonlight.png` - 月光道路
- `mark_gift_3.png` - 神恩光印三重
- `mark_echo_collector.png` - 回声波纹环绕
- `mark_hidden_scene.png` - 问号/模糊暗影（隐藏印记，不暴露内容）

**交互类（9 个）：**
- `mark_all_npc_friend.png` - 园中众灵环绕
- `mark_her_trust.png` - 女性侧影 + 信任之光
- `mark_adam_friend.png` - 亚当的石子
- `mark_michael_approve.png` - 米迦勒水纹盾
- `mark_gabriel_tip.png` - 加百列白羽
- `mark_lucifer_trust.png` - 晨星光点
- `mark_hedgehog_friend.png` - 刺猬细刺
- `mark_question_10.png` - 低语涟漪
- `mark_hidden_dialog.png` - 问号/模糊（隐藏）

**玩法类（7 个）：**
- `mark_no_attention.png` - 风过无痕
- `mark_fast_pass.png` - 晨露滴
- `mark_one_whisper.png` - 单句回声
- `mark_no_resonance.png` - 空手印记
- `mark_peace_pass.png` - 和平橄榄枝
- `mark_hard_mode.png` - 逆行足迹
- `mark_hidden_operation.png` - 问号/模糊水纹（隐藏）

**结局类（5 个）：**
- `mark_success_ending.png` - 逐出之门
- `mark_fail_ending.png` - 神临脚步
- `mark_life_fruit.png` - 永生之果
- `mark_all_ending.png` - 诸路交汇
- `mark_hidden_ending.png` - 问号/模糊缸影（隐藏）

生成后在 `doc/AI_ASSET_RECORD.md` 末尾追加记录（不修改原有内容）：
- 生成工具名称
- prompt 摘要（按分类记录）
- 用途说明
- 生成日期

验收标准：
- 28 个图标文件全部生成，文件名与印记 ID 对应
- 隐藏印记图标使用问号/模糊处理
- `doc/AI_ASSET_RECORD.md` 已追加记录（不修改原有内容）

## 执行规则

1. 逐任务执行，不要一次性重写全部
2. 每个 Task 完成后在对话中记录完成情况
3. Task 0.2 完成后运行 `npx tsc --noEmit` 和 `npm run lint` 验证
4. Task 0.3 完成后确认 28 个文件都存在
5. 全部完成后输出 Phase 0 完成报告：

```
## Phase 0 完成报告

### 执行任务
- Task 0.1：[完成/部分完成/未完成]
- Task 0.2：[完成/部分完成/未完成]
- Task 0.3：[完成/部分完成/未完成]

### 验证结果
- npx tsc --noEmit: [pass/fail]
- npm run lint: [pass/fail]
- 成就图标数量: [X/28]

### CodeBuddy 证据链
- 本轮对话已保留：[是/否]
- 核心设计决策：...
```

## 注意

- Task 0.4（Vercel KV 配置）已在 v1.1 修订中移除，不要执行
- 不要创建任何 `src/services/cloud/`、`src/hooks/useCloudSync.ts`、`src/app/api/auth/route.ts`、`src/app/api/cloud-save/route.ts` 等云服务文件
- 登录 UI（LoginPanel.tsx）的占位文件可以创建，但具体实现留到 Phase 2
- 开始前如果有任何疑问，先在对话中提出，确认后再动手