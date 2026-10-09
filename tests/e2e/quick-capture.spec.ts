import { expect, test } from "@playwright/test";
import { createCustomer, createFeature, deleteRows, deleteTasksByTitle, readContext } from "./helpers";

const ctx = readContext();
const stamp = Date.now();
const customerName = `QcCust${stamp}`;
const featureName = `QcFeat${stamp}`;
const ids: Record<string, string> = {};

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ids.customer = await createCustomer(ctx.accessToken, ctx.workspaceId, customerName);
  ids.feature = await createFeature(ctx.accessToken, ctx.workspaceId, featureName);
});

test.afterAll(async () => {
  await deleteTasksByTitle(ctx.accessToken, ctx.workspaceId, String(stamp));
  if (ids.feature) await deleteRows(ctx.accessToken, "features", ids.feature);
  if (ids.customer) await deleteRows(ctx.accessToken, "customers", ids.customer);
});

test("จดงานด่วนด้วย #tag ผูกลูกค้า/ฟีเจอร์และลง Inbox", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByTestId("quick-capture-open").click();
  await page.getByTestId("quick-capture-input").fill(`แก้ปุ่ม export ${stamp} #${customerName} #${featureName}`);
  await expect(page.getByTestId("quick-capture-chip")).toHaveCount(2);
  await page.getByTestId("quick-capture-save").click();

  await page.goto(`/tasks/list`, { waitUntil: "networkidle" });
  const row = page.getByTestId("task-row").filter({ hasText: `แก้ปุ่ม export ${stamp}` }).filter({ hasText: customerName });
  await expect(row).toBeVisible();
  await expect(row).toContainText(featureName);
  await expect(row).toContainText("Inbox");
});

test("จดงานไม่มี tag แล้วเจอใน ตัวกรอง 'ยังไม่ผูก' และ badge บนเมนู", async ({ page }) => {
  const title = `จดเฉย ๆ ${stamp}`;
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByTestId("quick-capture-open").click();
  await page.getByTestId("quick-capture-input").fill(title);
  await page.getByTestId("quick-capture-save").click();

  await expect(page.getByTestId("inbox-badge").first()).toBeVisible();
  await page.goto("/tasks/list?unlinked=1", { waitUntil: "networkidle" });
  await expect(page.getByTestId("task-row").filter({ hasText: title })).toBeVisible();
  // งานที่ผูกครบแล้วต้องไม่อยู่ในตัวกรองนี้
  await expect(page.getByTestId("task-row").filter({ hasText: `แก้ปุ่ม export ${stamp}` })).toHaveCount(0);
});

test("คีย์ลัด c เปิด Quick capture", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.keyboard.press("c");
  await expect(page.getByTestId("quick-capture-input")).toBeVisible();
});
