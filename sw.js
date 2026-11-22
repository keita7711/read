/* FOMO desk service worker: app-shell cache (never caches /api or data), web push display. */
var CACHE = "desk-shell-v14-design2";
var SHELL = ["./", "index.html", "app.css", "app.js", "chart.js", "links.js", "manifest.json", "apple-touch-icon.png"];
self.addEventListener("install", function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).catch(function () {})); self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || /\/api\/|\/d\/|\.json$|\.jpg$/.test(u.pathname) && !/manifest\.json$/.test(u.pathname)) return;
  e.respondWith(fetch(e.request).then(function (r) { var c = r.clone(); caches.open(CACHE).then(function (x) { x.put(e.request, c); }); return r; })
    .catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match("index.html"); }); }));
});
/* Push payload: {title:"Grok Bot", body:"Bought X · $N · Executor", url:<FOMO link from links.py>, icon:<coin logo>} */
self.addEventListener("push", function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Grok Bot", {
    body: d.body || "", icon: d.icon || "icons/icon-192.png", badge: "icons/icon-192.png",
    data: { url: d.url || "./" }, actions: d.url ? [{ action: "fomo", title: "FOMO" }] : []
  }));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(self.clients.openWindow((e.notification.data && e.notification.data.url) || "./"));
});
