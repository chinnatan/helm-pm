import { expect, test } from "@playwright/test";
import {
  createCommitment,
  createCustomer,
  createFeature,
  createRollout,
  createTask,
  deleteRows,
  readContext,
} from "./helpers";
import { addMonths, toMonthStart } from "../../app/utils/rollout";

const ctx = readContext();
const stamp = Date.now();
const customerName = `E2E Cust ${stamp}`;
const featureName = `E2E Feat ${stamp}`;
const ids: Record<string, string> = {};
// เดือนต้องอยู่ในช่วง 6 เดือนที่ matrix แสดง ไม่งั้นชิปหลุดจอและเทสต่อไปหาไม่เจอ
const rescheduledMonth = addMonths(toMonthStart(new Date()), 1);
const laterMonth = addMonths(toMonthStart(new Date()), 2);
const monthText = (m: string) =>
  new Date(`${m}T00:00:00`).toLocaleDateString("en", { month: "long", year: "numeric" });

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ids.customer = await createCustomer(ctx.accessToken, ctx.workspaceId, customerName);
  ids.feature = await createFeature(ctx.accessToken, ctx.workspaceId, featureName);
  ids.rollout = await createRollout(ctx.accessToken, ctx.workspaceId, ids.customer, ids.feature);
  ids.commitment = await createCommitment(ctx.accessToken, ids.rollout, toMonthStart(new Date()));
});

test.afterAll(async () => {
  if (ids.task) await deleteRows(ctx.accessToken, "tasks", ids.task);
  if (ids.rollout) await deleteRows(ctx.accessToken, "rollouts", ids.rollout);
  if (ids.feature) await deleteRows(ctx.accessToken, "features", ids.feature);
  if (ids.customer) await deleteRows(ctx.accessToken, "customers", ids.customer);
});

test("เมทริกซ์แสดง Rollout ของลูกค้าตามเดือนที่สัญญา", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("row", { name: new RegExp(customerName) })).toBeVisible();
  await expect(page.getByRole("button", { name: featureName })).toBeVisible();
});

test("เลื่อนเดือน Commitment ต้องมีเหตุผล และเห็นประวัติ", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: featureName }).click();
  await page.getByLabel("Reschedule").click();
  await page.locator('input[type="month"]').first().fill(rescheduledMonth.slice(0, 7));

  const save = page.getByRole("button", { name: "Save" });
  await expect(save).toBeDisabled();
  await page.getByPlaceholder("Reason for rescheduling").fill("Customer asked to wait");
  await save.click();

  await expect(page.getByText("Customer asked to wait")).toBeVisible();
});

test("เพิ่ม Commitment ที่สถานะถอยหลังต้องเห็นคำเตือนแต่ยังบันทึกได้", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: featureName }).first().click();

  // ต่อจากเทสก่อนหน้า: Commitment production ถูกเลื่อนไปเดือนหน้า
  await page.locator('input[type="month"]').last().fill(laterMonth.slice(0, 7));
  await page.getByRole("combobox").last().click();
  await page.getByRole("option", { name: "Developing" }).click();
  await expect(page.getByText("Status goes backwards")).toBeVisible();

  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText(monthText(laterMonth))).toBeVisible();
});

test("งานที่ไม่ผูกลูกค้า/ฟีเจอร์ถูกนับเป็น 'ยังไม่ผูก'", async ({ page }) => {
  ids.task = await createTask(ctx.accessToken, ctx.workspaceId, `E2E unlinked ${stamp}`, { status: "inbox" });
  await page.goto("/");
  await expect(page.getByText(/open tasks are not linked/)).toBeVisible();
});

test("ลบ Rollout จาก panel: dialog ยืนยันต้องอยู่เหนือ slideover และกดได้", async ({ page }) => {
  const delCustomer = `E2E Del Cust ${stamp}`;
  const delFeature = `E2E Del Feat ${stamp}`;
  const customer = await createCustomer(ctx.accessToken, ctx.workspaceId, delCustomer);
  const feature = await createFeature(ctx.accessToken, ctx.workspaceId, delFeature);
  const rollout = await createRollout(ctx.accessToken, ctx.workspaceId, customer, feature);

  try {
    await page.goto("/");
    await page.getByRole("button", { name: delFeature }).click();
    await page.getByRole("button", { name: "Delete rollout" }).click();
    await page.getByTestId("confirm-ok").click();

    await expect(page.getByRole("button", { name: delFeature })).toHaveCount(0);
  } finally {
    await deleteRows(ctx.accessToken, "rollouts", rollout);
    await deleteRows(ctx.accessToken, "features", feature);
    await deleteRows(ctx.accessToken, "customers", customer);
  }
});
