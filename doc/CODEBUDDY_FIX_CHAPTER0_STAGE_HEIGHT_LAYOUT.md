# CodeBuddy 二次返修：Chapter 0 对话舞台高度与夏娃立绘定位

> 优先级：P0  
> 范围：`/game` 对话阶段 CSS 布局  
> 问题：第一次返修只改了夏娃立绘尺寸和 bottom，但没有解决 `.eden-stage` 高度为 0 的根因。

## 1. 请先读取

- `doc/CODEBUDDY_FIX_CHAPTER0_SCENE_SPRITE_LAYOUT.md`
- `src/app/game/page.tsx`
- `src/app/globals.css`
- `docs/PROJECT_CONTEXT.md`

## 2. Codex 二次复验结果

开发端报告称已修复，但浏览器复验仍失败。

1366x768 桌面端测量：

```text
.eden-stage bounding box:
x = 153
y = 316
width = 720
height = 0

.eden-eve-stage-sprite bounding box:
x = 416.84
y = -236.95
width = 348.16
height = 522.23
```

结论：

- `.eden-stage` 高度仍为 0。
- `.eden-eve-stage-sprite` 使用 `position: absolute` 且 `bottom` 相对 `.eden-stage` 定位。
- 因为舞台容器高度为 0，所以立绘继续被定位到视口上方。
- 桌面截图中仍然几乎看不到夏娃。
- 移动端比之前好，但人物仍偏悬浮，不像站在地面/草叶后。

## 3. 修复目标

这次不要只调 `.eden-eve-stage-sprite`，必须先修 `.eden-dialogue-layout` 和 `.eden-stage` 的实际高度。

验收目标：

- 桌面端 `.eden-stage.height` 必须大于 400px。
- 桌面端 `.eden-eve-stage-sprite.y` 必须大于等于 0。
- 夏娃头部不能被裁掉。
- 夏娃底部应贴近场景地面/草叶。
- 右侧“低语余痕”面板不遮挡夏娃。
- 移动端夏娃不能悬浮在顶部。

## 4. 建议修法

### 4.1 修复对话主布局高度

请给 `.eden-dialogue-layout` 明确可用高度和拉伸行为。

建议：

```css
.eden-dialogue-layout {
  position: relative;
  z-index: 5;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  display: flex;
  align-items: stretch;
  overflow: hidden;
}
```

### 4.2 修复舞台容器高度

桌面端 `.eden-stage` 必须有实际高度。

建议：

```css
.eden-stage {
  flex: 1 1 auto;
  position: relative;
  min-width: 0;
  min-height: clamp(420px, calc(100vh - 150px), 720px);
  height: 100%;
  overflow: hidden;
}
```

如果 `height: 100%` 仍无效，可以直接让 `.eden-stage` 使用：

```css
height: calc(100vh - 128px);
```

其中 128px 是 header + input footer 的近似高度。目标不是精确数学，而是确保舞台不是 0 高度。

### 4.3 再调夏娃立绘

在舞台高度修好后，再保留或微调：

```css
.eden-eve-stage-sprite {
  position: absolute;
  right: clamp(7%, 10vw, 15%);
  bottom: clamp(18px, 4vh, 46px);
  height: clamp(430px, 68vh, 640px);
  width: auto;
  max-width: min(34vw, 360px);
  object-fit: contain;
  object-position: bottom center;
  z-index: 4;
}
```

如果夏娃仍偏大，优先降低高度到：

```css
height: clamp(380px, 60vh, 560px);
```

不要让 `spriteBox.y` 小于 0。

### 4.4 移动端

移动端 `.eden-stage` 也必须有稳定高度：

```css
@media (max-width: 640px) {
  .eden-stage {
    min-height: 38vh;
    height: 40vh;
    max-height: 44vh;
  }

  .eden-eve-stage-sprite {
    right: 4%;
    bottom: 8px;
    height: min(34vh, 280px);
    max-width: 42vw;
    object-fit: contain;
  }
}
```

移动端允许显示半身/膝上，但必须从底部自然裁切，不要悬浮。

## 5. 必须自行做浏览器验收

这次不能只报 lint/tsc/build。

请在浏览器中检查：

### 桌面端 1366x768

必须满足：

- 夏娃可见。
- 夏娃头部不被裁掉。
- 夏娃底部靠近场景地面/草叶。
- 主画面可见背景、夏娃、善恶果。
- 右侧面板不遮挡人物。

建议在浏览器控制台或自动化里确认：

```js
document.querySelector(".eden-stage").getBoundingClientRect().height > 400
document.querySelector(".eden-eve-stage-sprite").getBoundingClientRect().y >= 0
```

### 移动端 390x844

必须满足：

- 夏娃不悬浮在顶部。
- 输入框可见。
- 无横向溢出。
- 右侧栏变为下方/折叠区域后仍可读。

## 6. 命令验收

必须运行：

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## 7. 回复格式

```text
变更摘要
1. ...

根因修复
- .eden-stage 高度：...
- .eden-eve-stage-sprite 定位：...

浏览器验收
- 桌面 1366x768：stage height = ..., sprite y = ..., 视觉是否通过
- 移动 390x844：是否悬浮、是否溢出、输入框是否可见

验证结果
- npm run lint ✔/✘
- npx tsc --noEmit ✔/✘
- npm run build ✔/✘

仍需注意
- ...
```
