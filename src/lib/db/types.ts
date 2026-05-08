export type DailySnapshotRow = {
  id: string;
  snapshot_date: string;
  active_pro_subscribers: number;
  mrr_cents: number;
  arr_cents: number;
  revenue_28d_cents: number | null;
  proceeds_28d_cents: number | null;
  new_paid_subscribers_28d: number | null;
  churned_subscribers_28d: number | null;
  net_new_subscribers_28d: number | null;
  monthly_churn_rate: number | null;
  trial_starts_28d: number | null;
  trial_conversion_rate: number | null;
  annual_plan_mix: number | null;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
};

export type SubscriberEventRow = {
  id: string;
  event_date: string;
  event_type: string;
  subscriber_id: string;
  product_id: string | null;
  store: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type SubscriberStatusRow = {
  subscriber_id: string;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
  current_product_id: string | null;
  is_annual: boolean | null;
  mrr_contribution_cents: number | null;
};

export type CohortRow = {
  id: string;
  signup_month: string;
  relative_month: number;
  retention_rate: number | null;
  paid_conversion_rate: number | null;
  realized_ltv_cents: number;
  computed_at: string;
};
