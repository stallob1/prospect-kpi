import { LineChart } from "@/components/charts/LineChart";
import { KpiCard } from "@/components/kpi/KpiCard";
import { ConfigBanner } from "@/components/layout/ConfigBanner";
import { formatNumber, formatNumberOptional, formatPercent } from "@/lib/format";
import { fetchLatestSnapshot, fetchSnapshotsRange, getServiceSupabase } from "@/lib/supabase/server";

export default async function TrialsPage() {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return (
      <div>
        <ConfigBanner message="Supabase env vars are not set." />
        <h2 className="text-xl font-semibold text-white">Trials</h2>
      </div>
    );
  }

  const latest = await fetchLatestSnapshot(supabase);
  const series = await fetchSnapshotsRange(supabase, 90);

  const trialStarts = series.map((s) => ({
    label: s.snapshot_date.slice(5),
    value: s.trial_starts_28d ?? 0,
  }));

  const conv = series.map((s) => ({
    label: s.snapshot_date.slice(5),
    value: Math.round((s.trial_conversion_rate ?? 0) * 1000),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-white">Trials</h2>
        <p className="mt-1 text-sm text-slate-400">
          Funnel metrics from snapshot fields (28d windows as ingested).
        </p>
      </div>

      {!latest ? (
        <p className="text-sm text-slate-500">No snapshot data.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              title="Trial starts (28d)"
              value={formatNumberOptional(latest.trial_starts_28d)}
            />
            <KpiCard
              title="Trial conversion"
              value={formatPercent(latest.trial_conversion_rate, 1)}
            />
            <KpiCard
              title="Active subscribers"
              value={formatNumber(latest.active_pro_subscribers)}
              subtitle="Base for movement context"
            />
          </div>

          <section className="rounded-xl border border-surface-border bg-surface-muted/40 p-4">
            <h3 className="text-sm font-medium text-slate-300">Trial starts (28d window)</h3>
            <LineChart data={trialStarts} color="#a855f7" valueLabel="Starts" />
          </section>

          <section className="rounded-xl border border-surface-border bg-surface-muted/40 p-4">
            <h3 className="text-sm font-medium text-slate-300">
              Trial conversion rate (×1000 for axis)
            </h3>
            <LineChart data={conv} color="#f97316" valueLabel="Rate ×1000" />
          </section>
        </>
      )}
    </div>
  );
}
