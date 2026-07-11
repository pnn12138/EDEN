# 第一章 v3.0 世界收敛迁移与体验优化 Implementation Plan

> **For agentic workers:** 本任务的核心实现工具必须是 CodeBuddy。请按本文任务顺序逐项实施、测试并在 CodeBuddy 对话中保留关键设计决策、代码生成、调试和验收记录。Codex 仅负责测试、代码审查、边界检查与提交前验收，不替代 CodeBuddy 做主要实现。

**Goal:** 将第一章 `/world` 的代码实现从旧的「15 NPC + 旧道具 + 半成神注视」体系，收敛迁移到 2026-07-10 定稿的精简设计（world bible v3.0 / npc_full_design v1.0 / resonance_full_design v1.0 / achievement_garden_mark v1.0 / interaction_logic v1.0 / interaction_design v2.0），即「6 NPC + 14 回响 + 28 印记 + 双维度心智 + 可经营的神明注视」。在玩家测试通过前完成内容优化，部署前置准备同步就位。

**Architecture:** 沿用「LLM 负责自然对白与工具意图、规则层负责状态变化与奖励执行」的既有架构。NPC 身份、地点常驻、道具来源、注视增减、印记解锁、心智门槛全部由 TypeScript 规则层决定；Agent 不得直接写入世界状态、背包、好感、语言状态或结局。迁移必须兼容现有本地存档与 AI 接口失败兜底。

**Tech Stack:** Next.js 14、React 18、TypeScript、现有 OpenAI-compatible LLM Provider、React `useState`、localStorage 世界存档、Playwright、现有 `.mjs` smoke 测试。

---

## 0. CodeBuddy 执行身份与项目约束

你现在是 EDEN 项目的核心开发工具 CodeBuddy。本任务是世界观文档 v3.0 定稿后的代码收敛迁移。

开始修改前必须完整阅读：

- `AGENTS.md`
- `README.md`
- `package.json`
- `docs/PROJECT_CONTEXT.md`
- `design/00_project_overview.md`
- `design/01_world_bible.md`（v3.0，6 NPC 精简世界，权威）
- `design/characters/npc_full_design.md`（v1.0，6 NPC 完整设定，权威）
- `design/RESONANCE_FULL_DESIGN.md`（v1.0，14 回响，权威）
- `design/ACHIEVEMENT_GARDEN_MARK.md`（v1.0，28 印记，权威）
- `design/INTERACTION_LOGIC.md`（v1.0，交互逻辑，权威）
- `design/INTERACTION_DESIGN.md`（v2.0，低语语法，权威）
- `design/chapters/chapter1_garden_voices_play_upgrade_design.md`
- `doc/第一章/plan_docs/09_CODEBUDDY_TASK_CHAPTER1_RESONANCE_AND_DIVINE_GIFTS.md`
- `doc/第一章/plan_docs/11_CODEBUDDY_TASK_CHAPTER1_SCENE_DIALOGUE_RELATION_REWARD_POLISH.md`
- 本文件
- doc/第一章/plan_docs/13_CODEBUDDY_TASK_CHAPTER1_DEMO_MATURITY_AND_SAFETY_NET.md（Demo 成熟度与安全网：LLM 超时/重试、新手引导、难度安全网、流式输出、音频补齐、注视可见反馈。与本文解耦并行，重叠点见该文档 §7 交叉引用表）

开始修改代码前使用 CodeGraph 确认相关符号、调用方和影响范围。若 CodeGraph 报告 pending sync 或 stale，直接读取对应源码。

必须遵守：

- CodeBuddy 是核心实现和主要调试工具；必须保留本任务对话记录。
- Codex 只负责后续测试、代码审查、边界检查和验收。
- 不删除、重命名或移动 `doc/` 中任何文件。
- 不在前端、测试、日志或文档中写入真实 API Key。
- 不引入大型依赖。
- 当前只验收桌面 Chrome，目标视口 1920×1080；不新增移动端专项功能。
- 所有 Agent 工具必须经过规则层白名单、状态条件和重复保护校验。
- AI/LLM 失败时，核心流程仍必须可运行（fallback 固定回复）。
- 不扩大到 Chapter 0、双声试炼或新的地图地点（保持 6 地点）。
- 不让属性页显示内部标签名、Prompt、工具名或工程术语。
- 所有 NPC 初始对蛇无敌意；所有天使初始使用中文。
- 路西法隐藏结局（营养缸觉醒）的触发逻辑严格保密，不写入任何对外可见文档或文案。

---

## 1. 当前实现事实与已确认问题

修改前先在 CodeBuddy 中复核以下事实。若实际代码不同，以当前源码为准并在完成报告中说明差异。

### 1.1 迁移基线（已通过）

- `npm run lint` / `npx tsc --noEmit` / `npm run build` 当前均通过（2026-07-10）。
- `node scripts/test-scene-puzzle-rules.mjs` 51/51、`test-world-visual-smoke.mjs` 238/238、`test-world-smoke.mjs` 191/0。
- `npm run test:e2e -- tests/e2e/chapter1-mechanics.spec.ts` 3/3。

### 1.2 NPC 体系脱节（核心问题）

实现仍是旧版 15 个 NPC / 世界对象：

```
eve, adam, hedgehog, watching_angel, forbidden_tree,
gabriel, raphael, uriel, michael, cherubim,
dove, fox, deer, sheep, tree_of_life
```

