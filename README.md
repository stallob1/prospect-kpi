# Prospect Pro — Subscription KPI Dashboard

Internal Next.js (App Router) dashboard for subscription KPIs. Metrics are **read from Supabase** tables populated by a daily sync (or mock seed), not by calling RevenueCat on every page load.

**Location in monorepo:** `apps/subscription-kpi-dashboard/`

## Stack

- Next.js 15, TypeScript, Tailwind CSS
- Supabase (Postgres) — migrations under `supabase/migrations/`
- RevenueCat REST (server-only) — optional when env vars are set; otherwise sync uses **mock** data
- Vercel Cron — `vercel.json` schedules `GET /api/cron/revenuecat-sync`

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `SUPABASE_URL` | Server | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Read/write dashboard tables (bypasses RLS) |
| `REVENUECAT_API_KEY` or `REVENUECAT_SECRET_API_KEY` | **Server only** | RevenueCat REST Bearer token |
| `REVENUECAT_PROJECT_ID` | Server | RevenueCat project id for API paths |
| `CRON_SECRET` | Server | Vercel Cron must send `Authorization: Bearer <CRON_SECRET>` or header `x-cron-secret` |
| `ADMIN_REFRESH_SECRET` | Server | If set, `POST /api/admin/revenuecat-refresh` requires JSON body `{ "secret": "<same value>" }`. Overview **Refresh data** tries without secret first, then prompts if the server returns 401. |

Do **not** prefix RevenueCat or service-role keys with `NEXT_PUBLIC_`. This app does not expose them to the browser.

### Verifying client bundles

After `npm run build`, search client chunks for secrets (should return no matches in source-controlled paths):

```bash
grep -R "REVENUECAT" .next/static 2>/dev/null || true
grep -R "service_role" .next/static 2>/dev/null || true
```

## Local development

```bash
cd apps/subscription-kpi-dashboard
cp .env.local.example .env.local   # create from example below if missing
# fill SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
```

Open [http://localhost:3010](http://localhost:3010).

Example `.env.local` (adjust values):

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# Optional:
# REVENUECAT_API_KEY=
# REVENUECAT_PROJECT_ID=
# CRON_SECRET=long-random
# ADMIN_REFRESH_SECRET=another-long-random
```

## Supabase setup

1. Create a Supabase project.
2. Run SQL from `supabase/migrations/20250507000000_revenuecat_kpi_tables.sql` in the SQL editor (or use Supabase CLI migrations).
3. RLS is enabled on all four tables with **no** grants to `anon` / `authenticated` in this migration — only the **service role** (used server-side) can read/write.

Tables:

- `revenuecat_daily_snapshots` — one row per `snapshot_date` (unique)
- `revenuecat_subscriber_events` — lifecycle events
- `revenuecat_subscriber_status` — latest status per `subscriber_id`
- `revenuecat_cohorts` — normalized cohort rows (`signup_month`, `relative_month`, unique pair)

## Seed mock data

With Supabase env configured:

```bash
npm run db:seed
```

This runs `scripts/seed-mock.ts`, which calls the same `syncFromMock` path as the app (deterministic mock payload → upserts).

## Routes

| Path | Purpose |
|------|---------|
| `/` | Overview cards from latest snapshot |
| `/movement` | Active subs line chart + recent events table |
| `/revenue` | MRR / revenue / proceeds + charts |
| `/trials` | Trial starts and conversion trends |
| `/cohorts` | Cohort summary table + retention heatmap |

## API

- **`GET /api/cron/revenuecat-sync`** — Cron entry. Requires `CRON_SECRET` on the server and matching `Authorization: Bearer …` or `x-cron-secret`.
- **`POST /api/admin/revenuecat-refresh`** — Manual sync. If `ADMIN_REFRESH_SECRET` is set, JSON `{ "secret": "…" }` must match.

Sync behavior:

- If **no** `REVENUECAT_API_KEY` / `REVENUECAT_SECRET_API_KEY`, scheduled and admin syncs run **`syncFromMock`** (still writes to Supabase).
- If the key is set, **`syncFromRevenueCat`** runs (best-effort `metrics/overview` endpoint; see `src/lib/revenuecat/client.ts`). Adjust mapping when RevenueCat changes their API.

## Vercel deployment

1. Connect the repository; set **Root Directory** to `apps/subscription-kpi-dashboard`.
2. Add all env vars in the Vercel project settings.
3. Enable **Cron** for the project (plan-dependent). `vercel.json` schedules daily `0 6 * * *` UTC.

**Fallback if Cron is unavailable:** use a GitHub Actions `schedule` workflow that `curl`s the same cron URL with the Bearer secret.

## Security checklist

- [ ] Service role key only on server (Vercel env, never in client or public repos).
- [ ] RevenueCat secret only on server.
- [ ] `CRON_SECRET` long and random; rotate if leaked.
- [ ] Prefer setting `ADMIN_REFRESH_SECRET` in production so only people with the secret can trigger refresh.
- [ ] Confirm `grep` on `.next/static` finds no secret strings after build.

## RevenueCat API note

The REST surface changes over time. The live client targets a single overview-style URL; raw JSON is also folded into `raw_payload` on snapshots when using live mapping extensions. Extend `mapLiveRevenueCatToPayload` / `mapOverviewToSnapshot` for your exact metrics.
