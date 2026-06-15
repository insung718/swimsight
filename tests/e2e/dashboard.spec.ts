import { expect, test } from "@playwright/test";

test("renders the SwimSight MVP dashboard", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "SwimSight" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Progression" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Goal Tracker" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "CSV Import" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "100 Butterfly" })).toBeVisible();
});