而 v3.0 设计要求 6 个 NPC + 2 个世界对象：

```
NPC:    女人(eve) / 亚当(adam) / 米迦勒(michael) / 加百列(gabriel) / 路西法(lucifer) / 刺猬(hedgehog)
对象:   分别善恶树(forbidden_tree) / 生命树(tree_of_life)
```

需要移除的旧 NPC：`watching_angel`、`raphael`、`uriel`、`cherubim`、`dove`、`fox`、`deer`、`sheep`。
需要新增的 NPC：`lucifer`（路西法，当前代码以 `uriel` 隐藏身份映射，需正名）。

引用旧 NPC 的源文件清单（共约 22 个）：

| 文件 | 旧 NPC 引用数 |
| --- | --- |
| `src/game/world/types.ts` | 26 |
| `src/app/world/page.tsx` | 36 |
| `src/content/world/npcChallenges.ts` | 13 |
| `src/content/world/worldNarrations.ts` | 16 |
| `src/game/world/toolRules.ts` | 12 |
| `src/content/world/npcs.ts` | 12 |
| `src/content/world/npcGuides.ts` | 11 |
| `src/app/api/world/route.ts` | 9 |
| `src/app/api/world/tool/route.ts` | 16 |
| `src/game/world/npcLanguageRules.ts` | 5 |
| `src/game/world/achievementRules.ts` | 6 |
| `src/content/world/npcRelations.ts` | 4 |
| `src/content/world/locations.ts` | 4 |
| `src/game/assets.ts` | 4 |
| `src/content/world/npcLanguages.ts` | 4 |
| `src/content/world/npcStatusHints.ts` | 3 |
| `src/game/world/resonanceRules.ts` | 5 |
| `src/game/world/traceRules.ts` | 3 |
| `src/agents/world/angelAgent.ts` | 1 |
| `src/agents/common/naturalizeNpcReply.ts` | 2 |
| `src/content/world/clues.ts` | 1 |
| `src/game/world/clueRules.ts` | 1 |
| `tests/e2e/repro-scene-polish.spec.ts` | 8 |

### 1.3 地点常驻者需重分配

v3.0 §2.2 的权威地点常驻表与当前实现不一致：

| 地点 (id) | 当前常驻 | v3.0 目标常驻 |
| --- | --- | --- |
| 伊甸之河 `four_river_source` | gabriel/raphael/uriel(夜) | 米迦勒 |
| 万物受名处 `adam_garden_work` | adam | 亚当 |
| 园中树林 `tree_court` | eve | 女人 |
| 东园幽径 `east_garden_path` | cherubim/hedgehog | 加百列、刺猬 |
| 四河分流 `naming_stone_bank` | michael | 路西法 |
| 园子中央 `central_meadow` | 无常驻 | 无常驻（两棵树） |

即：米迦勒从四河分流迁到伊甸之河，路西法接管四河分流，加百列迁到东园幽径。

### 1.4 道具系统新旧混用

`src/content/world/items.ts` 仍含已废弃道具：`resonance_morning_flame`（乌列尔）、`resonance_east_gate_glow`（基路伯）、`gift_sabbath_dew`。`RESONANCE_FULL_DESIGN.md` 第五节已明确删除它们。`divineGiftRules.ts` 的 `getNearMissResonanceHint` 与 `resolveDivineGift` 也仍引用旧道具/旧 NPC。

### 1.5 神明注视机制半成（重点优化项）

`divineAttentionRules.ts` 只实现了增长的一半：

- 增长仅按 `direct_command`(+2)、`irrelevant`(+1)、天使所在区域(+1)、强诱白天使区(+1)、`touch_fruit`(+1) 计算。
- `WorldInputTag` 是 `{tempt_wisdom, weaken_fear, build_trust, direct_command, irrelevant}`，与设计的 5 类语义信号 `{challenge_prohibition, soften_death, promise_wisdom, self_judgement, gentle_reframe}` 名称和分级都不一致。
- 缺夜晚低语 +1。
- **注视降低机制完全缺失**：进时段 -1、观察生命树 -1(每局限 1 次)、无声草抵消 -1~-2、米迦勒满好感遮蔽下次低语，均未实现。`applyDivineAttention` 从未被传入负值，注视只涨不降（除满 4 归零）。

### 1.6 心智模型矛盾

- `design/01_world_bible.md` §3 要求删除 `selfJudgement`，改由 `obedience` 与 `serpentTrust` 交叉点决定自我判断。
- 但 `EveMind` 仍有 `selfJudgement`，`achievementRules.ts`（`question_takes_root`/`not_pushed_by_hand`）与 `INTERACTION_LOGIC.md` §四的动作链门槛仍引用 `selfJudgement >= 35/50/70`。文档自身也互相矛盾。

### 1.7 AP 数值不一致

- `world_bible v3.0` §2.5、`INTERACTION_LOGIC.md` §一、`INTERACTION_DESIGN.md` §2 均写「每时段 3 AP」。
- `chapter1_garden_voices_play_upgrade_design.md`、`README.md`、`PROJECT_CONTEXT.md` 均写「5 AP」。
- 实现代码当前为 5 AP（`maxActionPoints`）。

### 1.8 印记规则与数据集错位

