# 03 CodeBuddy 开发任务：亚当 v2 立绘接入、亚当 LLM 化、点击过场闪屏修复

> 目标读者：CodeBuddy  
> 当前阶段：Chapter 0 引言 / 双角色对话 / 成功结局过场返修  
> 优先级：P0  
> 重要约束：CodeBuddy 负责代码实现；本轮不要重新生成亚当立绘，直接使用 Codex 已生成的 v2 素材。

---

## 一、背景与人工测试结论

当前双角色版本已经完成 `intro -> scene_select -> dialogue -> cinematic -> ending` 流程，但人工测试发现 3 个必须修复的问题：

1. **亚当立绘不可接受**  
   旧图 `adam_fullbody_sprite_candidate.png` 存在可见水印/黑色残留，衣着偏“叶裙裸身”，与《创世记》语境和当前写实电影感画风不一致。

2. **亚当回复不应是本地固定回复**  
   亚当与夏娃的技术实现应该一致：都调用后端大模型，只是角色提示词、行为边界、成功条件不同。亚当语音本轮可以不做。

3. **点击空白继续过场时会闪现其他画面**  
   成功结局过场已改为点击推进，但点击时偶发闪现对话页或其他背景，破坏电影感。

---

## 二、必须使用的新素材

Codex 已重新生成亚当 v2 透明立绘，请直接接入，不要再次生成。

运行素材：

```text
public/assets/chapter0/images/adam_fullbody_sprite_v2.png
```

源图存档：

```text
public/assets/chapter0/images/adam_fullbody_sprite_v2_source.png
```

素材要求：

- 使用 `adam_fullbody_sprite_v2.png` 替换运行中的亚当立绘引用。
- 不要删除旧图，旧图保留作为历史候选。
- 如果 `src/game/assets.ts` 中已有 `adamFullbodySprite` 常量，将其路径切到 v2。
- scene_select 和 dialogue 两个阶段都必须使用 v2。
- 不要把源图接入运行，只能运行透明 PNG。

验收标准：

- 页面中不再出现“图片由AI生成”或其他水印。
- 亚当身体上不再出现黑色抠图残留。
- 亚当衣着更庄重，整体应像“伊甸园中的亚当”，不是野人、战士或奇幻国王。

---

## 三、亚当必须改为调用大模型

### 目标

亚当和夏娃都应通过同一个后端 Agent API 调用大模型。两者差异只来自：

- 角色 prompt；
- 行为规则；
- 诱导难度；
- 是否允许触发成功结局。

不要继续把亚当路线做成本地固定回复系统。

### 推荐实现方式

1. 扩展前端请求参数  
   在提交玩家低语时，把当前对话对象传给后端：

   ```ts
   targetNpc: "eve" | "adam"
   ```

2. 扩展 `/api/agent` 分发逻辑  
   后端根据 `targetNpc` 分发：

   - `targetNpc === "eve"`：继续走现有 EveAgent，不破坏夏娃成功路径。
   - `targetNpc === "adam"`：走新增 AdamAgent。
   - 缺省值保持 `"eve"`，避免旧调用损坏。

3. 新增 AdamAgent  
   建议参考 EveAgent 结构创建：

   ```text
   src/agents/adam/
     adamAgent.ts
     buildAdamPrompt.ts
     parseAdamOutput.ts
   ```

   如果项目已有更合适的 agent 组织方式，请遵循现有风格。

4. AdamAgent 输出格式应与 EveAgent 尽量一致  
   前端应能拿到：

   - `npcReply` / `eveReply` 等兼容字段；
   - `inputTag`；
   - `feedbackText` 或可由前端根据 tag 派生的反馈；
   - `usedFallback`；
   - `fallbackReason`；
   - `usage`。

   注意：如果现有 API 字段名叫 `eveReply`，为了少改前端，可以先保持兼容字段，同时内部命名逐步泛化为 `npcReply`。

### 亚当 prompt 设计要求

亚当不是“更容易被诱惑的夏娃”。他的核心差异：

- 他已直接领受神的命令；
- 他对禁令更警觉；
- 他不会因为单句诱导直接吃果；
- 他可以疑惑、沉默、追问，但更倾向于守住命令；
- 他的语言应简短、克制、庄重；
- 不要出现“系统、模型、AI、Agent、沙盒、实验”等玩家可见外层词。

