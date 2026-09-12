# 张义飞个人博客 · zhangyifei.dev

> 科技简约风格的个人博客，纯静态 HTML + CSS + JavaScript，零构建步骤，直接部署到 Cloudflare Pages。

## ✨ 特性

- 🌙 **科技简约设计**：深色背景 · 青色点缀 · 等宽字体 · 网格背景
- 📝 **博客**：`blog/` 目录下添加 HTML 文章即可
- 🔐 **在线后台**：`/admin` 密码保护，浏览器里写 Markdown 发布/编辑/删除文章
- 🚀 **项目展示**：`projects.html` 中展示个人作品
- 👤 **关于页**：个人简介
- 📦 **软件下载**：`downloads.html` 发布安装包（小文件网页后台上传 / 大文件 Release 脚本）

## 📁 目录结构

```
├── index.html                  # 首页（"最新文章"自动同步）
├── blog.html                   # 博客列表（"全部文章"自动同步）
├── blog/详细介绍与技术文档.html # 文章页
├── blog/posts/*.md             # 文章 Markdown 源文件
├── gallery.html               # 相册
├── downloads.html             # 下载页
├── files/                     # 下载文件仓库（≤100MB 上传目标）
├── data/downloads.json        # 下载文件元数据
├── admin.html                  # 后台登录页（隐藏路径，不在导航栏）
├── js/admin.js                 # 后台交互逻辑
├── functions/api/admin.js      # 后台 API（Cloudflare Pages Functions）
├── projects.html               # 项目
├── about.html                  # 关于
├── css/style.css               # 样式
├── js/main.js                  # 交互
├── tools/md2html.mjs           # Markdown 一键转 HTML（CLI）
├── tools/md2html-core.mjs      # Markdown 渲染核心（CLI 与后台共用）
├── tools/publish-release.mjs   # 大文件发布脚本（>100MB → GitHub Release）
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

## 📦 下载文件管理

网站导航栏「下载」（`downloads.html`）展示可下载的软件/文档，数据来自 `data/downloads.json`，由后台「📦 下载」页管理。

### 方式一：小文件（≤100MB）—— 网页后台上传

后台「📦 下载」→「📤 上传文件」→ 选文件 → 填名称/版本/分类/说明。
文件存入仓库 `files/` 目录，下载走本站域名（Cloudflare CDN，国内快、不限速）。

> 受 GitHub 单文件 100MB 硬限制；仓库体积会随文件增大，请勿上传过多大文件。

### 方式二：大文件（>100MB ~ 2GB）—— 本机脚本发布到 GitHub Release

GitHub 无浏览器直传接口，超过 Cloudflare Functions 请求体上限（~100MB）的
大文件只能在本机上传（GitHub 硬限制）。需要**已经登录 gh CLI**（`gh auth status` 检查）：

```bash
node tools/publish-release.mjs dist/MyApp-Setup.exe \
  --tag v1.0.0 \
  --name "我的应用安装包" \
  --desc "Windows 安装版，支持 x64" \
  --category "软件"
```

脚本会：创建/复用 GitHub Release → 上传资产 → 登记 `data/downloads.json` → git push 自动部署。
下载链接指向 GitHub Release 资产（国内访问较慢，属 GitHub 网络限制）。

删除：网页后台「📦 下载」→ 删除（会同时删除 Release 资产）。

> 📖 完整图文教程见 [`docs/发布脚本教程.md`](docs/发布脚本教程.md)。


## 🖼 相册管理

后台「🖼 相册」页支持批量上传照片，数据存 `data/gallery.json`，图片存 `images/uploads/` 与 `images/uploads/thumbs/`。

### 上传时的图片优化

上传前会在浏览器本地压缩（不走服务器），设置项集中在「⚙️ 图片优化设置」折叠面板：

| 设置 | 说明 |
| --- | --- |
| 压缩目标 | 原图压缩后的目标体积（5120 / 3072 / 2048 / 1024 / 512 KB） |
| 压缩质量 | JPEG 质量（92% / 80% / 60%） |
| 缩略图宽度 | 网格与预览用的小图宽度（240 ~ 640 px） |
| 缩略图质量 | 缩略图 webp 质量（70% / 80% / 90%） |
| 缩略图大小 | 缩略图目标体积（不限制 / ≤100 / 50 / 30 / 20 / 10 KB） |
| 自动生成缩略图 | 关闭则只上传压缩后的原图 |

设置存于浏览器 `localStorage`（`zyf-img-settings`），每台设备各自保存。

### 重新压缩已上传的图片

相册每张卡片右上角「压缩」按钮：

- 显示原图 / 缩略图的**当前实际大小**（字节数由后端通过 git tree API 读取，非估算）
- 可选新的压缩目标、质量，以及**独立的缩略图参数**（是否重做 / 宽度 / 质量 / 目标大小）
- 弹窗里的缩略图参数会同时写回全局默认值，后续上传沿用
- 不勾选「重做缩略图」时只覆盖原图，原缩略图保持不变
- 压缩后覆盖原文件，URL 不变（无需改文章引用）

**缩略图目标大小算法**：先降质量到 50%，仍超标则按 85% 逐级缩尺寸（宽度下限 200px），最后才把质量降到 32% 兜底。

### 相册首屏速度

网格加载的是 webp 缩略图（480px 约 20KB），点击后光箱先显缩略图秒开、原图加载完成再无缝替换。

### 全屏看图（光箱）操作

点击任意照片打开全屏预览：

| 操作 | 方式 |
| --- | --- |
| 缩放 | 鼠标滚轮 / 双指捏合 / `+` `-` 键 / 工具条 `＋` `−` |
| 重置缩放 | 双击图片 / `0` 键 / 工具条 `⟲` |
| 拖动平移 | 放大后按住图片拖动（自动限制边界） |
| 查看原图 | 工具条「查看原图」（已显原图时显示「原图 ✓」） |
| 查看缩略图 | 工具条「查看缩略图」（切回小图，已显缩略图时显示「缩略图 ✓」；无缩略图时隐藏） |
| 下载原图 | 工具条 `⬇`（下载的是未压缩原图） |
| 关闭 | 点击背景空白处 / `Esc` / 右上角 `✕` |

缩放范围 50% ~ 600%，以鼠标位置为锚点；缩放状态在关闭或重新打开时自动重置。

原图 / 缩略图切换：原图首次加载后会缓存，切回时**同步零延迟**；若原图还在加载中你又主动切回缩略图，加载完成后不会抢回（尊重手动选择）。

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
