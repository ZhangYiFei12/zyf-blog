// 第三梯队回归测试：站内搜索 + 标签联动（浏览器）+ 核心函数草稿过滤（Node 单测）
// 用法：node tools/test-tier3.mjs
import { parseFrontMatter, buildPostsIndex, buildSitemap, buildRss, buildSearchIndex, listItemSnippet } from "./md2html-core.mjs";

const BASE = "http://localhost:4000";
const CDP = "http://localhost:9222";

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log("  ✅ " + name); } else { fail++; console.log("  ❌ " + name); } };

/* ---------- 1. Node 单测：草稿过滤 ---------- */
console.log("\n[1] 核心函数草稿过滤");
const draftMd = `---\ntitle: "草稿文章"\ndate: "2026-08-27"\nexcerpt: "这是一篇草稿"\npublished: false\ntags: ["随笔"]\n---\n\n草稿正文内容。\n`;
const pubMd = `---\ntitle: "正式文章"\ndate: "2026-08-26"\nexcerpt: "这是正式文章"\ntags: ["工具"]\n---\n\n正式正文。\n`;
const d = parseFrontMatter(draftMd);
const p = parseFrontMatter(pubMd);
ok("front matter 解析 published: false", d.meta.published === false);
ok("front matter 解析 published: true(默认)", p.meta.published === true);

const posts = [
  { slug: "draft-post", meta: d.meta, bodyHtml: "<p>草稿正文内容。</p>" },
  { slug: "pub-post", meta: p.meta, bodyHtml: "<p>正式正文。</p>" },
];
const idx = JSON.parse(buildPostsIndex(posts));
ok("posts.json 不含草稿", idx.length === 1 && idx[0].slug === "pub-post");
const sm = buildSitemap(posts);
ok("sitemap 不含草稿", !sm.includes("draft-post") && sm.includes("pub-post"));
const rss = buildRss(posts);
ok("feed.xml 不含草稿", !rss.includes("draft-post") && rss.includes("pub-post"));
const si = JSON.parse(buildSearchIndex(posts));
ok("search-index 不含草稿", si.length === 1 && si[0].slug === "pub-post");
ok("search-index text 为纯文本", !/<[^>]+>/.test(si[0].text));
const snip = listItemSnippet(d.meta, "draft-post");
ok("listItemSnippet 输出 data-tags", snip.includes('data-tags="随笔"'));
ok("listItemSnippet 草稿标记", snip.includes("草稿"));

/* ---------- 2. 浏览器测试：搜索框 ---------- */
console.log("\n[2] 站内搜索 UI（blog.html）");
const newTab = await fetch(CDP + "/json/new?" + encodeURIComponent(BASE + "/blog.html"), { method: "PUT" }).then(r => r.json());
const ws = new WebSocket(newTab.webSocketDebuggerUrl);
await new Promise(res => ws.addEventListener("open", res));
let msgId = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise(res => {
  const id = ++msgId;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
ws.addEventListener("message", ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});
await send("Runtime.enable");
await new Promise(r => setTimeout(r, 1500));

const evaluate = async expr => (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result.value;

// 初始状态：全部 6 篇可见
const total = await evaluate(`document.querySelectorAll('.post-item').length`);
ok("共 " + total + " 篇文章（静态列表）", total === 6);

// 输入搜索词
await evaluate(`(() => {
  const input = document.getElementById('searchInput');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'MirrorSync');
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
await new Promise(r => setTimeout(r, 500));
const visible1 = await evaluate(`Array.from(document.querySelectorAll('.post-item')).filter(i => i.style.display !== 'none').length`);
const title1 = await evaluate(`(() => { const v = Array.from(document.querySelectorAll('.post-item')).filter(i => i.style.display !== 'none'); return v.length ? v[0].textContent.trim().slice(0, 30) : ''; })()`);
ok("搜索 'MirrorSync' → 1 篇可见", visible1 === 1 && title1.includes("MirrorSync"));

// 搜索正文关键词（只有正文有的词，标题没有）
await evaluate(`(() => {
  const input = document.getElementById('searchInput');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '同步');
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
await new Promise(r => setTimeout(r, 500));
const visible2 = await evaluate(`Array.from(document.querySelectorAll('.post-item')).filter(i => i.style.display !== 'none').length`);
ok("搜索 '同步'（正文匹配）≥ 1 篇", visible2 >= 1);

// 清空 → 全部恢复
await evaluate(`(() => {
  const input = document.getElementById('searchInput');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '');
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
await new Promise(r => setTimeout(r, 500));
const visible3 = await evaluate(`Array.from(document.querySelectorAll('.post-item')).filter(i => i.style.display !== 'none').length`);
ok("清空搜索 → 全部恢复 (" + visible3 + ")", visible3 === total);

// 搜索 + 标签联动：先点「工具」chip，再搜索
await evaluate(`document.querySelector('#tagFilter .chip[data-tag="工具"]').click()`);
await new Promise(r => setTimeout(r, 300));
const visibleTag = await evaluate(`Array.from(document.querySelectorAll('.post-item')).filter(i => i.style.display !== 'none').length`);
ok("点「工具」chip → " + visibleTag + " 篇", visibleTag >= 3);
await evaluate(`(() => {
  const input = document.getElementById('searchInput');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'GeoRenamer');
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
await new Promise(r => setTimeout(r, 500));
const visibleCombo = await evaluate(`Array.from(document.querySelectorAll('.post-item')).filter(i => i.style.display !== 'none').length`);
ok("工具 chip + 搜索 GeoRenamer → 1 篇", visibleCombo === 1);

// 搜索无结果 → 空状态
await evaluate(`(() => {
  const input = document.getElementById('searchInput');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '不存在的关键词xyz');
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
await new Promise(r => setTimeout(r, 500));
const emptyText = await evaluate(`(() => { const e = document.getElementById('blogEmpty'); return e.style.display === 'block' ? e.textContent : ''; })()`);
ok("无结果 → 空状态提示", emptyText.includes("没有找到与"));

ws.close();
await fetch(CDP + "/json/close/" + newTab.id).catch(() => {});

/* ---------- 3. search-index.json 线上文件存在 ---------- */
console.log("\n[3] search-index.json 文件");
const fileRes = await fetch(BASE + "/data/search-index.json");
ok("GET /data/search-index.json = 200", fileRes.status === 200);
const fileIdx = await fileRes.json();
ok("search-index 有 " + fileIdx.length + " 条", fileIdx.length === 6);
ok("条目含 title/date/tags/text 字段", fileIdx.every(e => "title" in e && "date" in e && "tags" in e && "text" in e));

console.log(`\n========== 结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail ? 1 : 0);
