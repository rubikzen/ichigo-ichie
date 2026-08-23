import { expect, test, type Page } from "@playwright/test";

const HYDRATION_SIGNATURES = [
  "minified react error #418",
  "hydration failed",
  "hydration mismatch",
  "server rendered html",
  "server-rendered html",
  "server rendered text",
  "server-rendered text",
  "expected server html",
  "tree hydrated",
  "didn't match",
  "did not match",
];

function isHydrationMessage(value: string) {
  const normalized = value.toLowerCase();
  return HYDRATION_SIGNATURES.some((signature) =>
    normalized.includes(signature),
  );
}

function installHydrationGuard(page: Page) {
  const hydrationProblems: string[] = [];

  page.on("pageerror", (error) => {
    const message = String(error?.message || error);
    if (isHydrationMessage(message)) {
      hydrationProblems.push(`pageerror: ${message}`);
    }
  });

  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    const text = message.text();
    if (isHydrationMessage(text)) {
      hydrationProblems.push(`console.${message.type()}: ${text}`);
    }
  });

  return {
    async settle() {
      await page.waitForTimeout(450);
    },
    expectClean(label: string) {
      expect(
        hydrationProblems,
        `Hydration must stay clean after ${label}`,
      ).toEqual([]);
    },
  };
}

async function firstProductHref(page: Page) {
  const productLink = page
    .locator(
      'a.product-title-link-v4792[href^="/boutique/"], a.product-permalink-v431[href^="/boutique/"]',
    )
    .first();

  await expect(productLink).toHaveAttribute("href", /^\/boutique\/.+/);
  const href = await productLink.getAttribute("href");
  expect(href).toBeTruthy();
  return href as string;
}

test("V480.3 fresh FR storefront hydrates cleanly across home, shop and product", async ({
  page,
}) => {
  const guard = installHydrationGuard(page);

  await page.goto("/");
  await expect(page.locator("header.site-header-v261")).toBeVisible();
  await guard.settle();
  guard.expectClean("fresh FR homepage");

  await page.goto("/boutique");
  await expect(page.locator("main.shop-collection-page-v473")).toBeVisible();
  await guard.settle();
  guard.expectClean("fresh FR shop");

  const href = await firstProductHref(page);
  await page.goto(href);
  await expect(page.locator("main[data-product-page-v431]")).toBeVisible();
  await guard.settle();
  guard.expectClean("fresh FR product page");
});

test("V480.3 persisted EN language and cart state do not disturb hydration", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("ichigo-language", "en");
    window.localStorage.setItem(
      "ichigo-ichie-v2-cart",
      JSON.stringify([
        {
          key: "v4803-hydration-cart",
          productId: "v4803-hydration-product",
          name: "Hydration guard",
          imageUrl: "/product-placeholder.svg",
          unitPrice: 1,
          pickupOnly: false,
          choices: [],
          quantity: 2,
        },
      ]),
    );
  });

  const guard = installHydrationGuard(page);

  await page.goto("/boutique");
  await expect(page.locator("main.shop-collection-page-v473")).toBeVisible();

  const englishButton = page
    .locator(".language-switch-mobile-visible-v261 button")
    .filter({ hasText: "EN" });
  await expect(englishButton).toHaveAttribute("aria-pressed", "true");

  await expect(
    page.locator(".cart-link-v378 .cart-count-v378"),
  ).toHaveText("2");

  await guard.settle();
  guard.expectClean("persisted EN + cart shop");

  const href = await firstProductHref(page);
  await page.goto(href);
  await expect(page.locator("main[data-product-page-v431]")).toBeVisible();
  await expect(
    page
      .locator(".language-switch-mobile-visible-v261 button")
      .filter({ hasText: "EN" }),
  ).toHaveAttribute("aria-pressed", "true");

  await guard.settle();
  guard.expectClean("persisted EN + cart product page");

  await page.goto("/");
  await expect(page.locator("header.site-header-v261")).toBeVisible();
  await guard.settle();
  guard.expectClean("persisted EN + cart homepage");
});
