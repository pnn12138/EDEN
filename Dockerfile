# ============================================================
# EDEN 部署镜像（Node 20 运行时，保留 /api/* 服务端路由）
#
# 关键约束：本项目含服务端 API 路由（服务端隐藏 LLM Key、执行规则层校验），
# 必须使用 Node 运行时，严禁静态导出（next.config.js 不得写 output:'export'）。
#
# 密钥（VOLCENGINE_* / DEEPSEEK_* 等）严禁写死在镜像或仓库中，
# 仅由运行环境（EdgeOne / CNB 构建环境变量）注入。
# ============================================================

FROM node:20-slim

WORKDIR /app

# 先拷贝依赖清单以利用层缓存
COPY package.json package-lock.json ./

# 清理安装（仅生产依赖 + 构建期依赖）
RUN npm ci

# 拷贝源码并构建（生成 .next）
COPY . .

# 构建：含 /api 路由；静态导出被 next.config.js 禁止
RUN npm run build

ENV PORT=8686
EXPOSE 8686

# 绑定 0.0.0.0，使用固定端口 8686（不依赖动态变量）
CMD ["sh", "-c", "npm run start -- -H 0.0.0.0 -p 8686"]
