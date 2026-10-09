import { expect, test } from "@playwright/test";

const name = `E2E Feature ${Date.now()}`;

test("เพิ่มและ archive ฟีเจอร์ผ่านหน้า settings", async ({ page }) => {
  await page.goto("/settings/features", { waitUntil: "networkidle" });
  await page.getByPlaceholder(/Feature name/).fill(name);
  await page.getByRole("button", { name: "Add" }).click();
  const item = page.getByRole("listitem").filter({ hasText: name });
  await expect(item).toBeVisible();

  await item.getByLabel("Archive").click();
  await page.getByTestId("confirm-ok").click();
  await expect(item).toBeHidden();
});
