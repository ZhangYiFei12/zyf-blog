/* ============================================================
   tools/test-admin.mjs —— 后台 API 本地测试
   模拟 Pages Functions 环境 + 内存 mock GitHub API
   用法：node tools/test-admin.mjs
   ============================================================ */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// 设置测试环境变量
process.env.ADMIN_PASS = "test123";
process.env.SESSION_SECRET = "test-secret-key-1234567890";
process.env.GITHUB_TOKEN = "test-token";
process.env.GITHUB_REPO = "test/test";
process.env.GITHUB_BRANCH = "main";
process.env.GITHUB_API_BASE = "http://localhost:18999"; // mock 服务器

import { onRequest } from "../functions/api/admin.js";

// ============ 简易 mock GitHub API 服务器 ============
import http from "http";

// 内存文件系统
const files = {};
function setFile(path, content) { files[path] = content; }
function getFile(path) { return files[path] || null; }
function deleteFile(path) { delete files[path]; }
function hasFile(path) { return path in files; }

// 初始化：模拟现有仓库
const EXISTING_MD = `---
title: "📖 AI 文件阅读器 — 详细介绍与技术文档"
date: "2026-08-27"
excerpt: "AI 文件阅读器的完整技术文档：项目介绍、三层架构、核心模块详解与开发指南。"
tags: ["AI", "工具", "技术文档"]
---

# AI 文件阅读器

这是一篇测试文章。
`;

const EXISTING_HTML = "<!DOCTYPE html>...（模拟文章页）...";

const EXISTING_BLOG_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>博客 | ZH</title>
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <main class="container">
    <div class="page-head">
      <h1>博<span class="accent">客</span></h1>
      <p>记录 · 沉淀 · 分享。</p>
    </div>
    <section class="section" style="border-top:none;padding-top:0;">
      <h2 class="section-title">全部文章</h2>
      <!-- BLOG-LIST-START -->
      <a class="post-item" href="blog/详细介绍与技术文档.html">
        <div class="post-left">
          <span class="post-title">📖 AI 文件阅读器 — 详细介绍与技术文档</span>
          <span class="post-excerpt">AI 文件阅读器的完整技术文档：项目介绍、三层架构、核心模块详解与开发指南。</span>
          <div class="post-tags">
            <span class="tag">AI</span>
            <span class="tag">工具</span>
            <span class="tag">技术文档</span>
          </div>
        </div>
        <span class="post-date">2026-08-27</span>
      </a>
      <!-- BLOG-LIST-END -->
      <div class="photo-empty" style="margin-top:24px;padding:40px;">暂无更多文章 · 敬请期待</div>
    </section>
  </main>
  <footer class="footer">
    <div class="container">
      <p>© <span data-year>2025</span> 张义飞</p>
    </div>
  </footer>
</body>
</html>`;

const EXISTING_INDEX_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ZH | 个人博客</title>
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <main class="container">
    <section class="section">
      <h2 class="section-title">最新文章</h2>
      <!-- LATEST-START -->
      <a class="post-item" href="blog/详细介绍与技术文档.html">
        <div class="post-left">
          <span class="post-title">📖 AI 文件阅读器 — 详细介绍与技术文档</span>
          <span class="post-excerpt">AI 文件阅读器的完整技术文档：项目介绍、三层架构、核心模块详解与开发指南。</span>
          <div class="post-tags">
            <span class="tag">AI</span>
            <span class="tag">工具</span>
            <span class="tag">技术文档</span>
          </div>
        </div>
        <span class="post-date">2026-08-27</span>
      </a>
      <!-- LATEST-END -->
      <div class="mt-3">
        <a href="blog.html" style="color:var(--accent);font-size:13px;text-decoration:none;">→ 查看全部文章</a>
      </div>
    </section>
  </main>
</body>
</html>`;

setFile("blog/posts/详细介绍与技术文档.md", EXISTING_MD);
setFile("blog/详细介绍与技术文档.html", EXISTING_HTML);
setFile("blog.html", EXISTING_BLOG_HTML);
setFile("index.html", EXISTING_INDEX_HTML);

