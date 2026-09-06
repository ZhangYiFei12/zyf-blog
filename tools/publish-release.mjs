#!/usr/bin/env node
/* ============================================================
   publish-release.mjs —— 发布大文件到 GitHub Release 并登记下载页
   （针对 >100MB 无法走仓库后台的文件，单文件 ≤2GB）

   用法：
     node tools/publish-release.mjs <文件路径> [--tag v1.0.0] [--name 显示名] [--desc 说明] [--category 分类]

   示例：
     node tools/publish-release.mjs dist/MyApp-Setup.exe --tag v1.0.0 --name "我的应用安装包" --desc "Windows 安装版"
     node tools/publish-release.mjs ./package.zip --category "工具"

   说明：
   - 需要本机已登录 gh CLI（gh auth status 可查），仓库 ZhangYiFei12/zyf-blog
   - 流程：上传文件到 GitHub Release（tag 不存在则自动创建）→ 登记到
     data/downloads.json（store: "release"）→ git push 触发网站自动部署
   - 删除：可在网站后台「📦 下载」页操作（同步删 Release 资产）
   ============================================================ */

import { readFileSync, statSync } from "fs";
import { basename, resolve } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const REPO = "ZhangYiFei12/zyf-blog";

function parseArgs() {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith("--"));
  if (!file) {
    console.error("❌ 用法: node tools/publish-release.mjs <文件> [--tag vX] [--name 名称] [--desc 描述] [--category 分类]");
    process.exit(1);
  }
  const get = k => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : ""; };
  return {
    file: resolve(process.cwd(), file),
    tag: get("--tag"),
    name: get("--name"),
    desc: get("--desc"),
    category: get("--category") || "软件",
  };
}

function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...opts }).trim();
}

function ensureGitClean() {
  const st = sh("git status --porcelain");
  if (st) {
    console.log("⚠️  工作区有未提交改动：\n" + st.split("\n").slice(0, 8).join("\n"));
  }
}

/* 中文/特殊字符文件名 → ASCII 安全资产名（保留下载链接稳定） */
function assetName(origName) {
  const m = String(origName || "").match(/\.([^.]+)$/);
  const ext = (m && m[1] || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const ts = Date.now().toString(36);
  return `file-${ts}.${ext}`;
}

async function main() {
  const o = parseArgs();
  const file = o.file;
  try { statSync(file); } catch (e) { console.error(`❌ 文件不存在: ${file}`); process.exit(1); }
  const origName = basename(file);
  const size = statSync(file).size;

  if (size <= 100 * 1024 * 1024) {
    console.log(`ℹ️  文件 ${size < 1048576 ? (size/1024).toFixed(0) + "KB" : (size/1048576).toFixed(1) + "MB"} ≤100MB，可直接在网站后台「📦 下载」上传，无需本脚本。`);
    console.log("（若仍想用 Release：忽略本提示继续）");
  }

  const tag = o.tag || `dl-${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36).slice(-4)}`;
  const name = o.name || origName;
  console.log(`\n🚀 发布到 GitHub Release`);
  console.log(`   仓库: ${REPO}`);
  console.log(`   文件: ${origName} (${(size / 1048576).toFixed(1)} MB)`);
  console.log(`   tag:  ${tag}`);
  console.log(`   显示名: ${name}`);

  // 1) 检查 tag 是否已存在
  let release = null;
  try {
    const out = sh(`gh api repos/${REPO}/releases/tags/${JSON.stringify(tag).slice(1, -1)}`);
    release = JSON.parse(out);
    console.log("   ℹ️ tag 已存在，将复用该 Release");
  } catch (e) { /* 不存在则创建 */ }

  if (!release) {
    const body = `发布于 ${new Date().toLocaleDateString("zh-CN")}\n\n${o.desc || ""}`;
    release = JSON.parse(sh(
      `gh api repos/${REPO}/releases -f tag_name=${JSON.stringify(tag)} -f name=${JSON.stringify(name + (o.tag ? "" : "（自动发布）"))} -f body=${JSON.stringify(body)}`
    ));
    console.log(`   ✅ Release 已创建 #${release.id}`);
  } else {
    console.log(`   ✅ 复用 Release #${release.id}`);
  }

  // 2) 上传资产（Node fetch 直传 uploads.github.com，支持中文文件名）
  console.log("   ⬆️ 上传资产中（大文件可能需要几分钟）...");
  const TOKEN = sh("gh auth token");
  const asciiName = assetName(origName); // 中文→ASCII 资产名（下载 URL 稳定）
  const assetBuf = readFileSync(file);
  const upRes = await fetch(`https://uploads.github.com/repos/${REPO}/releases/${release.id}/assets?name=${encodeURIComponent(asciiName)}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/octet-stream",
      "Content-Length": String(assetBuf.length),
    },
    body: assetBuf,
  });
  const assetJson = await upRes.json().catch(() => null);
  if (!upRes.ok || !assetJson || !assetJson.id) {
    console.error("❌ 资产上传失败:", upRes.status, JSON.stringify(assetJson).slice(0, 200));
    process.exit(1);
  }
  const assetObj = assetJson;
  console.log(`   ✅ 资产已上传 id=${assetObj.id} name=${assetObj.name}`);

  const dlUrl = `https://github.com/${REPO}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(assetObj.name)}`;
  const browserUrl = `https://github.com/${REPO}/releases/tag/${encodeURIComponent(tag)}`;

  // 3) 登记 downloads.json（本地 git 仓库操作后推送）
  const dlPath = `${ROOT}/data/downloads.json`;
  let list = [];
  try { list = JSON.parse(readFileSync(dlPath, "utf8")); } catch (e) { list = []; }
  if (!Array.isArray(list)) list = [];

  const entry = {
    id: `rel-${Date.now().toString(36)}`,
    name: assetObj.name,
    store: "release",
    url: dlUrl,
    filename: name,
    size,
    version: o.tag.replace(/^v/, "") || "",
    desc: o.desc || "",
    category: o.category,
    date: new Date().toISOString().slice(0, 10),
    release: tag,
    assetId: String(assetObj.id),
  };
  // 移除同名旧记录
  list = list.filter(f => !(f.name === assetObj.name && f.store === "release"));
  list.unshift(entry);

  console.log("   📝 登记到 data/downloads.json 并推送...");
  sh(`git add data/downloads.json && git commit -m ${JSON.stringify(`📦 发布下载文件：${name} (${assetObj.name})`)} && git push origin main`, { cwd: ROOT });

  console.log(`\n🎉 发布完成！`);
  console.log(`   下载直链: ${dlUrl}`);
  console.log(`   页面将在约 1 分钟后更新: https://zyf2026.pages.dev/downloads.html`);
}

main().catch(e => { console.error("❌", e.message || e); process.exit(1); });
