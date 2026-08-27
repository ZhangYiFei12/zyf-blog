/* ============================================================
   张义飞个人博客 · 交互脚本
   ============================================================ */

(function () {
  "use strict";

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

  /* ============================================================
     照片墙 · IndexedDB 本地存储
     说明：纯静态站没有服务器，照片保存在浏览器本地数据库
     （IndexedDB），同一浏览器内持久保留，换设备/清缓存会丢失。
     ============================================================ */
  var dbName = "zyf-photos", storeName = "photos", db = null;

  function openDB() {
    return new Promise(function (resolve, reject) {
      if (db) return resolve(db);
      var req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(storeName)) {
          d.createObjectStore(storeName, { keyPath: "id" });
        }
      };
      req.onsuccess = function () { db = req.result; resolve(db); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function tx(mode, fn) {
    return new Promise(function (resolve, reject) {
      var t = db.transaction(storeName, mode);
      var done = fn(t.objectStore(storeName));
      t.oncomplete = function () { resolve(done ? done.result : undefined); };
      t.onerror = function () { reject(t.error); };
    });
  }

  function getAllPhotos() {
    return openDB().then(function () {
      return tx("readonly", function (store) {
        return store.getAll();
      });
    });
  }

  function addPhoto(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var rec = {
          id: "p" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
          name: file.name,
          type: file.type,
          size: file.size,
          data: e.target.result, // dataURL
          date: new Date().toISOString(),
        };
        openDB()
          .then(function () { return tx("readwrite", function (store) { store.put(rec); }); })
          .then(function () { resolve(rec); })
          .catch(reject);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function removePhoto(id) {
    return openDB().then(function () {
      return tx("readwrite", function (store) { store.delete(id); });
    });
  }

  /* 渲染照片墙 */
  var wall = document.querySelector(".photo-wall");
  if (wall) {
    var emptyEl = document.querySelector(".photo-empty");
    var uploader = document.querySelector(".photo-uploader");
    var fileInput = document.querySelector("#fileInput");

    function render(list) {
      wall.innerHTML = "";
      if (!list || !list.length) {
        if (emptyEl) emptyEl.style.display = "block";
        return;
      }
      if (emptyEl) emptyEl.style.display = "none";
      list.forEach(function (p) {
        var div = document.createElement("div");
        div.className = "photo-item";
        var img = document.createElement("img");
        img.src = p.data;
        img.alt = p.name;
        img.loading = "lazy";
        var del = document.createElement("button");
        del.className = "del";
        del.textContent = "✕";
        del.title = "删除";
        del.addEventListener("click", function (e) {
          e.stopPropagation();
          removePhoto(p.id).then(function () {
            div.remove();
            getAllPhotos().then(render);
          });
        });
        div.appendChild(img);
        div.appendChild(del);
        wall.appendChild(div);
      });
    }

    function handleFiles(files) {
      var valid = Array.prototype.filter.call(files, function (f) {
        return /^image\/(jpeg|png|webp|gif)$/.test(f.type) && f.size <= 5 * 1024 * 1024;
      });
      if (!valid.length) {
        alert("请选择 JPG/PNG/WebP/GIF 格式，且小于 5MB 的图片");
        return;
      }
      var ps = valid.map(addPhoto);
      Promise.all(ps)
        .then(function () { return getAllPhotos(); })
        .then(render)
        .catch(function (err) { console.error(err); alert("保存失败"); });
    }

    if (uploader) {
      uploader.addEventListener("click", function () { fileInput && fileInput.click(); });
      uploader.addEventListener("dragover", function (e) {
        e.preventDefault();
        uploader.classList.add("dragover");
      });
      uploader.addEventListener("dragleave", function () {
        uploader.classList.remove("dragover");
      });
      uploader.addEventListener("drop", function (e) {
        e.preventDefault();
        uploader.classList.remove("dragover");
        handleFiles(e.dataTransfer.files);
      });
    }
    if (fileInput) {
      fileInput.addEventListener("change", function () {
        handleFiles(fileInput.files);
        fileInput.value = "";
      });
    }

    getAllPhotos().then(render).catch(function (err) {
      console.error("照片墙加载失败", err);
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
