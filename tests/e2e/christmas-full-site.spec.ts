import { expect, test } from "@playwright/test";

test("Christmas overlay is viewport-fixed and never intercepts storefront clicks", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".site-header")).toBeVisible();

  const result = await page.evaluate(() => {
    document.documentElement.dataset.seasonalTheme = "christmas";
    document.documentElement.dataset.christmasIntensity = "festive";
    const overlay = document.createElement("div");
    overlay.className = "seasonal-layer-v502";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = '<div class="seasonal-snow-v502"><span class="seasonal-flake-v502" style="left:35%"></span></div><div class="seasonal-tree-v502"></div>';
    document.body.append(overlay);
    const computed = getComputedStyle(overlay);
    const flake = getComputedStyle(overlay.querySelector(".seasonal-flake-v502")!);
    const rect = overlay.getBoundingClientRect();
    overlay.remove();
    return {
      position: computed.position,
      pointerEvents: computed.pointerEvents,
      width: rect.width,
      viewportWidth: document.documentElement.clientWidth,
      snowAnimation: flake.animationName,
    };
  });

  expect(result.position).toBe("fixed");
  expect(result.pointerEvents).toBe("none");
  expect(result.width).toBeGreaterThanOrEqual(result.viewportWidth - 2);
  expect(result.snowAnimation).toContain("ichigo-snowfall-v502");
  await expect(page.locator(".hero-copy h1")).toBeVisible();
});

test("reduced motion stops animated snow without hiding the shop", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const animation = await page.evaluate(() => {
    document.documentElement.dataset.seasonalTheme = "christmas";
    const flake = document.createElement("span");
    flake.className = "seasonal-flake-v502";
    document.body.append(flake);
    const name = getComputedStyle(flake).animationName;
    flake.remove();
    return name;
  });
  expect(animation).toBe("none");
  await expect(page.locator(".site-header")).toBeVisible();
});
