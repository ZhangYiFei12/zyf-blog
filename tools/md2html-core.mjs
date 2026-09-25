/* ============================================================
   md2html-core.mjs —— Markdown 渲染核心（纯函数，无 Node 依赖）
   供 CLI（md2html.mjs）与 Cloudflare Pages 后台函数共用
   ============================================================ */

/* ---------- Front Matter 解析 ---------- */
export function parseFrontMatter(raw) {
  const meta = { title: "", date: "", excerpt: "", tags: [], published: true, category: "" };
  // 统一行尾（CRLF/CR → LF），否则正则的 $ 无法匹配行尾的 \r
  raw = String(raw == null ? "" : raw).replace(/\r\n?/g, "\n");
  if (raw.startsWith("---")) {
    const end = raw.indexOf("\n---", 3);
    if (end !== -1) {
      const fm = raw.slice(3, end).trim();
      const body = raw.slice(end + 4);
      for (const line of fm.split("\n")) {
        const m = line.match(/^([a-zA-Z_]+)\s*:\s*(.*)$/);
        if (!m) continue;
        const key = m[1].toLowerCase();
        let val = m[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (key === "tags") {
          meta.tags = val.replace(/^\[|\]$/g, "").split(/[,，]/).map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
        } else if (key === "published") {
          meta.published = String(val).toLowerCase() !== "false";
        } else if (key in meta) {
          meta[key] = val;
        }
      }
      return { meta, body: body.trim() };
    }
  }
  // 无 front matter：从内容第一行推标题
  const firstLine = raw.split("\n").find(l => l.trim().length);
  meta.title = firstLine ? firstLine.replace(/^#+\s*/, "").trim() : raw.split("/").pop().replace(/\.md$/i, "").trim();
  return { meta, body: raw.trim() };
}

/* ---------- HTML 转义 ---------- */
export function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/* ---------- 行内格式 ---------- */
export function inline(text) {
  let s = escapeHtml(text);
  // 行内代码（用占位符保护）
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return "\u0000C" + (codes.length - 1) + "\u0000";
  });
  // 图片 ![alt](src)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<img src="$2" alt="$1" />');
  // 链接 [text](url)（页内锚点 # 或相对路径不加 target=_blank）
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) =>
    /^#|^\./ .test(u) ? `<a href="${u}">${t}</a>` : `<a href="${u}" target="_blank" rel="noopener">${t}</a>`
  );
  // 加粗
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // 删除线
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  // 斜体
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");
  // 还原行内代码
  s = s.replace(/\u0000C(\d+)\u0000/g, (_, i) => `<code>${codes[+i]}</code>`);
  return s;
}

/* ---------- 块级解析 ---------- */
export function parseBody(md) {
  const lines = md.split("\n");
  const html = [];
  let i = 0;
  let guard = 0;

  function collectParagraph() {
    const buf = [];
    while (i < lines.length) {
      const l = lines[i];
      if (l.trim() === "") break;
      if (/^#{1,6}\s/.test(l) || /^```/.test(l) || /^~~~/.test(l)) break;
      if (/^\s*(>|[-*+]|\d+\.|\|)/.test(l)) break;
      buf.push(l);
      i++;
    }
    return buf;
  }

  function renderList() {
    const items = [];
    while (i < lines.length) {
      const l = lines[i];
      const m = l.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
      if (!m) break;
      const ordered = m[2] !== "-" && m[2] !== "*" && m[2] !== "+";
      const indent = m[1].replace(/\t/g, "  ").length;
      items.push({ indent, ordered, text: m[3], raw: l });
      i++;
      while (i < lines.length && /^\s+[-*+]|^\d+\.\s/.test(lines[i])) {
        const s = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
        if (!s) break;
        const subIndent = s[1].replace(/\t/g, "  ").length;
        if (subIndent <= indent) break;
        if (subIndent - indent > 4) break;
        items.push({ indent: subIndent, ordered: s[2] !== "-" && s[2] !== "*" && s[2] !== "+", text: s[3], raw: lines[i] });
        i++;
      }
    }
    let out = "";
    let curIndent = -1;
    let curList = null;
    for (const it of items) {
      if (curIndent !== it.indent) {
        if (curList) out += `</${curList}>\n`;
        curList = it.ordered ? "ol" : "ul";
        out += `<${curList}>\n`;
        curIndent = it.indent;
      }
      out += `  <li>${inline(it.text)}</li>\n`;
    }
    if (curList) out += `</${curList}>\n`;
    return out;
  }

  function renderTable() {
    const header = lines[i].split("|").map(c => c.trim()).filter((c, idx, arr) => !(idx === 0 && c === "") && !(idx === arr.length - 1 && c === ""));
    i++;
    if (i >= lines.length || !/^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i].replace(/[^|\-: ]/g, ""))) {
      i--;
      return "";
    }
    i++;
    const rows = [];
    while (i < lines.length && lines[i].trim() !== "" && lines[i].includes("|")) {
      const cells = lines[i].split("|").map(c => c.trim()).filter((c, idx, arr) => !(idx === 0 && c === "") && !(idx === arr.length - 1 && c === ""));
      rows.push(cells);
      i++;
    }
    let out = "<table>\n<thead><tr>";
    for (const h of header) out += `<th>${inline(h)}</th>`;
    out += "</tr></thead>\n<tbody>\n";
    for (const r of rows) {
      out += "<tr>";
      for (const c of r) out += `<td>${inline(c)}</td>`;
      out += "</tr>\n";
    }
    out += "</tbody>\n</table>\n";
    return out;
  }

  while (i < lines.length) {
    if (++guard > lines.length * 20 + 100000) {
      break;
    }
    const l = lines[i];

    if (/^```/.test(l) || /^~~~/.test(l)) {
      const fence = l.match(/^(`{3,}|~{3,})\s*([a-zA-Z0-9_+-]*)/)[1];
      const lang = l.match(/^(`{3,}|~{3,})\s*([a-zA-Z0-9_+-]*)/)[2];
      i++;
      const code = [];
      while (i < lines.length && !lines[i].startsWith(fence)) {
        code.push(lines[i]);
        i++;
      }
      i++;
      html.push(`<pre><code${lang ? ` class="language-${lang}"` : ""}>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const h = l.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      html.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
      i++;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) {
      html.push("<hr />");
      i++;
      continue;
    }

    if (/^\s*>\s?/.test(l)) {
      const quote = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      html.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
      continue;
    }

    if (/^\s*([-*+]|\d+\.)\s+/.test(l)) {
      html.push(renderList());
      continue;
    }

    if (l.includes("|") && /^\s*\|/.test(l)) {
      html.push(renderTable());
      continue;
    }

    if (l.trim() !== "") {
      const para = collectParagraph();
      if (para.length) {
        html.push(`<p>${inline(para.join("<br />\n"))}</p>`);
        continue;
      }
    }

    i++;
  }

  return html.join("\n\n");
}

