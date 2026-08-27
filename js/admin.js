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
  var publishStatus = $("publishStatus");
  var cancelEditBtn = $("cancelEditBtn");
  var editSlug = $("editSlug");
  var articleList = $("articleList");
  var listLoading = $("listLoading");
  var toastEl = $("toast");

  var previewTimer = null;

  var uploadMdBtn = $("uploadMdBtn");
  var mdFileInput = $("mdFileInput");

  var tabArticles = $("tabArticles");
  var tabProjects = $("tabProjects");
  var viewArticles = $("viewArticles");
  var viewProjects = $("viewProjects");
  var projectList = $("projectList");
  var projectListLoading = $("projectListLoading");
  var saveProjectBtn = $("saveProjectBtn");
  var resetProjectBtn = $("resetProjectBtn");
  var projectId = $("projectId");
  var projectsCache = [];

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

  /* ---------- 文章列表 ---------- */

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
        data.articles.forEach(function (a) {
          var item = document.createElement("div");
          item.className = "item";
          item.innerHTML =
            '<div class="info">' +
              '<div class="title">' + escapeHtml(a.title || "(无标题)") + "</div>" +
              '<div class="date">' + escapeHtml(a.date || "") + (a.tags && a.tags.length ? " · " + escapeHtml(a.tags.join(" / ")) : "") + "</div>" +
            "</div>" +
            '<div class="actions">' +
              '<button class="btn btn-outline btn-sm" data-action="edit" data-slug="' + escapeAttr(a.slug) + '">编辑</button>' +
              '<button class="btn btn-danger btn-sm" data-action="del" data-slug="' + escapeAttr(a.slug) + '">删除</button>' +
            "</div>";
          articleList.appendChild(item);
        });
      })
      .catch(function (err) {
        listLoading.style.display = "none";
        articleList.innerHTML = '<div class="empty-state" style="color:var(--danger);">加载失败：' + escapeHtml(err.message) + "</div>";
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
        cancelEditBtn.style.display = "inline-flex";
        publishBtn.textContent = "💾 保存修改";
        updatePreview();
        $("titleField").scrollIntoView({ behavior: "smooth", block: "start" });
        showToast("已载入《" + (data.meta.title || "") + "》", "success");
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
    cancelEditBtn.style.display = "none";
    publishBtn.textContent = "📝 发布";
    updatePreview();
  }

  cancelEditBtn.addEventListener("click", resetEditor);

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

  // 所有字段变化都触发实时预览
  ["titleField", "dateField", "tagsField", "excerptField", "bodyField"].forEach(function (id) {
    $(id).addEventListener("input", schedulePreview);
  });

  /* ---------- 发布 / 保存 ---------- */

  function publish() {
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
    };
    // 编辑时传回原 slug，保证地址不变
    if (editSlug.value) payload.slug = editSlug.value;

    publishBtn.disabled = true;
    publishBtn.textContent = "提交中…";
    publishStatus.textContent = "";

    api("/articles", { method: "POST", body: payload })
      .then(function (data) {
        publishStatus.textContent = "✔ " + data.message;
        showToast(data.message, "success");
        loadArticles();
      })
      .catch(function (err) {
        showToast(err.message, "error");
      })
      .finally(function () {
        publishBtn.disabled = false;
        publishBtn.textContent = editSlug.value ? "💾 保存修改" : "📝 发布";
      });
  }

  publishBtn.addEventListener("click", publish);

  /* ---------- 删除 ---------- */

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
    var isArticles = name === "articles";
    tabArticles.className = "tab" + (isArticles ? " active" : "");
    tabProjects.className = "tab" + (isArticles ? "" : " active");
    viewArticles.style.display = isArticles ? "block" : "none";
    viewProjects.style.display = isArticles ? "none" : "block";
    if (!isArticles) loadProjects();
  }

  tabArticles.addEventListener("click", function () { switchTab("articles"); });
  tabProjects.addEventListener("click", function () { switchTab("projects"); });

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
        projectsCache.forEach(function (p) {
          var item = document.createElement("div");
          item.className = "item";
          item.innerHTML =
            '<div class="info">' +
              '<div class="title">' + escapeHtml(p.title || "(无标题)") + (p.featured ? ' <span style="color:var(--accent);font-size:10px;">★精选</span>' : "") + "</div>" +
              '<div class="date">' + escapeHtml(p.year || "") + (p.tags && p.tags.length ? " · " + escapeHtml(p.tags.join(" / ")) : "") + "</div>" +
            "</div>" +
            '<div class="actions">' +
              '<button class="btn btn-outline btn-sm" data-action="edit" data-id="' + escapeAttr(p.id) + '">编辑</button>' +
              '<button class="btn btn-danger btn-sm" data-action="del" data-id="' + escapeAttr(p.id) + '">删除</button>' +
            "</div>";
          projectList.appendChild(item);
        });
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
      loadProject(id);
    } else if (btn.getAttribute("data-action") === "del") {
      deleteProject(id);
    }
  });

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

  function saveProject() {
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
    };
    if (projectId.value) payload.id = projectId.value;

    saveProjectBtn.disabled = true;
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
        saveProjectBtn.textContent = projectId.value ? "💾 保存修改" : "➕ 添加项目";
      });
  }

  saveProjectBtn.addEventListener("click", saveProject);

  /* ---------- 删除项目 ---------- */

  function deleteProject(id) {
    var p = projectsCache.find(function (x) { return x.id === id; });
    if (!confirm("确定删除项目「" + (p ? p.title : "") + "」吗？\n删除后不可恢复。")) return;
    api("/projects", { method: "DELETE", body: { id: id } })
      .then(function (data) {
        showToast(data.message, "success");
        loadProjects();
      })
      .catch(function (err) { showToast(err.message, "error"); });
  }

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