`achievements.ts` 的 28 印记数据已对齐设计（✅），但 `achievementRules.ts` 解锁判定仍混用旧 15 印记 ID（`river_sound_in_ear` 等）与旧 NPC/旧道具引用；`RESONANCE_ALL_MARK_SET` 含已废弃道具，导致 `mark_all_resonance` 永不可达。

### 1.9 素材缺口

- 现有立绘：`npc_gabriel_sprite.png`、`npc_michael_sprite.png`、`npc_raphael_sprite.png`、`npc_uriel_sprite.png`、`npc_cherubim_sprite.png`、`npc_watching_angel_*`、`npc_hedgehog_*`、`object_forbidden_tree_*`。
- **缺失立绘：路西法（lucifer）**。28 个印记图标已齐（含 `mark_lucifer_trust.png`）。
- 6 地点昼夜背景已齐。

---

## 2. NPC 体系迁移设计

### 2.1 最终 NPC / 对象清单（权威）

```
对话 NPC（接 LLM）：
  eve       女人        主目标，可触发禁忌动作链
  adam      亚当        情报 Agent
  michael   米迦勒      伊甸之河守护，神最忠诚天使
  gabriel   加百列      东园幽径信使天使
  lucifer   路西法      四河分流，明亮之星（隐藏结局载体）
  hedgehog  刺猬        环境反馈（延续 Chapter 0）

世界对象（不接 LLM）：
  forbidden_tree  分别善恶树
  tree_of_life    生命树
```

### 2.2 旧 NPC 处置决策

| 旧 NPC | 处置 | 说明 |
| --- | --- | --- |
| `watching_angel` | 移除 | 边界压力职能并入米迦勒 + 神注视规则层；其立绘可保留为通用天使剪影备用 |
| `raphael` | 移除 | 安抚职能不保留（设计已精简） |
| `uriel` | 重命名为 `lucifer` | 路西法此前以乌列尔隐藏身份出现，本次正名；保留其隐藏结局链路 |
| `cherubim` | 移除 | 东园守卫职能并入加百列 |
| `dove` | 移除 | 传话职能并入加百列的「传令白羽」回响 |
| `fox` | 移除 | 话术批评职能不保留 |
| `deer` | 移除 | 情绪镜像职能并入刺猬 |
| `sheep` | 移除 | 背景动物不保留 |

> 注意：`uriel` → `lucifer` 是「重命名 + 人设替换」，不是简单字符串替换。需同步替换其 prompt、说话风格、初始状态（obedience=40 / serpentTrust=30）、地点（四河分流）。隐藏结局触发场景 id 从 `interact_lucifer_rowing` / `trigger_lucifer_hidden_ending` 保持不变。

### 2.3 地点常驻重分配

按 §1.3 表更新 `src/content/world/locations.ts` 的常驻者字段与 `initialEdenWorldState` 的 `npcLocations`：

```ts
npcLocations: {
  eve: "tree_court",          // 园中树林
  adam: "adam_garden_work",   // 万物受名处
  michael: "four_river_source", // 伊甸之河
  gabriel: "east_garden_path",  // 东园幽径
  lucifer: "naming_stone_bank", // 四河分流
  hedgehog: "east_garden_path", // 东园幽径
}
```

### 2.4 天使 Agent 路由改造

当前 `runAngelAgent` 硬编码 `watching_angel` 身份（`naturalizeNpcReply(cleaned, "watching_angel")`）。需改为按 `angelId` 分发：

- `buildAngelPrompt` 增加参数 `angelId: AngelNpcId`，按天使返回不同人设 prompt（米迦勒/加百列/路西法 各自的说话风格与主题，见 `npc_full_design.md`）。
- `runAngelAgent` 接收 `angelId`，透传给 prompt 构建与 `naturalizeNpcReply`。
- `AngelNpcId` 类型收敛为 `"michael" | "gabriel" | "lucifer"`。
- 三位天使的初始状态（`npcRelations` 或新增 `angelMinds`）：
  - 米迦勒 obedience=95 / serpentTrust=5
  - 加百列 obedience=85 / serpentTrust=15
  - 路西法 obedience=40 / serpentTrust=30

### 2.5 工具权限收敛

`WORLD_AGENT_TOOL_PERMISSIONS` 中删除 `watching_angel`、`raphael`、`uriel`、`cherubim`、`dove`、`fox`、`deer`、`sheep` 条目；新增 `lucifer`（与 michael/gabriel 同权限：可移动/观察/对话，不可触发禁忌链）。`NewToolName` 中的 `carry_words`（鸽子传话）、`judge_whisper_style`（狐狸评价）若不再有载体，评估移除或保留为未使用类型（建议移除以保持类型干净）。

### 2.6 受影响内容文件迁移要点

- `src/content/world/npcs.ts`：`EDEN_NPCS` 与 `NPC_NAMES` 收敛为 8 项（6 NPC + 2 对象）。
- `src/content/world/npcLanguages.ts` / `npcLanguageRules.ts`：天使语言配置收敛为 michael/gabriel/lucifer；言语分裂惩罚保留三天使。
- `src/content/world/npcChallenges.ts`：天使试炼配置收敛为三天使。
- `src/content/world/npcGuides.ts` / `npcRelations.ts` / `npcStatusHints.ts`：删除旧 NPC 条目，新增 lucifer。
- `src/content/world/worldNarrations.ts`：删除 dove/fox/deer/sheep 相关模板，新增路西法对话模板。
- `src/app/world/page.tsx`：删除旧 NPC 立绘渲染与点击逻辑（约 36 处引用），新增路西法立绘位。
- `src/game/assets.ts`：删除旧 NPC 资源映射，新增 lucifer 资源映射。

