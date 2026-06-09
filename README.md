# EDEN - AI 叙事游戏

## 项目简介

EDEN 是一个 AI 叙事游戏项目。

当前先开发 Chapter 0 Demo：玩家扮演蛇，通过对话诱导夏娃吃下善恶果。

后续会扩展 Chapter 1、多角色、多场景、多结局、AI Agent 与工具调用。

## 项目结构

```
eden/
├─ doc/              # 项目管理资料区
├─ design/           # 游戏设计文档区
├─ src/              # 代码区
├─ package.json      # 项目依赖配置
├─ next.config.js    # Next.js 配置
├─ tsconfig.json     # TypeScript 配置
├─ tailwind.config.js # Tailwind CSS 配置
└─ postcss.config.js # PostCSS 配置
```

### 目录说明

#### doc/ - 项目管理资料区

存放项目管理、赛题规则、产品需求、进度资料等文档。

**请勿删除、重命名或移动其中任何文件。**

#### design/ - 游戏设计文档区

存放游戏设计相关的文档，包括：

- `00_project_overview.md` - 项目概述
- `01_world_bible.md` - 世界圣经
- `chapters/` - 章节设计文档
- `characters/` - 角色圣经文档
- `agents/` - AI Agent 行为规则
- `tools/` - 工具调用规则

#### src/ - 代码区

存放所有源代码，包括：

- `app/` - Next.js 应用页面和 API 路由
  - `app/globals.css` - 全局样式文件
- `content/` - 游戏内容数据
- `game/` - 游戏核心逻辑
- `agents/` - AI Agent 实现
- `services/` - 服务层（LLM、日志等）
- `store/` - 状态管理
- `components/` - React 组件
- `styles/` - 样式模块目录（可选）
- `tests/` - 测试文件

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 查看应用。

## 页面路由

- `/` - 首页，显示项目名 EDEN 和进入 Demo 的按钮
- `/game` - 游戏页面，Chapter 0：初次堕落
- `/ending` - 结局页面
- `/api/agent` - Agent API 路由（占位）

## 技术栈

- **前端框架**：Next.js 14 + TypeScript
- **样式**：Tailwind CSS
- **AI**（待接入）：DeepSeek API
- **状态管理**（待定）

## 开发计划

1. ✅ 初始化项目骨架
2. ⏳ 实现 Chapter 0 Demo
3. 📅 接入 DeepSeek API
4. 📅 实现 AI 对话
5. 📅 实现 eat_fruit 工具
6. 📅 扩展 Chapter 1
7. 📅 多角色、多场景、多结局
8. 📅 AI Agent 与工具调用

## 注意事项

- 请勿删除、重命名或移动 `doc/` 目录下的任何文件
- 请勿新建 `docs/` 文件夹
- 游戏设计文档统一放在 `design/` 文件夹中
- 代码统一放在 `src/` 文件夹中
- 全局样式文件位于 `src/app/globals.css`
