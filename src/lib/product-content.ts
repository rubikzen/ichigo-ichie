const SUPPLIER_SHIPPING_MARKERS = [
  "[important notice regarding international shipping]",
  "important notice regarding international shipping",
  "dhl duty & tax calculator",
  "simplyduty",
] as const;

export function sanitizeStorefrontProductText(
  value: string | null | undefined,
) {
  const raw = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  if (!raw) return "";

  const normalized = raw.toLowerCase();
  const cutAt = SUPPLIER_SHIPPING_MARKERS.reduce((earliest, marker) => {
    const index = normalized.indexOf(marker);
    if (index < 0) return earliest;
    return earliest < 0 ? index : Math.min(earliest, index);
  }, -1);

  const customerCopy = cutAt >= 0 ? raw.slice(0, cutAt) : raw;
  return customerCopy.replace(/\n{3,}/g, "\n\n").trim();
}

export function hasSupplierShippingBoilerplate(
  value: string | null | undefined,
) {
  const normalized = String(value ?? "").toLowerCase();
  return SUPPLIER_SHIPPING_MARKERS.some((marker) =>
    normalized.includes(marker),
  );
}
