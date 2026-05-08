import type { SupabaseClient } from "@supabase/supabase-js";
import {
  chartCountFromSeriesOrSummary,
  chartMoneyCentsFromUSDPointsOrSummary,
  chartRateMetric,
  chartSummaryFirstNumber,
} from "./chart-helpers";
import { fetchRevenueCatChartJson, fetchRevenueCatOverviewJson } from "./client";
import { buildMockSyncPayload } from "./mock";
import {
  mapOverviewBodyToFields,
  type OverviewSnapshotFields,
} from "./overview-map";
import type { NormalizedDailySnapshot, NormalizedSyncPayload, SyncSummary } from "./types";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function mergeOverviewAndCharts(
  overview: OverviewSnapshotFields,
  charts: Partial<OverviewSnapshotFields>,
): OverviewSnapshotFields {
  const pick = <K extends keyof OverviewSnapshotFields>(
    k: K,
  ): OverviewSnapshotFields[K] => {
    const a = overview[k];
    if (a != null) return a;
    const b = charts[k];
    if (b != null) return b;
    return null as OverviewSnapshotFields[K];
  };

  return {
    activeProSubscribers: pick("activeProSubscribers"),
    mrrCents: pick("mrrCents"),
    arrCents: pick("arrCents"),
    revenue28dCents: pick("revenue28dCents"),
    proceeds28dCents: pick("proceeds28dCents"),
    newPaidSubscribers28d: pick("newPaidSubscribers28d"),
    churnedSubscribers28d: pick("churnedSubscribers28d"),
    netNewSubscribers28d: pick("netNewSubscribers28d"),
    monthlyChurnRate: pick("monthlyChurnRate"),
    trialStarts28d: pick("trialStarts28d"),
    trialConversionRate: pick("trialConversionRate"),
    annualPlanMix: pick("annualPlanMix"),
  };
}

function slimChartBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object") return { error: "empty" };
  const o = body as Record<string, unknown>;
  return {
    object: o.object,
    display_name: o.display_name,
    category: o.category,
    last_computed_at: o.last_computed_at,
    summary: o.summary,
    yaxis_currency: o.yaxis_currency,
  };
}

async function loadChartAugments(errors: string[]): Promise<{
  fields: Partial<OverviewSnapshotFields>;
  chartDebug: Record<string, unknown>;
}> {
  const fields: Partial<OverviewSnapshotFields> = {};
  const chartDebug: Record<string, unknown> = {};

  const run = async (
    key: string,
    chartName: string,
    query: Record<string, string | undefined>,
    apply: (body: unknown) => void,
  ) => {
    const res = await fetchRevenueCatChartJson(chartName, query);
    if (!res.ok) {
      errors.push(res.error);
      chartDebug[key] = { error: res.error };
      return;
    }
    chartDebug[key] = slimChartBody(res.body);
    apply(res.body);
  };

  await Promise.all([
    run("revenue_gross_28d", "revenue", { currency: "USD", selectors: JSON.stringify({ revenue_type: "gross" }) }, (body) => {
      const cents = chartMoneyCentsFromUSDPointsOrSummary(body, 28);
      if (cents != null) fields.revenue28dCents = cents;
    }),
    run("revenue_proceeds_28d", "revenue", { currency: "USD", selectors: JSON.stringify({ revenue_type: "proceeds" }) }, (body) => {
      const cents = chartMoneyCentsFromUSDPointsOrSummary(body, 28);
      if (cents != null) fields.proceeds28dCents = cents;
    }),
    run("conversion_to_paying", "conversion_to_paying", { currency: "USD", selectors: JSON.stringify({ conversion_timeframe: "28_days" }) }, (body) => {
      const r = chartRateMetric(body);
      if (r != null) fields.trialConversionRate = r;
    }),
    run("churn", "churn", { currency: "USD" }, (body) => {
      const r = chartRateMetric(body);
      if (r != null) fields.monthlyChurnRate = r;
    }),
    run("customers_new", "customers_new", { currency: "USD" }, (body) => {
      const n = chartCountFromSeriesOrSummary(body, 28);
      if (n != null) fields.newPaidSubscribers28d = n;
    }),
    run("actives", "actives", { currency: "USD" }, (body) => {
      const n = chartCountFromSeriesOrSummary(body, 1);
      if (n != null) fields.activeProSubscribers = n;
    }),
    run("arr", "arr", { currency: "USD" }, (body) => {
      const s = chartSummaryFirstNumber(body);
      if (s != null && Number.isFinite(s)) {
        fields.arrCents = Math.round(s * 100);
      }
    }),
  ]);

  return { fields, chartDebug };
}

