import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Sinaliza ao kill-switch do index.html que o app montou com sucesso
if (typeof window !== "undefined") {
  (window as any).__APP_MOUNTED__ = true;
  if (typeof (window as any).__CLEAR_WATCHDOG__ === "function") {
    (window as any).__CLEAR_WATCHDOG__();
  }
}
