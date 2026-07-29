import { useOneSignal } from "@onesignal/onesignal-vue3";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  if (!config.public.onesignalAppId) return;

  const nuxtApp = useNuxtApp();
  const user = useSupabaseUser();
  const os = useOneSignal();

  const sync = async (uid: string | undefined) => {
    if (!os?.login) return;
    try {
      const ready = nuxtApp.$onesignalReady as Promise<void> | undefined;
      if (ready) await ready;
      if (uid) await os.login(uid);
      else await os.logout();
    } catch (e) {
      console.warn("OneSignal auth sync failed", e);
    }
  };

  watch(
    () => user.value?.id,
    (id) => {
      void sync(id);
    },
    { immediate: true },
  );
});