let commitCount = 0;
let headCommitSha = "abc123";
let treeSha = "tree123";
const blobStore = {}; // sha -> content
let blobCounter = 0;

function mockServer(req, res) {
  const url = new URL(req.url, "http://localhost:18999");
  const path = url.pathname;
  const method = req.method;

  let body = "";
  req.on("data", c => body += c);
  req.on("end", () => {
    const json = (() => { try { return JSON.parse(body); } catch(e) { return null; } })();
    const respond = (status, data) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
    const respondRaw = (status, data, ct) => { res.writeHead(status, { "Content-Type": ct || "text/plain" }); res.end(data); };

    if (path === `/repos/${process.env.GITHUB_REPO}/git/ref/heads/main` && method === "GET") {
      respond(200, { object: { sha: headCommitSha } });
    } else if (path === `/repos/${process.env.GITHUB_REPO}/git/commits/${headCommitSha}` && method === "GET") {
      respond(200, { tree: { sha: treeSha } });
    } else if (path === `/repos/${process.env.GITHUB_REPO}/git/blobs` && method === "POST") {
      const sha = "blob_" + (++blobCounter);
      blobStore[sha] = json && json.content !== undefined ? json.content : "";
      respond(201, { sha });
    } else if (path === `/repos/${process.env.GITHUB_REPO}/git/trees` && method === "POST") {
      treeSha = "newtree_" + Date.now();
      if (json && json.tree) {
        for (const t of json.tree) {
          if (t.sha === null) {
            deleteFile(t.path); // 删除
          } else if (blobStore[t.sha] !== undefined) {
            setFile(t.path, blobStore[t.sha]); // 写入/更新
          }
        }
      }
      respond(201, { sha: treeSha });
    } else if (path === `/repos/${process.env.GITHUB_REPO}/git/commits` && method === "POST") {
      headCommitSha = "commit_" + (++commitCount);
      respond(201, { sha: headCommitSha });
    } else if (path === `/repos/${process.env.GITHUB_REPO}/git/refs/heads/main` && method === "PATCH") {
      respond(200, { object: { sha: headCommitSha } });
    } else if (path === `/repos/${process.env.GITHUB_REPO}/contents/blog/posts` && method === "GET") {
      const entries = Object.keys(files).filter(k => k.startsWith("blog/posts/")).map(k => ({ name: k.replace("blog/posts/", ""), type: "file" }));
      respond(200, entries);
    } else if (path.startsWith(`/repos/${process.env.GITHUB_REPO}/contents/`) && method === "GET") {
      const filePath = path.replace(`/repos/${process.env.GITHUB_REPO}/contents/`, "");
      try {
        const decodedPath = decodeURIComponent(filePath);
        const content = getFile(decodedPath);
        if (content !== null) {
          respondRaw(200, content);
        } else {
          respond(404, { message: "Not Found" });
        }
      } catch(e) {
        respond(400, { message: "Bad path" });
      }
    } else {
      console.log("   [mock] 未匹配:", method, path);
      respond(404, { message: "Mock not found" });
    }
  });
}

