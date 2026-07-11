# 第一章冒险模式 UI/UX 优化任务（CodeBuddy 执行版）
## 元信息
| 项 | 说明 |
|---|---|
| 任务版本 | v1.0 |
| 依赖前置 | 基于当前 main 分支 v1.1 版本（commit `db61503`）开发，无依赖冲突 |
| 影响范围 | 仅改动第一章 world 页相关代码，不影响其他模式、不破坏旧存档兼容 |
| 执行要求 | 按模块顺序开发，每模块完成后单独验证，最后统一跑门禁 |

---

## 整体优化目标
解决5个核心体验问题：
1. 排版太满重叠 → 删除冗余提示，改为弹窗式触发
2. 刻名石交互不合理 → 开放式问题+UI优化
3. 场景中央黑色阴影块 → 修复残留旧样式
4. 词元消耗统计异常 → 重置清零+多维度显示
5. 神明注视UI不清晰 → 简化显示+阈值递增逻辑

---

## 模块1：排版与提示体系优化
### 需求来源
- 删除顶部「风很温和，鸟鸣照常，园中一切如常」固定提示
- 删除「当前目标」悬浮框
- 位置提示改为弹窗触发：首次进入游戏显示全局开场弹窗，进入新场景显示对应场景弹窗，点击空白/×关闭
- 无需保留「当前目标」相关内容

### 改动文件
| 文件路径 | 改动类型 |
|---|---|
| `src/app/world/page.tsx` | 修改+新增 |
| `src/app/globals.css` | 新增样式 |
| `src/content/world/narrations.ts` | 删除文案 |
| `src/content/world/locations.ts` | 新增字段 |

### 具体实现步骤
#### 步骤1：删除冗余提示内容
1. 打开 `src/content/world/worldNarrations.ts`，找到 `DIVINE_ATTENTION_NARRATIONS[0]` 的值 `"风很温和，鸟鸣照常，园中一切如常。"`，改为空字符串 `""`
2. 打开 `src/app/world/page.tsx`，找到1810-1843行的「当前目标」组件（`<aside className="eden-current-goal">` 块），**完整删除**
3. 找到1797行附近的场景顶部「当前位置」静态文字（`<span className="eden-world-stage-kicker">当前位置</span>`），**完整删除**

#### 步骤2：新增弹窗组件（复用现有弹窗样式）
1. 在 `src/app/world/page.tsx` 的状态区新增两个状态：
   ```tsx
   // 首次全局开场弹窗
   const [showGlobalIntroModal, setShowGlobalIntroModal] = useState(() => {
     if (typeof window === "undefined") return false;
     // 只有首次进入游戏显示，刷新不再显示，新游戏重新显示
     return localStorage.getItem("eden:world:global_intro_shown") !== "1";
   });
   // 场景切换弹窗
   const [showSceneChangeModal, setShowSceneChangeModal] = useState(false);
   const [currentSceneModalData, setCurrentSceneModalData] = useState<{ title: string; content: string }>({ title: "", content: "" });
   ```
2. 新增弹窗关闭处理函数：
   ```tsx
   const handleGlobalIntroClose = useCallback(() => {
     setShowGlobalIntroModal(false);
     localStorage.setItem("eden:world:global_intro_shown", "1");
   }, []);

   const handleSceneChangeClose = useCallback(() => {
     setShowSceneChangeModal(false);
   }, []);
   ```
3. 在 `useEffect` 中监听场景切换，触发弹窗：
   ```tsx
   // 监听场景变化，触发场景弹窗
   useEffect(() => {
     if (state.phase !== "explore") return;
     const location = getLocationById(state.locationId);
     if (!location) return;
     setCurrentSceneModalData({
       title: `当前位置：${location.name}`,
       content: location.description || ""
     });
     setShowSceneChangeModal(true);
   }, [state.locationId, state.phase]);
   ```
