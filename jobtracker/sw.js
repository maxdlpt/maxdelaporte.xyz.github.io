self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Intentionally no-op for now.
  // The legacy static service worker cached CDN React/Babel assets, which no longer exist after the Vite migration.
});
