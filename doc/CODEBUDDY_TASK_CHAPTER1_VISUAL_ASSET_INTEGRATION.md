# CodeBuddy Task: 第一章地图背景与非主角 NPC 立绘接入

## Objective

将 Codex 生成的第一章视觉候选素材接入 `/world`，优化 5 个地图地点背景，并评估替换除亚当、夏娃外的 NPC / 世界对象立绘。

Codex 本轮只生成和记录候选素材；核心页面引用、视觉回归和最终取舍由 CodeBuddy 执行并保留对话记录。

## Recommended Assets

优先接入 5 张地点背景候选：

- `public/assets/chapter1/images/location_central_meadow_v3_candidate.png`
- `public/assets/chapter1/images/location_four_river_source_v3_candidate.png`
- `public/assets/chapter1/images/location_adam_garden_work_v3_candidate.png`
- `public/assets/chapter1/images/location_tree_court_v3_candidate.png`
- `public/assets/chapter1/images/location_naming_stone_bank_v3_candidate.png`

优先评估接入守望天使透明立绘：

- `public/assets/chapter1/images/npc_watching_angel_builtin_candidate.png`

优先评估用户选定的圆润版刺猬透明立绘：

- `public/assets/chapter1/images/npc_hedgehog_rounded_final.png`
- 源图存档：`public/assets/chapter1/images/npc_hedgehog_rounded_source.png`

暂不建议直接接入，仅作为概念候选：

- `public/assets/chapter1/images/object_forbidden_tree_sprite_candidate.png`

## Visual Direction

- 必须贴合现有 Demo 场景图 `public/assets/chapter0/images/eden_dialogue_background_v2.png` 的写实电影感、暗金绿色调、干地前景和可放置角色立绘的舞台构图。
- 不使用第一版偏梦幻或技术网格过明显的 `*_v2.png` 作为最终接入图。
- 守望天使只能作为边界远影或守卫 presence，不要表现为上帝，不要接 TTS。
- 刺猬仍是氛围角色，不影响通关、不消耗回合；不要接入前一版 `npc_hedgehog_sprite_v3_candidate.png`，当前推荐圆润版最终图。

## Suggested Code Changes

1. 在 `src/game/assets.ts` 的 `CHAPTER1_IMAGES` 中新增候选路径，或在确认后把现有 5 个 `location_*` 路径切到 v3 candidate。
2. 在 `/world` 场景层中使用守望天使候选图替代纯 CSS 光柱时，控制显示尺寸和透明度，避免抢过夏娃/亚当。
3. 如替换刺猬，检查命名河滩场景中缩放、脚底位置和边缘是否自然。
4. 不要删除旧素材；保留旧图作为回滚路径。
5. 更新 `doc/第一章/素材需求文档.md` 和 `doc/AI_ASSET_RECORD.md` 的最终接入状态。

## Acceptance Checks

- `npm run lint`
- `npm run build`
- `npx tsc --noEmit`（如 `.next/types` 缺失，先跑 build）
- `node scripts/test-world-visual-smoke.mjs`
- `node scripts/test-world-smoke.mjs http://localhost:3000`
- 桌面浏览器打开 `/world`，检查 5 个地点背景均加载、右侧浮窗文字可读、角色立绘不漂浮、不被背景吞没。
- 玩家可见文本不出现 AI / Agent / NPC / 模型 / 程序 / 系统 / RAG / Tool 等工程词。
- 无新增明文密钥；不移动或删除 `doc/` 内既有文件。
