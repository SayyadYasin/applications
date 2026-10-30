/* TownServices service worker: app-shell cache + network-first API GETs + offline fallback. */
const VERSION = 'v1';
const SHELL = `ts-shell-${VERSION}`;
const STATIC = `ts-static-${VERSION}`;
const API = `ts-api-${VERSION}`;
const SHELL_URLS = ['/offline', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, STATIC, API].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page asks us to drop cached (user-specific) API data on logout.
self.addEventListener('message', (event) => {
  if (event.data === 'clear-api') event.waitUntil(caches.delete(API));
});

const isApi = (url) => url.pathname.includes('/api/v1/');

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  const fresh = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || fresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never cache auth endpoints or the socket transport.
  if (url.pathname.includes('/auth/') || url.pathname.startsWith('/socket.io')) return;

  if (isApi(url)) {
    event.respondWith(networkFirst(request, API));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          if (res.ok) caches.open(SHELL).then((c) => c.put(request, copy));
          return res;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('/offline'))),
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
