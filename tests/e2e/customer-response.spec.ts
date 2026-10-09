import { expect, test } from "@playwright/test";
import {
  createCommitment,
  createCustomer,
  createFeature,
  createRollout,
  createTask,
  deleteRows,
  deleteTasksByTitle,
  listShareTokens,
  readContext,
} from "./helpers";
import { toMonthStart } from "../../app/utils/rollout";

const ctx = readContext();
const stamp = Date.now();
const customerName = `RespCust${stamp}`;
const featureName = `Resp Feature ${stamp}`;
const visibleTitle = `ขอปุ่ม export ${stamp}`;
const internalTitle = `บั๊กภายใน ${stamp}`;
const ids: Record<string, string> = {};

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ids.customer = await createCustomer(ctx.accessToken, ctx.workspaceId, customerName);
  ids.feature = await createFeature(ctx.accessToken, ctx.workspaceId, featureName);
  ids.rollout = await createRollout(ctx.accessToken, ctx.workspaceId, ids.customer, ids.feature);
  await createCommitment(ctx.accessToken, ids.rollout, toMonthStart(new Date()));
  const base = { customer_id: ids.customer, feature_id: ids.feature, task_type: "customer-request" };
  await createTask(ctx.accessToken, ctx.workspaceId, visibleTitle, base);
  await createTask(ctx.accessToken, ctx.workspaceId, internalTitle, { ...base, customer_visible: false });
});

test.afterAll(async () => {
  await deleteTasksByTitle(ctx.accessToken, ctx.workspaceId, String(stamp));
  if (ids.rollout) await deleteRows(ctx.accessToken, "rollouts", ids.rollout);
  if (ids.feature) await deleteRows(ctx.accessToken, "features", ids.feature);
  if (ids.customer) await deleteRows(ctx.accessToken, "customers", ids.customer);
});

test("ตอบคำขอลูกค้าใน TaskModal แล้วหายจากตัวกรอง 'ยังไม่ตอบ'", async ({ page }) => {
  await page.goto(`/tasks/list?customer=${ids.customer}&unanswered=1`, { waitUntil: "networkidle" });
  const row = page.getByTestId("task-row").filter({ hasText: visibleTitle });
  await expect(row).toBeVisible();
  await expect(row.getByTestId("response-cell")).toContainText("Not answered");

  await row.click();
  await page.getByTestId("response-status").click();
  await page.getByRole("option", { name: "Accepted" }).click();
  await page.getByTestId("response-text").fill("พัฒนาเพิ่มให้ครับ");
  await page.getByTestId("task-save").click();

  await expect(page.getByTestId("task-row").filter({ hasText: visibleTitle })).toHaveCount(0);
  await page.goto(`/tasks/list?customer=${ids.customer}`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("task-row").filter({ hasText: visibleTitle }).getByTestId("response-cell")).toContainText("Accepted");
});

test("Issue Log ฉบับลูกค้าซ่อนรายการภายใน ฉบับภายในเห็นครบ", async ({ page }) => {
  await page.goto(`/customers/${ids.customer}/issue-log`, { waitUntil: "networkidle" });
  const preview = page.getByTestId("issuelog-preview");
  await expect(preview).toContainText(`Q: #Resp_Feature_${stamp} ${visibleTitle}`);
  await expect(preview).toContainText("A: พัฒนาเพิ่มให้ครับ");
  await expect(preview).not.toContainText(internalTitle);

  await page.getByTestId("issuelog-for-customer").click();
  await expect(preview).toContainText(internalTitle);
});

test("ลิงก์แชร์: ลูกค้าเปิดได้โดยไม่ login เห็นเฉพาะข้อมูลที่เปิดให้ และเพิกถอนแล้วเปิดไม่ได้", async ({ page, browser }) => {
  await page.goto(`/customers/${ids.customer}`, { waitUntil: "networkidle" });
  await page.getByTestId("share-create").click();
  await expect(page.getByTestId("share-link-row")).toHaveCount(1);

  const [token] = await listShareTokens(ctx.accessToken, ids.customer!);
  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const anonPage = await anon.newPage();
  await anonPage.goto(`/share/${token}`, { waitUntil: "networkidle" });
  await expect(anonPage.getByTestId("share-customer")).toContainText(customerName);
  await expect(anonPage.getByTestId("share-month")).toContainText(featureName);
  await expect(anonPage.getByTestId("share-request")).toHaveCount(1);
  await expect(anonPage.getByTestId("share-request")).toContainText(visibleTitle);
  await expect(anonPage.getByText(internalTitle)).toHaveCount(0);

  await page.getByTestId("share-revoke").click();
  await page.getByTestId("confirm-ok").click();
  await expect(page.getByTestId("share-link-row")).toHaveCount(0);

  await anonPage.reload({ waitUntil: "networkidle" });
  await expect(anonPage.getByTestId("share-invalid")).toBeVisible();
  await anon.close();
});

test("token มั่ว เปิดหน้า share ไม่ได้", async ({ browser }) => {
  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const p = await anon.newPage();
  await p.goto("/share/not-a-real-token", { waitUntil: "networkidle" });
  await expect(p.getByTestId("share-invalid")).toBeVisible();
  await anon.close();
});