/* ---------- 文章片段（预览与生产共用，保证所见即所得） ---------- */
export function buildArticlePreview(meta, bodyHtml) {
  const today = new Date().toISOString().slice(0, 10);
  const date = meta.date || today;
  const tags = Array.isArray(meta.tags) && meta.tags.length
    ? meta.tags.join(" · ")
    : "随笔";
  const mins = readingMinutes(bodyHtml);
  return `    <article>
      <header class="article-header">
        <h1>${escapeHtml(meta.title)}</h1>
        <div class="article-meta">
          <span>📅 ${escapeHtml(date)}</span>
          <span>🏷️ ${escapeHtml(tags)}</span>
          <span>⏱️ 约 ${mins} 分钟</span>
        </div>
      </header>

      <div class="article-body">
${bodyHtml}
      </div>
    </article>`;
}

/* ---------- 阅读时长估算 ----------
 * 中英文混排：中文按 350 字/分，英文按 200 词/分，取合计向上取整。
 * 入参可以是 HTML（生产/预览）或纯文本。
 */
export function readingMinutes(input) {
  const text = String(input || "")
    .replace(/<pre[\s\S]*?<\/pre>/gi, " ")   // 代码块不计入阅读时长
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return 1;
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const words = (text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, " ").match(/[A-Za-z0-9']+/g) || []).length;
  const minutes = cjk / 350 + words / 200;
  return Math.max(1, Math.ceil(minutes));
}

/* ---------- SEO：canonical + JSON-LD 结构化数据 ---------- */
function jsonLdScript(obj) {
  // 转义 </script> 防止提前闭合
  const json = JSON.stringify(obj).replace(/<\//g, "\\u003c/");
  return `  <script type="application/ld+json">${json}</script>`;
}

function buildArticleJsonLd(meta, opts) {
  const SITE = opts.site || "https://zyf2026.pages.dev";
  const url = opts.url;
  const tags = Array.isArray(meta.tags) ? meta.tags.filter(Boolean) : [];
  const ld = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: meta.title,
    description: meta.excerpt || meta.desc || meta.title,
    datePublished: meta.date || undefined,
    dateModified: meta.updated || meta.date || undefined,
    author: { "@type": "Organization", name: opts.author || "ZH", url: SITE + "/about.html" },
    publisher: {
      "@type": "Organization",
      name: "ZH 博客",
      logo: { "@type": "ImageObject", url: SITE + "/images/avatar.png" },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: SITE + "/images/avatar.png",
    inLanguage: "zh-CN",
    url,
  };
  if (tags.length) ld.keywords = tags.join(", ");
  return ld;
}

function buildBreadcrumbJsonLd(site, items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

/* ---------- 页面模板 ---------- */
export function buildPage(meta, bodyHtml, opts = {}) {
  const excerpt = meta.excerpt || meta.title;
  const slug = opts.slug ? String(opts.slug) : "";
  const SITE = "https://zyf2026.pages.dev";
  const pageUrl = slug ? `${SITE}/blog/${slug}.html` : SITE + "/";
  const articleHtml = buildArticlePreview(meta, bodyHtml);
  const jsonLd = [
    buildArticleJsonLd(meta, { url: pageUrl, site: SITE }),
    buildBreadcrumbJsonLd(SITE, [
      { name: "首页", url: SITE + "/" },
      { name: "博客", url: SITE + "/blog.html" },
      { name: meta.title, url: pageUrl },
    ]),
  ].map(jsonLdScript).join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(meta.title)} | ZH</title>
  <meta name="description" content="${escapeAttr(excerpt)}" />
  <link rel="canonical" href="${escapeAttr(pageUrl)}" />
  <link rel="stylesheet" href="../css/style.css?v=25" />
  <link rel="icon" type="image/png" href="../images/avatar.png" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeAttr(meta.title)}" />
  <meta property="og:description" content="${escapeAttr(excerpt)}" />
  <meta property="og:url" content="${escapeAttr(pageUrl)}" />
  <meta property="og:image" content="${SITE}/images/avatar.png" />
  <meta property="og:site_name" content="ZH 博客" />
  <meta name="twitter:card" content="summary" />
${jsonLd}
  <script>try{var t=localStorage.getItem("zyf-theme");if(t==="light"||(!t&&window.matchMedia("(prefers-color-scheme: light)").matches))document.documentElement.setAttribute("data-theme","light")}catch(e){}</script>
</head>
<body>

  <a class="skip-link" href="#mainContent">跳到主要内容</a>

  <div class="reading-progress" id="readingProgress"></div>

  <nav class="navbar">
    <div class="nav-inner">
      <a href="../index.html" class="brand">
        <span class="prompt">&gt;_</span>ZH<span class="cursor"></span>
      </a>
      <ul class="nav-links" id="navLinks">
        <li><a href="../index.html">首页</a></li>
        <li><a href="../blog.html">博客</a></li>
        <li><a href="../projects.html">项目</a></li>
        <li><a href="../about.html">关于</a></li>
        <li><a href="../downloads.html">下载</a></li>
        <li><a href="../gallery.html">相册</a></li>
        <li><a href="../kb.html">知识库</a></li>
      </ul>
      <div class="nav-actions">
        <button class="theme-toggle" id="themeToggle" aria-label="切换主题" title="切换深浅色主题">☀</button>
        <button class="nav-toggle" id="navToggle" aria-label="菜单" aria-expanded="false" aria-controls="navLinks">☰ 菜单</button>
      </div>
    </div>
  </nav>

  <main class="container article" id="mainContent">

${articleHtml}

${buildShareRow(meta.title, pageUrl)}

${relatedPlaceholder("相关文章")}

    <nav class="post-nav" id="postNav"></nav>

    <a class="back-link" href="../blog.html">返回博客列表</a>

  </main>

  <footer class="footer">
    <div class="container">
      <p>© <span data-year>2025</span> ZH · Built with <span class="heart">♥</span> and a lot of coffee</p>
      <p style="margin-top:6px;font-size:11px;color:#4b5a6e;">&gt;_ ZH · 用代码记录世界</p>
    </div>
  </footer>

  <button class="back-top" id="backTop" aria-label="返回顶部" title="返回顶部">↑</button>
  <script src="../js/main.js?v=22"></script>
</body>
</html>
`;
}

/* ---------- 分享按钮（文章页 / 知识库页共用） ---------- */
export function buildShareRow(title, url) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const xHref = escapeAttr(`https://twitter.com/intent/tweet?url=${u}&text=${t}`);
  const wbHref = escapeAttr(`https://service.weibo.com/share/share.php?url=${u}&title=${t}`);
  return `    <div class="share-row" data-share-url="${escapeAttr(url)}" data-share-title="${escapeAttr(title)}">
      <span class="share-label">分享</span>
      <button type="button" class="share-btn" data-share="copy">🔗 复制链接</button>
      <a class="share-btn" href="${xHref}" target="_blank" rel="noopener noreferrer">𝕏 推特</a>
      <a class="share-btn" href="${wbHref}" target="_blank" rel="noopener noreferrer">微博</a>
      <button type="button" class="share-btn" data-share="native" hidden>系统分享…</button>
    </div>`;
}

/* 相关文章容器（内容由 main.js 按标签重合度客户端填充） */
export function relatedPlaceholder(label) {
  return `    <section class="related" id="relatedPosts" hidden aria-label="${escapeAttr(label || "相关文章")}"></section>`;
}

/* ---------- 工具 ---------- */
export function slugify(name) {
  return name
    .replace(/\.md$/i, "")
    .replace(/[^\p{L}\p{N}\s\-_]/gu, "") // 去掉 emoji/符号，保留字母数字、CJK、空格、-、_
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function listItemSnippet(meta, slug) {
  const date = meta.date || new Date().toISOString().slice(0, 10);
  const excerpt = meta.excerpt || meta.title;
  const tags = meta.tags && meta.tags.length ? meta.tags : ["随笔"];
  const tagStr = tags.map(t => `            <span class="tag">${t}</span>`).join("\n");
  const dataTags = escapeAttr(tags.join(" "));
  return `      <a class="post-item" href="blog/${slug}.html" data-tags="${dataTags}">
        <div class="post-left">
          <span class="post-title">${meta.title}</span>
          <span class="post-excerpt">${excerpt}</span>
          <div class="post-tags">
${tagStr}
          </div>
        </div>
        <span class="post-date">${date}</span>
      </a>`;
}

/* ---------- 项目卡片（后台与生产共用） ---------- */
export function buildProjectCard(p) {
  const featured = p.featured ? '          <span class="featured-badge">★ 精选</span>\n' : "";
  const titleLink = p.url
    ? `<a href="${escapeAttr(p.url)}">${escapeHtml(p.title)}</a>`
    : escapeHtml(p.title);
  const tagStr = (p.tags && p.tags.length ? p.tags : [])
    .map(t => `            <span class="tag">${escapeHtml(t)}</span>`)
    .join("\n");
  const meta = tagStr ? `          <div class="meta">\n${tagStr}\n          </div>` : "";
  const links = [];
  if (p.previewUrl) links.push(`            <a href="${escapeAttr(p.previewUrl)}" target="_blank" rel="noopener">↗ 在线预览</a>`);
  if (p.sourceUrl) links.push(`            <a href="${escapeAttr(p.sourceUrl)}" target="_blank" rel="noopener">◈ 源码</a>`);
  const linksHtml = links.length ? `          <div class="links">\n${links.join("\n")}\n          </div>` : "";
  return `        <div class="card reveal">
${featured}          <span class="year">${escapeHtml(p.year || "")}</span>
          <h3>${titleLink}</h3>
          <p class="desc">${escapeHtml(p.description || "")}</p>
${meta}
${linksHtml}
        </div>`;
}

export function buildFeaturedCard(p) {
  const tagStr = (p.tags && p.tags.length ? p.tags : [])
    .map(t => `            <span class="tag">${escapeHtml(t)}</span>`)
    .join("\n");
  const meta = tagStr ? `          <div class="meta">\n${tagStr}\n          </div>` : "";
  return `        <div class="card reveal">
          <span class="featured-badge">★ 精选</span>
          <span class="year">${escapeHtml(p.year || "")}</span>
          <h3><a href="projects.html">${escapeHtml(p.title)}</a></h3>
          <p class="desc">${escapeHtml(p.description || "")}</p>
${meta}
        </div>`;
}

export function renderFeatured(projects) {
  return (Array.isArray(projects) ? projects : [])
    .filter(p => p.published !== false && p.featured) // 草稿不渲染到首页精选区
    .map(p => buildFeaturedCard(p))
    .join("\n\n");
}

export function renderProjects(projects) {
  return (Array.isArray(projects) ? projects : [])
    .filter(p => p.published !== false) // 草稿不渲染到公开 projects.html
    .map(p => buildProjectCard(p))
    .join("\n\n");
}

/* ---------- 文章索引（data/posts.json，供客户端上一篇/下一篇、搜索等使用） ---------- */
export function buildPostsIndex(posts) {
  const list = (Array.isArray(posts) ? posts : [])
    .filter(p => p.meta.published !== false) // 草稿不出现在公开索引
    .map(p => ({ slug: p.slug, title: p.meta.title, date: p.meta.date || "", tags: p.meta.tags || [] }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return JSON.stringify(list, null, 2) + "\n";
}

/* ---------- RSS feed.xml ---------- */
export function buildRss(posts, base = "https://zyf2026.pages.dev") {
  const rfc822 = d => {
    const date = d ? new Date(String(d) + "T00:00:00Z") : new Date();
    if (isNaN(date.getTime())) return new Date().toUTCString();
    return date.toUTCString();
  };
  const items = (Array.isArray(posts) ? posts : [])
    .filter(p => p.meta.published !== false)
    .sort((a, b) => String(b.meta.date || "").localeCompare(String(a.meta.date || "")))
    .map(p => {
      const url = `${base}/blog/${p.slug}.html`;
      const desc = (p.meta.excerpt || p.meta.title || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const title = String(p.meta.title || p.slug).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `    <item>\n      <title>${title}</title>\n      <link>${url}</link>\n      <guid isPermaLink="true">${url}</guid>\n      <pubDate>${rfc822(p.meta.date)}</pubDate>\n      <description>${desc}</description>\n    </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    <title>ZH | 个人博客</title>\n    <link>${base}/blog.html</link>\n    <description>ZH 的个人博客：技术分享、项目实践与生活随笔。</description>\n    <language>zh-CN</language>\n    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml" />\n${items}\n  </channel>\n</rss>\n`;
}

/* ---------- 站点地图 sitemap.xml ---------- */
export function buildSitemap(posts, base = "https://zyf2026.pages.dev", kbDocs = null, tags = null) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: base + "/", lastmod: today, pri: "1.0", freq: "weekly" },
    { loc: base + "/blog.html", lastmod: today, pri: "0.8", freq: "weekly" },
    { loc: base + "/archive.html", lastmod: today, pri: "0.7", freq: "weekly" },
    { loc: base + "/projects.html", lastmod: today, pri: "0.8", freq: "monthly" },
    { loc: base + "/downloads.html", lastmod: today, pri: "0.8", freq: "monthly" },
    { loc: base + "/gallery.html", lastmod: today, pri: "0.6", freq: "monthly" },
    { loc: base + "/kb.html", lastmod: today, pri: "0.8", freq: "weekly" },
    { loc: base + "/about.html", lastmod: today, pri: "0.6", freq: "monthly" },
  ];
  for (const p of (Array.isArray(posts) ? posts : [])) {
    if (p.meta.published === false) continue; // 草稿不进 sitemap
    urls.push({
      loc: base + "/blog/" + encodeURIComponent(p.slug) + ".html",
      lastmod: p.meta.date || today,
      pri: "0.7",
      freq: "monthly",
    });
  }
  for (const d of (Array.isArray(kbDocs) ? kbDocs : [])) {
    urls.push({
      loc: base + "/kb/" + encodeURIComponent(d.slug) + ".html",
      lastmod: (d.meta && d.meta.date) || today,
      pri: "0.6",
      freq: "monthly",
    });
  }
  for (const t of (Array.isArray(tags) ? tags : [])) {
    const name = typeof t === "string" ? t : t.name;
    if (!name) continue;
    urls.push({
      loc: base + "/tags/" + encodeURIComponent(name) + ".html",
      lastmod: today,
      pri: "0.5",
      freq: "weekly",
    });
  }
  const body = urls
    .map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.pri}</priority>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/* ---------- 搜索索引（data/search-index.json，客户端全文搜索用） ---------- */
export function buildSearchIndex(posts) {
  const stripHtml = html =>
    String(html || "")
      .replace(/&lt;[^>]+&gt;/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  const list = (Array.isArray(posts) ? posts : [])
    .filter(p => p.meta.published !== false)
    .map(p => ({
      slug: p.slug,
      title: p.meta.title || "",
      date: p.meta.date || "",
      tags: p.meta.tags || [],
      // 搜索文本含摘要 + 正文，避免摘要里的关键词搜不到
      text: [p.meta.excerpt || "", stripHtml(p.bodyHtml)].filter(Boolean).join(" ").slice(0, 800),
    }));
  return JSON.stringify(list) + "\n";
}

/* ---------- 组合：输入 Markdown → 输出 {meta, slug, bodyHtml, pageHtml} ---------- */
export function renderMarkdown(md) {
  const { meta, body } = parseFrontMatter(md);
  const bodyHtml = parseBody(body);
  const slug = slugify(meta.title || "untitled");
  const pageHtml = buildPage(meta, bodyHtml, { slug });
  return { meta, slug, bodyHtml, pageHtml };
}
/* ============================================================
   知识库（docs/kb/*.md → kb/*.html）
   与博客文章共用 Markdown 渲染，页面带知识库专属导航与面包屑
   ============================================================ */

/* 知识库文档页（输出到 kb/<slug>.html，资源相对路径用 ../） */
export function buildKbPage(meta, bodyHtml, opts = {}) {
  const excerpt = meta.excerpt || meta.desc || meta.title;
  const slug = opts.slug ? String(opts.slug) : "";
  const category = meta.category || "未分类";
  const SITE = "https://zyf2026.pages.dev";
  const pageUrl = slug ? `${SITE}/kb/${slug}.html` : `${SITE}/kb.html`;
  const tags = Array.isArray(meta.tags) && meta.tags.length ? meta.tags : [];
  const date = meta.date || new Date().toISOString().slice(0, 10);
  const mins = readingMinutes(bodyHtml);
  const jsonLd = [
    buildArticleJsonLd(meta, { url: pageUrl, site: SITE }),
    buildBreadcrumbJsonLd(SITE, [
      { name: "首页", url: SITE + "/" },
      { name: "知识库", url: SITE + "/kb.html" },
      { name: meta.title, url: pageUrl },
    ]),
  ].map(jsonLdScript).join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(meta.title)} | 知识库 | ZH</title>
  <meta name="description" content="${escapeAttr(excerpt)}" />
  <link rel="canonical" href="${escapeAttr(pageUrl)}" />
  <link rel="stylesheet" href="../css/style.css?v=25" />
  <link rel="icon" type="image/png" href="../images/avatar.png" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeAttr(meta.title)}" />
  <meta property="og:description" content="${escapeAttr(excerpt)}" />
  <meta property="og:url" content="${escapeAttr(pageUrl)}" />
  <meta property="og:image" content="${SITE}/images/avatar.png" />
  <meta property="og:site_name" content="ZH 知识库" />
  <meta name="twitter:card" content="summary" />
${jsonLd}
  <script>try{var t=localStorage.getItem("zyf-theme");if(t==="light"||(!t&&window.matchMedia("(prefers-color-scheme: light)").matches))document.documentElement.setAttribute("data-theme","light")}catch(e){}</script>
</head>
<body>

  <a class="skip-link" href="#mainContent">跳到主要内容</a>

  <div class="reading-progress" id="readingProgress"></div>

  <nav class="navbar">
    <div class="nav-inner">
      <a href="../index.html" class="brand">
        <span class="prompt">&gt;_</span>ZH<span class="cursor"></span>
      </a>
      <ul class="nav-links" id="navLinks">
        <li><a href="../index.html">首页</a></li>
        <li><a href="../blog.html">博客</a></li>
        <li><a href="../projects.html">项目</a></li>
        <li><a href="../about.html">关于</a></li>
        <li><a href="../downloads.html">下载</a></li>
        <li><a href="../gallery.html">相册</a></li>
        <li><a href="../kb.html" class="active">知识库</a></li>
      </ul>
      <div class="nav-actions">
        <button class="theme-toggle" id="themeToggle" aria-label="切换主题" title="切换深浅色主题">☀</button>
        <button class="nav-toggle" id="navToggle" aria-label="菜单" aria-expanded="false" aria-controls="navLinks">☰ 菜单</button>
      </div>
    </div>
  </nav>

  <main class="container article kb-doc" id="mainContent">

    <nav class="kb-breadcrumb" aria-label="面包屑">
      <a href="../kb.html">📚 知识库</a>
      <span class="kb-crumb-sep">/</span>
      <span class="kb-crumb-cat">${escapeHtml(category)}</span>
    </nav>

    <article>
      <header class="article-header">
        <h1>${escapeHtml(meta.title)}</h1>
        <div class="article-meta">
          <span>📅 ${escapeHtml(date)}</span>
          <span>📂 ${escapeHtml(category)}</span>
          ${tags.length ? `<span>🏷️ ${escapeHtml(tags.join(" · "))}</span>` : ""}
          <span>⏱️ 约 ${mins} 分钟</span>
        </div>
      </header>

      <div class="article-body">
${bodyHtml}
      </div>
    </article>

    <a class="back-link" href="../kb.html">返回知识库</a>

${buildShareRow(meta.title, pageUrl)}

${relatedPlaceholder("相关知识")}

  </main>

  <footer class="footer">
    <div class="container">
      <p>© <span data-year>2025</span> ZH · Built with <span class="heart">♥</span> and a lot of coffee</p>
      <p style="margin-top:6px;font-size:11px;color:#4b5a6e;">&gt;_ ZH · 用代码记录世界</p>
    </div>
  </footer>

  <button class="back-top" id="backTop" aria-label="返回顶部" title="返回顶部">↑</button>
  <script src="../js/main.js?v=22"></script>
</body>
</html>
`;
}

/* 知识库索引数据（data/kb.json）：元数据 + 正文纯文本（客户端搜索用） */
export function buildKbIndex(docs) {
  const stripHtml = html =>
    String(html || "")
      .replace(/&lt;[^>]+&gt;/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  const list = (Array.isArray(docs) ? docs : [])
    .map(d => {
      const desc = d.meta.excerpt || d.meta.desc || "";
      return {
        slug: d.slug,
        title: d.meta.title || d.slug,
        category: d.meta.category || "未分类",
        desc: desc,
        date: d.meta.date || "",
        tags: d.meta.tags || [],
        // 搜索文本含标题/简介/正文，避免简介里的关键词搜不到
        text: [desc, stripHtml(d.bodyHtml)].filter(Boolean).join(" ").slice(0, 1500),
      };
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return JSON.stringify(list, null, 2) + "\n";
}

/* 知识库列表卡片（单条文档） */
export function buildKbCard(d) {
  const meta = d.meta || d;
  const tags = Array.isArray(meta.tags) ? meta.tags : [];
  const desc = meta.excerpt || meta.desc || "";
  const dataTags = [(meta.category || "未分类")].concat(tags).join(" ");
  return `        <a class="kb-item" href="kb/${d.slug}.html" data-tags="${escapeAttr(dataTags)}">
          <span class="kb-item-icon">📄</span>
          <span class="kb-item-body">
            <span class="kb-item-title">${escapeHtml(meta.title || d.slug)}</span>
${desc ? `            <span class="kb-item-desc">${escapeHtml(desc)}</span>\n` : ""}          </span>
          <span class="kb-item-date">${escapeHtml(meta.date || "")}</span>
        </a>`;
}

/* 知识库列表整体（写入 kb.html 标记区间，按分类分组） */
export function renderKbList(docs) {
  const list = Array.isArray(docs) ? docs : [];
  if (!list.length) return '      <div class="kb-empty">📚 知识库还是空的，去后台上传 Markdown 吧</div>';
  const groups = new Map();
  for (const d of list) {
    const cat = (d.meta && d.meta.category) || "未分类";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(d);
  }
  const parts = [];
  for (const [cat, items] of groups) {
    parts.push(
      `      <div class="kb-group">\n` +
      `        <h3 class="kb-group-title">${escapeHtml(cat)} <em>${items.length}</em></h3>\n` +
      `        <div class="kb-list">\n` +
      items.map(buildKbCard).join("\n") +
      `\n        </div>\n      </div>`
    );
  }
  return parts.join("\n");
}

/* 知识库分类筛选条 */
export function renderKbFilter(docs) {
  const list = Array.isArray(docs) ? docs : [];
  const cats = new Map();
  for (const d of list) {
    const cat = (d.meta && d.meta.category) || "未分类";
    cats.set(cat, (cats.get(cat) || 0) + 1);
  }
  const chips = [`<button type="button" class="chip active" data-cat="">全部 <em>${list.length}</em></button>`];
  for (const [cat, n] of cats) {
    chips.push(`<button type="button" class="chip" data-cat="${escapeAttr(cat)}">${escapeHtml(cat)} <em>${n}</em></button>`);
  }
  return chips.join("\n        ");
}

/* 知识库统计：文档数 / 分类数 */
export function buildKbStats(docs) {
  const list = Array.isArray(docs) ? docs : [];
  const cats = new Set(list.map(d => (d.meta && d.meta.category) || "未分类"));
  return { docs: list.length, categories: cats.size };
}

/* ============================================================
   标签聚合页（tags/<tag>.html）与归档页（archive.html）
   共用一套“列表型页面”外壳，减少重复
   ============================================================ */

/* 列表型页面外壳（标签页 / 归档页共用） */
function buildListShell({ title, description, canonical, bodyHtml, navActive, rootPrefix }) {
  const p = rootPrefix || ""; // 标签页在 tags/ 下需 "../"，归档页为 ""
  const SITE = "https://zyf2026.pages.dev";
  const navItem = (href, label, key) =>
    `        <li><a href="${p}${href}"${navActive === key ? ' class="active"' : ""}>${label}</a></li>`;
  const cssV = "24";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} | ZH</title>
  <meta name="description" content="${escapeAttr(description)}" />
  <link rel="canonical" href="${escapeAttr(canonical)}" />
  <link rel="stylesheet" href="${p}css/style.css?v=${cssV}" />
  <link rel="icon" type="image/png" href="${p}images/avatar.png" />
  <link rel="alternate" type="application/rss+xml" title="ZH 博客 RSS" href="${p}feed.xml" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeAttr(title)}" />
  <meta property="og:description" content="${escapeAttr(description)}" />
  <meta property="og:url" content="${escapeAttr(canonical)}" />
  <meta property="og:image" content="${SITE}/images/avatar.png" />
  <meta property="og:site_name" content="ZH 博客" />
  <meta name="twitter:card" content="summary" />
  ${jsonLdScript({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: canonical,
    inLanguage: "zh-CN",
    isPartOf: { "@type": "WebSite", name: "ZH 博客", url: SITE + "/" },
  })}
  <script>try{var t=localStorage.getItem("zyf-theme");if(t==="light"||(!t&&window.matchMedia("(prefers-color-scheme: light)").matches))document.documentElement.setAttribute("data-theme","light")}catch(e){}</script>
</head>
<body>

  <a class="skip-link" href="#mainContent">跳到主要内容</a>

  <nav class="navbar">
    <div class="nav-inner">
      <a href="${p}index.html" class="brand">
        <span class="prompt">&gt;_</span>ZH<span class="cursor"></span>
      </a>
      <ul class="nav-links" id="navLinks">
${navItem("index.html", "首页", "home")}
${navItem("blog.html", "博客", "blog")}
${navItem("projects.html", "项目", "projects")}
${navItem("about.html", "关于", "about")}
${navItem("downloads.html", "下载", "downloads")}
${navItem("gallery.html", "相册", "gallery")}
${navItem("kb.html", "知识库", "kb")}
      </ul>
      <div class="nav-actions">
        <button class="theme-toggle" id="themeToggle" aria-label="切换主题" title="切换深浅色主题">☀</button>
        <button class="nav-toggle" id="navToggle" aria-label="菜单" aria-expanded="false" aria-controls="navLinks">☰ 菜单</button>
      </div>
    </div>
  </nav>

  <main class="container" id="mainContent">

${bodyHtml}

  </main>

  <footer class="footer">
    <div class="container">
      <p>© <span data-year>2025</span> ZH · Built with <span class="heart">♥</span> and a lot of coffee</p>
      <p style="margin-top:6px;font-size:11px;color:#4b5a6e;">&gt;_ ZH · 用代码记录世界</p>
    </div>
  </footer>

  <button class="back-top" id="backTop" aria-label="返回顶部" title="返回顶部">↑</button>
  <script src="${p}js/main.js?v=22"></script>
</body>
</html>
`;
}

/* 单个标签聚合页 */
export function buildTagPage(tag, posts, base = "https://zyf2026.pages.dev") {
  const list = (Array.isArray(posts) ? posts : []).filter(p => {
    const t = (p.meta && p.meta.tags) || [];
    return p.meta && p.meta.published !== false && t.indexOf(tag) !== -1;
  });
  const canonical = `${base}/tags/${encodeURIComponent(tag)}.html`;
  // 标签页位于 /tags/ 子目录，需为文章链接补上 ../
  let items = list
    .map(p => listItemSnippet(p.meta, p.slug).replace('href="blog/', 'href="../blog/'))
    .join("\n\n");
  if (!items) items = '      <div class="photo-empty">该标签下暂无文章</div>';

  const bodyHtml = `    <div class="page-head">
      <h1>标签：<span class="accent">${escapeHtml(tag)}</span></h1>
      <p>共 ${list.length} 篇文章 · <a href="../blog.html" style="color:var(--accent);text-decoration:none;">返回博客</a></p>
    </div>

    <section class="section" style="border-top:none;padding-top:0;">
${items}
    </section>`;

  return buildListShell({
    title: `标签：${tag}`,
    description: `标签「${tag}」下的全部文章，共 ${list.length} 篇。`,
    canonical,
    bodyHtml,
    navActive: "blog",
    rootPrefix: "../",
  });
}

/* 归档页（按年份倒序分组，组内按日期倒序） */
export function buildArchivePage(posts, base = "https://zyf2026.pages.dev") {
  const list = (Array.isArray(posts) ? posts : [])
    .filter(p => p.meta && p.meta.published !== false)
    .sort((a, b) => String(b.meta.date || "").localeCompare(String(a.meta.date || "")));

  const byYear = new Map();
  for (const p of list) {
    const d = String(p.meta.date || "");
    const y = /^\d{4}/.test(d) ? d.slice(0, 4) : "未标注日期";
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(p);
  }

  let groups = "";
  for (const [year, items] of byYear) {
    const rows = items.map(p => {
      const tags = ((p.meta.tags || []).length ? p.meta.tags : ["随笔"])
        .map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("\n              ");
      return `        <li class="archive-item">
          <span class="archive-date">${escapeHtml(p.meta.date || "")}</span>
          <a class="archive-title" href="blog/${encodeURIComponent(p.slug)}.html">${escapeHtml(p.meta.title)}</a>
          <span class="archive-tags">
              ${tags}
          </span>
        </li>`;
    }).join("\n");
    groups += `      <div class="archive-group">
        <h3 class="archive-year">${escapeHtml(year)} <em>${items.length}</em></h3>
        <ol class="archive-list">
${rows}
        </ol>
      </div>\n`;
  }
  if (!groups) groups = '      <div class="photo-empty">还没有已发布的文章</div>\n';

  const bodyHtml = `    <div class="page-head">
      <h1>归<span class="accent">档</span></h1>
      <p>按时间倒序浏览全部 ${list.length} 篇文章。</p>
    </div>

    <section class="section" style="border-top:none;padding-top:0;">
${groups}    </section>`;

  return buildListShell({
    title: "归档",
    description: `全部文章归档，按年份浏览，共 ${list.length} 篇。`,
    canonical: `${base}/archive.html`,
    bodyHtml,
    navActive: "blog",
    rootPrefix: "",
  });
}

/* 标签列表（供 blog.html 生成标签页链接用） */
export function collectTags(posts) {
  const counts = new Map();
  for (const p of (Array.isArray(posts) ? posts : [])) {
    if (!p.meta || p.meta.published === false) continue;
    for (const t of (p.meta.tags || ["随笔"])) {
      if (!t) continue;
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/* 按标签重合度计算相关文章（供客户端与服务端共用逻辑说明） */
export function scoreRelated(currentTags, candidateTags) {
  const a = new Set((currentTags || []).filter(Boolean));
  let n = 0;
  for (const t of (candidateTags || [])) if (a.has(t)) n++;
  return n;
}
