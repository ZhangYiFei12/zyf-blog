# 张义飞个人博客 · zhangyifei.dev

> 科技简约风格的个人博客，纯静态 HTML + CSS + JavaScript，零构建步骤，直接部署到 Cloudflare Pages。

## ✨ 特性

- 🌙 **科技简约设计**：深色背景 · 青色点缀 · 等宽字体 · 网格背景
- 📝 **博客**：`blog/` 目录下添加 HTML 文章即可
- 🚀 **项目展示**：`projects.html` 中展示个人作品
- 👤 **关于页**：个人简介 + 经历时间线 + 技能条
- 📷 **照片墙**：拖拽上传，存储在浏览器本地（IndexedDB）

## 📁 目录结构

```
├── index.html            # 首页
├── blog.html             # 博客列表
├── blog/welcome.html     # 示例文章
├── projects.html         # 项目
├── about.html            # 关于
├── photos.html           # 照片墙
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

1. 在 `blog/` 目录下新建 `xxx.html`（复制 `welcome.html` 改内容即可）
2. 在 `blog.html` 中添加列表条目（参考现有格式）
3. 在首页 `index.html` 的"最新文章"区域更新

## 📷 照片墙说明

纯静态站没有服务器，照片保存在**当前浏览器**的 IndexedDB 中（同一浏览器内持久保留，清除浏览器数据会丢失）。

## 📄 License

MIT © 张义飞 (Yifei Zhang)
