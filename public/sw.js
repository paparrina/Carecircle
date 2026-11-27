// CareCircle service worker — instalación PWA + estáticos + fallback offline
const CACHE = "carecircle-v1";
const PRECACHE = ["/offline.html", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Estáticos: cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/")
  ) {
    e.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          })
      )
    );
    return;
  }

  // Navegación: red primero, fallback offline
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request).catch(() => caches.match("/offline.html"))
    );
  }
});

self.addEventListener("push", (event) => {
  let payload;
  try { payload = event.data?.json(); } catch {}
  const match = typeof payload?.path === "string" &&
    /^\/app\/[a-f0-9-]{36}\/notifications$/.test(payload.path);
  event.waitUntil(self.registration.showNotification("CareCircle", {
    body: "Tienes un aviso nuevo. Abre la aplicación para consultarlo.",
    icon: "/icons/icon-192.png",
    tag: typeof payload?.tag === "string" ? payload.tag : "carecircle",
    data: { path: match ? payload.path : "/app" }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.path;
  const safe = typeof path === "string" && /^\/app\/[a-f0-9-]{36}\/notifications$/.test(path);
  const url = new URL(safe ? path : "/app", self.location.origin);
  event.waitUntil(self.clients.openWindow(url.href));
});
