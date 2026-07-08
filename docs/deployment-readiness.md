# EDEN 部署就绪报告

> 日期：2026-06-29  
> 目标平台：Vercel  
> 框架：Next.js 14 App Router（服务端 API 路由，非纯静态导出）

---

## 1. 构建结果

```
npm run build: ✅ PASS (0 errors, 2 pre-existing lint warnings)
npm run lint:  ✅ PASS (0 errors)
npm run start: ✅ PASS (production server running on :3000)
```

### 路由清单

| 路由 | 类型 | 说明 |
|---|---|---|
| `/` | Static | 首页，单入口「进入伊甸园」 |
| `/world` | Static | 第一章主游戏页面 |
| `/prologue` | Static | 旧引导页（未使用，保留归档） |
| `/game` | Static | Chapter 0 旧版（保留归档） |
| `/ending` | Static | 结局页 |
| `/api/health` | Dynamic | 运行状态端点 |
| `/api/world` | Dynamic | 第一章低语 API |
| `/api/world/tool` | Dynamic | 第一章工具（移动/互动/道具）API |
| `/api/agent` | Dynamic | Chapter 0 旧版 API |
| `/api/hedgehog` | Dynamic | 刺猬环境反馈 API |

---

## 2. 生产环境变量

在 Vercel 后台 → Settings → Environment Variables 中添加：

| 变量名 | 必填 | 说明 |
|---|---|---|
| `LLM_PROVIDER` | ✅ | `volcengine` / `deepseek` / `mock` |
| `VOLCENGINE_API_KEY` | 条件 | 若 LLM_PROVIDER=volcengine |
| `VOLCENGINE_BASE_URL` | 条件 | 火山引擎 API 地址 |
| `VOLCENGINE_MODEL` | 条件 | 火山引擎模型名称 |
| `DEEPSEEK_API_KEY` | 条件 | 若 LLM_PROVIDER=deepseek |
| `DEEPSEEK_BASE_URL` | 条件 | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | 条件 | `deepseek-v4-flash` |

**安全规则：**
- ❌ 不得使用 `NEXT_PUBLIC_` 前缀
- ❌ 不得提交 `.env.local` 到仓库
- ✅ 所有 Key 仅在服务端 `process.env` 读取

---

## 3. 健康检查

```
GET /api/health

响应：
{
  "ok": true,
  "version": "0.1.0",
  "chapter": "chapter1_garden_voices",
  "provider": "mock",
  "hasProviderKey": true,
  "timestamp": 1782665294774
}
```

- 不返回 Key、Base URL、模型名称或任何用户数据
- `provider` 字段只区分 "mock" / "configured"
- `hasProviderKey` 只表示是否有 Key 存在

---

## 4. Fallback 行为验证

### LLM_PROVIDER=mock（无模型）

| 测试项 | 结果 |
|---|---|
| 首页加载 | ✅ HTTP 200 |
| /api/health | ✅ 正常返回 |
| 低语夏娃 | ✅ 返回固定 fallback 回复 |
| 心智数值变化 | ✅ 规则层正常计算 |
| 禁忌动作链 | ✅ 逐步触发 |
| 成功结局 | ✅ eve_eats_fruit |
| 失败结局 | ✅ god_arrives (12时段耗尽) |
| Smoke 测试 | ✅ 163/171 通过 |

### 真实模型超时/失败/缺 Key 场景

| 场景 | 行为 |
|---|---|
| API Key 未配置 | `getProvider()` 返回 null → 下游降级到本地 fallback |
| API 请求超时 | `callLLM` catch 块 → 返回 fallback 回复 |
| API 返回非 JSON | `sanitizeWorldReply` 尝试提取 → 失败则返回空 → fallback |
| API 返回 500 | 同超时处理 |

**关键设计：AI 失败不阻塞游戏。** Fallback 保证核心玩法闭环始终可达。

---

## 5. 安全审查

| 检查项 | 结果 |
|---|---|
| 无 `NEXT_PUBLIC_` 前缀 | ✅ |
| API Key 仅服务端 `process.env` | ✅ |
| `.env.local` 在 `.gitignore` | ✅ |
| 前端无 Key 泄露路径 | ✅ |
| `/api/health` 不暴露敏感信息 | ✅ |
| 玩家可见文本无工程术语 | ✅ (已 grep 验证) |

---

## 6. 版本口径

| 入口 | 定位 |
|---|---|
| `/` → `/world` | **E-01 正式试玩入口**（参赛主体） |
| `/game` | Chapter 0 旧版归档（仅保留，无入口链接） |
| `/prologue` | 旧引导页归档 |
| `doc/DEMO_VIDEO_SCRIPT.md` | 标注 `[已归档 - Chapter 0 旧版]` |

---

## 7. 资源路径检查

| 资源类型 | 数量 | 路径前缀 | 状态 |
|---|---|---|---|
| Chapter 0 图片 | 15 | `/assets/chapter0/images/` | ✅ |
| Chapter 0 音频 | 6 | `/assets/chapter0/audio/` | ✅ |
| Chapter 1 图片 | 20 | `/assets/chapter1/images/` | ✅ |
| Chapter 1 音频 | 12 | `/assets/chapter1/audio/` | ✅ |

---

## 8. 上线前剩余风险

| 风险 | 等级 | 说明 |
|---|---|---|
| LLM 响应时间 | 中 | 真实模型回复 3-10 秒，不影响功能但影响体验 |
| 并发请求 | 低 | 单玩家场景，无并发压力 |
| 浏览器兼容 | 低 | 仅推荐桌面 Chrome/Edge，README 已声明 |
| 音效自动播放 | 低 | 需用户首次点击后触发，符合浏览器策略 |
| Vercel Serverless 超时 | 中 | LLM 调用可能超过 10s function timeout；建议用 edge 配置或增加 timeout |

---

## 9. Vercel 部署步骤

1. Fork/Clone 仓库到你的 GitHub
2. 在 Vercel 中 Import 该仓库
3. Framework Preset 选择 `Next.js`
4. 在 Environment Variables 中添加上述变量
5. Deploy
6. 访问 `https://<project>.vercel.app` 验证首页加载
7. 访问 `https://<project>.vercel.app/api/health` 验证 API
8. 从首页点击「进入伊甸园」完整走一遍流程

---

## 10. 录制推荐路径

```
首页 → 点击「进入伊甸园」→ 引言（3 次点击推进）
→ 万物受名处（刻名石 3 击 + 刺猬互动）
→ 园子中央 → 伊甸之河（水声/静息之叶）
→ 园中树林（小鹿视线 + 女人首次低语）
→ 东园幽径（狐狸评价话术）
→ 园中树林 / 园子中央（最终低语 → 禁忌动作链 → 结局）
```

正式访问路径：`https://<project>.vercel.app` → 点击「进入伊甸园」
