/* ============================================================
   tools/sync-from-remote.mjs —— 从远端仓库同步内容到本地

   用途：github.com git 协议不可用、而后台又产生了新提交时，
        本地会落后于远端。此时若直接在本地跑生成脚本并推送，
        会用陈旧内容覆盖线上（例如把用户新导入的知识库文档抹掉）。

   做法：用 gh api 拉取远端「派生内容」并写回本地。
        只同步由后台/生成脚本产出的文件，不动源码。

   用法：
     node tools/sync-from-remote.mjs          # 同步
     node tools/sync-from-remote.mjs --check  # 只报告差异，不写入
   ============================================================ */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const REPO = "ZhangYiFei12/zyf-blog";
const BRANCH = "main";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const ghJson = (p) => JSON.parse(execSync(`gh api "${p}"`, { encoding: "utf8", maxBuffer: 1 << 28 }));
const ghRaw = (p) => execSync(
  `gh api -H "Accept: application/vnd.github.raw" "repos/${REPO}/contents/${encodeURIComponent(p)}?ref=${BRANCH}"`,
  { encoding: "utf8", maxBuffer: 1 << 28 }
);
const ghRawBuf = (p) => execSync(
  `gh api -H "Accept: application/vnd.github.raw" "repos/${REPO}/contents/${encodeURIComponent(p)}?ref=${BRANCH}"`,
  { encoding: "buffer", maxBuffer: 1 << 28 }
);

function listDir(dir, ext) {
  try {
    const a = ghJson(`repos/${REPO}/contents/${dir}?ref=${BRANCH}`);
    return (Array.isArray(a) ? a : []).filter(f => f.name && (!ext || f.name.endsWith(ext))).map(f => f.name);
  } catch (e) { return []; }
}

const head = ghJson(`repos/${REPO}/git/ref/heads/${BRANCH}`).object.sha;
console.log("远端 head:", head.slice(0, 7), CHECK ? "（只检查）" : "");

let written = 0, same = 0, removed = 0;

function writeFile(rel, content, isBuf) {
  const abs = path.join(ROOT, rel);
  const old = fs.existsSync(abs) ? fs.readFileSync(abs, isBuf ? null : "utf8") : null;
  if (old !== null && (isBuf ? old.equals(content) : old === content)) { same++; return; }
  if (CHECK) { console.log("  ≠ " + rel); written++; return; }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, isBuf ? undefined : "utf8");
  console.log("  ↓ " + rel);
  written++;
}

/* 1) 知识库：docs/kb/*.md 与 kb/*.html */
const kbMd = listDir("docs/kb", ".md");
const kbHtml = listDir("kb", ".html");
for (const f of kbMd) writeFile(`docs/kb/${f}`, ghRaw(`docs/kb/${f}`));
for (const f of kbHtml) writeFile(`kb/${f}`, ghRaw(`kb/${f}`));

/* 2) 文章：blog/posts/*.md 与 blog/*.html */
const postMd = listDir("blog/posts", ".md");
const postHtml = listDir("blog", ".html");
for (const f of postMd) writeFile(`blog/posts/${f}`, ghRaw(`blog/posts/${f}`));
for (const f of postHtml) writeFile(`blog/${f}`, ghRaw(`blog/${f}`));

/* 3) 标签页 */
if (!CHECK) fs.mkdirSync(path.join(ROOT, "tags"), { recursive: true });
const tagFiles = listDir("tags", ".html");
for (const f of tagFiles) writeFile(`tags/${f}`, ghRaw(`tags/${f}`));

/* 4) 数据与 SEO 文件 */
for (const f of ["data/posts.json", "data/kb.json", "data/search-all.json", "data/search-index.json",
                 "data/gallery.json", "data/links.json", "data/projects.json", "data/downloads.json",
                 "sitemap.xml", "feed.xml", "manifest.json"]) {
  try { writeFile(f, ghRaw(f)); } catch (e) { /* 远端不存在则跳过 */ }
}

/* 5) 根页面（后台会改写列表区间） */
for (const f of ["index.html", "blog.html", "kb.html", "archive.html"]) {
  try { writeFile(f, ghRaw(f)); } catch (e) { /* 跳过 */ }
}

/* 6) 相册图片：按 gallery.json 补齐本地缺失的 */
try {
  const gal = JSON.parse(fs.readFileSync(path.join(ROOT, "data/gallery.json"), "utf8"));
  const want = [];
  for (const g of gal) {
    if (g.file) want.push("images/uploads/" + g.file);
    if (g.thumbUrl) {
      const t = String(g.thumbUrl).split("?")[0].replace(/^\/?images\/uploads\//, "");
      if (t) want.push("images/uploads/" + t);
    }
  }
  for (const rel of [...new Set(want)]) {
    if (fs.existsSync(path.join(ROOT, rel))) { same++; continue; }
    if (CHECK) { console.log("  ≠ " + rel + "（本地缺失）"); written++; continue; }
    writeFile(rel, ghRawBuf(rel), true);
  }
} catch (e) { /* gallery.json 不可用时跳过 */ }

/* 7) 清理本地已被远端删除的文件 */
function prune(dir, remoteList, ext) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return;
  for (const f of fs.readdirSync(abs)) {
    if (!f.endsWith(ext) || remoteList.includes(f)) continue;
    if (CHECK) { console.log("  ✗ 本地多余 " + dir + "/" + f); removed++; continue; }
    fs.unlinkSync(path.join(abs, f));
    console.log("  ✗ 删除本地残留 " + dir + "/" + f);
    removed++;
  }
}
prune("docs/kb", kbMd, ".md");
prune("kb", kbHtml, ".html");

console.log(`\n${CHECK ? "待更新" : "已更新"} ${written} 个 · 已一致 ${same} 个 · 清理 ${removed} 个`);
console.log("远端 head:", head.slice(0, 7));
