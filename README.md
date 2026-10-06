# ZH 个人博客 · zhangyifei.dev

> 科技简约风格的个人博客，纯静态 HTML + CSS + JavaScript，零构建步骤，直接部署到 Cloudflare Pages。

## ✨ 特性

- 🌙 **科技简约设计**：深色背景 · 青色点缀 · 等宽字体 · 网格背景
- 📝 **博客**：`blog/` 目录下添加 HTML 文章即可
- 🔐 **在线后台**：`/admin` 密码保护，浏览器里写 Markdown 发布/编辑/删除文章
- 🚀 **项目展示**：`projects.html` 中展示个人作品
- 👤 **关于页**：个人简介
- 📦 **软件下载**：`downloads.html` 发布安装包（小文件网页后台上传 / 大文件 Release 脚本）
- 🔗 **关联网站**：关于页展示推荐站点，后台增删改（`data/links.json`）
- 📚 **知识库**：`kb.html` 汇总技术文档，后台上传 Markdown 自动渲染成页面
- 🏷️ **标签页 / 归档页**：`tags/<标签>.html` 聚合页 + `archive.html` 按年归档，随文章发布自动重建
- 🔗 **相关文章 / 分享**：文章页按标签重合度推荐、一键复制链接或分享到推特/微博
- ♿ **无障碍 (a11y)**：skip-link、键盘焦点环、`aria-expanded`、ESC 关菜单，色彩对比度通过 WCAG AA
- 🔍 **站内搜索**：独立搜索页 `search.html`，命中高亮 + ↑↓/Enter/Esc 键盘导航
- 💬 **评论（giscus）**：基于 GitHub Discussions，零后端，后台可开关
- 📱 **PWA**：可安装到桌面、离线可访问（Service Worker + 离线页）
- 🖨 **打印友好**：文章可直接打印 / 存 PDF（白底黑字、附链接 URL）

## 📁 目录结构

```
├── index.html                  # 首页（"最新文章"自动同步）
├── blog.html                   # 博客列表（"全部文章"自动同步）
├── blog/详细介绍与技术文档.html # 文章页
├── blog/posts/*.md             # 文章 Markdown 源文件
├── gallery.html               # 相册
├── kb.html                    # 知识库（列表，后台自动维护）
├── kb/*.html                  # 知识库文档页（由 .md 自动生成）
├── docs/kb/*.md               # 知识库 Markdown 源文件
├── downloads.html             # 下载页
├── files/                     # 下载文件仓库（≤100MB 上传目标）
├── data/downloads.json        # 下载文件元数据
├── data/links.json            # 关联网站数据（关于页展示）
├── data/kb.json               # 知识库索引（分类/标签/正文，客户端搜索用）
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

## 📝 Markdown 渲染

博客文章与知识库文档共用一套**零依赖**的自研渲染器（`tools/md2html-core.mjs` 里的
`inline()` + `parseBody()`），不引入任何第三方 Markdown 库。

### 支持的语法

| 语法 | 说明 |
| --- | --- |
| `#` ~ `######` | 标题，自动生成 **GitHub 风格锚点 id**（emoji 会被剔除，如 `## 📌 项目概述` → `-项目概述`），hover 时出现 `#` 可复制本节链接；重复标题自动加 `-1` `-2` 后缀 |
| `**粗体**` `*斜体*` `***粗斜***` `~~删除线~~` | 支持 `**` `__` `*` `_` `~~`；`_` 不在词内生效，`snake_case` 不会被斜体 |
| `` `行内代码` `` | 内部不做任何格式解析 |
| 围栏代码块 | ``` 与 `~~~` 均可，支持语言标识（输出 `class="language-xxx"` 驱动 highlight.js），右上角自动出现复制按钮 |
| `-` / `1.` 列表 | 支持**真正的多级嵌套**（按缩进生成嵌套的 `<ul>` / `<ol>`）与续行 |
| `- [ ]` / `- [x]` | 任务列表（用 CSS 画勾选框，不产生假的表单控件） |
| 表格 | 支持列对齐（`:---` / `:---:` / `---:`）、**无前导竖线**写法、单元格内转义竖线 `\|`；外层包 `.table-wrap`，窄屏可横向滚动 |
| `>` 引用块 | 支持懒续行；空 `>` 行分段 |
| `---` | 分隔线 |
| `标题` + `===` | Setext 标题（`===` 解析为 h2；`---` 保持为分隔线） |
| `![alt](url)` | 图片；**首图不懒加载**（通常是 LCP 元素），其余自动 `loading="lazy" decoding="async"` |
| `[文字](url)` | 外链自动加 `target="_blank" rel="noopener noreferrer"`；URL 支持括号（如维基百科链接）与 `"标题"` |
| `<https://…>` 或裸 URL | 自动转成链接 |
| `<div align="center">…</div>` | 居中 / 左对齐 / 右对齐块（转成安全的 `md-align-*` 容器） |
| `<kbd>` `<br>` `<sup>` `<sub>` `<mark>` `<abbr>` 等 | 白名单行内标签直接放行 |
| `\*` `\_` `` \` `` 等 | 反斜杠转义 |
| `<!-- 注释 -->` | 直接丢弃（不会显示成文本） |

### 安全

- **两层转义**：文本走 `escapeHtml`（`& < >`），属性值走 `escapeAttr`（额外转义引号），
  `![x](y"onerror="alert(1))` 这类属性注入会被阻断
- **协议白名单**：`javascript:` / `vbscript:` / `data:` / `blob:` / `file:` 一律拦掉；
  判断前会先把 HTML 实体与不可见控制字符归一，`&#106;avascript:` 之类的绕过写法同样无效
