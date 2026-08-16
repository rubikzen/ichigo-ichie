import { expect, test } from "@playwright/test";

test("Boutique product permalink opens a canonical SEO product page", async ({ page }) => {
  await page.goto("/#boutique");

  const productLink = page
    .locator("#boutique a.product-permalink-v431:visible")
    .first();
  await expect(productLink).toBeVisible();

  const href = await productLink.getAttribute("href");
  expect(href).toMatch(/^\/boutique\/[^/?#]+$/);
  expect(href).toBe(href?.toLowerCase());

  await page.goto(href!);

  await expect(page.locator("main[data-product-page-v431]")).toBeVisible();
  await expect(page.locator(".product-page-story-v431 h1")).not.toHaveText("");
  await expect(page.locator(".product-page-purchase-v431 .product-card")).toBeVisible();
  await expect(page.locator("script[data-product-schema-v431]")).toHaveCount(1);

  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(canonical).toContain(href!);
});
