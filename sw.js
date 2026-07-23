/* 3D Print Craft Simulator — service worker
   Put this file next to your game HTML on the same host.
   It gives you two things at once:
     • the game keeps working with no connection
     • players get your newest build automatically, with patch notes

   Bump CACHE below whenever you upload a new build. That's the whole workflow.
*/
const CACHE = "printcraft-v3.2.0";

// Everything the game needs offline. The HTML is fully self-contained,
// so this list normally only ever has the page itself in it.
const ASSETS = [
  "./",
  "./index.html"
];

self.addEventListener("install", ev => {
  ev.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS).catch(() => {/* a missing path shouldn't block install */}))
  );
});

self.addEventListener("activate", ev => {
  ev.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* Network-first for pages: online players always land on the newest build,
   offline players fall straight back to the cached copy. */
self.addEventListener("fetch", ev => {
  const req = ev.request;
  if (req.method !== "GET") return;

  const isPage = req.mode === "navigate" ||
                 (req.headers.get("accept") || "").includes("text/html");

  if (isPage) {
    ev.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(CACHE);
        c.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match(req) || await caches.match("./index.html") || await caches.match("./");
        return cached || new Response("Offline and nothing cached yet.", {
          status: 503, headers: { "Content-Type": "text/plain" }
        });
      }
    })());
    return;
  }

  // Everything else: cache first, then network.
  ev.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === "basic") {
        const c = await caches.open(CACHE);
        c.put(req, res.clone());
      }
      return res;
    } catch (e) {
      return new Response("", { status: 504 });
    }
  })());
});

/* The game calls this when the player taps "Install & restart". */
self.addEventListener("message", ev => {
  if (ev.data && ev.data.type === "SKIP_WAITING") self.skipWaiting();
});
