# CodeBuddy 返修任务：第一章天使 NPC 独立素材接入

**状态：进行中（素材已生成，代码已接入，待视觉验收与优化）**

## 已完成的工作

- [x] 生成 5 张天使独立透明立绘（RGBA PNG，1023×1537）
  - `npc_gabriel_sprite.png` — 白金长袍，传达姿态
  - `npc_raphael_sprite.png` — 绿金长袍，持植物杖
  - `npc_uriel_sprite.png` — 银金光照，持光球
  - `npc_michael_sprite.png` — 深蓝披风，持权杖
  - `npc_cherubim_sprite.png` — 非人化多翼
- [x] `src/game/assets.ts` 新增 5 个 sprite 常量
- [x] `src/app/world/page.tsx` 5 位天使渲染块改用独立立绘
- [x] `src/app/globals.css` 移除 CSS 滤镜，补上 `cherubim` 定位类
- [x] 修正 `Image` 组件宽高（改为实际尺寸 1023×1537）
- [x] `scripts/test-world-visual-smoke.mjs` 新增 19 个断言
- [x] 回归验证通过：lint ✅ / tsc ✅ / build ✅ / smoke 164/164 ✅

## 本轮已优化（2026-06-22 第3轮）

- [x] 夏娃立绘添加 `opacity: 0.88`（原无设置，默认 1.0 偏亮）
- [x] 加百列加入 `伊甸之河` 夜间 NPC（传达天使应昼夜都在）
- [x] 全 NPC 透明度审计完成，数值统一合理

## 本轮已优化（2026-06-22 第2轮）

- [x] 天使未对话状态透明度：opacity 0.5 → 0.72，饱和度 0.8 → 0.85，亮度 0.9 → 0.95
- [x] 乌列尔从 `园中树林` 移至 `伊甸之河`（dayNpcs 和 nightNpcs 均加入）
- [x] `伊甸之河` 白天 NPC：gabriel + raphael + uriel（三个天使）
- [x] `园中树林` 夜述移除「乌列尔的远影」描述

## 本轮已优化（2026-06-22 第1轮）

- [x] 补上 `eden-stage-angel--cherubim` CSS 定位类（原缺失，导致基路伯立绘无法定位）
- [x] 修正 5 位天使 `Image` 组件宽高（1254×1254 → 实际 1023×1537），修复 Next.js srcset 不匹配
- [x] 降低 `.eden-angel-stage-sprite` 滤镜强度：饱和度 0.55→0.8，亮度 0.82→0.9，透明度 0.45→0.5

## 仍待优化

1. **视觉验收**：在浏览器中实际查看 5 位天使立绘是否明显不同，基路伯是否足够「非人化」
2. **图片文件体积**：5 张图各约 1.3-2.1MB（PNG 未压缩），建议用 squoosh 或 ImageOptim 压缩，或转 WebP
3. **天使选中状态微调**：当前选中时 `saturate(0.75) brightness(1.02)`，可考虑按天使 individuality 做极轻微色相偏移

## 背景

用户反馈：所有天使都是同一个形象，素材接入有问题。Codex 复验确认该反馈成立。

当前测试结果：

- `npm run lint` PASS
- `npm run build` PASS
- `npx tsc --noEmit` PASS
- `node scripts/test-world-smoke.mjs http://localhost:3027` 41/41 PASS
- `node scripts/test-world-visual-smoke.mjs` 143/143 PASS

但以上自动测试仍不能证明天使素材接入正确。专项源码核查结果：

```text
watching_angel: CHAPTER1_IMAGES.watchingAngelSprite
cherubim: CHAPTER1_IMAGES.watchingAngelSprite
gabriel: CHAPTER1_IMAGES.watchingAngelSprite
raphael: CHAPTER1_IMAGES.watchingAngelSprite
uriel: CHAPTER1_IMAGES.watchingAngelSprite
michael: CHAPTER1_IMAGES.watchingAngelSprite
```

也就是说，当前只是给同一张 `npc_watching_angel_builtin_candidate.png` 套不同 CSS 滤镜。滤镜只能改色，不能体现加百列、拉斐尔、乌列尔、米迦勒、基路伯在形象、姿态、器物和叙事职能上的差异。

## 现有可用素材

已有概念组图：

- `public/assets/chapter1/images/npc_angel_concept_sheet_source.png`
- `public/assets/chapter1/images/npc_angel_concept_sheet_1920.webp`

这张图是五位天使的视觉参考，不是可直接运行的单角色透明立绘。请不要继续把它当作“已接入完成”的证据。

Codex 已补齐五张单角色透明运行立绘：

```text
public/assets/chapter1/images/npc_gabriel_sprite.png
public/assets/chapter1/images/npc_raphael_sprite.png
public/assets/chapter1/images/npc_uriel_sprite.png
public/assets/chapter1/images/npc_michael_sprite.png
public/assets/chapter1/images/npc_cherubim_sprite.png
```

对应的生成源图保留在：

