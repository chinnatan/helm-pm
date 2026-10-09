import { expect, test as setup } from "@playwright/test";
import {
  E2E_EMAIL,
  E2E_PASSWORD,
  STORAGE_STATE,
  ensureWorkspace,
  ensureUser,
  loginViaUI,
  saveContext,
} from "./helpers";

setup("prepare e2e account, workspace and session", async ({ page }) => {
  const token = await ensureUser();
  const workspaceId = await ensureWorkspace(token);

  await loginViaUI(page, E2E_EMAIL, E2E_PASSWORD);

  await page.context().storageState({ path: STORAGE_STATE });
  saveContext({ workspaceId, accessToken: token });
});
