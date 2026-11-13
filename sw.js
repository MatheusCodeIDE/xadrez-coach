// Xadrez Coach — funciona offline. Troque o número da versão a cada atualização.
const CACHE = 'xadrez-coach-v16';
const FILES = [
  './', './index.html', './style.css', './pieces.css', './app.js', './analysis.js', './board.js', './engine.js',
  './train.js', './endgames.js', './openings.js', './puzzles.json', './manifest.webmanifest',
  './lib/chess.js', './engine/stockfish-19-lite-single.js', './engine/stockfish-19-lite-single.wasm',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/mascot.svg', './icons/mascot-dark.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(FILES.map((f) => c.add(f).catch(() => null)))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// cache primeiro (rápido e offline); se não houver, busca na rede e guarda
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
