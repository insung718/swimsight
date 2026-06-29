import { expect, type Page, test } from "@playwright/test";

async function forceEnglish(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("swimsight-language", "en");
  });
}

test("renders the signed-out SwimSight product page", async ({ page }) => {
  await forceEnglish(page);
  await page.goto("/");

  await expect(page.getByRole("link", { name: "SwimSight" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your season, finally in motion." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Less dashboard. More direction." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Help make SwimSight sharper." })).toBeVisible();
  await expect(page.getByText("24", { exact: true })).toHaveCount(0);
});

test("opens and closes the signed-out staggered menu", async ({ page }) => {
  await forceEnglish(page);
  await page.goto("/");

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

test("keeps the landing signal graph aligned and translated", async ({ page }) => {
  await forceEnglish(page);
  await page.goto("/");
  await page.locator(".hero-signal-line").waitFor({ state: "attached" });

  const graph = await page.evaluate(() => {
    const path = document.querySelector(".hero-signal-line");
    const dots = [...document.querySelectorAll(".hero-signal-point circle:first-child")];
    return {
      pathTransform: path ? getComputedStyle(path).transform : null,
      dots: dots.map((dot) => [Number(dot.getAttribute("cx")), Number(dot.getAttribute("cy"))])
    };
  });

  expect(graph.pathTransform).toBe("none");
  expect(graph.dots).toEqual([
    [80, 440],
    [342, 290],
    [620, 235],
    [826, 138]
  ]);

  await page.getByRole("button", { name: "KO" }).click();
  await expect(page.getByText("나만을 위한 수영 인텔리전스.")).toBeVisible();

  await page.getByRole("button", { name: "베트남어" }).click();
  await expect(page.getByText("Trí tuệ bơi lội. Cá nhân hóa.")).toBeVisible();
});

test("shows the active page in the staggered menu", async ({ page }) => {
  await forceEnglish(page);
  await page.goto("/features");

  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await expect(page.getByRole("link", { name: "Features", exact: true })).toHaveAttribute("aria-current", "page");
});

test("does not horizontally overflow on mobile landing", async ({ page }) => {
  await forceEnglish(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("protects account APIs when signed out", async ({ request }) => {
  const protectedReads = [
    "/api/me",
    "/api/swims",
    "/api/analytics",
    "/api/motivation",
    "/api/friends",
    "/api/gym",
    "/api/communities",
    "/api/coach/clubs",
    "/api/coach/clubs/join",
    "/api/meets",
    "/api/communities/fake-community/compare"
  ];

  for (const endpoint of protectedReads) {
    const response = await request.get(endpoint);
    expect(response.status(), endpoint).toBe(401);
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
      origin: "http://localhost:3000"
    }
  });
  expect(writeResponse.status()).toBe(401);
});
