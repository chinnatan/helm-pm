/**
 * Recover from stuck service workers after PWA/OneSignal conflicts.
 * - Activate waiting vite-pwa SW (SKIP_WAITING)
 * - Reload once when a new controller takes over so clients get fresh assets
 */
export default defineNuxtPlugin({
  name: "pwa-sw-recovery",
  enforce: "pre",
  setup() {
    if (!import.meta.client || !("serviceWorker" in navigator)) return;

    const reloadKey = "helm-sw-reloaded";

    void navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        void reg.update().catch(() => {});
      }
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      try {
        if (sessionStorage.getItem(reloadKey)) return;
        sessionStorage.setItem(reloadKey, "1");
      } catch {
        // private mode / blocked storage — still reload once this session
      }
      window.location.reload();
    });
  },
});
