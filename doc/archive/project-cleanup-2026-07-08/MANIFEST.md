# Project Cleanup Archive - 2026-07-08

本目录归档根目录散落的本地运行产物，用于保持仓库根目录清爽，同时避免直接删除可能仍有排查价值的日志。

## 归档位置

- `root-runtime-artifacts/`

## 归档内容

- 本地 Next/Codex 预览服务日志：`.codex-*.log`、`.next-dev-*.log`
- 本地开发/生产服务输出：`server_*_out.txt`、`server_*_err.txt`
- 临时构建错误记录：`build_errors.txt`
- TypeScript 构建缓存：`tsconfig.tsbuildinfo`
- 根目录散落的 UUID 图片：`eae05217-52d2-4f5c-88fd-5472e5fc6b16.png`

## 保留原则

- 未移动 `.env.local`，避免误触本地密钥配置。
- 未移动源码、设计文档、提交材料、`doc/` 既有文件或 CodeBuddy 证据资料。
- 未删除任何归档候选文件，只做本地归档移动。
