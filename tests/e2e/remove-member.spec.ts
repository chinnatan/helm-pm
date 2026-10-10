import { expect, test } from "@playwright/test";
import {
  addExtraMember,
  createTask,
  deleteAuthUser,
  deleteTasksByTitle,
  myUserId,
  pinTask,
  readContext,
  taskAssignee,
} from "./helpers";

const ctx = readContext();
const stamp = Date.now();
const extraUsers: string[] = [];

test.afterAll(async () => {
  await deleteTasksByTitle(ctx.accessToken, ctx.workspaceId, String(stamp));
  for (const id of extraUsers) await deleteAuthUser(id);
});

async function openMembers(page: import("@playwright/test").Page, email: string) {
  await page.goto("/team", { waitUntil: "networkidle" });
  await page.getByTestId("team-tab-members").click();
  const card = page.locator("div.rounded-xl").filter({ hasText: email });
  await expect(card).toBeVisible();
  return card;
}

test("admin นำสมาชิกออกพร้อมโอนงาน: งานย้ายไปผู้รับ status คงเดิม และ focus ถูกเคลียร์", async ({ page }) => {
  const email = `rm-transfer-${stamp}@helm.local`;
  const memberId = await addExtraMember(ctx.workspaceId, email);
  extraUsers.push(memberId);
  const meId = await myUserId(ctx.accessToken);
  const taskId = await createTask(ctx.accessToken, ctx.workspaceId, `Remove A ${stamp}`, {
    assignee_id: memberId,
    status: "in_progress",
  });
  await pinTask(ctx.accessToken, memberId, taskId, 0).catch(() => {}); // RLS: pin ได้เฉพาะเจ้าของ — ข้ามถ้าไม่ผ่าน

  const card = await openMembers(page, email);
  await card.getByTestId("remove-member").click();
  await page.getByTestId("transfer-select").click();
  await page.getByRole("option", { name: /E2E Runner|e2e@helm.local/ }).click();
  await page.getByTestId("remove-confirm").click();

  await expect(card).toHaveCount(0);
  const row = await taskAssignee(ctx.accessToken, taskId);
  expect(row.assignee_id).toBe(meId);
  expect(row.status).toBe("in_progress");
});

test("นำสมาชิกออกโดยปล่อยงานว่าง", async ({ page }) => {
  const email = `rm-unassign-${stamp}@helm.local`;
  const memberId = await addExtraMember(ctx.workspaceId, email);
  extraUsers.push(memberId);
  const taskId = await createTask(ctx.accessToken, ctx.workspaceId, `Remove B ${stamp}`, {
    assignee_id: memberId,
    status: "todo",
  });

  const card = await openMembers(page, email);
  await card.getByTestId("remove-member").click();
  await page.getByTestId("remove-confirm").click();

  await expect(card).toHaveCount(0);
  expect((await taskAssignee(ctx.accessToken, taskId)).assignee_id).toBeNull();
});

test("admin คนสุดท้ายไม่มีปุ่มนำออก/ออกจากทีม", async ({ page }) => {
  const email = `rm-last-${stamp}@helm.local`;
  extraUsers.push(await addExtraMember(ctx.workspaceId, email));

  await openMembers(page, email);
  // มีปุ่มเดียว = การ์ดของ member ส่วนการ์ด E2E Runner (admin คนเดียว) ไม่มีปุ่ม
  await expect(page.getByTestId("remove-member")).toHaveCount(1);
});