```text
public/assets/chapter1/images/npc_gabriel_sprite_generated_source.png
public/assets/chapter1/images/npc_raphael_sprite_generated_source.png
public/assets/chapter1/images/npc_uriel_sprite_generated_source.png
public/assets/chapter1/images/npc_michael_sprite_generated_source.png
public/assets/chapter1/images/npc_cherubim_sprite_generated_source.png
```

人工核对接触表：

```text
public/assets/chapter1/images/npc_angel_sprites_generated_contact_sheet.png
```

## 必修目标

### 1. 使用 Codex 已准备的 5 个独立运行立绘文件

已新增单角色透明 PNG：

```text
public/assets/chapter1/images/npc_gabriel_sprite.png
public/assets/chapter1/images/npc_raphael_sprite.png
public/assets/chapter1/images/npc_uriel_sprite.png
public/assets/chapter1/images/npc_michael_sprite.png
public/assets/chapter1/images/npc_cherubim_sprite.png
```

要求：

- 每张图为单独角色，不是整张概念组图。
- 背景透明，不带大块矩形底。
- 角色轮廓、服饰、持物、色彩必须明显不同。
- 不要把同一张守望天使图改色后另存为 5 张。
- 不需要 CodeBuddy 再生成图；本轮只做工程接入、常量引用和测试断言。

角色识别建议：

| NPC | 视觉要点 |
| --- | --- |
| 加百列 | 白金长袍，传达姿态，水边/声音意象，可空手伸掌或持传信枝杖 |
| 拉斐尔 | 绿金长袍，安抚/医治感，柔和姿态，可持植物杖 |
| 乌列尔 | 银金光照，手持光球或光杖，轮廓明亮 |
| 米迦勒 | 深蓝/暗金披风，后果与守卫感，姿态更严肃，可持权杖 |
| 基路伯 | 非人化、遮面或多翼感，边界守卫，不能和普通天使同脸同身形 |

### 2. 更新素材常量

文件：`src/game/assets.ts`

新增：

```ts
gabrielSprite: "/assets/chapter1/images/npc_gabriel_sprite.png",
raphaelSprite: "/assets/chapter1/images/npc_raphael_sprite.png",
urielSprite: "/assets/chapter1/images/npc_uriel_sprite.png",
michaelSprite: "/assets/chapter1/images/npc_michael_sprite.png",
cherubimSprite: "/assets/chapter1/images/npc_cherubim_sprite.png",
```

保留：

```ts
watchingAngelSprite
```

它只用于原有 `watching_angel`，不要再给五个新增天使复用。

### 3. 更新 `/world` 场景舞台引用

文件：`src/app/world/page.tsx`

替换：

- `cherubim` 使用 `CHAPTER1_IMAGES.cherubimSprite`
- `gabriel` 使用 `CHAPTER1_IMAGES.gabrielSprite`
- `raphael` 使用 `CHAPTER1_IMAGES.raphaelSprite`
- `uriel` 使用 `CHAPTER1_IMAGES.urielSprite`
- `michael` 使用 `CHAPTER1_IMAGES.michaelSprite`
- `watching_angel` 才使用 `CHAPTER1_IMAGES.watchingAngelSprite`

CSS 可以继续用位置 class 调整站位，但不能用同图滤镜冒充不同角色。

### 4. 修正 visual smoke，覆盖素材唯一性

文件：`scripts/test-world-visual-smoke.mjs`

新增强断言：

- `assets.ts` 包含 5 个新增 sprite 常量。
- 5 个 sprite 文件实际存在。
- `page.tsx` 对应 NPC 引用的是自己的 sprite 常量。
- `gabriel`、`raphael`、`uriel`、`michael`、`cherubim` 的渲染块不得引用 `CHAPTER1_IMAGES.watchingAngelSprite`。
- 5 个 sprite 路径必须互不相同。

建议添加一个小工具函数，用字符串范围检查每个 NPC 渲染块：

```js
function blockAfter(content, marker, length = 900) {
  const index = content.indexOf(marker);
  return index >= 0 ? content.slice(index, index + length) : "";
}
```

验收断言示例：

```js
const gabrielBlock = blockAfter(worldPage, 'currentNpcs.includes("gabriel")');
check("gabriel 使用独立立绘", gabrielBlock.includes("CHAPTER1_IMAGES.gabrielSprite"));
check("gabriel 不复用守望天使立绘", !gabrielBlock.includes("CHAPTER1_IMAGES.watchingAngelSprite"));
```

### 5. 更新素材记录

文件：

- `doc/AI_ASSET_RECORD.md`
- `doc/第一章/素材需求文档.md`

补充 5 个单角色运行素材的来源、用途、接入状态。明确 `npc_angel_concept_sheet_source.png` 是概念组图，不是最终运行立绘。

## 回归命令

```bash
npm run lint
npm run build
npx tsc --noEmit
node scripts/test-world-smoke.mjs http://localhost:<port>
node scripts/test-world-visual-smoke.mjs
```

## 验收标准

- 自动测试全部通过。
- 源码检查能证明五位新增天使不再复用 `watchingAngelSprite`。
- 玩家进入对应地点时，五位天使在轮廓、色彩、服饰或持物上明显不同。
- 地图 NPC 列表与场景舞台显示一致。
