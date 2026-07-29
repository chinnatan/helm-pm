// KEEP until 2027-07-29: Existing subscribers may still reference this root URL.
// New registrations use /push/onesignal/OneSignalSDKWorker.js (narrow scope) so
// OneSignal does not conflict with the vite-pwa root service worker.
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
