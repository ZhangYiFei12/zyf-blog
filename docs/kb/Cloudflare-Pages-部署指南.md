---
title: "Cloudflare Pages 部署指南"
category: "部署运维"
date: "2026-09-08"
excerpt: "把纯静态站点部署到 Cloudflare Pages 的完整流程与注意事项。"
tags: ["Cloudflare", "部署"]
---

# Cloudflare Pages 部署指南

## 为什么选它

- 免费额度充足，静态请求不限量
- 全球 CDN，国内访问速度可接受
- 推送到 GitHub 后自动构建部署

## 部署步骤

1. 进入 Cloudflare 控制台 → **Workers & Pages**
2. **Create** → **Pages** → **Connect to Git**
3. 选择仓库，**Build command 留空**（纯静态无需构建）
4. **Build output directory** 填 `/`
5. 保存并部署

## 环境变量

后台需要在 **Settings → Environment variables** 配置：

```
ADMIN_PASS       后台密码
SESSION_SECRET   令牌签名密钥
GITHUB_TOKEN     GitHub 细粒度 Token
```

> 注意：环境变量修改后需要重新部署才会生效。
