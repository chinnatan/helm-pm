declare module "#app" {
  interface NuxtApp {
    $OneSignal?: unknown;
    $onesignalReady?: Promise<void>;
  }
}

export {};
