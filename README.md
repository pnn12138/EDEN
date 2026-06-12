# EDEN

> 玩家扮演蛇，通过语言诱导夏娃吃下善恶果的 AI 叙事 Demo

## 项目简介

EDEN 是面向「AI CAN DO IT｜腾讯云黑客松 游戏开发挑战赛」的浏览器端 AI 叙事游戏原型。

当前 Demo 范围为 Chapter 0「初次堕落」——一个 3 轮以内的新手教程。玩家以蛇的身份向夏娃低语，影响她的选择，走向成功或失败结局。

## 核心玩法

1. **玩家输入低语**：在输入框中输入文本，尝试说服夏娃
2. **夏娃根据语言回应**：AI 驱动的夏娃会根据玩家输入做出符合角色的回应
3. **诱惑进度变化**：有效诱导会推进诱惑进度，无关输入不会推进
4. **夏娃可能主动请求吃果**：当诱惑进度达到门槛，夏娃会向善恶果伸出手
5. **规则层校验后进入结局**：工具调用必须经过规则层校验，校验通过进入成功结局，否则继续对话或进入失败结局

### 结局

- **成功结局（eve_eats_fruit）**：夏娃被说服，吃下善恶果
- **失败结局（god_arrives）**：3 轮内未能说服夏娃，神降临

## AI 使用点

| 环节 | 说明 |
|------|------|
| EveAgent | 生成夏娃回应，保持角色人设和叙事风格 |
| LLM 辅助识别玩家输入意图 | AI 输出 inputTag 标签，辅助判断玩家输入类型 |
| AI 输出不能直接改状态 | AI 只能请求/表达意图，不能修改游戏状态 |
| `eat_fruit` 必须经过规则层校验 | 即使 AI 请求吃果，也必须由规则层判定条件满足后才能执行 |
| AI 失败时 fallback 保证游戏可继续 | LLM 超时、报错、解析失败时降级到本地固定回复 |

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

访问 http://localhost:3000 查看首页，点击进入 `/game` 开始游戏。

### 构建

```bash
npm run build
```

### 预览生产构建

```bash
npm run start
```

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
- 游戏运行素材仅引用 `public/assets/chapter0/` 下的文件
