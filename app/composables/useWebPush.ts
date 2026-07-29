import { useOneSignal } from "@onesignal/onesignal-vue3";

const INIT_TIMEOUT_MS = 20_000;
const SUBSCRIBE_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export function useOneSignalClient() {
  const config = useRuntimeConfig();
  if (!config.public.onesignalAppId) return null;
  if (import.meta.server) return null;
  return useOneSignal();
}

function readBrowserPushSubscribed(os: ReturnType<typeof useOneSignal>): boolean {
  const optedIn = os.User?.PushSubscription?.optedIn;
  if (optedIn === true) return true;

  const hasSubscription = Boolean(
    os.User?.PushSubscription?.id || os.User?.PushSubscription?.token,
  );
  if (hasSubscription) return true;

  if (os.Notifications?.permission === true) return true;

  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    return true;
  }

  return false;
}

export function useWebPush() {
  const nuxtApp = useNuxtApp();
  const config = useRuntimeConfig();
  const configured = computed(() => !!config.public.onesignalAppId);
  const subscribed = useState<boolean | null>("helm:web-push-subscribed", () => null);

  const browserPushEnabled = computed(() => subscribed.value === true);

  async function ensureOneSignalReady() {
    const ready = nuxtApp.$onesignalReady as Promise<void> | undefined;
    if (!ready) return;
    await withTimeout(ready, INIT_TIMEOUT_MS, "onesignal_init_timeout");
  }

  async function refreshSubscriptionState() {
    if (!configured.value) {
      subscribed.value = null;
      return;
    }
    try {
      await ensureOneSignalReady();
    } catch {
      subscribed.value = null;
      return;
    }
    const os = useOneSignalClient();
    if (!os?.User?.PushSubscription) {
      subscribed.value = null;
      return;
    }
    subscribed.value = readBrowserPushSubscribed(os);
  }

  async function requestPushPermission() {
    if (!configured.value) return { error: "not_configured" as const };

    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      return { error: "permission_denied" as const };
    }

    const os = useOneSignalClient();
    if (!os) return { error: "not_configured" as const };

    try {
      await ensureOneSignalReady();

      const subscribe = async () => {
        if (os.User?.PushSubscription?.optIn) {
          await os.User.PushSubscription.optIn();
          return;
        }
        await os.Notifications?.requestPermission?.();
      };

      await withTimeout(subscribe(), SUBSCRIBE_TIMEOUT_MS, "onesignal_subscribe_timeout");
      await refreshSubscriptionState();
      if (subscribed.value !== true) {
        subscribed.value = readBrowserPushSubscribed(os);
      }
      return { error: undefined };
    } catch (e) {
      const message = e instanceof Error ? e.message : "permission_failed";
      if (/can only be used on/i.test(message)) {
        return { error: "wrong_site" as const };
      }
      if (message === "onesignal_init_timeout" || message === "onesignal_subscribe_timeout") {
        return { error: "sdk_timeout" as const };
      }
      return { error: message };
    }
  }

  function attachSubscriptionListener() {
    const os = useOneSignalClient();
    if (!os?.User?.PushSubscription?.addEventListener) return;
    os.User.PushSubscription.addEventListener("change", () => {
      void refreshSubscriptionState();
    });
  }

  if (import.meta.client) {
    onMounted(() => {
      if (!configured.value) return;
      void refreshSubscriptionState();
      void ensureOneSignalReady()
        .then(() => attachSubscriptionListener())
        .catch(() => {});
    });
  }

  return {
    configured,
    subscribed,
    browserPushEnabled,
    refreshSubscriptionState,
    requestPushPermission,
  };
}
