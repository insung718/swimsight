import { expect, type Page, test } from "@playwright/test";

async function forceEnglish(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("swimsight-language", "en");
  });
}

async function chooseDashboardView(page: Page, label: string) {
  await page.getByRole("button", { name: "Open dashboard navigation" }).click();
  const navigator = page.getByRole("dialog", { name: "Dashboard navigation" });
  await expect(navigator).toBeVisible();
  await navigator.getByRole("option", { name: label, exact: true }).click();
  await expect(navigator).toBeHidden();
}

test("renders the signed-out SwimSight product page", async ({ page }) => {
  await forceEnglish(page);
  await page.goto("/");

  await expect(page.getByRole("link", { name: "SwimSight", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your next 50 starts here." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "lap one" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Start the season you keep saying you will." })).toHaveCount(0);
  await expect.poll(async () => page.locator("#swimsight-intro").evaluate((intro) => {
    const predictor = document.querySelector("#predict");
    return predictor ? intro.compareDocumentPosition(predictor) & Node.DOCUMENT_POSITION_FOLLOWING : 0;
  })).toBeTruthy();
  await expect.poll(async () => page.locator("#predict").evaluate((predictor) => {
    const story = document.querySelector("#swimsight-story");
    return story ? predictor.compareDocumentPosition(story) & Node.DOCUMENT_POSITION_FOLLOWING : 0;
  })).toBeTruthy();
  await expect(page.getByRole("heading", { name: "Less dashboard. More direction." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Help make SwimSight sharper." })).toBeVisible();
  await expect(page.getByText("24", { exact: true })).toHaveCount(0);
});

test("validates and prepares the signed-out 50 Free preview", async ({ page }) => {
  await forceEnglish(page);
  await page.goto("/");

  const timeInput = page.getByLabel("Your 50 Free PB");
  await timeInput.fill("18.50");
  await page.getByRole("button", { name: "Predict my time in one year" }).click();
  await expect(page.getByText("Enter a valid 50 Free time for the selected course.")).toBeVisible();

  await timeInput.fill("25.56");
  await page.getByRole("button", { name: "Predict my time in one year" }).click();
  await expect(page.getByRole("heading", { name: "Your one-year time is ready." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit inputs" })).toBeVisible();

  const stored = await page.evaluate(() => window.sessionStorage.getItem("swimsight:50-free-preview:v1"));
  expect(stored).toContain('"currentTime":25.56');
  expect(stored).toContain('"course":"LCM"');
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
  await expect(page.getByRole("heading", { name: "lap one" })).toBeVisible();

  await page.getByRole("button", { name: "KO" }).click();
  await expect(page.getByRole("heading", { name: "첫 랩" })).toBeVisible();

  await page.getByRole("button", { name: "베트남어" }).click();
  await expect(page.getByRole("heading", { name: "vòng đầu tiên" })).toBeVisible();
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

  await expect(page.getByRole("heading", { name: "lap one" })).toBeInViewport();
  await page.locator("#predict").scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: "Your next 50 starts here." })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Predict my time in one year" })).toBeInViewport();

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

test("keeps the signed-in dashboard focused while switching tools", async ({ page }) => {
  await forceEnglish(page);
  await page.goto("/e2e-dashboard");

  await expect(page.getByRole("heading", { name: "Your season, lit up by the times you enter." })).toBeVisible();
  await expect(page.getByText("Performance overview", { exact: true })).toHaveCount(0);

  await chooseDashboardView(page, "Results");
  await expect(page.getByRole("heading", { name: "Results", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your season, lit up by the times you enter." })).toBeHidden();

  await chooseDashboardView(page, "Race Lab");
  await expect(page.getByRole("heading", { name: "Replay the race. Change the plan." })).toBeVisible();

  await chooseDashboardView(page, "Profile");
  await expect(page.getByRole("heading", { name: "Profile & community" })).toBeVisible();
  await chooseDashboardView(page, "Overview");
  await expect(page.getByRole("heading", { name: "Your season, lit up by the times you enter." })).toBeVisible();
});

test("carries the public 50 Free preview into editable result entry", async ({ page }) => {
  await forceEnglish(page);
  await page.addInitScript(() => {
    window.sessionStorage.setItem("swimsight:50-free-preview:v1", JSON.stringify({
      course: "SCM",
      currentTime: 24.88,
      sessionsPerWeek: 6,
      createdAt: Date.now()
    }));
  });
  await page.goto("/e2e-dashboard");
  await chooseDashboardView(page, "Results");

  await expect(page.getByRole("combobox", { name: "Event" })).toHaveValue("50 Freestyle");
  await expect(page.getByRole("combobox", { name: "Course" })).toHaveValue("SCM");
  await expect(page.getByRole("textbox", { name: "Time", exact: true })).toHaveValue("24.88");
});

test("supports keyboard navigation in the dashboard option wheel", async ({ page }) => {
  await forceEnglish(page);
  await page.goto("/e2e-dashboard");

  await page.getByRole("button", { name: "Open dashboard navigation" }).click();
  const navigator = page.getByRole("dialog", { name: "Dashboard navigation" });
  const wheel = navigator.getByRole("listbox", { name: "Dashboard views" });
  await wheel.focus();
  await wheel.press("End");
  await expect(navigator.getByRole("option", { name: "Profile", exact: true })).toHaveAttribute("aria-selected", "true");
  await wheel.press("Enter");
  await expect(page.getByRole("heading", { name: "Profile & community" })).toBeVisible();
  await expect(navigator).toBeHidden();
});

test("translates the dashboard option wheel", async ({ page }) => {
  await forceEnglish(page);
  await page.goto("/e2e-dashboard");

  await page.getByRole("button", { name: "KO" }).click();
  await page.getByRole("button", { name: "대시보드 내비게이션 열기" }).click();
  const navigator = page.getByRole("dialog", { name: "대시보드 내비게이션" });
  await expect(navigator.getByRole("heading", { name: "화면 선택" })).toBeVisible();
  await expect(navigator.getByRole("option", { name: "레이스 랩", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "대시보드 내비게이션 닫기" }).click();
  await expect(navigator).toBeHidden();
});

test("keeps every primary dashboard surface inside a mobile viewport", async ({ page }) => {
  await forceEnglish(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/e2e-dashboard");

  for (const tab of ["Overview", "Results", "Analytics", "Race Lab", "Training", "Goals & Meets", "Profile"]) {
    await chooseDashboardView(page, tab);
    await page.waitForTimeout(80);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${tab} creates signed-in dashboard overflow`).toBeLessThanOrEqual(1);
  }
});

test("keeps the coach workspace focused and navigable", async ({ page }) => {
  await forceEnglish(page);
  await page.goto("/e2e-coach-dashboard");

  await expect(page.getByRole("heading", { name: "Every swimmer, club, goal, and trend in one calm view." })).toBeVisible();
  await chooseDashboardView(page, "Clubs");
  await expect(page.getByRole("heading", { name: "Clubs", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Every swimmer, club, goal, and trend in one calm view." })).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  for (const tab of ["Overview", "Clubs", "Athletes", "Reports"]) {
    await chooseDashboardView(page, tab);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${tab} creates coach dashboard overflow`).toBeLessThanOrEqual(1);
  }
});

test("protects account APIs when signed out", async ({ request }) => {
  const testOrigin = "http://localhost:3100";
  const expectProtected = (status: number, endpoint: string) => {
    expect([401, 429], endpoint).toContain(status);
  };
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
      expectProtected(response.status(), batch[responseIndex]);
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
  expectProtected(writeResponse.status(), "/api/swims");

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
    expectProtected(response.status(), protectedWrites[index]);
  });

  const retentionResponse = await request.get("/api/cron/data-retention");
  expectProtected(retentionResponse.status(), "/api/cron/data-retention");
});
