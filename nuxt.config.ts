import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";

// frappe-gantt exports CSS only via the "style" condition on ".", not as ./dist/*.css
const frappeGanttCss = fileURLToPath(
  new URL("./node_modules/frappe-gantt/dist/frappe-gantt.css", import.meta.url),
);

export default defineNuxtConfig({
  compatibilityDate: "2025-05-01",
  devtools: { enabled: true },

  typescript: {
    tsConfig: {
      exclude: ["../workers/**"],
    },
  },

  modules: ["@nuxt/ui", "@nuxtjs/supabase", "@nuxtjs/i18n", "@vite-pwa/nuxt"],

  i18n: {
    locales: [
      { code: "th", language: "th-TH", name: "ไทย", file: "th.json" },
      { code: "en", language: "en-US", name: "English", file: "en.json" },
    ],
    defaultLocale: "th",
    strategy: "no_prefix",
    langDir: "locales",
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "helm_locale",
      fallbackLocale: "th",
      redirectOn: "root",
    },
  },

  css: ["~/assets/css/main.css"],

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "frappe-gantt/dist/frappe-gantt.css": frappeGanttCss,
      },
    },
  },

  dir: {
    app: "app",
  },

  future: {
    compatibilityVersion: 4,
  },

  experimental: {
    appManifest: false,
  },

  app: {
    head: {
      title: "Helm",
      meta: [
        { charset: "utf-8" },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        },
        { name: "description", content: "Project Management — steer the ship" },
        { name: "theme-color", content: "#0B6E7A" },
      ],
      link: [
        {
          rel: "preconnect",
          href: "https://fonts.googleapis.com",
        },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap",
        },
      ],
    },
  },

  devServer: {
    port: Number(process.env.NUXT_DEV_PORT || 5100),
  },

  runtimeConfig: {
    public: {
      appUrl: process.env.NUXT_PUBLIC_APP_URL || "http://localhost:5100",
    },
  },

  pwa: {
    registerType: "autoUpdate",
    // Pick up new SW even when the tab stays open a long time (capacity page etc.).
    client: {
      periodicSyncForUpdates: 3600,
    },
    devOptions: {
      enabled: false,
    },
    manifest: {
      name: "Helm PM",
      short_name: "Helm",
      description: "Project Management — steer the ship",
      theme_color: "#0B6E7A",
      background_color: "#ffffff",
      display: "standalone",
      start_url: "/",
      icons: [
        {
          src: "/icon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any maskable",
        },
      ],
    },
    workbox: {
      // Override vite-plugin-pwa default ("index.html"). Nuxt SSR on Cloudflare
      // does not precache "/" or "index.html", so createHandlerBoundToURL throws
      // non-precached-url and the new SW stays "waiting", blocking app updates.
      navigateFallback: undefined,
      // Activate immediately so updates are not stuck behind an open tab.
      skipWaiting: true,
      clientsClaim: true,
      cleanupOutdatedCaches: true,
    },
  },

  routeRules: {
    // Auth callback must run on the client so Supabase can read ?code= / hash tokens.
    "/confirm": { ssr: false },
  },

  supabase: {
    redirect: false,
    types: "~/types/database",
    redirectOptions: {
      login: "/login",
      callback: "/confirm",
      exclude: ["/login", "/confirm"],
    },
  },

  nitro: {
    preset: "cloudflare_pages",
  },

  colorMode: {
    preference: "light",
  },
});
