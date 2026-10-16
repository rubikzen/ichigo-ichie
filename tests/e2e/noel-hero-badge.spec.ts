import { expect, test } from "@playwright/test";

test("Noël hero label does not inherit the oversized decorative circle", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator(".hero-v218");
  await expect(hero).toBeVisible();

  // Force the festive CSS only while taking the measurement; React's
  // settings hydration may otherwise reset the data attribute between
  // two asynchronous Playwright evaluations.
  const badge = await hero.evaluate((element) => {
    document.documentElement.dataset.seasonalTheme = "christmas";
    const style = window.getComputedStyle(element, "::before");
    return {
      content: style.content,
      width: Number.parseFloat(style.width),
      height: Number.parseFloat(style.height),
    };
  });

  expect(badge.content).toContain("NOËL CHEZ ICHIGO ICHIE");
  // The old :before circle was 34vw × 34vw and masked the hero title.
  // A holiday label must remain a small pill on desktop and mobile.
  expect(badge.width).toBeGreaterThan(90);
  expect(badge.width).toBeLessThan(360);
  expect(badge.height).toBeGreaterThan(0);
  expect(badge.height).toBeLessThan(65);
  await expect(hero.locator(".hero-copy h1")).toBeVisible();
});
