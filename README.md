# 张义飞 · 个人博客

基于 **Next.js 15 + TypeScript + Tailwind CSS** 的个人博客网站，科技简约风格。

## ✨ 功能

- 📝 **Markdown 博客** — 在 `src/content/posts/` 添加 `.md` 文件即可发布文章
- 🚀 **项目作品** — 在 `src/data/projects.ts` 中配置
- 🏷️ **技能标签** — 在 `src/data/skills.ts` 中配置（支持熟练度进度条）
- 👤 **个人经历** — 在 `src/data/experience.ts` 中配置（时间线展示）
- 🔗 **社交媒体** — 在 `src/data/profile.ts` 中配置
- 📷 **照片上传** — 内置 `/api/upload` 接口，上传至 `public/uploads/`

## 🚀 快速开始

```bash
npm install
npm run dev
```

访问 http://localhost:3000

## 📁 目录结构

```
src/
├── app/              # 页面路由
│   ├── page.tsx      # 首页
│   ├── blog/         # 博客列表 / 详情
│   ├── projects/     # 项目作品
│   ├── about/        # 关于我
│   └── api/upload/   # 照片上传接口
├── components/       # 组件
├── data/             # 站点数据配置（改这里！）
│   ├── profile.ts    # 个人信息 / 社交链接
│   ├── projects.ts   # 项目
│   ├── skills.ts     # 技能
│   └── experience.ts # 经历
├── content/posts/    # Markdown 文章
└── lib/              # 工具函数
```

## 🛠️ 后续扩展建议

- 接入数据库（SQLite / PostgreSQL + Prisma），支持后台管理
- 添加全文搜索（Fuse.js / MiniSearch）
- 添加评论系统（Giscus / 自定义）
- 部署到 Vercel / Cloudflare Pages / 自有服务器
- 接入 `next-themes` 实现亮色主题（已内置依赖）

## 📦 生产部署

```bash
npm run build
npm start
```
