/* ============================================================
   md2html-core.mjs —— Markdown 渲染核心（纯函数，无 Node 依赖）
   供 CLI（md2html.mjs）与 Cloudflare Pages 后台函数共用
   ============================================================ */

/* ---------- Front Matter 解析 ---------- */
export function parseFrontMatter(raw) {
  const meta = { title: "", date: "", excerpt: "", tags: [] };
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

/* ---------- 页面模板 ---------- */
export function buildPage(meta, bodyHtml) {
  const today = new Date().toISOString().slice(0, 10);
  const date = meta.date || today;
  const tags = Array.isArray(meta.tags) && meta.tags.length
    ? meta.tags.join(" · ")
    : "随笔";
  const excerpt = meta.excerpt || meta.title;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(meta.title)} · 张义飞</title>
  <meta name="description" content="${escapeHtml(excerpt)}" />
  <link rel="stylesheet" href="../css/style.css" />
  <link rel="icon" type="image/png" href="../images/avatar.png" />
</head>
<body>

  <nav class="navbar">
    <div class="nav-inner">
      <a href="../index.html" class="brand">
        <span class="prompt">&gt;_</span>zhangyifei<span class="cursor"></span>
      </a>
      <button class="nav-toggle" aria-label="菜单">☰ 菜单</button>
      <ul class="nav-links">
        <li><a href="../index.html">首页</a></li>
        <li><a href="../blog.html">博客</a></li>
        <li><a href="../projects.html">项目</a></li>
        <li><a href="../about.html">关于</a></li>
      </ul>
    </div>
  </nav>

  <main class="container article">

    <article>
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
    </article>

    <a class="back-link" href="../blog.html">返回博客列表</a>

  </main>

  <footer class="footer">
    <div class="container">
      <p>© <span data-year>2025</span> 张义飞 · Built with <span class="heart">♥</span> and a lot of coffee</p>
      <p style="margin-top:6px;font-size:11px;color:#4b5a6e;">&gt;_ zhangyifei · 用代码记录世界</p>
    </div>
  </footer>

  <script src="../js/main.js"></script>
</body>
</html>
`;
}

/* ---------- 工具 ---------- */
export function slugify(name) {
  return name
    .replace(/\.md$/i, "")
    .replace(/\s+/g, "-")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/-+/g, "-");
}

export function listItemSnippet(meta, slug) {
  const date = meta.date || new Date().toISOString().slice(0, 10);
  const excerpt = meta.excerpt || meta.title;
  const tagStr = (meta.tags && meta.tags.length ? meta.tags : ["随笔"]).map(t => `            <span class="tag">${t}</span>`).join("\n");
  return `      <a class="post-item" href="blog/${slug}.html">
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

/* ---------- 组合：输入 Markdown → 输出 {meta, slug, bodyHtml, pageHtml} ---------- */
export function renderMarkdown(md) {
  const { meta, body } = parseFrontMatter(md);
  const bodyHtml = parseBody(body);
  const pageHtml = buildPage(meta, bodyHtml);
  const slug = slugify(meta.title || "untitled");
  return { meta, slug, bodyHtml, pageHtml };
}