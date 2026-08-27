// 极简静态文件服务器：node tools/dev-server.mjs [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const port = Number(process.argv[2] || 4000);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

http
  .createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = path.join(root, url === "/" ? "index.html" : url);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    fs.stat(file, (err, st) => {
      if (!err && st.isDirectory()) file = path.join(file, "index.html");
      if (err && path.extname(file) === "") { file = file + ".html"; }
      fs.readFile(file, (e, data) => {
        if (e) { res.writeHead(404, { "Content-Type": "text/plain" }).end("404 " + url); return; }
        res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
        res.end(data);
      });
    });
  })
  .listen(port, () => console.log("dev-server on http://localhost:" + port));
