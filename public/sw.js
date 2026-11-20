// BZusic Service Worker - App Shell Caching & iOS PWA Support
const CACHE_NAME = 'bzusic-v1';

const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './favicon.svg',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png'
];

// Domains and endpoints that must NEVER be intercepted by the Service Worker
const BYPASS_URL_PATTERNS = [
  '/api/',
  'supabase.co',
  'ytimg.com',
  'googleusercontent.com',
  'googlevideo.com',
  'lrclib.net'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching some assets failed:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 1. Only handle GET requests
  if (req.method !== 'GET') {
    return;
  }

  // 2. Strictly bypass any request with Range header (essential for Safari audio streaming)
  if (req.headers.has('range')) {
    return;
  }

  const url = req.url;

  // 3. Strictly bypass API endpoints, Supabase Storage, and media stream CDNs
  const shouldBypass = BYPASS_URL_PATTERNS.some((pattern) => url.includes(pattern));
  if (shouldBypass) {
    return;
  }

  // 4. Core App Shell scripts & styles: Network-First with Cache Fallback
  // Ensures fresh updates on GitHub Pages without stale code locking
  const isCoreShell = url.endsWith('/') ||
                      url.includes('index.html') ||
                      url.includes('style.css') ||
                      url.includes('app.js') ||
                      url.includes('cloud-config.js');

  if (isCoreShell) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(() => {
          return caches.match(req).then((cachedRes) => cachedRes || caches.match('./index.html'));
        })
    );
    return;
  }

  // 5. Static assets (images, icons, fonts): Cache-First with Network fallback
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      if (cachedRes) {
        return cachedRes;
      }
      return fetch(req).then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return networkRes;
      });
    })
  );
});
