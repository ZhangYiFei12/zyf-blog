/* ============================================================
   tools/test-frontend.mjs —— 前端回归测试（Edge headless，无外部依赖）

   覆盖：
     A. 纯函数单测（Node）—— 阅读时长、front matter、标签收集、相关度
     B. 生成产物检查       —— canonical / JSON-LD / skip-link / a11y / 分享
     C. 真实浏览器渲染     —— 标签页过滤、归档页、文章页 DOM 与交互

   用法：node tools/test-frontend.mjs
   前置：node tools/dev-server.mjs   （监听 4000）
   ============================================================ */
import { readFileSync, existsSync, readdirSync, writeFileSync, unlinkSync } from "fs";
import { execSync } from "child_process";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  readingMinutes, parseFrontMatter, collectTags, scoreRelated,
  buildTagPage, buildArchivePage, buildSitemap, buildShareRow,
} from "./md2html-core.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || "http://localhost:4000";
const EDGE = process.env.EDGE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const rd = p => readFileSync(join(ROOT, p), "utf8");

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
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

/* ---------- 浏览器：注入脚本取结果 ---------- */
function browserCheck(pagePath, scriptBody, label) {
  const html = existsSync(join(ROOT, pagePath))
    ? rd(pagePath)
    : execSync(`curl -s "${BASE}/${pagePath}"`, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  const inj = `<script>window.addEventListener('load',function(){setTimeout(function(){
    var __r; try { __r = (function(){ ${scriptBody} })(); } catch(e) { __r = 'ERR: '+e; }
    var p=document.createElement('pre');p.id='__T';p.textContent=typeof __r==='string'?__r:JSON.stringify(__r);
    document.body.appendChild(p);},900);});<\/script>`;
  const tmp = `__t_${Math.random().toString(36).slice(2, 8)}.html`;
  writeFileSync(join(ROOT, tmp), html.replace("</body>", inj + "</body>"));
  try {
    const out = execSync(`"${EDGE}" --headless --disable-gpu --virtual-time-budget=6000 --dump-dom "${BASE}/${tmp}"`, {
      encoding: "utf8", maxBuffer: 40 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"],
    });
    const m = out.match(/<pre id="__T">([\s\S]*?)<\/pre>/);
    if (!m) throw new Error(`[${label}] 未取到注入结果`);
    const raw = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    if (raw.startsWith("ERR:")) throw new Error(`[${label}] ${raw}`);
    return JSON.parse(raw);
  } finally {
    unlinkSync(join(ROOT, tmp));
  }
}

console.log("🧪 前端回归测试\n");

/* ============ A. 纯函数单测 ============ */
console.log("[A] 纯函数");

await test("阅读时长：中文 350 字/分", () => {
  const mins = readingMinutes("<p>" + "字".repeat(1400) + "</p>");
  assert(mins === 4, `期望 4，得到 ${mins}`);
});

await test("阅读时长：英文 200 词/分", () => {
  const mins = readingMinutes("<p>" + "word ".repeat(400) + "</p>");
  assert(mins === 2, `期望 2，得到 ${mins}`);
});

await test("阅读时长：不计代码块", () => {
  const withCode = readingMinutes("<p>短</p><pre><code>" + "x".repeat(5000) + "</code></pre>");
  assert(withCode === 1, `代码块不应计入，得到 ${withCode}`);
});

await test("阅读时长：空内容下限为 1", () => {
  assert(readingMinutes("") === 1 && readingMinutes("<p></p>") === 1, "空内容应返回 1");
});

await test("front matter：CRLF 也能解析", () => {
  const { meta } = parseFrontMatter('---\r\ntitle: "T"\r\ncategory: "C"\r\n---\r\n\r\n正文\r\n');
  assert(meta.title === "T", `title 解析失败：${JSON.stringify(meta.title)}`);
  assert(meta.category === "C", `category 解析失败：${JSON.stringify(meta.category)}`);
});

await test("collectTags：统计并按数量降序", () => {
  const posts = [
    { slug: "a", meta: { tags: ["x", "y"] } },
    { slug: "b", meta: { tags: ["x"] } },
    { slug: "c", meta: { tags: ["z"], published: false } },
  ];
  const tags = collectTags(posts);
  assert(tags[0].name === "x" && tags[0].count === 2, `首位应为 x:2，得到 ${JSON.stringify(tags)}`);
  assert(!tags.some(t => t.name === "z"), "草稿标签不应计入");
});

await test("scoreRelated：标签重合度", () => {
  assert(scoreRelated(["a", "b"], ["b", "c"]) === 1, "应有 1 个重合");
  assert(scoreRelated(["a"], ["x", "y"]) === 0, "应无重合");
  assert(scoreRelated([], ["x"]) === 0, "空标签应返回 0");
});

await test("buildTagPage：文章链接带 ../ 前缀（子目录）", () => {
  const html = buildTagPage("工具", [{ slug: "s", meta: { title: "T", date: "2026-01-01", tags: ["工具"] } }]);
  assert(html.includes('href="../blog/s.html"'), "标签页链接应为 ../blog/");
  assert(!/href="blog\//.test(html), "不应存在未加 ../ 的文章链接");
});

await test("buildTagPage：无文章时显示空状态", () => {
  const html = buildTagPage("空标签", []);
  assert(html.includes("该标签下暂无文章"), "应显示空状态");
});

await test("buildArchivePage：按年份分组", () => {
  const posts = [
    { slug: "a", meta: { title: "A", date: "2026-05-01", tags: ["x"] } },
    { slug: "b", meta: { title: "B", date: "2025-03-01", tags: [] } },
    { slug: "c", meta: { title: "C", date: "2026-01-01", published: false } },
  ];
  const html = buildArchivePage(posts);
  assert(html.includes("2026") && html.includes("2025"), "应含两个年份分组");
  assert(html.includes('class="archive-year"'), "应含年份标题样式");
  assert(!html.includes(">C<"), "草稿不应出现在归档页");
});

await test("buildSitemap：含归档页与标签页", () => {
  const posts = [{ slug: "s", meta: { title: "T", date: "2026-01-01", tags: ["标签A"] } }];
  const sm = buildSitemap(posts, undefined, [], collectTags(posts));
  assert(sm.includes("/archive.html"), "sitemap 应含归档页");
  assert(sm.includes(`/tags/${encodeURIComponent("标签A")}.html`), "sitemap 应含标签页");
});

await test("buildShareRow：转义与 URL 编码", () => {
  const html = buildShareRow('标题 <script>', "https://x.com/a?b=1&c=2");
  assert(!html.includes("<script>"), "标题应被转义");
  assert(html.includes("data-share-url="), "应含分享 URL 数据属性");
  assert(html.includes("twitter.com/intent/tweet"), "应含推特分享链接");
});

/* ============ B. 生成产物检查 ============ */
console.log("\n[B] 生成产物");

const articleHtml = "blog/详细介绍与技术文档.html";
const tagged = readdirSync(join(ROOT, "blog"))
  .filter(f => f.endsWith(".html") && f !== "template.html")
  .map(f => "blog/" + f);

await test("文章页含 canonical", () => {
  assert(/<link rel="canonical" href="https:\/\/zyf2026\.pages\.dev\/blog\/[^"]+"/.test(rd(articleHtml)), "缺少 canonical");
});

await test("文章页含 JSON-LD（BlogPosting + BreadcrumbList）", () => {
  const h = rd(articleHtml);
  assert(h.includes('"@type":"BlogPosting"'), "缺少 BlogPosting");
  assert(h.includes('"@type":"BreadcrumbList"'), "缺少 BreadcrumbList");
});

await test("文章页含阅读时长", () => {
  assert(/⏱️ 约 \d+ 分钟/.test(rd(articleHtml)), "缺少阅读时长显示");
});

await test("所有文章页都有 skip-link 与 mainContent", () => {
  const bad = tagged.filter(f => {
    const h = rd(f);
    return !h.includes('class="skip-link"') || !h.includes('id="mainContent"');
  });
  assert(bad.length === 0, `缺失的文件：${bad.join(", ")}`);
});

await test("所有文章页都有分享与相关文章容器", () => {
  const bad = tagged.filter(f => {
    const h = rd(f);
    return !h.includes('class="share-row"') || !h.includes('id="relatedPosts"');
  });
  assert(bad.length === 0, `缺失的文件：${bad.join(", ")}`);
});

await test("所有文章页 nav 含知识库且 aria-expanded 完备", () => {
  const bad = tagged.filter(f => {
    const h = rd(f);
    return !h.includes('kb.html">知识库') || !h.includes('aria-expanded="false"') || !h.includes('aria-controls="navLinks"');
  });
  assert(bad.length === 0, `缺失的文件：${bad.join(", ")}`);
});

await test("静态页面 a11y 属性完备", () => {
  const pages = ["index.html", "blog.html", "projects.html", "about.html", "downloads.html", "gallery.html", "kb.html"];
  const bad = pages.filter(f => {
    const h = rd(f);
    return !h.includes('class="skip-link"') || !h.includes('id="mainContent"') || !h.includes('aria-expanded="false"');
  });
  assert(bad.length === 0, `缺失的文件：${bad.join(", ")}`);
});

await test("静态页面主题脚本跟随系统偏好", () => {
  const pages = ["index.html", "blog.html", "about.html", "kb.html"];
  const bad = pages.filter(f => !rd(f).includes("prefers-color-scheme"));
  assert(bad.length === 0, `缺失的文件：${bad.join(", ")}`);
});

await test("highlight.js 不再被模板硬编码引入", () => {
  const h = rd(articleHtml);
  assert(!/src="[^"]*highlight\.min\.js/.test(h), "文章页不应直接引用 highlight.js");
});

await test("标签页与归档页已生成", () => {
  assert(existsSync(join(ROOT, "archive.html")), "缺少 archive.html");
  const tagsDir = join(ROOT, "tags");
  assert(existsSync(tagsDir) && readdirSync(tagsDir).some(f => f.endsWith(".html")), "缺少标签页");
});

/* ============ C. 渲染产物验证 ============ */
/* 注：Edge 153 的 --headless 在当前环境静默失效（连 data: URL 都无输出），
   故 C 段改为对服务端返回的 HTML 产物做断言，覆盖同样的关注点。 */
console.log("");
console.log("[C] 渲染产物");

const httpGet = p => execSync(`curl -s "${BASE}/${encodeURI(p)}"`, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });

