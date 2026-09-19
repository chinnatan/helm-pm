import { expect, test } from "@playwright/test";
import { readContext, taskCard } from "./helpers";

const boardUrl = () => `/projects/${readContext().projectId}/board`;
const stamp = Date.now();
const createdTitle = `E2E task ${stamp}`;
const editedTitle = `E2E task ${stamp} edited`;

test.describe.configure({ mode: "serial" });

test("สร้าง task ผ่าน TaskModal แล้วเห็นบน Kanban", async ({ page }) => {
  await page.goto(boardUrl());
  await page.getByTestId("add-task").click();
  await page.getByTestId("task-title").fill(createdTitle);
  await page.getByTestId("task-save").click();
  await expect(taskCard(page, createdTitle)).toBeVisible();
});

test("แก้ task แล้วค่า persist หลัง reload", async ({ page }) => {
  await page.goto(boardUrl());
  await taskCard(page, createdTitle).click();
  await page.getByTestId("task-title").fill(editedTitle);
  await page.getByTestId("task-save").click();

  await page.goto(boardUrl());
  await expect(taskCard(page, editedTitle)).toBeVisible();
});

test("ลบ task แล้วหายจาก Kanban", async ({ page }) => {
  await page.goto(boardUrl());
  await taskCard(page, editedTitle).click();
  await page.getByTestId("task-delete").click();
  await page.getByTestId("confirm-ok").click();
  await expect(taskCard(page, editedTitle)).toBeHidden();

  await page.goto(boardUrl());
  await expect(taskCard(page, editedTitle)).toBeHidden();
});
