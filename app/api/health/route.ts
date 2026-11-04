import { NextResponse } from "next/server";
import { candidates, isMetaConfigured, probeCandidates } from "@/lib/meta-client";
import { createClient } from "@/lib/supabase/server";

const TABLES: [table: string, migration: string][] = [
  ["profiles", "0001_init.sql"],
  ["favorites", "0001_init.sql"],
  ["chat_sessions", "0001_init.sql"],
  ["chat_messages", "0001_init.sql"],
  ["saved_trips", "0002_saved_trips.sql"],
];

/** Confirms each table exists (RLS hides rows from anonymous callers, which is fine: we only need "no error"). */
async function checkDatabase(): Promise<Record<string, string> | string> {
  const supabase = createClient();
  if (!supabase) return "not configured (fine: guest mode)";
  const out: Record<string, string> = {};
  for (const [table, migration] of TABLES) {
    // A real GET (not HEAD): HEAD responses carry no body, so a missing table would look like success.
    const { error } = await supabase.from(table).select("*").limit(1);
    out[table] = !error ? "ok" : error.code === "PGRST205" || error.code === "42P01" ? `MISSING: run supabase/migrations/${migration}` : `error: ${error.message.slice(0, 80)}`;
  }
  return out;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Open http://localhost:3000/api/health to see which AI provider/model works with your key.
 * Every fallback candidate is tried once so you can see exactly why others fail.
 * Disabled in production. Never prints secrets.
 */
export async function GET(): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not available" }, { status: 404 });

  const env = {
    MODEL_API_KEY: isMetaConfigured() ? "set" : "MISSING (the app runs in offline-guide mode)",
    MODEL_BASE_URL: process.env.MODEL_BASE_URL?.trim() || "(auto)",
    MODEL_CHAT_NAME: process.env.MODEL_CHAT_NAME?.trim() || "(auto)",
    MUSE_IMAGE_ENABLED: process.env.MUSE_IMAGE_ENABLED ?? "(unset, placeholders only)",
    SUPABASE: process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "not set (fine: guest mode, favorites kept in this browser)",
  };

  const database = await checkDatabase();

  if (!isMetaConfigured()) {
    return NextResponse.json({ ok: false, env, database, hint: "Add MODEL_API_KEY to .env.local and restart `npm run dev`." });
  }

  const { results, metaModels } = await probeCandidates();
  const working = results.find((r) => r.ok);
  return NextResponse.json({
    ok: Boolean(working),
    env,
    database,
    working: working?.label ?? null,
    hint: working
      ? `The app will use "${working.label}". Everything else falls back automatically.`
      : results.every((r) => r.status === 401 || r.status === 403)
        ? "Every provider rejected the key. Meta's Model API public preview is US-only; if you are elsewhere, create a Baseten key (hackathon credits) and put it in MODEL_API_KEY. Run `node scripts/test-key.mjs` for a second opinion."
        : "No provider answered. See the per-candidate details below.",
    candidates: candidates().map((c) => c.label),
    results,
    metaModelsAvailable: metaModels,
  });
}
