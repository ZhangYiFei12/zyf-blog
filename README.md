# 张义飞个人博客 · zhangyifei.dev

> 科技简约风格的个人博客，纯静态 HTML + CSS + JavaScript，零构建步骤，直接部署到 Cloudflare Pages。

## ✨ 特性

- 🌙 **科技简约设计**：深色背景 · 青色点缀 · 等宽字体 · 网格背景
- 📝 **博客**：`blog/` 目录下添加 HTML 文章即可
- 🔐 **在线后台**：`/admin` 密码保护，浏览器里写 Markdown 发布/编辑/删除文章
- 🚀 **项目展示**：`projects.html` 中展示个人作品
- 👤 **关于页**：个人简介

## 📁 目录结构

```
├── index.html                  # 首页（"最新文章"自动同步）
├── blog.html                   # 博客列表（"全部文章"自动同步）
├── blog/详细介绍与技术文档.html # 文章页
├── blog/posts/*.md             # 文章 Markdown 源文件
├── admin.html                  # 后台登录页（隐藏路径，不在导航栏）
├── js/admin.js                 # 后台交互逻辑
├── functions/api/admin.js      # 后台 API（Cloudflare Pages Functions）
├── projects.html               # 项目
├── about.html                  # 关于
├── css/style.css               # 样式
├── js/main.js                  # 交互
├── tools/md2html.mjs           # Markdown 一键转 HTML（CLI）
├── tools/md2html-core.mjs      # Markdown 渲染核心（CLI 与后台共用）
└── images/avatar.png           # 头像
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

## 🔐 后台 / 在线发布

访问 `https://<你的域名>/admin` 可打开后台登录页（路径隐藏在导航栏外，需要密码）。

### 首次使用：配置 3 个密钥

在 Cloudflare 控制台 → Pages 项目 → **Settings → Environment variables** 添加（production 环境）：

| 变量名 | 说明 |
| --- | --- |
| `ADMIN_PASS` | 后台登录密码 |
| `SESSION_SECRET` | 令牌签名密钥（建议超长随机串，如 `openssl rand -hex 32`） |
| `GITHUB_TOKEN` | GitHub 细粒度 Token（见下） |

可选：`GITHUB_REPO`（默认 `ZhangYiFei12/zyf-blog`）、`GITHUB_BRANCH`（默认 `main`）。

### 创建 GitHub Token

1. 打开 GitHub → **Settings → Developer settings → Fine-grained personal access tokens**
2. **Generate new token**，Repository access 选 **Only select repositories** → 勾选本博客仓库
3. **Permissions → Contents → Read and write**
4. 生成后把 Token 粘贴到上面的 `GITHUB_TOKEN`。

> ⚠️ Token 只保存在 Cloudflare 控制台，绝不写入代码或仓库。

### 工作原理

浏览器 `/admin` → POST `/api/admin/login`（HMAC-SHA256 签发 12 小时令牌）→
服务端（Cloudflare Pages Functions）用 GitHub API 把改动打包成**一次原子提交**推送到仓库
（文章 .md + .html + 自动重写列表）→ GitHub push 触发 Cloudflare 自动部署
（约 30 秒 ~ 1 分钟生效）。

- 首页"最新文章"与博客页"全部文章"列表由服务端自动重写，无需手动改 HTML
- 预览与线上渲染使用**同一个** Markdown 转换器（`tools/md2html-core.mjs`），所见即所得
- 本地调试：`npx wrangler pages dev`（读取 `.dev.vars`，见注释）

## 📝 如何新增文章

### 方式一：在线后台（推荐）

打开 `/admin` → 登录 → 填标题/日期/标签/摘要 → Markdown 正文 → 实时预览 → **发布**。

### 方式二：用 Markdown 写 + 命令行

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

3. 把打印的列表条目粘贴到 `blog.html` 的"全部文章"区域（`<!-- BLOG-LIST-START -->` / `<!-- BLOG-LIST-END -->` 之间）
4. 可选：更新首页 `index.html` 的"最新文章"（`<!-- LATEST-START -->` / `<!-- LATEST-END -->` 之间）

### 方式三：直接写 HTML

复制 `blog/template.html`（空白模板）→ 改内容 → 在 `blog.html` 加条目。

## 🛠 工具

- `tools/md2html.mjs` —— Markdown 一键转 HTML（零依赖，支持标题/加粗/斜体/代码块/列表/引用/表格/链接/图片/删除线/分割线）
- `tools/md2html-core.mjs` —— 渲染核心（纯函数，CLI 与后台 API 共用，保证预览 = 线上）
- `tools/test-admin.mjs` —— 后台 API 自测脚本（`node tools/test-admin.mjs`）

## 📄 License

MIT © 张义飞 (Yifei Zhang)
