import type {
  NormalizedCohortRow,
  NormalizedDailySnapshot,
  NormalizedSubscriberEvent,
  NormalizedSubscriberStatus,
  NormalizedSyncPayload,
} from "./types";

/** Mulberry32 PRNG for deterministic mock data. */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function firstOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function monthIso(d: Date) {
  return firstOfMonth(d).toISOString().slice(0, 10);
}

export function buildMockSyncPayload(seed = 42): NormalizedSyncPayload {
  const rnd = mulberry32(seed);
  const today = new Date();
  const snapshots: NormalizedDailySnapshot[] = [];
  const events: NormalizedSubscriberEvent[] = [];
  const statuses: NormalizedSubscriberStatus[] = [];
  const cohorts: NormalizedCohortRow[] = [];

  let baseSubs = 1200 + Math.floor(rnd() * 400);
  let baseMrrCents = 45_000_00 + Math.floor(rnd() * 20_000_00);

  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const jitter = rnd() * 0.04 - 0.02;
    baseSubs = Math.max(400, Math.round(baseSubs * (1 + jitter)));
    baseMrrCents = Math.max(
      10_000_00,
      Math.round(baseMrrCents * (1 + jitter * 0.5)),
    );
    const newPaid = Math.floor(8 + rnd() * 18);
    const churned = Math.floor(4 + rnd() * 14);
    const trialStarts = Math.floor(25 + rnd() * 60);
    const trialConv = 0.22 + rnd() * 0.12;
    const annualMix = 0.35 + rnd() * 0.2;
    const monthlyChurn = churned / Math.max(1, baseSubs);

    snapshots.push({
      snapshotDate: isoDate(d),
      activeProSubscribers: baseSubs,
      mrrCents: baseMrrCents,
      arrCents: baseMrrCents * 12,
      revenue28dCents: Math.round(baseMrrCents * 1.05 + rnd() * 50_000_00),
      proceeds28dCents: Math.round(baseMrrCents * 0.82 + rnd() * 40_000_00),
      newPaidSubscribers28d: newPaid * 28,
      churnedSubscribers28d: churned * 28,
      netNewSubscribers28d: (newPaid - churned) * 28,
      monthlyChurnRate: Number(monthlyChurn.toFixed(4)),
      trialStarts28d: trialStarts * 28,
      trialConversionRate: Number(trialConv.toFixed(4)),
      annualPlanMix: Number(annualMix.toFixed(4)),
      rawPayload: { source: "mock", dayOffset: i },
    });
  }

  const eventTypes = [
    "new_paid",
    "churn",
    "reactivation",
    "trial_start",
    "trial_convert",
    "trial_cancel",
  ] as const;

  for (let e = 0; e < 180; e++) {
    const dayBack = Math.floor(rnd() * 60);
    const ed = new Date(today);
    ed.setUTCDate(ed.getUTCDate() - dayBack);
    const type = eventTypes[Math.floor(rnd() * eventTypes.length)];
    events.push({
      eventDate: isoDate(ed),
      eventType: type,
      subscriberId: `mock_sub_${Math.floor(rnd() * 5000)}`,
      productId: rnd() > 0.5 ? "pro_annual" : "pro_monthly",
      store: rnd() > 0.55 ? "app_store" : "play_store",
      metadata: { mock: true },
    });
  }

  for (let s = 0; s < 300; s++) {
    const st =
      rnd() > 0.75
        ? "trialing"
        : rnd() > 0.12
          ? "active"
          : rnd() > 0.5
            ? "expired"
            : "billing_issue";
    const first = new Date(today);
    first.setUTCDate(first.getUTCDate() - Math.floor(rnd() * 400));
    const last = new Date(today);
    last.setUTCDate(last.getUTCDate() - Math.floor(rnd() * 14));
    statuses.push({
      subscriberId: `mock_status_${s}`,
      status: st,
      firstSeenAt: first.toISOString(),
      lastSeenAt: last.toISOString(),
      currentProductId: rnd() > 0.45 ? "pro_annual" : "pro_monthly",
      isAnnual: rnd() > 0.42,
      mrrContributionCents:
        st === "active" || st === "trialing"
          ? Math.floor(499 + rnd() * 7500) * 100
          : null,
    });
  }

  for (let m = 0; m < 12; m++) {
    const sm = new Date(today);
    sm.setUTCMonth(sm.getUTCMonth() - m - 1);
    const signupMonth = monthIso(sm);
    const paidConv = 0.08 + rnd() * 0.15;
    const ltv = Math.floor(120_00 + rnd() * 280_00);
    for (let rel = 0; rel <= 8; rel++) {
      const baseRet = Math.max(0.05, 1 - rel * 0.08 - rnd() * 0.05);
      cohorts.push({
        signupMonth,
        relativeMonth: rel,
        retentionRate: Number(baseRet.toFixed(4)),
        paidConversionRate: rel === 0 ? Number(paidConv.toFixed(4)) : null,
        realizedLtvCents: rel === 0 ? ltv : ltv + Math.floor(rel * rnd() * 20_00),
      });
    }
  }

  return { snapshots, events, statuses, cohorts };
}
