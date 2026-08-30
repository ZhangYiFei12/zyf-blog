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
  var compressTarget = $("compressTarget");
  var compressQuality = $("compressQuality");

  var previewTimer = null;

  var uploadMdBtn = $("uploadMdBtn");
  var mdFileInput = $("mdFileInput");

  var tabArticles = $("tabArticles");
  var tabProjects = $("tabProjects");
  var tabGallery = $("tabGallery");
  var viewArticles = $("viewArticles");
  var viewProjects = $("viewProjects");
  var viewGallery = $("viewGallery");
  var galleryGrid = $("galleryGrid");
  var galleryLoading = $("galleryLoading");
  var galleryUploadBtn = $("galleryUploadBtn");
  var galleryFileInput = $("galleryFileInput");
  var galleryCount = $("galleryCount");
  var galleryCache = [];
  var projectList = $("projectList");
  var projectListLoading = $("projectListLoading");
  var saveProjectBtn = $("saveProjectBtn");
  var projDraftBtn = $("projDraftBtn");
  var resetProjectBtn = $("resetProjectBtn");
  var projectId = $("projectId");
  var projectsCache = [];
  var projectFilterEl = $("projectFilter");
  var projectFilterStatus = "";
  var pendingDeleteId = null;
  var pendingDeleteBtn = null;
  var pendingDeleteTimer = null;

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
        cancelEditBtn.style.display = "inline-flex";
        publishBtn.textContent = "📝 发布";
        draftBtn.textContent = "💾 存草稿";
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
    draftBtn.textContent = "💾 存草稿";
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

    var btn = isPublished ? publishBtn : draftBtn;
    btn.disabled = true;
    btn.textContent = "提交中…";
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

  uploadImgBtn.addEventListener("click", function () { imgFileInput.click(); });

  imgFileInput.addEventListener("change", function () {
    var files = Array.prototype.slice.call(imgFileInput.files || []);
    if (!files.length) return;
    var HARD_LIMIT = 5 * 1024 * 1024;
    var targetBytes = (parseInt((compressTarget && compressTarget.value) || "5120", 10) || 5120) * 1024;
    var quality = parseFloat((compressQuality && compressQuality.value) || "0.8") || 0.8;
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
  });

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
    viewArticles.style.display = name === "articles" ? "block" : "none";
    viewProjects.style.display = name === "projects" ? "block" : "none";
    viewGallery.style.display = name === "gallery" ? "block" : "none";
    if (name === "projects") loadProjects();
    if (name === "gallery") loadGallery();
  }

  tabArticles.addEventListener("click", function () { switchTab("articles"); });
  tabProjects.addEventListener("click", function () { switchTab("projects"); });
  tabGallery.addEventListener("click", function () { switchTab("gallery"); });

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
    galleryGrid.innerHTML = "";
    galleryCache.forEach(function (g) {
      var cell = document.createElement("div");
      cell.style.cssText = "position:relative;border:1px solid var(--border);border-radius:10px;overflow:hidden;aspect-ratio:1/1;background:var(--bg-soft);";
      cell.innerHTML =
        '<img src="' + escapeAttr(g.url) + '" alt="' + escapeAttr(g.caption || g.file) + '" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy" />' +
        '<button class="btn btn-danger btn-sm" data-action="del" data-file="' + escapeAttr(g.file) + '" style="position:absolute;top:6px;right:6px;">删除</button>';
      galleryGrid.appendChild(cell);
    });
  }

  galleryGrid.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-action='del']");
    if (!btn) return;
    deleteGalleryImage(btn.getAttribute("data-file"), btn);
  });

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

  galleryUploadBtn.addEventListener("click", function () { galleryFileInput.click(); });

  galleryFileInput.addEventListener("change", function () {
    var files = Array.prototype.slice.call(galleryFileInput.files || []);
    if (!files.length) return;
    var HARD_LIMIT = 5 * 1024 * 1024;
    var targetBytes = (parseInt((compressTarget && compressTarget.value) || "5120", 10) || 5120) * 1024;
    var quality = parseFloat((compressQuality && compressQuality.value) || "0.8") || 0.8;
    var results = []; // {data, mime, ext}
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
        results.push({ data: (dataUrl.split(",")[1]) || "", mime: mime, ext: ext });
        processNext(i + 1);
      };
      var failOne = function (msg) {
        failCount++;
        showToast("[" + file.name + "] " + msg, "error");
        processNext(i + 1);
      };

      if (file.size <= targetBytes) {
        var reader0 = new FileReader();
        reader0.onload = function (e) {
          var result = e.target && e.target.result;
          if (!result) { failOne("读取失败"); return; }
          var mime0 = (result.split(",")[0].match(/data:([^;]+)/) || ["", "image/png"])[1];
          var ext0 = file.name.split(".").pop() || "png";
          push(result, mime0, ext0);
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
            push(out.dataUrl, "image/jpeg", "jpg");
          })
          .catch(function () { failOne("压缩失败"); });
      };
      reader.onerror = function () { failOne("读取失败"); };
      reader.readAsDataURL(file);
    };
    processNext(0);
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