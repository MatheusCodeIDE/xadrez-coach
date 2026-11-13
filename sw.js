// Xadrez Coach — funciona offline. Troque o número da versão a cada atualização.
const CACHE = 'xadrez-coach-v27';
const FILES = [
  './', './index.html', './style.css', './pieces.css', './app.js', './analysis.js', './board.js', './engine.js',
  './train.js', './ach.js', './endgames.js', './openings.js', './bots.js', './puzzles.json', './manifest.webmanifest',
  './lib/chess.js', './engine/stockfish-19-lite-single.js', './engine/stockfish-19-lite-single.wasm',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/mascot.svg', './icons/mascot-dark.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(FILES.map((f) => c.add(new Request(f, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// arquivos do app: rede primeiro (sempre a versão mais nova), cache como reserva offline.
// motor (wasm) e imagens: cache primeiro (pesados e não mudam).
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const heavy = /\.(wasm|png|svg)$|stockfish/.test(req.url);
  const net = () => fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  });
  e.respondWith(
    heavy
      ? caches.match(req, { ignoreSearch: true }).then((hit) => hit || net().catch(() => caches.match('./index.html')))
      : net().catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html')))
  );
});
