import { useOneSignal } from "@onesignal/onesignal-vue3";

/** Drop legacy root-scoped OneSignal SW so it no longer fights vite-pwa's sw.js. */
async function unregisterLegacyOneSignalWorker() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs.map(async (reg) => {
      const scriptURL =
        reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || "";
      try {
        const path = new URL(scriptURL).pathname;
        if (path === "/OneSignalSDKWorker.js") {
          await reg.unregister();
        }
      } catch {
        // ignore malformed script URLs
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
      return { provide: { onesignalReady: Promise.resolve() } };
    }

    const os = useOneSignal();
    // Scope under /push/onesignal/ so OneSignal does not fight vite-pwa's root sw.js
    // (two SWs at "/" + registerType autoUpdate → reload loops).
    const ready = unregisterLegacyOneSignalWorker()
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
