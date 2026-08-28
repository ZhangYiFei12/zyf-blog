/* ============================================================
   张义飞个人博客 · 交互脚本
   ============================================================ */

(function () {
  "use strict";

  /* ---- 自动注入：粒子画布 + 滚动进度条（全站生效） ---- */
  if (!document.getElementById("particles")) {
    var pc = document.createElement("canvas");
    pc.id = "particles";
    pc.setAttribute("aria-hidden", "true");
    document.body.insertBefore(pc, document.body.firstChild);
  }
  if (!document.querySelector(".scroll-progress")) {
    var sp = document.createElement("div");
    sp.className = "scroll-progress";
    sp.setAttribute("aria-hidden", "true");
    sp.innerHTML = '<div class="bar"></div>';
    document.body.appendChild(sp);
  }

  /* ---- 自动增强：卡片 3D 倾斜 + 光效 + 涟漪 ---- */
  document.querySelectorAll(".card").forEach(function (card) {
    if (!card.classList.contains("tilt")) card.classList.add("tilt");
    if (!card.classList.contains("ripple-js")) card.classList.add("ripple-js");
    if (!card.querySelector(".card-shine")) {
      var shine = document.createElement("div");
      shine.className = "card-shine";
      card.appendChild(shine);
    }
  });
  // 交互按钮涟漪
  [".theme-toggle", ".nav-toggle", ".back-top", ".tag-filter .chip"].forEach(function (sel) {
    document.querySelectorAll(sel).forEach(function (el) {
      if (!el.classList.contains("ripple-js")) el.classList.add("ripple-js");
    });
  });

  /* ---- 文章列表交错浮现 ---- */
  var postItems = document.querySelectorAll(".post-item");
  if (postItems.length) {
    postItems.forEach(function (item, i) {
      item.style.transitionDelay = Math.min(i * 0.06, 0.6) + "s";
      item.classList.add("stagger-in");
    });
  }

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

  /* ---- 博客标签筛选 + 站内搜索（博客列表页） ---- */
  var tagFilter = document.getElementById("tagFilter");
  var searchInput = document.getElementById("searchInput");
  if (tagFilter) {
    var postItems = Array.prototype.slice.call(document.querySelectorAll(".post-item"));
    var emptyState = document.getElementById("blogEmpty");
    var activeTag = "";
    var searchQuery = "";
    var searchIndex = null;

    // 加载搜索索引（data/search-index.json，含标题/标签/正文纯文本）
    fetch("data/search-index.json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("no index")); })
      .then(function (idx) { searchIndex = idx; })
      .catch(function () { searchIndex = null; });

    var tagCounts = {};
    postItems.forEach(function (item) {
      (item.getAttribute("data-tags") || "").split(/\s+/).filter(Boolean).forEach(function (t) {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    });
    var allTags = Object.keys(tagCounts).sort(function (a, b) { return tagCounts[b] - tagCounts[a]; });

    function renderChips() {
      var html = '<button type="button" class="chip' + (activeTag ? "" : " active") + '" data-tag="">全部 <em>' + postItems.length + '</em></button>';
      allTags.forEach(function (t) {
        html += '<button type="button" class="chip' + (activeTag === t ? " active" : "") + '" data-tag="' + esc(t) + '">' + esc(t) + ' <em>' + tagCounts[t] + '</em></button>';
      });
      tagFilter.innerHTML = html;
    }

    function itemMatches(item) {
      var tags = (item.getAttribute("data-tags") || "").split(/\s+/).filter(Boolean);
      if (activeTag && tags.indexOf(activeTag) === -1) return false;
      if (!searchQuery) return true;
      var slug = (item.getAttribute("href") || "").replace(/^blog\//, "").replace(/\.html$/, "");
      var entry = searchIndex ? searchIndex.find(function (e) { return e.slug === slug; }) : null;
      if (entry) {
        return entry.title.toLowerCase().indexOf(searchQuery) !== -1 ||
          (entry.text || "").toLowerCase().indexOf(searchQuery) !== -1 ||
          (entry.tags || []).some(function (t) { return String(t).toLowerCase().indexOf(searchQuery) !== -1; });
      }
      return item.textContent.toLowerCase().indexOf(searchQuery) !== -1;
    }

    function applyFilter() {
      var visible = 0;
      postItems.forEach(function (item) {
        var show = itemMatches(item);
        item.style.display = show ? "" : "none";
        if (show) visible++;
      });
      renderChips();
      if (emptyState) {
        emptyState.textContent = visible ? "暂无更多文章 · 敬请期待" : (searchQuery ? "没有找到与「" + searchQuery + "」相关的文章" : "没有「" + (activeTag || "") + "」标签的文章");
        emptyState.style.display = visible ? "" : "block";
      }
    }

    tagFilter.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".chip") : null;
      if (!btn) return;
      activeTag = btn.getAttribute("data-tag") || "";
      applyFilter();
    });

    if (searchInput) {
      var searchTimer = null;
      searchInput.addEventListener("input", function () {
        clearTimeout(searchTimer);
        var q = searchInput.value.trim().toLowerCase();
        searchTimer = setTimeout(function () {
          searchQuery = q;
          applyFilter();
        }, 200);
      });
    }

    if (allTags.length) applyFilter();
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

  /* ---- 鼠标跟随光晕（spotlight，仅桌面端） ---- */
  if (window.matchMedia("(pointer: fine)").matches) {
    var root = document.documentElement;
    var ticking = false;
    document.addEventListener("mousemove", function (e) {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        root.style.setProperty("--cursor-x", e.clientX + "px");
        root.style.setProperty("--cursor-y", e.clientY + "px");
        ticking = false;
      });
    });
  }

  /* ---- 导航栏滚动阴影 ---- */
  var navbar = document.querySelector(".navbar");
  if (navbar) {
    function updateNavbar() {
      navbar.classList.toggle("scrolled", (window.pageYOffset || document.documentElement.scrollTop || 0) > 10);
    }
    document.addEventListener("scroll", updateNavbar, { passive: true });
    updateNavbar();
  }

  /* ---- 主题切换旋转动画 ---- */
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      themeBtn.classList.remove("spin");
      void themeBtn.offsetWidth;
      themeBtn.classList.add("spin");
    });
  }

  /* ---- Canvas 粒子背景（全站浮动光点） ---- */
  var particlesCanvas = document.getElementById("particles");
  if (particlesCanvas && window.matchMedia("(min-width: 768px)").matches) {
    var ctx = particlesCanvas.getContext("2d");
    var pr = window.devicePixelRatio || 1;
    var w = window.innerWidth, h = window.innerHeight;
    particlesCanvas.width = w * pr;
    particlesCanvas.height = h * pr;
    ctx.scale(pr, pr);
    var particles = [];
    var count = Math.min(80, Math.floor((w * h) / 12000));
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 1 + Math.random() * 1.5,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        o: 0.15 + Math.random() * 0.35,
        hue: 170 + Math.random() * 60, // 青 ~ 紫
      });
    }
    function drawParticles() {
      ctx.clearRect(0, 0, w, h);
      particles.forEach(function (p, pi) {
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "hsla(" + p.hue + ", 80%, 70%, " + p.o + ")";
        ctx.fill();
        // 连线（近距离粒子）
        for (var j = pi + 1; j < particles.length; j++) {
          var p2 = particles[j];
          var dx = p.x - p2.x, dy = p.y - p2.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = "hsla(186, 80%, 70%, " + (0.08 * (1 - dist / 120)) + ")";
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });
      requestAnimationFrame(drawParticles);
    }
    drawParticles();
    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        w = window.innerWidth;
        h = window.innerHeight;
        particlesCanvas.width = w * pr;
        particlesCanvas.height = h * pr;
        ctx.scale(pr, pr);
      }, 300);
    });
  }

  /* ---- 3D 卡片倾斜 ---- */
  document.querySelectorAll(".card.tilt").forEach(function (card) {
    card.addEventListener("mousemove", function (e) {
      var rect = card.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var x = (e.clientX - cx) / (rect.width / 2);
      var y = (e.clientY - cy) / (rect.height / 2);
      card.style.transform = "rotateX(" + (-y * 8) + "deg) rotateY(" + (x * 8) + "deg) translateY(-4px)";
      card.style.setProperty("--mx", (e.clientX - rect.left) / rect.width * 100 + "%");
      card.style.setProperty("--my", (e.clientY - rect.top) / rect.height * 100 + "%");
    });
    card.addEventListener("mouseleave", function () {
      card.style.transform = "";
    });
  });

  /* ---- 点击涟漪 ---- */
  document.addEventListener("click", function (e) {
    var rippleEl = e.target.closest(".ripple-js");
    if (!rippleEl) return;
    var r = document.createElement("span");
    r.className = "ripple";
    var rect = rippleEl.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height);
    r.style.width = r.style.height = size + "px";
    r.style.left = (e.clientX - rect.left - size / 2) + "px";
    r.style.top = (e.clientY - rect.top - size / 2) + "px";
    rippleEl.appendChild(r);
    setTimeout(function () { r.remove(); }, 700);
  });

  /* ---- 交错浮现（增强滚动 reveal） ---- */
  var staggerEls = document.querySelectorAll(".reveal-stagger");
  if (staggerEls.length && "IntersectionObserver" in window) {
    var staggerIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("in-view");
          staggerIO.unobserve(en.target);
        }
      });
    }, { threshold: 0.1 });
    staggerEls.forEach(function (el) { staggerIO.observe(el); });
  }

  /* ---- 滚动进度竖条 ---- */
  var scrollBar = document.querySelector(".scroll-progress .bar");
  if (scrollBar) {
    function updateScrollBar() {
      var doc = document.documentElement;
      var total = doc.scrollHeight - doc.clientHeight;
      var scrolled = doc.scrollTop || document.body.scrollTop || 0;
      scrollBar.style.height = (total > 0 ? (scrolled / total) * 100 : 0) + "%";
    }
    document.addEventListener("scroll", updateScrollBar, { passive: true });
    window.addEventListener("resize", updateScrollBar);
    updateScrollBar();
  }

  /* ---- 磁吸按钮 ---- */
  document.querySelectorAll(".magnetic").forEach(function (btn) {
    btn.addEventListener("mousemove", function (e) {
      var rect = btn.getBoundingClientRect();
      var x = (e.clientX - rect.left - rect.width / 2) * 0.25;
      var y = (e.clientY - rect.top - rect.height / 2) * 0.25;
      btn.style.transform = "translate(" + x + "px, " + y + "px)";
    });
    btn.addEventListener("mouseleave", function () {
      btn.style.transform = "";
    });
  });

  /* ---- 标题光带扫过（手动触发重新计算） ---- */
  // 纯 CSS 动画，无需 JS
})();
