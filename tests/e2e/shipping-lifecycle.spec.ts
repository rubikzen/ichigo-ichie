import { expect, test } from "@playwright/test";

const token = "00000000-0000-4000-8000-000000000101";

function makeOrder(
  status: "pending" | "preparing" | "ready" | "completed",
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "00000000-0000-4000-8000-000000000102",
    order_number: "II-E2E-SHIPPING",
    status,
    payment_status: "paid",
    payment_method: "online",
    payment_expires_at: null,
    order_type: "shipping",
    pickup_time: null,
    subtotal: 39,
    discount_amount: 0,
    promo_code: null,
    shipping_fee: 3.39,
    total: 42.39,
    created_at: "2026-08-13T00:00:00.000Z",
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
        id: "00000000-0000-4000-8000-000000000103",
        product_name: "Matcha lifecycle test",
        quantity: 1,
        line_total: 39,
        choices: [],
      },
    ],
    ...overrides,
  };
}

test("paid shipping lifecycle reaches shipped state with customer tracking", async ({
  page,
}) => {
  let order = makeOrder("pending");

  await page.route(`**/api/orders/${token}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(order),
    });
  });

  await page.goto(`/commande/${token}`, { waitUntil: "domcontentloaded" });

  await expect(
    page.getByText(/paiement confirmé|payment confirmed/i).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /payer maintenant|pay now/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /annuler la commande|cancel order/i }),
  ).toHaveCount(0);
  await expect(page.locator(".tracking-step.current")).toContainText(
    /commande confirmée|order confirmed/i,
  );
  await expect(
    page.getByText(/suivi du colis|parcel tracking/i),
  ).toHaveCount(0);

  order = makeOrder("preparing");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".tracking-step.current")).toContainText(
    /en préparation|preparing/i,
  );

  order = makeOrder("ready");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: /prête à expédier|ready to ship/i }),
  ).toBeVisible();
  await expect(page.locator(".tracking-step.current")).toContainText(
    /prête à expédier|ready to ship/i,
  );

  const trackingUrl =
    "https://www.laposte.fr/outils/suivre-vos-envois?code=E2E123456789FR";

  order = makeOrder("completed", {
    tracking_carrier: "Colissimo",
    tracking_number: "E2E123456789FR",
    tracking_url: trackingUrl,
    shipped_at: "2026-08-13T00:05:00.000Z",
  });

  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { name: /commande expédiée|order shipped/i }),
  ).toBeVisible();
  await expect(page.locator(".tracking-step.current")).toContainText(
    /expédiée|shipped/i,
  );
  await expect(
    page.getByText(/colissimo\s*·\s*E2E123456789FR/i),
  ).toBeVisible();

  const trackingLink = page.getByRole("link", {
    name: /suivre mon colis|track parcel/i,
  });
  await expect(trackingLink).toBeVisible();
  await expect(trackingLink).toHaveAttribute("href", trackingUrl);
});

test("ready shipping order does not invent parcel tracking before a number exists", async ({
  page,
}) => {
  const order = makeOrder("ready");

  await page.route(`**/api/orders/${token}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(order),
    });
  });

  await page.goto(`/commande/${token}`, { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { name: /prête à expédier|ready to ship/i }),
  ).toBeVisible();
  await expect(
    page.getByText(/suivi du colis|parcel tracking/i),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /suivre mon colis|track parcel/i }),
  ).toHaveCount(0);
});
