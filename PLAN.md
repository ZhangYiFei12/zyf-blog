# PLAN — 加密后台：浏览器写文章并发布（✅ 已实现）

> 此计划已全部实现，对应 commit 包含 `functions/api/admin.js` / `admin.html` / `js/admin.js` / `tools/md2html-core.mjs`。

## Context（为什么做这个）

现状：博客是纯静态站（零构建、无服务器），发文章流程 = 本地写 `.md` → `node tools/md2html.mjs` → 粘贴片段到 `blog.html` → `git push` → Cloudflare 自动部署。

需求：在浏览器里用**密码加密的后台**写文章并一键发布，不再依赖本地命令行。

约束：静态站没有传统服务器，但 Cloudflare Pages 支持 **Pages Functions（边缘无服务器函数）**，可与静态文件共存、读取加密密钥、调用 GitHub API 提交代码，提交后触发已有自动部署 → 文章上线。

## ✅ 已确认决策（用户"都要"）

1. **发布方式**：GitHub API 提交 → 触发 Cloudflare 自动部署，等约 30s~1min 生效 ✅
2. **后台地址**：隐藏路径 `/admin`（不进导航栏）✅
3. **功能范围**：写新文章 + 编辑已有文章 + 删除文章 ✅
4. **密钥**：用户手动在 Cloudflare 控制台设置（密码 + GitHub Token），代码里不出现 ✅
5. **首页同步**：发布时自动更新首页"最新文章" ✅
6. **实时预览**：要，且预览用同一个转换器（保证预览=最终效果）✅

## Approach（推荐方案）

**Cloudflare Pages Functions + GitHub API + 自动部署**

```
浏览器 /admin.html（登录+编辑器+管理）
   │ HTTPS
   ▼
Cloudflare Pages
   ├─ 静态页面：/admin.html + /js/admin.js（后台 UI，不进导航栏）
   └─ /functions/api/admin.js（边缘函数 = 后台 API）
        ├─ POST /api/admin/login              → 校验密码 → 签发 HMAC 令牌
        ├─ GET  /api/admin/articles           → 列出已有文章（读 GitHub posts/）
        ├─ GET  /api/admin/articles/:slug     → 取单篇 .md 原文（供编辑回填）
        ├─ POST /api/admin/articles           → 新建/编辑：渲染+更新列表+提交
        ├─ POST /api/admin/preview            → 服务器端渲染预览（同一转换器）
        └─ DELETE /api/admin/articles/:slug   → 删除文章+提交
   Secrets（Cloudflare Pages 环境变量，加密存储，不进代码）:
        ADMIN_PASS     后台密码
        SESSION_SECRET 令牌签名密钥（HMAC-SHA256）
        GITHUB_TOKEN   只对该仓库有 contents 读写权限的 Token
   GitHub API（服务端调用，Token 永不进客户端）
        └─ 单次原子 commit：blog/posts/<slug>.md + blog/<slug>.html + blog.html + index.html
   → push 事件 → Cloudflare 自动重新部署 → 文章上线（约 30s~1min）
```

### 列表自动更新机制（关键设计）

不再手改列表，改为**标记区间整体重生成**：

- `blog.html` 文章区加标记 `<!-- BLOG-LIST-START --> ... <!-- BLOG-LIST-END -->`
- `index.html` 最新文章区加标记 `<!-- LATEST-START --> ... <!-- LATEST-END -->`
- 发布/编辑/删除时，后台函数读取 `blog/posts/*.md` 全部文章 → 解析 front matter → 按日期倒序 → 用 `listItemSnippet()` 重生成区间内容 → 覆盖写回
- 好处：天然支持新增/编辑/删除，不会出现手改残留；文章列表与 posts/ 目录永远一致

### GitHub 原子提交流程（单 commit）

1. `GET /repos/{repo}/git/ref/heads/main` → 当前 commit sha
2. `GET /repos/{repo}/git/commits/{sha}` → 当前 tree sha
3. 对每个变更文件 `POST /repos/{repo}/git/blobs`（utf-8）→ blob sha
4. `POST /repos/{repo}/git/trees`（base_tree + tree 数组）→ 新 tree sha
5. `POST /repos/{repo}/git/commits`（message + parents）→ 新 commit sha
6. `PATCH /repos/{repo}/git/refs/heads/main` → 更新分支

