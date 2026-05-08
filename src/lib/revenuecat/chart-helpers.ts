/**
 * Helpers for RevenueCat GET /v2/projects/{id}/charts/{chart_name} responses.
 * Chart payloads vary; we try summary first, then sum the last N points of the first series.
 */

function sumLastNumericSeries2D(values: unknown, lastN: number): number | null {
  if (!Array.isArray(values) || values.length === 0) return null;
  const first = values[0];
  if (!Array.isArray(first)) return null;
  const slice = first.slice(-lastN);
  let total = 0;
  let any = false;
  for (const point of slice) {
    let n: number | null = null;
    if (typeof point === "number" && Number.isFinite(point)) {
      n = point;
    } else if (Array.isArray(point) && typeof point[0] === "number") {
      n = point[0];
    }
    if (n != null && Number.isFinite(n)) {
      total += n;
      any = true;
    }
  }
  return any ? total : null;
}

/** Sum last 28 points of primary series; treat as major currency units → USD cents. */
export function chartRevenueSeriesSumCents(chart: unknown, days = 28): number | null {
  const c = chart as Record<string, unknown> | undefined;
  if (!c) return null;
  const raw = sumLastNumericSeries2D(c.values, days);
  if (raw == null) return null;
  return Math.round(raw * 100);
}

/** Shallow scan of `summary` for the first finite number (aggregate responses). */
export function chartSummaryFirstNumber(chart: unknown): number | null {
  const c = chart as Record<string, unknown> | undefined;
  if (!c) return null;
  const summary = c.summary;
  if (!summary || typeof summary !== "object") return null;
  const walk = (obj: Record<string, unknown>): number | null => {
    for (const v of Object.values(obj)) {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const inner = walk(v as Record<string, unknown>);
        if (inner != null) return inner;
      }
    }
    return null;
  };
  return walk(summary as Record<string, unknown>);
}

/** Prefer summary total; else sum series; interpret as rate 0–1 or percent. */
export function chartRateMetric(chart: unknown): number | null {
  const n = chartSummaryFirstNumber(chart) ?? sumLastNumericSeries2D(
    (chart as Record<string, unknown>)?.values,
    365,
  );
  if (n == null || !Number.isFinite(n)) return null;
  let v = n;
  if (v > 1 && v <= 100) v = v / 100;
  if (v > 1 || v < 0) return null;
  return v;
}

/** Prefer last-28d summed series (USD major units); else first numeric in summary → cents. */
export function chartMoneyCentsFromUSDPointsOrSummary(
  chart: unknown,
  days = 28,
): number | null {
  const fromSeries = chartRevenueSeriesSumCents(chart, days);
  if (fromSeries != null) return fromSeries;
  const s = chartSummaryFirstNumber(chart);
  if (s != null && Number.isFinite(s)) return Math.round(s * 100);
  return null;
}

export function chartCountFromSeriesOrSummary(chart: unknown, days = 28): number | null {
  const series = sumLastNumericSeries2D((chart as Record<string, unknown>)?.values, days);
  if (series != null && Number.isFinite(series)) return Math.round(series);
  const s = chartSummaryFirstNumber(chart);
  if (s != null && Number.isFinite(s)) return Math.round(s);
  return null;
}
