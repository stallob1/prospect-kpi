/**
 * Map RevenueCat GET /v2/projects/{id}/metrics/overview response into snapshot fields.
 * Overview returns `{ object: "overview_metrics", metrics: OverviewMetric[] }` where each
 * metric has `id`, `value`, and `unit` — not a flat `metrics` object.
 */

export type RcOverviewMetricRow = {
  object?: string;
  id?: string;
  value?: number;
  unit?: string;
  name?: string;
};

export function indexOverviewMetrics(body: unknown): Map<string, RcOverviewMetricRow> {
  const map = new Map<string, RcOverviewMetricRow>();
  if (!body || typeof body !== "object") return map;
  const root = body as Record<string, unknown>;
  const metrics = root.metrics;
  if (Array.isArray(metrics)) {
    for (const entry of metrics) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as RcOverviewMetricRow;
      if (typeof row.id === "string") map.set(row.id, row);
    }
    return map;
  }

  /** Legacy / alternate shape: `{ metrics: { mrr: 123, ... } }` */
  if (metrics && typeof metrics === "object" && !Array.isArray(metrics)) {
    for (const [id, val] of Object.entries(metrics as Record<string, unknown>)) {
      if (typeof val === "number" && Number.isFinite(val)) {
        map.set(id, { id, value: val });
      }
    }
  }
  return map;
}

function pickMetric(
  map: Map<string, RcOverviewMetricRow>,
  ids: string[],
): RcOverviewMetricRow | undefined {
  for (const id of ids) {
    const m = map.get(id);
    if (m && m.value != null && typeof m.value === "number" && Number.isFinite(m.value)) {
      return m;
    }
  }
  return undefined;
}

/** Currency-ish overview metrics: value is treated as major units (e.g. USD dollars) → cents. */
const MONEY_METRIC_IDS = new Set(
  [
    "mrr",
    "monthly_recurring_revenue",
    "arr",
    "annual_recurring_revenue",
    "revenue",
    "revenue_28d",
    "gross_revenue",
    "gross_revenue_28d",
    "net_revenue",
    "net_revenue_28d",
    "proceeds",
    "proceeds_28d",
    "realized_ltv",
    "tax",
    "commission",
  ].map((s) => s.toLowerCase()),
);

function isCountUnit(unit: string): boolean {
  const u = unit.toLowerCase();
  return u === "count" || u === "subscriptions" || u === "customers" || u === "users";
}

/**
 * Convert overview metric value to USD cents.
 * RevenueCat commonly returns currency metrics in major units; large integers may already be cents.
 */
export function overviewMoneyToCents(metric: RcOverviewMetricRow | undefined): number | null {
  if (!metric || metric.value == null || typeof metric.value !== "number") return null;
  const v = metric.value;
  if (!Number.isFinite(v)) return null;
  const id = (metric.id ?? "").toLowerCase();
  const unit = String(metric.unit ?? "");

  const idLooksMoney =
    MONEY_METRIC_IDS.has(id) ||
    id.includes("revenue") ||
    id.includes("mrr") ||
    id.includes("arr") ||
    id.includes("proceeds") ||
    id.includes("ltv");
  if (!idLooksMoney) return null;

  if (isCountUnit(unit)) return null;
  // Very large integers: assume already minor units (cents)
  if (Number.isInteger(v) && Math.abs(v) >= 10_000_000) {
    return Math.round(v);
  }
  return Math.round(v * 100);
}

export function overviewCount(metric: RcOverviewMetricRow | undefined): number | null {
  if (!metric || metric.value == null || typeof metric.value !== "number") return null;
  const v = metric.value;
  if (!Number.isFinite(v)) return null;
  return Math.round(v);
}

/** Parse churn-style metrics to a 0–1 rate when possible. */
export function overviewRate(metric: RcOverviewMetricRow | undefined): number | null {
  if (!metric || metric.value == null || typeof metric.value !== "number") return null;
  let v = metric.value;
  if (!Number.isFinite(v)) return null;
  if (v > 1 && v <= 100) v = v / 100;
  if (v > 100) return null;
  if (v < 0) return null;
  return v;
}

export type OverviewSnapshotFields = {
  activeProSubscribers: number | null;
  mrrCents: number | null;
  arrCents: number | null;
  revenue28dCents: number | null;
  proceeds28dCents: number | null;
  newPaidSubscribers28d: number | null;
  churnedSubscribers28d: number | null;
  netNewSubscribers28d: number | null;
  monthlyChurnRate: number | null;
  trialStarts28d: number | null;
  trialConversionRate: number | null;
  annualPlanMix: number | null;
};

export function mapOverviewBodyToFields(body: unknown): OverviewSnapshotFields {
  const map = indexOverviewMetrics(body);

  const active =
    overviewCount(pickMetric(map, ["active_subscriptions", "active_subscribers"])) ?? null;

  const mrrMetric = pickMetric(map, [
    "mrr",
    "monthly_recurring_revenue",
    "monthly_recurring_revenue_usd",
  ]);
  const mrrCents = overviewMoneyToCents(mrrMetric);

  const arrMetric = pickMetric(map, ["arr", "annual_recurring_revenue", "annual_recurring_revenue_usd"]);
  let arrCents = overviewMoneyToCents(arrMetric);
  if (arrCents == null && mrrCents != null) {
    arrCents = mrrCents * 12;
  }

  const revenueMetric = pickMetric(map, [
    "revenue",
    "revenue_28d",
    "gross_revenue",
    "gross_revenue_28d",
    "net_revenue_28d",
  ]);
  const revenue28dCents = overviewMoneyToCents(revenueMetric);

  const proceedsMetric = pickMetric(map, ["proceeds", "proceeds_28d", "developer_proceeds", "net_revenue"]);
  const proceeds28dCents = overviewMoneyToCents(proceedsMetric);

  const newCustomers =
    overviewCount(pickMetric(map, ["new_customers", "customers_new", "new_subscribers"])) ?? null;

  const churned =
    overviewCount(pickMetric(map, ["churned_subscribers", "churned", "cancellations"])) ?? null;

  let netNew: number | null = null;
  if (newCustomers != null && churned != null) {
    netNew = newCustomers - churned;
  }

  const churnRate =
    overviewRate(
      pickMetric(map, [
        "churn_rate",
        "subscription_churn_rate",
        "monthly_churn",
        "churn",
      ]),
    ) ?? null;

  const trialStarts =
    overviewCount(
      pickMetric(map, ["trial_starts_28d", "trial_starts", "trials_started", "new_trials"]),
    ) ?? null;

  const trialConv =
    overviewRate(
      pickMetric(map, ["trial_conversion_rate", "conversion_to_paying", "trial_conversion"]),
    ) ?? null;

  const annualMix =
    overviewRate(
      pickMetric(map, ["annual_plan_mix", "annual_mix", "subscription_annual_mix"]),
    ) ?? null;

  return {
    activeProSubscribers: active,
    mrrCents,
    arrCents,
    revenue28dCents,
    proceeds28dCents,
    newPaidSubscribers28d: newCustomers,
    churnedSubscribers28d: churned,
    netNewSubscribers28d: netNew,
    monthlyChurnRate: churnRate,
    trialStarts28d: trialStarts,
    trialConversionRate: trialConv,
    annualPlanMix: annualMix,
  };
}
