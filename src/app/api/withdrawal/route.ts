import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { consumeRateLimit, publicApiErrorInfo, readJsonBody, tooManyRequests } from "@/lib/public-api";
import { sendWithdrawalAcknowledgement, sendWithdrawalMerchantNotification } from "@/lib/withdrawal-email";

export const runtime = "nodejs";

type OrderItem = { id: string; product_name: string; quantity: number };

function clean(value: unknown, max: number) {
  return String(value ?? "").replace(/\0/g, "").trim().slice(0, max);
}
function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function normalizeOrderNumber(value: unknown) {
  return clean(value, 80).toUpperCase();
}
function requestNumber(clientReference: string) {
  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const tail = clientReference.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `RET-${stamp}-${tail}`;
}

async function findOrder(
  supabase: NonNullable<ReturnType<typeof createServiceSupabase>>,
  orderNumber: string,
  email: string,
) {
  const { data, error } = await supabase
    .from("orders")
    .select("id,order_number,customer_first_name,customer_last_name,customer_email,created_at,status,payment_status,order_type,order_items(id,product_name,quantity)")
    .eq("order_number", orderNumber)
    .eq("customer_email", email)
    .maybeSingle();

  if (error) throw error;
  return data as
    | {
        id: string;
        order_number: string;
        customer_first_name: string;
        customer_last_name: string;
        customer_email: string;
        created_at: string;
        status: string;
        payment_status: string;
        order_type: string;
        order_items: OrderItem[];
      }
    | null;
}