const mockPort = 18999;
const mockServer_ = http.createServer(mockServer);
mockServer_.listen(mockPort, async () => {
  console.log("🧪 后台 API 测试开始\n");
  let passed = 0, failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (e) {
      console.log(`  ❌ ${name}: ${e.message}`);
      failed++;
    }
  }

  async function call(method, path, body) {
    const req = new Request(`http://localhost${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const env = {
      ADMIN_PASS: process.env.ADMIN_PASS,
      SESSION_SECRET: process.env.SESSION_SECRET,
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
      GITHUB_REPO: process.env.GITHUB_REPO,
      GITHUB_BRANCH: process.env.GITHUB_BRANCH,
      GITHUB_API_BASE: process.env.GITHUB_API_BASE,
    };
    const ctx = { request: req, env, params: {} };
    const res = await onRequest(ctx);
    const data = await res.json();
    return { status: res.status, data };
  }

  // 1. 未配置密钥时，登录应返回 500 并提示配置
  await test("未配置密钥时登录 → 500 提示", async () => {
    const req = new Request("http://localhost/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "test123" }),
    });
    const env = { ADMIN_PASS: undefined, SESSION_SECRET: undefined, GITHUB_TOKEN: undefined };
    const res = await onRequest({ request: req, env, params: {} });
    const data = await res.json();
    if (res.status !== 500) throw new Error("期望 500 但得到 " + res.status);
    if (!data.error || !data.error.includes("未配置")) throw new Error("错误信息未提示配置: " + JSON.stringify(data));
  });

  // 2. 登录 - 密码错误
  await test("密码错误 → 401", async () => {
    const r = await call("POST", "/api/admin/login", { password: "wrong" });
    if (r.status !== 401) throw new Error("期望 401 但得到 " + r.status);
  });

  // 3. 登录 - 成功
  let token = "";
  await test("登录成功 → 获得 token", async () => {
    const r = await call("POST", "/api/admin/login", { password: "test123" });
    if (r.status !== 200) throw new Error("期望 200 但得到 " + r.status);
    if (!r.data.token) throw new Error("未返回 token");
    token = r.data.token;
  });

  // 4. 无 token 访问 → 401
  await test("无 token 访问文章列表 → 401", async () => {
    const r = await call("GET", "/api/admin/articles");
    if (r.status !== 401) throw new Error("期望 401 但得到 " + r.status);
  });

  // 5. 列出文章（token 有效）
  await test("列出文章（含 token）", async () => {
    const req = new Request("http://localhost/api/admin/articles", {
      headers: { Authorization: "Bearer " + token },
    });
    const env = { ADMIN_PASS: "test123", SESSION_SECRET: "test-secret-key-1234567890", GITHUB_TOKEN: "x", GITHUB_REPO: "test/test", GITHUB_BRANCH: "main", GITHUB_API_BASE: "http://localhost:18999" };
    const res = await onRequest({ request: req, env, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200 但得到 " + res.status);
    if (!data.articles || data.articles.length !== 1) throw new Error("期望 1 篇文章但得到 " + (data.articles || []).length);
    if (data.articles[0].title !== "📖 AI 文件阅读器 — 详细介绍与技术文档") throw new Error("标题不匹配");
  });

  // 6. 预览
  await test("Markdown 预览", async () => {
    const req = new Request("http://localhost/api/admin/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ body: "# 测试标题\n\n这是一段**加粗**文字。\n\n- 列表项1\n- 列表项2" }),
    });
    const env = { ADMIN_PASS: "test123", SESSION_SECRET: "test-secret-key-1234567890", GITHUB_TOKEN: "x", GITHUB_REPO: "test/test", GITHUB_BRANCH: "main", GITHUB_API_BASE: "http://localhost:18999" };
    const res = await onRequest({ request: req, env, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200 但得到 " + res.status);
    if (!data.html || !data.html.includes("<h1>") || !data.html.includes("<strong>") || !data.html.includes("<ul>")) {
      throw new Error("预览 HTML 不完整: " + (data.html || "").slice(0, 100));
    }
  });

  // 7. 发布新文章
  let newSlug = "";
  await test("发布新文章", async () => {
    const req = new Request("http://localhost/api/admin/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ title: "测试文章", date: "2026-08-28", excerpt: "测试摘要", tags: ["测试", "单元测试"], body: "# 测试文章\n\n这是测试。\n\n- 项1\n- 项2" }),
    });
    const env = { ADMIN_PASS: "test123", SESSION_SECRET: "test-secret-key-1234567890", GITHUB_TOKEN: "x", GITHUB_REPO: "test/test", GITHUB_BRANCH: "main", GITHUB_API_BASE: "http://localhost:18999" };
    const res = await onRequest({ request: req, env, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200 但得到 " + res.status + ": " + JSON.stringify(data));
    if (!data.ok) throw new Error("未返回 ok");
    if (!data.slug) throw new Error("未返回 slug");
    newSlug = data.slug;
    // 验证：blog.html 和 index.html 应更新
    const blogHtml = getFile("blog.html");
    if (!blogHtml || !blogHtml.includes("测试文章")) throw new Error("blog.html 未更新（缺少新文章标题）");
    if (!blogHtml.includes("测试摘要")) throw new Error("blog.html 未更新（缺少摘要）");
    const indexHtml = getFile("index.html");
    if (!indexHtml || !indexHtml.includes("测试文章")) throw new Error("index.html 未更新（最新文章缺少新文章标题）");
    // 验证：blog/posts/ 中有新 .md 文件
    if (!hasFile("blog/posts/测试文章.md")) throw new Error("blog/posts/ 缺少 .md 文件");
    if (!hasFile("blog/测试文章.html")) throw new Error("blog/ 缺少 .html 文件");
  });

  // 8. 编辑文章
  await test("编辑已有文章", async () => {
    const req = new Request("http://localhost/api/admin/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ title: "测试文章（已编辑）", date: "2026-08-28", excerpt: "编辑后的摘要", tags: ["测试", "编辑"], body: "# 编辑后的内容\n\n已更新。", slug: newSlug }),
    });
    const env = { ADMIN_PASS: "test123", SESSION_SECRET: "test-secret-key-1234567890", GITHUB_TOKEN: "x", GITHUB_REPO: "test/test", GITHUB_BRANCH: "main", GITHUB_API_BASE: "http://localhost:18999" };
    const res = await onRequest({ request: req, env, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200 但得到 " + res.status);
    if (!data.ok) throw new Error("未返回 ok");
    // 验证 slug 不变
    if (data.slug !== newSlug) throw new Error("编辑后 slug 不应改变");
    // 验证 blog.html 更新
    const blogHtml = getFile("blog.html");
    if (!blogHtml || !blogHtml.includes("测试文章（已编辑）")) throw new Error("blog.html 未更新编辑后的标题");
  });

  // 9. 删除文章
  await test("删除文章", async () => {
    // 先删除新文章
    const req = new Request("http://localhost/api/admin/articles/" + newSlug, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });
    const env = { ADMIN_PASS: "test123", SESSION_SECRET: "test-secret-key-1234567890", GITHUB_TOKEN: "x", GITHUB_REPO: "test/test", GITHUB_BRANCH: "main", GITHUB_API_BASE: "http://localhost:18999" };
    const res = await onRequest({ request: req, env, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200 但得到 " + res.status);
    if (!data.ok) throw new Error("未返回 ok");
    // 验证文件已删除
    if (hasFile("blog/posts/测试文章.md")) throw new Error(".md 未删除");
    if (hasFile("blog/测试文章.html")) throw new Error(".html 未删除");
    // 验证 blog.html 不再包含新文章
    const blogHtml = getFile("blog.html");
    if (blogHtml && blogHtml.includes("测试文章（已编辑）")) throw new Error("blog.html 仍包含已删除文章");
  });

  // 10. 编辑旧文章（已存在的详细介绍与技术文档）
  await test("编辑原始文章", async () => {
    // 获取 slug
    const req = new Request("http://localhost/api/admin/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ title: "📖 AI 文件阅读器 — 详细介绍与技术文档（更新）", date: "2026-08-27", excerpt: "更新的摘要", tags: ["AI", "工具"], body: "# 更新内容\n\n已更新。", slug: "详细介绍与技术文档" }),
    });
    const env = { ADMIN_PASS: "test123", SESSION_SECRET: "test-secret-key-1234567890", GITHUB_TOKEN: "x", GITHUB_REPO: "test/test", GITHUB_BRANCH: "main", GITHUB_API_BASE: "http://localhost:18999" };
    const res = await onRequest({ request: req, env, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200 但得到 " + res.status);
    if (!data.ok) throw new Error("未返回 ok");
    // 验证 slug 不变
    if (data.slug !== "详细介绍与技术文档") throw new Error("slug 不应改变");
  });

  // 结果
  console.log(`\n🎯 结果：${passed} 通过，${failed} 失败，共 ${passed + failed} 项`);
  mockServer_.close();
  if (failed > 0) process.exit(1);
});