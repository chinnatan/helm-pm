import { useOneSignal } from "@onesignal/onesignal-vue3";

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
    const ready = os
      .init({
        appId,
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerPath: "/OneSignalSDKWorker.js",
      })
      .catch((err: unknown) => {
        console.error("[OneSignal] init failed", err);
        throw err;
      });

    return { provide: { onesignalReady: ready } };
  },
});
