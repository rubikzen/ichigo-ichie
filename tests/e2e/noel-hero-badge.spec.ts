import { expect, test } from "@playwright/test";

test("Noël hero label does not inherit the oversized decorative circle", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator(".hero-v218");
  await expect(hero).toBeVisible();

  // Exercise the festive theme regardless of the actual shop's Admin setting.
  await page.evaluate(() => {
    document.documentElement.dataset.seasonalTheme = "christmas";
  });

  const badge = await hero.evaluate((element) => {
    const style = window.getComputedStyle(element, "::before");
    return {
      content: style.content,
      width: Number.parseFloat(style.width),
      height: Number.parseFloat(style.height),
      right: style.right,
      bottom: style.bottom,
    };
  });

  expect(badge.content).toContain("NOËL CHEZ ICHIGO ICHIE");
  // The old :before circle was 34vw × 34vw and masked the hero title.
  // A holiday label must remain a small pill on desktop and mobile.
  expect(badge.width).toBeGreaterThan(90);
  expect(badge.width).toBeLessThan(360);
  expect(badge.height).toBeGreaterThan(0);
  expect(badge.height).toBeLessThan(65);
  expect(badge.right).toBe("auto");
  expect(badge.bottom).toBe("auto");

  await expect(hero.locator(".hero-copy h1")).toBeVisible();
});
