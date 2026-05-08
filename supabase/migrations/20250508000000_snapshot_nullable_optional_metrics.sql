-- Allow NULL for metrics not supplied by RevenueCat overview/charts sync
-- so the UI can show em-dash instead of misleading zeros.

alter table public.revenuecat_daily_snapshots
  alter column revenue_28d_cents drop not null,
  alter column proceeds_28d_cents drop not null,
  alter column new_paid_subscribers_28d drop not null,
  alter column churned_subscribers_28d drop not null,
  alter column net_new_subscribers_28d drop not null,
  alter column trial_starts_28d drop not null;
