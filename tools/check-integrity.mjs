/* ============================================================
   tools/check-integrity.mjs —— 仓库资源完整性检查

   检查项：
     1. 孤儿图片   images/uploads/ 中未被 gallery.json 或任何文章引用的文件
     2. 缺失图片   gallery.json / 文章引用了但文件不存在的图片
     3. 死链       HTML 页面内指向本地文件但目标不存在的链接
     4. 数据一致性 gallery.json 的 size/thumbSize 与真实文件字节是否相符

   用法：node tools/check-integrity.mjs [--json]
   退出码：0 = 无问题；1 = 发现问题（可用于 CI / 提交前自检）
   ============================================================ */
import { readFileSync, existsSync, statSync, readdirSync } from "fs";
import { resolve, dirname, basename, join, extname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const JSON_OUT = process.argv.includes("--json");

const SKIP_DIRS = new Set([".git", ".next", "node_modules", ".wrangler", "out", "dist", "build"]);
const IMG_EXT = /\.(jpe?g|png|gif|webp|avif|svg|mp4|webm)$/i;

const problems = [];
const report = { orphans: [], missing: [], deadLinks: [], sizeMismatch: [] };

function rel(p) {
  return p.replace(ROOT, "").replace(/\\/g, "/").replace(/^\//, "");
}

/* ---------- 收集页面 ---------- */
const pages = [];
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) pages.push(p);
  }
}
walk(ROOT);

/* ---------- 1 & 2. 图片：孤儿与缺失 ---------- */
const uploadsDir = join(ROOT, "images", "uploads");
const onDisk = existsSync(uploadsDir)
  ? readdirSync(uploadsDir).filter(f => IMG_EXT.test(f))
  : [];

const referenced = new Set();
const galleryPath = join(ROOT, "data", "gallery.json");
let gallery = [];
if (existsSync(galleryPath)) {
  try {
    gallery = JSON.parse(readFileSync(galleryPath, "utf8"));
    if (!Array.isArray(gallery)) gallery = [];
  } catch (e) {
    problems.push(`data/gallery.json 解析失败：${e.message}`);
  }
}

// gallery.json 引用
for (const g of gallery) {
  for (const key of ["url", "thumbUrl"]) {
    if (g && g[key]) {
      const name = basename(String(g[key]));
      referenced.add(name);
      if (!existsSync(join(uploadsDir, name))) {
        report.missing.push({ from: "gallery.json", ref: g[key], file: name });
      }
    }
  }
}

// 文章（md 与生成的 html）内引用
for (const p of pages.concat(
  (() => {
    const mdDir = join(ROOT, "blog", "posts");
    return existsSync(mdDir)
      ? readdirSync(mdDir).filter(f => f.endsWith(".md")).map(f => join(mdDir, f))
      : [];
  })()
)) {
  const text = readFileSync(p, "utf8");
  for (const m of text.matchAll(/images\/uploads\/([^"'\s)\]]+)/g)) {
    const name = decodeURIComponent(m[1]);
    referenced.add(name);
    if (!existsSync(join(uploadsDir, name))) {
      report.missing.push({ from: rel(p), ref: m[0], file: name });
    }
  }
}

for (const f of onDisk) {
  if (!referenced.has(f)) {
    let size = 0;
    try { size = statSync(join(uploadsDir, f)).size; } catch (e) {}
    report.orphans.push({ file: f, size });
  }
}

/* ---------- 3. 死链（本地相对链接） ---------- */
for (const p of pages) {
  if (rel(p).startsWith("admin")) continue; // 后台是单页，链接由 JS 生成
  const html = readFileSync(p, "utf8");
  const dir = dirname(p);
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const raw = m[1];
    if (/^(https?:|mailto:|tel:|data:|javascript:|\/\/|#)/.test(raw)) continue;
    if (raw.includes("' +") || raw.includes('" +')) continue; // 模板字符串片段
    const clean = raw.split("?")[0].split("#")[0];
    if (!clean) continue;
    let decoded;
    try { decoded = decodeURIComponent(clean); } catch (e) { decoded = clean; }
    const target = resolve(dir, decoded);
    if (!existsSync(target)) {
      report.deadLinks.push({ page: rel(p), href: raw });
    }
  }
}

/* ---------- 4. gallery.json 体积一致性 ---------- */
for (const g of gallery) {
  if (!g) continue;
  if (g.url) {
    const f = join(uploadsDir, basename(String(g.url)));
    if (existsSync(f) && typeof g.size === "number" && g.size > 0) {
      const real = statSync(f).size;
      if (real !== g.size) {
        report.sizeMismatch.push({ file: basename(String(g.url)), recorded: g.size, real });
      }
    }
  }
  if (g.thumbUrl) {
    const f = join(uploadsDir, basename(String(g.thumbUrl)));
    if (existsSync(f) && typeof g.thumbSize === "number" && g.thumbSize > 0) {
      const real = statSync(f).size;
      if (real !== g.thumbSize) {
        report.sizeMismatch.push({ file: basename(String(g.thumbUrl)), recorded: g.thumbSize, real });
      }
    }
  }
}

/* ---------- 输出 ---------- */
const totalProblems =
  report.orphans.length + report.missing.length + report.deadLinks.length + report.sizeMismatch.length;

if (JSON_OUT) {
  console.log(JSON.stringify({ ...report, problems, totalProblems }, null, 2));
  process.exit(totalProblems > 0 ? 1 : 0);
}

const fmtSize = n => (n >= 1048576 ? (n / 1048576).toFixed(2) + "MB" : (n / 1024).toFixed(0) + "KB");

console.log("🔍 仓库资源完整性检查\n");

console.log(`【孤儿图片】${report.orphans.length} 个`);
if (report.orphans.length) {
  const total = report.orphans.reduce((s, o) => s + o.size, 0);
  report.orphans.forEach(o => console.log(`   ⚠️  ${o.file}  (${fmtSize(o.size)})`));
  console.log(`   合计可回收：${fmtSize(total)}`);
} else {
  console.log("   ✅ 无");
}

console.log(`\n【缺失图片】${report.missing.length} 个`);
report.missing.forEach(m => console.log(`   ❌ ${m.from} 引用 ${m.ref} 但文件不存在`));
if (!report.missing.length) console.log("   ✅ 无");

console.log(`\n【死链】${report.deadLinks.length} 个`);
report.deadLinks.forEach(d => console.log(`   ❌ ${d.page} -> ${d.href}`));
if (!report.deadLinks.length) console.log("   ✅ 无");

console.log(`\n【体积记录不一致】${report.sizeMismatch.length} 个`);
report.sizeMismatch.forEach(s => console.log(`   ⚠️  ${s.file}  记录 ${s.recorded} / 实际 ${s.real}`));
if (!report.sizeMismatch.length) console.log("   ✅ 无");

console.log(`\n统计：页面 ${pages.length} 个 · 上传图片 ${onDisk.length} 个 · 相册记录 ${gallery.length} 条`);

if (totalProblems === 0) {
  console.log("\n🎯 全部通过，未发现问题");
} else {
  console.log(`\n🎯 发现 ${totalProblems} 个问题`);
}
process.exit(totalProblems > 0 ? 1 : 0);
