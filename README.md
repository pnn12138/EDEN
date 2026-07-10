# EDEN — 园中诸声

> 玩家扮演蛇，通过探索伊甸园、收集线索与回响、低语影响夏娃的判断；夏娃自己走向那棵树。

## 项目简介

EDEN 是面向「AI CAN DO IT｜腾讯云黑客松 游戏开发挑战赛」的浏览器端 AI 叙事游戏。

当前 Demo 为第一章「园中诸声」：玩家在伊甸园的 6 个地点之间探索，与 14 个 AI 驱动的 NPC 对话，收集场景线索和园中回响道具，通过低语逐步改变夏娃的内心三值（敬畏、信任、自我判断），最终让她自己走向分别善恶树，摘下果子。

> 当前试玩目标为桌面浏览器（1920×1080）。

## 核心玩法

1. **地图探索**：6 个互连地点，昼夜切换，NPC 随时间出现或隐藏
2. **场景互动**：点击刻名石、水流、落叶等热点获取线索与道具
3. **NPC 低语**：与夏娃、亚当、天使、动物等角色自由对话，每个角色对特定话题敏感
4. **心智影响**：低语改变夏娃的三项内心数值——敬畏、对蛇的信任、自我判断
5. **禁忌动作链**：夏娃自行完成「看向树 → 靠近树 → 触碰果实 → 吃下果实」，玩家不能直接命令她
6. **神明注视**：高风险低语会提高注视，满 4 点触发神明献礼（非失败）
7. **12 时段限制**：每时段 5 行动点，12 时段内未完成吃果则失败

### 结局

- **成功（eve_eats_fruit）**：夏娃自己判断后吃下善恶果
- **失败（god_arrives）**：12 时段耗尽，神降临

## AI 使用点

| 环节 | 说明 |
|------|------|
| 智能 NPC 对话 | 夏娃、亚当、5 位天使、狐狸等角色由 LLM Agent 驱动，根据心智数值和上下文实时生成回复 |
| 世界构建 | AI 辅助重塑伊甸园世界观、角色设定与地点叙事 |
| 视觉素材 | AI 生成 6 地点昼夜背景 + 14 角色立绘 |
| 音效创作 | AI 辅助生成环境底噪和触发音效 |
| 规则层安全 | 所有 AI 输出经规则层校验，确保游戏平衡与安全 |
| CodeBuddy | 核心开发工具，从项目搭建到前后端实现全程使用 |

## 素材使用点

- AI 生成视觉素材（背景图、夏娃头像、蛇标识、善恶果、结局图）
- 免费素材库音频素材（环境氛围、提交反馈、进度变化、结局音效）
- 素材来源和提示词记录在 `doc/AI_ASSET_RECORD.md`

## 本地运行

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 为 `.env.local`，填入真实配置：

```bash
cp .env.example .env.local
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 查看首页，点击进入伊甸园。

### 构建

```bash
npm run build
```

### 预览生产构建

```bash
npx next start -p 3000
```

### Vercel 部署

1. 将仓库导入 Vercel
2. Framework 选择 Next.js
3. 在 Settings → Environment Variables 中添加 LLM Provider 相关变量（见下方环境变量说明）
4. 部署后访问 `https://<project>.vercel.app/api/health` 验证

### 代码检查

```bash
npm run lint
```

## 环境变量说明

| 变量名 | 用途 | 示例 |
|--------|------|------|
| `LLM_PROVIDER` | 选择 LLM 提供商 | `volcengine` / `deepseek` / `mock` |
| `VOLCENGINE_API_KEY` | 火山引擎 API 密钥 | （不在此处填写真实 key） |
| `VOLCENGINE_BASE_URL` | 火山引擎 API 地址 | （见服务商文档） |
| `VOLCENGINE_MODEL` | 火山引擎模型名称 | （见服务商文档） |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥（备选） | （不在此处填写真实 key） |
| `DEEPSEEK_BASE_URL` | DeepSeek API 地址 | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | DeepSeek 模型名称 | `deepseek-v4-flash` |

> 注意：不要将真实 API Key 提交到仓库。`.env.local` 已被 `.gitignore` 忽略。

## 提交材料

| 材料 | 说明 |
|------|------|
| 在线试玩链接 | 部署后的浏览器可访问 URL |
| 源码仓库 | Git 仓库 |
| Demo 视频 | 3 分钟内展示核心玩法的录制视频 |
| 作品介绍 PPT | 6-8 页作品介绍演示文稿 |
| CodeBuddy 历史对话 | 核心开发过程对话记录 |
| AI 创作说明 | AI 创作环节、产出、用途和提示词摘要，见 `doc/AI_ASSET_RECORD.md` |

## 项目结构

```
eden/
├─ public/assets/chapter0/   # 游戏运行素材
│  ├─ images/                # 6 张图片素材
│  └─ audio/                 # 5 个音频素材
├─ src/
│  ├─ app/                   # Next.js App Router 页面和 API 路由
│  ├─ agents/eve/            # 夏娃 Agent（EveAgent）
│  ├─ game/                  # 核心玩法逻辑、规则、工具和类型
│  ├─ content/               # 章节、角色、结局等游戏内容数据
│  ├─ services/llm/          # LLM 接入层（Provider 抽象）
│  ├─ hooks/                 # React hooks（音频等）
│  └─ components/            # UI 组件
├─ design/                   # 游戏设计文档
├─ doc/                      # 项目管理、赛题规则、素材记录
├─ scripts/                  # 测试脚本
├─ package.json
├─ next.config.js
├─ tailwind.config.js
└─ tsconfig.json
```

## 技术栈

- **前端框架**：Next.js 14 + React 18 + TypeScript
- **样式**：Tailwind CSS
- **AI 接入**：统一 LLM Provider（Volcengine / DeepSeek / Mock）
- **状态管理**：React useState（前端）+ 规则层（后端）

## 注意事项

- 请勿删除、重命名或移动 `doc/` 目录下的任何文件
- 游戏设计文档统一放在 `design/` 文件夹中
- 代码统一放在 `src/` 文件夹中
- 游戏运行素材仅引用 `public/assets/chapter0/` 与 `public/assets/chapter1/` 下的文件

## 部署（EdgeOne Pages / CNB）

> ⚠️ 本项目含 `/api/*` 服务端路由（用于在**服务端**隐藏 LLM Key、执行规则层校验），
> 因此必须部署在 **Serverless / Node 运行时** 模式，**严禁静态导出**（`next.config.js` 不得写 `output:'export'`）。

### EdgeOne Pages（推荐）

1. 控制台「导入仓库」→ 构建设置：
   - 构建命令：`npm run build`
   - 输出目录：`.next`
   - 运行时：**Node / Serverless**
   - Node 版本：20
2. 「环境变量」中配置 `LLM_PROVIDER`（建议 `volcengine`）及对应密钥（仅服务端读取，不暴露前端）。
3. 部署后获得 `*.edgeone.app` 公网 URL（国内可直连）。

仓库已附 `edgeone.config.js`（声明 Serverless 模式与需注入的环境变量名称，**值不入库**）。

### CNB（云原生构建）

CNB 负责构建，产物发布至 EdgeOne Pages（同 Serverless 模式）。仓库已附 `cnb.config.js`。

> 完整提交材料（在线链接、Demo 分镜脚本、PPT、对话记录、偏差说明、提交清单、社媒文案）
> 见 `doc/submit/` 目录；AI 创作说明见 `doc/AI_ASSET_RECORD.md`。
