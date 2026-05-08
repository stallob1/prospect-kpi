import { LineChart } from "@/components/charts/LineChart";
import { SimpleBarChart } from "@/components/charts/SimpleBarChart";
import { KpiCard } from "@/components/kpi/KpiCard";
import { ConfigBanner } from "@/components/layout/ConfigBanner";
import { formatCents, formatCentsOptional, formatPercent } from "@/lib/format";
import { fetchLatestSnapshot, fetchSnapshotsRange, getServiceSupabase } from "@/lib/supabase/server";

export default async function RevenuePage() {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return (
      <div>
        <ConfigBanner message="Supabase env vars are not set." />
        <h2 className="text-xl font-semibold text-white">Revenue</h2>
      </div>
    );
  }

  const latest = await fetchLatestSnapshot(supabase);
  const series = await fetchSnapshotsRange(supabase, 90);

  const mrrTrend = series.map((s) => ({
    label: s.snapshot_date.slice(5),
    value: Math.round(s.mrr_cents / 100),
  }));

  const barData: { name: string; value: number }[] = [];
  if (latest) {
    if (latest.revenue_28d_cents != null) {
      barData.push({ name: "Revenue 28d", value: Math.round(latest.revenue_28d_cents / 100) });
    }
    if (latest.proceeds_28d_cents != null) {
      barData.push({ name: "Proceeds 28d", value: Math.round(latest.proceeds_28d_cents / 100) });
    }
    barData.push({ name: "MRR", value: Math.round(latest.mrr_cents / 100) });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-white">Revenue</h2>
        <p className="mt-1 text-sm text-slate-400">
          Stored aggregates (not live RevenueCat on page load).
        </p>
      </div>

      {!latest ? (
        <p className="text-sm text-slate-500">No snapshot data.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard title="MRR" value={formatCents(latest.mrr_cents)} />
            <KpiCard title="Revenue (28d)" value={formatCentsOptional(latest.revenue_28d_cents)} />
            <KpiCard title="Proceeds (28d)" value={formatCentsOptional(latest.proceeds_28d_cents)} />
            <KpiCard
              title="Annual plan mix"
              value={formatPercent(latest.annual_plan_mix, 0)}
              subtitle="Higher mix usually improves LTV"
            />
            <KpiCard title="ARR (derived)" value={formatCents(latest.arr_cents)} />
          </div>

          <section className="rounded-xl border border-surface-border bg-surface-muted/40 p-4">
            <h3 className="text-sm font-medium text-slate-300">MRR trend (USD, rounded)</h3>
            <LineChart data={mrrTrend} color="#22c55e" valueLabel="USD (000s)" />
          </section>

          <section className="rounded-xl border border-surface-border bg-surface-muted/40 p-4">
            <h3 className="text-sm font-medium text-slate-300">Latest period mix (USD, rounded)</h3>
            <SimpleBarChart data={barData} />
          </section>
        </>
      )}
    </div>
  );
}
