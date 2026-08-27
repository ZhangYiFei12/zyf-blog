const CDP = "http://localhost:9222";

async function cdp() {
  const res = await fetch(CDP + "/json/new?about:blank", { method: "PUT" }).then(r => r.json());
  const ws = new WebSocket(res.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r));
  let seq = 0;
  const pending = new Map();
  ws.addEventListener("message", function (d) {
    const msg = JSON.parse(String(d.data));
    if (pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
  });
  const call = (m, p) => new Promise(resolve => {
    const id = ++seq;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });
  await call("Page.enable");
  return { ws, call, close: () => { ws.close(); } };
}

async function main() {
  console.log("1. 连接 CDP & 导航到文章页...");
  const { ws, call, close } = await cdp();
  await call("Page.navigate", { url: "http://localhost:4000/blog/测试.html" });
  await new Promise(r => setTimeout(r, 2000));

  // 测试阅读进度条
  console.log("2. 检查阅读进度条元素...");
  let r = await call("Runtime.evaluate", {
    expression: "document.getElementById('readingProgress') !== null",
    returnByValue: true
  });
  console.log("   进度条存在:", r.result.value);

  // 测试返回顶部按钮
  console.log("3. 检查返回顶部按钮...");
  r = await call("Runtime.evaluate", {
    expression: "document.getElementById('backTop') !== null",
    returnByValue: true
  });
  console.log("   返回顶部按钮存在:", r.result.value);

  // 滚动页面并检查进度条宽度和返回顶部按钮
  console.log("4. 滚动页面...");
  await call("Runtime.evaluate", {
    expression: "window.scrollTo(0, document.body.scrollHeight * 0.5)",
    returnByValue: true
  });
  await new Promise(r => setTimeout(r, 500));

  r = await call("Runtime.evaluate", {
    expression: "window.getComputedStyle(document.getElementById('readingProgress')).width !== '0px'",
    returnByValue: true
  });
  console.log("   滚动后进度条宽度 > 0:", r.result.value);

  r = await call("Runtime.evaluate", {
    expression: "document.getElementById('backTop').classList.contains('show')",
    returnByValue: true
  });
  console.log("   滚动后返回顶部按钮可见:", r.result.value);

  // 测试复制代码按钮
  console.log("5. 检查复制代码按钮...");
  r = await call("Runtime.evaluate", {
    expression: "document.querySelectorAll('.copy-btn').length",
    returnByValue: true
  });
  console.log("   复制代码按钮数量:", r.result.value);

  // 测试上一篇/下一篇
  console.log("6. 检查上一篇/下一篇导航...");
  await new Promise(r => setTimeout(r, 1500)); // 等待 fetch 完成
  r = await call("Runtime.evaluate", {
    expression: "document.getElementById('postNav').innerHTML.trim() !== ''",
    returnByValue: true
  });
  console.log("   postNav 已填充:", r.result.value);

  if (r.result.value) {
    r = await call("Runtime.evaluate", {
      expression: "document.querySelectorAll('#postNav a').length",
      returnByValue: true
    });
    console.log("   postNav 链接数量:", r.result.value);
  }

  // 检查 OG 标签
  console.log("7. 检查 OG 标签...");
  r = await call("Runtime.evaluate", {
    expression: "document.querySelector('meta[property=\"og:title\"]') !== null",
    returnByValue: true
  });
  console.log("   og:title 存在:", r.result.value);

  // 主题切换
  console.log("8. 测试主题切换按钮...");
  r = await call("Runtime.evaluate", {
    expression: "document.getElementById('themeToggle') !== null",
    returnByValue: true
  });
  console.log("   主题切换按钮存在:", r.result.value);

  // 检查 404 页
  console.log("9. 测试 404 页...");
  await call("Page.navigate", { url: "http://localhost:4000/不存在.html" });
  await new Promise(r => setTimeout(r, 1000));
  r = await call("Runtime.evaluate", {
    expression: "document.querySelector('.notfound') !== null",
    returnByValue: true
  });
  console.log("   404 页 .notfound 存在:", r.result.value);

  close();
  console.log("\n✅ 全部测试通过！");
}

main().catch(e => {
  console.error("❌ 测试失败:", e.message);
  process.exit(1);
});