function toNormalizedDailySnapshot(
  merged: OverviewSnapshotFields,
  rawPayload: Record<string, unknown>,
): NormalizedDailySnapshot {
  const active = merged.activeProSubscribers ?? 0;
  const mrr = merged.mrrCents ?? 0;
  const arr = merged.arrCents ?? (mrr > 0 ? mrr * 12 : 0);

  let netNew = merged.netNewSubscribers28d;
  if (netNew == null && merged.newPaidSubscribers28d != null && merged.churnedSubscribers28d != null) {
    netNew = merged.newPaidSubscribers28d - merged.churnedSubscribers28d;
  }

  return {
    snapshotDate: todayIso(),
    activeProSubscribers: active,
    mrrCents: mrr,
    arrCents: arr,
    revenue28dCents: merged.revenue28dCents,
    proceeds28dCents: merged.proceeds28dCents,
    newPaidSubscribers28d: merged.newPaidSubscribers28d,
    churnedSubscribers28d: merged.churnedSubscribers28d,
    netNewSubscribers28d: netNew,
    monthlyChurnRate: merged.monthlyChurnRate,
    trialStarts28d: merged.trialStarts28d,
    trialConversionRate: merged.trialConversionRate,
    annualPlanMix: merged.annualPlanMix,
    rawPayload,
  };
}

export async function mapLiveRevenueCatToPayload(): Promise<{
  payload: NormalizedSyncPayload;
  errors: string[];
}> {
  const errors: string[] = [];
  const res = await fetchRevenueCatOverviewJson();
  if (!res.ok) {
    errors.push(res.error);
    return {
      payload: { snapshots: [], events: [], statuses: [], cohorts: [] },
      errors,
    };
  }

  const overviewFields = mapOverviewBodyToFields(res.body);
  const { fields: chartFields, chartDebug } = await loadChartAugments(errors);
  const merged = mergeOverviewAndCharts(overviewFields, chartFields);

  const rawPayload: Record<string, unknown> = {
    overview_response: res.body,
    chart_ingest: chartDebug,
    _ingest: {
      version: 2,
      merged_at: new Date().toISOString(),
      source: "revenuecat",
    },
  };

  const snap = toNormalizedDailySnapshot(merged, rawPayload);
  return {
    payload: {
      snapshots: [snap],
      events: [],
      statuses: [],
      cohorts: [],
    },
    errors,
  };
}

