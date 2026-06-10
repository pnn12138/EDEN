# EDEN - AI 叙事游戏

## 项目简介

EDEN 是一个 AI 叙事游戏项目。

玩家将在 Chapter 0 中扮演蛇，通过对话影响夏娃。

## 当前阶段

**项目初始化与可运行性修复。**

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

存放游戏设计相关的文档。

#### src/ - 代码区

存放所有源代码。

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

### 构建

```bash
npm run build
```

## 页面路由

- `/` - 首页
- `/game` - Chapter 0 游戏页面
- `/ending` - 结局页面
- `/api/agent` - Agent API 路由（占位）

## 技术栈

- **前端框架**：Next.js 14 + TypeScript
- **样式**：Tailwind CSS

## 注意事项

- 请勿删除、重命名或移动 `doc/` 目录下的任何文件
- 请勿新建 `docs/` 文件夹
- 游戏设计文档统一放在 `design/` 文件夹中
- 代码统一放在 `src/` 文件夹中
