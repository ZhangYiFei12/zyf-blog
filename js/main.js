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

  /* ---- 上一篇 / 下一篇（文章页，客户端渲染） ---- */
  var postNav = document.getElementById("postNav");
  if (postNav) {
    var current = decodeURIComponent(window.location.pathname.split("/").pop().replace(/\.html$/i, ""));
    function esc(s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    }
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
