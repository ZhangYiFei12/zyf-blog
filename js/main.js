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

  /* ---- 当前年份导航高亮 ---- */
  var path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach(function (a) {
    var href = a.getAttribute("href");
    if (href === path) a.classList.add("active");
  });
})();
