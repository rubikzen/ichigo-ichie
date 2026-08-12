import { expect, test } from "@playwright/test";

const publicRoutes = [
  "/",
  "/boutique",
  "/menu",
  "/panier",
  "/checkout",
  "/compte",
  "/cgv",
  "/mentions-legales",
  "/confidentialite",
  "/livraison-retours",
  "/admin/login",
];

for (const route of publicRoutes) {
  test(`${route} loads without application error`, async ({ page }) => {
    const response = await page.goto(route, {
      waitUntil: "domcontentloaded",
    });

    expect(response, `No response for ${route}`).not.toBeNull();
    expect(response!.status(), `${route} returned HTTP ${response!.status()}`).toBeLessThan(400);

    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.locator("body")).not.toContainText("Internal Server Error");
  });
}

test("homepage exposes canonical URL", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute(
    "href",
    /^https:\/\/www\.ichigoichiematcha\.fr\/?$/
  );
});

test("homepage language switch changes document language", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  // Wait for LanguageProvider hydration/initialization before clicking.
  // Otherwise the initial effect can race with an immediate test click.
  await expect(page.locator("html")).toHaveAttribute("data-language", /^(fr|en)$/);
  await expect(page.locator("html")).toHaveAttribute("lang", /^(fr|en)$/);

  const en = page.getByRole("button", { name: "EN", exact: true });
  await expect(en).toBeVisible();
  await en.click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  const fr = page.getByRole("button", { name: "FR", exact: true });
  await expect(fr).toBeVisible();
  await fr.click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});

test("main customer navigation is available", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("link", { name: /mon compte|my account/i })
  ).toBeVisible();

  await expect(
    page.locator('a[href="/panier"]:visible').first()
  ).toBeVisible();
});