### 认证设计

- `POST /login`：密码与 `ADMIN_PASS` 恒定时间比较 → 签发 `{sub, exp(12h)}` HMAC-SHA256 签名令牌（base64url）
- 中间件：`/api/admin/*` 除 `/login` 外全部验签 + 检查过期
- 客户端：token 存 `sessionStorage`，请求带 `Authorization: Bearer <token>`
- 未登录/错令牌 → 401；错误密码 → 401

### 文章 slug

- 由标题自动生成（`slugify`），中文保留（与现有"详细介绍与技术文档"一致）；编辑时用 URL 中的现有 slug
- 后台 UI 允许手动改 slug（编辑时可见）

## Files（要改/新增的文件）

| 文件 | 作用 |
|------|------|
| `tools/md2html-core.mjs` | **新增**：抽出的纯函数核心（parseFrontMatter/escapeHtml/inline/parseBody/buildPage/slugify/listItemSnippet/renderMarkdown），无 Node 依赖，CLI 与函数共用 |
| `tools/md2html.mjs` | **改**：改为 import 核心，行为不变（回归验证） |
| `functions/api/admin.js` | **新增**：后台 API（登录/列表/预览/发布/编辑/删除 + HMAC 认证 + GitHub 提交） |
| `admin.html` | **新增**：后台界面（登录 → 编辑器/文章管理），复用 css/style.css，样式内联在页内 |
| `js/admin.js` | **新增**：后台交互（登录、编辑器、实时预览防抖、发布/编辑/删除、列表） |
| `blog.html` | **改**：加 `BLOG-LIST-START/END` 标记 |
| `index.html` | **改**：加 `LATEST-START/END` 标记 |
| `README.md` | **改**：后台使用说明 + 密钥配置步骤 |

## Reuse（复用现有代码）

- `tools/md2html.mjs` 全部纯函数 → `md2html-core.mjs`（唯一渲染来源）
- `blog.html`/`index.html` 现有条目结构（`listItemSnippet` 输出与现有一致）
- `css/style.css` 的变量（--accent/--bg-card/--border/--mono 等）+ `.card`/`.tag` 类做后台界面
- 现有 Cloudflare 自动部署（push → deploy）无需改动

## Steps（实施清单）

- [ ] 1. 建 `tools/md2html-core.mjs`（从 md2html.mjs 抽出纯函数，无 fs/path）
- [ ] 2. 改 `tools/md2html.mjs` import 核心 → `node tools/md2html.mjs blog/posts/详细介绍与技术文档.md` 回归，diff 确认输出不变
- [ ] 3. `blog.html`/`index.html` 加标记区间
- [ ] 4. 写 `functions/api/admin.js`：认证 + GitHub 原子提交 + 列表重生成 + 预览
- [ ] 5. 写 `admin.html` + `js/admin.js`
- [ ] 6. 本地测试：无 npm 环境则写 Node 测试台 mock Pages Functions context + mock GitHub API，跑通登录/发布/列表/编辑/删除/预览
- [ ] 7. git commit + push → Cloudflare 自动部署（此时 functions 生效）
- [ ] 8. 引导用户：Cloudflare 控制台设置 3 个密钥（ADMIN_PASS/SESSION_SECRET/GITHUB_TOKEN）+ 创建 GitHub fine-grained Token（contents: write 仅本仓库）
- [ ] 9. 端到端验证：真实发布一篇测试文章 → 等部署 → 检查 /blog、/、/blog/<slug>.html、/admin
- [ ] 10. README 更新后台使用说明

## Verification（如何验证）

- 本地：Node 测试台跑通全部 API 路径（登录/鉴权 401/列表/预览/发布生成 HTML 与列表/编辑/删除）
- 回归：CLI 工具生成结果与拆分前 diff 一致
- 线上：发布测试文章 → Cloudflare 部署后 `/blog/<slug>.html`、`/blog`（列表含新文）、`/`（最新文章更新）均正确
- 安全：无 token 访问 API → 401；错密码 → 401；前端代码/网络响应中无 GITHUB_TOKEN、无 ADMIN_PASS
