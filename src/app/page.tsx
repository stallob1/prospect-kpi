import { KpiCard } from "@/components/kpi/KpiCard";
import { ConfigBanner } from "@/components/layout/ConfigBanner";
import { RefreshDataButton } from "@/components/overview/RefreshDataButton";
import { formatCents, formatNumber, formatPercent } from "@/lib/format";
import { fetchLatestSnapshot, getServiceSupabase } from "@/lib/supabase/server";

export default async function OverviewPage() {
  const supabase = getServiceSupabase();

  if (!supabase) {
    return (
      <div>
        <ConfigBanner message="Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-side) to load KPI snapshots. See README." />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Overview</h2>
            <p className="mt-1 text-sm text-slate-400">
              Daily subscription health once Supabase is wired.
            </p>
          </div>
          <RefreshDataButton />
        </div>
      </div>
    );
  }

  const latest = await fetchLatestSnapshot(supabase);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Overview</h2>
          <p className="mt-1 text-sm text-slate-400">
            Latest stored snapshot{latest ? ` — ${latest.snapshot_date}` : ""}.
          </p>
        </div>
        <RefreshDataButton />
      </div>

      {!latest ? (
        <p className="mt-8 text-sm text-slate-500">
          No snapshots yet. Run{" "}
          <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">
            npm run db:seed
          </code>{" "}
          or trigger a cron / admin refresh.
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            title="Active Pro subscribers"
            value={formatNumber(latest.active_pro_subscribers)}
            subtitle="From daily snapshot"
          />
          <KpiCard
            title="MRR"
            value={formatCents(latest.mrr_cents)}
            subtitle="Trailing month recurring"
          />
          <KpiCard
            title="ARR (derived)"
            value={formatCents(latest.arr_cents)}
            subtitle="MRR × 12 from snapshot"
          />
          <KpiCard
            title="Net new (28d)"
            value={formatNumber(latest.net_new_subscribers_28d)}
            subtitle={`New ${formatNumber(latest.new_paid_subscribers_28d)} · Churned ${formatNumber(latest.churned_subscribers_28d)}`}
          />
          <KpiCard
            title="Monthly churn"
            value={formatPercent(latest.monthly_churn_rate ?? 0, 2)}
            subtitle="Share of base (snapshot field)"
          />
          <KpiCard
            title="Trial conversion"
            value={formatPercent(latest.trial_conversion_rate, 1)}
            subtitle={`${formatNumber(latest.trial_starts_28d)} trial starts (28d)`}
          />
          <KpiCard
            title="Annual plan mix"
            value={formatPercent(latest.annual_plan_mix, 0)}
            subtitle="Share on annual vs monthly (modeled)"
          />
          <KpiCard
            title="Revenue (28d)"
            value={formatCents(latest.revenue_28d_cents)}
            subtitle={`Proceeds ${formatCents(latest.proceeds_28d_cents)}`}
          />
        </div>
      )}
    </div>
  );
}
