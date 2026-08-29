import { expect, test } from "@playwright/test";

test("homepage product modal still opens and closes after lazy split", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const opener = page.locator(".product-image-button:visible").first();
  test.skip((await opener.count()) === 0, "No storefront product available in this test environment.");

  await opener.click();

  const dialog = page.getByRole("dialog").first();
  await expect(dialog).toBeVisible();

  const close = dialog.getByRole("button", { name: /fermer|close/i });
  await expect(close).toBeFocused();
  await close.click();
  await expect(dialog).toBeHidden();
});
