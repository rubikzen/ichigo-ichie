import { expect, test } from "@playwright/test";

const token = "00000000-0000-4000-8000-000000000001";

const pendingOrder = {
  id: "00000000-0000-4000-8000-000000000002",
  order_number: "II-E2E-PENDING",
  status: "pending",
  payment_status: "pending",
  payment_method: "online",
  payment_expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
  order_type: "shipping",
  pickup_time: null,
  subtotal: 39,
  discount_amount: 0,
  promo_code: null,
  shipping_fee: 3.39,
  total: 42.39,
  created_at: new Date().toISOString(),
  shipping_method_name: "Colissimo",
  shipping_address1: "14 rue Centrale",
  shipping_address2: null,
  shipping_postal_code: "06300",
  shipping_city: "Nice",
  shipping_country: "FR",
  package_weight_g: 100,
  tracking_carrier: null,
  tracking_number: null,
  tracking_url: null,
  shipped_at: null,
  invoices: [],
  order_items: [
    {
      id: "00000000-0000-4000-8000-000000000003",
      product_name: "Matcha test",
      quantity: 1,
      line_total: 39,
      choices: [],
    },
  ],
};

async function mockPendingOrder(page: import("@playwright/test").Page) {
  await page.route(`**/api/orders/${token}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(pendingOrder),
    });
  });
}

test("unpaid order offers pay now and cancel", async ({ page }) => {
  await mockPendingOrder(page);
  await page.goto(`/commande/${token}`, { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("button", { name: /payer maintenant|pay now/i })
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: /annuler la commande|cancel order/i })
  ).toBeVisible();
});

test("pay now calls retry payment API", async ({ page }) => {
  await mockPendingOrder(page);

  let retryCalled = false;
  await page.route("**/api/stripe/retry", async (route) => {
    retryCalled = true;
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "E2E_RETRY_REQUESTED" }),
    });
  });

  await page.goto(`/commande/${token}`, { waitUntil: "domcontentloaded" });

  await page
    .getByRole("button", { name: /payer maintenant|pay now/i })
    .click();

  await expect.poll(() => retryCalled).toBe(true);
  await expect(page.getByText("E2E_RETRY_REQUESTED")).toBeVisible();
});

test("cancel unpaid order updates the customer view", async ({ page }) => {
  await mockPendingOrder(page);

  let cancelCalled = false;
  await page.route(`**/api/orders/${token}/cancel`, async (route) => {
    cancelCalled = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: "cancelled",
        paymentStatus: "expired",
      }),
    });
  });

  await page.goto(`/commande/${token}`, { waitUntil: "domcontentloaded" });

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });

  await page
    .getByRole("button", { name: /annuler la commande|cancel order/i })
    .click();

  await expect.poll(() => cancelCalled).toBe(true);
  await expect(
    page.getByRole("heading", { name: /commande annulée|order cancelled/i })
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: /payer maintenant|pay now/i })
  ).toHaveCount(0);

  await expect(
    page.getByText(/aucun paiement effectué|no payment was taken/i)
  ).toBeVisible();

  await expect(
    page.getByText(/cette commande a été annulée.*aucun paiement n’a été encaissé|this order was cancelled.*no payment was taken/i)
  ).toBeVisible();

  await expect(
    page.getByText(/cliquez sur réessayer|retry to create a new session/i)
  ).toHaveCount(0);
});
