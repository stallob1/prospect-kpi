"use client";

import { useState } from "react";

export function RefreshDataButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function postRefresh(secret: string) {
    return fetch("/api/admin/revenuecat-refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret }),
    });
  }

  async function onRefresh() {
    setLoading(true);
    setMessage(null);
    try {
      let secret = "";
      let res = await postRefresh(secret);
      if (res.status === 401) {
        const entered =
          typeof window !== "undefined"
            ? window.prompt("Enter ADMIN_REFRESH_SECRET") ?? ""
            : "";
        secret = entered;
        res = await postRefresh(secret);
      }
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        summary?: Record<string, unknown>;
      };
      if (!res.ok) {
        setMessage(json.error ?? `Request failed (${res.status})`);
      } else {
        setMessage(`OK — ${JSON.stringify(json.summary ?? {})}`);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => void onRefresh()}
        disabled={loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Refreshing…" : "Refresh data"}
      </button>
      {message ? (
        <p className="max-w-md text-right text-xs text-slate-400">{message}</p>
      ) : null}
    </div>
  );
}
