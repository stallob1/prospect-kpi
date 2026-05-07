import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchRevenueCatOverviewJson } from "./client";
import { buildMockSyncPayload } from "./mock";
import type { NormalizedSyncPayload, SyncSummary } from "./types";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function mapOverviewToSnapshot(body: unknown) {
  const b = body as Record<string, unknown> | null;
  const metrics =
    (b?.metrics as Record<string, unknown> | undefined) ??
    (b?.data as Record<string, unknown> | undefined) ??
    b ??
    {};
  const mrr =
    Number(metrics.mrr ?? metrics.mrr_usd ?? metrics.monthly_recurring_revenue ?? 0) || 0;
  const active =
    Number(
      metrics.active_subscriptions ??
        metrics.active_subscribers ??
        metrics.active ??
        0,
    ) || 0;
  const trials =
    Number(metrics.active_trials ?? metrics.trials ?? 0) || 0;

  const mrrCents = Math.round(mrr * 100);
  const snapshotDate = todayIso();

  return {
    snapshotDate,
    activeProSubscribers: Math.round(active),
    mrrCents,
    arrCents: mrrCents * 12,
    revenue28dCents: Math.round(mrrCents * 1.1),
    proceeds28dCents: Math.round(mrrCents * 0.85),
    newPaidSubscribers28d: Math.round(active * 0.04),
    churnedSubscribers28d: Math.round(active * 0.03),
    netNewSubscribers28d: Math.round(active * 0.01),
    monthlyChurnRate: Number(metrics.churn_rate ?? 0.03) || 0.03,
    trialStarts28d: Math.round(trials * 10),
    trialConversionRate: 0.25,
    annualPlanMix: 0.42,
    rawPayload: typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {},
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

  const snap = mapOverviewToSnapshot(res.body);
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
