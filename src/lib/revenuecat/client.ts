/**
 * Server-only RevenueCat HTTP client. Do not import from client components.
 */

export type RevenueCatOverviewMetrics = {
  mrr?: number;
  active_subscriptions?: number;
  active_trials?: number;
  churn_rate?: number;
  [key: string]: unknown;
};

export async function fetchRevenueCatOverviewJson(): Promise<{
  ok: true;
  body: unknown;
} | { ok: false; error: string; status?: number }> {
  const key =
    process.env.REVENUECAT_API_KEY ?? process.env.REVENUECAT_SECRET_API_KEY;
  const projectId = process.env.REVENUECAT_PROJECT_ID;
  if (!key) {
    return { ok: false, error: "Missing REVENUECAT_API_KEY (or REVENUECAT_SECRET_API_KEY)" };
  }
  if (!projectId) {
    return { ok: false, error: "Missing REVENUECAT_PROJECT_ID" };
  }

  /** RC REST v2 surface evolves; this URL is a best-effort starting point. */
  const url = `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/metrics/overview`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: `RevenueCat request failed (${res.status}): ${text.slice(0, 500)}`,
      };
    }
    try {
      return { ok: true, body: JSON.parse(text) as unknown };
    } catch {
      return { ok: false, error: "RevenueCat response was not valid JSON" };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
