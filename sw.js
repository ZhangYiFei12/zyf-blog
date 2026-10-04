/* ============================================================
   sw.js —— Service Worker（离线支持 + 静态资源缓存）

   策略：
     · HTML / data/*  → 网络优先（保证内容最新），离线时回退缓存
     · css/js/images  → 缓存优先（这些资源带 ?v= 版本号，内容不可变）
     · 其余           → 网络优先，失败时回退离线页

   注意：本文件放在站点根目录（/sw.js），不要放进 /js/，
        否则会被 _headers 的 immutable 规则长期缓存而无法更新。
   ============================================================ */

const CACHE = 'zh-blog-v1';
const OFFLINE_URL = '/offline.html';

/* 预缓存：应用外壳（体积很小，只放首屏必需） */
/* 只预缓存离线页与图标；CSS/JS 会在首次访问时由静态分支自动缓存 */
const PRECACHE = [
  '/offline.html',
  '/images/icon.svg',
  '/images/avatar.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.allSettled(PRECACHE.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 只接管同源请求，第三方（giscus 等）交给浏览器
  if (url.origin !== self.location.origin) return;

  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  const isData = url.pathname.startsWith('/data/') || /\/(sitemap\.xml|feed\.xml|manifest\.json|robots\.txt)$/.test(url.pathname);
  const isStatic = /^\/(css|js|images)\//.test(url.pathname);

  // 静态资源：缓存优先
  if (isStatic) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // HTML / 数据：网络优先，离线回退缓存，导航请求最终回退离线页
  if (isHTML || isData) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok && !isHTML) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => {
          if (hit) return hit;
          if (isHTML) return caches.match(OFFLINE_URL);
          return new Response('', { status: 504, statusText: 'offline' });
        }))
    );
  }
});
