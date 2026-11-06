// Lets Android install the app on the home screen (Chrome wants a service worker that answers
// requests). It deliberately saves nothing: every request goes straight to the network, so new
// versions arrive exactly as they do in the browser, and member data is never stored on the device.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => event.respondWith(fetch(event.request)));
