import { expect, test } from "@playwright/test";
import { createTask, deleteTask, readContext, taskCard } from "./helpers";

const boardUrl = () => "/tasks/board";
const stamp = Date.now();
const createdTitle = `E2E task ${stamp}`;
const editedTitle = `E2E task ${stamp} edited`;

test.describe.configure({ mode: "serial" });

test("สร้าง task ผ่าน TaskModal แล้วเห็นบน Kanban", async ({ page }) => {
  await page.goto(boardUrl(), { waitUntil: "networkidle" });
  await page.getByTestId("add-task").click();
  await page.getByTestId("task-title").fill(createdTitle);
  await page.getByTestId("task-save").click();
  await expect(taskCard(page, createdTitle)).toBeVisible();
});

test("แก้ task แล้วค่า persist หลัง reload", async ({ page }) => {
  await page.goto(boardUrl(), { waitUntil: "networkidle" });
  await taskCard(page, createdTitle).click();
  await page.getByTestId("task-title").fill(editedTitle);
  await page.getByTestId("task-save").click();

  await page.goto(boardUrl(), { waitUntil: "networkidle" });
  await expect(taskCard(page, editedTitle)).toBeVisible();
});

test("ลบ task แล้วหายจาก Kanban", async ({ page }) => {
  await page.goto(boardUrl(), { waitUntil: "networkidle" });
  await taskCard(page, editedTitle).click();
  await page.getByTestId("task-delete").click();
  await page.getByTestId("confirm-ok").click();
  await expect(taskCard(page, editedTitle)).toBeHidden();

  await page.goto(boardUrl(), { waitUntil: "networkidle" });
  await expect(taskCard(page, editedTitle)).toBeHidden();
});

test("ลบคำอธิบายจนว่างแล้วบันทึก ต้องว่างหลัง reload", async ({ page }) => {
  const ctx = readContext();
  const title = `E2E desc ${stamp}`;
  const id = await createTask(ctx.accessToken, ctx.workspaceId, title, { description: "ข้อความเดิม" });

  try {
    await page.goto(boardUrl(), { waitUntil: "networkidle" });
    await taskCard(page, title).click();
    const editor = page.locator(".ProseMirror").first();
    await expect(editor).toContainText("ข้อความเดิม");
    await editor.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Delete");
    await page.getByTestId("task-save").click();

    await page.goto(boardUrl(), { waitUntil: "networkidle" });
    await taskCard(page, title).click();
    await expect(page.locator(".ProseMirror").first()).not.toContainText("ข้อความเดิม");
  } finally {
    await deleteTask(ctx.accessToken, id);
  }
});