4. 在 render 区（`{giftChoiceModal}` 之后）新增两个弹窗渲染：
   ```tsx
   {/* 首次全局开场弹窗 */}
   {showGlobalIntroModal && (
     <div className="eden-modal-overlay" onClick={handleGlobalIntroClose}>
       <div className="eden-modal eden-modal--compact" onClick={(e) => e.stopPropagation()}>
         <div className="eden-modal-header">
           <span className="eden-modal-title">第一章 · 园中诸声</span>
           <button className="eden-modal-close" onClick={handleGlobalIntroClose} aria-label="关闭">×</button>
         </div>
         <div className="eden-modal-body">
           <p className="mb-4">你是蛇，低语引导夏娃做出选择。</p>
           <p className="mb-4">观察园中角色与场景，收集能够影响夏娃的线索。</p>
           <p className="mb-4">刻名石、伊甸之河与刺猬需要你直接点击才会回应。</p>
         </div>
       </div>
     </div>
   )}

   {/* 场景切换弹窗 */}
   {showSceneChangeModal && (
     <div className="eden-modal-overlay" onClick={handleSceneChangeClose}>
       <div className="eden-modal eden-modal--compact" onClick={(e) => e.stopPropagation()}>
         <div className="eden-modal-header">
           <span className="eden-modal-title">{currentSceneModalData.title}</span>
           <button className="eden-modal-close" onClick={handleSceneChangeClose} aria-label="关闭">×</button>
         </div>
         <div className="eden-modal-body">
           <p>{currentSceneModalData.content}</p>
         </div>
       </div>
     </div>
   )}
   ```

#### 步骤3：补充场景描述字段
打开 `src/content/world/locations.ts`，为每个地点新增 `description` 字段：
```ts
// 例：
export const LOCATIONS: Record<LocationId, Location> = {
  central_meadow: {
    id: "central_meadow",
    name: "园中央",
    description: "伊甸中心的青草地，生命树与善恶树扎根于此，白日阳光洒落，夜间萤火浮动。",
    // 其他原有字段保留
  },
  naming_stone_bank: {
    id: "naming_stone_bank",
    name: "万物受名处",
    description: "亚当为飞鸟走兽命名的草甸，散落着刻有古老符号的石痕。",
  },
  four_river_source: {
    id: "four_river_source",
    name: "伊甸之河",
    description: "四道河流的源头，水流清冽，石子在水底闪着微光，偶有飞鸟掠过水面。",
  },
  east_garden_path: {
    id: "east_garden_path",
    name: "东园树影",
    description: "伊甸园东侧的林荫小路，高大的树影遮蔽阳光，守望天使在此驻守。",
  },
  adam_garden_work: {
    id: "adam_garden_work",
    name: "守园圃地",
    description: "亚当日常劳作的园圃，种植着各类蔬果，空气中飘着青草与花香。",
  },
  // 其他地点按此格式补充符合世界观的描述，100字以内
}
```

#### 步骤4：重置时清除弹窗标记
在 `useWorldSave` 的重置回调中加入：
```ts
localStorage.removeItem("eden:world:global_intro_shown");
```
确保重新开始游戏时会再次显示开场弹窗。

### 验收标准
✅ 顶部无「风很温和，鸟鸣照常」文字，无「当前目标」悬浮框，场景顶部无「当前位置」文字<br>
✅ 首次进入游戏显示开场弹窗，点击空白/×可关闭，刷新不再显示<br>
✅ 切换场景（比如从园中央到伊甸之河）弹出对应场景弹窗，点击可关闭<br>
✅ 弹窗样式和现有弹窗风格统一，无排版异常

---

## 模块2：刻名石谜题与UI优化
### 需求来源
- 刻名石按钮文字从「查看问题」改为「查看内容」
- 谜题改为开放式问题：围绕「人为什么要有名字」提问，只要回答就给道具
- 弹窗UI优化：去掉白色输入框，改为深色统一风格，按钮从「刻下名字」改为「刻下回答」