- **标签白名单**：只放行一组安全行内标签，`<script>` / `<iframe>` 等会被转义成文本

### 暂不支持

GFM 脚注、参考式链接 `[text][ref]`、缩进式代码块（4 空格）、除 `align` 外的 HTML 块级标签。

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

### 草稿存储：绑定 KV（`DRAFTS_KV`）

草稿（未发布的新文章、以及已发布文章的待发布修改）存在**私有 Cloudflare KV**，
既不提交到公开仓库、也不生成公开 HTML，所以草稿绝不会出现在线上页面、搜索、RSS 或站点地图里。

**必须绑定，否则「存草稿」会报错**（发布不受影响，因为发布不依赖 KV）：

1. Cloudflare 控制台 → **Storage & Databases → KV** → **Create instance**
   名称随意，例如 `zyf-blog-drafts`（建议创建两个：生产 / 预览）
2. 回到 **Pages 项目 → Settings → Bindings**（部分界面叫 Functions → KV namespace bindings）
3. 添加绑定：**Variable name 必须填 `DRAFTS_KV`**，KV namespace 选刚创建的那个
4. **Production 与 Preview 两个环境都要各加一次**（预览部署也跑同一套后台代码）
5. 改完重新部署一次使其生效

> 绑定缺失时，后台「草稿箱」会直接提示需要绑定 `DRAFTS_KV`，
> 存草稿接口返回 `KV_NOT_BOUND` 与可操作的错误说明，不会静默失败。

#### 已实测的行为差异（重要）

| 操作 | 一致性 |
| --- | --- |
| 单键 `get` | **立即一致**（写入后马上能读到） |
| `list()` | **最终一致**，新写入的 key 实测约 **10~30 秒**后才出现在列表里 |

后果：如果自动保存后直接用服务端列表重绘草稿箱，**刚保存的草稿会在界面上“消失”十几秒**。
因此前端在 `js/admin.js` 里维护了一份本地权威视图（`draftsCache`）：
保存成功后立即本地插入并重绘，服务端列表只用来**合并**（而非覆盖）；
删除时记下时间戳（`draftsDeleted`），在 60 秒内屏蔽 `list()` 返回的过期残留，
避免已删草稿被旧数据带回来。

> 这也意味着：草稿箱列表偶尔比 KV 实际内容略滞后是正常现象，刷新页面即可。

本地调试：把 KV 的 id 写进 `wrangler.toml` 后运行 `npx wrangler pages dev`；
不想配本地 KV 也没关系，`node tools/test-admin.mjs` 内置了内存 KV mock，能完整跑通草稿逻辑。

### 草稿行为约定

| 操作 | 结果 |
| --- | --- |
| 新建文章 →「存草稿」 | 只写 KV；不生成 HTML、不提交仓库、不进搜索/RSS/sitemap |
| 编辑**已发布**文章 →「存草稿」 | 仓库里的旧版**原封不动**，线上继续展示旧版；草稿在后台标注「待发布修改」 |
| 停止输入 5 秒 | 自动保存到 KV，状态栏显示「保存中… / ✓ 已保存 HH:MM / ✗ 保存失败」 |
| 重新登录后台 | 草稿箱会列出所有草稿，点「继续编辑」即可恢复 |
| 点「发布」 | 先完成 GitHub 提交；**提交成功后才删除草稿** |
| 发布失败 | 内容保留在 KV 草稿里并报错，可稍后重试，不会丢稿 |
| 删除已发布文章 | 同名草稿一并清理 |
| 预览 | 未发布内容走已认证的 `/api/admin/preview`，在新窗口本地渲染（带 `noindex`），不写任何公开文件 |

