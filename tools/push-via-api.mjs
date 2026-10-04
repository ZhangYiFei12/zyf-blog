/* 通过 gh api 手动构建 commit 并推送（github.com git 协议不通时的备用路径）

   用法：node tools/push-via-api.mjs <remoteHeadSha> [localDiffBase]

   说明：git fetch 不可用时，本地可能落后于远端（例如后台上传产生的提交）。
        此时用 remoteHeadSha 作为父提交与 base_tree，用 localDiffBase
        （本地已有、且与远端仅相差非交集文件）计算要提交哪些文件。
*/
import { execSync } from "child_process";
import fs from "fs";

const REPO = "ZhangYiFei12/zyf-blog";
const BRANCH = "main";
const remoteHead = process.argv[2];
const localBase = process.argv[3] || remoteHead;
if (!remoteHead) { console.error("用法: node tools/push-via-api.mjs <remoteHeadSha> [localDiffBase]"); process.exit(1); }

const MSG = fs.readFileSync("_commitmsg.txt", "utf8").trim();

let seq = 0;
function ghApi(args, body) {
  const opts = { encoding: "utf8", maxBuffer: 1024 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] };
  if (body !== undefined) {
    const tmp = `_body-${process.pid}-${++seq}.json`;
    fs.writeFileSync(tmp, JSON.stringify(body));
    try { return execSync(`gh api ${args} --input "${tmp}"`, opts).trim(); }
    finally { fs.unlinkSync(tmp); }
  }
  return execSync(`gh api ${args}`, opts).trim();
}
const ghJson = (a, b) => JSON.parse(ghApi(a, b));

console.log("remote head:", remoteHead, "| diff base:", localBase);

// 1) 相对 localBase 的变更（-z 避免非 ASCII 路径被转义）
const raw = execSync(`git diff --name-status -z ${localBase} HEAD`, { encoding: "utf8" }).split("\0").filter(Boolean);
const changes = [];
for (let i = 0; i + 1 < raw.length; i += 2) changes.push({ st: raw[i], p: raw[i + 1] });
console.log("变更文件:", changes.length);

// 2) blobs + tree entries
const tree = [];
let n = 0;
for (const { st, p } of changes) {
  n++;
  if (st === "D") {
    tree.push({ path: p, mode: "100644", type: "blob", sha: null });
    console.log(`  [${n}] D ${p}`);
    continue;
  }
  // 用 git 对象内容（而非工作区字节）：.gitattributes 保证仓库内为 LF，
  // 避免把工作区的 CRLF 原样写进远端造成换行符漂移
  const oid = execSync(`git rev-parse HEAD:${JSON.stringify(p)}`, { encoding: "utf8" }).trim();
  const buf = execSync(`git cat-file -p ${oid}`, { encoding: "buffer", maxBuffer: 256 * 1024 * 1024 });
  const blob = ghJson(`repos/${REPO}/git/blobs`, { content: buf.toString("base64"), encoding: "base64" });
  tree.push({ path: p, mode: "100644", type: "blob", sha: blob.sha });
  console.log(`  [${n}] ${st} ${p}`);
}

// 3) tree（基于远端 head 的 tree，保证不回退用户后台上传的改动）
const baseTree = ghJson(`repos/${REPO}/git/commits/${remoteHead}`).tree.sha;
const newTree = ghJson(`repos/${REPO}/git/trees`, { base_tree: baseTree, tree });
console.log("tree:", newTree.sha);

// 4) commit
const commit = ghJson(`repos/${REPO}/git/commits`, { message: MSG, tree: newTree.sha, parents: [remoteHead] });
console.log("commit:", commit.sha);

// 5) 更新 ref
const upd = ghJson(`repos/${REPO}/git/refs/heads/${BRANCH} -X PATCH`, { sha: commit.sha, force: false });
console.log("ref ->", upd.object.sha);
console.log("OK");
