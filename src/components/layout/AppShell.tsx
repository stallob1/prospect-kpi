import Link from "next/link";

const nav = [
  { href: "/", label: "Overview" },
  { href: "/movement", label: "Movement" },
  { href: "/revenue", label: "Revenue" },
  { href: "/trials", label: "Trials" },
  { href: "/cohorts", label: "Cohorts" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-surface-border bg-surface-muted/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
              Prospect Pro
            </p>
            <h1 className="text-lg font-semibold text-white">
              Subscription KPI Dashboard
            </h1>
          </div>
          <nav className="flex flex-wrap gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
