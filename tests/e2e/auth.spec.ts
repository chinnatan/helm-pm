import { expect, test } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD, fillLoginForm, loginViaUI } from "./helpers";

test.describe("login flow", () => {
  // เทสต์กลุ่มนี้เริ่มจากสถานะยังไม่มี session เพื่อยืนยัน UI login จริง
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login ด้วย email+password ผ่าน UI form แล้วเข้าระบบได้", async ({ page }) => {
    await loginViaUI(page, E2E_EMAIL, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/(planner|projects|dashboard|team|audit|customers|invite)/);
  });

  test("login ผิดพลาด — แสดง alert error และค้างที่หน้า login", async ({ page }) => {
    for (let i = 0; ; i++) {
      await page.goto("/login", { waitUntil: "networkidle" });
      await fillLoginForm(page, E2E_EMAIL, "definitely-wrong-password");
      await page.locator('button[type="submit"]').click();
      try {
        await expect(page.getByText("Invalid login credentials")).toBeVisible({ timeout: 10_000 });
        break;
      } catch (err) {
        // cold-cache vite reload อาจ wipe ฟอร์มก่อน submit (dev-only) — retry
        if (i >= 2) throw err;
      }
    }
    await expect(page).toHaveURL(/\/login/);
  });
});
