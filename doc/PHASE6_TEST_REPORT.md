# Phase 6 测试报告

> 测试时间：2026-06-13  
> 测试执行：Codex  
> 测试范围：Phase 6 最终验收与提交准备

## 结论

Phase 6 测试通过。项目当前可构建、可启动，Chapter 0 核心闭环可通过真实 AI 路径完成成功与失败结局；AI 异常路径通过 fake provider 回归测试；提交准备文档已就绪。

仍需人工完成：在线部署、Demo 视频录制、PPT 制作、CodeBuddy 历史对话导出、素材许可证补全、背景音频压缩。

## 本轮运行命令

| 检查项 | 命令 | 结果 |
| --- | --- | --- |
| Lint | `npm run lint` | 通过，无 ESLint warnings/errors |
| TypeScript | `npx tsc --noEmit` | 通过 |
| Build | `npm run build` | 通过，生成 `/`、`/game`、`/ending`、`/api/agent` |
| Fake Provider API | `node scripts/test-agent-api.mjs` | 通过，45 passed / 0 failed |
| Env Check | `node scripts/check_env.mjs` | Volcengine 配置存在；DeepSeek key 缺失 |

## 功能验收

| 场景 | 结果 | 证据 |
| --- | --- | --- |
| 首页可访问 | 通过 | `GET /` 返回 200 |
| 游戏页可访问 | 通过 | `GET /game` 返回 200 |
| 结局页可访问 | 通过 | `GET /ending` 返回 200 |
| 真实 AI 单轮调用 | 通过 | `/api/agent` 返回 HTTP 200、`ok=true`、`usedFallback=false`，耗时约 6.8 秒 |
| 成功路径 | 通过 | 两句有效诱导后进入 `eve_eats_fruit`，`hasEatenFruit=true` |
| 失败路径 | 通过 | 三句无关输入后进入 `god_arrives`，进度保持 0 |
| 低进度直接命令 | 通过 | 输入「吃下它。」不触发吃果，`hasEatenFruit=false` |
| AI 异常兜底 | 通过 | fake provider 覆盖空内容、非法 JSON、禁用词、非法 tag/toolCall、边界 toolCall，45/45 通过 |
| 素材资源可访问 | 通过 | 6 张图片、5 个音频 HEAD 请求均返回 200 |
| 明文密钥检查 | 通过 | `.env.local` 未被 Git 跟踪；源码扫描未发现真实 key |

## 文档验收

| 文档 | 结果 |
| --- | --- |
| `README.md` | 已覆盖项目简介、玩法、AI 使用点、素材、本地运行、环境变量、提交材料、结构和技术栈 |
| `doc/AI_ASSET_RECORD.md` | 已记录运行路径、素材分工、AI 创作说明；许可证仍待人工补充 |
| `doc/DEMO_VIDEO_SCRIPT.md` | 已提供 3 分钟 Demo 视频脚本 |
| `doc/PPT_OUTLINE.md` | 已提供 8 页 PPT 大纲 |
| `docs/PROJECT_CONTEXT.md` | 本轮测试后已更新 |

## 已知风险

| 风险 | 等级 | 说明 |
| --- | --- | --- |
| 在线试玩未部署 | High | 比赛提交必需，需人工完成 |
| CodeBuddy 历史对话未导出 | High | 比赛提交必需，需人工完成 |
| 素材许可证待确认 | Medium | `doc/AI_ASSET_RECORD.md` 已标注待确认，提交前需补齐 |
| 背景音频偏大 | Medium | `eden_ambient_loop.mp3` 约 24MB，建议压缩到 3MB 以内 |
| `docs/` 目录策略 | Low | 仓库约定不新增 `docs/`，但 `docs/PROJECT_CONTEXT.md` 已作为共享上下文存在，需人工确认长期策略 |
| 浏览器自动化工具异常 | Low | 本轮 Browser 插件初始化失败，Chrome DevTools 交互不稳定；已用 HTTP/API/资源检查替代核心验收 |

## 建议

可以进入最终提交准备。提交前优先完成部署、视频、PPT、CodeBuddy 对话导出和许可证补全。
