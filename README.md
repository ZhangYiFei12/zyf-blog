# 张义飞个人博客 · zhangyifei.dev

> 科技简约风格的个人博客，纯静态 HTML + CSS + JavaScript，零构建步骤，直接部署到 Cloudflare Pages。

## ✨ 特性

- 🌙 **科技简约设计**：深色背景 · 青色点缀 · 等宽字体 · 网格背景
- 📝 **博客**：`blog/` 目录下添加 HTML 文章即可
- 🚀 **项目展示**：`projects.html` 中展示个人作品
- 👤 **关于页**：个人简介 + 技能条

## 📁 目录结构

```
├── index.html            # 首页
├── blog.html             # 博客列表
├── blog/详细介绍与技术文档.html # 文章页
├── projects.html         # 项目
├── about.html            # 关于
├── css/style.css         # 样式
├── js/main.js            # 交互
└── images/avatar.png     # 头像
```

## 🚀 部署

### Cloudflare Pages（推荐）

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. 选择本仓库，构建配置：
   - **Build command**：留空（纯静态，无需构建）
   - **Build output directory**：`/`（仓库根目录）
4. 点击 **Save and Deploy**

之后每次 `git push` 会自动重新部署。

### 本地预览

```bash
# 方式一：Python
python -m http.server 8000

# 方式二：Node
npx serve .
```

## 📝 如何新增文章

### 方式一：用 Markdown 写（推荐）

1. 在 `blog/posts/` 目录下新建 `.md` 文件，顶部带上元信息：

```markdown
---
title: "文章标题"
date: "2025-06-01"
excerpt: "文章摘要，会显示在列表页"
tags: ["技术", "随笔"]
---

## 小标题

正文支持 **Markdown** 语法。
```

2. 一键生成 HTML 页面：

```bash
node tools/md2html.mjs              # 转换 blog/posts/ 下全部 .md
node tools/md2html.mjs 我的文章.md   # 转换单个文件
node tools/md2html.mjs -w           # 监听模式，保存自动重新生成
```

工具会自动：生成 `blog/文章名.html`、打印博客列表条目代码（复制到 `blog.html` 即可）。

3. 把打印的列表条目粘贴到 `blog.html` 的"全部文章"区域
4. 可选：更新首页 `index.html` 的"最新文章"

### 方式二：直接写 HTML

复制 `blog/template.html`（空白模板）→ 改内容 → 在 `blog.html` 加条目。

## 🛠 工具

- `tools/md2html.mjs` —— Markdown 一键转 HTML（零依赖，支持标题/加粗/斜体/代码块/列表/引用/表格/链接/图片/删除线/分割线）

## 📄 License

MIT © 张义飞 (Yifei Zhang)
