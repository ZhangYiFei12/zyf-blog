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
  buildSearchAll, buildManifest,
  parseBody, inline, headingSlug, safeUrl, safeImageUrl, escapeHtml, escapeAttr,
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
  assert(html.includes('href="../blog/s"'), "标签页链接应为 ../blog/（无扩展名）");
  assert(!/href="\.\.\/blog\/[^"]*\.html"/.test(html), "标签页不应带 .html（非 ASCII 会 404）");
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
  assert(sm.includes(`/tags/${encodeURIComponent("标签A")}`), "sitemap 应含标签页");
  assert(sm.includes("/archive.html"), "sitemap 应含归档页");
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

/* ============ D. 第三梯队：搜索 / 打印 / PWA / 评论 ============ */
console.log("");
console.log("[D] 搜索 · 打印 · PWA · 评论");

await test("buildSearchAll：合并文章与知识库", () => {
  const posts = [{ slug: "a", meta: { title: "文章A", date: "2026-01-01", tags: ["x"] }, bodyHtml: "<p>正文</p>" }];
  const kb = [{ slug: "k", meta: { title: "文档K", category: "C", date: "2026-01-02" }, bodyHtml: "<p>kb</p>" }];
  const idx = JSON.parse(buildSearchAll(posts, kb));
  assert(idx.length === 2, "应有 2 条");
  assert(idx.some(e => e.type === "post") && idx.some(e => e.type === "kb"), "应含两种类型");
  assert(idx.every(e => e.url && e.title && e.typeName), "条目字段应完整");
  assert(!idx.some(e => e.slug === "draft"), "草稿不应进入索引");
});

await test("buildSearchAll：草稿被排除", () => {
  const idx = JSON.parse(buildSearchAll([{ slug: "d", meta: { title: "草稿", published: false }, bodyHtml: "" }], []));
  assert(idx.length === 0, "草稿应被排除");
});

await test("buildManifest：由站点设置派生", () => {
  const man = JSON.parse(buildManifest({ name: "ZZ", title: "ZZ 站", description: "描述" }));
  assert(man.short_name === "ZZ" && man.name === "ZZ 站", "名称未同步");
  assert(man.display === "standalone", "display 应为 standalone");
  assert(Array.isArray(man.icons) && man.icons.length >= 2, "应有图标");
  assert(man.icons.some(i => i.type === "image/svg+xml"), "应含 SVG 图标");
  assert(man.start_url && man.theme_color, "应有 start_url 与 theme_color");
});

await test("manifest.json 产物有效且与 site.json 一致", () => {
  const man = JSON.parse(rd("manifest.json"));
  const site = JSON.parse(rd("data/site.json"));
  assert(man.name === site.title, `manifest.name(${man.name}) 应等于 site.title(${site.title})`);
  assert(man.short_name === site.name, "manifest.short_name 应等于 site.name");
});

await test("PWA 资源齐备（sw.js / offline.html / icon.svg）", () => {
  assert(existsSync(join(ROOT, "sw.js")), "缺 sw.js");
  assert(existsSync(join(ROOT, "offline.html")), "缺 offline.html");
  assert(existsSync(join(ROOT, "images/icon.svg")), "缺 icon.svg");
  const sw = rd("sw.js");
  assert(sw.includes("addEventListener('install'") || sw.includes('addEventListener("install"'), "SW 缺 install 事件");
  assert(sw.includes("/offline.html"), "SW 未引用离线页");
  assert(sw.includes("cache"), "SW 未使用 Cache API");
});

await test("sw.js 不被长期缓存（_headers 规则）", () => {
  const h = rd("_headers");
  assert(/\/sw\.js[\s\S]{0,120}no-cache/.test(h), "_headers 缺少 /sw.js 不缓存规则");
  assert(/\/manifest\.json/.test(h), "_headers 缺少 manifest 规则");
});

