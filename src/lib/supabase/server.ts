import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  CohortRow,
  DailySnapshotRow,
  SubscriberEventRow,
  SubscriberStatusRow,
} from "@/lib/db/types";

export function getServiceSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function fetchLatestSnapshot(
  supabase: SupabaseClient,
): Promise<DailySnapshotRow | null> {
  const { data, error } = await supabase
    .from("revenuecat_daily_snapshots")
    .select("*")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("fetchLatestSnapshot failed", error.message);
    return null;
  }
  return data as DailySnapshotRow | null;
}

export async function fetchSnapshotsRange(
  supabase: SupabaseClient,
  days: number,
): Promise<DailySnapshotRow[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("revenuecat_daily_snapshots")
    .select("*")
    .gte("snapshot_date", sinceStr)
    .order("snapshot_date", { ascending: true });
  if (error) {
    console.error("fetchSnapshotsRange failed", error.message);
    return [];
  }
  return (data ?? []) as DailySnapshotRow[];
}

export async function fetchRecentEvents(
  supabase: SupabaseClient,
  limit = 200,
): Promise<SubscriberEventRow[]> {
  const { data, error } = await supabase
    .from("revenuecat_subscriber_events")
    .select("*")
    .order("event_date", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("fetchRecentEvents failed", error.message);
    return [];
  }
  return (data ?? []) as SubscriberEventRow[];
}

export async function fetchSubscriberStatusSample(
  supabase: SupabaseClient,
  limit = 500,
): Promise<SubscriberStatusRow[]> {
  const { data, error } = await supabase
    .from("revenuecat_subscriber_status")
    .select("*")
    .order("last_seen_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("fetchSubscriberStatusSample failed", error.message);
    return [];
  }
  return (data ?? []) as SubscriberStatusRow[];
}

export async function fetchCohorts(
  supabase: SupabaseClient,
): Promise<CohortRow[]> {
  const { data, error } = await supabase
    .from("revenuecat_cohorts")
    .select("*")
    .order("signup_month", { ascending: false })
    .order("relative_month", { ascending: true });
  if (error) {
    console.error("fetchCohorts failed", error.message);
    return [];
  }
  return (data ?? []) as CohortRow[];
}
