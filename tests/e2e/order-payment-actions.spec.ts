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

async function mockOrderPaymentStatus(
  page: import("@playwright/test").Page,
  paymentStatus: "pending" | "unpaid" | "failed" | "expired"
) {
  await page.route(`**/api/orders/${token}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...pendingOrder, payment_status: paymentStatus }),
    });
  });
}

function watchDuplicateOrderCreation(page: import("@playwright/test").Page) {
  let createOrderCalls = 0;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() === "POST" && url.pathname === "/api/orders") {
      createOrderCalls += 1;
    }
  });
  return () => createOrderCalls;
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

test("fresh Stripe confirmation hides duplicate pay and cancel actions", async ({ page }) => {
  await mockPendingOrder(page);
  await page.addInitScript(
    ({ orderNumber }) => {
      window.sessionStorage.setItem(
        `ichigo:payment-confirming:${orderNumber}`,
        String(Date.now()),
      );
    },
    { orderNumber: pendingOrder.order_number },
  );

  await page.goto(`/commande/${token}`, { waitUntil: "domcontentloaded" });

  await expect(
    page.getByText(/confirmation stripe en cours|stripe confirmation in progress/i),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: /payer maintenant|pay now/i }),
  ).toHaveCount(0);

  await expect(
    page.getByRole("button", { name: /annuler la commande|cancel order/i }),
  ).toHaveCount(0);
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


test("payment cancelled return is explicit and keeps recovery on the same order", async ({ page }) => {
  await mockOrderPaymentStatus(page, "pending");
  const getCreateOrderCalls = watchDuplicateOrderCreation(page);

  await page.goto(`/commande/${token}?payment=cancelled`, { waitUntil: "domcontentloaded" });

  await expect(
    page.getByText(/paiement interrompu|payment interrupted/i)
  ).toBeVisible();

  await expect(
    page.getByText(/quitté stripe sans payer|left stripe without paying/i)
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: /payer maintenant|pay now/i })
  ).toBeVisible();

  expect(getCreateOrderCalls()).toBe(0);
});

test("failed payment retries the same order without creating a duplicate order", async ({ page }) => {
  await mockOrderPaymentStatus(page, "failed");
  const getCreateOrderCalls = watchDuplicateOrderCreation(page);

  let retryCalled = false;
  await page.route("**/api/stripe/retry", async (route) => {
    retryCalled = true;
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "E2E_FAILED_RETRY" }),
    });
  });

  await page.goto(`/commande/${token}`, { waitUntil: "domcontentloaded" });

  await expect(
    page.getByText(/paiement échoué|payment failed/i)
  ).toBeVisible();

  await expect(
    page.getByText(/sans recréer la commande|without creating a new order/i)
  ).toBeVisible();

  await page
    .getByRole("button", { name: /réessayer le paiement|retry payment/i })
    .click();

  await expect.poll(() => retryCalled).toBe(true);
  expect(getCreateOrderCalls()).toBe(0);
});

test("expired payment creates a new session for the existing order only", async ({ page }) => {
  await mockOrderPaymentStatus(page, "expired");
  const getCreateOrderCalls = watchDuplicateOrderCreation(page);

  let retryCalled = false;
  await page.route("**/api/stripe/retry", async (route) => {
    retryCalled = true;
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "E2E_EXPIRED_RETRY" }),
    });
  });

  await page.goto(`/commande/${token}`, { waitUntil: "domcontentloaded" });

  await expect(
    page.getByText(/session de paiement expirée|payment session expired/i)
  ).toBeVisible();

  await expect(
    page.getByText(/inutile de refaire votre panier.*créer une autre commande|no need to rebuild your cart.*create another order/i)
  ).toBeVisible();

  await page
    .getByRole("button", { name: /créer une nouvelle session|create new payment session/i })
    .click();

  await expect.poll(() => retryCalled).toBe(true);
  expect(getCreateOrderCalls()).toBe(0);
});
