#!/usr/bin/env node
/* ============================================================
   md2html.mjs —— Markdown 一键生成博客页面工具（零依赖 CLI）
   渲染逻辑已抽到 md2html-core.mjs，供 CLI 与后台共用

   用法：
     node tools/md2html.mjs                 # 处理 blog/posts/ 下所有 .md
     node tools/md2html.mjs 我的文章.md      # 处理单个文件
     node tools/md2html.mjs -w              # 处理所有并监听变化（可选）

   输入： blog/posts/文章名.md   （支持 front matter）
   输出： blog/文章名.html
   ============================================================ */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "fs";
import { dirname, join, basename, resolve } from "path";
import { fileURLToPath } from "url";

import { parseFrontMatter, parseBody, buildPage, slugify, listItemSnippet, buildPostsIndex, buildSitemap, buildRss, buildSearchIndex } from "./md2html-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, ".."); // 项目根目录
const POSTS_DIR = join(ROOT, "blog", "posts");
const OUT_DIR = join(ROOT, "blog");

function convertFile(filePath) {
  const raw = readFileSync(filePath, "utf8").replace(/\r/g, "");
  const { meta, body } = parseFrontMatter(raw);
  const bodyHtml = parseBody(body);
  const slug = slugify(basename(filePath));
  const html = buildPage(meta, bodyHtml, { slug });
  const outFile = join(OUT_DIR, slug + ".html");
  writeFileSync(outFile, html, "utf8");
  return { meta, slug, bodyHtml, outFile };
}

/* 写 data/posts.json + sitemap.xml（供客户端上一篇/下一篇与搜索引擎使用） */
function writeSiteData(posts) {
  const sorted = posts.slice().sort((a, b) => String(b.meta.date || "").localeCompare(String(a.meta.date || "")));
  const dataDir = join(ROOT, "data");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, "posts.json"), buildPostsIndex(sorted), "utf8");
  writeFileSync(join(ROOT, "sitemap.xml"), buildSitemap(sorted), "utf8");
  writeFileSync(join(ROOT, "feed.xml"), buildRss(sorted), "utf8");
  writeFileSync(join(dataDir, "search-index.json"), buildSearchIndex(sorted), "utf8");
  console.log(`✔ 已写入  data/posts.json（${sorted.length} 篇） + sitemap.xml + feed.xml + search-index.json`);
}

function main() {
  const args = process.argv.slice(2);
  let targets = [];
  let watch = false;

  for (const a of args) {
    if (a === "-w" || a === "--watch") watch = true;
    else targets.push(a);
  }

  // 收集 .md 文件
  const files = [];
  for (const t of targets) {
    const p = resolve(process.cwd(), t);
    if (statSync(p).isDirectory()) {
      files.push(...readdirSync(p).filter(f => f.endsWith(".md")).map(f => join(p, f)));
    } else {
      files.push(p);
    }
  }
  if (!files.length) {
    mkdirSync(POSTS_DIR, { recursive: true });
    files.push(...readdirSync(POSTS_DIR).filter(f => f.endsWith(".md")).map(f => join(POSTS_DIR, f)));
  }
  if (!files.length) {
    console.log("⚠️  没有找到 .md 文件。请在 blog/posts/ 目录放置 Markdown 文章。");
    return;
  }

  const converted = [];
  for (const f of files) {
    const { meta, slug, bodyHtml, outFile } = convertFile(f);
    converted.push({ meta, slug, bodyHtml });
    console.log(`✔ 已生成  ${outFile.replace(ROOT + "/", "")}`);
    console.log(`   标题: ${meta.title} · 日期: ${meta.date || "(默认今天)"}`);
    console.log("");
    console.log("  📋 把下面这段复制到 blog.html 的“全部文章”区域：");
    console.log("  " + "-".repeat(60));
    console.log(listItemSnippet(meta, slug));
    console.log("  " + "-".repeat(60));
    console.log("");
  }
  writeSiteData(converted);

  if (watch) {
    console.log("👀 监听中（Ctrl+C 退出）...");
    const watcher = setInterval(() => {
      for (const f of files) {
        try {
          const { outFile } = convertFile(f);
          process.stdout.write(`✔ 已更新 ${outFile.replace(ROOT + "/", "")} @ ${new Date().toLocaleTimeString()}\n`);
        } catch (e) { /* 忽略写入中的临时状态 */ }
      }
    }, 2000);
    process.on("SIGINT", () => { clearInterval(watcher); process.exit(0); });
  }
}

main();
