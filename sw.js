const V = 'xadrez-coach-v7';
const FILES = ['./','index.html','style.css','pieces.css','app.js','board.js','engine.js','analysis.js','lib/chess.js',
  'engine/stockfish-19-lite-single.js','engine/stockfish-19-lite-single.wasm','manifest.webmanifest','icons/icon-180.png','icons/icon-192.png','icons/mascot.svg','icons/mascot-dark.svg','icons/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
