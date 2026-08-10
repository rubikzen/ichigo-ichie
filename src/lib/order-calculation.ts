import type { SupabaseClient } from "@supabase/supabase-js";

export type PayloadItem = {
  productId: string;
  variantId?: string | null;
  quantity: number;
  choices?: Array<{ groupId: string; valueId: string }>;
};

type GroupRule = { id: string; required: boolean; min_select: number; max_select: number };

export class OrderValidationError extends Error {
  status = 400;
}

export async function resolveCart(supabase: SupabaseClient, items: PayloadItem[]) {
  if (!Array.isArray(items) || !items.length || items.length > 30) throw new OrderValidationError("Panier invalide.");

  const productIds = [...new Set(items.map((item) => String(item.productId || "")).filter(Boolean))];
  if (!productIds.length) throw new OrderValidationError("Produit invalide.");
  const choiceIds = [...new Set(items.flatMap((item) => item.choices?.map((choice) => choice.valueId) ?? []))];

  const [productResult, variantResult, choiceResult, joinResult] = await Promise.all([
    supabase.from("products").select("id,name_fr,base_price,stock,pickup_only,active,shipping_weight_g").in("id", productIds),
    supabase.from("product_variants").select("id,product_id,name,price,stock,active,shipping_weight_g").in("product_id", productIds),
    choiceIds.length
      ? supabase.from("option_values").select("id,option_group_id,label_fr,price_delta,active").in("id", choiceIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("product_option_groups").select("product_id,option_group_id,sort_order").in("product_id", productIds),
  ]);
  if (productResult.error || variantResult.error || choiceResult.error || joinResult.error) {
    throw productResult.error || variantResult.error || choiceResult.error || joinResult.error;
  }

  const allowedGroupIds = [...new Set((joinResult.data ?? []).map((row) => row.option_group_id))];
  const groupResult = allowedGroupIds.length
    ? await supabase.from("option_groups").select("id,required,min_select,max_select").in("id", allowedGroupIds)
    : { data: [] as GroupRule[], error: null };
  if (groupResult.error) throw groupResult.error;

  const rulesById = new Map<string, GroupRule>((groupResult.data ?? []).map((row) => [row.id, row as GroupRule]));
  const allowedGroupsByProduct = new Map<string, string[]>();
  for (const join of joinResult.data ?? []) {
    allowedGroupsByProduct.set(join.product_id, [...(allowedGroupsByProduct.get(join.product_id) ?? []), join.option_group_id]);
  }

  const normalized = items.map((item) => {
    const product = productResult.data?.find((row) => row.id === item.productId);
    if (!product || !product.active) throw new OrderValidationError("Produit indisponible.");
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new OrderValidationError("Quantité invalide.");

    const productVariants = (variantResult.data ?? []).filter((row) => row.product_id === item.productId && row.active);
    let unitPrice = Number(product.base_price);
    let itemName = product.name_fr;
    let chosenVariant = null as null | (typeof productVariants)[number];

    if (productVariants.length) {
      if (!item.variantId) throw new OrderValidationError("Veuillez choisir un format.");
      chosenVariant = productVariants.find((row) => row.id === item.variantId) ?? null;
      if (!chosenVariant || chosenVariant.stock < quantity) throw new OrderValidationError("Format indisponible.");
      unitPrice = Number(chosenVariant.price);
      itemName += ` · ${chosenVariant.name}`;
    } else {
      if (item.variantId) throw new OrderValidationError("Format invalide.");
      if (Number(product.stock) < quantity) throw new OrderValidationError("Stock insuffisant.");
    }

    const allowedGroupList = allowedGroupsByProduct.get(item.productId) ?? [];
    const choiceRows = item.choices ?? [];
    const seenValues = new Set<string>();
    const counts = new Map<string, number>();
    const safeChoices = choiceRows.map((choice) => {
      if (!allowedGroupList.includes(choice.groupId)) throw new OrderValidationError("Option invalide.");
      if (seenValues.has(choice.valueId)) throw new OrderValidationError("Option dupliquée.");
      seenValues.add(choice.valueId);
      const value = choiceResult.data?.find((row) => row.id === choice.valueId && row.option_group_id === choice.groupId && row.active);
      if (!value) throw new OrderValidationError("Option indisponible.");
      counts.set(choice.groupId, (counts.get(choice.groupId) ?? 0) + 1);
      const delta = Number(value.price_delta ?? 0);
      unitPrice += delta;
      return { groupId: choice.groupId, valueId: value.id, label: value.label_fr, priceDelta: delta };
    });

    for (const groupId of allowedGroupList) {
      const rule = rulesById.get(groupId);
      if (!rule) throw new OrderValidationError("Configuration d’option invalide.");
      const count = counts.get(groupId) ?? 0;
      const min = rule.required ? Math.max(1, Number(rule.min_select) || 0) : Math.max(0, Number(rule.min_select) || 0);
      const max = Math.max(1, Number(rule.max_select) || 1);
      if (count < min) throw new OrderValidationError("Un choix obligatoire est manquant.");
      if (count > max) throw new OrderValidationError("Trop d’options sélectionnées.");
    }

    const shippingWeightG = Number(chosenVariant?.shipping_weight_g || product.shipping_weight_g || 0);
    return {
      product_id: item.productId,
      variant_id: chosenVariant?.id ?? null,
      name: itemName,
      quantity,
      unit_price: Math.round(unitPrice * 100) / 100,
      choices: safeChoices,
      line_total: Math.round(unitPrice * quantity * 100) / 100,
      pickup_only: Boolean(product.pickup_only),
      shipping_weight_g: shippingWeightG,
    };
  });

  const subtotal = Math.round(normalized.reduce((sum, item) => sum + item.line_total, 0) * 100) / 100;
  const itemWeightG = normalized.reduce((sum, item) => sum + item.shipping_weight_g * item.quantity, 0);
  const containsPickupOnly = normalized.some((item) => item.pickup_only);
  const missingShippingWeight = normalized.some((item) => !item.pickup_only && item.shipping_weight_g <= 0);

  return { normalized, subtotal, itemWeightG, containsPickupOnly, missingShippingWeight };
}
