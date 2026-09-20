import { expect, test } from "@playwright/test";
import { createTask, listCheckbox, listRow, readContext } from "./helpers";

const context = readContext();
const listUrl = () => `/projects/${context.projectId}/list`;
const stamp = Date.now();
const firstTitle = `Bulk task ${stamp} A`;
const secondTitle = `Bulk task ${stamp} B`;

test.describe.configure({ mode: "serial" });

test("list view shows and selects task rows", async ({ page }) => {
  await createTask(context.accessToken, context.projectId, firstTitle);
  await createTask(context.accessToken, context.projectId, secondTitle);
  await page.goto(listUrl());
  await expect(listRow(page, firstTitle)).toBeVisible();
  await expect(listRow(page, secondTitle)).toBeVisible();
  await listCheckbox(page, firstTitle).click();
  await listCheckbox(page, secondTitle).click();
  await expect(page.getByTestId("bulk-count")).toContainText("2");
});

test("list exposes filter controls", async ({ page }) => {
  await page.goto(listUrl());
  await expect(page.getByTestId("filter-labels")).toBeVisible();
  await expect(page.getByTestId("filter-milestone")).toBeVisible();
  await expect(page.getByTestId("filter-due")).toBeVisible();
});
