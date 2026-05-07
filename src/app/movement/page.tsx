import { LineChart } from "@/components/charts/LineChart";
import { ConfigBanner } from "@/components/layout/ConfigBanner";
import { formatNumber } from "@/lib/format";
import {
  fetchRecentEvents,
  fetchSnapshotsRange,
  getServiceSupabase,
} from "@/lib/supabase/server";

export default async function MovementPage() {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return (
      <div>
        <ConfigBanner message="Supabase env vars are not set; movement charts stay empty." />
        <h2 className="text-xl font-semibold text-white">Subscriber movement</h2>
      </div>
    );
  }

  const snapshots = await fetchSnapshotsRange(supabase, 120);
  const events = await fetchRecentEvents(supabase, 120);

  const lineData = snapshots.map((s) => ({
    label: s.snapshot_date.slice(5),
    value: s.active_pro_subscribers,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-white">Subscriber movement</h2>
        <p className="mt-1 text-sm text-slate-400">
          Active subscribers from stored daily snapshots and recent events.
        </p>
      </div>

      <section className="rounded-xl border border-surface-border bg-surface-muted/40 p-4">
        <h3 className="text-sm font-medium text-slate-300">Active subscribers</h3>
        <LineChart data={lineData} valueLabel="Active" />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-slate-300">Recent events</h3>
        <div className="overflow-x-auto rounded-xl border border-surface-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface-muted text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Subscriber</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Store</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-slate-500" colSpan={5}>
                    No events yet.
                  </td>
                </tr>
              ) : (
                events.map((e) => (
                  <tr key={e.id} className="border-t border-surface-border text-slate-200">
                    <td className="px-3 py-2 font-mono text-xs">{e.event_date}</td>
                    <td className="px-3 py-2">{e.event_type}</td>
                    <td className="px-3 py-2 font-mono text-xs">{e.subscriber_id}</td>
                    <td className="px-3 py-2">{e.product_id ?? "—"}</td>
                    <td className="px-3 py-2">{e.store ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Showing {formatNumber(events.length)} most recent rows.
        </p>
      </section>
    </div>
  );
}
