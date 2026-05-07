import { CohortHeatmap } from "@/components/cohorts/CohortHeatmap";
import { ConfigBanner } from "@/components/layout/ConfigBanner";
import { formatCents, formatPercent } from "@/lib/format";
import { fetchCohorts, getServiceSupabase } from "@/lib/supabase/server";

export default async function CohortsPage() {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return (
      <div>
        <ConfigBanner message="Supabase env vars are not set." />
        <h2 className="text-xl font-semibold text-white">Cohorts</h2>
      </div>
    );
  }

  const rows = await fetchCohorts(supabase);
  const summary = new Map<
    string,
    { paid: number | null; ltv: number; months: number }
  >();

  for (const r of rows) {
    const cur = summary.get(r.signup_month) ?? { paid: null, ltv: 0, months: 0 };
    if (r.relative_month === 0) {
      cur.paid = r.paid_conversion_rate;
      cur.ltv = r.realized_ltv_cents;
    }
    cur.months = Math.max(cur.months, r.relative_month);
    summary.set(r.signup_month, cur);
  }

  const months = Array.from(summary.keys()).sort().reverse();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-white">Cohorts</h2>
        <p className="mt-1 text-sm text-slate-400">
          Retention by signup month (normalized rows). Heatmap uses retention_rate.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No cohort rows yet.</p>
      ) : (
        <>
          <section className="overflow-x-auto rounded-xl border border-surface-border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Signup month</th>
                  <th className="px-3 py-2">Paid conversion</th>
                  <th className="px-3 py-2">Realized LTV (M0)</th>
                  <th className="px-3 py-2">Horizon</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => {
                  const s = summary.get(m)!;
                  return (
                    <tr key={m} className="border-t border-surface-border text-slate-200">
                      <td className="px-3 py-2 font-mono text-xs">{m}</td>
                      <td className="px-3 py-2">{formatPercent(s.paid, 1)}</td>
                      <td className="px-3 py-2">{formatCents(s.ltv)}</td>
                      <td className="px-3 py-2">M0–M{s.months}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="rounded-xl border border-surface-border bg-surface-muted/40 p-4">
            <h3 className="mb-3 text-sm font-medium text-slate-300">Retention heatmap</h3>
            <CohortHeatmap rows={rows} />
          </section>
        </>
      )}
    </div>
  );
}
