import { defineConfig, devices } from "@playwright/test";
import { STORAGE_STATE, supabaseLocal } from "./tests/e2e/helpers";

const sb = supabaseLocal();
// dedicated port so e2e never reuses a dev server pointing at another Supabase project
const port = Number(process.env.E2E_PORT || 5200);
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results/",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report/", open: "never" }]],
  use: {
    baseURL,
  },
  projects: [
    {
      name: "setup",
      testMatch: /setup\.spec\.ts/,
      use: { storageState: undefined },
    },
    {
      name: "e2e",
      dependencies: ["setup"],
      testIgnore: /setup\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
    },
  ],
  webServer: {
    command: `bun run dev --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      SUPABASE_URL: sb.url,
      SUPABASE_KEY: sb.key,
      NUXT_SUPABASE_URL: sb.url,
      NUXT_SUPABASE_KEY: sb.key,
      NUXT_VITE_CACHE_DIR: "node_modules/.vite-e2e",
    },
  },
});
