import { expect, test } from "@playwright/test";
import { createTask, deleteTasksByTitle, myUserId, pinTask, readContext } from "./helpers";

const ctx = readContext();
const stamp = Date.now();

test.afterAll(async () => {
  await deleteTasksByTitle(ctx.accessToken, ctx.workspaceId, String(stamp));
});

test("หน้าทีมกำลังทำอะไร แสดงงาน focus ตามลำดับและจัดลำดับของตัวเองได้", async ({ page }) => {
  const userId = await myUserId(ctx.accessToken);
  const first = `Focus A ${stamp}`;
  const second = `Focus B ${stamp}`;
  const a = await createTask(ctx.accessToken, ctx.workspaceId, first, { assignee_id: userId, status: "in_progress" });
  const b = await createTask(ctx.accessToken, ctx.workspaceId, second, { assignee_id: userId, status: "todo" });
  await pinTask(ctx.accessToken, userId, a, 0);
  await pinTask(ctx.accessToken, userId, b, 1);

  await page.goto("/team", { waitUntil: "networkidle" });
  const items = page.getByTestId("focus-item").filter({ hasText: String(stamp) });
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText(first);

  await items.nth(0).getByLabel("Move down").click();
  await expect(items.nth(0)).toContainText(second);

  await items.nth(0).getByLabel("Remove from focus").click();
  await expect(items).toHaveCount(1);
});
