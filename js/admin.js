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

  /* ---------- 实时预览（防抖，服务器端渲染同一转换器） ---------- */

  function updatePreview() {
    var body = $("bodyField").value;
    $("previewContent").innerHTML = '<p style="color:var(--text-dim);font-size:12px;">渲染中…</p>';
    api("/preview", { method: "POST", body: { body: body } })
      .then(function (data) { $("previewContent").innerHTML = data.html; })
      .catch(function () { $("previewContent").innerHTML = '<p style="color:var(--danger);font-size:12px;">预览失败</p>'; });
  }

  $("bodyField").addEventListener("input", function () {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, 600);
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