export async function POST(request: Request) {
  try {
    const supabase = createServiceSupabase();
    if (!supabase) return NextResponse.json({ error: "Service indisponible." }, { status: 503 });

    const body = await readJsonBody<Record<string, unknown>>(request, 32_000);
    if (clean(body.website, 180)) return NextResponse.json({ ok: true });

    const action = clean(body.action, 20);
    const orderNumber = normalizeOrderNumber(body.orderNumber);
    const email = clean(body.email, 180).toLowerCase();

    if (!orderNumber || !email || !validEmail(email)) {
      return NextResponse.json(
        { error: "Numéro de commande ou e-mail invalide." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (action === "lookup") {
      const rate = await consumeRateLimit(request, supabase, {
        scope: "withdrawal:lookup",
        limit: 8,
        windowSeconds: 900,
      });
      if (!rate.allowed) return tooManyRequests(rate);

      const order = await findOrder(supabase, orderNumber, email);
      if (!order) {
        return NextResponse.json(
          { error: "Commande introuvable. Vérifiez le numéro et l’e-mail utilisés lors de l’achat." },
          { status: 404, headers: { "Cache-Control": "no-store" } },
        );
      }

      return NextResponse.json(
        {
          ok: true,
          order: {
            orderNumber: order.order_number,
            firstName: order.customer_first_name,
            lastName: order.customer_last_name,
            createdAt: order.created_at,
            orderType: order.order_type,
            items: (order.order_items ?? []).map((item) => ({
              id: item.id,
              productName: item.product_name,
              quantity: Number(item.quantity || 0),
            })),
          },
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (action !== "submit") {
      return NextResponse.json({ error: "Action invalide." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const rate = await consumeRateLimit(request, supabase, {
      scope: "withdrawal:submit",
      limit: 5,
      windowSeconds: 3600,
    });
    if (!rate.allowed) return tooManyRequests(rate);

    if (body.confirmed !== true) {
      return NextResponse.json(
        { error: "La confirmation de rétractation est requise." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const clientReference = clean(body.clientReference, 60).toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientReference)) {
      return NextResponse.json(
        { error: "Référence de demande invalide." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { data: duplicate, error: duplicateError } = await supabase
      .from("consumer_withdrawals")
      .select("id,request_number,order_number,acknowledgement_email,submitted_at,acknowledgement_sent_at")
      .eq("client_reference", clientReference)
      .maybeSingle();

    if (duplicateError) throw duplicateError;
    if (duplicate) {
      return NextResponse.json(
        {
          ok: true,
          duplicate: true,
          requestNumber: duplicate.request_number,
          submittedAt: duplicate.submitted_at,
          acknowledgementEmail: duplicate.acknowledgement_email,
          acknowledgementSent: Boolean(duplicate.acknowledgement_sent_at),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const order = await findOrder(supabase, orderNumber, email);
    if (!order) {
      return NextResponse.json(
        { error: "Commande introuvable. Vérifiez le numéro et l’e-mail utilisés lors de l’achat." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const firstName = clean(body.firstName, 100) || clean(order.customer_first_name, 100);
    const lastName = clean(body.lastName, 100) || clean(order.customer_last_name, 100);
    const acknowledgementEmail = clean(body.acknowledgementEmail, 180).toLowerCase();
    const customerNote = clean(body.customerNote, 2000);
    const locale = clean(body.locale, 2) === "en" ? "en" : "fr";

    if (!firstName || !acknowledgementEmail || !validEmail(acknowledgementEmail)) {
      return NextResponse.json(
        { error: "Identité ou e-mail d’accusé de réception invalide." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const requestedIds = Array.isArray(body.itemIds)
      ? [...new Set(body.itemIds.map((value) => clean(value, 80)).filter(Boolean))]
      : [];

    const orderItems = order.order_items ?? [];
    const orderItemIds = new Set(orderItems.map((item) => item.id));
    const selectedItems = requestedIds.length
      ? orderItems.filter((item) => requestedIds.includes(item.id))
      : orderItems;

    if (
      !selectedItems.length ||
      selectedItems.some((item) => !orderItemIds.has(item.id)) ||
      (requestedIds.length && selectedItems.length !== requestedIds.length)
    ) {
      return NextResponse.json(
        { error: "Sélection d’articles invalide." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const scope = selectedItems.length === orderItems.length ? "full" : "partial";
    const publicItems = selectedItems.map((item) => ({
      id: item.id,
      productName: clean(item.product_name, 300),
      quantity: Number(item.quantity || 0),
    }));
    const number = requestNumber(clientReference);
    const declarationText =
      scope === "full"
        ? `Je notifie ma décision de me rétracter de la commande ${order.order_number}.`
        : `Je notifie ma décision de me rétracter pour les articles sélectionnés de la commande ${order.order_number}.`;

    const { data: inserted, error: insertError } = await supabase
      .from("consumer_withdrawals")
      .insert({
        client_reference: clientReference,
        request_number: number,
        order_id: order.id,
        order_number: order.order_number,
        customer_first_name: firstName,
        customer_last_name: lastName,
        customer_email: email,
        acknowledgement_email: acknowledgementEmail,
        scope,
        selected_items: publicItems,
        declaration_text: declarationText,
        customer_note: customerNote,
        locale,
        status: "received",
      })
      .select("id,request_number,submitted_at,acknowledgement_email,scope,selected_items")
      .single();

    if (insertError || !inserted) throw insertError ?? new Error("WITHDRAWAL_INSERT_FAILED");

    const emailInput = {
      id: inserted.id,
      requestNumber: inserted.request_number,
      orderNumber: order.order_number,
      firstName,
      lastName,
      acknowledgementEmail,
      submittedAt: inserted.submitted_at,
      scope: inserted.scope as "full" | "partial",
      selectedItems: publicItems,
      customerNote,
    };

    let acknowledgementSent = false;
    try {
      const result = await sendWithdrawalAcknowledgement(emailInput);
      acknowledgementSent = result.sent;
      await supabase
        .from("consumer_withdrawals")
        .update({
          acknowledgement_sent_at: result.sent ? new Date().toISOString() : null,
          acknowledgement_error: result.sent ? null : result.reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", inserted.id);
    } catch (emailError) {
      console.error("Withdrawal acknowledgement email error", emailError);
      await supabase
        .from("consumer_withdrawals")
        .update({ acknowledgement_error: "send_failed", updated_at: new Date().toISOString() })
        .eq("id", inserted.id);
    }

    try {
      const { data: settingsRows } = await supabase.from("site_settings").select("key,value").in("key", ["support_email"]);
      const supportEmail = String(settingsRows?.find((row) => row.key === "support_email")?.value ?? "").trim();
      const merchantRecipient = process.env.CONTACT_NOTIFICATION_EMAIL?.trim() || supportEmail;

      if (merchantRecipient) {
        const merchant = await sendWithdrawalMerchantNotification(emailInput, merchantRecipient);
        if (merchant.sent) {
          await supabase
            .from("consumer_withdrawals")
            .update({ merchant_notification_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", inserted.id);
        }
      }
    } catch (merchantError) {
      console.error("Withdrawal merchant notification error", merchantError);
    }

    return NextResponse.json(
      {
        ok: true,
        requestNumber: inserted.request_number,
        submittedAt: inserted.submitted_at,
        acknowledgementEmail,
        acknowledgementSent,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Withdrawal API error", error);
    const publicError = publicApiErrorInfo(error);
    if (publicError) {
      return NextResponse.json(
        { error: publicError.message, code: publicError.code },
        { status: publicError.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { error: "Impossible d’enregistrer votre déclaration pour le moment. Réessayez dans quelques instants." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