### 改动文件
| 文件路径 | 改动类型 |
|---|---|
| `src/app/world/page.tsx` | 修改文案 |
| `src/components/world/ScenePuzzleModal.tsx` | UI重构 |
| `src/app/globals.css` | 新增样式 |
| `src/content/world/scenePuzzles.ts` | 修改文案 |
| `src/game/world/puzzleAnswerRules.ts` | 移除判断逻辑 |

### 具体实现步骤
#### 步骤1：修改按钮文案
打开 `src/app/world/page.tsx`，找到1845行的刻名石按钮文字，将：
```tsx
<small>{namingStoneCompleted ? "已记下" : "查看问题"}</small>
```
改为：
```tsx
<small>{namingStoneCompleted ? "已记下" : "查看内容"}</small>
```

#### 步骤2：更新谜题文案
打开 `src/content/world/scenePuzzles.ts`，找到刻名石（`puzzle_naming_stone`）的谜题内容，替换为：
```ts
title: "刻名石上的问题",
content: "亚当为飞鸟走兽一一命名。石上却留下未完的一句：\n「若只说出称呼，却未曾理解它，万物真的受名了吗？」\n名字赋予万物的，究竟是什么？人为什么要有名字？",
placeholder: "写下你对「名字」的理解（200字以内）…",
submitText: "刻下回答",
```

#### 步骤3：重构弹窗UI
打开 `src/components/world/ScenePuzzleModal.tsx`，修改输入框样式：
1. 移除输入框的白色背景、黑色边框，改为：
   ```css
   .eden-scene-puzzle-textarea {
     width: 100%;
     min-height: 120px;
     padding: 12px;
     border: 1px solid rgba(220, 200, 150, 0.3);
     border-radius: 8px;
     background: rgba(12, 18, 12, 0.8);
     color: #e8d8b8;
     font-size: 0.9rem;
     line-height: 1.6;
     resize: vertical;
   }
   .eden-scene-puzzle-textarea::placeholder {
     color: rgba(232, 216, 184, 0.5);
   }
   ```
2. 确认按钮样式和现有按钮统一，文案替换为「刻下回答」

#### 步骤4：移除答案判断逻辑
打开 `src/game/world/puzzleAnswerRules.ts`，找到刻名石的判断逻辑，修改为：
```ts
// 刻名石：任意非空输入即判定正确
if (puzzleId === "puzzle_naming_stone") {
  const cleaned = input.trim();
  if (cleaned.length === 0) {
    return {
      correct: false,
      feedback: "请写下你的回答。",
      itemToUnlock: null,
      stateModifications: {},
    };
  }
  return {
    correct: true,
    feedback: "石痕亮了一瞬。名字不是把万物收进掌心，而是让它们能被看见、被理解，也能从万物中被认出。你记住了「万物名录」。",
    itemToUnlock: "resonance_living_names",
    stateModifications: {
      worldActions: {
        ...state.worldActions,
        namingStoneCompleted: true,
      },
    },
  };
}
```
删除所有对错判断、反向概念匹配等复杂逻辑，只要输入非空就返回正确。

### 验收标准
✅ 刻名石按钮文字为「查看内容」<br>
✅ 弹窗标题为「刻名石上的问题」，内容为开放式问题，输入框为深色半透明风格，无白色边框<br>
✅ 按钮文字为「刻下回答」，输入任意非空内容提交后，正确获得「万物名录」道具<br>
✅ 输入为空时提示「请写下你的回答」，不提交

---

## 模块3：场景中央黑色阴影块修复
### 需求来源
场景中央出现黑色阴影覆盖块，影响视觉体验，属于旧版本残留样式。

### 改动文件
| 文件路径 | 改动类型 |
|---|---|
| `src/app/globals.css` | 修改样式 |

