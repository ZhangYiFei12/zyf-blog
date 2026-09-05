/* ============================================================
   functions/api/admin.js —— 博客加密后台 API（Cloudflare Pages Functions）

   路由：
     POST   /api/admin/login                → 校验密码 → 签发 HMAC 令牌
     POST   /api/admin/preview              → 服务器端渲染 Markdown 预览
     GET    /api/admin/articles             → 列出文章
     GET    /api/admin/articles/:slug       → 取单篇 .md 原文
     POST   /api/admin/articles             → 新建/编辑文章并提交
     DELETE /api/admin/articles/:slug       → 删除文章并提交

   密钥（Cloudflare Pages 环境变量 / Secrets）：
     ADMIN_PASS      后台密码
     SESSION_SECRET  令牌签名密钥（HMAC-SHA256）
     GITHUB_TOKEN    对该仓库有 contents 读写权限的 Token
     GITHUB_REPO     （可选，默认 ZhangYiFei12/zyf-blog）
     GITHUB_BRANCH   （可选，默认 main）
   ============================================================ */

import {
  parseFrontMatter,
  parseBody,
  buildPage,
  buildArticlePreview,
  slugify,
  listItemSnippet,
  renderProjects,
  renderFeatured,
  buildPostsIndex,
  buildSitemap,
  buildRss,
  buildSearchIndex,
} from "../../tools/md2html-core.mjs";

const DEFAULT_REPO = "ZhangYiFei12/zyf-blog";
const TOKEN_TTL = 12 * 3600 * 1000; // 12 小时
const LOGIN_MAX = 5;                 // 连续失败上限
const LOGIN_WINDOW = 5 * 60 * 1000;  // 5 分钟窗口

/* ---------------- 工具 ---------------- */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toB64url(s) {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function signToken(secret, payload) {
  const body = toB64url(JSON.stringify(payload));
  const sig = await hmacHex(secret, body);
  return `${body}.${sig}`;
}

async function verifyToken(secret, token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = await hmacHex(secret, body);
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(fromB64url(body));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function configured(env) {
  return !!(env.ADMIN_PASS && env.SESSION_SECRET && env.GITHUB_TOKEN);
}

/* ---------------- GitHub API ---------------- */

function ghHeaders(env, extra = {}) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "zyf-blog-admin",
    ...extra,
  };
}

