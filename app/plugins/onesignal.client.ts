import { useOneSignal } from "@onesignal/onesignal-vue3";

function scriptPath(reg: ServiceWorkerRegistration): string {
  const scriptURL =
    reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || "";
  try {
    return new URL(scriptURL).pathname;
  } catch {
    return "";
  }
}

/**
 * Drop legacy root-scoped OneSignal SW so it no longer fights vite-pwa's sw.js.
 * Also nudge any waiting root SW (vite-pwa) so updates are not stuck behind
 * "waiting to activate" after OneSignal/PWA churn.
 */
async function cleanupConflictingServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();

  await Promise.all(
    regs.map(async (reg) => {
      const path = scriptPath(reg);
      const isLegacyOneSignal =
        path === "/OneSignalSDKWorker.js" ||
        (path.includes("OneSignalSDKWorker.js") && reg.scope.endsWith("/") && !reg.scope.includes("/push/onesignal"));

      if (isLegacyOneSignal) {
        try {
          await reg.unregister();
        } catch {
          // ignore
        }
        return;
      }

      // vite-pwa autoUpdate: activate waiting sw.js immediately
      if (path.endsWith("/sw.js") && reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    }),
  );
}

export default defineNuxtPlugin({
  name: "onesignal-init",
  enforce: "pre",
  setup() {
    const config = useRuntimeConfig();
    const appId = config.public.onesignalAppId as string;
    if (!appId) {
      // Still clean up legacy OneSignal SW even when push is not configured
      void cleanupConflictingServiceWorkers();
      return { provide: { onesignalReady: Promise.resolve() } };
    }

    const os = useOneSignal();
    // Scope under /push/onesignal/ so OneSignal does not fight vite-pwa's root sw.js
    // (two SWs at "/" + registerType autoUpdate → reload loops / stuck waiting).
    const ready = cleanupConflictingServiceWorkers()
      .then(() =>
        os.init({
          appId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/push/onesignal/" },
        }),
      )
      .catch((err: unknown) => {
        console.error("[OneSignal] init failed", err);
        throw err;
      });

    return { provide: { onesignalReady: ready } };
  },
});