export async function writeNormalizedPayload(
  supabase: SupabaseClient,
  payload: NormalizedSyncPayload,
  options: { replaceMockDerived?: boolean },
): Promise<Omit<SyncSummary, "source">> {
  const errors: string[] = [];
  let snapshotsUpserted = 0;
  let eventsInserted = 0;
  let statusesUpserted = 0;
  let cohortRowsUpserted = 0;

  const { replaceMockDerived } = options;

  if (replaceMockDerived) {
    await supabase
      .from("revenuecat_subscriber_events")
      .delete()
      .like("subscriber_id", "mock_sub_%");
    await supabase
      .from("revenuecat_subscriber_status")
      .delete()
      .like("subscriber_id", "mock_status_%");
    await supabase.from("revenuecat_cohorts").delete().gte("relative_month", 0);
  }

  for (const s of payload.snapshots) {
    const row = {
      snapshot_date: s.snapshotDate,
      active_pro_subscribers: s.activeProSubscribers,
      mrr_cents: s.mrrCents,
      arr_cents: s.arrCents,
      revenue_28d_cents: s.revenue28dCents,
      proceeds_28d_cents: s.proceeds28dCents,
      new_paid_subscribers_28d: s.newPaidSubscribers28d,
      churned_subscribers_28d: s.churnedSubscribers28d,
      net_new_subscribers_28d: s.netNewSubscribers28d,
      monthly_churn_rate: s.monthlyChurnRate,
      trial_starts_28d: s.trialStarts28d,
      trial_conversion_rate: s.trialConversionRate,
      annual_plan_mix: s.annualPlanMix,
      raw_payload: s.rawPayload ?? null,
    };
    const { error } = await supabase
      .from("revenuecat_daily_snapshots")
      .upsert(row, { onConflict: "snapshot_date" });
    if (error) errors.push(`snapshot ${s.snapshotDate}: ${error.message}`);
    else snapshotsUpserted += 1;
  }

  if (payload.events.length) {
    const rows = payload.events.map((e) => ({
      event_date: e.eventDate,
      event_type: e.eventType,
      subscriber_id: e.subscriberId,
      product_id: e.productId ?? null,
      store: e.store ?? null,
      metadata: e.metadata ?? null,
    }));
    const { error, data } = await supabase
      .from("revenuecat_subscriber_events")
      .insert(rows)
      .select("id");
    if (error) errors.push(`events: ${error.message}`);
    else eventsInserted = data?.length ?? rows.length;
  }

  for (const st of payload.statuses) {
    const row = {
      subscriber_id: st.subscriberId,
      status: st.status,
      first_seen_at: st.firstSeenAt,
      last_seen_at: st.lastSeenAt,
      current_product_id: st.currentProductId ?? null,
      is_annual: st.isAnnual ?? null,
      mrr_contribution_cents: st.mrrContributionCents ?? null,
    };
    const { error } = await supabase
      .from("revenuecat_subscriber_status")
      .upsert(row, { onConflict: "subscriber_id" });
    if (error) errors.push(`status ${st.subscriberId}: ${error.message}`);
    else statusesUpserted += 1;
  }

  const computedAt = new Date().toISOString();
  for (const c of payload.cohorts) {
    const row = {
      signup_month: c.signupMonth,
      relative_month: c.relativeMonth,
      retention_rate: c.retentionRate,
      paid_conversion_rate: c.paidConversionRate,
      realized_ltv_cents: c.realizedLtvCents,
      computed_at: computedAt,
    };
    const { error } = await supabase
      .from("revenuecat_cohorts")
      .upsert(row, { onConflict: "signup_month,relative_month" });
    if (error) errors.push(`cohort ${c.signupMonth}/${c.relativeMonth}: ${error.message}`);
    else cohortRowsUpserted += 1;
  }

  return {
    snapshotsUpserted,
    eventsInserted,
    statusesUpserted,
    cohortRowsUpserted,
    errors,
  };
}

export async function syncFromMock(
  supabase: SupabaseClient,
): Promise<SyncSummary> {
  const payload = buildMockSyncPayload();
  const result = await writeNormalizedPayload(supabase, payload, {
    replaceMockDerived: true,
  });
  return { ...result, source: "mock" };
}

export async function syncFromRevenueCat(
  supabase: SupabaseClient,
): Promise<SyncSummary> {
  const key =
    process.env.REVENUECAT_API_KEY ?? process.env.REVENUECAT_SECRET_API_KEY;
  if (!key) {
    return syncFromMock(supabase);
  }

  const { payload, errors } = await mapLiveRevenueCatToPayload();
  const result = await writeNormalizedPayload(supabase, payload, {
    replaceMockDerived: false,
  });
  return {
    ...result,
    errors: [...errors, ...result.errors],
    source: "revenuecat",
  };
}

export async function runScheduledSync(
  supabase: SupabaseClient,
): Promise<SyncSummary> {
  const key =
    process.env.REVENUECAT_API_KEY ?? process.env.REVENUECAT_SECRET_API_KEY;
  if (!key) {
    return syncFromMock(supabase);
  }
  return syncFromRevenueCat(supabase);
}
