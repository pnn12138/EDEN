// ============================================================
// EdgeOne Pages 部署配置（Next.js 全栈 / Serverless 模式）
// ============================================================
//
// ⚠️ 本项目关键约束（务必遵守）：
//   1. 本项目包含 /api/* 服务端路由（用于在「服务端」隐藏 LLM Key、
//      执行规则层校验、统一多 Provider 接入）。因此必须部署在
//      「Serverless / Node 运行时」模式，严禁启用静态导出
//      （next.config.js 中不得写 output: 'export'），否则 API 路由会被移除，
//      服务端隐藏密钥的能力随之失效。
//   2. 本文件不含任何密钥 / 敏感信息。所有 VOLCENGINE_* / DEEPSEEK_* /
//      TTS_* 等密钥仅在 EdgeOne Pages 控制台或构建环境变量中注入，
//      且 .env.local 已被 .gitignore 排除，不会进入仓库。
//   3. 构建产物目录为 Next.js 默认 .next（由 `npm run build` 生成）。
//
// 📌 部署前请在 EdgeOne Pages 控制台确认：
//      - 构建命令：npm run build
//      - 输出目录：.next
//      - 运行时：Node / Serverless（支持 Next.js API Routes）
//      - 在「环境变量」中配置 LLM_PROVIDER（建议 volcengine），
//        密钥从服务端读取，不要暴露到前端。
//      本文件用于声明上述关键约束，实际构建参数以控制台为准。
//
/** @type {import('next').NextConfig} */
module.exports = {
  framework: "nextjs",
  build: {
    command: "npm run build",
    output: ".next",
    nodeVersion: "20",
  },
  // serverless：保留 /api/* 路由，密钥仅服务端可见
  runtime: "node",
  // 仅声明环境变量「名称」，值请在平台控制台注入（切勿写入本文件或仓库）
  env: {
    LLM_PROVIDER: { required: false },
    VOLCENGINE_API_KEY: { required: false, secret: true },
    VOLCENGINE_BASE_URL: { required: false },
    VOLCENGINE_MODEL: { required: false },
    DEEPSEEK_API_KEY: { required: false, secret: true },
    DEEPSEEK_BASE_URL: { required: false },
    DEEPSEEK_MODEL: { required: false },
  },
};
