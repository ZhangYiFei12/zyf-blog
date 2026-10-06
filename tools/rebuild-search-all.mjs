/* 从远端仓库当前状态重建 data/search-all.json 并提交
 *
 * 用途：后台文章/知识库的增删改现在都会同步重建它（见 functions/api/admin.js），
 *      但在此之前存在的历史欠账需要补一次 —— 早先导入的知识库文档
 *      从未进入过全站搜索索引。
 *
 * 用法：node tools/rebuild-search-all.mjs [--dry]
 */
import { execSync } from "child_process";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { parseFrontMatter, parseBody, slugify, buildSearchAll } from "./md2html-core.mjs";

const REPO = "ZhangYiFei12/zyf-blog";
const BRANCH = "main";
const DRY = process.argv.includes("--dry");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let seq = 0;
function ghApi(args, body) {
  const opts = { encoding: "utf8", maxBuffer: 1024 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] };
  if (body !== undefined) {
    const tmp = join(ROOT, `_body-${process.pid}-${++seq}.json`);
    fs.writeFileSync(tmp, JSON.stringify(body));
    try { return execSync(`gh api ${args} --input "${tmp}"`, opts).trim(); }
    finally { fs.unlinkSync(tmp); }
  }
  return execSync(`gh api ${args}`, opts).trim();
}
const ghJson = (a, b) => JSON.parse(ghApi(a, b));
const ghRaw = (p) => execSync(`gh api -H "Accept: application/vnd.github.raw" "repos/${REPO}/contents/${encodeURIComponent(p)}?ref=${BRANCH}"`,
  { encoding: "utf8", maxBuffer: 1024 * 1024 * 1024 });

function listDir(dir) {
  try {
    const arr = ghJson(`repos/${REPO}/contents/${dir}?ref=${BRANCH}`);
    return (Array.isArray(arr) ? arr : []).filter(f => f.name && f.name.endsWith(".md")).map(f => f.name);
  } catch (e) { return []; }
}

console.log("从远端读取内容…");
const posts = [];
for (const name of listDir("blog/posts")) {
  const { meta, body } = parseFrontMatter(ghRaw(`blog/posts/${name}`));
  posts.push({ slug: slugify(name), name, meta, bodyHtml: parseBody(body) });
}
const kbDocs = [];
for (const name of listDir("docs/kb")) {
  const { meta, body } = parseFrontMatter(ghRaw(`docs/kb/${name}`));
  kbDocs.push({ slug: slugify(name), name, meta, bodyHtml: parseBody(body) });
}
console.log(`  文章 ${posts.length} 篇（已发布 ${posts.filter(p => p.meta.published !== false).length}）`);
console.log(`  知识库 ${kbDocs.length} 篇`);

const content = buildSearchAll(posts, kbDocs);
const parsed = JSON.parse(content);
console.log(`  生成索引 ${parsed.length} 条：`, parsed.reduce((m, e) => (m[e.typeName] = (m[e.typeName] || 0) + 1, m), {}));

if (DRY) {
  console.log("（--dry：不提交）");
  console.log(content.slice(0, 400));
  process.exit(0);
}

const head = ghJson(`repos/${REPO}/git/ref/heads/${BRANCH}`).object.sha;
const baseTree = ghJson(`repos/${REPO}/git/commits/${head}`).tree.sha;
const blob = ghJson(`repos/${REPO}/git/blobs`, { content: Buffer.from(content, "utf8").toString("base64"), encoding: "base64" });
const tree = ghJson(`repos/${REPO}/git/trees`, {
  base_tree: baseTree,
  tree: [{ path: "data/search-all.json", mode: "100644", type: "blob", sha: blob.sha }],
});
const commit = ghJson(`repos/${REPO}/git/commits`, {
  message: "🔍 补建全站搜索索引：纳入已导入的知识库文档\n\n后台知识库导入此前未同步 data/search-all.json，导致独立搜索页\n搜不到这些文档。本次按仓库当前状态整体重建一次。",
  tree: tree.sha,
  parents: [head],
});
const upd = ghJson(`repos/${REPO}/git/refs/heads/${BRANCH} -X PATCH`, { sha: commit.sha, force: false });
console.log("commit:", commit.sha.slice(0, 7), "| ref ->", upd.object.sha.slice(0, 7));
console.log("OK");
