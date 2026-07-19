import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("swimsight-language", "en"));
  await page.goto("/e2e-race-lab");
  await expect(page.locator('[data-language-ready="true"]')).toBeVisible();
});

test("replays and compares an official race on desktop", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Replay the race. Change the plan." })).toBeVisible();
  await expect(page.getByText("Official splits", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Play replay" }).click();
  await page.waitForTimeout(250);
  expect(Number(await page.getByRole("slider", { name: "Race replay position" }).inputValue())).toBeGreaterThan(0);

  await page.getByRole("tab", { name: "Split analysis" }).click();
  await expect(page.getByRole("heading", { name: "Split comparison" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Gain / loss" })).toBeVisible();
  await expect(page.getByText("Strongest", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Build a race" }).click();
  await expect(page.getByRole("button", { name: "What-if simulator" })).toBeVisible();
  await expect(page.getByText("Every output below is a deterministic simulation, not a prediction.")).toBeVisible();
});

test("keeps Race Lab usable without page overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Replay the race. Change the plan." })).toBeVisible();

  for (const tab of ["Replay", "Split analysis", "Build a race"]) {
    await page.getByRole("tab", { name: tab }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${tab} creates page overflow`).toBeLessThanOrEqual(1);
  }
  await expect(page.getByRole("button", { name: "Goal race builder" })).toBeVisible();
});

test("translates the Race Lab surface into Korean and Vietnamese", async ({ page }) => {
  await page.getByRole("button", { name: "KO" }).click();
  await expect(page.getByRole("heading", { name: "경기를 되짚고 계획을 바꿔 보세요." })).toBeVisible();
  await expect(page.getByRole("tab", { name: "구간 분석" })).toBeVisible();

  await page.getByRole("button", { name: "VI" }).click();
  await expect(page.getByRole("heading", { name: "Xem lại cuộc đua. Điều chỉnh kế hoạch." })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Phân tích chặng" })).toBeVisible();
});
