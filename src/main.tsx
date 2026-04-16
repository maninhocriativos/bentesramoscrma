import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ─── FORCE SW RESET ──────────────────────────────────────────────────────────
// Só desregistra o SW antigo (bentes-ramos-crm-v1).
// Não toca no SW novo. Não causa loop.
async function resetOldServiceWorker() {
  if (!("serviceWorker" in navigator)) return false;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    let foundOld = false;

    for (const reg of registrations) {
      const sw = reg.active || reg.waiting || reg.installing;
      if (!sw) continue;

      // Pega o script URL do SW para identificar se é antigo
      const swUrl = reg.scope;

      // Verifica nos caches se tem o cache antigo v1
      const cacheNames = await caches.keys();
      const hasOldCache = cacheNames.includes("bentes-ramos-crm-v1");

      if (hasOldCache) {
        foundOld = true;
        await reg.unregister();
        console.log("[App] SW antigo desregistrado");
      }
    }

    // Limpa caches antigos (só v1, não toca nos novos)
    const cacheNames = await caches.keys();
    const oldCaches = cacheNames.filter((n) => n === "bentes-ramos-crm-v1");

    if (oldCaches.length > 0) {
      await Promise.all(
        oldCaches.map((n) => {
          console.log("[App] Removendo cache antigo:", n);
          return caches.delete(n);
        }),
      );
      foundOld = true;
    }

    // Só recarrega se encontrou cache antigo — evita loop
    if (foundOld) {
      console.log("[App] Cache antigo removido, recarregando...");
      window.location.replace(window.location.href);
      return true;
    }
  } catch (err) {
    console.error("[App] Erro ao resetar SW:", err);
  }

  return false;
}

// Executa o reset e só monta o app se não vai recarregar
resetOldServiceWorker().then((willReload) => {
  if (willReload) return;

  // Registra o SW novo
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }

  createRoot(document.getElementById("root")!).render(<App />);
});
