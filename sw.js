/* ============================================================
   sw.js — service worker: offline app shell + map tile caching
   ============================================================ */
const VERSION = "tds-v1";
const SHELL = "shell-" + VERSION;
const TILES_CACHE = "osm-tiles";

const SHELL_ASSETS = [
  "./", "./index.html", "./manifest.webmanifest",
  "./css/styles.css",
  "./js/config.js", "./js/data.js", "./js/weather.js",
  "./js/radar.js", "./js/map.js", "./js/app.js",
  "./data/route.json", "./data/ferries.json",
  "./assets/leaflet/leaflet.js", "./assets/leaflet/leaflet.css",
  "./assets/leaflet/images/marker-icon.png",
  "./assets/leaflet/images/marker-icon-2x.png",
  "./assets/leaflet/images/marker-shadow.png",
  "./assets/leaflet/images/layers.png",
  "./assets/leaflet/images/layers-2x.png",
  "./assets/icons/icon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL).then(c => c.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== SHELL && k !== TILES_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

function isTile(url){
  return /(^|\.)tile\.openstreetmap\.org$/.test(url.hostname) ||
         /(^|\.)tile\.opentopomap\.org$/.test(url.hostname);
}
function isLiveFMI(url){
  return url.hostname === "opendata.fmi.fi" || url.hostname === "openwms.fmi.fi";
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // FMI weather + radar are always live — never cache (would go stale).
  if (isLiveFMI(url)) return; // let it hit the network normally

  // Map tiles: cache-first (so visited / pre-downloaded areas work offline).
  if (isTile(url)) {
    e.respondWith(
      caches.open(TILES_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          cache.put(req, res.clone());
          return res;
        } catch (err) {
          return hit || Response.error();
        }
      })
    );
    return;
  }

  // Same-origin app shell: cache-first, fall back to network, update cache.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => {
        if (hit) {
          // refresh in background
          fetch(req).then(res => { if(res.ok) caches.open(SHELL).then(c=>c.put(req,res)); }).catch(()=>{});
          return hit;
        }
        return fetch(req).then((res) => {
          if (res.ok) caches.open(SHELL).then(c => c.put(req, res.clone()));
          return res;
        }).catch(() => caches.match("./index.html"));
      })
    );
  }
});
