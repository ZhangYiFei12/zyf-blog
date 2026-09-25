/* ============================================================
   tools/gen-pages.mjs —— 生成「派生页面」

   生成内容：
     · tags/<tag>.html   每个标签一个聚合页
     · archive.html      归档页（按年分组）
     · kb.html           知识库列表（标记区间替换）
     · sitemap.xml       站点地图（含标签页 / 归档页 / 知识库）
     · feed.xml          RSS
     · data/search-index.json
     · data/posts.json

   用法：node tools/gen-pages.mjs
   说明：后台（functions/api/admin.js）在发布/编辑/删除时会调用同样的
         核心函数，因此本脚本主要供本地批量重建使用。
   ============================================================ */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  parseFrontMatter, parseBody, slugify,
  buildKbPage, buildKbIndex, renderKbList, renderKbFilter,
  buildPostsIndex, buildSitemap, buildRss, buildSearchIndex,
  buildTagPage, buildArchivePage, collectTags,
} from "./md2html-core.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rd = p => readFileSync(join(ROOT, p), "utf8");
const wr = (p, s) => {
  const full = join(ROOT, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, s);
};

/* ---------- 1. 读取文章 ---------- */
const postsDir = join(ROOT, "blog", "posts");
const posts = [];
if (existsSync(postsDir)) {
  for (const f of readdirSync(postsDir).filter(f => f.endsWith(".md"))) {
    const raw = readFileSync(join(postsDir, f), "utf8");
    const { meta, body } = parseFrontMatter(raw);
    posts.push({ slug: slugify(f), name: f, meta, bodyHtml: parseBody(body) });
  }
}
posts.sort((a, b) => String(b.meta.date || "").localeCompare(String(a.meta.date || "")));

/* ---------- 2. 读取知识库文档 ---------- */
const kbDir = join(ROOT, "docs", "kb");
const kbDocs = [];
if (existsSync(kbDir)) {
  for (const f of readdirSync(kbDir).filter(f => f.endsWith(".md"))) {
    const raw = readFileSync(join(kbDir, f), "utf8");
    const { meta, body } = parseFrontMatter(raw);
    const slug = slugify(f);
    const bodyHtml = parseBody(body);
    kbDocs.push({ slug, name: f, meta, bodyHtml });
    wr(`kb/${slug}.html`, buildKbPage(meta, bodyHtml, { slug }));
  }
}
kbDocs.sort((a, b) => String(b.meta.date || "").localeCompare(String(a.meta.date || "")));

/* ---------- 3. 标签页 ---------- */
const tagsDir = join(ROOT, "tags");
if (existsSync(tagsDir)) rmSync(tagsDir, { recursive: true, force: true });
const tags = collectTags(posts);
for (const t of tags) {
  wr(`tags/${t.name}.html`, buildTagPage(t.name, posts));
}

/* ---------- 4. 归档页 ---------- */
wr("archive.html", buildArchivePage(posts));

/* ---------- 5. 知识库列表（标记区间替换） ---------- */
if (existsSync(join(ROOT, "kb.html"))) {
  let kbHtml = rd("kb.html");
  const put = (s, a, b, c) => {
    const i = s.indexOf(a), j = s.indexOf(b);
    if (i === -1 || j === -1) throw new Error(`kb.html 缺少标记 ${a} / ${b}`);
    return s.slice(0, i + a.length) + "\n" + c.trim() + "\n" + s.slice(j);
  };
  kbHtml = put(kbHtml, "<!-- KB-FILTER-START -->", "<!-- KB-FILTER-END -->", renderKbFilter(kbDocs));
  kbHtml = put(kbHtml, "<!-- KB-LIST-START -->", "<!-- KB-LIST-END -->", renderKbList(kbDocs));
  wr("kb.html", kbHtml);
}

/* ---------- 6. 数据与 SEO 文件 ---------- */
wr("data/posts.json", buildPostsIndex(posts));
wr("data/search-index.json", buildSearchIndex(posts));
wr("data/kb.json", buildKbIndex(kbDocs));
wr("sitemap.xml", buildSitemap(posts, undefined, kbDocs, tags));
wr("feed.xml", buildRss(posts));

/* ---------- 输出 ---------- */
console.log("✅ 派生页面已生成");
console.log(`   文章：${posts.length} 篇`);
console.log(`   知识库：${kbDocs.length} 篇`);
console.log(`   标签页：${tags.length} 个 ${tags.length ? "(" + tags.map(t => t.name + ":" + t.count).join(", ") + ")" : ""}`);
console.log(`   归档页：archive.html`);
console.log(`   数据：posts.json / search-index.json / kb.json`);
console.log(`   SEO：sitemap.xml / feed.xml`);
