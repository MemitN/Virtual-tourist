import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuthedUser, jsonError, readJson } from "@/lib/api-utils";
import { favoriteCreateSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNIQUE_VIOLATION = "23505";

export async function GET(): Promise<NextResponse> {
  const auth = await getAuthedUser();
  if (!auth.ok) return auth.response;

  // RLS already limits rows to the owner; the filter keeps the query explicit.
  const { data, error } = await auth.supabase
    .from("favorites")
    .select("id, user_id, destination_slug, created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) return jsonError(500, "Couldn't load your favorites.", "db_error");
  return NextResponse.json({ favorites: data ?? [] });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await readJson(request);
  if (!body.ok) return jsonError(400, "Request body must be valid JSON.", "bad_json");

  const parsed = favoriteCreateSchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError(400, "Invalid request.", "bad_input", parsed.error.flatten());
  }

  const auth = await getAuthedUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("favorites")
    .insert({ user_id: auth.user.id, destination_slug: parsed.data.slug })
    .select("id, user_id, destination_slug, created_at")
    .single();

  if (error) {
    // Already favorited: make the call idempotent by returning the existing row.
    if (error.code === UNIQUE_VIOLATION) {
      const { data: existing } = await auth.supabase
        .from("favorites")
        .select("id, user_id, destination_slug, created_at")
        .eq("user_id", auth.user.id)
        .eq("destination_slug", parsed.data.slug)
        .maybeSingle();
      if (existing) return NextResponse.json({ favorite: existing }, { status: 200 });
    }
    return jsonError(500, "Couldn't save this favorite.", "db_error");
  }

  return NextResponse.json({ favorite: data }, { status: 201 });
}
