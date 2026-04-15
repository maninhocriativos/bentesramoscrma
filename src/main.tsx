import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ─── FORCE SW RESET ──────────────────────────────────────────────────────────
// Desregistra o SW antigo e limpa todos os caches ao detectar versão nova.
// Isso resolve o problema de usuários travados na versão antiga.
async function resetServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();

    for (const reg of registrations) {
      // Verifica se o SW ativo é o antigo (bentes-ramos-crm-v1)
      const sw = reg.active || reg.waiting || reg.installing;
      if (sw) {
        // Desregistra o SW antigo
        await reg.unregister();
        console.log("[App] SW antigo desregistrado");
      }
    }

    // Limpa TODOS os caches antigos
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith("bentes-ramos-crm-") && name !== `bentes-ramos-crm-v20260415_FORCE`)
        .map((name) => {
          console.log("[App] Removendo cache antigo:", name);
          return caches.delete(name);
        }),
    );

    // Se tinha SW antigo, recarrega para pegar a versão nova
    if (registrations.length > 0) {
      console.log("[App] Recarregando para versão nova...");
      // Usa replace para não adicionar ao histórico
      window.location.replace(window.location.href);
      return true; // indica que vai recarregar
    }
  } catch (err) {
    console.error("[App] Erro ao resetar SW:", err);
  }
  return false;
}

// Executa o reset antes de montar o app
resetServiceWorker().then((willReload) => {
  if (willReload) return; // não monta o app se vai recarregar

  // Registra o SW novo após montar
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }

  createRoot(document.getElementById("root")!).render(<App />);
});