async function gh(env, path, opts = {}) {
  const base = env.GITHUB_API_BASE || "https://api.github.com";
  const res = await fetch(base + path, {
    method: opts.method || "GET",
    headers: ghHeaders(env, opts.headers || {}),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 300)}`);
  }
  return res;
}

const repo = env => env.GITHUB_REPO || DEFAULT_REPO;
const branch = env => env.GITHUB_BRANCH || "main";
const enc = s => encodeURIComponent(s);

/* 读取仓库文件原文 */
async function getFile(env, path) {
  const res = await gh(env, `/repos/${repo(env)}/contents/${enc(path)}?ref=${branch(env)}`, {
    headers: { Accept: "application/vnd.github.raw" },
  });
  return await res.text();
}

/* 读取 blog/posts/ 下全部文章（含 front matter） */
async function getAllPosts(env) {
  const res = await gh(env, `/repos/${repo(env)}/contents/blog/posts?ref=${branch(env)}`);
  const files = await res.json();
  const posts = [];
  for (const f of (Array.isArray(files) ? files : [])) {
    if (!f.name.endsWith(".md")) continue;
    const content = await getFile(env, `blog/posts/${f.name}`);
    const { meta, body } = parseFrontMatter(content);
    posts.push({ slug: slugify(f.name), name: f.name, meta, bodyHtml: parseBody(body) });
  }
  // 按日期倒序（无日期排最后）
  posts.sort((a, b) => String(b.meta.date || "").localeCompare(String(a.meta.date || "")));
  return posts;
}

/* 一次性原子提交多个文件 */
async function commitFiles(env, message, changes) {
  const head = await (await gh(env, `/repos/${repo(env)}/git/ref/heads/${branch(env)}`)).json();
  const headSha = head.object.sha;
  const commitInfo = await (await gh(env, `/repos/${repo(env)}/git/commits/${headSha}`)).json();
  const baseTree = commitInfo.tree.sha;

  const tree = [];
  for (const c of changes) {
    if (c.delete) {
      tree.push({ path: c.path, mode: "100644", type: "blob", sha: null });
    } else {
      const blob = await (await gh(env, `/repos/${repo(env)}/git/blobs`, {
        method: "POST",
        body: { content: c.content, encoding: c.encoding || "utf-8" },
      })).json();
      tree.push({ path: c.path, mode: "100644", type: "blob", sha: blob.sha });
    }
  }

  const newTree = await (await gh(env, `/repos/${repo(env)}/git/trees`, {
    method: "POST",
    body: { base_tree: baseTree, tree },
  })).json();

  const newCommit = await (await gh(env, `/repos/${repo(env)}/git/commits`, {
    method: "POST",
    body: { message, tree: newTree.sha, parents: [headSha] },
  })).json();

  await gh(env, `/repos/${repo(env)}/git/refs/heads/${branch(env)}`, {
    method: "PATCH",
    body: { sha: newCommit.sha, force: false },
  });
  return newCommit.sha;
}

/* 在标记区间内替换内容 */
function replaceBetween(content, startMarker, endMarker, newContent) {
  const s = content.indexOf(startMarker);
  const e = content.indexOf(endMarker);
  if (s === -1 || e === -1 || e < s) {
    throw new Error(`页面缺少标记 ${startMarker}`);
  }
  const sEnd = s + startMarker.length;
  return content.slice(0, sEnd) + "\n" + newContent.trim() + "\n" + content.slice(e);
}

/* 生成 .md 源文件内容 */
function buildMarkdown({ title, date, excerpt, tags, body, published }) {
  const t = String(title || "").replace(/"/g, '\\"');
  const e = String(excerpt || "").replace(/"/g, '\\"');
  const tagsArr = Array.isArray(tags) && tags.length ? tags : ["随笔"];
  const tagsLine = `tags: [${tagsArr.map(x => `"${String(x).replace(/"/g, '\\"')}"`).join(", ")}]`;
  return `---\ntitle: "${t}"\ndate: "${date}"\nexcerpt: "${e}"\npublished: ${published !== false}\n${tagsLine}\n---\n\n${String(body || "").trim()}\n`;
}

/* 根据 posts 重生成 blog.html 列表 + index.html 最新文章，返回变更 */
/* ---------------- 认证（简单内存限流，尽力而为） ---------------- */
const loginAttempts = new Map(); // ip -> {count, resetAt}

function rateLimited(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec || now > rec.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW });
    return false;
  }
  rec.count += 1;
  return rec.count > LOGIN_MAX;
}

/* 读取 data/projects.json */
async function getProjects(env) {
  try {
    const raw = await getFile(env, "data/projects.json");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

/* 读取 data/gallery.json */
async function getGallery(env) {
  try {
    const raw = await getFile(env, "data/gallery.json");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

/* 校验并规整项目对象 */
function normalizeProject(input) {
  const project = {
    title: String(input.title || "").trim(),
    year: String(input.year || "").trim(),
    description: String(input.description || "").trim(),
    tags: Array.isArray(input.tags) ? input.tags.map(String).filter(Boolean) : [],
    featured: !!input.featured,
    published: input.published !== false,
    url: String(input.url || "").trim(),
    previewUrl: String(input.previewUrl || "").trim(),
    sourceUrl: String(input.sourceUrl || "").trim(),
  };
  project.id = input.id ? String(input.id).trim() : slugify(project.title) || `project-${Date.now()}`;
  return project;
}

/* ---------------- R2 对象存储（软件下载大文件） ----------------
 * 方案：后台签发 S3 SigV4 presigned PUT URL → 浏览器直传 R2（不经 Functions 中转，
 * 突破请求体限制，支持最大 2GB+）。元数据存 data/downloads.json 并经 GitHub commit。
 * 环境变量：R2_ACCOUNT_ID / R2_ACCESS_KEY / R2_SECRET_KEY / R2_BUCKET
 *           R2_PUBLIC_BASE（可选，公开桶访问基址，如 https://pub-xxx.r2.dev）
 */

function hmac(secret, data) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then(key => crypto.subtle.sign("HMAC", key, enc.encode(data)))
    .then(buf => {
      const b = new Uint8Array(buf);
      let hex = "";
      for (let i = 0; i < b.length; i++) hex += b[i].toString(16).padStart(2, "0");
      return hex;
    });
}

function sha256hex(data) {
  const enc = new TextEncoder();
  return crypto.subtle.digest("SHA-256", enc.encode(data)).then(buf => {
    const b = new Uint8Array(buf);
    let hex = "";
    for (let i = 0; i < b.length; i++) hex += b[i].toString(16).padStart(2, "0");
    return hex;
  });
}

function r2cfg(env) {
  return {
    accountId: String(env.R2_ACCOUNT_ID || "").trim(),
    accessKey: String(env.R2_ACCESS_KEY || "").trim(),
    secretKey: String(env.R2_SECRET_KEY || "").trim(),
    bucket: String(env.R2_BUCKET || "").trim(),
    publicBase: String(env.R2_PUBLIC_BASE || "").trim().replace(/\/$/, ""),
  };
}

function r2Ready(env) {
  const c = r2cfg(env);
  return !!(c.accountId && c.accessKey && c.secretKey && c.bucket);
}

/* 为 R2 对象签发 S3 SigV4 presigned URL（method 可为 PUT / DELETE 等） */
async function presignR2(env, method, key, contentType, expiresSec = 3600) {
  const c = r2cfg(env);
  const host = `${c.bucket}.${c.accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}`;
  const region = "auto";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const service = "s3";

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const payloadHash = "UNSIGNED-PAYLOAD";
  const canonicalUri = `/${c.bucket}/${key}`;

  const query = [
    `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
    `X-Amz-Credential=${encodeURIComponent(`${c.accessKey}/${credentialScope}`)}`,
    `X-Amz-Date=${amzDate}`,
    `X-Amz-Expires=${expiresSec}`,
    `X-Amz-SignedHeaders=host`,
  ].join("&");

  const canonicalRequest = [
    method,
    canonicalUri,
    query,
    `host:${host}`,
    "",
    "host",
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256hex(canonicalRequest),
  ].join("\n");

  const kDate = await hmac("AWS4" + c.secretKey, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  const signature = await hmac(kSigning, stringToSign);

  const signedUrl = `${endpoint}/${c.bucket}/${key}?${query}&X-Amz-Signature=${signature}`;
  return { signedUrl, url: c.publicBase ? `${c.publicBase}/${key}` : `${endpoint}/${c.bucket}/${key}` };
}