> ⚠️ **历史遗留限制**：在引入 KV 之前，后台「存草稿」是把草稿当成普通提交写进公开仓库的。
> 那些提交仍在 git 历史里，**删除文件不会清除历史**，任何人克隆仓库都能检出当时的明文草稿。
> 本仓库的历史草稿已确认（`解忧杂货店`、`第三梯队草稿测试`）；当前仓库已不包含它们，
> 线上也不再可访问。如需彻底清理，只能改写 git 历史（`git filter-repo`）并强推，
> 这会改变所有提交 SHA，属于破坏性操作，需自行权衡。

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
- 文章与知识库的增删改都会同步重建 `data/search-all.json`（独立搜索页的数据源），搜索结果不会滞后
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


## 📚 知识库

导航栏「知识库」（`kb.html`）汇总技术文档／学习笔记，文档页在 `kb/*.html`，
Markdown 源文件存 `docs/kb/*.md`，由后台「📚 知识库」页管理。

### 后台上传 Markdown

后台「📚 知识库」→「📄 上传 Markdown（可多选）」：

- **支持一次选多个文件批量导入**，读取文件原文后一次性提交
- 标题 / 分类 / 日期 / 简介 / 标签优先取文件内的 **front matter**；没有 front matter 时从首行推标题
- 导入时会弹出确认框显示文件数，避免误操作
- 文件名会转成 URL slug；**slug 冲突会自动加序号**（如 `xxx-2`）
- 也可以不用上传，直接在左侧表单编写（带实时预览）

### Markdown 格式

