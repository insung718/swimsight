import { expect, type Page, test } from "@playwright/test";

async function forceEnglish(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("swimsight-language", "en");
  });
}

test("renders the signed-out SwimSight product page", async ({ page }) => {
  await forceEnglish(page);
  await page.goto("/");

  await expect(page.getByRole("link", { name: "SwimSight", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Start the season you keep saying you will." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Less dashboard. More direction." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Help make SwimSight sharper." })).toBeVisible();
  await expect(page.getByText("24", { exact: true })).toHaveCount(0);
});

test("opens and closes the signed-out staggered menu", async ({ page }) => {
  await forceEnglish(page);
  await page.goto("/");
  await expect(page.locator('[data-language-ready="true"]')).toBeVisible();

  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const menu = page.getByRole("dialog", { name: "SwimSight navigation menu" });
  await expect(menu).toBeVisible();
  await menu.getByRole("link", { name: "Features", exact: true }).click();
  await expect(page).toHaveURL(/\/features$/);
  await expect(page.getByRole("heading", { name: "Everything your swim season needs." })).toBeVisible();

  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await expect(page.getByRole("dialog", { name: "SwimSight navigation menu" })).toBeVisible();

  await page.getByRole("link", { name: "Contact", exact: true }).click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByRole("heading", { name: "Contact us and review the website." })).toBeVisible();
});

test("translates the current lap-one hero", async ({ page }) => {
  await forceEnglish(page);
  await page.goto("/");
  await expect(page.locator('[data-language-ready="true"]')).toBeVisible();
  await expect(page.getByText("Swim intelligence. Lap one.")).toBeVisible();

  await page.getByRole("button", { name: "KO" }).click();
  await expect(page.getByText("수영 인텔리전스. 첫 랩부터.")).toBeVisible();

  await page.getByRole("button", { name: "베트남어" }).click();
  await expect(page.getByText("Trí tuệ bơi lội. Từ vòng đầu tiên.")).toBeVisible();
});

test("shows the active page in the staggered menu", async ({ page }) => {
  await forceEnglish(page);
  await page.goto("/features");

  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await expect(page.getByRole("link", { name: "Features", exact: true })).toHaveAttribute("aria-current", "page");
});

test("publishes an honest validation status without unstable metrics", async ({ page }) => {
  await forceEnglish(page);
  await page.goto("/validation");

  await expect(page.getByRole("heading", { name: "Validation before promotion." })).toBeVisible();
  await expect(page.getByText("UNTRAINED", { exact: true })).toBeVisible();
  await expect(page.getByText("Metrics appear only when defensible.")).toBeVisible();
  await expect(page.getByText(/Current evidence is too small for a stable public claim\./)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("does not horizontally overflow on mobile landing", async ({ page }) => {
  await forceEnglish(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator('[data-language-ready="true"]')).toBeVisible();

  await expect(page.getByRole("heading", { name: "Start the season you keep saying you will." })).toBeVisible();

  for (const scrollY of [0, 720, 1500, 2600, 3900, 5400, 7000]) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(80);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow at scrollY=${scrollY}`).toBeLessThanOrEqual(1);
  }

  const firstDepthCard = page.locator(".depth-card").first();
  await firstDepthCard.scrollIntoViewIfNeeded();
  await expect(firstDepthCard).toBeVisible();

  for (const { button, language } of [
    { button: "KO", language: "KO" },
    { button: "베트남어", language: "VI" }
  ]) {
    await page.getByRole("button", { name: button }).click();
    for (const scrollY of [0, 1500, 3900, 7000]) {
      await page.evaluate((y) => window.scrollTo(0, y), scrollY);
      await page.waitForTimeout(80);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${language} horizontal overflow at scrollY=${scrollY}`).toBeLessThanOrEqual(1);
    }
  }
});

test("protects account APIs when signed out", async ({ request }) => {
  const testOrigin = "http://localhost:3100";
  const protectedReads = [
    "/api/me",
    "/api/me/prediction-profile",
    "/api/me/privacy",
    "/api/me/export",
    "/api/swims",
    "/api/analytics",
    "/api/motivation",
    "/api/friends",
    "/api/gym",
    "/api/communities",
    "/api/coach/clubs",
    "/api/coach/clubs/join",
    "/api/coach/notes?teamId=team-1&athleteId=athlete-1",
    "/api/pilots/cohorts",
    "/api/pilots/enroll",
    "/api/pilots/invitations",
    "/api/admin/data-foundation",
    "/api/meets",
    "/api/predictions/performance",
    "/api/race-lab",
    "/api/race-feedback",
    "/api/admin/model-governance",
    "/api/communities/fake-community/compare"
  ];

  for (let index = 0; index < protectedReads.length; index += 5) {
    const batch = protectedReads.slice(index, index + 5);
    const responses = await Promise.all(batch.map((endpoint) => request.get(endpoint)));
    responses.forEach((response, responseIndex) => {
      expect(response.status(), batch[responseIndex]).toBe(401);
    });
  }

  const writeResponse = await request.post("/api/swims", {
    data: {
      date: "2026-06-19",
      event: "50 Freestyle",
      course: "LCM",
      timeSeconds: 25.56,
      meetName: "Signed-out smoke test"
    },
    headers: {
      origin: testOrigin
    }
  });
  expect(writeResponse.status()).toBe(401);

  const protectedWrites = [
    "/api/import",
    "/api/coach/roster",
    "/api/pilots/enroll",
    "/api/product-events",
    "/api/admin/data-foundation"
  ];
  const writeResponses = await Promise.all(protectedWrites.map((endpoint) => request.post(endpoint, {
      data: {},
      headers: { origin: testOrigin }
    })));
  writeResponses.forEach((response, index) => {
    expect(response.status(), protectedWrites[index]).toBe(401);
  });

  const retentionResponse = await request.get("/api/cron/data-retention");
  expect(retentionResponse.status()).toBe(401);
});
