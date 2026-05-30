# 日语 YouTube 学习器

一个面向中文日语学习者的单页网页应用：粘贴 YouTube 链接后在页面内播放视频，导入或粘贴更可靠的日语字幕，并为常见汉字自动显示假名注音（furigana）。

## 立即试用

本项目不需要安装第三方依赖，直接使用 Node.js 启动本地静态服务器即可：

```bash
npm start
```

然后在浏览器打开：

```text
http://localhost:4173
```

也可以自定义端口：

```bash
PORT=3000 npm start
```


## 写入 GitHub 空仓库

如果 GitHub 上的目标仓库还是空的，可以在本地把这些项目文件推送到默认分支：

```bash
git remote add origin <你的 GitHub 仓库地址>
git branch -M main
git push -u origin main
```

仓库包含可直接运行的网页入口 `index.html`、本地服务器 `server.mjs`、前端逻辑 `src/app.js`、样式 `src/styles.css`、测试 `tests/app.test.mjs`，以及示例字幕 `public/sample-subtitles.vtt`。推送到 GitHub 后，也可以启用随项目提供的 GitHub Pages workflow 自动发布静态页面。

## 使用方法

1. 点击「载入示例」快速体验，或在「YouTube 链接」中粘贴自己的视频地址。
2. 在「粘贴 / 编辑可靠日语字幕」区域粘贴人工校对字幕、SRT、WebVTT，或每行一句的纯文本。
3. 点击「解析字幕并添加注音」，在右侧同步字幕区阅读带 furigana 的日语文本。
4. 使用「下一句」或点击字幕列表切换当前句；在「我的学习笔记」中记录单词、语法点和听力难点。

## 支持的字幕格式

- `SRT`，例如 `00:00:01,000 --> 00:00:03,000`
- `WebVTT`，例如 `00:00:01.000 --> 00:00:03.000`
- 纯文本：每行会自动按 4 秒一个片段生成时间轴

## 后续扩展方向

- 接入 Whisper 或专业 ASR 服务生成日语转写初稿。
- 使用 LLM 自动断句、纠错、补标点，并和用户导入字幕进行对齐。
- 扩展 furigana 词典或接入日语形态素分析器，提升多音字读音准确率。
- 导出 Anki 单词卡、语法复习列表和学习笔记。

## 开发检查

```bash
npm test
npm run check
```
