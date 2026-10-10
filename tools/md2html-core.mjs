/* ============================================================
   md2html-core.mjs —— Markdown 渲染核心（纯函数，无 Node 依赖）
   供 CLI（md2html.mjs）与 Cloudflare Pages 后台函数共用
   ============================================================ */

/* 静态资源版本：改 CSS/JS 后同步递增（资源走 immutable 缓存） */
export const ASSET_VER = { css: "30", js: "25" };

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

/* ---------- HTML 转义 ----------
   escapeHtml 只管文本（& < >），escapeAttr 额外转义引号（& < > " '）。
   扫描器里文本一律走 escapeHtml、属性值一律走 escapeAttr，
   既防住 ![x](y"onerror="...) 这类属性注入，又不会让正文出现多余的 &quot; */
const TEXT_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const ATTR_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>]/g, ch => TEXT_MAP[ch]);
}
export function escapeAttr(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, ch => ATTR_MAP[ch]);
}

/* ---------- URL 安全过滤 ----------
   先把 HTML 实体与不可见控制字符归一，再判断协议，
   拦掉 javascript: / vbscript: / data: 等可执行协议
   （旧版 [点我](javascript:alert(1)) 会原样输出成可点击的 XSS 链接） */
const CTRL_RE = /[\u0000-\u0020\u00a0\u1680\u2000-\u200f\u2028-\u202f\u205f\u3000\ufeff]/g;
function urlProbe(raw) {
  return String(raw == null ? "" : raw)
    .replace(/&#x([0-9a-f]{1,6});?/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d{1,7});?/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(CTRL_RE, "")
    .toLowerCase();
}
export function safeUrl(raw) {
  const u = String(raw == null ? "" : raw).trim();
  const p = urlProbe(u);
  if (/^(?:javascript|vbscript|file|blob|filesystem):/.test(p)) return "#";
  if (/^data:/.test(p)) return "#";
  return u;
}
export function safeImageUrl(raw) {
  const u = String(raw == null ? "" : raw).trim();
  const p = urlProbe(u);
  if (/^(?:javascript|vbscript|file|blob|filesystem):/.test(p)) return "";
  if (/^data:(?!image\/)/.test(p)) return "";
  return u;
}

/* ---------- 标题锚点 id ----------
   GitHub 风格 slug，与文章里手写目录的锚点格式一致：
     "📌 项目概述" → "-项目概述"（emoji 去掉后留下的空格变短横线）
   注意：不能裁剪首尾短横线，否则刚好和手写目录对不上。
   旧版标题完全没有 id，导致介绍文档里 8 个目录锚点全部点不动。 */
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;
const SLUG_PUNCT_RE = /[\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g;
export function headingSlug(text) {
  return String(text == null ? "" : text)
    .replace(/<[^>]*>/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(EMOJI_RE, "")
    .toLowerCase()
    .replace(SLUG_PUNCT_RE, "")
    .replace(/\s+/g, "-");
}

/* ---------- 行内渲染 ----------
   手写扫描器（取代「先整体转义、再用正则替换」的旧实现）。旧实现有三个硬伤：
     1. 正则会把已经生成的标签内容再改写一遍 ——
        [wiki](.../Foo_(bar)) 会产出 <a href="...Foo<em>(bar"> 这种破损 HTML
     2. 图片/链接的 alt、href 取自转义后的字符串，但转义不含引号 → 属性注入
     3. URL 里的括号会截断匹配
   扫描器逐个字符处理，生成的标签直接落到输出里，不再被二次解析。 */
const INLINE_TAGS = new Set([
  "br", "wbr", "hr", "kbd", "sup", "sub", "mark", "abbr", "small", "big",
  "b", "i", "u", "s", "em", "strong", "del", "ins", "cite", "q", "code",
  "var", "samp", "dfn", "time", "span", "ruby", "rt", "rp", "bdi", "bdo",
]);
const VOID_TAGS = new Set(["br", "wbr", "hr"]);
const ESCAPABLE_CH = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

/* 从 pos（指向 '['）解析 [label](target "title")；失败返回 null */
function parseLinkTarget(src, pos) {
  let depth = 0;
  let close = -1;
  for (let k = pos; k < src.length; k++) {
    const c = src[k];
    if (c === "\\") { k++; continue; }
    if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) { close = k; break; } }
  }
  if (close === -1 || src[close + 1] !== "(") return null;

  const label = src.slice(pos + 1, close);
  let k = close + 2;
  while (k < src.length && /\s/.test(src[k])) k++;

  let url = "";
  if (src[k] === "<") {
    k++;
    while (k < src.length && src[k] !== ">") {
      if (src[k] === "\\") k++;
      url += src[k];
      k++;
    }
    k++;
  } else {
    let paren = 0;
    for (; k < src.length; k++) {
      const c = src[k];
      if (c === "\\") { url += src[k + 1] || ""; k++; continue; }
      if (/\s/.test(c) && paren === 0) break;
      if (c === "(") { paren++; url += c; continue; }
      if (c === ")") { if (paren === 0) break; paren--; url += c; continue; }
      url += c;
    }
  }

  while (k < src.length && /\s/.test(src[k])) k++;
  let title = "";
  const q = src[k];
  if (q === '"' || q === "'" || q === "(") {
    const endq = q === "(" ? ")" : q;
    let j = k + 1;
    while (j < src.length && src[j] !== endq) j++;
    title = src.slice(k + 1, j);
    k = j + 1;
    while (k < src.length && /\s/.test(src[k])) k++;
  }
  if (src[k] !== ")") return null;
  return { label, url, title, end: k + 1 };
}

function renderLink(label, url, title) {
  const href = safeUrl(url);
  const t = title ? ` title="${escapeAttr(title)}"` : "";
  const ext = /^(?:https?:)?\/\//i.test(url) || /^mailto:/i.test(url) || /^tel:/i.test(url);
  const attrs = ext ? ' target="_blank" rel="noopener noreferrer"' : "";
  return `<a href="${escapeAttr(href)}"${t}${attrs}>${inline(label, { allowBreak: false })}</a>`;
}

/* 强调 / 删除线：返回 {html,end} 或 null */
const EMPH_RULES = [
  { open: "***", close: "***", wrap: ["<strong><em>", "</em></strong>"], word: true },
  { open: "___", close: "___", wrap: ["<strong><em>", "</em></strong>"], word: false },
  { open: "**", close: "**", wrap: ["<strong>", "</strong>"], word: true },
  { open: "__", close: "__", wrap: ["<strong>", "</strong>"], word: false },
  { open: "~~", close: "~~", wrap: ["<del>", "</del>"], word: true },
  { open: "*", close: "*", wrap: ["<em>", "</em>"], word: true },
  { open: "_", close: "_", wrap: ["<em>", "</em>"], word: false },
];

function matchEmphasis(src, pos) {
  const rest = src.slice(pos);
  for (const r of EMPH_RULES) {
    if (!rest.startsWith(r.open)) continue;
    // 下划线不在词内生效，避免 file_name_here 被斜体
    if (!r.word && pos > 0 && /[\p{L}\p{N}]/u.test(src[pos - 1])) continue;
    const inner = rest.slice(r.open.length);
    if (!inner || /^\s/.test(inner)) continue;
    const idx = inner.indexOf(r.close);
    if (idx <= 0) continue;
    const content = inner.slice(0, idx);
    if (/[\s\n]$/.test(content)) continue;
    return {
      html: r.wrap[0] + inline(content, { allowBreak: false }) + r.wrap[1],
      end: pos + r.open.length + idx + r.close.length,
    };
  }
  return null;
}

export function inline(text, opts = {}) {
  const src = String(text == null ? "" : text);
  const allowBreak = opts.allowBreak !== false;
  const imgEager = !!opts.eagerImage;
  let out = "";
  let i = 0;

  while (i < src.length) {
    const c = src[i];

    /* 反斜杠转义（旧版完全不支持，\* 会原样显示） */
    if (c === "\\" && i + 1 < src.length && ESCAPABLE_CH.test(src[i + 1])) {
      out += escapeHtml(src[i + 1]);
      i += 2;
      continue;
    }

    /* 行内代码 */
    if (c === "`") {
      const m = /^(`+)([\s\S]*?)\1(?!`)/.exec(src.slice(i));
      if (m) {
        out += `<code>${escapeHtml(m[2].replace(/^ (\S)/, "$1").replace(/(\S) $/, "$1"))}</code>`;
        i += m[0].length;
        continue;
      }
    }

    /* 图片 */
    if (c === "!" && src[i + 1] === "[") {
      const r = parseLinkTarget(src, i + 1);
      if (r) {
        const url = safeImageUrl(r.url);
        if (url) {
          const t = r.title ? ` title="${escapeAttr(r.title)}"` : "";
          out += `<img src="${escapeAttr(url)}" alt="${escapeAttr(r.label)}"${t}`
            + (imgEager ? ' decoding="async" />' : ' loading="lazy" decoding="async" />');
        } else {
          out += escapeHtml(r.label);
        }
        i = r.end;
        continue;
      }
    }

    /* 链接 */
    if (c === "[") {
      const r = parseLinkTarget(src, i);
      if (r) {
        out += renderLink(r.label, r.url, r.title);
        i = r.end;
        continue;
      }
    }

    /* <...>：HTML 注释 / 自动链接 / 白名单行内标签 */
    if (c === "<") {
      const rest = src.slice(i);
      let m;
      if ((m = /^<!--[\s\S]*?-->/.exec(rest))) { i += m[0].length; continue; }
      if ((m = /^<((?:https?|mailto|tel):[^<>\s]+)>/i.exec(rest))) {
        out += `<a href="${escapeAttr(safeUrl(m[1]))}" target="_blank" rel="noopener noreferrer">`
          + `${escapeHtml(m[1].replace(/^mailto:/i, ""))}</a>`;
        i += m[0].length;
        continue;
      }
      if ((m = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)(\s[^<>]*)?\/?>/.exec(rest))) {
        const tag = m[2].toLowerCase();
        if (INLINE_TAGS.has(tag)) {
          out += VOID_TAGS.has(tag) ? `<${tag} />` : `<${m[1]}${tag}>`;
          i += m[0].length;
          continue;
        }
      }
      out += "&lt;";
      i++;
      continue;
    }

    /* 裸 URL 自动链接 */
    if ((c === "h" || c === "H" || c === "w" || c === "W") && /^(?:https?:\/\/|www\.)/i.test(src.slice(i, i + 8))) {
      const m = /^(?:https?:\/\/|www\.)[^\s<>"'\u3000]+/i.exec(src.slice(i));
      if (m) {
        const shown = m[0].replace(/[.,;:!?、。，；：！？]+$/, "");
        const href = /^www\./i.test(shown) ? "https://" + shown : shown;
        out += `<a href="${escapeAttr(safeUrl(href))}" target="_blank" rel="noopener noreferrer">${escapeHtml(shown)}</a>`;
        i += shown.length;
        continue;
      }
    }

    /* 强调 / 删除线 */
    const em = matchEmphasis(src, i);
    if (em) { out += em.html; i = em.end; continue; }

    /* 换行 */
    if (c === "\n") {
      out += allowBreak ? "<br />\n" : " ";
      i++;
      continue;
    }

    out += escapeHtml(c);
    i++;
  }
  return out;
}

/* ---------- 块级解析 ---------- */
const RE_FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const RE_HEAD = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RE_QUOTE = /^ {0,3}>/;
const RE_HR = /^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/;
const RE_ITEM = /^( *)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const RE_CENTER = /^ {0,3}<div\s+align\s*=\s*["']?(center|left|right)["']?\s*>/i;
const RE_CENTER_END = /^ {0,3}<\/div>\s*$/i;
const RE_SETEXT = /^ {0,3}(=+|-+)\s*$/;
const RE_TASK = /^\[([ xX])\]\s*(.*)$/;

export function parseBody(md) {
  const lines = String(md == null ? "" : md).replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  const usedIds = new Map();
  let i = 0;

  function uniqueId(base) {
    const b = base || "section";
    if (!usedIds.has(b)) { usedIds.set(b, 0); return b; }
    let k = usedIds.get(b) + 1;
    while (usedIds.has(`${b}-${k}`)) k++;
    usedIds.set(b, k);
    usedIds.set(`${b}-${k}`, 0);
    return `${b}-${k}`;
  }

  function headingHtml(level, rawText) {
    const text = String(rawText).trim();
    const id = uniqueId(headingSlug(text));
    // 标题文字包一层 .h-text：渐变色只加在这一层上。
    // 若把 background-clip:text 加在 h1~h6 上，它的背景会被裁剪到包含
    // 锚点 # 字形的所有文字，而背景属于标题不属于锚点，导致锚点的
    // opacity:0 完全失效 —— # 会常年可见。
    return `<h${level} id="${escapeAttr(id)}"><span class="h-text">${inline(text, { allowBreak: false })}</span>`
      + `<a class="h-anchor" href="#${escapeAttr(id)}" aria-label="本节链接">#</a></h${level}>`;
  }

  /* 表格：被竖线分隔的单元格，且下一行必须是「列数一致」的合法分隔行。
     旧实现只要看到 | 就进表格分支，分隔行不合法时 i-- 回退 → 主循环原地打转，
     一次畸形表格会产出 10 万个空块（约 195KB 垃圾）。现在不合法就不是表格。 */
  function splitRow(line) {
    let s = String(line).trim();
    if (s.startsWith("|")) s = s.slice(1);
    if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
    return s.split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, "|").trim());
  }

  function isTableStart(idx) {
    const head = lines[idx];
    const sep = lines[idx + 1];
    if (head == null || sep == null) return false;
    if (!head.includes("|")) return false;
    if (!sep.includes("-") || !sep.includes("|")) return false;
    const hc = splitRow(head);
    const sc = splitRow(sep);
    if (hc.length < 2 || hc.length !== sc.length) return false;
    return sc.every(c => /^:?-{1,}:?$/.test(c));
  }

  function renderTable() {
    const align = splitRow(lines[i + 1]).map(c => {
      const l = c.startsWith(":");
      const r = c.endsWith(":");
      return l && r ? "center" : r ? "right" : l ? "left" : "";
    });
    const head = splitRow(lines[i]);
    i += 2;
    const rows = [];
    while (i < lines.length && lines[i].trim() !== "" && lines[i].includes("|")) {
      rows.push(splitRow(lines[i]));
      i++;
    }
    const cell = (tag, text, k) => {
      const a = align[k] ? ` style="text-align:${align[k]}"` : "";
      return `<${tag}${a}>${inline(text, { allowBreak: false })}</${tag}>`;
    };
    let html = '<div class="table-wrap">\n<table>\n<thead>\n<tr>';
    head.forEach((h, k) => { html += cell("th", h, k); });
    html += "</tr>\n</thead>\n<tbody>\n";
    for (const r of rows) {
      html += "<tr>";
      head.forEach((_, k) => { html += cell("td", r[k] || "", k); });
      html += "</tr>\n";
    }
    html += "</tbody>\n</table>\n</div>";
    return html;
  }

  /* 列表：先把所有项按缩进读进来，再用栈构建真正的嵌套结构。
     旧实现遇到缩进变化就关掉当前列表、另开一个 → 子项变成兄弟项，层级丢失。 */
  function readListItems() {
    const items = [];
    while (i < lines.length) {
      const m = RE_ITEM.exec(lines[i]);
      if (!m) break;
      const indent = m[1].replace(/\t/g, "  ").length;
      const node = { indent, ordered: m[2] !== "-" && m[2] !== "*" && m[2] !== "+", text: m[3], children: [] };
      items.push(node);
      i++;
      // 续行：缩进更深、且不是新的列表项/块级起始
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        /^\s{2,}/.test(lines[i]) &&
        !RE_ITEM.test(lines[i]) &&
        !RE_FENCE.test(lines[i]) &&
        !RE_CENTER.test(lines[i])
      ) {
        node.text += " " + lines[i].trim();
        i++;
      }
    }
    return items;
  }

  function buildListTree(items) {
    const root = { indent: -1, children: [] };
    const stack = [root];
    for (const it of items) {
      while (stack.length > 1 && it.indent <= stack[stack.length - 1].indent) stack.pop();
      const parent = stack[stack.length - 1];
      parent.children.push(it);
      stack.push(it);
    }
    return root;
  }

  function renderListChildren(nodes) {
    let html = "";
    let k = 0;
    while (k < nodes.length) {
      const ordered = nodes[k].ordered;
      const group = [];
      while (k < nodes.length && nodes[k].ordered === ordered) { group.push(nodes[k]); k++; }
      const tag = ordered ? "ol" : "ul";
      html += `<${tag}>\n`;
      for (const node of group) {
        const task = RE_TASK.exec(node.text);
        let cls = "";
        let inner;
        if (task) {
          cls = task[1].trim() === "" ? ' class="task-item"' : ' class="task-item task-done"';
          inner = inline(task[2], { allowBreak: false });
        } else {
          inner = inline(node.text);
        }
        html += `  <li${cls}>${inner}`;
        const sub = renderListChildren(node.children);
        if (sub) html += "\n" + sub.replace(/^(?=.)/gm, "    ") + "  ";
        html += "</li>\n";
      }
      html += `</${tag}>\n`;
    }
    return html;
  }

  function renderList() {
    return renderListChildren(buildListTree(readListItems()).children);
  }

  /* 块级起始判定：主循环与段落收集共用同一套规则。
     旧实现让段落收集单独判断「行首是不是 * + > |」，一旦是就中断且不消费该行，
     导致 *强调* 开头的段落被整行静默丢弃（数据丢失）。 */
  function isBlockStart(idx) {
    const l = lines[idx];
    if (l == null || l.trim() === "") return true;
    if (RE_FENCE.test(l)) return true;
    if (RE_HEAD.test(l)) return true;
    if (RE_QUOTE.test(l)) return true;
    if (RE_HR.test(l)) return true;
    if (RE_ITEM.test(l)) return true;
    if (RE_CENTER.test(l)) return true;
    if (RE_CENTER_END.test(l)) return true;
    return isTableStart(idx);
  }

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") { i++; continue; }

    /* 围栏代码块 */
    let m = RE_FENCE.exec(line);
    if (m) {
      const fence = m[1];
      const lang = (m[2].trim().split(/\s+/)[0] || "").replace(/[^a-zA-Z0-9_+#.-]/g, "");
      const closeRe = new RegExp("^ {0,3}" + fence[0] + "{" + fence.length + ",}\\s*$");
      i++;
      const buf = [];
      while (i < lines.length && !closeRe.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      while (buf.length && buf[buf.length - 1].trim() === "") buf.pop();
      out.push(`<pre><code${lang ? ` class="language-${escapeAttr(lang)}"` : ""}>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }

    /* <div align="center"> 居中块（旧版会把它转义成页面上的裸标签文字） */
    if (RE_CENTER.test(line)) {
      const align = RE_CENTER.exec(line)[1].toLowerCase();
      i++;
      const buf = [];
      while (i < lines.length && !RE_CENTER_END.test(lines[i])) { buf.push(lines[i]); i++; }
      if (i < lines.length) i++;
      const inner = parseBody(buf.join("\n"));
      out.push(`<div class="md-align-${align}">\n${inner}\n</div>`);
      continue;
    }

    /* 标题 */
    m = RE_HEAD.exec(line);
    if (m) {
      out.push(headingHtml(m[1].length, m[2]));
      i++;
      continue;
    }

    /* 分隔线 */
    if (RE_HR.test(line)) {
      out.push("<hr />");
      i++;
      continue;
    }

    /* 引用块 */
    if (RE_QUOTE.test(line)) {
      const groups = [];
      let cur = [];
      while (i < lines.length) {
        if (RE_QUOTE.test(lines[i])) {
          const inner = lines[i].replace(/^ {0,3}>\s?/, "");
          if (inner.trim() === "") {
            if (cur.length) { groups.push(cur); cur = []; }
          } else {
            cur.push(inner);
          }
          i++;
        } else if (lines[i].trim() !== "" && cur.length && !isBlockStart(i)) {
          cur.push(lines[i]);   // 懒续行
          i++;
        } else break;
      }
      if (cur.length) groups.push(cur);
      if (groups.length === 1) {
        out.push(`<blockquote>${inline(groups[0].join("\n"))}</blockquote>`);
      } else {
        out.push("<blockquote>\n" + groups.map(g => `<p>${inline(g.join("\n"))}</p>`).join("\n") + "\n</blockquote>");
      }
      continue;
    }

    /* 表格（必须先确认下一行是合法分隔行） */
    if (isTableStart(i)) {
      out.push(renderTable());
      continue;
    }

    /* 列表 */
    if (RE_ITEM.test(line)) {
      out.push(renderList().replace(/\n$/, ""));
      continue;
    }

    /* 段落（含 Setext 标题：=== 一定是标题，--- 仍按分隔线处理） */
    const buf = [];
    while (i < lines.length) {
      const cur = lines[i];
      if (cur.trim() === "") break;
      if (buf.length && /^ {0,3}=+\s*$/.test(cur)) break;
      if (isBlockStart(i)) break;
      buf.push(cur);
      i++;
    }
    if (!buf.length) { buf.push(lines[i]); i++; }

    if (i < lines.length && /^ {0,3}=+\s*$/.test(lines[i])) {
      out.push(headingHtml(2, buf.join(" ")));
      i++;
      continue;
    }

    const para = inline(buf.join("\n"));
    if (para.trim() !== "") out.push(`<p>${para}</p>`);
  }

  const html = out.join("\n\n");
  // 首图不做懒加载（通常是首屏 LCP 元素）
  return html.replace(' loading="lazy"', "");
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
    .replace(/&#x?[0-9a-f]+;?/gi, " ")          // 数字实体（&#39; 等）
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
  const pageUrl = slug ? `${SITE}/blog/${slug}` : SITE + "/";
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
  <link rel="stylesheet" href="../css/style.css?v=${ASSET_VER.css}" />
  <link rel="icon" type="image/png" href="../images/avatar.png" />
  <link rel="manifest" href="../manifest.json" />
  <meta name="theme-color" content="#0a0e14" />
  <link rel="apple-touch-icon" href="../images/avatar.png" />
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
        <a class="nav-search" href="../search.html" aria-label="搜索" title="搜索">🔍</a>
        <button class="theme-toggle" id="themeToggle" aria-label="切换主题" title="切换深浅色主题">☀</button>
        <button class="nav-toggle" id="navToggle" aria-label="菜单" aria-expanded="false" aria-controls="navLinks">☰ 菜单</button>
      </div>
    </div>
  </nav>

  <main class="container article" id="mainContent">

${articleHtml}

${buildShareRow(meta.title, pageUrl)}

${relatedPlaceholder("相关文章")}

    <section class="comments" id="comments" aria-label="评论"></section>

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
  <script src="../js/main.js?v=${ASSET_VER.js}"></script>
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
  return `      <a class="post-item" href="blog/${slug}" data-tags="${dataTags}">
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
      const url = `${base}/blog/${p.slug}`;
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
      loc: base + "/blog/" + encodeURIComponent(p.slug),
      lastmod: p.meta.date || today,
      pri: "0.7",
      freq: "monthly",
    });
  }
  for (const d of (Array.isArray(kbDocs) ? kbDocs : [])) {
    urls.push({
      loc: base + "/kb/" + encodeURIComponent(d.slug),
      lastmod: (d.meta && d.meta.date) || today,
      pri: "0.6",
      freq: "monthly",
    });
  }
  for (const t of (Array.isArray(tags) ? tags : [])) {
    const name = typeof t === "string" ? t : t.name;
    if (!name) continue;
    urls.push({
      loc: base + "/tags/" + encodeURIComponent(name),
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
  const pageUrl = slug ? `${SITE}/kb/${slug}` : `${SITE}/kb.html`;
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
  <link rel="stylesheet" href="../css/style.css?v=${ASSET_VER.css}" />
  <link rel="icon" type="image/png" href="../images/avatar.png" />
  <link rel="manifest" href="../manifest.json" />
  <meta name="theme-color" content="#0a0e14" />
  <link rel="apple-touch-icon" href="../images/avatar.png" />
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
        <a class="nav-search" href="../search.html" aria-label="搜索" title="搜索">🔍</a>
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

    <section class="comments" id="comments" aria-label="评论"></section>

  </main>

  <footer class="footer">
    <div class="container">
      <p>© <span data-year>2025</span> ZH · Built with <span class="heart">♥</span> and a lot of coffee</p>
      <p style="margin-top:6px;font-size:11px;color:#4b5a6e;">&gt;_ ZH · 用代码记录世界</p>
    </div>
  </footer>

  <button class="back-top" id="backTop" aria-label="返回顶部" title="返回顶部">↑</button>
  <script src="../js/main.js?v=${ASSET_VER.js}"></script>
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
  return `        <a class="kb-item" href="kb/${d.slug}" data-tags="${escapeAttr(dataTags)}">
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

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} | ZH</title>
  <meta name="description" content="${escapeAttr(description)}" />
  <link rel="canonical" href="${escapeAttr(canonical)}" />
  <link rel="stylesheet" href="${p}css/style.css?v=${ASSET_VER.css}" />
  <link rel="icon" type="image/png" href="${p}images/avatar.png" />
  <link rel="manifest" href="${p}manifest.json" />
  <meta name="theme-color" content="#0a0e14" />
  <link rel="apple-touch-icon" href="${p}images/avatar.png" />
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
        <a class="nav-search" href="${p}search.html" aria-label="搜索" title="搜索">🔍</a>
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
  <script src="${p}js/main.js?v=${ASSET_VER.js}"></script>
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
  const canonical = `${base}/tags/${encodeURIComponent(tag)}`;
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
          <a class="archive-title" href="blog/${encodeURIComponent(p.slug)}">${escapeHtml(p.meta.title)}</a>
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

/* ============================================================
   站点设置派生：PWA manifest
   ============================================================ */
export function buildManifest(site = {}) {
  const name = site.title || "ZH 博客";
  const short = site.name || "ZH";
  const desc = site.description || "";
  return JSON.stringify({
    name,
    short_name: short,
    description: desc,
    start_url: "/index.html",
    scope: "/",
    display: "standalone",
    background_color: "#0a0e14",
    theme_color: "#0a0e14",
    lang: "zh-CN",
    dir: "ltr",
    categories: ["blog", "personal", "technology"],
    icons: [
      { src: "/images/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/images/avatar.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/images/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  }, null, 2) + "\n";
}

/* ---------- 站点级搜索索引（文章 + 知识库，供独立搜索页使用） ---------- */
export function buildSearchAll(posts, kbDocs) {
  const stripHtml = html =>
    String(html || "")
      .replace(/&lt;[^>]+&gt;/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  // 组内按日期倒序：让输出与调用方的输入顺序无关
  // （后台读目录是字母序、本地脚本是日期序，不排的话两边产物会不一致）
  const byDate = (a, b) => String(b.meta.date || "").localeCompare(String(a.meta.date || ""));
  const out = [];
  for (const p of (Array.isArray(posts) ? posts : []).slice().sort(byDate)) {
    if (p.meta.published === false) continue;
    out.push({
      type: "post",
      typeName: "文章",
      url: `blog/${encodeURIComponent(p.slug)}`,
      title: p.meta.title || p.slug,
      date: p.meta.date || "",
      tags: p.meta.tags || [],
      category: "",
      text: [p.meta.excerpt || "", stripHtml(p.bodyHtml)].filter(Boolean).join(" ").slice(0, 2000),
    });
  }
  for (const d of (Array.isArray(kbDocs) ? kbDocs : []).slice().sort(byDate)) {
    out.push({
      type: "kb",
      typeName: "知识库",
      url: `kb/${encodeURIComponent(d.slug)}`,
      title: d.meta.title || d.slug,
      date: d.meta.date || "",
      tags: d.meta.tags || [],
      category: d.meta.category || "未分类",
      text: [d.meta.excerpt || d.meta.desc || "", stripHtml(d.bodyHtml)].filter(Boolean).join(" ").slice(0, 2000),
    });
  }
  return JSON.stringify(out, null, 2) + "\n";
}
