/* BSFlow — service worker: guarda os arquivos do app para abrir rápido (e sem internet)
   e mostra as notificações. Busca sempre a versão nova primeiro. */
const VERSAO = 'bsflow-2026-10-28';
const ARQUIVOS = ['./', './index.html', './css/app.css', './css/extras.css', './js/icones.js', './js/core.js', './js/ofertas.js', './js/seed.js', './js/seed-extras.js',
  './js/ui.js', './js/admin.js', './js/painel.js', './js/painel2.js', './js/cliente.js', './js/cliente2.js', './js/pwa.js', './js/main.js',
  './icones/app-192.png', './icones/app-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).catch(() => null).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(l => Promise.all(l.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(r => {
    if (r.ok) { const copia = r.clone(); caches.open(VERSAO).then(c => c.put(req, copia)); }
    return r;
  }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
});
// notificações enviadas pelo servidor (versão oficial)
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { corpo: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'BSFlow', { body: d.corpo || '', icon: d.icone, data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
    for (const c of lista) if (c.url === url && 'focus' in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
