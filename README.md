# 口播一键包装 · 免费版

把一段**真人口播视频 + SRT 字幕**，交给 AI（Claude Code、Codex 等能跑命令的 Agent），自动包装成带信息卡片、关键词动画和字幕的成片。

AI 只负责“想”：读字幕，决定每一段用什么画面、写什么字（一份 `plan.json`）。“做”全部交给代码：按口播逐字对时、排版、动画、避开手机平台的图标遮挡、逐帧渲染、混回原声。所以同一份计划每次出片都一样，不会因为 AI 手抖画歪。

## 免费版包含什么

- **8 个最常用的版式**：纯人物（可加小标签）、金句关键词、章节编号卡、并列关键词、左右对比、流程链、数字卡、截图展示。
- **1 种风格**：基础深色（黑底细网格 + 金色焦点 + 白底字幕）。
- **自动对时**：画面上的字在口播说到时才出现。
- **出片前检查**：手机平台右侧图标遮挡、字压人脸、出画、字太小、孤字换行。
- **10 条核心包装规则**：`docs/包装规则.md`。

> 更多风格、人后大字、几十种版式与动效、素材自动匹配、审片看板和完整的打磨规则，在 BOSS 畅老板的付费知识库「完整版」里。

## 安装

需要：Node.js 20 以上、[FFmpeg](https://ffmpeg.org/download.html)（命令行能运行 `ffmpeg` 和 `ffprobe`）。

```bash
git clone https://github.com/boss-chang2026/koubo-oneclick-packaging-free.git
cd koubo-oneclick-packaging-free
npm install
npm run browser   # 下载无头浏览器（约 100MB）
npm run font      # 可选：下载开源粗黑体 Noto Sans SC Black（约 9MB）
npm run demo      # 生成一段测试视频并出片，能出片就说明装好了
```

可选，让文字出现时点更准（逐字对时，首次运行会下载约 500MB 的语音模型）：

```bash
pip install faster-whisper
```

### 怎么让 AI 帮你装

把下面这段话发给你的 AI 编程助手（Claude Code / Codex 等）：

> 帮我安装 https://github.com/boss-chang2026/koubo-oneclick-packaging-free ：克隆到本地，按 README 的“安装”一节执行，最后跑 `npm run demo` 确认能出片；然后把这个目录作为 skill 登记（skill 名 koubo-oneclick-packaging-free，入口是目录里的 SKILL.md）。

## 怎么用

准备好两样东西：**剪好的口播视频**（横屏，1920×1080 最佳）和**它的 SRT 字幕**（剪映等工具都能导出）。然后对 AI 说：

> 用口播一键包装免费版，包装这条视频：视频 `<路径>`，字幕 `<路径>`。

AI 会按 `SKILL.md` 的步骤：建工程 → 逐字对时 → 写分镜 → 检查 → 出片，最后把成片路径给你。

也可以自己动手写计划（参考 `examples/demo/plan.json`），用命令行出片：

```bash
node bin/kb.mjs catalog              # 看 8 个版式怎么用
node bin/kb.mjs words  plan.json     # 逐字对时（可选）
node bin/kb.mjs check  plan.json     # 检查
node bin/kb.mjs render plan.json     # 出片 → .cache/out/preview.mp4
```

## 目录

```
bin/kb.mjs          命令行入口
lib/                对时、编译、渲染、检查（Node 端）
runtime/            页面引擎：render(t) 逐帧绘制
archetypes/         8 个版式（与风格无关）+ catalog.json 字段说明
styles/basic/       基础深色风格（颜色、字号、部件样式）
docs/包装规则.md     10 条核心规则
examples/demo/      演示用字幕和计划
```

## 许可

MIT，见 `LICENSE`。第三方组件见 `NOTICE.md`。