```markdown
---
title: "Git 常用命令速查"
category: "开发工具"
date: "2026-09-10"
excerpt: "日常工作最常用的 Git 命令。"
tags: ["Git", "速查"]
---

# Git 常用命令速查

正文用标准 Markdown（支持代码高亮、表格、列表、引用），完整语法见
[📝 Markdown 渲染](#-markdown-渲染)。
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `title` | 是 | 文档标题（缺省时取首行） |
| `category` | 否 | 分类，列表按此分组，默认「未分类」 |
| `date` | 否 | 日期，默认今天 |
| `excerpt` | 否 | 简介，显示在列表卡片 |
| `tags` | 否 | 标签，显示在文档页 |

### 知识库页面

- **列表页**（`kb.html`）：按分类分组，带分类筛选条 + **全文搜索**（搜索标题/分类/简介/正文）
- **文档页**（`kb/<slug>.html`）：面包屑（知识库 / 分类）、自动生成目录 TOC、代码高亮、阅读进度条
- 后台支持**编辑**（改标题/正文/分类，slug 不变）与**删除**（二次确认）
- 知识库页面同时进 `sitemap.xml`

### 与「博客」的区别

| | 博客 | 知识库 |
| --- | --- | --- |
| 定位 | 成篇的文章、随笔 | 速查表、技术文档、资料归档 |
| 目录 | `blog/posts/*.md` | `docs/kb/*.md` |
| 组织 | 按日期时间线 | 按**分类**分组 |
| 索引 | `data/search-index.json` | `data/kb.json` |

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
- 压缩后**覆盖原文件**（仓库里路径不变），但会给 URL 打上**新的版本号** `?v=...`

> **为什么要加版本号**：`_headers` 把 `/images/*` 设为 `immutable`（一年长缓存），
> Service Worker 对图片也是缓存优先。如果 URL 不变，新旧浏览器会一直用缓存里的旧图，
> 看不到压缩效果。加上 `?v=<时间戳>` 后 URL 变化 → 缓存未命中 → 立刻拉新图，
> 同时仓库里的文件路径与文章引用方式都不变。
> `gallery.json` 中的 `url` / `thumbUrl` 会写入新版本号，
> 后端内部换算仓库路径时（`thumbRelPath`）会自动剥掉查询串，不会把 `?v=` 当成文件名。

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

## 🔍 SEO 与无障碍

### 结构化数据

所有文章页 / 知识库页自动注入两层 JSON-LD：

- `BlogPosting`：标题、摘要、发布日期、作者、发布者、封面图
- `BreadcrumbList`：首页 › 博客 › 当前文章

同时每页都有 `<link rel="canonical">`，避免带参 URL 与 `/index.html` 产生重复内容。

### 无障碍（a11y）

| 能力 | 说明 |
| --- | --- |
| `skip-link` | 键盘用户按 Tab 首个可聚焦元素，回车直达 `#mainContent` |
| 焦点可见 | `:focus-visible` 统一青色描边；鼠标点击不显焦点框 |
| 移动菜单 | `aria-expanded` / `aria-controls` 同步；支持 ESC 关闭并回焦 |
| 减少动画 | 全站尊重 `prefers-reduced-motion` |
| 色彩对比度 | 深浅两套主题的文字对比度均 ≥ 4.5:1（WCAG AA） |

### 主题

首访跟随系统 `prefers-color-scheme`；用户手动切换后以 `localStorage` 为准，
且系统主题变化不再覆盖用户选择（仅在用户未选择时实时跟随）。

## 🏷️ 标签页与归档页

这两个页面由文章自动派生，**无需手工维护**：

| 页面 | 路径 | 生成时机 |
| --- | --- | --- |
| 标签聚合页 | `tags/<标签>.html` | 发布/编辑/删除文章时 |
| 归档页 | `archive.html` | 发布/编辑/删除文章时 |

- 标签页按标签聚合文章，写入 `sitemap.xml`；某标签下文章清零时**自动删除**该页（不留死链）
- 归档页按年份倒序分组，组内按日期倒序
- 本地批量重建：`node tools/gen-pages.mjs`

### 相关文章与分享

文章页底部（标签重合度 > 0 时）：

- **相关文章**：客户端读 `data/search-index.json`，按标签重合度排序取前 4 篇
- **分享**：一键复制链接；推特 / 微博；支持 Web Share API 的浏览器额外显示「系统分享」

## 🔍 站内搜索

导航栏右侧 🔍 进入 `search.html`（搜索页为 `noindex`，不进搜索引擎）。

- 数据源：`data/search-all.json`（文章 + 知识库文档合并，含标题/标签/分类/正文）
- **命中高亮**：标题、标签、摘要中的关键词用 `<mark>` 标出（先转义再包裹，防 XSS）
- **键盘导航**：`↑` `↓` 选择、`Enter` 打开、`Esc` 清空
- **权重排序**：标题完全匹配 > 标题包含 > 标签 > 分类 > 正文
- 支持 `search.html?q=关键词` 分享链接
- 博客列表页的内嵌搜索同样支持命中高亮（无关键词时还原原文）

## 💬 评论（giscus）

giscus 基于 GitHub Discussions，无需自建后端。配置存 `data/site.json`，由后台「⚙️ 站点」管理。

### 首次配置

1. 仓库开启 **Discussions**（Settings → Features → Discussions）
2. 用 `Announcements` 类型的分类（仅维护者能新建讨论，giscus 会代为创建）
3. 到 [giscus.app](https://giscus.app/zh-CN) 生成配置，把 `repoId` 与 `categoryId` 填入后台

当前配置：

| 项 | 值 |
| --- | --- |
| repo | `ZhangYiFei12/zyf-blog` |
| repoId | `R_kgDOUFjQGA` |
| category | `Announcements` |
| categoryId | `DIC_kwDOUFjQGM4DG-7c` |
| mapping | `pathname`（每篇文章一个讨论） |

### 行为

- 前台仅在 `#comments` 容器存在且配置完整时注入 giscus 脚本；**关闭时零请求**
- 评论主题跟随站点深浅色（切换主题时通过 postMessage 同步）
- 未登录 GitHub 的读者只能阅读评论，不能发表

## 📱 PWA / 离线

| 文件 | 作用 |
| --- | --- |
| `manifest.json` | 应用名/图标/主题色，由 `data/site.json` 派生 |
| `sw.js` | Service Worker（**必须放根目录**，放 `/js/` 会被 immutable 规则锁死） |
| `offline.html` | 离线时的回退页 |
| `images/icon.svg` | 矢量图标（manifest 用 `sizes: any`） |

缓存策略：

| 资源 | 策略 |
| --- | --- |
| HTML / `data/*` | 网络优先（保证内容最新），离线回退缓存 |
| `/css/` `/js/` `/images/` | 缓存优先（这些资源带 `?v=` 版本号，内容不可变） |
| 导航请求离线 | 回退 `offline.html` |

> 改动 CSS/JS 时必须递增 `tools/md2html-core.mjs` 里的 `ASSET_VER`，否则用户会因 immutable 缓存看到旧样式。

## 🖨 打印 / 存 PDF

文章页已适配 `@media print`：隐藏导航/页脚/目录/评论区/分享按钮，正文转为白底黑字，代码块与引用改为浅底细框，外链后自动附上 URL，并设置了 `@page` 页边距与分页控制。

## 🔗 关联网站管理

关于页（`about.html`）简介下方会展示「关联网站」卡片区，数据来自 `data/links.json`，由后台「🔗 关联」页管理。

### 后台操作

后台「🔗 关联」→ 填写表单 →「➕ 添加关联」：

| 字段 | 说明 |
| --- | --- |
| 网站名称 * | 卡片标题（必填） |
| 网站地址 * | 目标网址，**必须以 `http://` 或 `https://` 开头**（必填） |
| 简介 | 一句话说明，显示在名称下方 |
| 图标地址 | 留空则自动取网站 favicon（Google 公共 favicon 服务），失败时降级为名称首字母 |
| 排序 | 数字，越小越靠前 |
| 在关于页显示 | 取消勾选 = 仅后台可见（不上前台） |

每张卡片显示：图标 · 名称 · 简介 · 域名，点击新标签页打开目标网站（`target="_blank" rel="noopener noreferrer"`）。

### 前端行为

- 卡片按「排序」升序排列，隐藏项不渲染
- 列表为空（或无可见项）时，整个「关联网站」区自动隐藏
- 读取失败静默处理，不影响页面其余部分
- 主题适配深浅色，小屏（≤560px）单列

## ⚙️ 站点设置与运维

后台「⚙️ 站点」tab 集中了五项：

### 站点信息与社交链接

站点名/全称/描述/地址/作者存 `data/site.json`，用于派生 `manifest.json` 与 RSS；
社交链接（名称/网址/图标）由前台客户端渲染到首页与关于页的 `[data-socials]` 容器，
改完无需重新构建页面。

### 评论设置

giscus 开关与配置（见上方「评论」章节）。启用时校验 `repoId` / `categoryId` 必填。

### 部署状态

读取最近 5 次提交及其构建状态（Cloudflare Pages 会回写提交状态），
显示 `✅ 部署成功` / `⏳ 构建中` / `❌ 部署失败`，不用再去控制台看。

### 数据备份导出

一键导出全部内容为单个 JSON：

```json
{
  "exportedAt": "...", "repo": "...", "branch": "main",
  "site": { ... }, "counts": { "articles": 7, "gallery": 44, ... },
  "articles": [{ "slug", "name", "meta", "markdown" }],   // 含 .md 原文
  "projects": [...], "gallery": [...], "downloads": [...], "links": [...], "kb": [...]
}
```

文章与知识库带 `.md` 原文，以便完整恢复；图片本身仍以仓库 `images/uploads/` 为准。

### 写作便利

- **粘贴/拖拽上传**：在后台正文框直接粘贴截图，或把图片文件拖进去，自动压缩上传并插入 Markdown
- **草稿预览链接**：文章列表每行有「预览」新窗口打开渲染页（草稿只能通过这个直链看到）
- **相册说明编辑**：相册卡片 🏷️ 按钮可改 caption 与日期（仅改 `gallery.json`，不动图片）

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
- `tools/gen-pages.mjs` —— 批量重建派生页面（标签页 / 归档页 / kb.html / sitemap / RSS / 索引）
- `tools/check-integrity.mjs` —— 仓库完整性检查（孤儿图 / 缺失图 / 死链 / 体积不一致），有问题时退出码为 1
- `tools/test-admin.mjs` —— 后台 API 自测（`node tools/test-admin.mjs`）
- `tools/test-frontend.mjs` —— 前端回归测试（纯函数 + 生成产物 + 渲染断言，需先启动 dev-server）
- `tools/rebuild-search-all.mjs` —— 从**远端仓库当前状态**重建 `data/search-all.json`
  （后台增删改已自动同步；这个工具用于修复历史欠账，本地仓库落后时也能用，
  加 `--dry` 只看结果不提交）
- `tools/push-via-api.mjs` —— github.com git 协议不通时，用 `gh api` 手动构建 commit 推送

### 提交前自检

```bash
node tools/dev-server.mjs &          # 前端测试需要
node tools/check-integrity.mjs       # 资源完整性（死链/孤儿图）
node tools/test-admin.mjs            # 后台 API（61 项）
node tools/test-frontend.mjs         # 前端（68 项）
node tools/gen-pages.mjs             # 重建派生页面
```

## 📄 License

MIT © ZH
