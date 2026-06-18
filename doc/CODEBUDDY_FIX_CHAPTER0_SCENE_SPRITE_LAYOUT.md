# CodeBuddy 修复提示词：Chapter 0 夏娃立绘场景位置返修

> 优先级：P0  
> 范围：`/game` 对话阶段视觉布局  
> 问题：夏娃全身立绘已接入，但没有自然放进场景。桌面端几乎不可见，移动端悬浮在画面上方。

## 1. 请先读取

- `design/chapters/chapter0_dialogue_scene_layout.md`
- `design/chapters/chapter0_narrative_visual_polish.md`
- `doc/CODEBUDDY_TASK_CHAPTER0_CINEMATIC_SCENE_POLISH.md`
- `doc/AI_ASSET_RECORD.md`
- `src/app/game/page.tsx`
- `src/app/globals.css`
- `docs/PROJECT_CONTEXT.md`

## 2. Codex 复验发现

自动与截图验收结果：

- `npm run lint` 通过
- `npx tsc --noEmit` 通过
- `npm run build` 通过
- 引言四段 Beat 通过
- 成功/失败流程通过
- 资源加载通过，无 404
- 玩家可见文本未出现外层直白词

但视觉布局失败：

1. 桌面端 1366x768：`.eden-eve-stage-sprite` bounding box 为 `y = -267.67`，人物大部分被裁到视口外，截图中几乎看不到夏娃。
2. 移动端 390x844：人物显示在画面上方，像漂浮物，不像站在伊甸园中。
3. 当前实现不满足“夏娃以全身/大半身自然出现在伊甸园背景中”的验收标准。

## 3. 修复目标

让夏娃立绘自然站在场景中：

- 桌面端必须能看到夏娃完整上半身和大部分身体，最好接近全身。
- 人物底部应贴近场景地面/草叶前景，不要悬浮。
- 人物不能被右侧面板遮挡。
- 人物不应被 stage 顶部裁掉。
- 移动端人物应作为场景中的角色出现，不能悬浮在顶部。

## 4. 建议布局

### 桌面端

推荐把夏娃放在主场景右侧、右侧面板左边：

```css
.eden-stage {
  position: relative;
  overflow: hidden;
}

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

关键点：

- 不要让 `bottom` 为 0 时被输入栏或 stage 裁切。
- 不要使用会导致 `top < 0` 的高度。
- `height` 不要超过当前 stage 可视高度。

### 移动端

移动端不要强行显示完整全身。建议显示半身/膝上更自然：

```css
@media (max-width: 768px) {
  .eden-stage {
    min-height: 38vh;
    max-height: 44vh;
  }

  .eden-eve-stage-sprite {
    right: 4%;
    bottom: 8px;
    height: min(36vh, 300px);
    max-width: 42vw;
    object-fit: contain;
  }
}
```

如果全身太小，允许裁成自然半身，但必须从底部/膝部裁，不要从头顶或上方裁，也不要漂浮。

## 5. 验收方式

请完成后用浏览器确认：

桌面端 1366x768：

- 夏娃立绘可见。
- 头部不被裁掉。
- 脚部或下摆靠近草叶/地面。
- 右侧“低语余痕”面板不遮挡人物。
- 主画面能看到背景、夏娃、善恶果。

移动端 390x844：

- 夏娃不悬浮在顶部。
- 输入框可见。
- 无横向溢出。
- 面板与人物不重叠到不可读。

必须运行：

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## 6. 回复格式

```text
变更摘要
1. ...

视觉修复
- 桌面端：...
- 移动端：...

验证结果
- npm run lint ✔/✘
- npx tsc --noEmit ✔/✘
- npm run build ✔/✘
- 桌面端截图检查：...
- 移动端截图检查：...

仍需注意
- ...
```
