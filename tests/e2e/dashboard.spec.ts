import { expect, test } from "@playwright/test";

test("renders the signed-out SwimSight product page", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "SwimSight" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your times tell a story." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Less dashboard. More direction." })).toBeVisible();
  await expect(page.getByText("24", { exact: true })).toHaveCount(0);
});

test("opens and closes the signed-out staggered menu", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const menu = page.getByRole("dialog", { name: "SwimSight navigation menu" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: "Features", exact: true })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});

test("protects account APIs when signed out", async ({ request }) => {
  const response = await request.get("/api/swims");
  expect(response.status()).toBe(401);
});
