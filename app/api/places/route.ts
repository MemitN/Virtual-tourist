import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { checkRateLimit, jsonError } from "@/lib/api-utils";
import { placeSearchSchema } from "@/lib/schemas";
import { searchPlaces } from "@/lib/world";

export const runtime = "nodejs";

/** Public world-wide place search (Open-Meteo geocoding). Powers the "any place on Earth" search box. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const parsed = placeSearchSchema.safeParse({ q: request.nextUrl.searchParams.get("q") ?? "" });
  if (!parsed.success) return jsonError(400, "Type at least 2 characters.", "bad_input");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const limit = checkRateLimit(`places:${ip}`, 40, 60_000);
  if (!limit.allowed) {
    return jsonError(429, "Searching too fast. Try again in a moment.", "rate_limited", undefined, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const places = await searchPlaces(parsed.data.q);
  return NextResponse.json(
    { places },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
