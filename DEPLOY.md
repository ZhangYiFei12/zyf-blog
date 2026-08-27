# 🚀 部署指南：GitHub + Cloudflare Pages

> 作者：张义飞  
> 项目：`zyf-blog`（Next.js 15 + TypeScript + Tailwind CSS）

---

## 目录

- [1. 前置准备](#1-前置准备)
- [2. 将代码推送到 GitHub](#2-将代码推送到-github)
- [3. Cloudflare 配置与部署](#3-cloudflare-配置与部署)
- [4. 照片上传的注意事项](#4-照片上传的注意事项)
- [5. 后续更新流程](#5-后续更新流程)
- [6. 常见问题](#6-常见问题)

---

## 1. 前置准备

### 1.1 注册账号

| 平台 | 注册地址 | 说明 |
|------|---------|------|
| **GitHub** | https://github.com/signup | 代码托管，免费 |
| **Cloudflare** | https://dash.cloudflare.com/signup | 网站部署 + CDN，免费额度足够个人站 |

### 1.2 配置 Git 用户信息

打开终端（Git Bash 或命令提示符），执行：

```bash
git config --global user.name "ZhangYiFei12"
git config --global user.email "264296445@qq.com"
```

---

## 2. 将代码推送到 GitHub

### 2.1 初始化本地仓库

```bash
cd C:\Users\Administrator\zyf-blog
git init
git add .
git commit -m "🎉 初始化个人博客"
```

### 2.2 在 GitHub 创建仓库

1. 浏览器打开 https://github.com/new
2. **Repository name** 填写：`zyf-blog`（或你喜欢的名字）
3. 选择 **Public**（公开）或 **Private**（私有）
4. **不要勾选** "Add a README"、"Add .gitignore"、"Choose a license"（项目里已有）
5. 点击 **Create repository**

### 2.3 推送代码

创建完成后，页面会显示命令，复制第二段已有仓库的推送命令，在本机执行：

```bash
git remote add origin https://github.com/ZhangYiFei12/zyf-blog.git
git branch -M main
git push -u origin main
```

> 如果提示登录，会弹出浏览器窗口，用 GitHub 账号授权即可。

---

## 3. Cloudflare 配置与部署

### 3.1 登录 Cloudflare 控制台

访问 https://dash.cloudflare.com/ 登录你的账号。

### 3.2 创建 Pages 项目

1. 左侧菜单点击 **Workers & Pages**
2. 点击 **Overview** 标签页
3. 点击 **Create** → **Pages**
4. 选择 **Connect to Git**

### 3.3 授权 GitHub

1. 如果是第一次使用，点击 **Connect GitHub**，跳转到 GitHub 授权页面
2. 点击 **Authorize Cloudflare**（建议选择 "All repositories" 或只选你刚创建的仓库）
3. 授权完成后，选择你的仓库 `ZhangYiFei12/zyf-blog`

### 3.4 配置构建设置 ⚙️

关键一步，按以下参数填写：

| 设置项 | 填写值 |
|--------|--------|
| **Project name** | `zyf-blog`（自动填充，可自定义） |
| **Production branch** | `main` |
| **Framework preset** | **不要选**（保持 None，我们手动填） |
| **Build command** | `npx opennextjs-cloudflare build` |
| **Build output directory** | `.vercel/output/static` |
| **Root directory (optional)** | 留空（项目在仓库根目录） |
| **Node.js version** | `22`（或最新 LTS） |

> ⚠️ 注意：Framework preset 不要选 Next.js，因为 Cloudflare Pages 内置的 Next.js preset 只支持静态导出。我们用的是 OpenNext 适配器，需要手动填上述命令。

### 3.5 环境变量

展开 **Environment variables (advanced)**，添加以下变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `NODE_VERSION` | `22` | 指定 Node.js 版本 |
| `NEXTJS_ENV` | `production` | Next.js 环境模式 |

### 3.6 部署 🚀

点击 **Save and Deploy**，Cloudflare 会自动：

1. 拉取你的 GitHub 代码
2. 安装依赖（`npm install`）
3. 执行构建命令（`npx opennextjs-cloudflare build`）
4. 部署到 Cloudflare 全球边缘网络

部署完成后，你会得到一个 `*.pages.dev` 域名，例如：
```
https://zyf-blog.pages.dev
```

### 3.7 绑定自定义域名（可选）

如果你有自己的域名：

1. 在 Pages 项目页面 → **Custom domains** → **Set up a custom domain**
2. 输入你的域名（例如 `blog.zhangyifei.com`）
3. Cloudflare 会自动配置 DNS 记录
4. 等待 SSL 证书生效（约 1-2 分钟）

---

## 4. 照片上传的注意事项

### 4.1 当前方案的限制

本项目的照片上传功能（`/api/upload`）在本地开发时使用**文件系统存储**（写入 `public/uploads/` 目录）。

**⚠️ 在 Cloudflare Serverless 环境下，文件系统写入是临时的**——每次部署后上传的文件会丢失，因为 Cloudflare Pages 的部署是无状态的。

### 4.2 推荐方案：改用 Cloudflare R2

R2 是 Cloudflare 的对象存储服务，有免费额度（10GB 存储 + 每月 100 万次操作），适合个人站使用。

**改造步骤：**

1. 在 Cloudflare 控制台 → **R2** → **Create bucket**，创建名为 `zyf-blog-uploads` 的存储桶
2. 将 R2 存储桶绑定到 Pages 项目：
   - 项目页面 → **Settings** → **Functions** → **R2 Buckets**
   - 添加绑定，变量名 `UPLOADS_BUCKET`，选择你创建的 R2 桶

3. 修改 `src/app/api/upload/route.ts`，改用 R2 SDK 写入：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "未找到文件" }, { status: 400 });
    }

    // 从 Cloudflare 运行时获取 R2 绑定
    const ctx = getRequestContext();
    const bucket = ctx.env.UPLOADS_BUCKET;

    const buffer = await file.arrayBuffer();
    const filename = `${crypto.randomUUID()}.${file.name.split(".").pop()}`;
    await bucket.put(filename, buffer, {
      httpMetadata: { contentType: file.type },
    });

    return NextResponse.json({
      url: `https://pub-你的公钥.r2.dev/${filename}`,
      name: file.name,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "上传失败" }, { status: 500 });
  }
}
```

> 如果暂时不急需上传功能，**可以先部署，照片上传功能在本地开发时使用**，后续再迁移到 R2。

---

## 5. 后续更新流程

### 5.1 本地修改代码

```bash
# 写新文章：在 src/content/posts/ 下新建 .md 文件
# 或修改数据：编辑 src/data/ 下的配置文件
# 或修改样式：编辑 src/app/globals.css
```

### 5.2 提交并推送（自动触发部署）

```bash
git add .
git commit -m "📝 更新内容：添加新文章 / 修改配置"
git push
```

推送后，Cloudflare Pages 会自动检测到变更，重新构建并部署。**全自动流程，无需手动操作。**

### 5.3 查看部署状态

- Cloudflare 控制台 → **Workers & Pages** → 你的项目 → **Deployments**
- 可以看到每次部署的日志、状态、预览 URL

---

## 6. 常见问题

### Q: 部署后页面 404 或空白？

**原因：** 构建输出目录或构建命令配置错误。  
**检查：** 确保 Cloudflare Pages 的构建配置与本文一致：
- Build command: `npx opennextjs-cloudflare build`
- Build output directory: `.vercel/output/static`

### Q: 部署后 API 路由（/api/upload）返回 500？

**原因：** OpenNext 在 Cloudflare 上运行 API 路由需要 `nodejs_compat` 兼容标志。  
**检查：** `wrangler.jsonc` 中是否包含 `"compatibility_flags": ["nodejs_compat"]`。

### Q: 本地 `npm run dev` 还能用吗？

**可以。** `next dev` 仍然正常工作，`opennextjs-cloudflare build` 专门用于 Cloudflare 部署。

### Q: 部署后头像/图片显示不出来？

**检查：** 图片文件是否在 `public/` 目录下，且路径正确。`next build` 或 `opennextjs-cloudflare build` 都会自动复制 `public/` 目录。

### Q: 想保留上传功能但不想用 R2？

**替代方案：** 改用第三方存储服务，如：
- Cloudinary（免费额度大，图片处理强）
- Imgur（简单免费）
- 七牛云 / 又拍云（国内速度快）

### Q: 构建日志显示 `Error: Could not resolve "@opennextjs/cloudflare/kvCache"`

**原因：** 旧版文档的 API 在新版本中已变更。  
**修复：** 确保 `open-next.config.ts` 内容为最小配置：

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";
export default defineCloudflareConfig();
```

---

## 项目文件结构（部署后）

```
zyf-blog/
├── src/                  # 源代码
├── public/               # 静态资源
├── .next/                # Next.js 构建产物（本地）
├── .open-next/           # OpenNext 构建产物（部署用，不提交）
├── .vercel/output/static # 静态资源输出（部署用，不提交）
├── wrangler.jsonc        # Cloudflare Workers 配置
├── open-next.config.ts   # OpenNext 配置
├── .dev.vars             # 本地开发环境变量（不提交）
├── public/_headers       # 缓存策略
├── package.json
└── next.config.ts
```

---

> **至此，部署配置完成！** 🎉  
> 有任何问题，随时在项目 Issues 中提出，或直接搜索 Cloudflare Pages 文档：  
> https://developers.cloudflare.com/pages/