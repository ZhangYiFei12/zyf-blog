/* ============================================================
   md2html-core.mjs —— Markdown 渲染核心（纯函数，无 Node 依赖）
   供 CLI（md2html.mjs）与 Cloudflare Pages 后台函数共用
   ============================================================ */

/* ---------- Front Matter 解析 ---------- */
export function parseFrontMatter(raw) {
  const meta = { title: "", date: "", excerpt: "", tags: [], published: true };
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
  return `    <article>
      <header class="article-header">
        <h1>${escapeHtml(meta.title)}</h1>
        <div class="article-meta">
          <span>📅 ${escapeHtml(date)}</span>
          <span>🏷️ ${escapeHtml(tags)}</span>
        </div>
      </header>

      <div class="article-body">
${bodyHtml}
      </div>
    </article>`;
}

/* ---------- 页面模板 ---------- */
export function buildPage(meta, bodyHtml, opts = {}) {
  const excerpt = meta.excerpt || meta.title;
  const slug = opts.slug ? String(opts.slug) : "";
  const SITE = "https://zyf2026.pages.dev";
  const pageUrl = slug ? `${SITE}/blog/${slug}.html` : SITE + "/";
  const articleHtml = buildArticlePreview(meta, bodyHtml);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(meta.title)} · 张义飞</title>
  <meta name="description" content="${escapeAttr(excerpt)}" />
  <link rel="stylesheet" href="../css/style.css?v=13" />
  <link rel="icon" type="image/png" href="../images/avatar.png" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeAttr(meta.title)}" />
  <meta property="og:description" content="${escapeAttr(excerpt)}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:image" content="${SITE}/images/avatar.png" />
  <meta property="og:site_name" content="张义飞博客" />
  <meta name="twitter:card" content="summary" />
  <script>try{if(localStorage.getItem("zyf-theme")==="light")document.documentElement.setAttribute("data-theme","light")}catch(e){}</script>
</head>
<body>

  <div class="reading-progress" id="readingProgress"></div>

  <nav class="navbar">
    <div class="nav-inner">
      <a href="../index.html" class="brand">
        <span class="prompt">&gt;_</span>ZH<span class="cursor"></span>
      </a>
      <ul class="nav-links">
        <li><a href="../index.html">首页</a></li>
        <li><a href="../blog.html">博客</a></li>
        <li><a href="../projects.html">项目</a></li>
        <li><a href="../about.html">关于</a></li>
      </ul>
      <div class="nav-actions">
        <button class="theme-toggle" id="themeToggle" aria-label="切换主题" title="切换深浅色主题">☀</button>
        <button class="nav-toggle" aria-label="菜单">☰ 菜单</button>
      </div>
    </div>
  </nav>

  <main class="container article">

${articleHtml}

    <nav class="post-nav" id="postNav"></nav>

    <a class="back-link" href="../blog.html">返回博客列表</a>

  </main>

  <footer class="footer">
    <div class="container">
      <p>© <span data-year>2025</span> 张义飞 · Built with <span class="heart">♥</span> and a lot of coffee</p>
      <p style="margin-top:6px;font-size:11px;color:#4b5a6e;">&gt;_ zhangyifei · 用代码记录世界</p>
    </div>
  </footer>

  <button class="back-top" id="backTop" aria-label="返回顶部" title="返回顶部">↑</button>
  <script src="../js/highlight.min.js?v=1"></script>
  <script src="../js/main.js?v=11"></script>
</body>
</html>
`;
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
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    <title>张义飞博客</title>\n    <link>${base}/blog.html</link>\n    <description>张义飞（Yifei Zhang）的个人博客：技术分享、项目实践与生活随笔。</description>\n    <language>zh-CN</language>\n    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml" />\n${items}\n  </channel>\n</rss>\n`;
}

/* ---------- 站点地图 sitemap.xml ---------- */
export function buildSitemap(posts, base = "https://zyf2026.pages.dev") {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: base + "/", lastmod: today, pri: "1.0", freq: "weekly" },
    { loc: base + "/blog.html", lastmod: today, pri: "0.8", freq: "weekly" },
    { loc: base + "/projects.html", lastmod: today, pri: "0.8", freq: "monthly" },
    { loc: base + "/about.html", lastmod: today, pri: "0.6", freq: "monthly" },
  ];
  for (const p of (Array.isArray(posts) ? posts : [])) {
    if (p.meta.published === false) continue; // 草稿不进 sitemap
    urls.push({
      loc: base + "/blog/" + p.slug + ".html",
      lastmod: p.meta.date || today,
      pri: "0.7",
      freq: "monthly",
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
      text: stripHtml(p.bodyHtml).slice(0, 800),
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