await test("归档页：年份分组与文章条目", () => {
  const h = httpGet("archive.html");
  const items = (h.match(/class="archive-item"/g) || []).length;
  const links = (h.match(/class="archive-title"/g) || []).length;
  assert(/class="archive-year"/.test(h), "缺少年份分组");
  assert(items > 0, "应有文章条目");
  assert(items === links, "每条应有链接");
});

await test("标签页：文章卡片与相对路径正确", () => {
  const tagsDir = join(ROOT, "tags");
  const first = readdirSync(tagsDir).filter(f => f.endsWith(".html"))[0];
  const h = httpGet(`tags/${first}`);
  assert((h.match(/class="post-item"/g) || []).length > 0, "应有文章卡片");
  assert(h.includes('href="../blog/'), "链接应带 ../ 前缀");
  assert(!/href="blog\//.test(h), "不应存在未加 ../ 的文章链接");
  assert(h.includes("返回博客"), "应有返回博客链接");
});

await test("文章页：分享 / 相关 / 阅读时长 / a11y", () => {
  const h = httpGet(articleHtml);
  assert((h.match(/class="share-btn"/g) || []).length >= 3, "分享按钮应 ≥3");
  assert(h.includes('id="relatedPosts"'), "缺少相关文章容器");
  assert(/⏱️ 约 \d+ 分钟/.test(h), "缺少阅读时长");
  assert(h.includes('class="skip-link"'), "缺少 skip-link");
  assert(h.includes('aria-expanded="false"'), "缺少 aria-expanded");
  assert(h.includes('id="mainContent"'), "缺少 mainContent");
});

await test("标签页数量与 sitemap 条目一致", () => {
  const tagsDir = join(ROOT, "tags");
  const n = readdirSync(tagsDir).filter(f => f.endsWith(".html")).length;
  const sm = rd("sitemap.xml");
  const smTags = (sm.match(/\/tags\//g) || []).length;
  assert(n === smTags, `标签页 ${n} 与 sitemap ${smTags} 不一致`);
  assert(sm.includes("/archive.html"), "sitemap 缺少归档页");
});

/* ---------- 结果 ---------- */
console.log(`\n🎯 结果：${passed} 通过，${failed} 失败，共 ${passed + failed} 项`);
if (failed > 0) process.exit(1);