/* 读取 data/downloads.json */
async function getDownloads(env) {
  try {
    const raw = await getFile(env, "data/downloads.json");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function genFileKey(origName) {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const ext = (origName.match(/\.([^.]+)$/) || [])[1] || "bin";
  return `dl-${ts}-${rand}.${ext.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

function normFileMeta(input) {
  const f = {
    id: String(input.id || "").trim() || `f-${Date.now()}`,
    key: String(input.key || "").trim(),
    url: String(input.url || "").trim(),
    filename: String(input.filename || "").trim() || "未命名",
    size: Number(input.size) || 0,
    version: String(input.version || "").trim(),
    desc: String(input.desc || "").trim(),
    category: String(input.category || "软件").trim() || "软件",
    date: String(input.date || new Date().toISOString().slice(0, 10)),
  };
  return f;
}

/* ---------------- 主处理器 ---------------- */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const segs = url.pathname.split("/").filter(Boolean); // [api, admin, ...]

  // 必须是 /api/admin/...
  if (segs[0] !== "api" || segs[1] !== "admin") {
    return json({ error: "not found" }, 404);
  }

  const method = request.method;
  const rest = segs.slice(2); // 剩余路径

  // ---- 登录（无需令牌） ----
  if (method === "POST" && rest.length === 1 && rest[0] === "login") {
    if (!configured(env)) {
      return json({ error: "后台未配置：请在 Cloudflare Pages 设置 ADMIN_PASS / SESSION_SECRET / GITHUB_TOKEN 环境变量" }, 500);
    }
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (rateLimited(ip)) {
      return json({ error: "尝试次数过多，请稍后再试" }, 429);
    }
    const body = await request.json().catch(() => null);
    const pass = body && body.password;
    if (typeof pass !== "string" || !safeEqual(pass, env.ADMIN_PASS)) {
      return json({ error: "密码错误" }, 401);
    }
    const token = await signToken(env.SESSION_SECRET, { sub: "admin", exp: Date.now() + TOKEN_TTL });
    return json({ token, expiresIn: TOKEN_TTL });
  }

  // ---- 其余全部需要令牌 ----
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const payload = await verifyToken(env.SESSION_SECRET, token);
  if (!payload) {
    return json({ error: "未授权或登录已过期" }, 401);
  }
  if (!configured(env)) {
    return json({ error: "后台未配置：请在 Cloudflare Pages 设置 ADMIN_PASS / SESSION_SECRET / GITHUB_TOKEN 环境变量" }, 500);
  }

  // ---- POST /api/admin/preview ----
  if (method === "POST" && rest.length === 1 && rest[0] === "preview") {
    const input = await request.json().catch(() => null);
    const md = input && input.body ? String(input.body) : "";
    const bodyHtml = parseBody(md);
    const meta = {
      title: input && input.title ? String(input.title).trim() : "（无标题）",
      date: input && input.date ? String(input.date).trim() : new Date().toISOString().slice(0, 10),
      tags: Array.isArray(input && input.tags) ? input.tags.map(String).filter(Boolean) : [],
      excerpt: input && input.excerpt ? String(input.excerpt).trim() : "",
    };
    const html = buildArticlePreview(meta, bodyHtml);
    return json({ html });
  }

  // ---- GET /api/admin/articles ----
  if (method === "GET" && rest.length === 1 && rest[0] === "articles") {
    const posts = await getAllPosts(env);
    return json({ articles: posts.map(p => ({
      slug: p.slug,
      title: p.meta.title,
      date: p.meta.date,
      excerpt: p.meta.excerpt,
      tags: p.meta.tags,
      published: p.meta.published !== false,
    })) });
  }

  // ---- GET /api/admin/articles/:slug ----
  if (method === "GET" && rest.length === 2 && rest[0] === "articles") {
    const slug = decodeURIComponent(rest[1]);
    try {
      const md = await getFile(env, `blog/posts/${slug}.md`);
      const { meta, body } = parseFrontMatter(md);
      return json({ slug, meta, body });
    } catch (e) {
      return json({ error: "文章不存在" }, 404);
    }
  }

  // ---- POST /api/admin/articles（新建 / 编辑）----
  if (method === "POST" && rest.length === 1 && rest[0] === "articles") {
    const input = await request.json().catch(() => null);
    if (!input || !input.title || !input.body) {
      return json({ error: "缺少标题或正文" }, 400);
    }
    const title = String(input.title).trim();
    const date = String(input.date || new Date().toISOString().slice(0, 10));
    const excerpt = String(input.excerpt || "").trim();
    const tags = Array.isArray(input.tags) ? input.tags.map(String).filter(Boolean) : [];
    const isDraft = input.published === false;

    // 确定 slug：编辑用传入 slug，新建用标题生成
    let slug = input.slug ? String(input.slug).trim() : slugify(title);
    if (!slug) slug = slugify(title);

    // 碰撞检测（新建时目标已存在 → 409；编辑时目标已存在且非自身 → 409）
    const posts = await getAllPosts(env);
    const existing = posts.find(p => p.slug === slug);
    if (existing && !input.slug) {
      return json({ error: `slug「${slug}」已存在（标题冲突）` }, 409);
    }
    if (existing && input.slug && input.slug !== slug) {
      // 不允许重命名到已存在 slug
    }

    // 组装 Markdown
    const mdContent = buildMarkdown({ title, date, excerpt, tags, body: input.body, published: !isDraft });

    // 渲染文章页
    const meta = { title, date, excerpt, tags, published: !isDraft };
    const bodyHtml = parseBody(String(input.body));
    const pageHtml = buildPage(meta, bodyHtml, { slug });

    // 构造最新文章列表（含本篇文章）
    const updatedPosts = posts.filter(p => p.slug !== slug);
    updatedPosts.push({ slug, meta, bodyHtml });
    updatedPosts.sort((a, b) => String(b.meta.date || "").localeCompare(String(a.meta.date || "")));

    // 筛选已发布文章（草稿不入公开列表）
    const publishedPosts = updatedPosts.filter(p => p.meta.published !== false);

    const blogList = publishedPosts.map(p => listItemSnippet(p.meta, p.slug)).join("\n\n");
    const latest = publishedPosts[0] ? listItemSnippet(publishedPosts[0].meta, publishedPosts[0].slug) : "";

    // 读取并更新 blog.html / index.html
    let blogHtml = await getFile(env, "blog.html");
    let indexHtml = await getFile(env, "index.html");
    blogHtml = replaceBetween(blogHtml, "<!-- BLOG-LIST-START -->", "<!-- BLOG-LIST-END -->", blogList);
    indexHtml = replaceBetween(indexHtml, "<!-- LATEST-START -->", "<!-- LATEST-END -->", latest);

    const commitChanges = [
      { path: `blog/posts/${slug}.md`, content: mdContent },
      { path: `blog/${slug}.html`, content: pageHtml },
      { path: "data/posts.json", content: buildPostsIndex(updatedPosts) },
      { path: "sitemap.xml", content: buildSitemap(updatedPosts) },
      { path: "feed.xml", content: buildRss(updatedPosts) },
      { path: "data/search-index.json", content: buildSearchIndex(updatedPosts) },
    ];
    // 已发布文章才更新公开页面
    if (publishedPosts.length) {
      commitChanges.push(
        { path: "blog.html", content: blogHtml },
        { path: "index.html", content: indexHtml },
      );
    }

    const isEdit = !!input.slug;
    const commitSha = await commitFiles(env, `📝 ${isEdit ? "后台编辑" : "后台发布"}：${title}`, commitChanges);

    return json({ ok: true, slug, commitSha, message: isDraft ? "草稿已保存（仅后台可见）" : "已发布，Cloudflare 正在自动部署（约 30 秒~1 分钟）" });
  }

  // ---- DELETE /api/admin/articles/:slug ----
  if (method === "DELETE" && rest.length === 2 && rest[0] === "articles") {
    const slug = decodeURIComponent(rest[1]);
    const posts = await getAllPosts(env);
    const target = posts.find(p => p.slug === slug);
    if (!target) return json({ error: "文章不存在" }, 404);

    const remaining = posts.filter(p => p.slug !== slug);
    const publishedRemaining = remaining.filter(p => p.meta.published !== false);
    const blogList = publishedRemaining.map(p => listItemSnippet(p.meta, p.slug)).join("\n\n");
    const latest = publishedRemaining[0] ? listItemSnippet(publishedRemaining[0].meta, publishedRemaining[0].slug) : "";

    let blogHtml = await getFile(env, "blog.html");
    let indexHtml = await getFile(env, "index.html");
    blogHtml = replaceBetween(blogHtml, "<!-- BLOG-LIST-START -->", "<!-- BLOG-LIST-END -->", blogList);
    indexHtml = replaceBetween(indexHtml, "<!-- LATEST-START -->", "<!-- LATEST-END -->", latest);

    const commitSha = await commitFiles(env, `🗑️ 后台删除：${target.meta.title}`, [
      { path: `blog/posts/${slug}.md`, delete: true },
      { path: `blog/${slug}.html`, delete: true },
      { path: "blog.html", content: blogHtml },
      { path: "index.html", content: indexHtml },
      { path: "data/posts.json", content: buildPostsIndex(remaining) },
      { path: "sitemap.xml", content: buildSitemap(remaining) },
      { path: "feed.xml", content: buildRss(remaining) },
      { path: "data/search-index.json", content: buildSearchIndex(remaining) },
    ]);

    return json({ ok: true, slug, commitSha, message: "已删除并提交，等待自动部署" });
  }

  // ---- POST /api/admin/upload（图片上传，提交到 images/uploads/）----
  if (method === "POST" && rest.length === 1 && rest[0] === "upload") {
    const input = await request.json().catch(() => null);
    const b64 = input && input.data ? String(input.data) : "";
    const mime = input && input.mime ? String(input.mime) : "image/png";
    const ext = String((input && input.ext) || mime.split("/")[1] || "png")
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase() || "png";
    if (!b64 || b64.length > 7 * 1024 * 1024) {
      return json({ error: "图片数据无效或过大（>5MB）" }, 400);
    }
    const filename = `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `images/uploads/${filename}`;
    const commitSha = await commitFiles(env, `🖼️ 后台上传图片：${filename}`, [
      { path, content: b64, encoding: "base64" },
    ]);
    return json({ ok: true, url: `/images/uploads/${filename}`, commitSha, message: "图片已提交，部署完成后即可引用（约 30 秒）" });
  }

  // ---- GET /api/admin/gallery（相册列表）----
  if (method === "GET" && rest.length === 1 && rest[0] === "gallery") {
    const gallery = await getGallery(env);
    return json({ gallery });
  }

  // ---- POST /api/admin/gallery（批量上传相册图片，单 commit 提交全部）----
  if (method === "POST" && rest.length === 1 && rest[0] === "gallery") {
    const input = await request.json().catch(() => null);
    const images = Array.isArray(input && input.images) ? input.images : [];
    if (!images.length) return json({ error: "没有图片数据" }, 400);
    if (images.length > 20) return json({ error: "单次最多 20 张" }, 400);
    const gallery = await getGallery(env);
    const changes = [];
    const added = [];
    for (const img of images) {
      const b64 = img && img.data ? String(img.data) : "";
      if (!b64 || b64.length > 7 * 1024 * 1024) {
        return json({ error: "有图片数据无效或过大（>5MB）" }, 400);
      }
      const mime = img && img.mime ? String(img.mime) : "image/jpeg";
      const ext = String((img && img.ext) || mime.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
      const filename = `gal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      changes.push({ path: `images/uploads/${filename}`, content: b64, encoding: "base64" });
      const entry = {
        file: filename,
        url: `/images/uploads/${filename}`,
        caption: String((img && img.caption) || "").trim(),
        date: new Date().toISOString().slice(0, 10),
      };
      // 缩略图（webp，480px）：有则随原图一起提交，并写入 thumbUrl
      const thumbB64 = img && img.thumb ? String(img.thumb) : "";
      const thumbExt = String((img && img.thumbExt) || "webp").replace(/[^a-z0-9]/gi, "").toLowerCase() || "webp";
      if (thumbB64 && thumbB64.length <= 1024 * 1024) {
        const thumbName = `thumb-${filename.replace(/\.[^.]+$/, "")}.${thumbExt}`;
        changes.push({ path: `images/uploads/${thumbName}`, content: thumbB64, encoding: "base64" });
        entry.thumbUrl = `/images/uploads/${thumbName}`;
      }
      added.push(entry);
    }
    const newGallery = added.concat(gallery); // 新图在前
    changes.push({ path: "data/gallery.json", content: JSON.stringify(newGallery, null, 2) });
    const commitSha = await commitFiles(env, `🖼️ 后台相册上传 ${added.length} 张图片`, changes);
    return json({ ok: true, added, commitSha, message: `已提交 ${added.length} 张图片，部署完成后首页相册即可显示（约 1 分钟）` });
  }

  // ---- POST /api/admin/gallery/optimize（重新压缩已上传图片，覆盖原文件，URL 不变）----
  if (method === "POST" && rest.length === 2 && rest[0] === "gallery" && rest[1] === "optimize") {
    const input = await request.json().catch(() => null);
    const filename = String((input && input.file) || "").replace(/[^a-z0-9.\-]/gi, "");
    if (!filename) return json({ error: "文件名无效" }, 400);
    const b64 = input && input.data ? String(input.data) : "";
    if (!b64 || b64.length > 7 * 1024 * 1024) return json({ error: "图片数据无效或过大（>5MB）" }, 400);
    const gallery = await getGallery(env);
    const target = gallery.find(g => g && g.file === filename);
    if (!target) return json({ error: "相册中未找到该图片" }, 404);

    const mime = input && input.mime ? String(input.mime) : "image/jpeg";
    const ext = String((input && input.ext) || mime.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
    const changes = [
      { path: `images/uploads/${filename}`, content: b64, encoding: "base64" },
    ];

    // 缩略图：已有则覆盖原路径，否则新建并记入 gallery.json
    let thumbUrl = target.thumbUrl || "";
    const thumbB64 = input && input.thumb ? String(input.thumb) : "";
    const thumbExt = String((input && input.thumbExt) || "webp").replace(/[^a-z0-9]/gi, "").toLowerCase() || "webp";
    if (thumbB64 && thumbB64.length <= 1024 * 1024) {
      if (target.thumbUrl) {
        const tp = String(target.thumbUrl).replace(/^\//, "");
        if (tp) changes.push({ path: tp, content: thumbB64, encoding: "base64" });
      } else {
        const thumbName = `thumb-${filename.replace(/\.[^.]+$/, "")}.${thumbExt}`;
        changes.push({ path: `images/uploads/${thumbName}`, content: thumbB64, encoding: "base64" });
        thumbUrl = `/images/uploads/${thumbName}`;
      }
    }
    if (thumbUrl !== target.thumbUrl) {
      target.thumbUrl = thumbUrl;
      changes.push({ path: "data/gallery.json", content: JSON.stringify(gallery, null, 2) });
    }

    const commitSha = await commitFiles(env, `⚙️ 后台重新压缩相册图片：${filename}`, changes);
    return json({ ok: true, commitSha, message: "已重新压缩并提交，部署后生效（约 1 分钟）" });
  }

  // ---- DELETE /api/admin/gallery/<filename>（删除相册图片）----
  if (method === "DELETE" && rest.length === 2 && rest[0] === "gallery") {
    const filename = String(rest[1] || "").replace(/[^a-z0-9.\-]/gi, "");
    if (!filename) return json({ error: "文件名无效" }, 400);
    const gallery = await getGallery(env);
    const remaining = gallery.filter(g => g && g.file !== filename);
    if (remaining.length === gallery.length) return json({ error: "相册中未找到该图片" }, 404);
    const target = gallery.find(g => g && g.file === filename) || {};
    const deletes = [{ path: `images/uploads/${filename}`, delete: true }];
    if (target.thumbUrl) {
      const t = String(target.thumbUrl).replace(/^\//, "");
      if (t) deletes.push({ path: t, delete: true });
    }
    const commitSha = await commitFiles(env, `🗑️ 后台删除相册图片：${filename}`, [
      ...deletes,
      { path: "data/gallery.json", content: JSON.stringify(remaining, null, 2) },
    ]);
    return json({ ok: true, commitSha, message: "已删除并提交，等待自动部署" });
  }

  // ---- GET /api/admin/projects ----
  if (method === "GET" && rest.length === 1 && rest[0] === "projects") {
    const projects = await getProjects(env);
    return json({ projects });
  }

  // ---- POST /api/admin/projects（新建 / 编辑）----
  if (method === "POST" && rest.length === 1 && rest[0] === "projects") {
    const input = await request.json().catch(() => null);
    if (!input || !input.title || !String(input.title).trim()) {
      return json({ error: "缺少项目名称" }, 400);
    }
    const project = normalizeProject(input);
    const projects = await getProjects(env);
    const idx = projects.findIndex(p => p.id === project.id);
    if (idx >= 0) {
      projects[idx] = project; // 编辑
    } else {
      projects.unshift(project); // 新增放最前
    }

    // 写 JSON + 重生成 projects.html + index.html 精选区
    const jsonContent = JSON.stringify(projects, null, 2) + "\n";
    const projectsHtml = await getFile(env, "projects.html");
    const newProjectsHtml = replaceBetween(projectsHtml, "<!-- PROJECTS-START -->", "<!-- PROJECTS-END -->", renderProjects(projects));
    const indexHtml = await getFile(env, "index.html");
    const newIndexHtml = replaceBetween(indexHtml, "<!-- FEATURED-START -->", "<!-- FEATURED-END -->", renderFeatured(projects));

    const commitSha = await commitFiles(env, `🛠️ ${idx >= 0 ? "后台编辑" : "后台新增"}项目：${project.title}`, [
      { path: "data/projects.json", content: jsonContent },
      { path: "projects.html", content: newProjectsHtml },
      { path: "index.html", content: newIndexHtml },
    ]);

    return json({ ok: true, id: project.id, commitSha, message: project.published === false ? "草稿已保存（仅后台可见）" : "已提交，Cloudflare 正在自动部署（约 30 秒~1 分钟）" });
  }

  // ---- DELETE /api/admin/projects（按 id）----
  if (method === "DELETE" && rest.length === 1 && rest[0] === "projects") {
    const input = await request.json().catch(() => null);
    const id = input && input.id ? String(input.id).trim() : "";
    if (!id) return json({ error: "缺少项目 ID" }, 400);
    const projects = await getProjects(env);
    const target = projects.find(p => p.id === id);
    if (!target) return json({ error: "项目不存在" }, 404);
    const remaining = projects.filter(p => p.id !== id);

    const jsonContent = JSON.stringify(remaining, null, 2) + "\n";
    const projectsHtml = await getFile(env, "projects.html");
    const newProjectsHtml = replaceBetween(projectsHtml, "<!-- PROJECTS-START -->", "<!-- PROJECTS-END -->", renderProjects(remaining));
    const indexHtml = await getFile(env, "index.html");
    const newIndexHtml = replaceBetween(indexHtml, "<!-- FEATURED-START -->", "<!-- FEATURED-END -->", renderFeatured(remaining));

    const commitSha = await commitFiles(env, `🗑️ 后台删除项目：${target.title}`, [
      { path: "data/projects.json", content: jsonContent },
      { path: "projects.html", content: newProjectsHtml },
      { path: "index.html", content: newIndexHtml },
    ]);

    return json({ ok: true, id, commitSha, message: "已删除并提交，等待自动部署" });
  }

  // ---- GET /api/admin/files（列出下载文件）----
  if (method === "GET" && rest.length === 1 && rest[0] === "files") {
    const files = await getDownloads(env);
    return json({ files });
  }

  // ---- POST /api/admin/files/presign（签发 R2 直传 URL）----
  if (method === "POST" && rest.length === 2 && rest[0] === "files" && rest[1] === "presign") {
    if (!r2Ready(env)) {
      return json({ error: "R2 未配置：请在 Cloudflare Pages 设置 R2_ACCOUNT_ID / R2_ACCESS_KEY / R2_SECRET_KEY / R2_BUCKET" }, 500);
    }
    const input = await request.json().catch(() => null);
    const filename = input && input.filename ? String(input.filename).trim() : "";
    const size = Number(input && input.size) || 0;
    if (!filename) return json({ error: "缺少文件名" }, 400);
    // 预留大小上限校验（前端也校验；此处兜底）
    if (size > 2 * 1024 * 1024 * 1024) return json({ error: "文件超过 2GB 上限" }, 400);
    const key = genFileKey(filename);
    const ext = (key.match(/\.([^.]+)$/) || [])[1] || "bin";
    const contentType = String(input.contentType || "application/octet-stream").trim();
    try {
      const { signedUrl: putUrl, url } = await presignR2(env, "PUT", key, contentType);
      return json({ ok: true, key, putUrl, url, expiresIn: 3600, ext });
    } catch (e) {
      return json({ error: `签发直传 URL 失败：${e.message || e}` }, 500);
    }
  }

  // ---- POST /api/admin/files/record（提交元数据到 data/downloads.json）----
  if (method === "POST" && rest.length === 2 && rest[0] === "files" && rest[1] === "record") {
    const input = await request.json().catch(() => null);
    if (!input || !input.key) return json({ error: "缺少文件 key" }, 400);
    const files = await getDownloads(env);
    const entry = normFileMeta(input);
    // 同 key 已存在则更新，否则插入最前
    const idx = files.findIndex(f => f.key === entry.key);
    if (idx >= 0) files[idx] = entry; else files.unshift(entry);
    const commitSha = await commitFiles(env, `📦 后台${idx >= 0 ? "更新" : "新增"}下载文件：${entry.filename}`, [
      { path: "data/downloads.json", content: JSON.stringify(files, null, 2) + "\n" },
    ]);
    return json({ ok: true, id: entry.id, commitSha, message: "已记录并提交，下载页将在部署后更新" });
  }

  // ---- DELETE /api/admin/files（删除 R2 对象 + 元数据）----
  if (method === "DELETE" && rest.length === 1 && rest[0] === "files") {
    const input = await request.json().catch(() => null);
    const id = input && input.id ? String(input.id).trim() : "";
    if (!id) return json({ error: "缺少文件 ID" }, 400);
    const files = await getDownloads(env);
    const target = files.find(f => f.id === id);
    if (!target) return json({ error: "文件记录不存在" }, 404);
    const remaining = files.filter(f => f.id !== id);

    // 删除 R2 对象（尽力而为；失败不阻断元数据删除，但记录提示）
    let r2Note = "";
    if (r2Ready(env) && target.key) {
      try {
        const c = r2cfg(env);
        const host = `${c.bucket}.${c.accountId}.r2.cloudflarestorage.com`;
        const { signedUrl } = await presignR2(env, "DELETE", target.key);
        const res = await fetch(signedUrl, { method: "DELETE" });
        if (!res.ok && res.status !== 404) r2Note = `（R2 对象删除失败 ${res.status}）`;
      } catch (e) {
        r2Note = `（R2 对象删除失败：${e.message || e}）`;
      }
    }

    const commitSha = await commitFiles(env, `🗑️ 后台删除下载文件：${target.filename}`, [
      { path: "data/downloads.json", content: JSON.stringify(remaining, null, 2) + "\n" },
    ]);
    return json({ ok: true, id, commitSha, message: `已删除并提交${r2Note}` });
  }

  return json({ error: "not found" }, 404);
}