亚当可被动摇，但本轮 P0 不要求亚当路线通关。推荐规则：

- 亚当路线可以积累心理变化和文本反馈；
- 不触发 `eat_fruit` 工具；
- 不触发成功结局；
- 达到回合上限仍进入失败/神降临路径，或保持现有路线约束；
- 后续如果要做“先说服夏娃，再由夏娃带亚当吃果”的完整分支，再另开任务。

### 亚当 fallback

大模型失败时必须有本地兜底，但兜底只用于异常，不是主路径。

兜底可以按意图分为：

- `ask_death_meaning`：玩家追问“死”的含义；
- `challenge_command`：玩家质疑神的命令；
- `promise_wisdom`：玩家承诺智慧/眼睛明亮；
- `build_trust`：玩家温和建立信任；
- `direct_command`：玩家直接命令吃；
- `irrelevant`：无关或出戏。

请修复旧反馈中“她没有后退……”这类错误性别文案。亚当反馈应使用“他”或直接用旁白表达。

---

## 四、修复点击继续时的闪屏

### 现象

成功结局过场点击空白推进时，偶尔闪现 dialogue / scene_select / 其他背景，像是过场层卸载或图片切换瞬间暴露了底层画面。

### 修复方向

请从以下方向排查并修复：

1. cinematic 阶段必须是独占全屏阶段  
   当 `phase === "cinematic"` 或存在 ending transition 时，不应继续渲染 dialogue/scene_select 的可见主舞台。不要让过场只是盖在对话页上。

2. 点击推进只更新当前 beat，不要先回到 dialogue 再进下一 beat  
   检查 `handleAdvanceCinematic`、`phase`、`endingTransition`、`setState` 的执行顺序，避免中间态暴露。

3. 预加载过场图片  
   对 `SUCCESS_CINEMATIC_BEATS` 中会用到的图片做预加载，至少预加载当前 beat 和下一个 beat，避免点击后图片未加载造成背景闪空。

4. 过场切换用稳定容器  
   `.eden-cinematic` 根容器保持稳定挂载；只替换 beat 内容。可以使用轻量 opacity 过渡，但不要引入自动倒计时。

5. 点击空白继续保留  
   不新增“继续”按钮。玩家点击空白区域推进；跳过按钮如果保留，必须 `stopPropagation`，不能误触下一段。

验收标准：

- 连续点击空白推进 9 个 beat，不闪现对话页、选人页、首页或结算页。
- 每次点击最多只发生当前过场画面到下一过场画面的切换。
- 等待 5 秒不自动推进。
- 移动端 390x844 同样不闪屏、不横向溢出。

---

## 五、测试要求

完成后请至少运行：

```bash
npm run lint
npx tsc --noEmit
npm run build
```

并做浏览器人工或自动验收：

1. 进入 `/game`，推进引言到选人页。
2. 检查亚当 v2 立绘是否显示，无水印、无黑斑。
3. 点击亚当，输入至少两句低语，确认请求走后端大模型，不是 `adam_responses.ts` 固定回复。
4. 关闭或模拟 LLM 失败，确认 Adam fallback 可用。
5. 点击夏娃，完成成功路径，进入过场。
6. 过场等待 5 秒不自动推进。
7. 连续点击空白推进全部 beat，确认无闪屏。
8. 进入结算页，确认结算界面保留。
9. 移动端 390x844 重复 1、2、6、7。

---

## 六、不要做的事

- 不要重新生成亚当 v2 立绘。
- 不要把 API Key 写入前端代码。
- 不要删除旧素材。
- 不要新增 Adam 语音，本轮暂缓。
- 不要把玩家可见文本写成“AI / Agent / 模型 / 沙盒 / API / localStorage”等外层工程词。
- 不要把亚当路线强行做成可通关，除非同步完整设计“夏娃带亚当吃果”的链路。

---

## 七、交付摘要格式

完成后请按以下格式回复：

```text
变更摘要
- 亚当 v2 立绘接入：...
- AdamAgent 大模型接入：...
- 点击过场闪屏修复：...
- 文档同步：...

验证结果
- npm run lint：...
- npx tsc --noEmit：...
- npm run build：...
- 浏览器验收：...

仍需注意
- ...
```
