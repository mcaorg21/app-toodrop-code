// Minimal service worker: exists only to satisfy PWA installability
// criteria (a registered service worker with a fetch handler).
// It does not cache anything — every request passes straight to the
// network so the app never serves stale data.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {});
