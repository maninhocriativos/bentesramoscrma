// cache-bust: 2026-04-15T21:25:00Z
// ─── VERSÃO DO CACHE ────────────────────────────────────────────────────────
// Lê a versão do parâmetro ?v= usado no registro do SW; fallback manual
// mantém a possibilidade de forçar troca em emergências.
const SW_URL = new URL(self.location.href);
const BUILD_TS = SW_URL.searchParams.get("v") || "20260415_FORCE";
const CACHE_NAME = `bentes-ramos-crm-v${BUILD_TS}`;

const STATIC_ASSETS = ["/", "/manifest.json"];

// ─── INSTALL ────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  console.log("[SW] Instalando versão:", CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }),
  );
  // Força ativação imediata sem esperar abas fecharem
  self.skipWaiting();
});

// ─── ACTIVATE ───────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  console.log("[SW] Ativando versão:", CACHE_NAME);
  event.waitUntil(
    Promise.all([
      // Apaga TODOS os caches antigos (qualquer nome diferente do atual)
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log("[SW] Removendo cache antigo:", name);
              return caches.delete(name);
            }),
        ),
      ),
      // Assume controle de todas as abas abertas imediatamente
      self.clients.claim().then(() => {
        return self.clients.matchAll({ type: "window" }).then((clients) => {
          console.log("[SW] Notificando", clients.length, "aba(s) para recarregar");
          clients.forEach((client) => {
            client.postMessage({ type: "SW_UPDATED", version: BUILD_TS });
          });
        });
      }),
    ]),
  );
});

// ─── MENSAGENS DO APP ────────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ─── FETCH ──────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  // Ignora requisições não-GET
  if (event.request.method !== "GET") return;

  // Ignora requisições externas
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Ignora chamadas de API — sempre vai para a rede
  if (
    event.request.url.includes("/functions/") ||
    event.request.url.includes("/rest/") ||
    event.request.url.includes("/auth/") ||
    event.request.url.includes("supabase.co")
  )
    return;

  const url = new URL(event.request.url);

  // Assets com hash no nome (JS/CSS gerados pelo Vite) — são imutáveis, cache first
  const isHashedAsset = /\.[a-f0-9]{8,}\.(js|css)$/.test(url.pathname);

  if (isHashedAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      }),
    );
    return;
  }

  // Tudo mais (HTML, manifest, etc.) — network first, cache como fallback offline
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === "navigate") return caches.match("/");
          return new Response("Offline", { status: 503 });
        });
      }),
  );
});

// ─── PUSH NOTIFICATIONS ─────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  const options = {
    body: data.body || "Nova notificação",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [],
  };
  event.waitUntil(self.registration.showNotification(data.title || "Bentes Ramos CRM", options));
});

// ─── NOTIFICATION CLICK ──────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url === urlToOpen && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(urlToOpen);
    }),
  );
});