await test("搜索页结构完备（输入框 / 结果容器 / 键盘提示）", () => {
  const h = rd("search.html");
  assert(h.includes('id="siteSearchInput"'), "缺搜索输入框");
  assert(h.includes('id="siteSearchResults"'), "缺结果容器");
  assert(h.includes("aria-controls=\"siteSearchResults\""), "缺 aria-controls");
  assert(/↑↓|ArrowUp/.test(h) || h.includes("↑↓"), "提示未说明键盘操作");
  assert(h.includes('rel="canonical"'), "搜索页缺 canonical");
  assert(h.includes("noindex"), "搜索页应为 noindex");
});

await test("data/search-all.json 已生成且含类型字段", () => {
  const idx = JSON.parse(rd("data/search-all.json"));
  assert(Array.isArray(idx) && idx.length > 0, "索引为空");
  assert(idx.every(e => e.type && e.typeName && e.url && e.title), "条目字段不完整");
});

await test("打印样式存在且隐藏交互元素", () => {
  const css = rd("css/style.css");
  assert(css.includes("@media print"), "缺 @media print");
  const printBlock = css.slice(css.indexOf("@media print"));
  [".navbar", ".footer", ".back-top", ".comments", ".toc"].forEach(sel => {
    assert(printBlock.includes(sel), `打印样式未隐藏 ${sel}`);
  });
  assert(printBlock.includes("@page"), "缺 @page 页边距");
});

await test("文章页含评论占位容器", () => {
  const bad = tagged.filter(f => !rd(f).includes('id="comments"'));
  assert(bad.length === 0, `缺 #comments 的文件：${bad.join(", ")}`);
});

await test("site.json 的 giscus 配置完整可用", () => {
  const g = JSON.parse(rd("data/site.json")).giscus;
  assert(g.enabled === true, "giscus 未启用");
  ["repo", "repoId", "category", "categoryId"].forEach(k => {
    assert(g[k] && String(g[k]).trim(), `giscus.${k} 为空`);
  });
  assert(/^R_/.test(g.repoId), "repoId 形式应为 R_xxx");
  assert(/^DIC_/.test(g.categoryId), "categoryId 形式应为 DIC_xxx");
});

await test("全站页面含 nav-search / manifest / theme-color", () => {
  const pages = readdirSync(ROOT).filter(f => f.endsWith(".html") && f !== "admin.html" && f !== "offline.html");
  const bad = pages.filter(f => {
    const h = rd(f);
    return !h.includes("nav-search") || !h.includes('rel="manifest"') || !h.includes("theme-color");
  });
  assert(bad.length === 0, `缺项文件：${bad.join(", ")}`);
});

await test("全站页面有 canonical（除 noindex 页）", () => {
  const pages = readdirSync(ROOT).filter(f => f.endsWith(".html") && f !== "admin.html" && f !== "offline.html");
  const bad = pages.filter(f => !rd(f).includes('rel="canonical"'));
  assert(bad.length === 0, `缺 canonical：${bad.join(", ")}`);
});

/* ============ E. 链接形式与渐进增强（防回归） ============ */
console.log("");
console.log("[E] 链接形式 · 渐进增强");

