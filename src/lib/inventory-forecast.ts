export const INVENTORY_FORECAST_PERIODS = [30, 60, 90] as const;
export const INVENTORY_TARGET_COVERAGE_DAYS = 30;

export type InventoryForecastPeriod =
  (typeof INVENTORY_FORECAST_PERIODS)[number];

export type InventoryForecastSignal =
  | "out"
  | "urgent"
  | "order"
  | "watch"
  | "healthy"
  | "no_sales";

export type InventoryForecastConfidence = "low" | "medium" | "high";

export type InventoryForecastInput = {
  id: string;
  productId: string;
  variantId: string | null;
  kind: "product" | "variant";
  name: string;
  productName: string | null;
  sku: string | null;
  stock: number;
  unitsSold: number;
};

export type InventoryForecastRow = InventoryForecastInput & {
  dailyRate: number;
  coverageDays: number | null;
  targetStock: number;
  suggestedOrder: number;
  signal: InventoryForecastSignal;
  confidence: InventoryForecastConfidence;
};

function finiteNonNegative(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function inventoryForecastSignal(
  stock: number,
  dailyRate: number,
  coverageDays: number | null,
): InventoryForecastSignal {
  if (stock <= 0) return "out";
  if (dailyRate <= 0 || coverageDays === null) return "no_sales";
  if (coverageDays <= 7) return "urgent";
  if (coverageDays <= 14) return "order";
  if (coverageDays <= 30) return "watch";
  return "healthy";
}

export function inventoryForecastConfidence(
  unitsSold: number,
): InventoryForecastConfidence {
  if (unitsSold >= 12) return "high";
  if (unitsSold >= 4) return "medium";
  return "low";
}

export function forecastInventoryUnit(
  input: InventoryForecastInput,
  lookbackDays: InventoryForecastPeriod,
  targetCoverageDays = INVENTORY_TARGET_COVERAGE_DAYS,
): InventoryForecastRow {
  const stock = finiteNonNegative(input.stock);
  const unitsSold = finiteNonNegative(input.unitsSold);
  const dailyRate = lookbackDays > 0 ? unitsSold / lookbackDays : 0;
  const coverageDays =
    dailyRate > 0 ? round(stock / dailyRate, 1) : null;
  const targetStock =
    dailyRate > 0
      ? Math.max(0, Math.ceil(dailyRate * targetCoverageDays))
      : 0;
  const suggestedOrder = Math.max(0, targetStock - Math.floor(stock));

  return {
    ...input,
    stock: round(stock, 2),
    unitsSold: round(unitsSold, 2),
    dailyRate: round(dailyRate, 3),
    coverageDays,
    targetStock,
    suggestedOrder,
    signal: inventoryForecastSignal(stock, dailyRate, coverageDays),
    confidence: inventoryForecastConfidence(unitsSold),
  };
}

export function inventoryForecastSignalRank(
  signal: InventoryForecastSignal,
) {
  if (signal === "out") return 0;
  if (signal === "urgent") return 1;
  if (signal === "order") return 2;
  if (signal === "watch") return 3;
  if (signal === "healthy") return 4;
  return 5;
}