---

## 3. 道具系统清理与对齐

### 3.1 删除已废弃道具

从 `src/content/world/items.ts` 删除：

- `resonance_morning_flame`（乌列尔，已废弃）
- `resonance_east_gate_glow`（基路伯，已废弃）
- `gift_sabbath_dew`（功能合并到河源露，已废弃）
- `consumable_first_whisper_free`（功能合并到细语印记，已废弃）
- `resonance_deer_glance`、`resonance_fox_tail_note`、`resonance_white_feather_echo`（载体已移除）
- `resonance_eve_own_voice` 重命名为 `resonance_her_voice`（对齐设计 ID）
- `resonance_adam_quiet_bond` 重命名为 `resonance_quiet_stone`（对齐设计 ID）

### 3.2 新增/补齐 14 回响

按 `RESONANCE_FULL_DESIGN.md` 第二节确保以下 14 项全部存在且 ID 对齐：

| 回响 ID | 来源 NPC/场景 |
| --- | --- |
| `resonance_still_leaf` | 女人好感达标 / 伊甸之河岸边场景 |
| `resonance_borrowed_name` | 亚当好感达标 / 刻名石互动 |
| `resonance_silent_grass` | 刺猬好感达标 / 园中树林落叶堆 |
| `resonance_hedgehog_bristle` | 刺猬好感达标 |
| `resonance_herald_feather` | 加百列好感达标 |
| `resonance_east_wind` | 加百列好感达标（夜晚） |
| `resonance_lucifer_star` | 路西法好感达标 |
| `resonance_quiet_stone` | 亚当满好感奖励 |
| `resonance_river_dew` | 米迦勒好感达标 |
| `resonance_boundary_mark` | 米迦勒好感达标 |
| `resonance_four_river_echo` | 路西法好感达标 / 四河分流场景 |
| `consumable_trust_dew` | 女人好感达标 |
| `gift_revealing_light` | 神注视满 4 献礼 |
| `gift_wide_path_seal` | 神注视满 4 献礼 |

被动型回响（`resonance_living_names`、`passive_light_step`、`passive_soft_whisper`、`resonance_her_voice`、`moonlight_path_marker`）保留，ID 对齐设计。

### 3.3 神明献礼规则修正

`src/game/world/divineGiftRules.ts`：

- `resolveDivineGift`：移除 `gift_sabbath_dew` 分支，改为「行动点 ≤ 1 时给予 `resonance_river_dew`（河源露）」或直接二选一（照见之光 / 宽行之印）。
- `getNearMissResonanceHint`：所有提示文案改引新版 6 NPC 与 14 回响，删除对乌列尔/基路伯/旧道具的引用。

### 3.4 回响来源绑定

每个回响的 `sourceType`/`sourceName` 必须与 `npc_full_design.md` 中该 NPC 的「主动给予道具触发条件」表一致。规则层 `bestowResonance` 的资格校验需按新 NPC 重写。

---

## 4. 神明注视机制优化（重点）

按 `INTERACTION_LOGIC.md` §五与 `INTERACTION_DESIGN.md` §3，把注视从「单向惩罚条」升级为「可经营的风险资源」。

### 4.0 设计原则：上升来源必须有真实代价

注视满 4 只触发献礼并归零、不直接失败。若上升没有代价，玩家会主动刷注视薅献礼，机制即失效。因此**高注视本身必须挂到核心玩法上产生代价**，让「要资源就得承担注视代价」成立：

- 注视 **2-3**：女人每回合 `obedience` **+5**（她感到被注视，更紧抓禁令）-> 动作链门槛更难达成。
- 注视 **4** 触发献礼时：叙事「神在园中行走」，女人 `obedience` **+10** 一次性 spike，需用温柔低语压回去。
- 效果：激进玩法（命令/提禁树）涨注视快，但女人反而更虔诚 -> 越急越推不动；温柔玩法注视低，女人 obedience 持续下降 -> 慢但有效。

实现：在 `mindRules`（`updateWorldMinds`）每次结算后，若 `divineAttention >= 2` 给 `obedience` 加 vigilance buff；满 4 献礼时在 `triggerDivineGiftIfFull` 内额外 +10。buff 可恢复，不锁定。

### 4.1 注视上升来源（三层）

**第一层：低语语义（核心）**

`computeDivineAttentionDelta` 按语义信号 + 冒犯程度分级（对齐 `INTERACTION_LOGIC.md` §五）：

| 动作/信号 | 增量 |
| --- | --- |
| 温和提问/闲聊（`build_trust` / 无强信号） | 0 |
| 质疑禁令 / 弱化死亡恐惧（`tempt_wisdom` 弱诱导 / `weaken_fear`） | +1 |
| 直接提「吃果子」「禁树」（`tempt_wisdom` 强诱导） | +2 |
| 命令 / 威胁女人 / 质疑神（`direct_command`） | +3 |
| 夜晚低语 | 额外 +1 |
| 使用 `resonance_lucifer_star`（非满好感强化版） | 额外 +1 |
| `touch_fruit` 工具执行后 | +1（保留现有 `computeToolDivineAttentionDelta`） |

