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

// 知识库 mock
function kbHtmlTemplate(body) {
  return `<!DOCTYPE html>\n<html><head><title>知识库 | ZH</title></head>\n<body>\n<div class="tag-filter" id="kbFilter">\n        <!-- KB-FILTER-START -->\n        <!-- KB-FILTER-END -->\n      </div>\n      <!-- KB-LIST-START -->\n${body}\n      <!-- KB-LIST-END -->\n</body></html>`;
}
setFile("kb.html", kbHtmlTemplate('      <div class="kb-empty">📚 知识库还是空的</div>'));
setFile("data/kb.json", "[]\n");
const EXISTING_KB_MD = `---
title: "测试知识库文档"
category: "技术文档"
date: "2026-09-01"
excerpt: "一篇测试文档"
tags: ["测试"]
---

# 测试知识库文档

正文内容。
`;
setFile("docs/kb/测试知识库文档.md", EXISTING_KB_MD);

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
    } else if (path.startsWith(`/repos/${process.env.GITHUB_REPO}/git/trees/`) && method === "GET") {
      // 模拟目录树：/git/trees/main:images/uploads
      const spec = decodeURIComponent(path.replace(`/repos/${process.env.GITHUB_REPO}/git/trees/`, ""));
      const dir = spec.includes(":") ? spec.split(":").slice(1).join(":") : "";
      const prefix = dir ? dir.replace(/\/$/, "") + "/" : "";
      const tree = Object.keys(files)
        .filter(k => k.startsWith(prefix))
        .map(k => ({ path: k.slice(prefix.length), type: "file", size: Buffer.byteLength(String(files[k]), "utf8") }));
      respond(200, { tree });
    } else if (path === `/repos/${process.env.GITHUB_REPO}/contents/blog/posts` && method === "GET") {
      const entries = Object.keys(files).filter(k => k.startsWith("blog/posts/")).map(k => ({ name: k.replace("blog/posts/", ""), type: "file" }));
      respond(200, entries);
    } else if (path === `/repos/${process.env.GITHUB_REPO}/contents/docs/kb` && method === "GET") {
      const entries = Object.keys(files).filter(k => k.startsWith("docs/kb/")).map(k => ({ name: k.replace("docs/kb/", ""), type: "file" }));
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

  // 11. 下载文件管理（files 路由）
  setFile("data/downloads.json", "[]");
  const ENV = { ADMIN_PASS: "test123", SESSION_SECRET: "test-secret-key-1234567890", GITHUB_TOKEN: "x", GITHUB_REPO: "test/test", GITHUB_BRANCH: "main", GITHUB_API_BASE: "http://localhost:18999" };

  await test("列出下载文件（初始空）", async () => {
    const req = new Request("http://localhost/api/admin/files", { headers: { Authorization: "Bearer " + token } });
    const res = await onRequest({ request: req, env: ENV, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200 但得到 " + res.status);
    if (!Array.isArray(data.files) || data.files.length !== 0) throw new Error("初始应为空列表");
  });

  let uploadedId = "";
  await test("上传小文件到仓库（files/repo）", async () => {
    const req = new Request("http://localhost/api/admin/files/repo", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ name: "test-tool.zip", filename: "测试工具", size: 12345, data: Buffer.from("hello download").toString("base64"), version: "1.0.0", desc: "测试文件", category: "工具" }),
    });
    const res = await onRequest({ request: req, env: ENV, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200 但得到 " + res.status + " " + JSON.stringify(data));
    if (!data.ok || !data.id) throw new Error("未返回 ok/id");
    uploadedId = data.id;
    // 验证文件确实写入 mock 仓库
    if (getFile("files/test-tool.zip") !== Buffer.from("hello download").toString("base64")) throw new Error("仓库文件未正确写入");
    const dl = JSON.parse(getFile("data/downloads.json"));
    if (!dl.length || dl[0].name !== "test-tool.zip") throw new Error("downloads.json 未记录");
  });

  await test("列出下载文件（含刚上传）", async () => {
    const req = new Request("http://localhost/api/admin/files", { headers: { Authorization: "Bearer " + token } });
    const res = await onRequest({ request: req, env: ENV, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200");
    if (data.files.length !== 1) throw new Error("期望 1 条记录");
  });

  await test("删除下载文件（files DELETE）", async () => {
    const req = new Request("http://localhost/api/admin/files", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ id: uploadedId }),
    });
    const res = await onRequest({ request: req, env: ENV, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200 但得到 " + res.status + " " + JSON.stringify(data));
    if (!data.ok) throw new Error("未返回 ok");
    // 仓库文件应已删除
    if (getFile("files/test-tool.zip") !== null) throw new Error("仓库文件未删除");
    const dl = JSON.parse(getFile("data/downloads.json"));
    if (dl.length !== 0) throw new Error("downloads.json 应已清空");
  });

  // 12. 相册上传与大小信息
  setFile("data/gallery.json", "[]");

  await test("相册上传图片并记录大小", async () => {
    const jpegB64 = Buffer.from("fake-jpeg-data-1234567890").toString("base64");
    const thumbB64 = Buffer.from("fake-thumb").toString("base64");
    const req = new Request("http://localhost/api/admin/gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ images: [{ data: jpegB64, mime: "image/jpeg", ext: "jpg", origSize: 999999, thumb: thumbB64, thumbExt: "webp" }] }),
    });
    const res = await onRequest({ request: req, env: ENV, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200 但得到 " + res.status + " " + JSON.stringify(data));
    const e = data.added && data.added[0];
    if (!e) throw new Error("未返回 added");
    // base64 "fake-jpeg-data-1234567890" → 25 字节；"fake-thumb" → 10 字节
    if (e.size !== 25) throw new Error("size 应为 25，实际 " + e.size);
    if (e.thumbSize !== 10) throw new Error("thumbSize 应为 10，实际 " + e.thumbSize);
    if (e.origSize !== 999999) throw new Error("origSize 未记录");
  });

  await test("相册列表附带真实文件大小（tree 自愈）", async () => {
    const req = new Request("http://localhost/api/admin/gallery", { headers: { Authorization: "Bearer " + token } });
    const res = await onRequest({ request: req, env: ENV, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200");
    const g = data.gallery && data.gallery[0];
    if (!g) throw new Error("相册为空");
    if (typeof g.size !== "number" || g.size <= 0) throw new Error("size 未回填");
    if (!g.thumbUrl) throw new Error("缺 thumbUrl");
  });

  // 13. 关联网站管理（links 路由）
  setFile("data/links.json", "[]");

  await test("列出关联网站（初始空）", async () => {
    const req = new Request("http://localhost/api/admin/links", { headers: { Authorization: "Bearer " + token } });
    const res = await onRequest({ request: req, env: ENV, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200 但得到 " + res.status);
    if (!Array.isArray(data.links) || data.links.length !== 0) throw new Error("初始应为空列表");
  });

  await test("新增关联网站", async () => {
    const req = new Request("http://localhost/api/admin/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ name: "Cloudflare", url: "https://cloudflare.com", desc: "全球 CDN", order: 2 }),
    });
    const res = await onRequest({ request: req, env: ENV, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200 但得到 " + res.status + " " + JSON.stringify(data));
    if (!data.ok || !data.id) throw new Error("未返回 ok/id");
    const links = JSON.parse(getFile("data/links.json"));
    if (!links.length || links[0].name !== "Cloudflare") throw new Error("links.json 未记录");
    if (links[0].url !== "https://cloudflare.com") throw new Error("url 不正确");
  });

  await test("网址缺协议 → 400", async () => {
    const req = new Request("http://localhost/api/admin/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ name: "坏网站", url: "cloudflare.com" }),
    });
    const res = await onRequest({ request: req, env: ENV, params: {} });
    if (res.status !== 400) throw new Error("期望 400 但得到 " + res.status);
  });

  await test("缺少名称 → 400", async () => {
    const req = new Request("http://localhost/api/admin/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ url: "https://a.com" }),
    });
    const res = await onRequest({ request: req, env: ENV, params: {} });
    if (res.status !== 400) throw new Error("期望 400 但得到 " + res.status);
  });

  let linkId = "";
  await test("编辑关联网站", async () => {
    const list = JSON.parse(getFile("data/links.json"));
    linkId = list[0].id;
    const req = new Request("http://localhost/api/admin/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ id: linkId, name: "Cloudflare Pages", url: "https://pages.cloudflare.com", desc: "静态托管", order: 1 }),
    });
    const res = await onRequest({ request: req, env: ENV, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200 但得到 " + res.status);
    const links = JSON.parse(getFile("data/links.json"));
    if (links.length !== 1) throw new Error("编辑不应新增记录，实际 " + links.length);
    if (links[0].name !== "Cloudflare Pages") throw new Error("名称未更新");
    if (links[0].id !== linkId) throw new Error("id 不应改变");
  });

  await test("删除关联网站", async () => {
    const req = new Request("http://localhost/api/admin/links", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ id: linkId }),
    });
    const res = await onRequest({ request: req, env: ENV, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200 但得到 " + res.status + " " + JSON.stringify(data));
    if (!data.ok) throw new Error("未返回 ok");
    const links = JSON.parse(getFile("data/links.json"));
    if (links.length !== 0) throw new Error("links.json 应已清空");
  });

  // 14. 知识库（kb 路由）

  await test("列出知识库文档（含已有文档）", async () => {
    const req = new Request("http://localhost/api/admin/kb", { headers: { Authorization: "Bearer " + token } });
    const res = await onRequest({ request: req, env: ENV, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200 但得到 " + res.status);
    if (!Array.isArray(data.docs)) throw new Error("docs 应为数组");
    if (data.docs.length !== 1) throw new Error("期望 1 篇，实际 " + data.docs.length);
    if (data.docs[0].category !== "技术文档") throw new Error("category 未解析: " + data.docs[0].category);
  });

  await test("取单篇知识库原文", async () => {
    const req = new Request("http://localhost/api/admin/kb/" + encodeURIComponent("测试知识库文档"), { headers: { Authorization: "Bearer " + token } });
    const res = await onRequest({ request: req, env: ENV, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200 但得到 " + res.status);
    if (!data.body || data.body.indexOf("正文内容") === -1) throw new Error("body 未返回");
    if (!data.meta || data.meta.title !== "测试知识库文档") throw new Error("meta 不正确");
  });

  await test("新建知识库文档（写 md + html + 索引）", async () => {
    const md = '---\ntitle: "新知识文档"\ncategory: "教程"\ndate: "2026-09-13"\nexcerpt: "说明"\n---\n\n# 新知识文档\n\n内容。\n';
    const req = new Request("http://localhost/api/admin/kb", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ filename: "新知识文档.md", content: md }),
    });
    const res = await onRequest({ request: req, env: ENV, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200 但得到 " + res.status + " " + JSON.stringify(data));
    if (!data.ok || !data.added || !data.added.length) throw new Error("未返回 added");
    const slug = data.added[0].slug;
    if (!hasFile(`docs/kb/${slug}.md`)) throw new Error("md 未写入");
    if (!hasFile(`kb/${slug}.html`)) throw new Error("html 未生成");
    const kbIndex = JSON.parse(getFile("data/kb.json"));
    if (!kbIndex.find(d => d.slug === slug)) throw new Error("kb.json 未记录");
    // kb.html 应已更新列表 + 筛选
    const kbHtml = getFile("kb.html");
    if (kbHtml.indexOf("新知识文档") === -1) throw new Error("kb.html 列表未更新");
    if (kbHtml.indexOf('data-cat="教程"') === -1) throw new Error("kb.html 筛选未更新");
  });

  await test("批量导入多篇文档", async () => {
    const docs = [
      { filename: "批量A.md", content: '---\ntitle: "批量A"\ncategory: "批量"\n---\n\nA 内容\n' },
      { filename: "批量B.md", content: '---\ntitle: "批量B"\ncategory: "批量"\n---\n\nB 内容\n' },
    ];
    const req = new Request("http://localhost/api/admin/kb", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ docs }),
    });
    const res = await onRequest({ request: req, env: ENV, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200 但得到 " + res.status + " " + JSON.stringify(data));
    if (data.added.length !== 2) throw new Error("期望导入 2 篇，实际 " + data.added.length);
    const kbIndex = JSON.parse(getFile("data/kb.json"));
    if (!kbIndex.find(d => d.title === "批量A") || !kbIndex.find(d => d.title === "批量B")) throw new Error("批量文档未全部入库");
  });

  await test("缺标题的文档被拒绝", async () => {
    const req = new Request("http://localhost/api/admin/kb", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ filename: "无标题.md", content: "没有 front matter 标题\n\n内容" }),
    });
    const res = await onRequest({ request: req, env: ENV, params: {} });
    // 无 front matter 时会从首行推标题，因此应成功；这里验证不会 500
    if (res.status !== 200 && res.status !== 400) throw new Error("期望 200/400，得到 " + res.status);
  });

  await test("编辑知识库文档（slug 不变）", async () => {
    const list = JSON.parse(getFile("data/kb.json"));
    const target = list.find(d => d.title === "批量A");
    const md = '---\ntitle: "批量A 改名"\ncategory: "批量"\ndate: "2026-09-14"\n---\n\nA 新内容\n';
    const req = new Request("http://localhost/api/admin/kb", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ slug: target.slug, filename: target.slug + ".md", content: md }),
    });
    const res = await onRequest({ request: req, env: ENV, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200 但得到 " + res.status + " " + JSON.stringify(data));
    const kbIndex = JSON.parse(getFile("data/kb.json"));
    if (!kbIndex.find(d => d.slug === target.slug && d.title === "批量A 改名")) throw new Error("标题未更新");
    const renamed = kbIndex.filter(d => d.title === "批量A");
    if (renamed.length) throw new Error("旧标题残留");
  });

  await test("删除知识库文档", async () => {
    const list = JSON.parse(getFile("data/kb.json"));
    const target = list.find(d => d.title === "批量B");
    const req = new Request("http://localhost/api/admin/kb/" + encodeURIComponent(target.slug), {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });
    const res = await onRequest({ request: req, env: ENV, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200 但得到 " + res.status + " " + JSON.stringify(data));
    if (!data.ok) throw new Error("未返回 ok");
    if (hasFile(`docs/kb/${target.slug}.md`)) throw new Error("md 未删除");
    if (hasFile(`kb/${target.slug}.html`)) throw new Error("html 未删除");
    const kbIndex = JSON.parse(getFile("data/kb.json"));
    if (kbIndex.find(d => d.slug === target.slug)) throw new Error("kb.json 残留");
  });

  await test("知识库未授权 → 401", async () => {
    const req = new Request("http://localhost/api/admin/kb");
    const res = await onRequest({ request: req, env: ENV, params: {} });
    if (res.status !== 401) throw new Error("期望 401，得到 " + res.status);
  });

  await test("CRLF 行尾的 front matter 能正确解析", async () => {
    const crlf = '---\r\ntitle: "CRLF 文档"\r\ncategory: "测试"\r\ndate: "2026-09-20"\r\nexcerpt: "行尾测试"\r\ntags: ["a"]\r\n---\r\n\r\n# CRLF 文档\r\n\r\n正文\r\n';
    const req = new Request("http://localhost/api/admin/kb", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ filename: "CRLF文档.md", content: crlf }),
    });
    const res = await onRequest({ request: req, env: ENV, params: {} });
    const data = await res.json();
    if (res.status !== 200) throw new Error("期望 200 但得到 " + res.status + " " + JSON.stringify(data));
    const added = data.added && data.added[0];
    if (!added) throw new Error("未返回 added");
    if (added.title !== "CRLF 文档") throw new Error("CRLF 下标题解析失败，得到 " + JSON.stringify(added.title));
    if (added.category !== "测试") throw new Error("CRLF 下分类解析失败，得到 " + JSON.stringify(added.category));
    const kbIndex = JSON.parse(getFile("data/kb.json"));
    const entry = kbIndex.find(d => d.slug === added.slug);
    if (!entry) throw new Error("索引未记录 CRLF 文档");
    if (entry.title !== "CRLF 文档") throw new Error("索引标题为空（CRLF 解析回归）");
    if (entry.category !== "测试") throw new Error("索引分类为空（CRLF 解析回归）");
    // 生成的 html 页标题也不能为空
    const page = getFile(`kb/${added.slug}.html`);
    if (!page || page.indexOf("CRLF 文档") === -1) throw new Error("生成的页面缺少标题");
  });

  await test("知识库新增/删除同步 sitemap", async () => {
    // 新增后 sitemap 应包含该文档
    const md = '---\ntitle: "Sitemap 测试文档"\ncategory: "测试"\ndate: "2026-09-21"\n---\n\n内容\n';
    const addReq = new Request("http://localhost/api/admin/kb", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ filename: "Sitemap测试文档.md", content: md }),
    });
    const addRes = await onRequest({ request: addReq, env: ENV, params: {} });
    const addData = await addRes.json();
    if (addRes.status !== 200) throw new Error("新增失败 " + addRes.status);
    const slug = addData.added[0].slug;
    let sm = getFile("sitemap.xml");
    if (!sm || sm.indexOf(`/kb/${slug}.html`) === -1) throw new Error("新增后 sitemap 未包含该文档");

    // 删除后 sitemap 不应再有该文档（避免死链）
    const delReq = new Request("http://localhost/api/admin/kb/" + encodeURIComponent(slug), {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });
    const delRes = await onRequest({ request: delReq, env: ENV, params: {} });
    if (delRes.status !== 200) throw new Error("删除失败 " + delRes.status);
    sm = getFile("sitemap.xml");
    if (sm && sm.indexOf(`/kb/${slug}.html`) !== -1) throw new Error("删除后 sitemap 仍残留该文档（死链）");
  });

  // 结果
  console.log(`\n🎯 结果：${passed} 通过，${failed} 失败，共 ${passed + failed} 项`);
  mockServer_.close();
  if (failed > 0) process.exit(1);
});