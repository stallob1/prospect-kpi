import { timingSafeEqual } from "node:crypto";
import { getServiceSupabase } from "@/lib/supabase/server";
import { runScheduledSync } from "@/lib/revenuecat/sync";

function safeEqualString(a: string, b: string) {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export async function POST(request: Request) {
  const expected = process.env.ADMIN_REFRESH_SECRET;
  if (expected) {
    let bodySecret = "";
    try {
      const body = (await request.json()) as { secret?: string };
      bodySecret = typeof body.secret === "string" ? body.secret : "";
    } catch {
      bodySecret = "";
    }
    if (!safeEqualString(bodySecret, expected)) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return Response.json(
      { ok: false, error: "Supabase service client is not configured" },
      { status: 500 },
    );
  }

  try {
    const summary = await runScheduledSync(supabase);
    return Response.json({ ok: true, summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
