// Minimal service worker required for PWA installability.
// No caching — the app relies on Firebase/React Query for data.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch', () => {});
