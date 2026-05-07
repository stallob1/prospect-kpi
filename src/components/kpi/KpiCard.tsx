export function KpiCard({
  title,
  value,
  subtitle,
  trend,
}: {
  title: string;
  value: string;
  subtitle?: string;
  trend?: string;
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-muted/60 p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
      {subtitle ? (
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      ) : null}
      {trend ? (
        <p className="mt-2 text-xs font-medium text-emerald-400/90">{trend}</p>
      ) : null}
    </div>
  );
}