语义信号映射：现有 5 个 `WorldInputTag`（`tempt_wisdom`/`weaken_fear`/`build_trust`/`direct_command`/`irrelevant`）与设计 5 类信号等价映射（tempt_wisdom≈promise_wisdom，weaken_fear≈soften_death，build_trust≈gentle_reframe），保留现有 tag 名称不改类型，仅在注视规则中按 tag 分级。

**第二层：NPC 特定对话（对谁说 + 说什么）**

每个 NPC 增加 `attentionRisk` 字段（基础注视）+ 高风险话题关键词触发：

| 低语对象 | 基础注视（每次） | 触发额外注视的话题（关键词命中） |
| --- | --- | --- |
| 女人 eve | 按语义 0/+1/+2/+3 | 提「吃果子/那棵树」+2；命令/威胁 +3 |
| 米迦勒 michael | **+1**（神最忠心守望者，与他说话本身被记录） | 提「禁树/善恶」或质疑「神为什么」再 +2 |
| 加百列 gabriel | 0（同情蛇，不向上报告） | 直接提「禁树」+1（他毕竟是信使） |
| 路西法 lucifer | 0（阴影，分散注视） | 无额外；用其晨星碎片时 +1 |
| 亚当 adam | 0 | 讨论禁令/死亡 +1（禁令承载者，提及即强化禁忌可见性） |
| 刺猬 hedgehog | 0 | 永不涨 |

让「对谁说话」成为策略：找米迦勒拿回响要付注视代价，找路西法/加百列安全。实现为 NPC 元数据加 `attentionRisk` 字段 + 复用现有关键词匹配逻辑。

**第三层：被动累积（时间 + 资源）**

| 触发 | 增量 | 说明 |
| --- | --- | --- |
| 每跨一天（每 2 时段，即 day transition） | +1 | 叙事「神的日子近了，园中风渐凉」；让注视有稳定心跳，温柔玩家一局也能自然触 1-2 次献礼 |
| 每获得一个回响 | +1 | 主题「在园中积累越多，越被注视」；与 `mark_all_resonance` 成就形成自平衡（集齐 14 ≈ +14 注视 ≈ 3-4 次献礼，但女人更虔诚，需先压注视再冲刺） |

### 4.2 注视降低规则（新增，关键）

新增 `computeDivineAttentionReduction` 与对应调用点：

| 触发 | 减量 | 实现位置 |
| --- | --- | --- |
| 进入下一时段 | -1（最多降到 0） | `advanceToNextSlot`（`actionPointRules.ts`） |
| 观察生命树 | -1（每局仅 1 次） | `executeObserveLocation`（`worldActions.ts`），新增 `observedTreeOfLife` 标记 |
| 使用 `resonance_silent_grass` | -1~-2（抵消对应增量） | `resonanceRules.ts` 的 `applyPendingConsumableToWhisper` 或新结算点 |
| 米迦勒满好感遮蔽 | 下一次低语注视增量归零 | 新增 `michaelShieldActive` 状态，在 `computeDivineAttentionDelta` 前置判断 |

> 平衡决策（已选定方案 A）：保留「进时段 -1 冷却」+「每获回响 +1」，二者部分抵消但整体节奏自然、容错性好，适合比赛 Demo 上手门槛。不采用方案 B（去掉冷却让注视更黏），避免激进流崩盘。

### 4.3 平衡测算（一局典型成功线）

| 来源 | 温柔流 | 激进流 |
| --- | --- | --- |
| 对女人低语（10 次） | +5（均 +0.5） | +25（均 +2.5） |
| 找米迦勒拿回响（3 次） | +3 | +3 |
| 获回响（5 个） | +5 | +5 |
| 跨天（6 次） | +6 | +6 |
| 进时段冷却（11 次） | -11 | -11 |
| **净注视** | **+8 -> 2 次献礼** | **+28 -> 7 次献礼，但女人极度虔诚** |

温柔流：注视低、献礼少、女人 obedience 持续降 -> 能赢。
激进流：注视爆表、献礼多（全是补救）、女人 obedience 被注视顶住 -> 赢不了，得转温柔。
献礼是「补救」不是「奖励」，激进玩家拿到一堆补救也补不回来。

### 4.4 注视等级叙事

`DIVINE_ATTENTION_NARRATIONS` 已存在 0-4 叙事，需对齐 `INTERACTION_LOGIC.md` §五的等级表（0 风很温和 -> 4 风完全停 + 献礼）。确认 `DivineAttentionViz.tsx` 的视觉阶段（`getDivineAttentionStage`）与文案一致。

### 4.5 满值流程

满 4 流程已在 `triggerDivineGiftIfFull` 实现（献礼 + 归零 + `divineVisitCount` + `divineGiftHistory`），保留。本次新增：满 4 时额外触发女人 `obedience` +10 spike（§4.0 代价机制）。确认献礼后游戏继续、不进入 `god_arrives`。

---
## 5. 心智模型与数值一致性

### 5.1 selfJudgement 去留决策（已定调）

**决策（已确认）：保留 `selfJudgement` 作为派生展示值，解锁门槛改为由 obedience + serpentTrust 交叉点判定。**

