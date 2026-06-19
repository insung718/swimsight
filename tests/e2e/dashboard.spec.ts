import { expect, test } from "@playwright/test";

test("renders the signed-out SwimSight product page", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "SwimSight" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your times tell a story." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Less dashboard. More direction." })).toBeVisible();
  await expect(page.getByText("24", { exact: true })).toHaveCount(0);
});

test("protects account APIs when signed out", async ({ request }) => {
  const response = await request.get("/api/swims");
  expect(response.status()).toBe(401);
});
