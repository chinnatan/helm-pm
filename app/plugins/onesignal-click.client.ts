import { useOneSignal } from "@onesignal/onesignal-vue3";

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  if (!config.public.onesignalAppId) return;

  const os = useOneSignal();

  nuxtApp.hook("app:mounted", () => {
    const client = os as {
      Notifications?: {
        addEventListener: (
          event: "click",
          handler: (event: { result?: { url?: string } }) => void,
        ) => void;
      };
    };
    client?.Notifications?.addEventListener("click", (event) => {
      const url = event.result?.url;
      if (!url) return;
      if (url.startsWith("/")) void navigateTo(url);
      else window.location.assign(url);
    });
  });
});