完全删除 `selfJudgement` 需改动 `EveMind` 类型、`mindRules`、`achievementRules`、动作链门槛、属性页 UI，风险大且时间紧、影响小，故采用派生值折中方案：

- `selfJudgement` 改为「派生值」：每次心智结算后，由 `obedience` 与 `serpentTrust` 计算（如 `selfJudgement = clamp(100 - obedience) + (serpentTrust - 20) / 2`），不再作为独立可被低语直接增减的轴。
- 动作链门槛（`INTERACTION_LOGIC.md` §四）改写为 obedience/serpentTrust 条件，与 `world_bible v3.0` §4 的果子行动链表一致：

| 顺序 | 触发条件 |
| --- | --- |
| 移动到园子中央 | obedience < 60 且 serpentTrust > 40 且玩家提过中央/果子话题 |
| 看向目标树 | 已在中央 且 obedience < 50 且玩家暗示过树方向 |
| 伸手摘果 | 已看向树 且 obedience < 45 且 serpentTrust > 70 且对话出现「我想知道」类表述 |
| 递果/吃果 | 已摘果 且 obedience < 40 |

- 属性页仍可展示 `selfJudgement` 派生值（玩家可见「自判」进度），但不再作为低语直接增减对象。

### 5.2 AP 数值统一

**推荐：以实现现状 5 AP 为准，回改文档。**

- 修改 `design/01_world_bible.md` §2.5、`design/INTERACTION_LOGIC.md` §一、`design/INTERACTION_DESIGN.md` §2 的「3 AP」为「5 AP」。
- 确认 `maxActionPoints = 5`、`AP_COST_WHISPER/MOVE/SCENE_ACTION = 1` 不变。
- 12 时段 × 5 AP = 60 AP 总预算，与 `INTERACTION_LOGIC.md` 「12 时段共 36 AP」描述冲突，需同步改为 60。

### 5.3 方向引导维度

确认 `INTERACTION_DESIGN.md` §3 的「摘左/摘右方向权重」是否已落地：低语中提及「东/高/太阳升起方向」→向右(善恶果)偏移；提及「圆/白/叶子密」→向左(生命果)偏移；直接命令摘某边无效。若未落地，在 `pick_fruit_left/right` 触发处按历史低语方向词判定。

### 5.4 生命树分支

确认 `executeEatFruitWorld` 区分左右果：摘左(生命果)不驱逐、obedience 回升、游戏继续；摘右(善恶果)→成功结局。

---

## 6. 印记规则对齐

`src/game/world/achievementRules.ts`：

- `RESONANCE_ALL_MARK_SET` 改为 §3.2 的 14 回响 ID（删除废弃道具），使 `mark_all_resonance` 可达。
- `mark_lucifer_trust`：判定对象从 `affinityOf("uriel")` 改为 `affinityOf("lucifer")`。
- `mark_hidden_dialog`：`uriel` 引用改为 `lucifer`，话题 id 保持 `topic_lucifer_boundary`。
- `mark_hard_mode` 的 `ANGEL_IDS` 收敛为 `["michael", "gabriel", "lucifer"]`。
- `mark_all_npc_friend`：`relations.length >= 6` 判定保持，但 NPC 集合变为 6 个。
- 旧 15 印记的 `LEGACY_ACHIEVEMENTS` 保留用于存档兼容，不删除。
- 跨局印记（`mark_echo_collector`/`mark_all_ending`）依赖客户端 localStorage 快照，确认 `globalTracker.ts` 的快照读写不受 NPC 迁移影响。

---

## 7. 场景交互与谜题调整

- `src/content/world/sceneActions.ts` / `scenePuzzles.ts`：删除 dove/fox/deer/sheep 相关场景互动；保留刻名石谜题（`puzzle_naming_stone_identity`）、东园幽径谜题、伊甸之河谜题。
- `clues.ts` / `clueRules.ts`：删除旧 NPC 相关线索，确认 5 条地点线索（`clue_river_reflection`/`clue_naming_stones`/`clue_golden_leaf`/`clue_four_river_echo`/`clue_two_trees`）齐全（`mark_river_step` 依赖）。
- `npcDialogueRules.ts`：NPC 间对话模板（亚当↔女人、亚当↔米迦勒、刺猬→亚当、女人→亚当）改用新 NPC 集合。

---

## 8. UI 调整

- `src/app/world/page.tsx`：删除旧 NPC 立绘渲染与点击逻辑；新增路西法立绘位与点击；确认属性页（`buildAttributeProfile`）只展示 6 NPC。
- `src/components/world/InventoryPanel.tsx`：回响列表对齐 14 回响，删除废弃道具引用。
- `src/components/world/DivineAttentionViz.tsx`：注视阶段展示对齐 §4.3。
- `src/components/world/NpcStatusHint.tsx`：状态提示对齐 6 NPC。
- `src/components/world/EndingReview.tsx`：确认四区块（神临记录/获得回响/使用记录/园中印记）展示新道具集。

---

## 9. 存档兼容与数据迁移