### 具体实现步骤
打开 `src/app/globals.css`，找到 `.scene-progress-1::after`、`.scene-progress-2::after`、`.scene-progress-3::after` 三个样式块：
1. 将 `background` 的透明度分别调整为：
   - `.scene-progress-1::after`：`rgba(0,0,0,0.05)`（几乎完全透明）
   - `.scene-progress-2::after`：`rgba(0,0,0,0.1)`
   - `.scene-progress-3::after`：`rgba(0,0,0,0.15)`
2. 将 `z-index` 从 `1` 改为 `-1`，确保不会遮挡场景元素
3. 删除 `.scene-progress-0::after` 样式块（神的注视为0时完全不显示阴影）

### 验收标准
✅ 神的注视为0时，场景中央无任何黑色阴影<br>
✅ 神的注视≥1时，仅有极淡的暗色氛围，无明显的黑色覆盖块<br>
✅ 场景中的NPC、可点击元素不会被阴影遮挡

---

## 模块4：词元消耗体系优化
### 需求来源
- 重新开始游戏后，润色消耗的词元不清零 → 修复清零
- 对话时显示本次、本轮、本局消耗的词元
- 润色后tip保留「本次消耗X · 累计Y」

### 改动文件
| 文件路径 | 改动类型 |
|---|---|
| `src/app/world/page.tsx` | 新增状态+显示 |
| `src/hooks/useWorldSave.ts` | 重置时清零 |
| `src/app/globals.css` | 新增提示样式 |
| `src/components/world/WorldPanel.tsx` | 属性面板增加统计 |

### 具体实现步骤
#### 步骤1：新增词元统计状态
在 `src/app/world/page.tsx` 的状态区新增：
```tsx
// 词元消耗统计
const [polishTokensRound, setPolishTokensRound] = useState(0); // 本轮（当前时段）累计消耗
const [polishTokensTurn, setPolishTokensTurn] = useState(0); // 本次对话消耗，显示后清零
const [showTurnConsumptionTip, setShowTurnConsumptionTip] = useState(false); // 是否显示本次消耗提示
```

#### 步骤2：重置时清零
1. 在 `handleRestart` 重置函数中加入：
   ```tsx
   setPolishTokensTotal(0);
   setPolishTokensRound(0);
   setPolishTokensTurn(0);
   localStorage.removeItem("eden:world:polish-tokens");
   ```
2. 在 `useWorldSave` 的重置回调中同样加入上述清零逻辑。

#### 步骤3：更新消耗统计逻辑
在 `handlePolish` 函数中，润色成功后更新统计：
```tsx
const consumed = data.tokens ?? 0;
setPolishTokensTotal(prev => prev + consumed);
setPolishTokensRound(prev => prev + consumed);
setPolishTokensTurn(consumed);
setShowTurnConsumptionTip(true);
// 3秒后自动隐藏本次消耗提示
setTimeout(() => setShowTurnConsumptionTip(false), 3000);
```
在 `handleSubmit` 对话提交函数中，同样统计词元消耗（如果对话有消耗的话，当前若没有则后续补全）。

#### 步骤4：显示消耗提示
1. 在对话流底部新增消耗提示组件，放在输入框上方：
   ```tsx
   {/* 本次对话消耗提示 */}
   {showTurnConsumptionTip && polishTokensTurn > 0 && (
     <div className="eden-polish-consumption-tip">
       本次低语消耗 {polishTokensTurn} 词元 · 本轮累计 {polishTokensRound} · 本局累计 {polishTokensTotal}
     </div>
   )}
   ```
2. 在 `src/app/globals.css` 新增提示样式：
   ```css
   .eden-polish-consumption-tip {
     font-size: 0.75rem;
     color: rgba(232, 216, 184, 0.7);
     text-align: center;
     padding: 4px 0;
     margin-bottom: 8px;
     animation: fadeIn 0.3s ease;
   }
   ```

