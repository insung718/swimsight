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
  await expect(page.getByRole("columnheader", { name: "Gain / loss", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Cumulative gain / loss" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Comparison race" })).toHaveValue("previous");
  await expect(page.getByText("Strongest", { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export race card" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("swimsight-race-lab-100-freestyle-lcm");
  await expect(page.getByText("Race card downloaded.")).toBeVisible();

  await page.getByRole("tab", { name: "Build a race" }).click();
  await expect(page.getByRole("button", { name: "What-if simulator" })).toBeVisible();
  await expect(page.getByText("Every output below is a deterministic simulation, not a prediction.")).toBeVisible();

  const reaction = page.getByLabel("Reaction time");
  await reaction.evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = "1.1";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(reaction).toHaveValue("1.1");
  await page.getByRole("button", { name: "Reset adjustments" }).click();
  await expect(reaction).toHaveValue("0.7");
  const simulatedSplits = page.getByText("Simulated splits", { exact: true }).locator("..");
  await simulatedSplits.getByText("Simulated splits", { exact: true }).click();
  await expect(simulatedSplits).toContainText("26.70");

  await reaction.evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = "1.1";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.getByRole("combobox", { name: "Source race" }).selectOption("race-previous");
  await expect(page.getByLabel("Reaction time")).toHaveValue("0.7");
  await page.getByRole("combobox", { name: "Source race" }).selectOption("race-current");

  await page.getByRole("button", { name: "Goal race builder" }).click();
  await page.getByLabel("Goal time").fill("0:54.80");
  await expect(page.getByRole("button", { name: "Save goal race" })).toBeEnabled();

  await page.getByRole("button", { name: /Saved scenarios/ }).click();
  await page.getByRole("button", { name: "Delete scenario" }).click();
  await expect(page.getByText("Delete this snapshot?")).toBeVisible();
  await page.getByRole("button", { name: "Keep" }).click();
  await expect(page.getByText("Delete this snapshot?")).toBeHidden();
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
  await page.getByRole("button", { name: "Goal race builder" }).click();
  await page.getByLabel("Goal time").fill("0:54.80");
  await expect(page.getByRole("button", { name: "Save goal race" })).toBeEnabled();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "goal builder creates page overflow").toBeLessThanOrEqual(1);
});

test("validates manual cumulative splits before submission", async ({ page }) => {
  await page.getByRole("combobox", { name: "Source race" }).selectOption("race-manual");
  await expect(page.getByText("Estimated splits", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Enter splits" }).click();
  await page.getByRole("textbox", { name: "50 m", exact: true }).fill("19.00");
  await expect(page.getByText("Split values must increase, remain plausible, and match the recorded finish time.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save splits" })).toBeDisabled();
});

test("replays every pool length with live clocks and wall turns", async ({ page }) => {
  await page.getByRole("combobox", { name: "Source race" }).selectOption("race-manual");
  const actualTrack = page.locator('[data-race-track="Actual"]');
  const liveClock = actualTrack.locator("[data-live-time]");
  const marker = actualTrack.locator("[data-lane-position]");

  await expect(liveClock).toHaveAttribute("data-live-time", "0.00");
  await expect(marker).toHaveAttribute("data-lane-position", "0.0000");

  await page.getByRole("button", { name: "Next length" }).click();
  await expect(marker).toHaveAttribute("data-lane-position", "1.0000");
  expect(Number(await liveClock.getAttribute("data-live-time"))).toBeGreaterThan(0);
  await expect(liveClock.locator("div").first()).not.toHaveText("~0.0");
  await expect(page.locator("[data-replay-clock]")).not.toHaveText("0.00");

  await page.getByRole("button", { name: "Next length" }).click();
  await expect(marker).toHaveAttribute("data-lane-position", "0.0000");
  await page.getByRole("button", { name: "Previous length" }).click();
  await expect(marker).toHaveAttribute("data-lane-position", "1.0000");

  await page.getByRole("button", { name: "Reset replay" }).click();
  await page.getByRole("button", { name: "Play replay" }).click();
  await page.waitForTimeout(250);
  expect(Number(await liveClock.getAttribute("data-live-time"))).toBeGreaterThan(0);
});

test("keeps 50, 100, 200, and 400 distance replays synchronized", async ({ page }) => {
  const races = [
    { id: "race-50-scy", lengths: 2 },
    { id: "race-current", lengths: 2 },
    { id: "race-manual", lengths: 8 },
    { id: "race-400-lcm", lengths: 8 }
  ];

  for (const race of races) {
    await page.getByRole("combobox", { name: "Source race" }).selectOption(race.id);
    const actualTrack = page.locator('[data-race-track="Actual"]');
    const marker = actualTrack.locator("[data-lane-position]");
    const liveClock = actualTrack.locator("[data-live-time]");
    let previousTime = 0;

    await expect(marker).toHaveAttribute("data-lane-position", "0.0000");
    for (let length = 1; length <= race.lengths; length += 1) {
      await page.getByRole("button", { name: "Next length" }).click();
      await expect(marker).toHaveAttribute("data-lane-position", length % 2 === 1 ? "1.0000" : "0.0000");
      const currentTime = Number(await liveClock.getAttribute("data-live-time"));
      expect(currentTime).toBeGreaterThan(previousTime);
      previousTime = currentTime;
    }
    await expect(page.locator("[data-replay-clock]")).not.toHaveText("0.00");
  }
});

test("translates the Race Lab surface into Korean and Vietnamese", async ({ page }) => {
  await page.getByRole("button", { name: "Korean", exact: true }).click();
  await expect(page.getByRole("heading", { name: "경기를 되짚고 계획을 바꿔 보세요." })).toBeVisible();
  await expect(page.getByRole("tab", { name: "구간 분석" })).toBeVisible();
  await page.getByRole("tab", { name: "경기 설계" }).click();
  await expect(page.getByRole("button", { name: "조정값 초기화" })).toBeVisible();
  await page.getByRole("tab", { name: "리플레이" }).click();
  await page.locator("select").first().selectOption("race-manual");
  await page.getByRole("button", { name: "다음 구간" }).click();
  await expect(page.locator('[data-race-track="Actual"]')).toContainText("구간 1/8");
  await expect(page.locator("[data-replay-clock]")).not.toHaveText("0.00");

  await page.getByRole("button", { name: "베트남어", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Xem lại cuộc đua. Điều chỉnh kế hoạch." })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Phân tích chặng" })).toBeVisible();
  await expect(page.locator('[data-race-track="Actual"]')).toContainText("Chặng 1/8");
  await expect(page.getByRole("button", { name: "Chặng sau" })).toBeVisible();
});
