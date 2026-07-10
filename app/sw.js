// Service worker "kill-switch": el SW anterior tenía un bug (respondía con
// undefined en un fetch fallido → "Failed to convert value to 'Response'") y
// servía contenido viejo. Este lo reemplaza, borra todas las cachés, se
// desregistra solo y recarga las pestañas abiertas. No intercepta fetch, así
// que nunca sirve nada cacheado. Si más adelante querés PWA offline de verdad,
// se arma uno nuevo (estilo Workbox).
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.navigate(client.url);
    }
  })());
});
