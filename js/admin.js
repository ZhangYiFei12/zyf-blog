/* ============================================================
   js/admin.js —— 博客后台交互逻辑
   ============================================================ */
(function () {
  "use strict";

  var API = "/api/admin";
  var TOKEN_KEY = "zyf_admin_token";

  var $ = function (id) { return document.getElementById(id); };

  var loginView = $("loginView");
  var adminView = $("adminView");
  var passwordInput = $("passwordInput");
  var loginBtn = $("loginBtn");
  var loginError = $("loginError");
  var logoutBtn = $("logoutBtn");
  var publishBtn = $("publishBtn");
  var draftBtn = $("draftBtn");
  var publishStatus = $("publishStatus");
  var cancelEditBtn = $("cancelEditBtn");
  var editSlug = $("editSlug");
  var articleList = $("articleList");
  var listLoading = $("listLoading");
  var toastEl = $("toast");

  var articleFilter = $("articleFilter");
  var uploadImgBtn = $("uploadImgBtn");
  var imgFileInput = $("imgFileInput");

  /* ⚙️ 图片优化设置（localStorage 持久化） */
  var IMG_SETTINGS_KEY = "zyf-img-settings";
  var imgSettings = {
    target: 2048,          // 压缩目标 KB
    quality: 0.8,          // 压缩质量
    thumbWidth: 480,       // 缩略图宽度 px
    thumbQuality: 0.8,     // 缩略图质量
    thumbTarget: 0,        // 缩略图目标大小 KB（0 = 不限制）
    makeThumb: true        // 是否自动生成缩略图
  };
  function loadImgSettings() {
    try {
      var saved = JSON.parse(localStorage.getItem(IMG_SETTINGS_KEY) || "{}") || {};
      imgSettings.target = parseInt(saved.target, 10) || 2048;
      imgSettings.quality = parseFloat(saved.quality) || 0.8;
      imgSettings.thumbWidth = parseInt(saved.thumbWidth, 10) || 480;
      imgSettings.thumbQuality = parseFloat(saved.thumbQuality) || 0.8;
      imgSettings.thumbTarget = parseInt(saved.thumbTarget, 10) || 0;
      imgSettings.makeThumb = saved.makeThumb !== false;
    } catch (e) { /* 忽略损坏数据 */ }
  }
  function saveImgSettings() {
    try { localStorage.setItem(IMG_SETTINGS_KEY, JSON.stringify(imgSettings)); } catch (e) {}
  }
  function bindImgSettings() {
    var els = {
      target: $("optTarget"),
      quality: $("optQuality"),
      thumbWidth: $("optThumbWidth"),
      thumbQuality: $("optThumbQuality"),
      thumbTarget: $("optThumbTarget"),
      makeThumb: $("optMakeThumb")
    };
    function applyToUI() {
      if (els.target) els.target.value = String(imgSettings.target);
      if (els.quality) els.quality.value = String(imgSettings.quality);
      if (els.thumbWidth) els.thumbWidth.value = String(imgSettings.thumbWidth);
      if (els.thumbQuality) els.thumbQuality.value = String(imgSettings.thumbQuality);
      if (els.thumbTarget) els.thumbTarget.value = String(imgSettings.thumbTarget);
      if (els.makeThumb) els.makeThumb.checked = !!imgSettings.makeThumb;
    }
    if (els.target) els.target.addEventListener("change", function () { imgSettings.target = parseInt(els.target.value, 10) || 2048; saveImgSettings(); });
    if (els.quality) els.quality.addEventListener("change", function () { imgSettings.quality = parseFloat(els.quality.value) || 0.8; saveImgSettings(); });
    if (els.thumbWidth) els.thumbWidth.addEventListener("change", function () { imgSettings.thumbWidth = parseInt(els.thumbWidth.value, 10) || 480; saveImgSettings(); });
    if (els.thumbQuality) els.thumbQuality.addEventListener("change", function () { imgSettings.thumbQuality = parseFloat(els.thumbQuality.value) || 0.8; saveImgSettings(); });
    if (els.thumbTarget) els.thumbTarget.addEventListener("change", function () { imgSettings.thumbTarget = parseInt(els.thumbTarget.value, 10) || 0; saveImgSettings(); });
    if (els.makeThumb) els.makeThumb.addEventListener("change", function () { imgSettings.makeThumb = els.makeThumb.checked; saveImgSettings(); });
    var toggle = $("imgSettingsToggle");
    if (toggle) toggle.addEventListener("click", function () { document.querySelector(".img-settings").classList.toggle("collapsed"); });
    applyToUI();
  }
  loadImgSettings();
  bindImgSettings();

  var previewTimer = null;

  var uploadMdBtn = $("uploadMdBtn");
  var mdFileInput = $("mdFileInput");

  var tabArticles = $("tabArticles");
  var tabProjects = $("tabProjects");
  var tabGallery = $("tabGallery");
  var tabDownloads = $("tabDownloads");
  var tabLinks = $("tabLinks");
  var tabKb = $("tabKb");
  var tabSite = $("tabSite");
  var viewArticles = $("viewArticles");
  var viewProjects = $("viewProjects");
  var viewGallery = $("viewGallery");
  var viewDownloads = $("viewDownloads");
  var viewLinks = $("viewLinks");
  var viewKb = $("viewKb");
  var viewSite = $("viewSite");
  var galleryGrid = $("galleryGrid");
  var galleryLoading = $("galleryLoading");
  var galleryUploadBtn = $("galleryUploadBtn");
  var galleryFileInput = $("galleryFileInput");
  var galleryCount = $("galleryCount");
  var galleryCache = [];
  var downloadsGrid = $("downloadsGrid");
  var downloadsLoading = $("downloadsLoading");
  var downloadsUploadBtn = $("downloadsUploadBtn");
  var downloadsFileInput = $("downloadsFileInput");
  var downloadsCount = $("downloadsCount");
  var downloadsCache = [];
  var projectList = $("projectList");
  var projectListLoading = $("projectListLoading");
  var saveProjectBtn = $("saveProjectBtn");
  var projDraftBtn = $("projDraftBtn");
  var resetProjectBtn = $("resetProjectBtn");
  var projectId = $("projectId");
  var projectsCache = [];
  var projectFilterEl = $("projectFilter");
  var projectFilterStatus = "";
  var linkList = $("linkList");
  var linkListLoading = $("linkListLoading");
  var saveLinkBtn = $("saveLinkBtn");
  var resetLinkBtn = $("resetLinkBtn");
  var linkId = $("linkId");
  var linksCache = [];
  var kbList = $("kbList");
  var kbListLoading = $("kbListLoading");
  var saveKbBtn = $("saveKbBtn");
  var resetKbBtn = $("resetKbBtn");
  var kbSlug = $("kbSlug");
  var kbDocsCache = [];
  var pendingDeleteId = null;
  var pendingDeleteBtn = null;
  var pendingDeleteTimer = null;

  /* ---------- 草稿本地状态 ---------- */
  var draftList = $("draftList");
  var draftListLoading = $("draftListLoading");
  var autosaveStatus = $("autosaveStatus");
  var AUTOSAVE_DELAY = 5000;   // 停止输入 5 秒后自动保存
  var currentDraftId = "";     // 当前编辑器对应的草稿 key
  var autosaveTimer = null;
  var lastSavedSnapshot = "";  // 用于跳过无变化的保存

  /* 新建一篇还没发布的文章时，需要一个稳定的草稿 key，
     否则标题一变就会多出一份草稿。 */
  function newDraftId() {
    return "new-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function editorSnapshot() {
    return [
      $("titleField").value, $("dateField").value, $("tagsField").value,
      $("excerptField").value, $("bodyField").value,
    ].join("\u0000");
  }

  function setAutosaveState(state, text) {
    if (!autosaveStatus) return;
    autosaveStatus.textContent = text || "";
    autosaveStatus.style.color = state === "error" ? "var(--danger)"
      : state === "ok" ? "var(--accent)" : "var(--text-dim)";
  }

  /* 草稿 payload（与后端 /api/admin/drafts 的字段白名单一致） */
  function draftPayload(type) {
    return {
      type: type || "article",
      id: currentDraftId,
      slug: editSlug.value || "",
      title: $("titleField").value.trim(),
      date: $("dateField").value.trim() || today(),
      tags: $("tagsField").value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean),
      excerpt: $("excerptField").value.trim(),
      body: $("bodyField").value,
      basePublished: !!(editSlug.value),
    };
  }

  /* 自动保存：只写私有 KV，不碰公开仓库 */
  function autosaveDraft() {
    if (!currentDraftId) currentDraftId = newDraftId();
    var payload = draftPayload("article");
    if (!payload.title && !payload.body.trim()) return;      // 空编辑器不存
    var snap = editorSnapshot();
    if (snap === lastSavedSnapshot) { setAutosaveState("ok", "✓ 已保存"); return; }
    setAutosaveState("saving", "保存中…");
    api("/drafts", { method: "POST", body: payload })
      .then(function () {
        lastSavedSnapshot = snap;
        var t = new Date();
        var hh = String(t.getHours()).padStart(2, "0");
        var mm = String(t.getMinutes()).padStart(2, "0");
        setAutosaveState("ok", "✓ 已保存 " + hh + ":" + mm);
        loadDrafts();
      })
      .catch(function (err) {
        setAutosaveState("error", "✗ 保存失败：" + err.message);
      });
  }

  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    setAutosaveState("", "");
    autosaveTimer = setTimeout(autosaveDraft, AUTOSAVE_DELAY);
  }

  /* ---------- 草稿箱 ---------- */

  function loadDrafts() {
    if (!draftList) return;
    if (draftListLoading) draftListLoading.style.display = "block";
    api("/drafts")
      .then(function (data) {
        renderDrafts(data.drafts || [], data.kvBound !== false);
      })
      .catch(function (err) {
        draftList.innerHTML = '<p style="font-size:11px;color:var(--danger);">草稿读取失败：' + escapeHtml(err.message) + "</p>";
      })
      .finally(function () { if (draftListLoading) draftListLoading.style.display = "none"; });
  }

  function fmtTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var p = function (n) { return String(n).padStart(2, "0"); };
    return (d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function renderDrafts(list, kvBound) {
    if (!kvBound) {
      draftList.innerHTML = '<p style="font-size:11px;color:var(--danger);">未绑定 DRAFTS_KV，草稿功能不可用。请在 Cloudflare Pages 项目设置里绑定 KV 命名空间。</p>';
      return;
    }
    if (!list.length) {
      draftList.innerHTML = '<p style="font-size:11px;color:var(--text-dim);">暂无草稿</p>';
      return;
    }
    draftList.innerHTML = list.map(function (d) {
      var isArticle = d.type === "article";
      var badge = d.basePublished ? '<span class="tag">待发布修改</span>' : '<span class="tag">未发布</span>';
      var sub = d.basePublished ? "线上仍是已发布的旧版" : "线上不可见";
      return '<div class="post-item" style="cursor:default;padding:10px 12px;">' +
        '<div class="post-left">' +
          '<span class="post-title">' + escapeHtml(d.title || "（无标题草稿）") + '</span>' +
          '<span class="post-excerpt" style="font-size:11px;">' + escapeHtml(sub) + ' · ' + escapeHtml(fmtTime(d.updatedAt)) + '</span>' +
          '<div class="post-tags">' + badge + '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:6px;">' +
          '<button class="btn btn-outline btn-sm" data-draft-restore="' + escapeAttr(d.type) + '|' + escapeAttr(d.id) + '">继续编辑</button>' +
          '<button class="btn btn-outline btn-sm" data-draft-del="' + escapeAttr(d.type) + '|' + escapeAttr(d.id) + '">删除</button>' +
        '</div>' +
      '</div>';
    }).join("");
  }

  /* 草稿箱按钮（事件委派） */
  if (draftList) {
    draftList.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-draft-restore],[data-draft-del]") : null;
      if (!btn) return;
      var restore = btn.getAttribute("data-draft-restore");
      var del = btn.getAttribute("data-draft-del");
      if (restore) {
        var p = restore.split("|");
        restoreDraft(p[0], p[1]);
      } else if (del) {
        var q = del.split("|");
        if (!window.confirm("确定删除这份草稿？此操作不可撤销。")) return;
        api("/drafts/" + encodeURIComponent(q[0]) + "/" + encodeURIComponent(q[1]), { method: "DELETE" })
          .then(function () { showToast("草稿已删除", "success"); loadDrafts(); })
          .catch(function (err) { showToast(err.message, "error"); });
      }
    });
  }

  /* 把草稿内容填回编辑器。已发布文章走 loadArticle 以保留原 slug。 */
  function restoreDraft(type, id) {
    if (type !== "article") { showToast("暂不支持该类型草稿", "info"); return; }
    showToast("恢复草稿中…", "info");
    api("/drafts/" + encodeURIComponent(type) + "/" + encodeURIComponent(id))
      .then(function (data) {
        var d = data.draft;
        applyDraftToEditor(d);
        showToast("已恢复草稿（未发布）", "success");
      })
      .catch(function (err) { showToast(err.message, "error"); });
  }

  function applyDraftToEditor(d) {
    $("titleField").value = d.title || "";
    $("dateField").value = d.date || today();
    $("tagsField").value = (d.tags || []).join(", ");
    $("excerptField").value = d.excerpt || "";
    $("bodyField").value = d.body || "";
    editSlug.value = d.slug || "";
    currentDraftId = d.id;
    lastSavedSnapshot = editorSnapshot();
    cancelEditBtn.style.display = "inline-flex";
    updatePreviewBtnVisibility();
    publishBtn.textContent = "📝 发布";
    draftBtn.textContent = "💾 存草稿";
    setAutosaveState("ok", d.basePublished ? "有未发布修改（线上仍是旧版）" : "草稿未发布");
    updatePreview();
    $("titleField").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* 预览按钮：已发布的才指向线上页面；未发布的走已认证的弹窗预览 */
  function updatePreviewBtnVisibility() {
    var pv = $("previewArticleBtn");
    if (!pv) return;
    pv.style.display = editSlug.value ? "inline-flex" : "none";
    pv.textContent = editSlug.value ? "🔗 线上页面" : "🔗 预览";
  }

  /* 已认证的草稿预览：用当前令牌取渲染结果，在新窗口展示。
     整个过程不写任何公开文件，所以草稿不会被提前泄露。 */
  function openAuthedPreview() {
    var payload = draftPayload("article");
    api("/preview", {
      method: "POST",
      body: { title: payload.title || "（无标题）", date: payload.date, tags: payload.tags, excerpt: payload.excerpt, body: payload.body },
    }).then(function (data) {
      var cssHref = "/css/style.css";
      var link = document.querySelector('link[rel="stylesheet"]');
      if (link && link.getAttribute("href")) cssHref = link.getAttribute("href");
      var cssAbs = new URL(cssHref, window.location.href).href;
      var theme = document.documentElement.getAttribute("data-theme") || "dark";
      var html = '<!DOCTYPE html><html lang="zh-CN" data-theme="' + theme + '"><head><meta charset="UTF-8" />'
        + '<meta name="robots" content="noindex,nofollow" /><title>草稿预览（仅本地）</title>'
        + '<link rel="stylesheet" href="' + cssAbs + '" /></head><body><main class="container">'
        + '<article class="article"><div class="article-body">' + data.html + '</div></article>'
        + '</main></body></html>';
      var url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      var w = window.open(url, "_blank");
      if (!w) showToast("预览窗口被浏览器拦截，请允许弹出窗口", "error");
    }).catch(function (err) { showToast("预览失败：" + err.message, "error"); });
  }

  /* ---------- 工具 ---------- */

  function getToken() { return sessionStorage.getItem(TOKEN_KEY); }
  function setToken(t) { sessionStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { sessionStorage.removeItem(TOKEN_KEY); }

  function showToast(msg, type) {
    toastEl.textContent = msg;
    toastEl.className = "toast " + (type || "info");
    toastEl.style.display = "block";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toastEl.style.display = "none"; }, type === "error" ? 6000 : 4000);
  }

  function api(path, options) {
    options = options || {};
    var headers = { "Content-Type": "application/json" };
    var token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;
    return fetch(API + path, {
      method: options.method || "GET",
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.error) || ("请求失败 " + res.status));
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  /* ---------- 登录 / 登出 ---------- */

  function showLogin() {
    loginView.style.display = "flex";
    adminView.style.display = "none";
    setTimeout(function () { passwordInput.focus(); }, 50);
  }

  function showAdmin() {
    loginView.style.display = "none";
    adminView.style.display = "block";
    loadArticles();
    loadProjects();
    // 重新登录后要把上次未发的草稿捞回来
    loadDrafts();
  }

  function login() {
    var pass = passwordInput.value;
    if (!pass) return;
    loginError.style.display = "none";
    loginBtn.disabled = true;
    loginBtn.textContent = "登录中…";
    api("/login", { method: "POST", body: { password: pass } })
      .then(function (data) {
        setToken(data.token);
        passwordInput.value = "";
        showAdmin();
        showToast("登录成功 ✓", "success");
      })
      .catch(function (err) {
        if (err.status === 401) loginError.textContent = "密码错误";
        else loginError.textContent = err.message;
        loginError.style.display = "block";
      })
      .finally(function () {
        loginBtn.disabled = false;
        loginBtn.textContent = "登录";
      });
  }

  loginBtn.addEventListener("click", login);
  passwordInput.addEventListener("keydown", function (e) { if (e.key === "Enter") login(); });

  logoutBtn.addEventListener("click", function () {
    clearToken();
    showLogin();
  });

  /* ---------- 文章列表（含草稿筛选） ---------- */

  var articleFilterStatus = ""; // "" = 全部, "published", "draft"

  function loadArticles() {
    articleList.innerHTML = "";
    listLoading.style.display = "block";
    api("/articles")
      .then(function (data) {
        listLoading.style.display = "none";
        if (!data.articles || !data.articles.length) {
          articleList.innerHTML = '<div class="empty-state">暂无文章<br/>写一篇发布吧 📝</div>';
          return;
        }
        var filtered = data.articles;
        if (articleFilterStatus === "published") filtered = filtered.filter(function (a) { return a.published !== false; });
        else if (articleFilterStatus === "draft") filtered = filtered.filter(function (a) { return a.published === false; });
        filtered.forEach(function (a) {
          var badge = a.published === false ? ' <span style="color:var(--accent);font-size:10px;border:1px solid var(--accent);border-radius:3px;padding:1px 6px;margin-left:4px;">草稿</span>' : "";
          var item = document.createElement("div");
          item.className = "item";
          item.innerHTML =
            '<div class="info">' +
              '<div class="title">' + escapeHtml(a.title || "(无标题)") + badge + "</div>" +
              '<div class="date">' + escapeHtml(a.date || "") + (a.tags && a.tags.length ? " · " + escapeHtml(a.tags.join(" / ")) : "") + "</div>" +
            "</div>" +
            '<div class="actions">' +
              '<a class="btn btn-outline btn-sm" href="blog/' + escapeAttr(encodeURIComponent(a.slug)) + '" target="_blank" rel="noopener noreferrer" title="在当前页预览渲染后的页面（草稿仅能通过此直链查看）">预览</a>' +
              '<button class="btn btn-outline btn-sm" data-action="edit" data-slug="' + escapeAttr(a.slug) + '">编辑</button>' +
              '<button class="btn btn-danger btn-sm" data-action="del" data-slug="' + escapeAttr(a.slug) + '">删除</button>' +
            "</div>";
          articleList.appendChild(item);
        });
        if (!filtered.length) {
          articleList.innerHTML = '<div class="empty-state">没有匹配的文章</div>';
        }
      })
      .catch(function (err) {
        listLoading.style.display = "none";
        articleList.innerHTML = '<div class="empty-state" style="color:var(--danger);">加载失败：' + escapeHtml(err.message) + "</div>";
      });
  }

  // 文章列表筛选切换
  if (articleFilter) {
    articleFilter.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-filter]");
      if (!btn) return;
      articleFilterStatus = btn.getAttribute("data-filter") || "";
      articleFilter.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
      btn.classList.add("active");
      loadArticles();
    });
  }

  articleList.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-action]");
    if (!btn) return;
    var slug = btn.getAttribute("data-slug");
    if (btn.getAttribute("data-action") === "edit") {
      loadArticle(slug);
    } else if (btn.getAttribute("data-action") === "del") {
      deleteArticle(slug);
    }
  });

  /* ---------- 编辑加载 ---------- */

  function loadArticle(slug) {
    showToast("加载中…", "info");
    api("/articles/" + encodeURIComponent(slug))
      .then(function (data) {
        $("titleField").value = data.meta.title || "";
        $("dateField").value = data.meta.date || today();
        $("tagsField").value = (data.meta.tags || []).join(", ");
        $("excerptField").value = data.meta.excerpt || "";
        $("bodyField").value = data.body || "";
        editSlug.value = data.slug;
        currentDraftId = data.slug;
        cancelEditBtn.style.display = "inline-flex";
        publishBtn.textContent = "📝 发布";
        draftBtn.textContent = "💾 存草稿";

        // 有同名草稿 → 直接用草稿内容继续编辑（线上仍是已发布的旧版）
        if (data.draft) {
          applyDraftToEditor(data.draft);
          showToast("已恢复未发布的草稿修改（线上仍是旧版）", "success");
        } else {
          lastSavedSnapshot = editorSnapshot();
          setAutosaveState("", "");
          updatePreviewBtnVisibility();
          updatePreview();
          showToast("已载入《" + (data.meta.title || "") + "》", "success");
        }
        $("titleField").scrollIntoView({ behavior: "smooth", block: "start" });
      })
      .catch(function (err) { showToast(err.message, "error"); });
  }

  function resetEditor() {
    $("titleField").value = "";
    $("dateField").value = today();
    $("tagsField").value = "";
    $("excerptField").value = "";
    $("bodyField").value = "";
    editSlug.value = "";
    currentDraftId = newDraftId();   // 新文章：给一个稳定的草稿 key
    lastSavedSnapshot = "";
    clearTimeout(autosaveTimer);
    setAutosaveState("", "");
    cancelEditBtn.style.display = "none";
    var pv2 = $("previewArticleBtn");
    if (pv2) pv2.style.display = "none";
    publishBtn.textContent = "📝 发布";
    draftBtn.textContent = "💾 存草稿";
    updatePreview();
  }

  cancelEditBtn.addEventListener("click", function () {
    // 取消编辑不等于丢弃草稿：已保存的草稿仍留在草稿箱里，可随时恢复
    resetEditor();
    loadDrafts();
  });

  /* ---------- 上传 .md 文件（解析 Front Matter 填入表单） ---------- */

  function parseFrontMatter(raw) {
    var meta = { title: "", date: "", excerpt: "", tags: [] };
    if (raw.indexOf("---") === 0) {
      var end = raw.indexOf("\n---", 3);
      if (end !== -1) {
        var fm = raw.slice(3, end).trim();
        var body = raw.slice(end + 4);
        fm.split("\n").forEach(function (line) {
          var m = line.match(/^([a-zA-Z_]+)\s*:\s*(.*)$/);
          if (!m) return;
          var key = m[1].toLowerCase();
          var val = m[2].trim();
          if ((val.charAt(0) === '"' && val.charAt(val.length - 1) === '"') || (val.charAt(0) === "'" && val.charAt(val.length - 1) === "'")) {
            val = val.slice(1, -1);
          }
          if (key === "tags") {
            meta.tags = val.replace(/^\[|\]$/g, "").split(/[,，]/).map(function (s) { return s.trim().replace(/^["']|["']$/g, ""); }).filter(Boolean);
          } else if (key in meta) {
            meta[key] = val;
          }
        });
        return { meta: meta, body: body.trim() };
      }
    }
    // 无 Front Matter：从内容第一行推标题
    var lines = raw.split("\n");
    var first = "";
    for (var i = 0; i < lines.length; i++) { if (lines[i].trim().length) { first = lines[i]; break; } }
    meta.title = first ? first.replace(/^#+\s*/, "").trim() : "";
    return { meta: meta, body: raw.trim() };
  }

  uploadMdBtn.addEventListener("click", function () { mdFileInput.click(); });

  mdFileInput.addEventListener("change", function () {
    var file = mdFileInput.files && mdFileInput.files[0];
    if (!file) return;
    if (!/\.(md|markdown)$/i.test(file.name)) {
      showToast("请选择 .md / .markdown 文件", "error");
      mdFileInput.value = "";
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      var raw = String(e.target && e.target.result || "");
      if (!raw.trim()) { showToast("文件内容为空", "error"); mdFileInput.value = ""; return; }
      var parsed = parseFrontMatter(raw);
      $("titleField").value = parsed.meta.title || "";
      $("dateField").value = parsed.meta.date || today();
      $("tagsField").value = parsed.meta.tags.join(", ");
      $("excerptField").value = parsed.meta.excerpt || "";
      $("bodyField").value = parsed.body || "";
      updatePreview();
      showToast("已载入《" + (parsed.meta.title || file.name) + "》", "success");
      mdFileInput.value = "";
    };
    reader.onerror = function () { showToast("读取文件失败", "error"); mdFileInput.value = ""; };
    reader.readAsText(file, "utf-8");
  });

  /* ---------- 实时预览（防抖，服务器端渲染同一转换器） ---------- */

  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, 600);
  }

  function updatePreview() {
    var title = $("titleField").value.trim();
    var date = $("dateField").value.trim();
    var tags = $("tagsField").value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
    var excerpt = $("excerptField").value.trim();
    var body = $("bodyField").value;
    $("previewContent").innerHTML = '<p style="color:var(--text-dim);font-size:12px;">渲染中…</p>';
    api("/preview", { method: "POST", body: { title: title, date: date, tags: tags, excerpt: excerpt, body: body } })
      .then(function (data) { $("previewContent").innerHTML = data.html; })
      .catch(function (err) {
        $("previewContent").innerHTML = '<p style="color:var(--danger);font-size:12px;">预览失败：' + escapeHtml(err.message) + "</p>";
      });
  }

  // 所有字段变化都触发实时预览 + 自动保存（停输 5 秒）
  ["titleField", "dateField", "tagsField", "excerptField", "bodyField"].forEach(function (id) {
    $(id).addEventListener("input", function () {
      schedulePreview();
      scheduleAutosave();
    });
  });

  // 预览按钮：已发布 → 新窗口打线上页；未发布 → 用已认证接口弹本地预览
  (function () {
    var pv = $("previewArticleBtn");
    if (!pv) return;
    pv.addEventListener("click", function (e) {
      if (editSlug.value) {
        e.preventDefault();
        window.open("blog/" + encodeURIComponent(editSlug.value), "_blank", "noopener");
      } else {
        e.preventDefault();
        openAuthedPreview();
      }
    });
  })();

  // 关页面前把未保存的改动落进私有草稿（尽力而为）
  window.addEventListener("beforeunload", function () {
    clearTimeout(autosaveTimer);
    if (currentDraftId && editorSnapshot() !== lastSavedSnapshot) {
      var payload = draftPayload("article");
      if (payload.title || payload.body.trim()) {
        try {
          var token = getToken();
          fetch(API + "/drafts", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify(payload),
            keepalive: true,
          });
        } catch (e) { /* 忽略 */ }
      }
    }
  });

  /* ---------- 发布 / 存草稿 ---------- */

  function submitArticle(isPublished) {
    var title = $("titleField").value.trim();
    var body = $("bodyField").value.trim();
    if (!title) { showToast("请填写标题", "error"); return; }
    if (!body) { showToast("请填写正文", "error"); return; }

    var payload = {
      title: title,
      date: $("dateField").value.trim() || today(),
      tags: $("tagsField").value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean),
      excerpt: $("excerptField").value.trim(),
      body: body,
      published: isPublished,
    };
    if (editSlug.value) payload.slug = editSlug.value;
    // 带上草稿 key，发布成功后后端会一并删除草稿
    if (currentDraftId) payload.draftId = currentDraftId;

    var btn = isPublished ? publishBtn : draftBtn;
    btn.disabled = true;
    btn.textContent = "提交中…";
    publishStatus.textContent = "";
    clearTimeout(autosaveTimer);

    api("/articles", { method: "POST", body: payload })
      .then(function (data) {
        if (data.draft) {
          // 存草稿：只写了私有 KV，线上没有任何变化
          if (data.draftId) currentDraftId = data.draftId;
          lastSavedSnapshot = editorSnapshot();
          setAutosaveState("ok", "✓ 草稿已保存" + (editSlug.value ? "（线上仍是旧版）" : ""));
          publishStatus.textContent = "✔ " + data.message;
          showToast(data.message, "success");
          loadDrafts();
          return;
        }
        // 发布成功：草稿已在后端删除
        publishStatus.textContent = "✔ " + data.message;
        setAutosaveState("ok", "✓ 已发布");
        showToast(data.message, "success");
        if (data.slug) {
          editSlug.value = data.slug;
          currentDraftId = data.slug;
          updatePreviewBtnVisibility();
        }
        loadArticles();
        loadDrafts();
      })
      .catch(function (err) {
        // 发布失败：后端已把内容保留在私有草稿里，这里提示不要重写
        setAutosaveState("error", "✗ " + (err.message || "提交失败"));
        showToast(err.message, "error");
        loadDrafts();
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = isPublished ? "📝 发布" : "💾 存草稿";
      });
  }

  publishBtn.addEventListener("click", function () { submitArticle(true); });
  draftBtn.addEventListener("click", function () { submitArticle(false); });

  /* ---------- 图片压缩（Canvas，超限自动执行） ---------- */

  function formatSize(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + "MB";
    if (bytes >= 1024) return Math.round(bytes / 1024) + "KB";
    return bytes + "B";
  }

  /**
   * 用 Canvas 压缩图片到目标字节数以下。
   * 策略：先用所选质量绘制原图，超限则逐步缩小尺寸（保持所选质量），
   * 缩到下限仍超限再逐步降低质量，直到达标或达到迭代上限。
   * 输出统一为 image/jpeg（透明背景填白底）。
   */
  function compressImage(dataUrl, targetBytes, quality) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        try {
          var canvas = document.createElement("canvas");
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          if (!w || !h) { reject(new Error("无法读取图片尺寸")); return; }
          // 预缩：面积超过 16M 像素时先压到限制内（兼容 iOS canvas 限制）
          var MAX_AREA = 16 * 1024 * 1024;
          if (w * h > MAX_AREA) {
            var k0 = Math.sqrt(MAX_AREA / (w * h));
            w = Math.floor(w * k0); h = Math.floor(h * k0);
          }
          var q = quality;
          var out = "", b64 = "", bytes = 0, ctx;
          for (var iter = 0; iter < 14; iter++) {
            canvas.width = w; canvas.height = h;
            ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff"; // JPEG 无透明通道，白底
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            out = canvas.toDataURL("image/jpeg", q);
            b64 = out.split(",")[1] || "";
            bytes = Math.floor(b64.length * 3 / 4);
            if (bytes <= targetBytes) break;
            if (w > 400) {          // 优先缩尺寸，保持所选质量
              w = Math.floor(w * 0.85); h = Math.floor(h * 0.85);
            } else if (q > 0.3) {   // 尺寸到底后降质量
              q = Math.max(0.3, q - 0.15);
            } else {
              break;                // 已到底，返回当前结果
            }
          }
          resolve({ dataUrl: out, bytes: bytes });
        } catch (err) { reject(err); }
      };
      img.onerror = function () { reject(new Error("图片解码失败")); };
      img.src = dataUrl;
    });
  }

  /**
   * 生成缩略图（webp），用于相册网格快速加载。
   * @param {string} dataUrl 原图 dataURL
   * @param {number} maxWidth 缩略图最大宽度
   * @param {number} quality webp 质量 0-1
   * @param {number} [targetBytes] 目标字节数（0/省略 = 不限制）；超限则依次降质量、缩尺寸
   */
  function makeThumbnail(dataUrl, maxWidth, quality, targetBytes) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          if (!w || !h) { reject(new Error("无法读取图片尺寸")); return; }
          maxWidth = parseInt(maxWidth, 10) || 480;
          if (w > maxWidth) {
            h = Math.round(h * maxWidth / w); w = maxWidth;
          }
          var target = Math.max(0, Number(targetBytes) || 0);
          var canvas = document.createElement("canvas");
          var q = quality || 0.8;
          var qFloor = 0.5;          // 质量下限（先保锐度）
          var out = "", b64 = "", bytes = 0, ctx;
          for (var iter = 0; iter < 16; iter++) {
            canvas.width = w; canvas.height = h;
            ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            out = canvas.toDataURL("image/webp", q);
            b64 = out.split(",")[1] || "";
            bytes = Math.floor(b64.length * 3 / 4);
            if (!target || bytes <= target) break;   // 无目标或已达标
            if (q > qFloor) {                         // 阶段1：先降质量到 0.5
              q = Math.max(qFloor, q - 0.1);
            } else if (w > 200) {                     // 阶段2：再缩尺寸（保锐度）
              w = Math.floor(w * 0.85); h = Math.floor(h * 0.85);
            } else if (q > 0.32) {                    // 阶段3：到底后再降一点质量
              q = Math.max(0.32, q - 0.06);
            } else {
              break;                                  // 极小目标，到此为止
            }
          }
          resolve({ dataUrl: out, bytes: bytes });
        } catch (err) { reject(err); }
      };
      img.onerror = function () { reject(new Error("图片解码失败")); };
      img.src = dataUrl;
    });
  }

  uploadImgBtn.addEventListener("click", function () { imgFileInput.click(); });

  /* 上传一批图片并把 Markdown 插入正文（选择文件 / 粘贴 / 拖拽共用） */
  function uploadImagesToBody(files) {
    if (!files || !files.length) return;
    var HARD_LIMIT = 5 * 1024 * 1024;
    var targetBytes = imgSettings.target * 1024;
    var quality = imgSettings.quality;
    var okCount = 0, failCount = 0, compressedNote = null;

    uploadImgBtn.disabled = true;

    var resetBtn = function () {
      uploadImgBtn.disabled = false;
      uploadImgBtn.textContent = "🖼️ 上传图片";
      imgFileInput.value = "";
    };

    var finish = function () {
      resetBtn();
      if (failCount && !okCount) return; // 失败时已逐个提示，不再覆盖
      if (okCount === 1 && compressedNote) {
        showToast("已压缩 " + compressedNote + "，部署后即可显示（约 30 秒）", "success");
      } else if (okCount > 1) {
        showToast("已上传 " + okCount + " 张图片" + (compressedNote ? "（已压缩）" : "") + "，部署后即可显示（约 30 秒）", "success");
      }
    };

    var processNext = function (i) {
      if (i >= files.length) { finish(); return; }
      var file = files[i];
      uploadImgBtn.textContent = files.length > 1 ? "上传中 " + (i + 1) + "/" + files.length : "上传中…";

      var insertMd = function (data) {
        var md = "![" + (file.name.replace(/\.[^.]*$/, "") || "图片") + "](" + data.url + ")";
        var body = $("bodyField");
        var pos = body.selectionStart || body.value.length;
        body.value = body.value.slice(0, pos) + md + body.value.slice(body.selectionEnd || pos);
        okCount++;
        processNext(i + 1);
      };
      var fail = function (msg) {
        failCount++;
        showToast((files.length > 1 ? "[" + file.name + "] " : "") + msg, "error");
        processNext(i + 1);
      };

      // 未超过压缩目标：直接上传原图
      if (file.size <= targetBytes) {
        var reader0 = new FileReader();
        reader0.onload = function (e) {
          var result = e.target && e.target.result;
          if (!result) { fail("读取图片失败"); return; }
          var mime0 = (result.split(",")[0].match(/data:([^;]+)/) || ["", "image/png"])[1];
          var ext0 = file.name.split(".").pop() || "png";
          api("/upload", { method: "POST", body: { data: (result.split(",")[1]) || "", mime: mime0, ext: ext0 } })
            .then(insertMd).catch(function (err) { fail(err.message); });
        };
        reader0.onerror = function () { fail("读取图片失败"); };
        reader0.readAsDataURL(file);
        return;
      }

      // 超过压缩目标：自动压缩后上传
      var reader = new FileReader();
      reader.onload = function (e) {
        var result = e.target && e.target.result;
        if (!result) { fail("读取图片失败"); return; }
        compressImage(result, targetBytes, quality)
          .then(function (out) {
            if (out.bytes > HARD_LIMIT) { fail("压缩后仍超过 5MB（" + formatSize(out.bytes) + "）"); return; }
            compressedNote = formatSize(file.size) + " → " + formatSize(out.bytes);
            return api("/upload", { method: "POST", body: { data: (out.dataUrl.split(",")[1]) || "", mime: "image/jpeg", ext: "jpg" } })
              .then(insertMd);
          })
          .catch(function () { fail("图片压缩失败"); });
      };
      reader.onerror = function () { fail("读取图片失败"); };
      reader.readAsDataURL(file);
    };
    processNext(0);
  }

  imgFileInput.addEventListener("change", function () {
    var files = Array.prototype.slice.call(imgFileInput.files || []);
    if (!files.length) return;
    uploadImagesToBody(files);
  });

  /* 正文框：粘贴截图直接上传并插入 Markdown */
  (function () {
    var body = $("bodyField");
    if (!body) return;

    body.addEventListener("paste", function (e) {
      var items = (e.clipboardData && e.clipboardData.items) || [];
      var imgs = [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].kind === "file" && /^image\//.test(items[i].type)) {
          var f = items[i].getAsFile();
          if (f) imgs.push(f);
        }
      }
      if (!imgs.length) return; // 普通文本粘贴不受影响
      e.preventDefault();
      uploadImagesToBody(imgs);
    });

    /* 拖拽图片文件到正文框 */
    var stop = function (e) { e.preventDefault(); e.stopPropagation(); };
    ["dragenter", "dragover"].forEach(function (ev) {
      body.addEventListener(ev, function (e) {
        if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") !== -1) {
          stop(e);
          body.classList.add("drop-active");
        }
      });
    });
    ["dragleave", "dragend"].forEach(function (ev) {
      body.addEventListener(ev, function () { body.classList.remove("drop-active"); });
    });
    body.addEventListener("drop", function (e) {
      body.classList.remove("drop-active");
      var fl = (e.dataTransfer && e.dataTransfer.files) || [];
      var imgs = Array.prototype.filter.call(fl, function (f) { return /^image\//.test(f.type); });
      if (!imgs.length) return;
      stop(e);
      uploadImagesToBody(imgs);
    });
  })();

  function deleteArticle(slug) {
    if (!confirm("确定删除这篇文章吗？\n删除后不可恢复。")) return;
    api("/articles/" + encodeURIComponent(slug), { method: "DELETE" })
      .then(function (data) {
        showToast(data.message, "success");
        loadArticles();
      })
      .catch(function (err) { showToast(err.message, "error"); });
  }

  /* ---------- Tab 切换（文章 / 项目） ---------- */

  function switchTab(name) {
    resetDeleteConfirm();
    tabArticles.className = "tab" + (name === "articles" ? " active" : "");
    tabProjects.className = "tab" + (name === "projects" ? " active" : "");
    tabGallery.className = "tab" + (name === "gallery" ? " active" : "");
    tabDownloads.className = "tab" + (name === "downloads" ? " active" : "");
    tabLinks.className = "tab" + (name === "links" ? " active" : "");
    tabKb.className = "tab" + (name === "kb" ? " active" : "");
    tabSite.className = "tab" + (name === "site" ? " active" : "");
    viewArticles.style.display = name === "articles" ? "block" : "none";
    viewProjects.style.display = name === "projects" ? "block" : "none";
    viewGallery.style.display = name === "gallery" ? "block" : "none";
    viewDownloads.style.display = name === "downloads" ? "block" : "none";
    viewLinks.style.display = name === "links" ? "block" : "none";
    viewKb.style.display = name === "kb" ? "block" : "none";
    viewSite.style.display = name === "site" ? "block" : "none";
    if (name === "projects") loadProjects();
    if (name === "gallery") loadGallery();
    if (name === "downloads") loadDownloads();
    if (name === "links") loadLinks();
    if (name === "kb") loadKb();
    if (name === "site") { loadSite(); loadDeploy(); }
  }

  tabArticles.addEventListener("click", function () { switchTab("articles"); });
  tabProjects.addEventListener("click", function () { switchTab("projects"); });
  tabGallery.addEventListener("click", function () { switchTab("gallery"); });
  tabDownloads.addEventListener("click", function () { switchTab("downloads"); });
  tabLinks.addEventListener("click", function () { switchTab("links"); });
  tabKb.addEventListener("click", function () { switchTab("kb"); });
  tabSite.addEventListener("click", function () { switchTab("site"); });

  /* ---------- 项目列表 ---------- */

  function loadProjects() {
    projectList.innerHTML = "";
    projectListLoading.style.display = "block";
    api("/projects")
      .then(function (data) {
        projectListLoading.style.display = "none";
        projectsCache = data.projects || [];
        if (!projectsCache.length) {
          projectList.innerHTML = '<div class="empty-state">暂无项目<br/>添加一个吧 🛠️</div>';
          return;
        }
        var filtered = projectsCache;
        if (projectFilterStatus === "published") filtered = filtered.filter(function (p) { return p.published !== false; });
        else if (projectFilterStatus === "draft") filtered = filtered.filter(function (p) { return p.published === false; });
        filtered.forEach(function (p) {
          var item = document.createElement("div");
          item.className = "item";
          item.innerHTML =
            '<div class="info">' +
              '<div class="title">' + escapeHtml(p.title || "(无标题)") + (p.featured ? ' <span style="color:var(--accent);font-size:10px;">★精选</span>' : "") + (p.published === false ? ' <span style="color:var(--accent);font-size:10px;border:1px solid var(--accent);border-radius:3px;padding:1px 6px;">草稿</span>' : "") + "</div>" +
              '<div class="date">' + escapeHtml(p.year || "") + (p.tags && p.tags.length ? " · " + escapeHtml(p.tags.join(" / ")) : "") + "</div>" +
            "</div>" +
            '<div class="actions">' +
              '<button class="btn btn-outline btn-sm" data-action="edit" data-id="' + escapeAttr(p.id) + '">编辑</button>' +
              '<button class="btn btn-danger btn-sm" data-action="del" data-id="' + escapeAttr(p.id) + '">删除</button>' +
            "</div>";
          projectList.appendChild(item);
        });
        if (!filtered.length) {
          projectList.innerHTML = '<div class="empty-state">没有匹配的项目</div>';
        }
      })
      .catch(function (err) {
        projectListLoading.style.display = "none";
        projectList.innerHTML = '<div class="empty-state" style="color:var(--danger);">加载失败：' + escapeHtml(err.message) + "</div>";
      });
  }

  projectList.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-action]");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    if (btn.getAttribute("data-action") === "edit") {
      resetDeleteConfirm();
      loadProject(id);
    } else if (btn.getAttribute("data-action") === "del") {
      deleteProject(id, btn);
    }
  });

  // 项目列表筛选（全部 / 已发布 / 草稿）
  if (projectFilterEl) {
    projectFilterEl.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-pfilter]");
      if (!btn) return;
      projectFilterStatus = btn.getAttribute("data-pfilter") || "";
      projectFilterEl.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
      btn.classList.add("active");
      loadProjects();
    });
  }

  /* ---------- 项目表单 ---------- */

  function fillProjectForm(p) {
    $("projTitleField").value = p.title || "";
    $("projYearField").value = p.year || "";
    $("projTagsField").value = (p.tags || []).join(", ");
    $("projDescField").value = p.description || "";
    $("projUrlField").value = p.url || "";
    $("projPreviewField").value = p.previewUrl || "";
    $("projSourceField").value = p.sourceUrl || "";
    $("projFeatured").checked = !!p.featured;
  }

  function resetProjectForm() {
    projectId.value = "";
    $("projTitleField").value = "";
    $("projYearField").value = "";
    $("projTagsField").value = "";
    $("projDescField").value = "";
    $("projUrlField").value = "";
    $("projPreviewField").value = "";
    $("projSourceField").value = "";
    $("projFeatured").checked = false;
    saveProjectBtn.textContent = "➕ 添加项目";
    resetProjectBtn.style.display = "none";
    $("projectStatus").textContent = "";
  }

  resetProjectBtn.addEventListener("click", resetProjectForm);

  function loadProject(id) {
    var p = projectsCache.find(function (x) { return x.id === id; });
    if (!p) { showToast("项目不存在", "error"); return; }
    fillProjectForm(p);
    projectId.value = p.id;
    saveProjectBtn.textContent = "💾 保存修改";
    resetProjectBtn.style.display = "inline-flex";
    $("projTitleField").scrollIntoView({ behavior: "smooth", block: "start" });
    showToast("已载入《" + p.title + "》", "success");
  }

  function saveProject(isPublished) {
    var title = $("projTitleField").value.trim();
    if (!title) { showToast("请填写项目名称", "error"); return; }
    var payload = {
      title: title,
      year: $("projYearField").value.trim(),
      tags: $("projTagsField").value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean),
      description: $("projDescField").value.trim(),
      url: $("projUrlField").value.trim(),
      previewUrl: $("projPreviewField").value.trim(),
      sourceUrl: $("projSourceField").value.trim(),
      featured: $("projFeatured").checked,
      published: isPublished,
    };
    if (projectId.value) payload.id = projectId.value;

    saveProjectBtn.disabled = true;
    projDraftBtn.disabled = true;
    saveProjectBtn.textContent = "提交中…";
    $("projectStatus").textContent = "";

    api("/projects", { method: "POST", body: payload })
      .then(function (data) {
        $("projectStatus").textContent = "✔ " + data.message;
        showToast(data.message, "success");
        loadProjects();
        resetProjectForm();
      })
      .catch(function (err) { showToast(err.message, "error"); })
      .finally(function () {
        saveProjectBtn.disabled = false;
        projDraftBtn.disabled = false;
        saveProjectBtn.textContent = "➕ 添加项目";
      });
  }

  saveProjectBtn.addEventListener("click", function () { saveProject(true); });
  projDraftBtn.addEventListener("click", function () { saveProject(false); });

  /* ---------- 删除项目（两步确认：先点一次进入待确认，4 秒内再点一次才删除） ---------- */

  function resetDeleteConfirm() {
    if (pendingDeleteBtn) {
      pendingDeleteBtn.textContent = "删除";
      pendingDeleteBtn.classList.remove("btn-confirming");
      pendingDeleteBtn = null;
    }
    pendingDeleteId = null;
    if (pendingDeleteTimer) {
      clearTimeout(pendingDeleteTimer);
      pendingDeleteTimer = null;
    }
  }

  function deleteProject(id, btn) {
    // 第二步：待确认状态下再点同一个「删除」→ 真正删除
    if (pendingDeleteId === id) {
      resetDeleteConfirm();
      api("/projects", { method: "DELETE", body: { id: id } })
        .then(function (data) {
          showToast(data.message, "success");
          loadProjects();
        })
        .catch(function (err) { showToast(err.message, "error"); });
      return;
    }
    // 第一步：进入待确认状态
    resetDeleteConfirm();
    if (!btn) { showToast("删除失败：按钮状态异常", "error"); return; }
    pendingDeleteId = id;
    pendingDeleteBtn = btn;
    btn.textContent = "⚠ 再点一次确认";
    btn.classList.add("btn-confirming");
    pendingDeleteTimer = setTimeout(resetDeleteConfirm, 4000);
  }

  /* ---------- 相册管理 ---------- */

  function loadGallery() {
    galleryGrid.innerHTML = "";
    galleryLoading.style.display = "block";
    api("/gallery")
      .then(function (data) {
        galleryLoading.style.display = "none";
        galleryCache = data.gallery || [];
        renderGallery();
      })
      .catch(function (err) {
        galleryLoading.style.display = "none";
        galleryGrid.innerHTML = '<div class="empty-state" style="color:var(--danger);">加载失败：' + escapeHtml(err.message) + "</div>";
      });
  }

  function renderGallery() {
    galleryCount.textContent = galleryCache.length ? "共 " + galleryCache.length + " 张" : "";
    if (!galleryCache.length) {
      galleryGrid.innerHTML = '<div class="empty-state">相册还没有图片<br/>点击上方「批量上传图片」添加 🖼️</div>';
      return;
    }
    var totalSize = 0, totalThumb = 0;
    galleryCache.forEach(function (g) { totalSize += Number(g.size) || 0; totalThumb += Number(g.thumbSize) || 0; });
    if (totalSize) {
      galleryCount.textContent = "共 " + galleryCache.length + " 张 · 原图 " + formatSize(totalSize) +
        (totalThumb ? " · 缩略图 " + formatSize(totalThumb) : "");
    }
    galleryGrid.innerHTML = "";
    galleryCache.forEach(function (g) {
      var cell = document.createElement("div");
      cell.className = "gal-cell";
      var size = Number(g.size) || 0;
      var thumbSize = Number(g.thumbSize) || 0;
      var origSize = Number(g.origSize) || 0;
      var ratio = (origSize && size && origSize > size) ? Math.round((1 - size / origSize) * 100) : 0;
      var thumbRatio = (size && thumbSize) ? (size / thumbSize) : 0;
      cell.innerHTML =
        '<div class="gal-thumb">' +
          '<img src="' + escapeAttr(g.thumbUrl || g.url) + '" alt="' + escapeAttr(g.caption || g.file) + '" loading="lazy" />' +
          '<div class="gal-actions">' +
            '<button class="btn btn-outline btn-sm" data-action="meta" data-file="' + escapeAttr(g.file) + '" title="编辑说明与日期">🏷️</button>' +
            '<button class="btn btn-outline btn-sm" data-action="opt" data-file="' + escapeAttr(g.file) + '" title="重新压缩（可设置大小/质量）">压缩</button>' +
            '<button class="btn btn-danger btn-sm" data-action="del" data-file="' + escapeAttr(g.file) + '">删除</button>' +
          '</div>' +
        '</div>' +
        '<div class="gal-info">' +
          '<div class="gal-name" title="' + escapeAttr(g.file) + '">' + escapeHtml(g.file) + '</div>' +
          (g.caption ? '<div class="gal-caption" title="' + escapeAttr(g.caption) + '">' + escapeHtml(g.caption) + '</div>' : '') +
          '<div class="gal-sizes">' +
            '<span class="gal-size-row"><i>原图</i><b>' + (size ? formatSize(size) : "未知") + '</b>' +
              (origSize && origSize > size ? '<em class="gal-saved">省 ' + ratio + '%</em>' : '') + '</span>' +
            '<span class="gal-size-row"><i>缩略图</i><b>' + (thumbSize ? formatSize(thumbSize) : (g.thumbUrl ? "未知" : "无")) + '</b>' +
              (thumbRatio >= 10 ? '<em>缩小 ' + Math.round(thumbRatio) + '×</em>' : '') + '</span>' +
          '</div>' +
          (g.date ? '<div class="gal-date">' + escapeHtml(g.date) + '</div>' : '') +
        '</div>';
      galleryGrid.appendChild(cell);
    });
  }

  galleryGrid.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-action='del']");
    if (btn) { deleteGalleryImage(btn.getAttribute("data-file"), btn); return; }
    var metaBtn = e.target.closest("button[data-action='meta']");
    if (metaBtn) { openGalMeta(metaBtn.getAttribute("data-file")); return; }
    var optBtn = e.target.closest("button[data-action='opt']");
    if (optBtn) optimizeGalleryImage(optBtn.getAttribute("data-file"), optBtn);
  });

  /* ---------- 相册信息编辑（caption / date） ---------- */
  var galMetaFile = null;
  var galMetaOverlay = $("galMetaOverlay");

  function openGalMeta(file) {
    var g = null;
    galleryCache.forEach(function (x) { if (x && x.file === file) g = x; });
    if (!g) { showToast("未找到该图片", "error"); return; }
    galMetaFile = file;
    $("galMetaFile").textContent = file;
    $("galMetaPreview").src = g.thumbUrl || g.url;
    $("galMetaCaption").value = g.caption || "";
    $("galMetaDate").value = /^\d{4}-\d{2}-\d{2}$/.test(g.date || "") ? g.date : "";
    galMetaOverlay.style.display = "flex";
    setTimeout(function () { $("galMetaCaption").focus(); }, 30);
  }

  function closeGalMeta() {
    galMetaOverlay.style.display = "none";
    galMetaFile = null;
  }

  if (galMetaOverlay) {
    $("galMetaCancel").addEventListener("click", closeGalMeta);
    galMetaOverlay.addEventListener("click", function (e) { if (e.target === galMetaOverlay) closeGalMeta(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && galMetaOverlay.style.display !== "none") closeGalMeta();
    });
    $("galMetaSave").addEventListener("click", function () {
      if (!galMetaFile) { closeGalMeta(); return; }
      var btn = $("galMetaSave");
      btn.disabled = true;
      btn.textContent = "保存中…";
      api("/gallery/meta", {
        method: "POST",
        body: {
          file: galMetaFile,
          caption: $("galMetaCaption").value.trim(),
          date: $("galMetaDate").value || "",
        },
      })
        .then(function (data) {
          showToast(data.message || "已保存", "success");
          closeGalMeta();
          loadGallery();
        })
        .catch(function (err) { showToast(err.message || "保存失败", "error"); })
        .then(function () { btn.disabled = false; btn.textContent = "保存"; });
    });
  }

  function deleteGalleryImage(file, btn) {
    if (!file) return;
    // 第二步：待确认状态下再点同一个「删除」→ 真正删除
    if (pendingDeleteId === file) {
      resetDeleteConfirm();
      btn.disabled = true;
      api("/gallery/" + encodeURIComponent(file), { method: "DELETE" })
        .then(function (data) {
          showToast(data.message, "success");
          loadGallery();
        })
        .catch(function (err) { showToast(err.message, "error"); btn.disabled = false; });
      return;
    }
    // 第一步：进入待确认状态
    resetDeleteConfirm();
    if (!btn) { showToast("删除失败：按钮状态异常", "error"); return; }
    pendingDeleteId = file;
    pendingDeleteBtn = btn;
    btn.textContent = "⚠ 再点一次确认";
    btn.classList.add("btn-confirming");
    pendingDeleteTimer = setTimeout(resetDeleteConfirm, 4000);
  }

  /* ---------- 重新压缩已上传图片（设置弹窗 → 覆盖原文件） ---------- */
  var optModalOverlay = $("optModalOverlay");
  var optPreview = $("optPreview");
  var optFileName = $("optFileName");
  var optCurrentSize = $("optCurrentSize");
  var optModalTarget = $("optModalTarget");
  var optModalQuality = $("optModalQuality");
  var optModalMakeThumb = $("optModalMakeThumb");
  var optModalThumbWidth = $("optModalThumbWidth");
  var optModalThumbQuality = $("optModalThumbQuality");
  var optModalThumbTarget = $("optModalThumbTarget");
  var optThumbCurrent = $("optThumbCurrent");
  var optModalConfirm = $("optModalConfirm");
  var optModalCancel = $("optModalCancel");
  var optPendingFile = "";
  var optPendingUrl = "";
  var optPendingThumb = "";

  var closeOptModal = function () {
    if (optModalOverlay) optModalOverlay.style.display = "none";
    if (optModalConfirm) { optModalConfirm.disabled = false; optModalConfirm.textContent = "开始压缩"; }
  };

  var openOptModal = function (file, url) {
    optPendingFile = file;
    optPendingUrl = url;
    if (optFileName) optFileName.textContent = file;
    if (optPreview) { optPreview.src = url; optPreview.alt = file; }
    // 当前大小：优先用已缓存的实际大小（避免额外请求）
    var cached = null;
    galleryCache.forEach(function (x) { if (x && x.file === file) cached = x; });
    if (optCurrentSize) optCurrentSize.textContent = (cached && cached.size) ? formatSize(cached.size) : "—";
    if (optThumbCurrent) {
      optThumbCurrent.textContent = cached
        ? (cached.thumbSize ? formatSize(cached.thumbSize) : (cached.thumbUrl ? "未知" : "无缩略图"))
        : "—";
    }
    // 同步面板参数
    if (optModalTarget) optModalTarget.value = String(imgSettings.target);
    if (optModalQuality) optModalQuality.value = String(imgSettings.quality);
    if (optModalMakeThumb) optModalMakeThumb.checked = cached ? !!cached.thumbUrl : true;
    if (optModalThumbWidth) optModalThumbWidth.value = String(imgSettings.thumbWidth);
    if (optModalThumbQuality) optModalThumbQuality.value = String(imgSettings.thumbQuality);
    if (optModalThumbTarget) optModalThumbTarget.value = String(imgSettings.thumbTarget);
    if (optModalOverlay) optModalOverlay.style.display = "flex";
    // 缓存缺失时再网络读取
    if (url && !(cached && cached.size)) {
      fetch(url, { cache: "force-cache" })
        .then(function (r) { return r.ok ? r.blob() : null; })
        .then(function (blob) { if (blob && optCurrentSize) optCurrentSize.textContent = formatSize(blob.size); })
        .catch(function () { /* 忽略 */ });
    }
  };

  var optimizeGalleryImage = function (file) {
    if (!file) return;
    var g = null;
    galleryCache.forEach(function (x) { if (x && x.file === file) g = x; });
    if (!g || !g.url) { showToast("未找到该图片信息", "error"); return; }
    openOptModal(file, g.url);
  };

  var doOptimize = function () {
    if (!optPendingFile) { closeOptModal(); return; }
    var targetBytes = (parseInt(optModalTarget && optModalTarget.value, 10) || 2048) * 1024;
    var quality = parseFloat(optModalQuality && optModalQuality.value) || 0.8;
    // 缩略图参数（弹窗独立设置，同时回写为全局默认）
    var useThumb = optModalMakeThumb ? !!optModalMakeThumb.checked : imgSettings.makeThumb;
    var thumbWidth = parseInt(optModalThumbWidth && optModalThumbWidth.value, 10) || imgSettings.thumbWidth;
    var thumbQuality = parseFloat(optModalThumbQuality && optModalThumbQuality.value) || imgSettings.thumbQuality;
    var thumbTargetKB = parseInt(optModalThumbTarget && optModalThumbTarget.value, 10) || 0;
    if (optModalMakeThumb) {
      imgSettings.thumbWidth = thumbWidth;
      imgSettings.thumbQuality = thumbQuality;
      imgSettings.thumbTarget = thumbTargetKB;
      saveImgSettings();
    }
    if (optModalConfirm) { optModalConfirm.disabled = true; optModalConfirm.textContent = "压缩中…"; }

    fetch(optPendingUrl, { cache: "force-cache" })
      .then(function (r) { if (!r.ok) throw new Error("读取原图失败"); return r.blob(); })
      .then(function (blob) {
        return new Promise(function (resolve, reject) {
          var fr = new FileReader();
          fr.onload = function () { resolve(fr.result); };
          fr.onerror = function () { reject(new Error("读取原图失败")); };
          fr.readAsDataURL(blob);
        });
      })
      .then(function (dataUrl) {
        return compressImage(dataUrl, targetBytes, quality).then(function (out) {
          if (out.bytes > 5 * 1024 * 1024) throw new Error("压缩后仍超过 5MB（" + formatSize(out.bytes) + "）");
          return out;
        });
      })
      .then(function (out) {
        var payload = {
          file: optPendingFile,
          data: out.dataUrl.split(",")[1] || "",
          mime: "image/jpeg",
          ext: "jpg",
        };
        if (!useThumb) return payload; // 不重做缩略图：保留原缩略图，仅压缩原图
        return makeThumbnail(out.dataUrl, thumbWidth, thumbQuality, thumbTargetKB * 1024).then(function (thumb) {
          payload.thumb = thumb.dataUrl.split(",")[1] || "";
          payload.thumbExt = "webp";
          return payload;
        }).catch(function () { return payload; });
      })
      .then(function (payload) { return api("/gallery/optimize", { method: "POST", body: payload }); })
      .then(function (data) {
        closeOptModal();
        showToast(data.message || "已重新压缩", "success");
        loadGallery();
      })
      .catch(function (err) {
        closeOptModal();
        showToast(err.message || "压缩失败", "error");
      });
  };

  if (optModalConfirm) optModalConfirm.addEventListener("click", doOptimize);
  if (optModalCancel) optModalCancel.addEventListener("click", closeOptModal);
  if (optModalOverlay) optModalOverlay.addEventListener("click", function (e) { if (e.target === optModalOverlay) closeOptModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && optModalOverlay && optModalOverlay.style.display !== "none") closeOptModal(); });

  /* ---------- 📦 下载文件管理（≤100MB 存仓库 files/ · 大文件走 GitHub Release） ---------- */

  function fmtBytes(n) {
    n = Number(n) || 0;
    if (n >= 1073741824) return (n / 1073741824).toFixed(2) + " GB";
    if (n >= 1048576) return (n / 1048576).toFixed(1) + " MB";
    if (n >= 1024) return (n / 1024).toFixed(0) + " KB";
    return n + " B";
  }

  function loadDownloads() {
    downloadsGrid.innerHTML = "";
    downloadsLoading.style.display = "block";
    api("/files")
      .then(function (data) {
        downloadsLoading.style.display = "none";
        downloadsCache = data.files || [];
        downloadsCount.textContent = downloadsCache.length ? "共 " + downloadsCache.length + " 个" : "";
        if (!downloadsCache.length) {
          downloadsGrid.innerHTML = '<div class="empty-state">还没有上传下载文件<br/>点击上方「上传文件」添加 📦</div>';
          return;
        }
        downloadsCache.forEach(function (d) {
          var item = document.createElement("div");
          item.className = "item";
          item.style.cssText = "display:flex;align-items:center;gap:12px;flex-wrap:wrap;";
          item.innerHTML =
            '<div style="flex:1;min-width:200px;">' +
              '<div style="font-weight:600;font-size:14px;">' + escapeAttr(d.filename || "未命名") +
                (d.version ? ' <span style="color:var(--accent);font-size:11px;">v' + escapeAttr(d.version) + "</span>" : "") +
              "</div>" +
              (d.desc ? '<div style="font-size:12px;color:var(--text-dim);margin-top:2px;">' + escapeAttr(d.desc) + "</div>" : "") +
              '<div style="font-size:11px;color:var(--text-dim);margin-top:4px;">' +
                '<span class="tag">' + escapeAttr(d.category || "软件") + "</span> " +
                fmtBytes(d.size) + " · " + escapeAttr(d.date || "") +
              "</div>" +
            "</div>" +
            '<div style="display:flex;gap:6px;align-items:center;">' +
              '<a href="' + (d.store === "repo" && d.url.indexOf("://") === -1 ? window.location.origin + "/" + d.url.replace(/^\//, "") : d.url) + '" target="_blank" rel="noopener" class="btn btn-outline btn-sm">🔗 链接</a>' +
              '<button class="btn btn-danger btn-sm" data-action="deldl" data-id="' + escapeAttr(d.id) + '" data-name="' + escapeAttr(d.filename) + '">删除</button>' +
            "</div>";
          downloadsGrid.appendChild(item);
        });
      })
      .catch(function (err) {
        downloadsLoading.style.display = "none";
        showToast(err.message || "加载失败", "error");
      });
  }

  /* 删除下载文件：两步确认（复用 pendingDelete 状态） */
  downloadsGrid.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-action='deldl']");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    var name = btn.getAttribute("data-name");
    if (!id) return;
    if (pendingDeleteId === "dl:" + id) {
      resetDeleteConfirm();
      btn.disabled = true;
      api("/files", { method: "DELETE", body: { id: id } })
        .then(function (data) {
          showToast(data.message || "已删除", "success");
          loadDownloads();
        })
        .catch(function (err) { showToast(err.message, "error"); btn.disabled = false; });
      return;
    }
    resetDeleteConfirm();
    pendingDeleteId = "dl:" + id;
    pendingDeleteBtn = btn;
    btn.textContent = "⚠ 再点一次确认";
    btn.classList.add("btn-confirming");
    pendingDeleteTimer = setTimeout(resetDeleteConfirm, 4000);
  });

  /* 上传流程：≤100MB 直接 base64 上传仓库 files/；>100MB 提示用本机脚本 */
  downloadsUploadBtn.addEventListener("click", function () { downloadsFileInput.click(); });

  function dlResetBtn() {
    downloadsUploadBtn.disabled = false;
    downloadsUploadBtn.textContent = "📤 上传文件";
    downloadsFileInput.value = "";
  }

  downloadsFileInput.addEventListener("change", function () {
    var file = downloadsFileInput.files && downloadsFileInput.files[0];
    if (!file) return;
    var MAX_WEB = 100 * 1024 * 1024; // 100MB（仓库单文件硬限）
    if (file.size > MAX_WEB) {
      dlResetBtn();
      showToast("超过 100MB 请用本机脚本发布（tools/publish-release.mjs）", "error", 9000);
      return;
    }
    downloadsUploadBtn.disabled = true;
    downloadsUploadBtn.textContent = "⏳ 上传中…";

    var name = file.name;
    var size = file.size;

    var fr = new FileReader();
    fr.onload = function () {
      var b64 = String(fr.result).split(",")[1] || "";
      askDownloadMeta(name)
        .then(function (meta) {
          downloadsUploadBtn.textContent = "⏳ 提交中…";
          return api("/files/repo", {
            method: "POST",
            body: {
              name: name,
              filename: meta.filename || name,
              size: size,
              data: b64,
              version: meta.version,
              desc: meta.desc,
              category: meta.category,
            },
          });
        })
        .then(function (data) {
          dlResetBtn();
          showToast((data && data.message) || "已上传", "success");
          loadDownloads();
        })
        .catch(function (err) {
          dlResetBtn();
          showToast(err.message || "上传失败", "error");
        });
    };
    fr.onerror = function () {
      dlResetBtn();
      showToast("读取文件失败", "error");
    };
    fr.readAsDataURL(file);
  });

  /* 上传后填写元数据（prompt 形式） */
  function askDownloadMeta(defName) {
    var name = window.prompt("下载显示名称：", defName);
    if (name === null) return Promise.reject(new Error("已取消上传"));
    name = (name || defName).trim();
    var version = (window.prompt("版本号（如 1.0.0，可留空）：", "") || "").trim();
    var category = (window.prompt("分类（如 软件 / 文档，可留空默认软件）：", "软件") || "软件").trim();
    var desc = (window.prompt("简介说明（可留空）：", "") || "").trim();
    return Promise.resolve({ filename: name, version: version, category: category || "软件", desc: desc });
  }

  galleryUploadBtn.addEventListener("click", function () { galleryFileInput.click(); });

  galleryFileInput.addEventListener("change", function () {
    var files = Array.prototype.slice.call(galleryFileInput.files || []);
    if (!files.length) return;
    var HARD_LIMIT = 5 * 1024 * 1024;
    var targetBytes = imgSettings.target * 1024;
    var quality = imgSettings.quality;
    var results = []; // {data, mime, ext, thumb, thumbExt}
    var failCount = 0;

    galleryUploadBtn.disabled = true;

    var resetBtn = function () {
      galleryUploadBtn.disabled = false;
      galleryUploadBtn.textContent = "📤 批量上传图片";
      galleryFileInput.value = "";
    };

    /* 分批提交：每批最多 8 张且总 base64 ≤ 24MB，避免请求体过大 */
    var submitAll = function () {
      if (!results.length) {
        resetBtn();
        if (failCount) showToast(failCount + " 张图片处理失败，未提交", "error");
        return;
      }
      var chunks = [], cur = [], curSize = 0;
      results.forEach(function (r) {
        if (cur.length >= 8 || (cur.length && curSize + r.data.length > 24 * 1024 * 1024)) {
          chunks.push(cur); cur = []; curSize = 0;
        }
        cur.push(r); curSize += r.data.length;
      });
      if (cur.length) chunks.push(cur);

      var submitted = 0;
      var submitNext = function (ci) {
        if (ci >= chunks.length) {
          resetBtn();
          showToast("已提交 " + submitted + " 张图片" + (failCount ? "，" + failCount + " 张失败" : "") + "，部署后首页相册即可显示（约 1 分钟）", failCount ? "error" : "success");
          loadGallery();
          return;
        }
        galleryUploadBtn.textContent = "提交中 " + (ci + 1) + "/" + chunks.length + " 批…";
        api("/gallery", { method: "POST", body: { images: chunks[ci] } })
          .then(function () {
            submitted += chunks[ci].length;
            submitNext(ci + 1);
          })
          .catch(function (err) {
            resetBtn();
            showToast("提交失败：" + err.message, "error");
            loadGallery();
          });
      };
      submitNext(0);
    };

    var processNext = function (i) {
      if (i >= files.length) { submitAll(); return; }
      var file = files[i];
      galleryUploadBtn.textContent = "处理中 " + (i + 1) + "/" + files.length + "…";

      var push = function (dataUrl, mime, ext) {
        results.push({ data: (dataUrl.split(",")[1]) || "", mime: mime, ext: ext, origSize: file.size });
        processNext(i + 1);
      };
      var failOne = function (msg) {
        failCount++;
        showToast("[" + file.name + "] " + msg, "error");
        processNext(i + 1);
      };

      /* 生成缩略图（用户设置参数） */
      var pushWithThumb = function (dataUrl, mime, ext) {
        if (!imgSettings.makeThumb) {
          // 关闭缩略图：只上传原图
          results.push({ data: (dataUrl.split(",")[1]) || "", mime: mime, ext: ext, origSize: file.size });
          processNext(i + 1);
          return;
        }
        makeThumbnail(dataUrl, imgSettings.thumbWidth, imgSettings.thumbQuality, (imgSettings.thumbTarget || 0) * 1024).then(function (thumb) {
          results.push({
            data: (dataUrl.split(",")[1]) || "",
            mime: mime,
            ext: ext,
            origSize: file.size,
            thumb: (thumb.dataUrl.split(",")[1]) || "",
            thumbExt: "webp"
          });
          processNext(i + 1);
        }).catch(function () {
          // 缩略图失败仍继续，只上传原图
          results.push({ data: (dataUrl.split(",")[1]) || "", mime: mime, ext: ext, origSize: file.size });
          processNext(i + 1);
        });
      };

      if (file.size <= targetBytes) {
        var reader0 = new FileReader();
        reader0.onload = function (e) {
          var result = e.target && e.target.result;
          if (!result) { failOne("读取失败"); return; }
          var mime0 = (result.split(",")[0].match(/data:([^;]+)/) || ["", "image/png"])[1];
          var ext0 = file.name.split(".").pop() || "png";
          pushWithThumb(result, mime0, ext0);
        };
        reader0.onerror = function () { failOne("读取失败"); };
        reader0.readAsDataURL(file);
        return;
      }

      var reader = new FileReader();
      reader.onload = function (e) {
        var result = e.target && e.target.result;
        if (!result) { failOne("读取失败"); return; }
        compressImage(result, targetBytes, quality)
          .then(function (out) {
            if (out.bytes > HARD_LIMIT) { failOne("压缩后仍超过 5MB（" + formatSize(out.bytes) + "）"); return; }
            pushWithThumb(out.dataUrl, "image/jpeg", "jpg");
          })
          .catch(function () { failOne("压缩失败"); });
      };
      reader.onerror = function () { failOne("读取失败"); };
      reader.readAsDataURL(file);
    };
    processNext(0);
  });

  /* ---------- 关联网站管理 ---------- */

  function loadLinks() {
    linkList.innerHTML = "";
    linkListLoading.style.display = "block";
    api("/links")
      .then(function (data) {
        linkListLoading.style.display = "none";
        linksCache = data.links || [];
        renderLinks();
      })
      .catch(function (err) {
        linkListLoading.style.display = "none";
        linkList.innerHTML = '<div class="empty-state" style="color:var(--danger);">加载失败：' + escapeHtml(err.message) + "</div>";
      });
  }

  function renderLinks() {
    if (!linksCache.length) {
      linkList.innerHTML = '<div class="empty-state">还没有关联网站<br/>在左侧添加，会显示在关于页「关联网站」区 🔗</div>';
      return;
    }
    linksCache.forEach(function (l) {
      var item = document.createElement("div");
      item.className = "item";
      var host = "";
      try { host = new URL(l.url).hostname; } catch (e) { host = l.url || ""; }
      item.innerHTML =
        '<div class="info">' +
          '<div class="title">' + escapeHtml(l.name || "(未命名)") +
            (l.published === false ? ' <span style="color:var(--accent);font-size:10px;border:1px solid var(--accent);border-radius:3px;padding:1px 6px;">隐藏</span>' : "") +
          "</div>" +
          '<div class="date">' + escapeHtml(host) +
            (l.desc ? " · " + escapeHtml(l.desc) : "") +
            (Number(l.order) ? " · 排序 " + escapeHtml(String(l.order)) : "") +
          "</div>" +
        "</div>" +
        '<div class="actions">' +
          '<a class="btn btn-outline btn-sm" href="' + escapeAttr(l.url) + '" target="_blank" rel="noopener noreferrer">访问</a>' +
          '<button class="btn btn-outline btn-sm" data-action="edit" data-id="' + escapeAttr(l.id) + '">编辑</button>' +
          '<button class="btn btn-danger btn-sm" data-action="del" data-id="' + escapeAttr(l.id) + '">删除</button>' +
        "</div>";
      linkList.appendChild(item);
    });
  }

  linkList.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-action]");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    if (btn.getAttribute("data-action") === "edit") {
      resetDeleteConfirm();
      loadLink(id);
    } else if (btn.getAttribute("data-action") === "del") {
      deleteLink(id, btn);
    }
  });

  function fillLinkForm(l) {
    $("linkNameField").value = l.name || "";
    $("linkUrlField").value = l.url || "";
    $("linkDescField").value = l.desc || "";
    $("linkIconField").value = l.icon || "";
    $("linkOrderField").value = Number(l.order) || 0;
    $("linkPublished").checked = l.published !== false;
  }

  function resetLinkForm() {
    linkId.value = "";
    fillLinkForm({});
    saveLinkBtn.textContent = "➕ 添加关联";
    resetLinkBtn.style.display = "none";
    $("linkStatus").textContent = "";
  }

  resetLinkBtn.addEventListener("click", resetLinkForm);

  function loadLink(id) {
    var l = linksCache.find(function (x) { return x.id === id; });
    if (!l) { showToast("关联网站不存在", "error"); return; }
    fillLinkForm(l);
    linkId.value = l.id;
    saveLinkBtn.textContent = "💾 保存修改";
    resetLinkBtn.style.display = "inline-flex";
    $("linkNameField").scrollIntoView({ behavior: "smooth", block: "start" });
    showToast("已载入「" + l.name + "」", "success");
  }

  function saveLink() {
    var name = $("linkNameField").value.trim();
    var url = $("linkUrlField").value.trim();
    if (!name) { showToast("请填写网站名称", "error"); return; }
    if (!url) { showToast("请填写网站地址", "error"); return; }
    if (!/^https?:\/\//i.test(url)) { showToast("网址需以 http:// 或 https:// 开头", "error"); return; }
    var payload = {
      name: name,
      url: url,
      desc: $("linkDescField").value.trim(),
      icon: $("linkIconField").value.trim(),
      order: parseInt($("linkOrderField").value, 10) || 0,
      published: $("linkPublished").checked,
    };
    if (linkId.value) payload.id = linkId.value;

    saveLinkBtn.disabled = true;
    saveLinkBtn.textContent = "提交中…";
    $("linkStatus").textContent = "";

    api("/links", { method: "POST", body: payload })
      .then(function (data) {
        $("linkStatus").textContent = "✔ " + data.message;
        showToast("已保存，部署后关于页更新", "success");
        resetLinkForm();
        loadLinks();
      })
      .catch(function (err) { showToast(err.message || "保存失败", "error"); })
      .then(function () { saveLinkBtn.disabled = false; saveLinkBtn.textContent = linkId.value ? "💾 保存修改" : "➕ 添加关联"; });
  }

  saveLinkBtn.addEventListener("click", saveLink);

  function deleteLink(id, btn) {
    if (pendingDeleteId !== id) {
      resetDeleteConfirm();
      if (!btn) { showToast("删除失败：按钮状态异常", "error"); return; }
      pendingDeleteId = id;
      pendingDeleteBtn = btn;
      btn.textContent = "⚠ 再点一次确认";
      btn.classList.add("btn-confirming");
      pendingDeleteTimer = setTimeout(resetDeleteConfirm, 4000);
      return;
    }
    resetDeleteConfirm();
    api("/links", { method: "DELETE", body: { id: id } })
      .then(function (data) {
        showToast(data.message || "已删除", "success");
        loadLinks();
      })
      .catch(function (err) { showToast(err.message || "删除失败", "error"); });
  }

  /* ---------- 知识库管理 ---------- */

  function loadKb() {
    kbList.innerHTML = "";
    kbListLoading.style.display = "block";
    api("/kb")
      .then(function (data) {
        kbListLoading.style.display = "none";
        kbDocsCache = data.docs || [];
        renderKbList();
        renderKbCategoryOptions();
      })
      .catch(function (err) {
        kbListLoading.style.display = "none";
        kbList.innerHTML = '<div class="empty-state" style="color:var(--danger);">加载失败：' + escapeHtml(err.message) + "</div>";
      });
  }

  function renderKbCategoryOptions() {
    var dl = $("kbCategoryList");
    if (!dl) return;
    var cats = {};
    kbDocsCache.forEach(function (d) { if (d.category) cats[d.category] = 1; });
    dl.innerHTML = Object.keys(cats).map(function (c) { return '<option value="' + escapeAttr(c) + '"></option>'; }).join("");
  }

  function renderKbList() {
    if (!kbDocsCache.length) {
      kbList.innerHTML = '<div class="empty-state">知识库还没有文档<br/>点击左侧「上传 Markdown」批量导入 📚</div>';
      return;
    }
    kbDocsCache.forEach(function (d) {
      var item = document.createElement("div");
      item.className = "item";
      item.innerHTML =
        '<div class="info">' +
          '<div class="title">' + escapeHtml(d.title || d.slug) + '</div>' +
          '<div class="date">' + escapeHtml(d.category || "未分类") +
            (d.date ? " · " + escapeHtml(d.date) : "") +
            (d.tags && d.tags.length ? " · " + escapeHtml(d.tags.join(" / ")) : "") +
          "</div>" +
        "</div>" +
        '<div class="actions">' +
          '<a class="btn btn-outline btn-sm" href="kb/' + escapeAttr(d.slug) + '" target="_blank" rel="noopener noreferrer">预览</a>' +
          '<button class="btn btn-outline btn-sm" data-action="edit" data-slug="' + escapeAttr(d.slug) + '">编辑</button>' +
          '<button class="btn btn-danger btn-sm" data-action="del" data-slug="' + escapeAttr(d.slug) + '">删除</button>' +
        "</div>";
      kbList.appendChild(item);
    });
  }

  kbList.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-action]");
    if (!btn) return;
    var slug = btn.getAttribute("data-slug");
    if (btn.getAttribute("data-action") === "edit") {
      resetDeleteConfirm();
      loadKbDoc(slug);
    } else if (btn.getAttribute("data-action") === "del") {
      deleteKbDoc(slug, btn);
    }
  });

  function fillKbForm(meta, body, slug) {
    $("kbTitleField").value = meta.title || "";
    $("kbCategoryField").value = meta.category || "";
    $("kbDateField").value = meta.date || "";
    $("kbTagsField").value = (meta.tags || []).join(", ");
    $("kbDescField").value = meta.excerpt || meta.desc || "";
    $("kbBodyField").value = body || "";
    kbSlug.value = slug || "";
  }

  function resetKbForm() {
    fillKbForm({ date: new Date().toISOString().slice(0, 10) }, "", "");
    saveKbBtn.textContent = "📚 保存文档";
    resetKbBtn.style.display = "none";
    $("kbStatus").textContent = "";
    var p = $("kbPreviewContent");
    if (p) p.innerHTML = '<p style="color:var(--text-dim);font-size:12px;">等待输入…</p>';
  }

  resetKbBtn.addEventListener("click", resetKbForm);

  function loadKbDoc(slug) {
    kbListLoading.style.display = "block";
    api("/kb/" + encodeURIComponent(slug))
      .then(function (data) {
        kbListLoading.style.display = "none";
        fillKbForm(data.meta || {}, data.body || "", data.slug);
        saveKbBtn.textContent = "💾 保存修改";
        resetKbBtn.style.display = "inline-flex";
        $("kbTitleField").scrollIntoView({ behavior: "smooth", block: "start" });
        showToast("已载入「" + (data.meta && data.meta.title ? data.meta.title : slug) + "」", "success");
        previewKb();
      })
      .catch(function (err) {
        kbListLoading.style.display = "none";
        showToast(err.message || "载入失败", "error");
      });
  }

  function previewKb() {
    var p = $("kbPreviewContent");
    if (!p) return;
    var body = $("kbBodyField").value;
    if (!body.trim()) { p.innerHTML = '<p style="color:var(--text-dim);font-size:12px;">等待输入…</p>'; return; }
    api("/preview", {
      method: "POST",
      body: {
        title: $("kbTitleField").value.trim() || "（无标题）",
        date: $("kbDateField").value.trim(),
        tags: $("kbTagsField").value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean),
        excerpt: $("kbDescField").value.trim(),
        body: body,
      },
    })
      .then(function (data) { p.innerHTML = data.html || ""; })
      .catch(function () { /* 预览失败不打断编辑 */ });
  }

  var kbPreviewTimer = null;
  $("kbBodyField").addEventListener("input", function () {
    clearTimeout(kbPreviewTimer);
    kbPreviewTimer = setTimeout(previewKb, 500);
  });

  function kbDocFromForm() {
    var title = $("kbTitleField").value.trim();
    var body = $("kbBodyField").value;
    if (!title) { showToast("请填写标题", "error"); return null; }
    if (!body.trim()) { showToast("请填写正文", "error"); return null; }
    var meta = {
      title: title,
      category: $("kbCategoryField").value.trim() || "未分类",
      date: $("kbDateField").value.trim() || new Date().toISOString().slice(0, 10),
      excerpt: $("kbDescField").value.trim(),
      tags: $("kbTagsField").value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean),
    };
    var md = kbBuildMarkdown(meta, body);
    var filename = (kbSlug.value || title) + ".md";
    return { filename: filename, content: md, slug: kbSlug.value || "" };
  }

  function kbBuildMarkdown(meta, body) {
    var q = function (s) { return String(s || "").replace(/"/g, '\\"'); };
    var lines = ["---", 'title: "' + q(meta.title) + '"'];
    if (meta.category) lines.push('category: "' + q(meta.category) + '"');
    lines.push('date: "' + q(meta.date) + '"');
    if (meta.excerpt) lines.push('excerpt: "' + q(meta.excerpt) + '"');
    if (meta.tags && meta.tags.length) lines.push("tags: [" + meta.tags.map(function (t) { return '"' + q(t) + '"'; }).join(", ") + "]");
    lines.push("---", "", String(body || "").trim(), "");
    return lines.join("\n");
  }

  function submitKb(payload) {
    saveKbBtn.disabled = true;
    saveKbBtn.textContent = "提交中…";
    $("kbStatus").textContent = "";
    api("/kb", { method: "POST", body: payload })
      .then(function (data) {
        var msg = data.message || "已保存";
        if (data.errors && data.errors.length) msg += "（" + data.errors.length + " 篇失败）";
        $("kbStatus").textContent = "✔ " + msg;
        showToast(data.errors && data.errors.length ? msg + "\n" + data.errors.join("\n") : "已保存，部署后知识库更新", data.errors && data.errors.length ? "error" : "success");
        resetKbForm();
        loadKb();
      })
      .catch(function (err) {
        $("kbStatus").textContent = "";
        showToast(err.message || "保存失败", "error");
      })
      .then(function () {
        saveKbBtn.disabled = false;
        saveKbBtn.textContent = kbSlug.value ? "💾 保存修改" : "📚 保存文档";
      });
  }

  saveKbBtn.addEventListener("click", function () {
    var doc = kbDocFromForm();
    if (!doc) return;
    submitKb({ filename: doc.filename, content: doc.content, slug: doc.slug || undefined });
  });

  /* 上传 Markdown（支持多选批量导入，直接读文件内容提交） */
  var kbUploadBtn = $("kbUploadBtn");
  var kbFileInput = $("kbFileInput");
  if (kbUploadBtn && kbFileInput) {
    kbUploadBtn.addEventListener("click", function () { kbFileInput.click(); });
    kbFileInput.addEventListener("change", function () {
      var files = Array.prototype.slice.call(kbFileInput.files || []);
      if (!files.length) return;
      var readers = files.map(function (f) {
        return new Promise(function (resolve) {
          var fr = new FileReader();
          fr.onload = function () { resolve({ filename: f.name.replace(/\.(md|markdown)$/i, "") + ".md", content: String(fr.result || "") }); };
          fr.onerror = function () { resolve(null); };
          fr.readAsText(f, "utf-8");
        });
      });
      kbUploadBtn.disabled = true;
      kbUploadBtn.textContent = "读取中…";
      Promise.all(readers).then(function (docs) {
        var valid = docs.filter(Boolean);
        kbFileInput.value = "";
        kbUploadBtn.disabled = false;
        kbUploadBtn.textContent = "📄 上传 Markdown（可多选）";
        if (!valid.length) { showToast("没有读到文件内容", "error"); return; }
        if (!confirm("将导入 " + valid.length + " 个 Markdown 文件，确认继续？")) return;
        submitKb({ docs: valid });
      });
    });
  }

  function deleteKbDoc(slug, btn) {
    if (pendingDeleteId !== slug) {
      resetDeleteConfirm();
      if (!btn) { showToast("删除失败：按钮状态异常", "error"); return; }
      pendingDeleteId = slug;
      pendingDeleteBtn = btn;
      btn.textContent = "⚠ 再点一次确认";
      btn.classList.add("btn-confirming");
      pendingDeleteTimer = setTimeout(resetDeleteConfirm, 4000);
      return;
    }
    resetDeleteConfirm();
    api("/kb/" + encodeURIComponent(slug), { method: "DELETE" })
      .then(function (data) {
        showToast(data.message || "已删除", "success");
        if (kbSlug.value === slug) resetKbForm();
        loadKb();
      })
      .catch(function (err) { showToast(err.message || "删除失败", "error"); });
  }

  /* ---------- 站点设置 / 部署状态 / 数据备份 ---------- */

  function loadSite() {
    api("/site")
      .then(function (data) {
        var s = (data && data.site) || {};
        $("siteNameField").value = s.name || "";
        $("siteTitleField").value = s.title || "";
        $("siteDescField").value = s.description || "";
        $("siteUrlField").value = s.url || "";
        $("siteAuthorField").value = s.author || "";
        var g = s.giscus || {};
        $("giscusEnabled").checked = !!g.enabled;
        $("giscusRepo").value = g.repo || "";
        $("giscusRepoId").value = g.repoId || "";
        $("giscusCategory").value = g.category || "";
        $("giscusCategoryId").value = g.categoryId || "";
        $("giscusMapping").value = g.mapping || "pathname";
        $("giscusLang").value = g.lang || "zh-CN";
        $("giscusPos").value = g.inputPosition || "bottom";
        $("giscusReactions").checked = g.reactions !== false;
        renderSocialRows(Array.isArray(s.socials) ? s.socials : []);
      })
      .catch(function (err) { showToast("加载站点设置失败：" + (err.message || ""), "error"); });
  }

  /* 社交链接：动态行 */
  function socialRowEl(item) {
    var row = document.createElement("div");
    row.className = "social-row";
    row.innerHTML =
      '<input type="text" class="field s-icon" placeholder="⌥" value="' + escapeAttr((item && item.icon) || "") + '" />' +
      '<input type="text" class="field s-name" placeholder="GitHub" value="' + escapeAttr((item && item.name) || "") + '" />' +
      '<input type="text" class="field s-url" placeholder="https://…" value="' + escapeAttr((item && item.url) || "") + '" />' +
      '<button type="button" class="btn btn-danger btn-sm s-del" title="删除">✕</button>';
    row.querySelector(".s-del").addEventListener("click", function () { row.remove(); });
    return row;
  }

  function renderSocialRows(list) {
    var box = $("socialRows");
    box.innerHTML = "";
    if (!list.length) { box.appendChild(socialRowEl({})); return; }
    list.forEach(function (it) { box.appendChild(socialRowEl(it)); });
  }

  $("addSocialBtn").addEventListener("click", function () {
    $("socialRows").appendChild(socialRowEl({}));
  });

  function collectSocials() {
    var out = [];
    Array.prototype.forEach.call($("socialRows").querySelectorAll(".social-row"), function (r) {
      var name = r.querySelector(".s-name").value.trim();
      var url = r.querySelector(".s-url").value.trim();
      var icon = r.querySelector(".s-icon").value.trim();
      if (name && url) out.push({ name: name, url: url, icon: icon || "🔗" });
    });
    return out;
  }

  $("saveSiteBtn").addEventListener("click", function () {
    var payload = {
      name: $("siteNameField").value.trim(),
      title: $("siteTitleField").value.trim(),
      description: $("siteDescField").value.trim(),
      url: $("siteUrlField").value.trim(),
      author: $("siteAuthorField").value.trim(),
      socials: collectSocials(),
      giscus: {
        enabled: $("giscusEnabled").checked,
        repo: $("giscusRepo").value.trim(),
        repoId: $("giscusRepoId").value.trim(),
        category: $("giscusCategory").value.trim(),
        categoryId: $("giscusCategoryId").value.trim(),
        mapping: $("giscusMapping").value,
        lang: $("giscusLang").value.trim() || "zh-CN",
        reactions: $("giscusReactions").checked,
        inputPosition: $("giscusPos").value,
      },
    };
    if (payload.giscus.enabled && (!payload.giscus.repoId || !payload.giscus.categoryId)) {
      showToast("启用评论需要先填写 repoId 与 categoryId", "error");
      return;
    }
    var btn = $("saveSiteBtn");
    btn.disabled = true;
    btn.textContent = "保存中…";
    $("siteStatus").textContent = "";
    api("/site", { method: "POST", body: payload })
      .then(function (data) {
        $("siteStatus").textContent = "✔ " + (data.message || "已保存");
        showToast("站点设置已保存", "success");
        loadDeploy();
      })
      .catch(function (err) { showToast(err.message || "保存失败", "error"); })
      .then(function () { btn.disabled = false; btn.textContent = "💾 保存站点设置"; });
  });

  /* 部署状态 */
  var DEPLOY_LABEL = {
    success: "✅ 部署成功",
    pending: "⏳ 构建中",
    failure: "❌ 部署失败",
    error: "❌ 出错",
    unknown: "• 无状态",
  };

  function loadDeploy() {
    var box = $("deployList");
    box.innerHTML = '<div class="loading">读取中</div>';
    api("/deploy")
      .then(function (data) {
        var list = (data && data.commits) || [];
        if (!list.length) { box.innerHTML = '<div class="empty-state">暂无提交记录</div>'; return; }
        box.innerHTML = list.map(function (c) {
          var label = DEPLOY_LABEL[c.state] || ("• " + c.state);
          var color = c.state === "success" ? "var(--accent)"
                    : c.state === "failure" || c.state === "error" ? "var(--danger)"
                    : "var(--text-dim)";
          var when = c.date ? String(c.date).replace("T", " ").slice(0, 16) : "";
          return '<div class="deploy-item">' +
            '<div class="deploy-head">' +
              '<code>' + escapeHtml(c.shortSha) + "</code>" +
              '<span style="color:' + color + ';font-size:11px;">' + escapeHtml(label) + "</span>" +
              '<span style="font-size:11px;color:var(--text-dim);margin-left:auto;">' + escapeHtml(when) + "</span>" +
            "</div>" +
            '<div class="deploy-msg">' + escapeHtml(c.message) + "</div>" +
            (c.desc ? '<div class="deploy-desc">' + escapeHtml(c.desc) + "</div>" : "") +
          "</div>";
        }).join("");
      })
      .catch(function (err) {
        box.innerHTML = '<div class="empty-state" style="color:var(--danger);">读取失败：' + escapeHtml(err.message || "") + "</div>";
      });
  }

  $("refreshDeployBtn").addEventListener("click", loadDeploy);

  /* 数据备份导出 */
  $("exportBackupBtn").addEventListener("click", function () {
    var btn = $("exportBackupBtn");
    btn.disabled = true;
    btn.textContent = "导出中…";
    $("backupStatus").textContent = "";
    api("/backup")
      .then(function (data) {
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "zyf-blog-backup-" + new Date().toISOString().slice(0, 10) + ".json";
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        var c = data.counts || {};
        $("backupStatus").textContent = "✔ 已导出：文章 " + (c.articles || 0) + " · 项目 " + (c.projects || 0)
          + " · 相册 " + (c.gallery || 0) + " · 下载 " + (c.downloads || 0)
          + " · 关联 " + (c.links || 0) + " · 知识库 " + (c.kb || 0);
        showToast("备份已下载", "success");
      })
      .catch(function (err) { showToast(err.message || "导出失败", "error"); })
      .then(function () { btn.disabled = false; btn.textContent = "⬇️ 导出备份 JSON"; });
  });

  /* ---------- 转义 ---------- */

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  /* ---------- 初始化 ---------- */

  // 校验令牌有效性（拉一次文章列表，401 则回登录页）
  if (getToken()) {
    api("/articles")
      .then(function () { showAdmin(); })
      .catch(function () { clearToken(); showLogin(); });
  } else {
    showLogin();
  }
})();