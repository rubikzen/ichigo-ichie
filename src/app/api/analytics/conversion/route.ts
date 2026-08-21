import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

const EVENT_NAMES = new Set([
  "product_view",
  "add_to_cart",
  "begin_checkout",
  "purchase",
]);

function cleanId(value: unknown, max = 96) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return undefined;
  if (!/^[A-Za-z0-9:_-]+$/.test(trimmed)) return undefined;
  return trimmed;
}

function cleanPath(value: unknown) {
  if (typeof value !== "string") return "/";
  const path = value.split(/[?#]/, 1)[0]?.trim() || "/";
  if (!path.startsWith("/")) return "/";
  return path.slice(0, 180);
}

function cleanNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function cleanInteger(value: unknown) {
  const number = cleanNumber(value);
  return number === undefined ? undefined : Math.floor(number);
}

function transactionRef(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return createHash("sha256").update(value.trim()).digest("hex").slice(0, 20);
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 8_192) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const event = typeof input.event === "string" ? input.event : "";
  if (!EVENT_NAMES.has(event)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const sessionId = cleanId(input.session_id, 80);
  if (!sessionId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const source =
    input.source === "product_page" || input.source === "product_modal"
      ? input.source
      : undefined;
  const orderType =
    input.order_type === "pickup" || input.order_type === "shipping"
      ? input.order_type
      : undefined;

  const record = {
    event,
    session_id: sessionId,
    occurred_at:
      typeof input.occurred_at === "string"
        ? input.occurred_at.slice(0, 40)
        : new Date().toISOString(),
    path: cleanPath(input.path),
    currency: input.currency === "EUR" ? "EUR" : undefined,
    product_id: cleanId(input.product_id),
    variant_id: cleanId(input.variant_id),
    source,
    order_type: orderType,
    value: cleanNumber(input.value),
    quantity: cleanInteger(input.quantity),
    item_count: cleanInteger(input.item_count),
    transaction_ref:
      event === "purchase" ? transactionRef(input.transaction_id) : undefined,
  };

  console.info("[conversion:v463]", JSON.stringify(record));

  return NextResponse.json(
    { ok: true },
    { status: 202, headers: { "cache-control": "no-store" } },
  );
}
