// Service worker de Brigada 2030.
// Guarda TODO el juego en el celular la primera vez, para que despues
// se pueda abrir sin internet. Lo genera hacer_version_movil.py.

const VERSION = "20261112-211315";
const CACHE = "brigada2030-" + VERSION;
const COMUNES = [["./", 18746], ["manifest.webmanifest", 645], ["favicon.png", 70281], ["icono-192.png", 70281], ["icono-512.png", 387003], ["icono-maskable.png", 264704], ["cdn/0.9.3/pythons.js", 69205], ["cdn/0.9.3/cpythonrc.py", 52063], ["cdn/0.9.3/empty.html", 14], ["cdn/0.9.3/empty.ogg", 4035], ["cdn/0.9.3/cpython312/main.js", 849985], ["cdn/0.9.3/cpython312/main.wasm", 13447111], ["cdn/0.9.3/cpython312/main.data", 6668609], ["cdn/index-0.9.3-cp312.json", 1374], ["cdn/vtx.js", 9887], ["cdn/vt/xterm.js", 283404], ["cdn/vt/xterm.css", 5383], ["cdn/vt/xterm-addon-image.js", 54544], ["cdn/cp312/pygame_ce-2.5.7-cp312-cp312-wasm32_bi_emscripten.whl", 1527290]];          // [archivo, bytes]
const ARCHIVO_TAR = ["juego_web.tar.gz", 67241360];
const ARCHIVO_APK = ["juego_web.apk", 67317914];          // itch.io usa este en vez del .tar.gz

const TIPOS = {
  js: "text/javascript", wasm: "application/wasm", html: "text/html",
  css: "text/css", json: "application/json", png: "image/png",
  ogg: "audio/ogg", webmanifest: "application/manifest+json",
};

function lista() {
  const itch = self.location.host.indexOf(".itch.zone") > 0;
  return COMUNES.concat([itch ? ARCHIVO_APK : ARCHIVO_TAR]);
}

async function avisar(msg) {
  const ventanas = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  for (const v of ventanas) v.postMessage(msg);
}

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const archivos = lista();
    const total = archivos.reduce((a, f) => a + f[1], 0);
    let llevo = 0, ultimo = 0;
    for (const [url, bytes] of archivos) {
      if (await cache.match(url)) { llevo += bytes; continue; }   // ya estaba (se corto antes)
      const res = await fetch(url, { cache: "reload" });
      if (!res.ok) throw new Error("No se pudo bajar " + url + " (" + res.status + ")");
      const lector = res.body.getReader();
      const partes = [];
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        partes.push(value);
        llevo += value.length;
        const ahora = Date.now();
        if (ahora - ultimo > 250) { ultimo = ahora; avisar({ tipo: "progreso", llevo, total }); }
      }
      const ext = url.split("?")[0].split(".").pop();
      const tipo = TIPOS[ext] || res.headers.get("content-type") || "application/octet-stream";
      await cache.put(url, new Response(new Blob(partes, { type: tipo }),
                                        { status: 200, headers: { "Content-Type": tipo } }));
    }
    avisar({ tipo: "progreso", llevo: total, total });
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const nombre of await caches.keys()) {
      if (nombre.startsWith("brigada2030-") && nombre !== CACHE) await caches.delete(nombre);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    let r = await cache.match(req, { ignoreSearch: true });
    if (!r && req.mode === "navigate") r = await cache.match("./");
    return r || fetch(req);
  })());
});
