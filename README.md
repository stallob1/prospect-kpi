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
3. Run `supabase/migrations/20250508000000_snapshot_nullable_optional_metrics.sql` so snapshot columns that RevenueCat may omit can be stored as `NULL` (the UI shows an em dash instead of a fake zero).
4. RLS is enabled on all four tables with **no** grants to `anon` / `authenticated` in this migration — only the **service role** (used server-side) can read/write.

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
- If the key is set, **`syncFromRevenueCat`** runs: it calls **`GET /v2/projects/{id}/metrics/overview`** plus several **Charts** endpoints (same API key; see [RevenueCat API v2](https://www.revenuecat.com/docs/api-v2)) and merges results into one daily snapshot. `raw_payload` stores the overview response and slimmed chart metadata for debugging.

### Production checklist (live RevenueCat)

1. In **Vercel → Settings → Environment Variables**, set for **Production**:
   - `REVENUECAT_API_KEY` (or `REVENUECAT_SECRET_API_KEY`)
   - `REVENUECAT_PROJECT_ID` (the `proj…` id from the RevenueCat dashboard / API)
2. **Redeploy** (or wait for the next deploy) so the server sees the new vars.
3. Trigger **Refresh data** on the Overview page once.
4. In Supabase, open `revenuecat_daily_snapshots` → latest row → **`raw_payload`**. Confirm `overview_response.metrics` is an array of `{ id, value, unit }` objects. If shapes differ, update [`src/lib/revenuecat/overview-map.ts`](src/lib/revenuecat/overview-map.ts).

**Charts rate limit:** the Charts & Metrics domain is limited (commonly **15 requests/minute** per project). One sync issues several chart calls in parallel; if you hit `429`, wait a minute and refresh again, or reduce chart calls in [`src/lib/revenuecat/sync.ts`](src/lib/revenuecat/sync.ts).

### KPI → RevenueCat mapping (live sync)

| Dashboard field | Primary source | Fallback / notes |
|-----------------|----------------|-------------------|
| Active subscribers | Overview metric ids `active_subscriptions`, `active_subscribers` | Chart `actives` (latest point) |
| MRR (cents) | Overview `mrr`, `monthly_recurring_revenue` | Values treated as **USD major units × 100** unless very large integers (then assumed cents). |
| ARR (cents) | Overview `arr`, `annual_recurring_revenue` | Chart `arr` summary; else **MRR × 12**. |
| Revenue 28d (cents) | Overview revenue-style ids | Chart `revenue` + selectors `{ "revenue_type": "gross" }`, last **28** daily points summed (USD → cents). |
| Proceeds 28d (cents) | Overview proceeds ids | Chart `revenue` + `{ "revenue_type": "proceeds" }`. |
| New / churn / net (28d) | Overview `new_customers`, `churned_subscribers`, etc. when present | `customers_new` chart (28d sum) fills **new** only; churn may stay null if RC does not expose it on overview. |
| Monthly churn rate | Overview churn-style ids | Chart `churn` (first parsable rate in `summary` or series). |
| Trial starts (28d) | Overview `trial_starts_28d`, `trial_starts`, … | Not inferred from `active_trials`. |
| Trial conversion | Overview | Chart `conversion_to_paying` + selector `{ "conversion_timeframe": "28_days" }`. |
| Annual plan mix | Overview | Often absent — UI shows **—** until RC exposes a matching metric. |
| Subscriber **events** / **status** / **cohorts** (live) | — | Still **not** populated from REST in this build (mock seed only). Use RevenueCat dashboard or webhooks for full fidelity there. |

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

The REST surface changes over time. Parsing lives in [`src/lib/revenuecat/overview-map.ts`](src/lib/revenuecat/overview-map.ts) (overview `metrics[]` by `id`) and [`src/lib/revenuecat/chart-helpers.ts`](src/lib/revenuecat/chart-helpers.ts) + [`src/lib/revenuecat/sync.ts`](src/lib/revenuecat/sync.ts) (chart merges). Extend those files when RevenueCat adds or renames metric ids. Inspect `revenuecat_daily_snapshots.raw_payload` after each sync to validate shapes in your project.
