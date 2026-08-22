"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type OrderRow = { id: string; order_number: string; environment?: "test" | "live" | "legacy"; archived_at?: string | null; created_at: string; status: string; payment_status: string; payment_method?: "online" | "pickup"; source_channel?: "menu" | "shop" | "mixed"; order_type: "pickup" | "shipping"; customer_first_name: string; customer_last_name: string; customer_phone: string; customer_email: string; pickup_time: string | null; notes: string | null; subtotal: number; shipping_fee: number; total: number; shipping_method_name?: string | null; shipping_address1?: string | null; shipping_address2?: string | null; shipping_postal_code?: string | null; shipping_city?: string | null; shipping_country?: string | null; package_weight_g?: number | null; public_token?: string | null; tracking_carrier?: string | null; tracking_number?: string | null; tracking_url?: string | null; shipped_at?: string | null; confirmation_email_sent_at?: string | null; shipping_email_sent_at?: string | null; refund_email_sent_at?: string | null; pickup_ready_email_sent_at?: string | null; pickup_completed_email_sent_at?: string | null; stripe_refund_id?: string | null; promo_code?: string | null; discount_amount?: number | null; invoices?: Array<{ id: string; document_type: "invoice" | "credit_note"; document_number: string; email_sent_at?: string | null }>; order_items?: Array<{ id: string; product_name: string; quantity: number; line_total?: number; choices: Array<{ label?: string }> }> };
type ContactMessageRow = { id: string; created_at: string; updated_at?: string | null; status: "new" | "read" | "archived"; first_name: string; last_name: string; email: string; phone: string; message: string; locale?: "fr" | "en" };
type TrackingDraft = { carrier: string; number: string; url: string };
type QuickOrderAction =
  | {
      kind: "status";
      target: "preparing" | "ready" | "completed";
      label: string;
      note: string;
      confirm: boolean;
      confirmLabel?: string;
    }
  | {
      kind: "tracking";
      label: string;
      note: string;
      confirm: false;
    };
const TRACKING_CARRIERS = ["Colissimo", "Chronopost", "Mondial Relay", "DHL", "UPS", "Autre"] as const;

function buildTrackingUrl(carrier: string, trackingNumber: string) {
  const number = trackingNumber.trim();
  if (!number) return "";
  const encoded = encodeURIComponent(number);

  if (carrier === "Colissimo" || carrier === "Chronopost") {
    return `https://www.laposte.fr/outils/suivre-vos-envois?code=${encoded}`;
  }
  if (carrier === "Mondial Relay") return "https://www.mondialrelay.fr/suivi-de-colis/";
  if (carrier === "DHL") return "https://www.dhl.com/fr-fr/home/suivi.html";
  if (carrier === "UPS") return "https://www.ups.com/track?loc=fr_FR";
  return "";
}

