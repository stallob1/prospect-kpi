-- Prospect Pro subscription KPI tables (RevenueCat sync target)
-- RLS: enabled with default deny; service role bypasses RLS for server ingest/reads.

create extension if not exists "pgcrypto";

create table if not exists public.revenuecat_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  active_pro_subscribers integer not null default 0,
  mrr_cents bigint not null default 0,
  arr_cents bigint not null default 0,
  revenue_28d_cents bigint not null default 0,
  proceeds_28d_cents bigint not null default 0,
  new_paid_subscribers_28d integer not null default 0,
  churned_subscribers_28d integer not null default 0,
  net_new_subscribers_28d integer not null default 0,
  monthly_churn_rate numeric,
  trial_starts_28d integer not null default 0,
  trial_conversion_rate numeric,
  annual_plan_mix numeric,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists revenuecat_daily_snapshots_snapshot_date_idx
  on public.revenuecat_daily_snapshots (snapshot_date desc);

create table if not exists public.revenuecat_subscriber_events (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  event_type text not null,
  subscriber_id text not null,
  product_id text,
  store text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists revenuecat_subscriber_events_event_date_idx
  on public.revenuecat_subscriber_events (event_date desc);

create index if not exists revenuecat_subscriber_events_subscriber_id_idx
  on public.revenuecat_subscriber_events (subscriber_id);

create table if not exists public.revenuecat_subscriber_status (
  subscriber_id text primary key,
  status text not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  current_product_id text,
  is_annual boolean,
  mrr_contribution_cents bigint
);

create index if not exists revenuecat_subscriber_status_last_seen_idx
  on public.revenuecat_subscriber_status (last_seen_at desc);

create table if not exists public.revenuecat_cohorts (
  id uuid primary key default gen_random_uuid(),
  signup_month date not null,
  relative_month integer not null,
  retention_rate numeric,
  paid_conversion_rate numeric,
  realized_ltv_cents bigint not null default 0,
  computed_at timestamptz not null default now(),
  unique (signup_month, relative_month)
);

create index if not exists revenuecat_cohorts_signup_month_idx
  on public.revenuecat_cohorts (signup_month desc);

alter table public.revenuecat_daily_snapshots enable row level security;
alter table public.revenuecat_subscriber_events enable row level security;
alter table public.revenuecat_subscriber_status enable row level security;
alter table public.revenuecat_cohorts enable row level security;

-- Default deny: no policies for anon/authenticated. Service role bypasses RLS.

comment on table public.revenuecat_daily_snapshots is 'Daily KPI snapshot rows ingested from RevenueCat (or mock seed).';
comment on table public.revenuecat_subscriber_events is 'Subscriber lifecycle events for movement / funnel views.';
comment on table public.revenuecat_subscriber_status is 'Latest known status per subscriber id.';
comment on table public.revenuecat_cohorts is 'Normalized cohort retention rows (one row per signup_month + relative_month).';
