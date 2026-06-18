# CodeBuddy 任务单：Chapter 0 引言与第二伊甸园视觉接入

## 任务背景

Codex 已完成 Chapter 0 引言文案更新与第二伊甸园候选素材生成。

本任务由 CodeBuddy 执行开发接入，原因：

- 涉及页面结构、样式、素材引用和浏览器表现。
- 需要保留 CodeBuddy 作为核心开发工具的证据链。
- Codex 后续负责测试验收与风险审查。

## 已完成输入

### 设计文档

- `design/02_second_eden_narrative.md`
- `design/chapters/chapter0_intro_design.md`
- `design/chapters/chapter0_first_fall.md`

### 已更新文案

- `src/content/chapters/chapter0_first_fall.ts`

### 候选视觉素材

已新增到 `public/assets/chapter0/images/`：

| 文件 | 用途建议 |
|---|---|
| `second_eden_background_candidate.png` | Chapter 0 引言/对话背景候选。 |
| `second_eden_forbidden_fruit_candidate.png` | 善恶果候选，适合进度高时特写或替换。 |
| `second_eden_eve_portrait_candidate.png` | 夏娃肖像候选。 |

这些素材是候选，不要直接覆盖旧素材。优先通过常量切换或新增常量引用。

## 开发目标

让 Chapter 0 从“经典伊甸园”升级为“第二伊甸园”的第一眼体验：

- 表层仍是神话寓言。
- 外层真相只做隐藏美术和氛围暗示。
- 不在玩家可见文本中出现研究员、智能体、模拟、实验、系统等词。
- 不改变核心状态机、结局规则和 toolCall 规则。

## 推荐实现步骤

### 1. 素材常量

在 `src/game/assets.ts` 中新增候选素材常量，例如：

```ts
secondEdenBackground: "/assets/chapter0/images/second_eden_background_candidate.png",
secondEdenForbiddenFruit: "/assets/chapter0/images/second_eden_forbidden_fruit_candidate.png",
secondEdenEvePortrait: "/assets/chapter0/images/second_eden_eve_portrait_candidate.png",
```

建议先只在引言阶段使用 `secondEdenBackground`，避免一次性替换全部游戏体验。

### 2. 引言背景

在 `/game` 的 intro 阶段优先使用 `secondEdenBackground`。

对话阶段是否替换背景，可根据视觉一致性决定：

- 如果新背景与现有 UI 兼容，可同样用于 dialogue。
- 如果文字可读性下降，只用于 intro。

### 3. 隐藏异常视觉

给 intro 阶段增加轻量视觉暗示：

- 背景上加一层极淡的银色纹路/边界光。
- 不要做明显代码雨。
- 不要做科幻控制台。
- 不要显示任何现代技术文字。

可用 CSS class：

```css
.eden-second-eden-sheen
.eden-boundary-glimmer
.eden-fruit-pulse
```

实现时保持低透明度和慢动画，避免喧宾夺主。

### 4. 善恶果候选

可将 `second_eden_forbidden_fruit_candidate.png` 用于：

- `temptationProgress >= 2` 时的善恶果锚点；
- 或成功前后的高亮视觉；
- 或后续结局页候选。

如果直接替换当前 44px 锚点后细节不可读，不要强行替换。可以保留当前 `forbidden_fruit.png`，把候选图作为大图/特写后续使用。

### 5. 夏娃肖像候选

`second_eden_eve_portrait_candidate.png` 的写实度较高。接入前检查：

- 120px 圆形裁切后是否仍好看。
- 移动端是否显得过于真实、和现有风格冲突。
- 是否影响神话寓言感。

若冲突，暂不替换，只保留为候选素材。

## 验收标准

执行完成后必须满足：

- `npm run lint` 通过。
- `npx tsc --noEmit` 通过。
- `npm run build` 通过。
- `/game` intro 阶段可以正常显示新引言文案。
- 移动端 390x844 下文字不遮挡按钮。
- 玩家可见文本不出现以下词：研究员、智能体、模型、程序、虚拟世界、模拟、实验、系统、测试、玩家样本。
- 成功路径仍可进入 `eve_eats_fruit`。
- 无关输入 3 次仍可进入 `god_arrives`。
- `.env.local` 不被提交。

## 推荐提示词给 CodeBuddy

```text
请根据 `design/chapters/chapter0_intro_design.md` 和 `design/02_second_eden_narrative.md`，接入 Chapter 0 的第二伊甸园引言视觉升级。

约束：
1. 不修改核心状态机、toolCall、结局规则和 API 协议。
2. 不在玩家可见文本中出现研究员、智能体、模型、程序、虚拟世界、模拟、实验、系统、测试、玩家样本等词。
3. 优先只在 `/game` intro 阶段使用 `second_eden_background_candidate.png`。
4. 候选善恶果和夏娃肖像先新增常量，是否替换由视觉效果决定，不能破坏现有布局。
5. 添加轻量“第二伊甸园”隐藏异常视觉，例如极淡银色边界光、低透明度纹路、果实轻微脉冲，但不要做明显赛博 UI。
6. 完成后运行 `npm run lint`、`npx tsc --noEmit`、`npm run build`。
7. 更新相关设计/素材记录，保留 CodeBuddy 开发对话记录。

目标：
让 Chapter 0 的第一眼体验从纯伊甸园升级为“神话伊甸园中隐约有被复现/被观察的痕迹”，但不直接揭示外层真相。
```

## Codex 后续验收点

CodeBuddy 完成后，让 Codex 验收：

1. 页面可启动和构建。
2. start -> playing -> result 流程未回归。
3. 新素材加载成功。
4. 移动端布局不溢出。
5. 玩家可见文本无外层技术词泄漏。
6. 第二伊甸园暗示存在但不抢戏。