#### 步骤5：属性面板增加统计
在蛇的属性面板（`src/components/world/WorldPanel.tsx`）中新增词元统计项：
```tsx
<div className="mb-4">
  <span className="text-sm text-gray-400">词元消耗统计</span>
  <div className="flex justify-between mt-1">
    <span>本轮消耗</span>
    <span>{polishTokensRound}</span>
  </div>
  <div className="flex justify-between mt-1">
    <span>本局累计消耗</span>
    <span>{polishTokensTotal}</span>
  </div>
</div>
```

### 验收标准
✅ 重新开始游戏后，润色词元统计清零，localStorage无残留<br>
✅ 润色/对话提交后，底部显示消耗提示，3秒后自动消失<br>
✅ 提示内容正确：「本次X · 本轮Y · 本局Z」<br>
✅ 进入下一轮时，`polishTokensRound` 清零<br>
✅ 蛇的属性面板可看到正确的统计数据

---

## 模块5：神明注视UI优化
### 需求来源
- 移除「已领X/7」显示，只显示「注视值：X/Y」（当前累计/下次献礼所需阈值）
- 领取献礼后进度清零，阈值递增：第1次0/2 → 第2次0/3 → 第3次0/4 → 以此类推
- hover提示：「当前已累计X点，再获得Y点可领取神明献礼」

### 改动文件
| 文件路径 | 改动类型 |
|---|---|
| `src/components/world/DivineAttentionViz.tsx` | 修改显示逻辑 |

### 具体实现步骤
打开 `src/components/world/DivineAttentionViz.tsx`：
1. 找到92行的文案显示，将：
   ```tsx
   已领 {ownedCount ?? 0}/7 · 注视累计 {cumulative}/{nextThreshold}
   ```
   改为：
   ```tsx
   注视值：{cumulative}/{nextThreshold}
   ```
2. 更新 `title` 悬浮提示为：
   ```tsx
   title={`当前已累计${cumulative}点，再获得${nextThreshold - cumulative}点可领取神明献礼`}
   ```
3. 确认阈值逻辑和现有 `divineGiftRules.ts` 中的递增逻辑一致：`[2, 3, 4, 4, 5, 6, 7]`，不需要改动底层计算。

### 验收标准
✅ 顶部神明注视区域仅显示「注视值：X/Y」，无「已领X/7」文字<br>
✅ 数值随注视度增加正确更新，领取献礼后进度清零，阈值正确递增<br>
✅ hover时显示正确的提示文案

---

## 整体验收清单
所有模块开发完成后，需通过以下验证：
### 1. 静态检查
✅ `npm run lint` 无错误（警告可以保留）<br>
✅ `npx tsc --noEmit` 无类型错误<br>
✅ `npm run build` 构建成功

### 2. 功能测试
✅ 所有模块的单模块验收标准全部通过<br>
✅ 旧存档兼容：读取之前的存档，所有功能正常，无报错<br>
✅ 新游戏流程：重新开始游戏，所有弹窗、统计逻辑正常

### 3. 自动化测试
✅ `node scripts/test-scene-puzzle-rules.mjs` 51/51通过<br>
✅ `node scripts/test-world-visual-smoke.mjs` 全部通过<br>
✅ `node scripts/test-world-smoke.mjs` 全部通过<br>
✅ `npm run test:e2e -- tests/e2e/chapter1-mechanics.spec.ts --project=desktop-chromium` 全部通过

---

## 注意事项
1. 不要改动现有核心玩法逻辑：神的注视计算、献礼规则、对话逻辑、存档格式全部保持不变，仅修改UI和交互
2. UI风格保持和现有设计统一：暗色半透明、金色描边、圆角12px，不要使用亮色、尖锐风格
3. 所有新增的localStorage key都要加`eden:world:`前缀，避免冲突
4. 弹窗点击空白区域关闭的逻辑和现有弹窗保持一致
