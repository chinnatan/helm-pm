import { expect, test } from "@playwright/test";
import { createTask, deleteTask, readContext, taskCard } from "./helpers";

const boardUrl = () => `/projects/${readContext().projectId}/board`;
const stamp = Date.now();
const titleA = `E2E dep A ${stamp}`;
const titleB = `E2E dep B ${stamp}`;
let idA = "";
let idB = "";

test("เพิ่ม dependency ผ่าน UI แล้ว badge blocked ปรากฏบนงานที่รอ", async ({ page }) => {
  const ctx = readContext();
  idA = await createTask(ctx.accessToken, ctx.projectId, titleA);
  idB = await createTask(ctx.accessToken, ctx.projectId, titleB);

  await page.goto(boardUrl());
  await taskCard(page, titleB).click();
  await page.getByTestId("dep-select").click();
  await page.getByRole("option", { name: titleA }).click();
  await page.keyboard.press("Escape");

  await expect(taskCard(page, titleB).getByTestId("blocked-badge")).toBeVisible();
});

test("พยายามสร้าง cycle — UI ขึ้น error และไม่บันทึก", async ({ page }) => {
  await page.goto(boardUrl());
  await taskCard(page, titleA).click();
  await page.getByTestId("dep-select").click();
  await page.getByRole("option", { name: titleB }).click();
  await expect(page.getByTestId("dep-error")).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(taskCard(page, titleA).getByTestId("blocked-badge")).toHaveCount(0);
});

test.afterAll(async () => {
  const ctx = readContext();
  if (idA) await deleteTask(ctx.accessToken, idA);
  if (idB) await deleteTask(ctx.accessToken, idB);
});
