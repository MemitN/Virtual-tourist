import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { checkRateLimit, jsonError } from "@/lib/api-utils";
import { getDestination } from "@/lib/destinations";
import { parsePlaceSlug } from "@/lib/place-slug";
import { publishContext } from "@/lib/realtime/publishContext";
import { contextParamSchema } from "@/lib/schemas";
import { getLiveContext, getLiveContextForCoords } from "@/lib/weather";

export const runtime = "nodejs";

/** Fallback for the live-context strip when the Realtime broadcast isn't available. */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
): Promise<NextResponse> {
  const parsed = contextParamSchema.safeParse(params);
  if (!parsed.success) return jsonError(400, "Unknown destination.", "bad_input");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const limit = checkRateLimit(`context:${ip}`, 120, 60_000);
  if (!limit.allowed) {
    return jsonError(429, "Too many requests. Try again shortly.", "rate_limited", undefined, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const slug = parsed.data.slug;
  const known = getDestination(slug);
  const place = known ? null : parsePlaceSlug(slug);
  if (!known && !place) return jsonError(400, "Unknown destination.", "bad_input");

  // Only coordinates and a timezone are needed here, so skip the full place build.
  const context = known
    ? await getLiveContext(known)
    : await getLiveContextForCoords(place?.lat ?? 0, place?.lng ?? 0);
  void publishContext(slug, context);

  return NextResponse.json(context, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