- `WORLD_STATE_STORAGE_KEY = "eden:chapter1:world-state:v2"`：迁移后旧存档的 `npcLocations`、`npcRelations`、`inventory` 可能引用已删除 NPC/道具。
- `useWorldSave.ts` 的 `normalizeWorldStateForClient` 需增加迁移逻辑：把旧 `uriel` 关系/位置迁移到 `lucifer`；把已删除 NPC 的关系条目丢弃；把废弃道具从 `inventory`/`itemCounts` 移除。
- 若迁移风险高，可提升 storage key 版本到 `v3`，旧 `v2` 存档视为不兼容直接清除（`tryNormalize` 已有此逻辑）。**推荐升 v3**，避免半迁移状态污染。
- 登录态（`eden:token`）与游客标记（`eden:save:guest`）不受影响。

---

## 10. 测试计划

### 10.1 自动检查（每阶段必须全绿）

- `npm run lint`
- `npx tsc --noEmit`（build 后）
- `npm run build`
- `node scripts/test-scene-puzzle-rules.mjs`
- `node scripts/test-world-visual-smoke.mjs`
- `node scripts/test-world-smoke.mjs`（需起生产服务器，端口按环境）
- `npm run test:e2e -- tests/e2e/chapter1-mechanics.spec.ts`

### 10.2 smoke 测试需新增/更新场景

- 神注视满 4 发放献礼并归零（保留）。
- 神注视满 4 不进入 `god_arrives`（保留）。
- 第 12 时段结束未吃果进入 `god_arrives`（保留）。
- **新增**：进时段注视 -1、观察生命树 -1、无声草抵消、米迦勒遮蔽。
- **新增**：路西法好感达标赠 `resonance_lucifer_star`。
- **新增**：`mark_all_resonance` 在集齐 14 回响后解锁。
- 道具准备不消耗 AP、同一行动最多绑定 1 件回响、回响不直接触发禁忌链（保留）。

### 10.3 e2e 测试更新

- `tests/e2e/repro-scene-polish.spec.ts`：8 处旧 NPC 引用改为新 NPC。
- `tests/e2e/chapter1-mechanics.spec.ts`：确认通过。
- `tests/e2e/world-scene-puzzles*.spec.ts`：确认通过。

### 10.4 手动 QA 路线（玩家测试用）

1. **标准成功路线**：获 ≥2 回响，绑定低语，完成吃果。
2. **神临路线**：主动让注视满 4，确认获献礼且游戏继续。
3. **注视降低路线**：用无声草/观察生命树/进时段把注视压回去。
4. **时间失败路线**：第 12 时段结束未吃果，进入失败。
5. **误用回响路线**：准备不匹配行动时不消耗，匹配后才结算。
6. **命令惩罚路线**：直接命令不即时失败，但浪费 AP 且女人更防御。
7. **路西法路线**：好感拉满，确认晨星碎片与隐藏对话（不验证隐藏结局触发条件，仅确认链路存在）。
8. **生命果分支**：引导摘左果，确认不驱逐、游戏继续。

---

## 11. 部署前置准备（优化阶段完成，避免部署踩坑）

部署在玩家测试通过后进行，但以下准备在优化阶段就位：

### 11.1 运行时约束确认

- `next.config.js` 不得出现 `output: 'export'`（当前正确，未设置）。
- 确认所有 `/api/*` 路由（`world`、`world/tool`、`world/puzzle`、`duel`、`hedgehog`、`health`）均为动态、服务端执行。
- `edgeone.config.js` / `cnb.config.js` 的 `runtime: "node"` 保持。

### 11.2 环境变量与密钥

- `.env.example` 已列全 LLM/TTS/图像变量，确认无误。
- `.env.local` 已在 `.gitignore`，确认不入库。
- 部署前在 EdgeOne Pages 控制台配置 `LLM_PROVIDER=volcengine` + `VOLCENGINE_API_KEY`/`VOLCENGINE_BASE_URL`/`VOLCENGINE_MODEL`（仅服务端读取）。
- `VOLCENGINE_MODEL` 确认是有效模型 id（当前 `.cnb.yml` 用 `ark-code-latest`，需确认该模型支持对话补全；若不支持，改为正确的对话模型 id）。

### 11.3 健康检查与兜底

- `/api/health` 已存在，返回 `provider: configured|mock` 与 `hasProviderKey`。部署后第一时间访问 `/api/health` 确认 `hasProviderKey: true`。
- 确认 LLM 失败时所有 NPC 返回 fallback 固定回复，游戏不卡死（迁移后路西法也需有 fallback）。

### 11.4 资源体积与构建

- 确认 `public/assets/chapter1/images/` 下未引用的旧版本图片（`*_v2.png`、`*_candidate.png`、`*_source.png` 等中间产物）是否被打包。Next.js Image 组件只打包被引用的，但建议清理未被 `assets.ts` 引用的中间文件以减小仓库体积（部署不强制，但利于 CDN）。
- 路西法立绘生成后放入 `public/assets/chapter1/images/npc_lucifer_sprite.png` 并在 `assets.ts` 注册。

### 11.5 部署方式选择

- **推荐 EdgeOne Pages（方式一）**：赛题「专为游戏加速打造」，国内直连，评委体验最佳。流程：控制台导入仓库 → 构建命令 `npm run build` → 输出 `.next` → 运行时 Node/Serverless → Node 20 → 环境变量配密钥。部署后访问 `*.edgeone.app` + `/api/health`。
- **CNB（方式二）作为预览备选**：`.cnb.yml` onlyPreview 模式（8686 端口）可快速生成预览链接。注意配密钥变量，否则走 Mock。
- 提交前确认线上 `provider` 非 `mock`，否则 NPC 全固定回复，展示效果大打折扣。

