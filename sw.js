/*
 * Service worker do app de delivery (Etapa 4 — PWA).
 *
 * Só tem efeito quando o site está HOSPEDADO (http/https), ex.: Vercel, Netlify,
 * GitHub Pages. Aberto localmente via arquivo (file://) o navegador ignora o SW —
 * o uso local do index.html continua funcionando normalmente, apenas sem cache offline.
 *
 * Estratégia: cache-first para a casca do app (a própria página) e network-first
 * com fallback ao cache para o restante, para o cardápio abrir mesmo offline.
 */
const CACHE = 'delivery-app-v1';
const APP_SHELL = ['./', './index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Navegação (abrir a página): network-first, cai para o cache quando offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // Demais GETs (imagens, fontes): cache-first com atualização em segundo plano
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
