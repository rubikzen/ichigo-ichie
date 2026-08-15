import { expect, test } from "@playwright/test";

test.skip(
  ({ isMobile }) => !isMobile,
  "This test validates the mobile header only."
);

test("mobile header keeps FR/EN switch visible", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(
    page.locator(".language-switch-mobile-visible-v261")
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "FR", exact: true })
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "EN", exact: true })
  ).toBeVisible();
});

test("mobile account and cart navigation remain reachable", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("link", { name: /mon compte|my account/i })
  ).toBeVisible();

  await expect(
    page.locator('.mobile-bottom-nav-v236 a[href="/panier"]')
  ).toBeVisible();
});


test("mobile dock marks Boutique active after a Boutique hash jump", async ({ page }) => {
  await page.goto("/#boutique", { waitUntil: "domcontentloaded" });

  const boutique = page.locator("#boutique");
  await boutique.scrollIntoViewIfNeeded();

  const boutiqueLink = page.locator('.mobile-bottom-nav-v236 a[href="/#boutique"]');
  await expect(boutiqueLink).toHaveClass(/active/);
  await expect(boutiqueLink).toHaveAttribute("aria-current", "location");

  await expect(
    page.locator('.mobile-bottom-nav-v236 a[href="/#maison"]')
  ).not.toHaveClass(/active/);
});
