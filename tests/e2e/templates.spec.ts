import { expect, test } from "@playwright/test";
import { readContext, taskCard } from "./helpers";

const context = readContext();
const boardUrl = () => `/projects/${context.projectId}/board`;
const title = `Template source ${Date.now()}`;
const templateTitle = `Template ${Date.now()}`;

test.describe.configure({ mode: "serial" });

test("save a task as a template and manage it", async ({ page }) => {
  await page.goto(boardUrl());
  await page.getByTestId("add-task").click();
  await page.getByTestId("task-title").fill(title);
  await page.getByTestId("task-save").click();
  await taskCard(page, title).click();
  await page.getByTestId("template-save-as").click();
  await page.getByTestId("template-name").fill(templateTitle);
  await page.getByTestId("template-save-confirm").click();
  await expect(page.getByTestId("template-name")).toBeHidden();
  await page.getByTestId("task-save").click();
  await page.getByTestId("template-manage").click();
  const templateInput = page.locator(`input[data-testid="template-title"][value="${templateTitle}"]`);
  await expect(templateInput).toBeVisible();
});

test("delete the template", async ({ page }) => {
  await page.goto(boardUrl());
  await page.getByTestId("template-manage").click();
  const templateInput = page.locator(`input[data-testid="template-title"][value="${templateTitle}"]`);
  const item = templateInput.locator("xpath=ancestor::*[@data-testid='template-item']");
  await item.getByTestId("template-delete").click();
  await page.getByTestId("confirm-ok").click();
  await expect(item).toBeHidden();
});
