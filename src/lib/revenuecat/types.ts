/** Normalized shapes used by sync + UI mappers (not raw RevenueCat JSON). */

export type RevenueCatEventType =
  | "new_paid"
  | "churn"
  | "reactivation"
  | "trial_start"
  | "trial_convert"
  | "trial_cancel"
  | "renewal"
  | "plan_change";

export type NormalizedDailySnapshot = {
  snapshotDate: string;
  activeProSubscribers: number;
  mrrCents: number;
  arrCents: number;
  revenue28dCents: number;
  proceeds28dCents: number;
  newPaidSubscribers28d: number;
  churnedSubscribers28d: number;
  netNewSubscribers28d: number;
  monthlyChurnRate: number | null;
  trialStarts28d: number;
  trialConversionRate: number | null;
  annualPlanMix: number | null;
  rawPayload?: Record<string, unknown>;
};

export type NormalizedSubscriberEvent = {
  eventDate: string;
  eventType: RevenueCatEventType;
  subscriberId: string;
  productId?: string | null;
  store?: string | null;
  metadata?: Record<string, unknown>;
};

export type NormalizedSubscriberStatus = {
  subscriberId: string;
  status: "active" | "trialing" | "expired" | "billing_issue" | "paused";
  firstSeenAt: string;
  lastSeenAt: string;
  currentProductId?: string | null;
  isAnnual?: boolean | null;
  mrrContributionCents?: number | null;
};

export type NormalizedCohortRow = {
  signupMonth: string;
  relativeMonth: number;
  retentionRate: number | null;
  paidConversionRate: number | null;
  realizedLtvCents: number;
};

export type NormalizedSyncPayload = {
  snapshots: NormalizedDailySnapshot[];
  events: NormalizedSubscriberEvent[];
  statuses: NormalizedSubscriberStatus[];
  cohorts: NormalizedCohortRow[];
};

export type SyncSummary = {
  snapshotsUpserted: number;
  eventsInserted: number;
  statusesUpserted: number;
  cohortRowsUpserted: number;
  errors: string[];
  source: "mock" | "revenuecat";
};