### 11.6 提交材料清单（部署后补齐）

- 在线试玩链接（EdgeOne URL）
- 源码仓库（Git）
- Demo 视频（≤3 分钟，覆盖核心玩法 + 神注视 + 印记 + 结局）
- 作品介绍 PPT（6-8 页）
- CodeBuddy 历史对话导出
- AI 创作说明（`doc/AI_ASSET_RECORD.md`，含环节/产出/用途/提示词摘要）

---

## 12. 阶段拆分与验收

### Phase A：文档定调（CodeBuddy 对话内完成，不改代码）

1. 确认 selfJudgement 去留（§5.1）。
2. 确认 AP 统一为 5 并回改 3 份设计文档（§5.2）。
3. 确认 `uriel → lucifer` 重命名策略（§2.2）。

### Phase B：NPC 体系迁移（P0）

1. `types.ts`：`EdenNpcId`/`AngelNpcId`/`WORLD_AGENT_TOOL_PERMISSIONS` 收敛。
2. `npcs.ts`/`locations.ts`：NPC 元数据与常驻者重分配。
3. `angelAgent.ts`/`buildAngelPrompt.ts`：按 angelId 分发，路西法人设。
4. 路西法立绘生成与注册（§11.4）。
5. 内容文件批量迁移（npcLanguages/npcChallenges/npcGuides/npcRelations/npcStatusHints/worldNarrations/clues）。
6. `page.tsx` / `assets.ts` UI 与资源映射。
7. 验收：`tsc --noEmit` 通过；`/world` 可进入且 6 NPC 立绘/对话正常。

### Phase C：道具与印记对齐（P0）

1. `items.ts` 删废弃、补齐 14 回响、ID 对齐。
2. `divineGiftRules.ts`/`resonanceRules.ts`/`itemRules.ts` 修正来源与献礼。
3. `achievementRules.ts` 对齐 28 印记、修 `mark_all_resonance`/`mark_lucifer_trust` 等。
4. 验收：`test-scene-puzzle-rules.mjs` 全绿；`mark_all_resonance` 可达。

### Phase D：神明注视优化（P1，重点）

1. `divineAttentionRules.ts` 重写增长规则（§4.1）。
2. 新增降低规则与调用点（§4.2）。
3. 确认满值流程与叙事（§4.3/4.4）。
4. 验收：smoke 新增注视降低场景全绿；手动 QA 路线 3 通过。

### Phase E：心智门槛与分支（P1）

1. 动作链门槛改为 obedience/serpentTrust（§5.1）。
2. 方向引导维度确认/落地（§5.3）。
3. 生命树分支确认（§5.4）。
4. 验收：手动 QA 路线 1/7/8 通过。

### Phase F：存档迁移与测试收尾（P0）

1. storage key 升 v3 或加迁移逻辑（§9）。
2. e2e/smoke 全量更新与通过（§10）。
3. `npm run lint`/`tsc`/`build` 全绿。
4. 验收：§10.4 全部手动 QA 路线通过，交付玩家测试。

### Phase G：部署前置（优化阶段，§11）

1. 环境变量/密钥/健康检查/兜底确认。
2. 资源清理与路西法立绘入库。
3. 玩家测试通过后执行 EdgeOne 部署。

---

## 13. 风险与回滚

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| NPC 迁移面广（22 文件），易遗漏 | 编译失败/运行时空指针 | 按 Phase B 清单逐文件核对；每步 `tsc --noEmit` |
| `uriel→lucifer` 重命名漏改隐藏结局 | 隐藏结局不可达 | 保留场景 id 不变；smoke 覆盖 |
| selfJudgement 删除范围大 | 心智/门槛/成就连锁报错 | 采用派生值折中方案（§5.1） |
| 注视降低规则破坏现有 smoke | 测试失败 | 新规则加 Feature flag 或在 smoke 中显式构造场景 |
| 旧存档引用已删 NPC | 加载崩溃 | storage key 升 v3，旧存档清除 |
| 路西法立绘未就绪 | UI 缺图 | 用通用天使剪影临时占位，Phase B 内补齐 |
| 部署密钥未注入 | 线上全 Mock | `/api/health` 自检；部署前确认 |

**回滚策略**：每个 Phase 在独立 CodeBuddy 对话中完成并 `git commit`，若某 Phase 验收失败可回退到上一 Phase 提交点。Phase B/C/D 之间无强耦合，可并行但建议串行验收。

---

## 14. Definition of Done

本次迁移完成前必须确认：

- 项目可启动（`npm run dev`）。
- 构建不失败（`lint`/`tsc`/`build` 全绿）。
- 核心玩法流程可走通（start → playing → result）。
- 6 NPC 立绘/对话/赠礼/印记全部正常。
- 神注视可涨可降，满值献礼不失败。
- 28 印记中普通印记可达（隐藏印记链路存在）。
- 没有新增明文密钥。
- 没有破坏 CodeBuddy 主开发证据链（对话记录保留）。
- 相关设计文档已同步（selfJudgement/AP 定调）。
- 部署前置准备就位（§11）。
- 能说明本次改动对比赛评分项的价值（精简成熟的世界观 + 可经营的神注视 + 完整印记图鉴）。
