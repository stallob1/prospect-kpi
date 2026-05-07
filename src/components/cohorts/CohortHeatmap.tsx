"use client";

import type { CohortRow } from "@/lib/db/types";

function heatColor(rate: number | null) {
  if (rate == null) return "bg-slate-800";
  const t = Math.min(1, Math.max(0, rate));
  const alpha = 0.25 + t * 0.75;
  return `rgba(59, 130, 246, ${alpha.toFixed(2)})`;
}

export function CohortHeatmap({ rows }: { rows: CohortRow[] }) {
  const byMonth = new Map<string, CohortRow[]>();
  for (const r of rows) {
    const list = byMonth.get(r.signup_month) ?? [];
    list.push(r);
    byMonth.set(r.signup_month, list);
  }
  const months = Array.from(byMonth.keys()).sort().reverse();
  const maxRel = rows.reduce((m, r) => Math.max(m, r.relative_month), 0);

  if (!months.length) {
    return (
      <p className="text-sm text-slate-500">No cohort rows yet. Seed or sync data.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border border-surface-border bg-surface-muted px-2 py-2 text-left text-slate-400">
              Signup month
            </th>
            {Array.from({ length: maxRel + 1 }, (_, i) => (
              <th
                key={i}
                className="border border-surface-border bg-surface-muted px-2 py-2 text-slate-400"
              >
                M{i}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((m) => {
            const cells = byMonth.get(m) ?? [];
            const byRel = new Map(cells.map((c) => [c.relative_month, c]));
            return (
              <tr key={m}>
                <td className="border border-surface-border px-2 py-1 font-mono text-slate-300">
                  {m}
                </td>
                {Array.from({ length: maxRel + 1 }, (_, rel) => {
                  const c = byRel.get(rel);
                  const rate = c?.retention_rate ?? null;
                  return (
                    <td
                      key={rel}
                      className="border border-surface-border px-0 py-0 text-center text-slate-900"
                      style={{ background: heatColor(rate) }}
                      title={rate != null ? `${(rate * 100).toFixed(1)}%` : "—"}
                    >
                      <span className="sr-only">
                        {rate != null ? `${(rate * 100).toFixed(0)}%` : "empty"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
