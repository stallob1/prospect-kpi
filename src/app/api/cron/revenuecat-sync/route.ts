import { getServiceSupabase } from "@/lib/supabase/server";
import { runScheduledSync } from "@/lib/revenuecat/sync";

function unauthorized() {
  return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");

  if (!secret) {
    return Response.json(
      { ok: false, error: "CRON_SECRET is not configured on the server" },
      { status: 500 },
    );
  }

  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const provided = bearer ?? headerSecret;
  if (!provided || provided !== secret) {
    return unauthorized();
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