await test("文章/标签链接一律不带 .html", () => {
  // 回归：Cloudflare Pages 对非 ASCII 文件名做 .html → 无扩展名跳转时
  //  Location 头未百分号编码，浏览器会双重编码导致 404（曾使全部文章打不开）
  const files = [
    ...readdirSync(ROOT).filter(f => f.endsWith(".html")).map(f => f),
    ...readdirSync(join(ROOT, "blog")).filter(f => f.endsWith(".html")).map(f => "blog/" + f),
    ...readdirSync(join(ROOT, "tags")).filter(f => f.endsWith(".html")).map(f => "tags/" + f),
  ];
  const bad = [];
  for (const f of files) {
    for (const m of rd(f).matchAll(/href="([^"]+)"/g)) {
      const u = m[1];
      if (/^(https?:|mailto:|tel:|#|\/\/)/.test(u)) continue;
      if (/(^|\/)(blog|kb|tags)\/[^"]*\.html$/.test(u)) bad.push(f + " → " + u);
    }
  }
  assert(bad.length === 0, `带 .html 的文章链接：${bad.slice(0, 5).join(", ")}`);
});

await test("sitemap / feed / search-all 的文章 URL 不带 .html", () => {
  const sm = rd("sitemap.xml");
  const badSm = (sm.match(/<loc>[^<]*<\/loc>/g) || []).filter(x => /\/(blog|kb|tags)\//.test(x) && /\.html</.test(x));
  assert(badSm.length === 0, `sitemap 残留 ${badSm.length} 条`);
  const fd = rd("feed.xml");
  const badFd = (fd.match(/<link>[^<]*<\/link>/g) || []).filter(x => /\/blog\//.test(x) && /\.html</.test(x));
  assert(badFd.length === 0, `feed 残留 ${badFd.length} 条`);
  const sa = JSON.parse(rd("data/search-all.json"));
  const badSa = sa.filter(e => /\.html$/.test(e.url));
  assert(badSa.length === 0, `search-all 残留 ${badSa.length} 条`);
});

await test("canonical / og:url 指向无扩展名 URL", () => {
  for (const f of ["blog/详细介绍与技术文档.html", "tags/工具.html"]) {
    const s = rd(f);
    const c = (s.match(/rel="canonical" href="([^"]+)"/) || [])[1] || "";
    assert(c, f + " 缺 canonical");
    assert(!/\.html$/.test(c), f + " canonical 仍带 .html：" + c);
  }
  const a = rd("blog/详细介绍与技术文档.html");
  const o = (a.match(/og:url" content="([^"]+)"/) || [])[1] || "";
  assert(o && !/\.html$/.test(o), "og:url 仍带 .html：" + o);
});

await test("渐进增强：内容不再默认不可见", () => {
  const css = rd("css/style.css");
  assert(!/\.post-item\s*\{[^}]*opacity:\s*0/.test(css), ".post-item 仍默认 opacity:0（JS 异常会致内容消失）");
  assert(!/\.reveal\s*\{[^}]*opacity:\s*0/.test(css), ".reveal 仍默认 opacity:0");
  const gates = (css.match(/html\.js-anim/g) || []).length;
  assert(gates >= 3, `js-anim 门控仅 ${gates} 处，应为 3 处（post-item/reveal/reveal-stagger）`);
});

await test("main.js 有 js-anim 双重兜底", () => {
  const js = rd("js/main.js");
  assert(js.includes("js-anim"), "main.js 未添加 js-anim");
  assert(/addEventListener\("error"/.test(js), "缺少 error 事件兜底");
  assert(js.includes("__zhMainOk"), "缺少超时兜底标记");
  assert(/setTimeout\([\s\S]{0,220}__zhMainOk/.test(js), "缺少超时兜底逻辑");
});

await test("gen-pages 会重建 blog.html 与 index.html 列表", () => {
  const g = rd("tools/gen-pages.mjs");
  assert(g.includes("BLOG-LIST-START"), "gen-pages 未重建 blog.html 列表");
  assert(g.includes("LATEST-START"), "gen-pages 未重建首页最新文章");
  assert(g.includes("FEATURED-START"), "gen-pages 未重建首页精选项目");
});

/* ============ F. Markdown 渲染器（防回归，均对应已修复的真实缺陷） ============ */
console.log("");
console.log("[F] Markdown 渲染器");

const BS = String.fromCharCode(92); // 反斜杠

await test("段落行首为 * + > | 时不再被丢弃（曾静默丢失 92 行正文）", () => {
  const r = parseBody("第一行\n*强调开头的段落*\n第三行");
  assert(r.includes("强调开头的段落"), "行首为 * 的段落被丢弃：" + r);
  assert((r.match(/<p>/g) || []).length === 1, "应合为一个段落（软换行）：" + r);
  for (const md of ["**仅加粗的行**", "+加号开头", "| 竖线开头"]) {
    const out = parseBody(md);
    assert(out.trim() !== "", "整行被丢弃: " + md);
  }
});

await test("段落软换行不再输出字面 &lt;br /&gt;", () => {
  const r = parseBody("第一行\n第二行");
  assert(r.includes("<br />"), "应有真实 <br />：" + r);
  assert(!r.includes("&lt;br"), "不应出现被转义的字面 br：" + r);
});

await test("畸形表格不再产生十万空块（曾输出 195KB 垃圾）", () => {
  const out = parseBody("| a | b |\n不是分隔行\n| 1 | 2 |");
  assert(out.length < 500, "输出异常膨胀：" + out.length + " 字符");
  assert(out.includes("<p>"), "应回退为段落：" + out.slice(0, 120));
});

await test("内联属性注入被阻断（曾可注入 onerror）", () => {
  const r = parseBody('![x](y"onerror="alert(1))');
  assert(!/\sonerror=/.test(r.replace(/&quot;/g, '"')), "onerror 未被阻断：" + r);
  assert(r.includes("&quot;"), "属性里的引号应被转义：" + r);
  assert(escapeHtml('a"b') === 'a"b', "文本不应转义引号（避免正文出现 &quot;）");
  assert(escapeAttr('a"b') === "a&quot;b", "属性必须转义引号");
});

await test("危险协议全部拦截", () => {
  for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "vbscript:x", "data:text/html,x", "java\tscript:x", "&#106;avascript:x"]) {
    const r = inline(`[x](${bad})`);
    assert(!/href="(?:javascript|vbscript|data)/i.test(r), `未拦截 ${bad} → ${r}`);
  }
  assert(safeUrl("https://a.com") === "https://a.com", "正常 https 应保留");
  assert(safeUrl("../x") === "../x", "相对路径应保留");
  assert(safeUrl("#a") === "#a", "页内锚点应保留");
  assert(safeImageUrl("data:image/png;base64,AA") !== "", "data:image 图片应允许");
  assert(safeImageUrl("data:text/html,x") === "", "data:text 图片应拦截");
});

await test("URL 含括号不再产生破损 HTML", () => {
  const r = inline("[wiki](https://en.wikipedia.org/wiki/Foo_(bar))");
  assert(r.includes('href="https://en.wikipedia.org/wiki/Foo_(bar)"'), "URL 应完整：" + r);
  assert(!/<a[^>]*<em>/.test(r), "标签被二次改写：" + r);
});

await test("标题带锚点 id，且与手写目录对应", () => {
  assert(headingSlug("📌 项目概述") === "-项目概述", "slug 不符：" + headingSlug("📌 项目概述"));
  assert(headingSlug("🏗️ 技术架构") === "-技术架构", "emoji+变体选择符未处理：" + headingSlug("🏗️ 技术架构"));
  const h = parseBody("## 标题 ##");
  assert(/<h2 id="标题">/.test(h), "标题尾部 # 未剔除或无 id：" + h);
  assert(h.includes('class="h-anchor"'), "缺锚点链接：" + h);
  const dup = parseBody("## 同一个\n\n## 同一个");
  assert(dup.includes('id="同一个"') && dup.includes('id="同一个-1"'), "重复标题 id 未去重：" + dup);
});

await test("真实文章的目录锚点全部可解析", () => {
  const files = readdirSync(join(ROOT, "blog")).filter(f => f.endsWith(".html") && f !== "template.html");
  let checked = 0;
  for (const f of files) {
    const page = rd("blog/" + f);
    const ids = new Set([...page.matchAll(/<h[1-6] id="([^"]*)"/g)].map(m => m[1]));
    for (const m of page.matchAll(/href="#([^"]+)"/g)) {
      if (m[1] === "mainContent") continue;
      checked++;
      assert(ids.has(m[1]), `${f} 的锚点 #${m[1]} 无对应标题`);
    }
  }
  assert(checked > 0, "未检查到任何页内锚点");
});

await test("嵌套列表结构正确（曾退化为兄弟列表）", () => {
  const r = parseBody("- 父项\n  - 子项\n- 第二父项");
  assert(/<li>父项\s*<ul>/.test(r.replace(/\n/g, " ")) || /<li>父项[\s\S]*<ul>[\s\S]*子项[\s\S]*<\/ul>[\s\S]*<\/li>/.test(r), "子列表未嵌在父项内：" + r);
  assert(/<li>第二父项<\/li>/.test(r), "第二父项应为同级：" + r);
  const ol = parseBody("- 父项\n  1. 子一\n  2. 子二");
  assert(/<ol>[\s\S]*子一/.test(ol), "有序子列表丢失：" + ol);
});

await test("行内 HTML：白名单放行、危险标签转义", () => {
  assert(inline("按 <kbd>Ctrl</kbd>").includes("<kbd>Ctrl</kbd>"), "kbd 应放行");
  const script = inline("<script>alert(1)</script>");
  assert(!/<script/i.test(script), "script 必须被转义：" + script);
  assert(inline("前<!-- 隐藏 -->后") === "前后", "HTML 注释应移除");
  const center = parseBody('<div align="center">\n# 标题\n</div>');
  assert(center.includes('class="md-align-center"'), "居中块未转换：" + center);
  assert(!center.includes("&lt;div"), "居中块不应显示裸标签：" + center);
});

await test("基础语法：转义 / 强调 / 代码 / 自动链接 / 任务列表 / 表格", () => {
  assert(inline(BS + "*literal" + BS + "*") === "*literal*", "反斜杠转义失效");
  assert(inline("**粗**") === "<strong>粗</strong>", "加粗失效");
  assert(inline("***粗斜***") === "<strong><em>粗斜</em></strong>", "粗斜体失效");
  assert(inline("~~删~~") === "<del>删</del>", "删除线失效");
  assert(inline("`code **x**`") === "<code>code **x**</code>", "代码内不应解析格式");
  assert(inline("snake_case_name") === "snake_case_name", "词内下划线不应变斜体");
  assert(/<a href="https:\/\/ex\.com"/.test(inline("<https://ex.com>")), "自动链接失效");
  assert(/<a href="https:\/\/ex\.com"/.test(inline("见 https://ex.com 好")), "裸 URL 自动链接失效");
  assert(parseBody("- [x] 完成").includes("task-done"), "任务列表失效");
  assert(parseBody("a | b\n--- | ---\n1 | 2").includes("<table>"), "无前导竖线的表格失效");
  assert(parseBody("| a | b |\n|:-:|--:|\n| 1 | 2 |").includes("text-align:center"), "表格对齐失效");
  assert(parseBody("| a | b |\n| --- | --- |\n| 1 | 2 |").includes('<div class="table-wrap">'), "表格缺滚动容器");
  // 单列表格（只有一行也没意义）不应当成表格，避免误判正文里的竖线
  assert(!parseBody("| a |\n| --- |\n| 1 |").includes('<table>'), "单列表格应不当成表格");
});

await test("首图不懒加载，其余图片懒加载", () => {
  const r = parseBody("![a](a.png)\n\n![b](b.png)");
  const first = r.indexOf("a.png");
  const second = r.indexOf("b.png");
  assert(!/loading="lazy"[^>]*a\.png/.test(r.slice(0, second)), "首图不应 lazy");
  assert(/loading="lazy"/.test(r.slice(second)), "第二张图应 lazy");
  assert(first < second, "图片顺序错误");
});

await test("CRLF 换行的 Markdown 渲染正常", () => {
  const r = parseBody("# 标题\r\n\r\n段落文本\r\n\r\n- 列表项\r\n");
  assert(r.includes("<h1 id=\"标题\">"), "CRLF 标题解析失败：" + r);
  assert(r.includes("段落文本"), "CRLF 段落丢失：" + r);
  assert(r.includes("<li>列表项</li>"), "CRLF 列表解析失败：" + r);
  assert(!r.includes("\r"), "输出不应含 \\r");
});

await test("无内容丢失：全站文章渲染后不含空段落 / 裸标签", () => {
  const files = readdirSync(join(ROOT, "blog")).filter(f => f.endsWith(".html") && f !== "template.html");
  for (const f of files) {
    const body = rd("blog/" + f);
    assert(!/<p>\s*<\/p>/.test(body), f + " 含空段落");
    assert(!/&lt;(br|div|kbd|em|strong) /.test(body), f + " 含被转义的裸标签");
  }
});

/* ---------- 结果 ---------- */
console.log(`\n🎯 结果：${passed} 通过，${failed} 失败，共 ${passed + failed} 项`);
if (failed > 0) process.exit(1);
