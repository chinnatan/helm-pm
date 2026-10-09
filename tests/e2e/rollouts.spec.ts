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
import { toMonthStart } from "../../app/utils/rollout";

const ctx = readContext();
const stamp = Date.now();
const customerName = `E2E Cust ${stamp}`;
const featureName = `E2E Feat ${stamp}`;
const ids: Record<string, string> = {};

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
  await page.locator('input[type="month"]').first().fill("2030-01");

  const save = page.getByRole("button", { name: "Save" });
  await expect(save).toBeDisabled();
  await page.getByPlaceholder("Reason for rescheduling").fill("Customer asked to wait");
  await save.click();

  await expect(page.getByText("Customer asked to wait")).toBeVisible();
});

test("งานที่ไม่ผูกลูกค้า/ฟีเจอร์ถูกนับเป็น 'ยังไม่ผูก'", async ({ page }) => {
  ids.task = await createTask(ctx.accessToken, ctx.workspaceId, `E2E unlinked ${stamp}`, { status: "inbox" });
  await page.goto("/");
  await expect(page.getByText(/open tasks are not linked/)).toBeVisible();
});
