/* ============================================================
   张义飞个人博客 · 交互脚本
   ============================================================ */

(function () {
  "use strict";

  /* ---- 深浅色主题切换 ---- */
  var themeBtn = document.getElementById("themeToggle");
  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }
  function syncThemeIcon() {
    if (!themeBtn) return;
    themeBtn.textContent = currentTheme() === "light" ? "☾" : "☀";
    themeBtn.setAttribute("aria-label", currentTheme() === "light" ? "切换到深色模式" : "切换到浅色模式");
  }
  syncThemeIcon();
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var isLight = currentTheme() === "light";
      if (isLight) document.documentElement.removeAttribute("data-theme");
      else document.documentElement.setAttribute("data-theme", "light");
      try { localStorage.setItem("zyf-theme", isLight ? "dark" : "light"); } catch (e) {}
      syncThemeIcon();
    });
  }

  /* ---- 移动端导航切换 ---- */
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      links.classList.toggle("open");
    });
    document.addEventListener("click", function (e) {
      if (!toggle.contains(e.target) && !links.contains(e.target)) {
        links.classList.remove("open");
      }
    });
  }

  /* ---- 首页打字效果 ---- */
  var typingEl = document.querySelector("[data-typing]");
  if (typingEl) {
    var phrases = JSON.parse(typingEl.getAttribute("data-typing") || "[]");
    var pi = 0, ci = 0, deleting = false;
    function typeLoop() {
      var current = phrases[pi] || "";
      if (!deleting) {
        ci++;
        if (ci === current.length + 1) {
          deleting = true;
          setTimeout(typeLoop, 1600);
          typingEl.innerHTML = current + '<span class="cursor">▋</span>';
          return;
        }
      } else {
        ci--;
        if (ci === 0) {
          deleting = false;
          pi = (pi + 1) % phrases.length;
        }
      }
      typingEl.innerHTML =
        current.slice(0, ci) + '<span class="cursor">▋</span>';
      setTimeout(typeLoop, deleting ? 35 : 90);
    }
    setTimeout(typeLoop, 400);
  }

  /* ---- 滚动浮现动画 ---- */
  var revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("visible");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.08 }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("visible"); });
  }

  /* ---- 技能条动画 ---- */
  var fills = document.querySelectorAll(".skill-bar .fill");
  if (fills.length && "IntersectionObserver" in window) {
    var io2 = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.style.width = en.target.getAttribute("data-level") + "%";
            io2.unobserve(en.target);
          }
        });
      },
      { threshold: 0.3 }
    );
    fills.forEach(function (f) { io2.observe(f); });
  } else {
    fills.forEach(function (f) {
      f.style.width = f.getAttribute("data-level") + "%";
    });
  }

  /* ---- 页脚年份 ---- */
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- 阅读进度条（文章页） ---- */
  var progressEl = document.getElementById("readingProgress");
  if (progressEl) {
    function updateProgress() {
      var doc = document.documentElement;
      var total = doc.scrollHeight - doc.clientHeight;
      var scrolled = doc.scrollTop || document.body.scrollTop || 0;
      progressEl.style.width = (total > 0 ? (scrolled / total) * 100 : 0) + "%";
    }
    document.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    updateProgress();
  }

  /* ---- 返回顶部按钮 ---- */
  var backTop = document.getElementById("backTop");
  if (backTop) {
    function updateBackTop() {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      backTop.classList.toggle("show", y > 400);
    }
    document.addEventListener("scroll", updateBackTop, { passive: true });
    backTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    updateBackTop();
  }

  /* ---- 复制代码按钮 ---- */
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }
  document.querySelectorAll(".article-body pre").forEach(function (pre) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn";
    btn.textContent = "复制";
    btn.setAttribute("aria-label", "复制代码");
    pre.appendChild(btn);
    btn.addEventListener("click", function () {
      var code = pre.querySelector("code");
      var text = code ? code.innerText : pre.innerText;
      function done() {
        btn.textContent = "已复制 ✓";
        btn.classList.add("copied");
        setTimeout(function () {
          btn.textContent = "复制";
          btn.classList.remove("copied");
        }, 1500);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
      } else {
        fallbackCopy(text); done();
      }
    });
  });

  /* ---- HTML 转义辅助 ---- */
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }

  /* ---- 文章目录 TOC（文章页） ---- */
  var articleBody = document.querySelector(".article-body");
  if (articleBody) {
    var headings = articleBody.querySelectorAll("h2, h3");
    var tocItems = [];
    var usedIds = {};
    headings.forEach(function (h) {
      var text = h.textContent.trim();
      var base = text.replace(/[^\w\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "section";
      var id = base, n = 1;
      while (usedIds[id]) { n++; id = base + "-" + n; }
      usedIds[id] = true;
      h.id = id;
      tocItems.push({ id: id, text: text, level: h.tagName === "H2" ? 2 : 3 });
    });
    if (tocItems.length >= 2) {
      var toc = document.createElement("nav");
      toc.className = "toc";
      toc.innerHTML = '<div class="toc-title">📑 目录</div><ol>' +
        tocItems.map(function (it) {
          return '<li class="toc-' + it.level + '"><a href="#' + esc(it.id) + '">' + esc(it.text) + '</a></li>';
        }).join("") +
        '</ol>';
      articleBody.insertBefore(toc, articleBody.firstChild);
      if ("IntersectionObserver" in window) {
        var tocLinks = toc.querySelectorAll("a");
        var spy = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) {
              tocLinks.forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id); });
            }
          });
        }, { rootMargin: "-80px 0px -60% 0px" });
        headings.forEach(function (h) { spy.observe(h); });
      }
    }
  }

  /* ---- 代码语法高亮（highlight.js，文章页） ---- */
  if (window.hljs && document.querySelector(".article-body code")) {
    try { hljs.highlightAll(); } catch (e) {}
  }

  /* ---- 博客标签筛选（博客列表页） ---- */
  var tagFilter = document.getElementById("tagFilter");
  if (tagFilter) {
    var postItems = Array.prototype.slice.call(document.querySelectorAll(".post-item"));
    var emptyState = document.getElementById("blogEmpty");
    var tagCounts = {};
    postItems.forEach(function (item) {
      (item.getAttribute("data-tags") || "").split(/\s+/).filter(Boolean).forEach(function (t) {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    });
    var allTags = Object.keys(tagCounts).sort(function (a, b) { return tagCounts[b] - tagCounts[a]; });
    function renderChips(activeTag) {
      var html = '<button type="button" class="chip' + (activeTag ? "" : " active") + '" data-tag="">全部 <em>' + postItems.length + '</em></button>';
      allTags.forEach(function (t) {
        html += '<button type="button" class="chip' + (activeTag === t ? " active" : "") + '" data-tag="' + esc(t) + '">' + esc(t) + ' <em>' + tagCounts[t] + '</em></button>';
      });
      tagFilter.innerHTML = html;
    }
    function applyFilter(tag) {
      var visible = 0;
      postItems.forEach(function (item) {
        var tags = (item.getAttribute("data-tags") || "").split(/\s+/).filter(Boolean);
        var show = !tag || tags.indexOf(tag) !== -1;
        item.style.display = show ? "" : "none";
        if (show) visible++;
      });
      renderChips(tag);
      if (emptyState) {
        emptyState.textContent = visible ? "暂无更多文章 · 敬请期待" : "没有「" + (tag || "") + "」标签的文章";
        emptyState.style.display = visible ? "" : "block";
      }
    }
    tagFilter.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".chip") : null;
      if (!btn) return;
      applyFilter(btn.getAttribute("data-tag"));
    });
    if (allTags.length) applyFilter("");
    else tagFilter.style.display = "none";
  }

  /* ---- 上一篇 / 下一篇（文章页，客户端渲染） ---- */
  var postNav = document.getElementById("postNav");
  if (postNav) {
    var current = decodeURIComponent(window.location.pathname.split("/").pop().replace(/\.html$/i, ""));
    fetch("../data/posts.json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("fetch failed")); })
      .then(function (posts) {
        if (!Array.isArray(posts) || !posts.length) return;
        var idx = posts.findIndex(function (p) { return p.slug === current; });
        if (idx === -1) return;
        var newer = posts[idx - 1]; // 更新的文章 → 上一篇
        var older = posts[idx + 1]; // 更旧的文章 → 下一篇
        var html = "";
        if (newer) html += '<a class="prev" href="' + esc(newer.slug) + '.html"><span class="pn-label">← 上一篇</span><span class="pn-title">' + esc(newer.title) + '</span></a>';
        if (older) html += '<a class="next" href="' + esc(older.slug) + '.html"><span class="pn-label">下一篇 →</span><span class="pn-title">' + esc(older.title) + '</span></a>';
        postNav.innerHTML = html;
      })
      .catch(function () {});
  }

  /* ---- 当前年份导航高亮 ---- */
  var path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach(function (a) {
    var href = a.getAttribute("href");
    if (href === path) a.classList.add("active");
  });
})();
