const CDP = "http://localhost:9222";
const BASE = "http://localhost:4000";

async function openPage(url) {
  const res = await fetch(CDP + "/json/new?about:blank", { method: "PUT" }).then(r => r.json());
  const ws = new WebSocket(res.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r));
  let seq = 0; const pending = new Map();
  ws.addEventListener("message", d => { const m = JSON.parse(String(d.data)); if (pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
  const call = (m, p) => new Promise(resolve => { const id = ++seq; pending.set(id, resolve); ws.send(JSON.stringify({ id, method: m, params: p })); });
  await call("Page.enable");
  await call("Page.navigate", { url });
  await new Promise(r => setTimeout(r, 2500));
  return { call, close: () => ws.close() };
}

async function ev(page, expr, awaitPromise) {
  const r = await page.call("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: !!awaitPromise });
  return r.result ? r.result.value : "ERR:" + JSON.stringify(r);
}

async function main() {
  // 1. 文章页：TOC + 代码高亮
  console.log("=== 1. 文章页（技术文档）TOC + 高亮 ===");
  const p1 = await openPage(BASE + "/blog/详细介绍与技术文档.html");
  console.log("TOC 存在:", await ev(p1, "document.querySelector('.toc') !== null"));
  console.log("TOC 链接数:", await ev(p1, "document.querySelectorAll('.toc a').length"));
  console.log("h2 有 id:", await ev(p1, "document.querySelectorAll('.article-body h2[id]').length"));
  console.log("高亮 code.hljs 数量:", await ev(p1, "document.querySelectorAll('code.hljs').length"));
  console.log("高亮 token 示例:", await ev(p1, "(() => { const s = document.querySelector('code.hljs .hljs-keyword'); return s ? s.textContent : '无'; })()"));
  console.log("TOC active 跟随滚动:", await ev(p1, "(() => { window.scrollTo(0, document.querySelector('.article-body h2[id]')?.offsetTop - 100 || 0); return true; })()"));
  await new Promise(r => setTimeout(r, 800));
  console.log("滚动后 active 链接:", await ev(p1, "document.querySelectorAll('.toc a.active').length"));
  p1.close();

  // 2. 文章页：复制按钮仍工作（与高亮共存）
  console.log("=== 2. 文章页复制按钮 ===");
  const p2 = await openPage(BASE + "/blog/MirrorSync-双向同步工具.html");
  console.log("复制按钮数:", await ev(p2, "document.querySelectorAll('.copy-btn').length"));
  console.log("TOC 链接数(该文章):", await ev(p2, "document.querySelectorAll('.toc a').length"));
  p2.close();

  // 3. 博客页：标签筛选
  console.log("=== 3. 博客页标签筛选 ===");
  const p3 = await openPage(BASE + "/blog.html");
  console.log("筛选 chip 数:", await ev(p3, "document.querySelectorAll('#tagFilter .chip').length"));
  console.log("chip 文本:", await ev(p3, "Array.from(document.querySelectorAll('#tagFilter .chip')).map(c => c.textContent.trim()).join(' | ')"));
  console.log("post-item 有 data-tags:", await ev(p3, "document.querySelectorAll('.post-item[data-tags]').length"));
  console.log("点击「AI」标签:");
  await ev(p3, "(() => { const b = Array.from(document.querySelectorAll('#tagFilter .chip')).find(c => c.getAttribute('data-tag') === 'AI'); if (b) b.click(); return true; })()");
  await new Promise(r => setTimeout(r, 300));
  console.log("可见文章数:", await ev(p3, "Array.from(document.querySelectorAll('.post-item')).filter(i => i.style.display !== 'none').length"));
  console.log("空状态文本:", await ev(p3, "document.getElementById('blogEmpty').textContent"));
  await ev(p3, "(() => { const b = document.querySelector('#tagFilter .chip[data-tag=\"\"]'); b.click(); return true; })()");
  await new Promise(r => setTimeout(r, 300));
  console.log("重置后可见数:", await ev(p3, "Array.from(document.querySelectorAll('.post-item')).filter(i => i.style.display !== 'none').length"));
  p3.close();

  // 4. 无标签文章（测试/物理）不应有 TOC
  console.log("=== 4. 短文章无 TOC ===");
  const p4 = await openPage(BASE + "/blog/测试.html");
  console.log("TOC 存在:", await ev(p4, "document.querySelector('.toc') !== null"));
  console.log("h2/h3 数量:", await ev(p4, "document.querySelectorAll('.article-body h2, .article-body h3').length"));
  p4.close();

  console.log("\n✅ 第二梯队浏览器测试完成");
}

main().catch(e => { console.error("❌ 失败:", e.message); process.exit(1); });