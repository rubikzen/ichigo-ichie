import { expect, test } from "@playwright/test";

const endpoint = "/api/restock/subscribe";

test("restock API rejects a malformed product id explicitly", async ({ request }) => {
  const response = await request.post(endpoint, {
    data: {
      productId: "not-a-product-id",
      email: "restock-e2e@example.com",
      locale: "fr",
      website: "",
    },
  });

  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.code).toBe("RESTOCK_PRODUCT_INVALID");
});

test("canonical UUID reaches product lookup instead of being rejected as Produit invalide", async ({
  request,
}) => {
  // Valid PostgreSQL UUID shape, deliberately absent from the catalog.
  // V426.1 must let it reach the database lookup rather than reject its
  // version nibble before querying products.
  const response = await request.post(endpoint, {
    data: {
      productId: "00000000-0000-0000-0000-000000000001",
      email: "restock-e2e@example.com",
      locale: "fr",
      website: "",
    },
  });

  expect(response.status()).toBe(404);
  const body = await response.json();
  expect(body.code).toBe("RESTOCK_PRODUCT_NOT_FOUND");
  expect(body.error).not.toBe("Produit invalide.");
});

test("restock honeypot stays harmless and never requires a valid product", async ({
  request,
}) => {
  const response = await request.post(endpoint, {
    data: {
      productId: "bot-filled-invalid-id",
      email: "bot@example.com",
      locale: "fr",
      website: "https://spam.example",
    },
  });

  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({ ok: true });
});
