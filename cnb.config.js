// ============================================================
// CNB（云原生构建）部署配置（Next.js 全栈 / Node 运行时）
// ============================================================
//
// 说明：CNB 负责构建，产物交由 EdgeOne Pages 以「Node / Serverless」模式托管。
// 因本项目包含 /api/* 服务端路由（服务端隐藏 LLM Key、规则层校验），
// 必须使用 Node 运行时，严禁静态导出（output: 'export' 会破坏 API 路由）。
//
// ⚠️ 本文件不含任何密钥 / 敏感信息。所有密钥仅在 CNB 构建环境变量或
//    EdgeOne Pages 控制台注入，且 .env.local 已被 .gitignore 排除。
//
// 📌 推荐部署链路：
//    1. CNB 导入仓库，构建命令 npm run build，产物目录 .next。
//    2. 将构建产物发布至 EdgeOne Pages，运行时选 Node / Serverless。
//    3. 在 EdgeOne Pages 控制台配置 LLM_PROVIDER 与相关密钥（服务端读取）。
//
/** @type {import('next').NextConfig} */
module.exports = {
  framework: "nextjs",
  build: {
    command: "npm run build",
    output: ".next",
    nodeVersion: "20",
  },
  runtime: "node", // 保留 /api/* 路由
  publish: {
    target: "edgeone-pages",
    runtime: "node",
  },
  env: {
    LLM_PROVIDER: { required: false },
    VOLCENGINE_API_KEY: { required: false, secret: true },
    VOLCENGINE_BASE_URL: { required: false },
    VOLCENGINE_MODEL: { required: false },
    DEEPSEEK_API_KEY: { required: false, secret: true },
  },
};