export function AdminOrders({
  supabase,
  refreshKey = 0,
  onPendingCountChange,
}: {
  supabase: NonNullable<ReturnType<typeof createBrowserSupabase>>;
  refreshKey?: number;
  onPendingCountChange: (count: number) => void;
}) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderFilter, setOrderFilter] = useState("active");
  const [orderEnvironmentFilter, setOrderEnvironmentFilter] =
    useState<"live" | "test" | "all">("live");
  const [orderSearch, setOrderSearch] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [trackingEditOrderId, setTrackingEditOrderId] = useState<string | null>(null);
  const [trackingDraft, setTrackingDraft] = useState<TrackingDraft>({
    carrier: "",
    number: "",
    url: "",
  });
  const [statusEditOrderId, setStatusEditOrderId] = useState<string | null>(null);
  const [orderActionMessage, setOrderActionMessage] = useState("");
  const [emailActionKey, setEmailActionKey] = useState("");
  const [quickActionConfirmKey, setQuickActionConfirmKey] = useState("");
  const [quickActionBusyKey, setQuickActionBusyKey] = useState("");
  const [orderSoundEnabled, setOrderSoundEnabled] = useState(false);
  const orderSoundEnabledRef = useRef(false);
  const seenPendingOrders = useRef<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      const stored = window.localStorage.getItem("ichigo-order-sound");
      const enabled = stored === "1";
      setOrderSoundEnabled(enabled);
      orderSoundEnabledRef.current = enabled;
      void loadOrders();
    });

    const timer = window.setInterval(() => {
      if (!trackingEditOrderId) void loadOrders();
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [supabase, trackingEditOrderId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

function playNewOrderSound() {
    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = new AudioContextCtor();
      const now = context.currentTime;
      [0, 0.16].forEach((delay, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(index === 0 ? 880 : 1040, now + delay);
        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.18, now + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.13);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(now + delay); oscillator.stop(now + delay + 0.14);
      });
      window.setTimeout(() => context.close().catch(() => undefined), 700);
    } catch { /* browser may block audio until a user interaction */ }
  }
  async function loadOrders() {
    if (!supabase) return;
    const { data } = await supabase.from("orders").select("*, order_items(*), invoices(id,document_type,document_number,email_sent_at)").is("archived_at", null).order("created_at", { ascending: false }).limit(120);
    const rows = (data ?? []) as OrderRow[];
    const pendingIds = new Set(rows.filter((order) => (order.source_channel === "shop" || order.source_channel === "mixed" || (!order.source_channel && order.order_type === "shipping")) && order.status === "pending" && (order.payment_method !== "online" || order.payment_status === "paid")).map((order) => order.id));
    if (seenPendingOrders.current && orderSoundEnabledRef.current) {
      const hasNew = [...pendingIds].some((id) => !seenPendingOrders.current!.has(id));
      if (hasNew) playNewOrderSound();
    }
    seenPendingOrders.current = pendingIds;
    setOrders(rows);
    onPendingCountChange(
      rows.filter(
        (order) =>
          order.environment === "live" &&
          (order.source_channel === "shop" ||
            order.source_channel === "mixed" ||
            (!order.source_channel && order.order_type === "shipping")) &&
          order.status === "pending" &&
          (order.payment_method !== "online" || order.payment_status === "paid")
      ).length
    );
  }
  function toggleOrderSound() {
    const next = !orderSoundEnabled;
    setOrderSoundEnabled(next);
    orderSoundEnabledRef.current = next;
    window.localStorage.setItem("ichigo-order-sound", next ? "1" : "0");
    if (next) playNewOrderSound();
  }

function shippingEmailMessage(result: unknown) {
    if (result === "sent") return "E-mail d’expédition envoyé ✓";
    if (result === "already_sent") return "E-mail d’expédition déjà envoyé ✓";
    if (result === "missing_recipient") return "Commande expédiée ✓ · aucun e-mail client renseigné";
    if (result === "email_not_configured") return "Commande expédiée ✓ · e-mail non configuré";
    if (result === "failed") return "Commande expédiée ✓ · e-mail à vérifier";
    return "Commande expédiée ✓";
  }

function pickupLifecycleEmailMessage(status: string, result: unknown) {
    const label =
      status === "ready"
        ? "Commande prête au retrait"
        : "Commande remise";
    if (result === "sent") return `${label} ✓ · e-mail client envoyé`;
    if (result === "already_sent") return `${label} ✓ · e-mail déjà envoyé`;
    if (result === "missing_recipient") return `${label} ✓ · aucun e-mail client renseigné`;
    if (result === "email_not_configured") return `${label} ✓ · e-mail non configuré`;
    if (result === "failed") return `${label} ✓ · envoi e-mail à vérifier`;
    return `${label} ✓`;
  }

function emailStatusText(sentAt?: string | null) {
    if (!sentAt) return "Non envoyé";
    return `Envoyé le ${new Date(sentAt).toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    })}`;
  }

function emailActionLabel(sentAt?: string | null) {
    return sentAt ? "Renvoyer" : "Envoyer";
  }

async function updateOrder(id: string, status: string) {
    if (!supabase) return;
    const order = orders.find((item) => item.id === id);
    if (!order) return;
    setOrderActionMessage("Enregistrement…");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return setOrderActionMessage("Session admin expirée.");
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          status,
          trackingCarrier: order.tracking_carrier ?? "",
          trackingNumber: order.tracking_number ?? "",
          trackingUrl: order.tracking_url ?? "",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (status === "cancelled" && data.cancelled === true) {
          await loadOrders();
        }
        throw new Error(data.error || "Modification impossible.");
      }
      if (status === "refunded") {
        setOrderActionMessage("Remboursement transmis à Stripe ✓");
      } else if (status === "cancelled") {
        setOrderActionMessage("Commande annulée ✓ · réservations libérées");
      } else if (status === "completed" && order.order_type === "shipping") {
        setOrderActionMessage(shippingEmailMessage(data.shippingEmail));
      } else if (
        order.order_type === "pickup" &&
        ["ready", "completed"].includes(status)
      ) {
        setOrderActionMessage(pickupLifecycleEmailMessage(status, data.pickupEmail));
      } else {
        setOrderActionMessage("Commande enregistrée ✓");
      }
      await loadOrders();
    } catch (error) {
      setOrderActionMessage(error instanceof Error ? error.message : "Modification impossible.");
    }
  }

  function toggleTrackingEditor(order: OrderRow) {
    if (trackingEditOrderId === order.id) {
      setTrackingEditOrderId(null);
      setTrackingDraft({ carrier: "", number: "", url: "" });
      return;
    }

    const savedCarrier = String(order.tracking_carrier || "").trim();
    const carrier = TRACKING_CARRIERS.includes(savedCarrier as (typeof TRACKING_CARRIERS)[number])
      ? savedCarrier
      : savedCarrier
        ? "Autre"
        : "Colissimo";
    const number = String(order.tracking_number || "");
    const generatedUrl = buildTrackingUrl(carrier, number);

    setTrackingDraft({
      carrier,
      number,
      url: order.tracking_url || generatedUrl,
    });
    setTrackingEditOrderId(order.id);
  }

  async function saveTracking(orderId: string, markShipped = false) {
    if (!supabase) return false;

    const order = orders.find((item) => item.id === orderId);
    if (!order) return false;

    const number = trackingDraft.number.trim();
    if (!number) {
      setOrderActionMessage("Ajoutez un numéro de suivi.");
      return false;
    }

    setOrderActionMessage(markShipped ? "Enregistrement et expédition…" : "Enregistrement du suivi…");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setOrderActionMessage("Session admin expirée.");
      return false;
    }

    const carrier = trackingDraft.carrier.trim() || "Colissimo";
    const url = carrier === "Autre"
      ? trackingDraft.url.trim()
      : buildTrackingUrl(carrier, number);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...(markShipped ? { status: "completed" } : {}),
          trackingCarrier: carrier,
          trackingNumber: number,
          trackingUrl: url,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || (markShipped ? "Impossible de marquer la commande comme expédiée." : "Impossible d’enregistrer le suivi."));

      setOrders((current) =>
        current.map((item) =>
          item.id === orderId
            ? {
                ...item,
                ...(markShipped ? { status: "completed", shipped_at: item.shipped_at || new Date().toISOString() } : {}),
                tracking_carrier: carrier || null,
                tracking_number: number,
                tracking_url: url || null,
              }
            : item
        )
      );

      setOrderActionMessage(
        markShipped
          ? shippingEmailMessage(data.shippingEmail)
          : "Suivi enregistré ✓"
      );
      setTrackingEditOrderId(null);
      setTrackingDraft({ carrier: "", number: "", url: "" });
      await loadOrders();
      return true;
    } catch (error) {
      setOrderActionMessage(error instanceof Error ? error.message : "Modification impossible.");
      return false;
    }
  }

  async function markOrderCompleted(order: OrderRow) {
    if (order.order_type !== "shipping") {
      await updateOrder(order.id, "completed");
      return;
    }

    if (!String(order.tracking_number || "").trim()) {
      setOrderActionMessage("Ajoutez d’abord le numéro de suivi avant de marquer le colis comme expédié.");
      if (trackingEditOrderId !== order.id) toggleTrackingEditor(order);
      return;
    }

    await updateOrder(order.id, "completed");
  }

  function quickStatusKey(
    order: OrderRow,
    target: "preparing" | "ready" | "completed"
  ) {
    return `${order.id}:${target}`;
  }

  async function runQuickStatusAction(
    order: OrderRow,
    target: "preparing" | "ready" | "completed"
  ) {
    if (quickActionBusyKey) return;

    const key = quickStatusKey(order, target);
    setQuickActionConfirmKey("");
    setQuickActionBusyKey(key);

    try {
      if (target === "completed") {
        await markOrderCompleted(order);
      } else {
        await updateOrder(order.id, target);
      }
    } finally {
      setQuickActionBusyKey("");
    }
  }

  function openQuickTracking(order: OrderRow) {
    setQuickActionConfirmKey("");
    setExpandedOrderId(order.id);

    if (trackingEditOrderId !== order.id) {
      toggleTrackingEditor(order);
    }
  }

  async function invoiceAction(order: OrderRow, action: "issue" | "email" | "credit_note" | "credit_note_email") {
    if (!supabase) return;
    const actionKey = `${order.id}:${action}`;
    setEmailActionKey(actionKey);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setEmailActionKey("");
      return setOrderActionMessage("Session admin expirée.");
    }
    setOrderActionMessage(
      action === "email"
        ? "Envoi de la facture…"
        : action === "credit_note_email"
          ? "Envoi de l’avoir…"
          : action === "credit_note"
            ? "Création de l’avoir…"
            : "Création de la facture…"
    );
    try {
      const response = await fetch(`/api/admin/invoices/${order.id}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action facture impossible.");
      setOrderActionMessage(
        action === "email"
          ? "Facture envoyée ✓"
          : action === "credit_note_email"
            ? "Avoir envoyé ✓"
            : action === "credit_note"
              ? "Avoir créé ✓"
              : "Facture créée ✓"
      );
      await loadOrders();
    } catch (error) {
      setOrderActionMessage(error instanceof Error ? error.message : "Action facture impossible.");
    } finally {
      setEmailActionKey("");
    }
  }

  async function orderEmailAction(order: OrderRow, kind: "confirmation" | "shipping" | "refund" | "pickup_ready" | "pickup_completed") {
    if (!supabase) return;
    const actionKey = `${order.id}:${kind}`;
    setEmailActionKey(actionKey);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setEmailActionKey("");
      return setOrderActionMessage("Session admin expirée.");
    }

    const labels = {
      confirmation: "confirmation",
      shipping: "expédition",
      refund: "remboursement",
      pickup_ready: "commande prête au retrait",
      pickup_completed: "retrait terminé",
    } as const;

    setOrderActionMessage(`Envoi de l’e-mail de ${labels[kind]}…`);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ emailKind: kind }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Envoi impossible.");
      setOrderActionMessage(`E-mail de ${labels[kind]} envoyé ✓`);
      await loadOrders();
    } catch (error) {
      setOrderActionMessage(error instanceof Error ? error.message : "Envoi impossible.");
    } finally {
      setEmailActionKey("");
    }
  }

  async function markPickupPaid(id: string) {
    if (!supabase) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return setOrderActionMessage("Session admin expirée.");
    setOrderActionMessage("Enregistrement du paiement…");
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ markPaid: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Modification impossible.");
      setOrderActionMessage("Paiement au retrait enregistré ✓");
      await loadOrders();
    } catch (error) {
      setOrderActionMessage(error instanceof Error ? error.message : "Modification impossible.");
    }
  }

function orderAwaitingPayment(order: OrderRow) {
    return (
      order.status === "pending" &&
      order.payment_method === "online" &&
      ["pending", "unpaid", "failed", "expired"].includes(order.payment_status)
    );
  }

  function orderReadyForProduction(order: OrderRow) {
    return order.payment_method !== "online" || order.payment_status === "paid";
  }

  function orderPriorityMeta(order: OrderRow) {
    if (order.payment_status === "refund_failed") {
      return {
        tone: "alert",
        label: "À VÉRIFIER",
        detail: "Remboursement Stripe en échec",
      };
    }

    if (order.payment_status === "refund_pending") {
      return {
        tone: "waiting",
        label: "STRIPE EN COURS",
        detail: "Remboursement en traitement",
      };
    }

    if (order.status === "refunded" || order.payment_status === "refunded") {
      return {
        tone: "done",
        label: "REMBOURSÉE",
        detail: "Commande clôturée",
      };
    }

    if (order.status === "cancelled") {
      return {
        tone: "done",
        label: "ANNULÉE",
        detail: "Hors du flux de production",
      };
    }

    if (order.payment_method === "online" && order.payment_status === "failed") {
      return {
        tone: "alert",
        label: "PAIEMENT ÉCHOUÉ",
        detail: "Le client doit relancer le paiement",
      };
    }

    if (order.payment_method === "online" && order.payment_status === "expired") {
      return {
        tone: "alert",
        label: "PAIEMENT EXPIRÉ",
        detail: "Le client doit relancer le paiement",
      };
    }

    if (orderAwaitingPayment(order) || !orderReadyForProduction(order)) {
      return {
        tone: "waiting",
        label: "EN ATTENTE",
        detail: "Paiement Stripe à confirmer",
      };
    }

    if (
      order.customer_email &&
      order.order_type === "pickup" &&
      ["ready", "completed"].includes(order.status) &&
      !order.pickup_ready_email_sent_at
    ) {
      return {
        tone: "alert",
        label: "E-MAIL À VÉRIFIER",
        detail: "Notification « prête au retrait » non confirmée",
      };
    }

    if (
      order.customer_email &&
      order.order_type === "pickup" &&
      order.status === "completed" &&
      !order.pickup_completed_email_sent_at
    ) {
      return {
        tone: "alert",
        label: "E-MAIL À VÉRIFIER",
        detail: "E-mail de fin de retrait non confirmé",
      };
    }

    if (
      order.customer_email &&
      order.order_type === "shipping" &&
      order.status === "completed" &&
      order.tracking_number &&
      !order.shipping_email_sent_at
    ) {
      return {
        tone: "alert",
        label: "E-MAIL À VÉRIFIER",
        detail: "Notification d’expédition non confirmée",
      };
    }

    if (order.status === "pending") {
      return {
        tone: "action",
        label: "À PRÉPARER",
        detail:
          order.order_type === "shipping"
            ? "Démarrer la préparation du colis"
            : "Démarrer la préparation",
      };
    }

    if (order.status === "preparing") {
      return {
        tone: "action",
        label: "À CONTINUER",
        detail:
          order.order_type === "shipping"
            ? "Passer à « Colis prêt »"
            : "Passer à « Prête »",
      };
    }

    if (order.status === "ready") {
      return order.order_type === "shipping"
        ? {
            tone: "action",
            label: "À EXPÉDIER",
            detail: order.tracking_number
              ? "Suivi enregistré · marquer expédiée"
              : "Ajouter le suivi puis expédier",
          }
        : {
            tone: "action",
            label: "À REMETTRE",
            detail: "Commande prête pour le client",
          };
    }

    if (order.status === "completed") {
      return {
        tone: "done",
        label: order.order_type === "shipping" ? "EXPÉDIÉE" : "REMISE",
        detail: "Flux terminé",
      };
    }

    return {
      tone: "neutral",
      label: "SUIVI",
      detail: "Consulter les détails",
    };
  }

  function orderOperationalRank(order: OrderRow) {
    const priority = orderPriorityMeta(order);

    if (priority.tone === "alert") return 0;
    if (orderReadyForProduction(order) && order.status === "ready") return 1;
    if (orderReadyForProduction(order) && order.status === "preparing") return 2;
    if (orderReadyForProduction(order) && order.status === "pending") return 3;
    if (priority.tone === "waiting") return 4;
    if (priority.tone === "done") return 5;

    return 6;
  }

  function compareOperationalOrders(a: OrderRow, b: OrderRow) {
    const rankDifference =
      orderOperationalRank(a) - orderOperationalRank(b);

    if (rankDifference !== 0) return rankDifference;

    const aCreatedAt = Date.parse(a.created_at);
    const bCreatedAt = Date.parse(b.created_at);
    const safeACreatedAt = Number.isFinite(aCreatedAt)
      ? aCreatedAt
      : Number.MAX_SAFE_INTEGER;
    const safeBCreatedAt = Number.isFinite(bCreatedAt)
      ? bCreatedAt
      : Number.MAX_SAFE_INTEGER;

    if (safeACreatedAt !== safeBCreatedAt) {
      return safeACreatedAt - safeBCreatedAt;
    }

    return a.order_number.localeCompare(b.order_number, "fr");
  }

function selectOrderEnvironment(environment: "live" | "test" | "all") {
    setOrderEnvironmentFilter(environment);
    // Changing environment should immediately reveal all orders in that environment.
    setOrderFilter("all");
  }

const orderMatchesZone = (order: OrderRow) => order.source_channel === "shop" || order.source_channel === "mixed" || (!order.source_channel && order.order_type === "shipping");
  const zoneOrders = orders.filter((order) => orderMatchesZone(order));
  const statsOrders = zoneOrders.filter((order) =>
    orderEnvironmentFilter === "all"
      ? true
      : order.environment === orderEnvironmentFilter
  );
  const productionStatsOrders = statsOrders.filter((order) => orderReadyForProduction(order));
  const orderStats = {
    payment: statsOrders.filter((order) => orderAwaitingPayment(order)).length,
    pending: productionStatsOrders.filter((order) => order.status === "pending").length,
    preparing: productionStatsOrders.filter((order) => order.status === "preparing").length,
    ready: productionStatsOrders.filter((order) => order.status === "ready").length,
    active: productionStatsOrders.filter((order) => ["pending", "preparing", "ready"].includes(order.status)).length,
  };
  const search = orderSearch.trim().toLowerCase();
  const filteredOrders = orders.filter((order) => {
  const matchesFilter =
    orderFilter === "all"
      ? true
      : orderFilter === "payment"
        ? orderAwaitingPayment(order)
        : orderFilter === "active"
          ? orderReadyForProduction(order) && ["pending", "preparing", "ready"].includes(order.status)
          : ["pending", "preparing", "ready"].includes(orderFilter)
            ? orderReadyForProduction(order) && order.status === orderFilter
            : order.status === orderFilter;

  const matchesEnvironment =
    orderEnvironmentFilter === "all"
      ? true
      : order.environment === orderEnvironmentFilter;

  const haystack =
    `${order.order_number} ${order.customer_first_name} ${order.customer_last_name} ${order.customer_phone} ${order.customer_email} ${order.shipping_city ?? ""}`.toLowerCase();

  return (
    orderMatchesZone(order) &&
    matchesFilter &&
    matchesEnvironment &&
    (!search || haystack.includes(search))
  );
});

  const smartQueueEnabled = [
    "active",
    "all",
    "payment",
    "pending",
    "preparing",
    "ready",
  ].includes(orderFilter);

  const visibleOrders = smartQueueEnabled
    ? [...filteredOrders].sort(compareOperationalOrders)
    : filteredOrders;

  const smartQueueMessage = ["pending", "preparing", "ready"].includes(
    orderFilter
  )
    ? "Dans cette étape, les commandes les plus anciennes passent d’abord."
    : "Alertes → prêtes → préparation → nouvelles → attente. À priorité égale, les plus anciennes passent d’abord.";

  return (
<div className="orders-admin orders-v214 orders-v227">
      <div className="section-inline orders-heading"><div><h2>Commandes</h2><p className="muted">Commandes de la Boutique en ligne : paiement, préparation, retrait ou expédition.</p></div><div className="orders-heading-actions"><button type="button" className={orderSoundEnabled ? "sound-toggle active" : "sound-toggle"} onClick={toggleOrderSound}>{orderSoundEnabled ? "🔔 Son activé" : "🔕 Activer le son"}</button><button onClick={loadOrders}>Actualiser</button></div></div>
      {orderActionMessage && <p className={orderActionMessage.includes("✓") ? "save-message success" : "save-message"}>{orderActionMessage}</p>}
      <div className="production-order-note-v227"><strong>Flux production</strong><span>Retrait : paiement confirmé → préparation → prête → remise. Livraison : paiement confirmé → préparation → suivi colis → expédition. Les paiements non confirmés restent hors production.</span></div>
      <div className="order-kpis"><button className={orderFilter === "active" ? "active" : ""} onClick={() => setOrderFilter("active")}><span>À traiter</span><strong>{orderStats.active}</strong></button><button className={orderFilter === "pending" ? "active" : ""} onClick={() => setOrderFilter("pending")}><span>Nouvelles</span><strong>{orderStats.pending}</strong></button><button className={orderFilter === "preparing" ? "active" : ""} onClick={() => setOrderFilter("preparing")}><span>En préparation</span><strong>{orderStats.preparing}</strong></button><button className={orderFilter === "ready" ? "active" : ""} onClick={() => setOrderFilter("ready")}><span>Prêtes</span><strong>{orderStats.ready}</strong></button></div>
      <div className="order-environment-switch order-environment-switch-v351">
  <button
    type="button"
    className={orderEnvironmentFilter === "live" ? "active live" : ""}
    onClick={() => selectOrderEnvironment("live")}
  >
    LIVE
    <strong>
      {zoneOrders.filter((order) => order.environment === "live").length}
    </strong>
  </button>

  <button
    type="button"
    className={orderEnvironmentFilter === "test" ? "active test" : ""}
    onClick={() => selectOrderEnvironment("test")}
  >
    TEST
    <strong>
      {zoneOrders.filter((order) => order.environment === "test").length}
    </strong>
  </button>

  <button
    type="button"
    className={orderEnvironmentFilter === "all" ? "active all" : ""}
    onClick={() => selectOrderEnvironment("all")}
  >
    Toutes
  </button>
</div>
      <div className="order-toolbar"><div className="order-filters">{[["active","Actives"],["pending","Nouvelles"],["preparing","Préparation"],["ready","Prêtes"],["payment",`Paiements (${orderStats.payment})`],["completed","Terminées / expédiées"],["cancelled","Annulées"],["refunded","Remboursées"],["all","Toutes"]].map(([value,label]) => <button key={value} className={orderFilter === value ? "active" : ""} onClick={() => setOrderFilter(value)}>{label}</button>)}</div><input className="order-search" value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} placeholder="N° commande, nom, téléphone, ville…" /></div>
      {smartQueueEnabled && (
        <div className="order-smart-queue-v439">
          <strong>Priorité automatique</strong>
          <span>{smartQueueMessage}</span>
        </div>
      )}
      {visibleOrders.length ? <div className="order-grid">{visibleOrders.map((order) => {
        const paymentBlocked =
          !["cancelled", "refunded"].includes(order.status) &&
          order.payment_method === "online" &&
          order.payment_status !== "paid";
        const orderPriority = orderPriorityMeta(order);
        const quickAction: QuickOrderAction | null =
          orderPriority.tone !== "action" || !orderReadyForProduction(order)
            ? null
            : order.status === "pending"
              ? {
                  kind: "status",
                  target: "preparing",
                  label: "Préparer",
                  note: "Passe la commande en préparation.",
                  confirm: false,
                }
              : order.status === "preparing"
                ? order.order_type === "pickup"
                  ? {
                      kind: "status",
                      target: "ready",
                      label: "Prête",
                      note: "Enverra l’e-mail « prête au retrait » au client.",
                      confirm: true,
                      confirmLabel: "Confirmer Prête + e-mail",
                    }
                  : {
                      kind: "status",
                      target: "ready",
                      label: "Colis prêt",
                      note: "Aucun e-mail client à cette étape.",
                      confirm: false,
                    }
                : order.status === "ready"
                  ? order.order_type === "pickup"
                    ? {
                        kind: "status",
                        target: "completed",
                        label: "Remise",
                        note: "Confirme la remise et enverra l’e-mail final au client.",
                        confirm: true,
                        confirmLabel: "Confirmer Remise + e-mail",
                      }
                    : order.tracking_number
                      ? {
                          kind: "status",
                          target: "completed",
                          label: "Expédier",
                          note: "Confirme l’expédition et enverra l’e-mail de suivi.",
                          confirm: true,
                          confirmLabel: "Confirmer Expédiée + e-mail",
                        }
                      : {
                          kind: "tracking",
                          label: "Ajouter suivi",
                          note: "Le suivi est requis avant l’expédition.",
                          confirm: false,
                        }
                  : null;
        const quickActionKey =
          quickAction?.kind === "status"
            ? quickStatusKey(order, quickAction.target)
            : "";
        const quickConfirmArmed =
          Boolean(quickActionKey) &&
          quickActionConfirmKey === quickActionKey;
        const quickBusy =
          Boolean(quickActionKey) &&
          quickActionBusyKey === quickActionKey;
        const quickActionLocked = Boolean(quickActionBusyKey);
        const paymentLabel = order.payment_status === "paid" ? "Payée" : order.payment_status === "refunded" ? "Remboursée" : order.payment_status === "refund_pending" ? "Remboursement en cours" : order.payment_status === "refund_failed" ? "Remboursement à vérifier" : order.payment_status === "pending" ? "En attente Stripe" : order.payment_status === "failed" ? "Échec paiement" : order.payment_status === "expired" ? "Paiement expiré" : order.payment_method === "pickup" ? "Au retrait" : "À payer";
        const canRefund = order.payment_method === "online" && Number(order.total) > 0 && ["paid", "refund_failed"].includes(order.payment_status) && order.status !== "refunded";
        const railStatusLabel =
          order.status === "pending"
            ? "Nouvelle"
            : order.status === "preparing"
              ? "En préparation"
              : order.status === "ready"
                ? order.order_type === "shipping"
                  ? "Prête à expédier"
                  : "Prête au retrait"
                : order.status === "completed"
                  ? order.order_type === "shipping"
                    ? "Expédiée"
                    : "Terminée"
                  : order.status === "cancelled"
                    ? "Annulée"
                    : order.status === "refunded"
                      ? "Remboursée"
                      : order.status;

        const railStatusDetail =
          order.status === "pending"
            ? "Commande à prendre en charge."
            : order.status === "preparing"
              ? "Préparation en cours."
              : order.status === "ready"
                ? order.order_type === "shipping"
                  ? "Colis prêt pour l’expédition."
                  : "Commande prête pour le client."
                : order.status === "completed"
                  ? order.order_type === "shipping"
                    ? "Expédition terminée."
                    : "Retrait terminé."
                  : order.status === "cancelled"
                    ? "Commande sortie du flux de production."
                    : order.status === "refunded"
                      ? "Commande remboursée et clôturée."
                      : "Consulter la commande.";

        const railStatusTone =
          ["completed", "refunded"].includes(order.status)
            ? "done"
            : order.status === "cancelled"
              ? "closed"
              : orderPriority.tone === "alert"
                ? "alert"
                : orderPriority.tone === "waiting"
                  ? "waiting"
                  : "active";

        const canEditStatus =
          order.status !== "refunded" &&
          order.payment_status !== "refund_pending";

        const invoiceDoc = order.invoices?.find((doc) => doc.document_type === "invoice");
        const creditNoteDoc = order.invoices?.find((doc) => doc.document_type === "credit_note");
        const confirmationEmailEligible = ["paid", "refunded"].includes(order.payment_status);
        const shippingEmailEligible =
          order.order_type === "shipping" &&
          order.status === "completed" &&
          Boolean(order.tracking_number);
        const refundEmailEligible = order.payment_status === "refunded";
        const pickupReadyEmailEligible =
          order.order_type === "pickup" &&
          ["ready", "completed"].includes(order.status);
        const pickupCompletedEmailEligible =
          order.order_type === "pickup" && order.status === "completed";
        const showEmailRecovery =
          confirmationEmailEligible ||
          Boolean(invoiceDoc) ||
          shippingEmailEligible ||
          refundEmailEligible ||
          pickupReadyEmailEligible ||
          pickupCompletedEmailEligible ||
          Boolean(creditNoteDoc);

        const lifecycleEmailNeedsAttention =
          Boolean(order.customer_email) &&
          ((confirmationEmailEligible &&
            !order.confirmation_email_sent_at) ||
            (shippingEmailEligible && !order.shipping_email_sent_at) ||
            (refundEmailEligible && !order.refund_email_sent_at) ||
            (pickupReadyEmailEligible &&
              !order.pickup_ready_email_sent_at) ||
            (pickupCompletedEmailEligible &&
              !order.pickup_completed_email_sent_at));

        const pickupStatusRank =
          order.status === "completed"
            ? 3
            : order.status === "ready"
              ? 2
              : order.status === "preparing"
                ? 1
                : order.status === "pending"
                  ? 0
                  : -1;

        const pickupFlowActive =
          order.order_type === "pickup" &&
          !["cancelled", "refunded"].includes(order.status);

        const pickupFlowReady = orderReadyForProduction(order);

        const pickupTimeline = pickupFlowActive
          ? [
              {
                key: "confirmed",
                label: "Confirmée",
                state: !pickupFlowReady
                  ? "blocked"
                  : pickupStatusRank === 0
                    ? "current"
                    : "done",
                detail: !pickupFlowReady
                  ? "Paiement Stripe en attente"
                  : order.confirmation_email_sent_at
                    ? emailStatusText(order.confirmation_email_sent_at)
                    : "Commande enregistrée",
                attention: false,
              },
              {
                key: "preparing",
                label: "En préparation",
                state:
                  pickupStatusRank < 1
                    ? "upcoming"
                    : pickupStatusRank === 1
                      ? "current"
                      : "done",
                detail:
                  pickupStatusRank < 1
                    ? "À faire"
                    : "Étape interne · aucun e-mail client",
                attention: false,
              },
              {
                key: "ready",
                label: "Prête",
                state:
                  pickupStatusRank < 2
                    ? "upcoming"
                    : pickupStatusRank === 2
                      ? "current"
                      : "done",
                detail:
                  pickupStatusRank < 2
                    ? "L’e-mail de retrait sera envoyé à cette étape"
                    : order.pickup_ready_email_sent_at
                      ? emailStatusText(order.pickup_ready_email_sent_at)
                      : "E-mail « prête à retirer » à vérifier",
                attention:
                  pickupStatusRank >= 2 && !order.pickup_ready_email_sent_at,
              },
              {
                key: "completed",
                label: "Remise",
                state: pickupStatusRank < 3 ? "upcoming" : "done",
                detail:
                  pickupStatusRank < 3
                    ? "L’e-mail final sera envoyé à la remise"
                    : order.pickup_completed_email_sent_at
                      ? emailStatusText(order.pickup_completed_email_sent_at)
                      : "E-mail de fin de retrait à vérifier",
                attention:
                  pickupStatusRank >= 3 && !order.pickup_completed_email_sent_at,
              },
            ]
          : [];

        const pickupNextAction = !pickupFlowReady
          ? "Attendre la confirmation du paiement avant préparation."
          : order.status === "pending"
            ? "Prochaine action : préparer la commande."
            : order.status === "preparing"
              ? "Prochaine action : passer à Prête — l’e-mail de retrait sera envoyé."
              : order.status === "ready"
                ? "Prochaine action : confirmer Remise — l’e-mail final sera envoyé."
                : order.status === "completed"
                  ? "Retrait terminé."
                  : "";

        return <article className={`order-card status-${order.status} channel-shop admin-priority-${orderPriority.tone}-v438 ${order.status === "pending" ? "is-new" : ""}`} key={order.id}><div className="order-compact-summary-v248">
  <div>
    <strong>
      {order.customer_first_name} {order.customer_last_name}
    </strong>

    <span>
      {order.order_type === "shipping"
        ? `${order.shipping_city || "Livraison"} · ${
            order.order_items?.reduce(
              (sum, item) => sum + Number(item.quantity || 0),
              0
            ) || 0
          } article(s) · ${order.package_weight_g || 0} g`
        : order.pickup_time
          ? `Retrait · ${new Date(order.pickup_time).toLocaleString("fr-FR", {
              dateStyle: "short",
              timeStyle: "short",
            })}`
          : "Retrait boutique"}
    </span>
  </div>

  <div
    className={`order-priority-v438 ${orderPriority.tone}`}
    aria-label={`${orderPriority.label} : ${orderPriority.detail}`}
  >
    <span>{orderPriority.label}</span>
    <small>{orderPriority.detail}</small>
  </div>

  {quickAction && (
    <div
      className={`order-quick-action-v440${quickConfirmArmed ? " confirming" : ""}`}
    >
      {quickAction.kind === "tracking" ? (
        <>
          <button
            type="button"
            className="button primary small"
            disabled={quickActionLocked}
            onClick={() => openQuickTracking(order)}
          >
            Ajouter suivi
          </button>
          <small>{quickAction.note}</small>
        </>
      ) : quickAction.confirm && quickConfirmArmed ? (
        <>
          <small className="order-quick-warning-v440">
            {quickAction.note}
          </small>
          <div className="order-quick-confirm-actions-v440">
            <button
              type="button"
              className="button primary small"
              disabled={quickActionLocked}
              onClick={() =>
                void runQuickStatusAction(order, quickAction.target)
              }
            >
              {quickBusy
                ? "Enregistrement…"
                : quickAction.confirmLabel || quickAction.label}
            </button>
            <button
              type="button"
              className="button ghost small"
              disabled={quickActionLocked}
              onClick={() => setQuickActionConfirmKey("")}
            >
              Annuler
            </button>
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            className="button primary small"
            disabled={quickActionLocked}
            onClick={() => {
              if (quickAction.confirm) {
                setQuickActionConfirmKey(
                  quickStatusKey(order, quickAction.target)
                );
                return;
              }

              void runQuickStatusAction(order, quickAction.target);
            }}
          >
            {quickBusy ? "Enregistrement…" : quickAction.label}
          </button>
          <small>{quickAction.note}</small>
        </>
      )}
    </div>
  )}

  <button
    type="button"
    className="button ghost small order-details-toggle-v248"
    onClick={() =>
      setExpandedOrderId((current) =>
        current === order.id ? null : order.id
      )
    }
  >
    {expandedOrderId === order.id ? "Fermer ↑" : "Détails ↓"}
  </button>
</div>
          <div className="order-card-top"><div><span className={`order-status-dot ${order.status}`}></span><strong>{order.order_number}</strong><span>{new Date(order.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span><span className="channel-pill shop">Boutique</span>{order.environment && <span className={`order-env-pill-v246 ${order.environment}`}>{order.environment === "live" ? "LIVE" : order.environment === "test" ? "TEST" : "LEGACY"}</span>}</div><div><span className={`payment-pill ${order.payment_status}`}>{paymentLabel}</span><strong>{Number(order.total).toFixed(2)} €</strong></div></div>
          {expandedOrderId === order.id && (
  <div className="order-body order-body-density-v443"><div className="order-main order-main-density-v443"><div className="order-customer order-customer-density-v443"><strong>{order.customer_first_name} {order.customer_last_name}</strong><a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a>{order.customer_email && <a href={`mailto:${order.customer_email}`}>{order.customer_email}</a>}<span className="pickup-pill">{order.order_type === "shipping" ? `Livraison · ${order.package_weight_g || 0} g` : order.pickup_time ? `Retrait ${new Date(order.pickup_time).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}` : "Retrait boutique"}</span></div>
          {order.order_type === "shipping" && (
  <>
    <div className="order-shipping-box order-shipping-box-density-v443">
      <strong>{order.shipping_method_name || "Livraison"}</strong>

      <span>
        {[
          order.shipping_address1,
          order.shipping_address2,
          `${order.shipping_postal_code || ""} ${order.shipping_city || ""}`.trim(),
          order.shipping_country === "FR"
            ? "France"
            : order.shipping_country,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>

      <small>
        Frais : {Number(order.shipping_fee || 0).toFixed(2)} €
        {" · "}
        Poids colis : {Number(order.package_weight_g || 0)} g
      </small>
    </div>

    <div className="tracking-compact-v249 tracking-compact-density-v443">
      <div className="tracking-compact-head-v249">
        <div>
          <span className="tracking-label-v249">SUIVI</span>

          {order.tracking_number ? (
            <>
              <strong>
                {order.tracking_carrier || "Transporteur"} ·{" "}
                {order.tracking_number}
              </strong>

              {order.shipped_at && (
                <small>
                  Expédiée le{" "}
                  {new Date(order.shipped_at).toLocaleDateString("fr-FR")}
                </small>
              )}
            </>
          ) : (
            <>
              <strong>Aucun suivi enregistré</strong>
              <small>
                Ajoutez le numéro lorsque le colis est prêt à partir.
              </small>
            </>
          )}
        </div>

        <div className="tracking-compact-actions-v249">
          {order.tracking_url && order.tracking_number && (
            <a
              href={order.tracking_url}
              target="_blank"
              rel="noreferrer"
              className="button ghost small"
            >
              Ouvrir ↗
            </a>
          )}

          <button
            type="button"
            className="button ghost small"
            onClick={() => toggleTrackingEditor(order)}
          >
            {trackingEditOrderId === order.id
              ? "Fermer"
              : order.tracking_number
                ? "Modifier"
                : "+ Ajouter"}
          </button>
        </div>
      </div>

      {trackingEditOrderId === order.id && (
        <div className="tracking-admin-grid-v227 tracking-editor-v249">
          <label>
            Transporteur
            <select
              value={trackingDraft.carrier}
              onChange={(e) => {
                const carrier = e.target.value;
                setTrackingDraft((current) => ({
                  ...current,
                  carrier,
                  url: carrier === "Autre" ? current.url : buildTrackingUrl(carrier, current.number),
                }));
              }}
            >
              {TRACKING_CARRIERS.map((carrier) => (
                <option key={carrier} value={carrier}>{carrier}</option>
              ))}
            </select>
          </label>

          <label>
            N° de suivi
            <input
              value={trackingDraft.number}
              placeholder="XXXXXXXXXXXXX"
              autoComplete="off"
              onChange={(e) => {
                const number = e.target.value;
                setTrackingDraft((current) => ({
                  ...current,
                  number,
                  url: current.carrier === "Autre" ? current.url : buildTrackingUrl(current.carrier, number),
                }));
              }}
            />
          </label>

          {trackingDraft.carrier === "Autre" ? (
            <label className="tracking-url-field-v227">
              Lien de suivi
              <input
                value={trackingDraft.url}
                placeholder="https://…"
                onChange={(e) =>
                  setTrackingDraft((current) => ({
                    ...current,
                    url: e.target.value,
                  }))
                }
              />
            </label>
          ) : (
            <label className="tracking-url-field-v227">
              Lien généré automatiquement
              <input
                value={trackingDraft.url}
                placeholder="Saisissez le numéro de suivi"
                readOnly
              />
            </label>
          )}

          {trackingDraft.url && (
            <a
              className="button ghost small"
              href={trackingDraft.url}
              target="_blank"
              rel="noreferrer"
            >
              Tester le lien ↗
            </a>
          )}

          <div className="tracking-save-actions-v259">
            <button
              type="button"
              className="button ghost small"
              disabled={order.status === "refunded" || !trackingDraft.number.trim()}
              onClick={() => saveTracking(order.id)}
            >
              Enregistrer le suivi
            </button>

            {order.status === "ready" && (
              <button
                type="button"
                className="button primary small"
                disabled={!trackingDraft.number.trim()}
                onClick={() => saveTracking(order.id, true)}
              >
                Enregistrer et expédier
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  </>
)}
          {pickupFlowActive && (
            <section
              className="pickup-admin-timeline-v437 pickup-admin-timeline-density-v443"
              aria-label={`Parcours retrait ${order.order_number}`}
            >
              <div className="pickup-admin-timeline-head-v437">
                <div>
                  <span>RETRAIT BOUTIQUE</span>
                  <strong>Parcours de la commande</strong>
                </div>
                <small>{pickupNextAction}</small>
              </div>

              <ol className="pickup-admin-timeline-list-v437">
                {pickupTimeline.map((step, index) => (
                  <li
                    key={step.key}
                    className={`pickup-admin-timeline-step-v437 ${step.state}${step.attention ? " attention" : ""}`}
                  >
                    <span className="pickup-admin-timeline-dot-v437" aria-hidden="true">
                      {step.state === "done" ? "✓" : index + 1}
                    </span>
                    <div>
                      <strong>{step.label}</strong>
                      <small>{step.detail}</small>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {showEmailRecovery && (
            <details
              className={`order-email-recovery-disclosure-v443${lifecycleEmailNeedsAttention ? " attention" : ""}`}
              open={lifecycleEmailNeedsAttention}
            >
              <summary className="order-email-recovery-summary-v443">
                <span>
                  <strong>E-mails client</strong>
                  <small>
                    {lifecycleEmailNeedsAttention
                      ? "Un envoi est à vérifier"
                      : "Suivi & renvoi à la demande"}
                  </small>
                </span>
                <span className="order-email-recovery-summary-state-v443">
                  {lifecycleEmailNeedsAttention ? "À vérifier" : "Ouvrir"}
                </span>
              </summary>
              <div className="order-email-recovery-v373 order-email-recovery-density-v443">
              <div className="order-email-recovery-head-v373">
                <div>
                  <span>E-MAILS CLIENT</span>
                  <strong>Suivi & renvoi</strong>
                </div>
                <small>
                  {order.customer_email || "Aucune adresse e-mail client"}
                </small>
              </div>

              <div className="order-email-recovery-list-v373">
                {confirmationEmailEligible && (
                  <div className="order-email-recovery-row-v373">
                    <div>
                      <strong>Confirmation</strong>
                      <small>{emailStatusText(order.confirmation_email_sent_at)}</small>
                    </div>
                    <button
                      type="button"
                      className="button ghost small"
                      disabled={!order.customer_email || Boolean(emailActionKey)}
                      onClick={() => orderEmailAction(order, "confirmation")}
                    >
                      {emailActionKey === `${order.id}:confirmation`
                        ? "Envoi…"
                        : emailActionLabel(order.confirmation_email_sent_at)}
                    </button>
                  </div>
                )}

                {pickupReadyEmailEligible && (
                  <div className="order-email-recovery-row-v373">
                    <div>
                      <strong>Prête au retrait</strong>
                      <small>{emailStatusText(order.pickup_ready_email_sent_at)}</small>
                    </div>
                    <button
                      type="button"
                      className="button ghost small"
                      disabled={!order.customer_email || Boolean(emailActionKey)}
                      onClick={() => orderEmailAction(order, "pickup_ready")}
                    >
                      {emailActionKey === `${order.id}:pickup_ready`
                        ? "Envoi…"
                        : emailActionLabel(order.pickup_ready_email_sent_at)}
                    </button>
                  </div>
                )}

                {pickupCompletedEmailEligible && (
                  <div className="order-email-recovery-row-v373">
                    <div>
                      <strong>Retrait terminé</strong>
                      <small>{emailStatusText(order.pickup_completed_email_sent_at)}</small>
                    </div>
                    <button
                      type="button"
                      className="button ghost small"
                      disabled={!order.customer_email || Boolean(emailActionKey)}
                      onClick={() => orderEmailAction(order, "pickup_completed")}
                    >
                      {emailActionKey === `${order.id}:pickup_completed`
                        ? "Envoi…"
                        : emailActionLabel(order.pickup_completed_email_sent_at)}
                    </button>
                  </div>
                )}

                {invoiceDoc && (
                  <div className="order-email-recovery-row-v373">
                    <div>
                      <strong>Facture · {invoiceDoc.document_number}</strong>
                      <small>{emailStatusText(invoiceDoc.email_sent_at)}</small>
                    </div>
                    <button
                      type="button"
                      className="button ghost small"
                      disabled={!order.customer_email || Boolean(emailActionKey)}
                      onClick={() => invoiceAction(order, "email")}
                    >
                      {emailActionKey === `${order.id}:email`
                        ? "Envoi…"
                        : emailActionLabel(invoiceDoc.email_sent_at)}
                    </button>
                  </div>
                )}

                {shippingEmailEligible && (
                  <div className="order-email-recovery-row-v373">
                    <div>
                      <strong>Expédition</strong>
                      <small>{emailStatusText(order.shipping_email_sent_at)}</small>
                    </div>
                    <button
                      type="button"
                      className="button ghost small"
                      disabled={!order.customer_email || Boolean(emailActionKey)}
                      onClick={() => orderEmailAction(order, "shipping")}
                    >
                      {emailActionKey === `${order.id}:shipping`
                        ? "Envoi…"
                        : emailActionLabel(order.shipping_email_sent_at)}
                    </button>
                  </div>
                )}

                {refundEmailEligible && (
                  <div className="order-email-recovery-row-v373">
                    <div>
                      <strong>Remboursement</strong>
                      <small>{emailStatusText(order.refund_email_sent_at)}</small>
                    </div>
                    <button
                      type="button"
                      className="button ghost small"
                      disabled={!order.customer_email || Boolean(emailActionKey)}
                      onClick={() => orderEmailAction(order, "refund")}
                    >
                      {emailActionKey === `${order.id}:refund`
                        ? "Envoi…"
                        : emailActionLabel(order.refund_email_sent_at)}
                    </button>
                  </div>
                )}

                {creditNoteDoc && (
                  <div className="order-email-recovery-row-v373">
                    <div>
                      <strong>Avoir · {creditNoteDoc.document_number}</strong>
                      <small>{emailStatusText(creditNoteDoc.email_sent_at)}</small>
                    </div>
                    <button
                      type="button"
                      className="button ghost small"
                      disabled={!order.customer_email || Boolean(emailActionKey)}
                      onClick={() => invoiceAction(order, "credit_note_email")}
                    >
                      {emailActionKey === `${order.id}:credit_note_email`
                        ? "Envoi…"
                        : emailActionLabel(creditNoteDoc.email_sent_at)}
                    </button>
                  </div>
                )}
              </div>
            </div>
            </details>
          )}
          <div className="order-lines order-lines-density-v443">{order.order_items?.map((item) => <p key={item.id}><span><strong>{item.quantity} × {item.product_name}</strong>{item.choices?.length ? <small>{item.choices.map((choice) => choice.label).filter(Boolean).join(" · ")}</small> : null}</span>{typeof item.line_total === "number" && <strong>{Number(item.line_total).toFixed(2)} €</strong>}</p>)}</div>{Number(order.discount_amount || 0) > 0 && <div className="order-promo-v234 order-promo-density-v443"><span><strong>Code promo · {order.promo_code}</strong><small>Réduction appliquée à la commande</small></span><strong>− {Number(order.discount_amount || 0).toFixed(2)} €</strong></div>}{order.notes && <p className="order-note order-note-density-v443"><strong>Note :</strong> {order.notes}</p>}</div>
          <aside className="order-actions order-action-rail-v442 order-action-rail-density-v443">
            <section className="order-action-section-v442 order-action-status-v442">
              <div className="order-action-section-head-v442">
                <span>STATUT</span>
                <small>État actuel</small>
              </div>

              <div className={`order-status-card-v442 ${railStatusTone}`}>
                <span className="order-status-symbol-v442" aria-hidden="true">
                  {["completed", "refunded"].includes(order.status)
                    ? "✓"
                    : order.status === "cancelled"
                      ? "×"
                      : "•"}
                </span>
                <div>
                  <strong>{railStatusLabel}</strong>
                  <small>{railStatusDetail}</small>
                </div>
              </div>

              {canEditStatus && (
                statusEditOrderId === order.id ? (
                  <div className="order-status-editor-v442">
                    <label>
                      Modifier le statut
                      <select
                        value={order.status}
                        onChange={(e) => {
                          const nextStatus = e.target.value;
                          setStatusEditOrderId(null);
                          void updateOrder(order.id, nextStatus);
                        }}
                      >
                        <option value="pending">Nouvelle</option>
                        <option value="preparing">En préparation</option>
                        <option value="ready">
                          {order.order_type === "shipping" ? "Prête à expédier" : "Prête"}
                        </option>
                        <option value="completed">
                          {order.order_type === "shipping" ? "Expédiée" : "Terminée"}
                        </option>
                        <option value="cancelled">Annulée</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={() => setStatusEditOrderId(null)}
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="button ghost small order-status-edit-trigger-v442"
                    onClick={() => setStatusEditOrderId(order.id)}
                  >
                    Modifier le statut
                  </button>
                )
              )}

              {quickAction && (
                <small className="order-action-hint-v442">
                  L’action principale reste disponible en haut de la commande.
                </small>
              )}
            </section>

            {order.status === "cancelled" && (
              <section className="order-action-section-v442">
                <div className="payment-blocked-admin">
                  <strong>Commande annulée</strong>
                  <small>
                    {order.payment_status === "paid"
                      ? "Paiement encaissé : vérifiez la commande avant toute action."
                      : "Aucun paiement encaissé. Cette commande est sortie du flux de préparation."}
                  </small>
                </div>
              </section>
            )}

            {paymentBlocked && (
              <section className="order-action-section-v442">
                <div className="order-action-section-head-v442">
                  <span>PAIEMENT</span>
                  <small>Action requise</small>
                </div>
                <div className="payment-blocked-admin">
                  <strong>
                    {order.payment_status === "refund_pending"
                      ? "Remboursement en cours"
                      : order.payment_status === "refund_failed"
                        ? "Remboursement à vérifier"
                        : "Paiement requis"}
                  </strong>
                  <small>
                    {order.payment_status === "refund_pending"
                      ? "Stripe traite le remboursement."
                      : order.payment_status === "refund_failed"
                        ? "Vérifiez Stripe avant toute nouvelle action."
                        : "La préparation est bloquée jusqu’à confirmation Stripe."}
                  </small>
                  {!["refund_pending", "refund_failed", "refunded"].includes(order.payment_status) && (
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={() => updateOrder(order.id, "cancelled")}
                    >
                      Annuler la commande
                    </button>
                  )}
                </div>
              </section>
            )}

            {(order.payment_status === "paid" || invoiceDoc || order.payment_status === "refunded" || creditNoteDoc) && (
              <section className="order-action-section-v442">
                <div className="order-action-section-head-v442">
                  <span>DOCUMENTS</span>
                  <small>Facture & avoir</small>
                </div>

                <div className="order-action-stack-v442">
                  {order.payment_status === "paid" && !invoiceDoc && (
                    <button
                      type="button"
                      className="button ghost small invoice-admin-action-v245"
                      onClick={() => invoiceAction(order, "issue")}
                    >
                      Créer la facture
                    </button>
                  )}

                  {order.public_token && invoiceDoc && (
                    <a
                      className="button ghost small invoice-admin-action-v245"
                      href={`/api/invoices/${order.id}?token=${encodeURIComponent(order.public_token)}`}
                    >
                      Facture PDF ↓
                    </a>
                  )}

                  {order.payment_status === "refunded" && !creditNoteDoc && (
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={() => invoiceAction(order, "credit_note")}
                    >
                      Créer l’avoir
                    </button>
                  )}

                  {order.public_token && creditNoteDoc && (
                    <a
                      className="button ghost small"
                      href={`/api/invoices/${order.id}?token=${encodeURIComponent(order.public_token)}&type=credit_note`}
                    >
                      Avoir PDF ↓
                    </a>
                  )}
                </div>

                {invoiceDoc && order.customer_email && (
                  <small className="order-action-hint-v442">
                    Le renvoi de facture reste dans « E-mails client » pour éviter les doublons.
                  </small>
                )}
              </section>
            )}

            {order.public_token && (
              <section className="order-action-section-v442">
                <div className="order-action-section-head-v442">
                  <span>CLIENT</span>
                  <small>Vue publique</small>
                </div>
                <a
                  className="button ghost small order-client-view-v442"
                  href={`/commande/${order.public_token}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Voir la commande client ↗
                </a>
              </section>
            )}

            {canRefund && (
              <section className="order-action-section-v442 order-danger-zone-v442">
                <div className="order-action-section-head-v442">
                  <span>ACTION SENSIBLE</span>
                  <small>Remboursement</small>
                </div>
                <p>
                  Le remboursement passe par Stripe. Vérifiez le montant et la commande avant de continuer.
                </p>
                <button
                  type="button"
                  className="button small order-refund-button-v442"
                  onClick={() => {
                    if (window.confirm(`Rembourser ${order.order_number} via Stripe ?`)) {
                      void updateOrder(order.id, "refunded");
                    }
                  }}
                >
                  Rembourser via Stripe
                </button>
              </section>
            )}
          </aside>
</div>
)}
</article>;
      })}</div> : <div className="empty-state">Aucune commande Boutique dans cette vue.</div>}
    </div>
  );
}
