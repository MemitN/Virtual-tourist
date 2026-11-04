import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuthedUser, isMissingTable, jsonError, MIGRATION_HINT, readJson } from "@/lib/api-utils";
import { tripCreateSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TRIPS_PER_USER = 50;
const COLUMNS = "id, destination_slug, kind, title, language, data, options, created_at";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await getAuthedUser();
  if (!auth.ok) return auth.response;

  const slug = request.nextUrl.searchParams.get("slug");
  let query = auth.supabase
    .from("saved_trips")
    .select(COLUMNS)
    .eq("user_id", auth.user.id)
    .eq("kind", "itinerary")
    .order("created_at", { ascending: false })
    .limit(MAX_TRIPS_PER_USER);
  if (slug) query = query.eq("destination_slug", slug);

  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error)) return jsonError(503, MIGRATION_HINT, "db_migration_missing");
    return jsonError(500, "Couldn't load your trips.", "db_error");
  }
  return NextResponse.json({ trips: data ?? [] });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await readJson(request);
  if (!body.ok) return jsonError(400, "Request body must be valid JSON.", "bad_json");
  const parsed = tripCreateSchema.safeParse(body.data);
  if (!parsed.success) return jsonError(400, "Invalid trip.", "bad_input", parsed.error.flatten());

  const auth = await getAuthedUser();
  if (!auth.ok) return auth.response;

  const { count, error: countError } = await auth.supabase
    .from("saved_trips")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id);
  if (countError) {
    if (isMissingTable(countError)) return jsonError(503, MIGRATION_HINT, "db_migration_missing");
    return jsonError(500, "Couldn't save this trip.", "db_error");
  }
  if ((count ?? 0) >= MAX_TRIPS_PER_USER) {
    return jsonError(409, `You can keep up to ${MAX_TRIPS_PER_USER} saved trips. Delete one to save another.`, "limit_reached");
  }

  const { slug, title, language, options, data } = parsed.data;
  const { data: row, error } = await auth.supabase
    .from("saved_trips")
    .insert({ user_id: auth.user.id, destination_slug: slug, kind: "itinerary", title, language, data, options: options ?? null })
    .select(COLUMNS)
    .single();
  if (error) {
    if (isMissingTable(error)) return jsonError(503, MIGRATION_HINT, "db_migration_missing");
    return jsonError(500, "Couldn't save this trip.", "db_error");
  }
  return NextResponse.json({ trip: row }, { status: 201 });
}
