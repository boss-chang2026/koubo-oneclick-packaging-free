# 第三方组件与许可

本仓库自身的代码和文档按 MIT 许可发布（见 `LICENSE`）。仓库里**不附带**任何字体、音乐、音效、Logo、视频或模型文件。下面这些由使用者自己安装或下载，各自遵循原许可：

| 组件 | 用途 | 许可 | 怎么来 |
|---|---|---|---|
| [playwright-core](https://github.com/microsoft/playwright) | 控制无头浏览器逐帧截图 | Apache-2.0 | `npm install` |
| Chromium headless shell | 渲染页面 | BSD 等（Chromium 许可） | `npm run browser` |
| [FFmpeg](https://ffmpeg.org) | 抽帧、编码、混音 | LGPL/GPL（取决于你的安装） | 自行安装 |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) 及 Whisper 模型 | 逐字对时（可选） | MIT | `pip install faster-whisper`，首次运行自动下载模型 |
| [Noto Sans SC Black](https://github.com/notofonts/noto-cjk) | 包装文字的粗黑体（可选） | SIL Open Font License 1.1 | `npm run font` |

不装可选组件也能出片：没有逐字对时，文字按字幕条内字数估算出现时刻；没有字体，退回系统黑体。
