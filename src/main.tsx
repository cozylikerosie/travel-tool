import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./app/App";
import "./styles/tailwind.css";

registerSW({ immediate: true });

// 本機開發時，網址加上 ?demo 會載入範例旅程；正式建置會移除這段
async function loadDemoDataIfRequested() {
  if (!import.meta.env.DEV || !new URLSearchParams(window.location.search).has("demo")) return;
  const [{ seedDemoData }, { tripDatabase }] = await Promise.all([import("./dev/demoData"), import("./data/database")]);
  await seedDemoData(tripDatabase);
  window.history.replaceState(null, "", window.location.pathname);
}

void loadDemoDataIfRequested().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
