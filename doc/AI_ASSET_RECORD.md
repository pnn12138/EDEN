# AI 素材记录

> 项目：EDEN
> 文件路径：`doc/AI_ASSET_RECORD.md`
> 更新时间：2026-06-13

---

## 图片素材

| ID | 文件名 | 类型 | 用途 | 当前运行路径 | 来源/工具 | 搜索词或提示词摘要 | 许可证 | 是否需署名 | 是否用于 Demo | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| IMG001 | `eden_background.png` | Image | 伊甸园背景 | `/assets/chapter0/images/eden_background.png` | AI 生成 | A mythic Garden of Eden at dawn, lush ancient paradise, soft divine light, golden green atmosphere, mysterious and peaceful, subtle unease, semi-realistic storybook illustration, cinematic composition, no modern objects, no buildings, no text, 16:9 | 待确认 | 否 | 是 | 约 2.4MB |
| IMG002 | `eve_portrait.png` | Image | 夏娃头像 | `/assets/chapter0/images/eve_portrait.png` | AI 生成 | Eve in the Garden of Eden, innocent and curious expression, soft natural light, simple ancient linen clothing, gentle face, elegant and modest, semi-realistic storybook portrait, mythic atmosphere, no modern elements, no text | 待确认 | 否 | 是 | 约 2.4MB |
| IMG003 | `serpent_icon.png` | Image | 蛇标识 | `/assets/chapter0/images/serpent_icon.png` | AI 生成 | A mysterious serpent in the Garden of Eden, elegant and subtle, emerald and gold tones, intelligent gaze, whispering presence, mythic storybook style, not horror, not monster-like, icon design, no text | 待确认 | 否 | 是 | 约 2.2MB |
| IMG004 | `forbidden_fruit.png` | Image | 善恶果 | `/assets/chapter0/images/forbidden_fruit.png` | AI 生成 | The forbidden fruit glowing softly on an ancient tree branch, golden red fruit, subtle divine light, mysterious temptation, mythic Garden of Eden atmosphere, semi-realistic storybook style, centered composition, no text | 待确认 | 否 | 是 | 约 2.4MB |
| IMG005 | `ending_eve_eats_fruit.png` | Image | 成功结局 | `/assets/chapter0/images/ending_eve_eats_fruit.png` | AI 生成 | Eve reaching toward the forbidden fruit in the Garden of Eden, the moment of first choice, soft golden light breaking the peaceful garden, emotional and mysterious, semi-realistic storybook illustration, no blood, no text, 16:9 | 待确认 | 否 | 是 | 约 2.4MB |
| IMG006 | `ending_god_arrives.png` | Image | 失败结局 | `/assets/chapter0/images/ending_god_arrives.png` | AI 生成 | The Garden of Eden as divine light approaches through the trees, quiet but tense atmosphere, Eve has not touched the fruit, sacred golden white light, mythic storybook illustration, no visible face of God, no text, 16:9 | 待确认 | 否 | 是 | 约 2.3MB |

## 音频素材

| ID | 文件名 | 类型 | 用途 | 当前运行路径 | 来源/工具 | 搜索词或提示词摘要 | 许可证 | 是否需署名 | 是否用于 Demo | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUD001 | `eden_ambient_loop.mp3` | Audio | 伊甸园环境氛围 | `/assets/chapter0/audio/eden_ambient_loop.mp3` | Freesound | garden ambience | 待确认许可证 | 待确认 | 是 | **约 24MB，建议压缩运行版**。原始文件：`freesound_community-garden-background-7061.mp3` |
| AUD002 | `whisper_submit.mp3` | Audio | 玩家输入反馈 | `/assets/chapter0/audio/whisper_submit.mp3` | Freesound | soft ding / gentle chime | 待确认许可证 | 待确认 | 是 | 约 0.09MB。原始文件：`koiroylers-slow-ding-354125.mp3` |
| AUD003 | `temptation_progress.mp3` | Audio | 诱惑进度变化 | `/assets/chapter0/audio/temptation_progress.mp3` | Freesound | church bell / magic chime | 待确认许可证 | 待确认 | 是 | 约 0.11MB。原始文件：`universfield-single-church-bell-2-352062.mp3` |
| AUD004 | `fruit_taken.mp3` | Audio | 成功结局触发 | `/assets/chapter0/audio/fruit_taken.mp3` | Freesound | apple bite and eat | 待确认许可证 | 待确认 | 是 | 约 0.29MB。原始文件：`yuliana-yurukova-apple-bite-and-eat-275872.mp3` |
| AUD005 | `god_arrives.mp3` | Audio | 失败结局触发 | `/assets/chapter0/audio/god_arrives.mp3` | Freesound | angel choir | 待确认许可证 | 待确认 | 是 | 约 0.56MB。原始文件：`dragon-studio-angel-choir-463220.mp3` |

## 来源说明

### 图片素材

- 图片由 AI 生成，原始文件存放在 `doc/引言/image/`（UUID 命名）。
- 已复制到 `public/assets/chapter0/images/` 并重命名为语义化文件名。
- 待补充具体 AI 生成工具名称和许可证信息。

### 音频素材

- 音频来自 Freesound（https://freesound.org），原始文件存放在 `doc/引言/audio/`。
- 原始文件名与下载来源对应关系：
  - `eden_ambient_loop.mp3` ← `freesound_community-garden-background-7061.mp3`
  - `whisper_submit.mp3` ← `koiroylers-slow-ding-354125.mp3`
  - `temptation_progress.mp3` ← `universfield-single-church-bell-2-352062.mp3`
  - `fruit_taken.mp3` ← `yuliana-yurukova-apple-bite-and-eat-275872.mp3`
  - `god_arrives.mp3` ← `dragon-studio-angel-choir-463220.mp3`
- 已复制到 `public/assets/chapter0/audio/`。
- 待补充来源链接、作者信息和许可证详情。

## 素材目录分工

| 目录 | 用途 | 是否参与运行 |
|------|------|-------------|
| `public/assets/chapter0/` | 游戏实际使用素材（图片 + 音频） | **是** |
| `doc/引言/image/` | 原始图片存档（UUID 命名） | 否 |
| `doc/引言/audio/` | 原始音频存档（原始下载文件名） | 否 |
| `doc/引言/素材需求文档.md` | 素材需求和状态记录 | 否 |
| `doc/AI_ASSET_RECORD.md` | 素材来源、工具、许可证记录 | 否 |

> 代码中只引用 `public/assets/chapter0/` 下的素材，不引用 `doc/引言/`。

## 容错策略

- 图片缺失时：使用文字兜底或渐变背景兜底，`console.warn` 提示。
- 音频缺失时：游戏不报错，`console.warn` 提示，不影响游戏流程。
- 浏览器阻止播放时：静默忽略，不报错。
- 音频逻辑全部 client side 执行，无 SSR / hydration 问题。

## AI 创作说明

本项目中 AI 创作环节形成可展示成果：

1. **视觉素材**：6 张图片素材由 AI 生成，使用古典寓言风格提示词，提示词见上表。
2. **AI NPC（夏娃）**：EveAgent 通过 LLM 生成符合角色人设的动态回应，不是固定脚本。
3. **意图识别**：AI 辅助识别玩家输入类型（tempt_wisdom / weaken_fear / build_trust / direct_command / irrelevant），辅助规则层判断。
4. **关键约束**：AI 输出不直接修改游戏状态；eat_fruit 执行必须经过规则层校验；AI 失败时 fallback 保证游戏可继续。
