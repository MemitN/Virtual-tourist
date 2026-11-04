import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { checkRateLimit, jsonError } from "@/lib/api-utils";
import { parsePlaceSlug } from "@/lib/place-slug";
import { slugSchema } from "@/lib/schemas";
import { resolveDestination } from "@/lib/world";

export const runtime = "nodejs";

/** Lightweight preview of any place (name, photo, tagline). Lets the home hero follow what you search. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const parsed = slugSchema.safeParse(request.nextUrl.searchParams.get("slug") ?? "");
  if (!parsed.success) return jsonError(400, "Unknown place.", "bad_input");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const limit = checkRateLimit(`preview:${ip}`, 60, 60_000);
  if (!limit.allowed) return jsonError(429, "Previewing too fast.", "rate_limited");

  const destination = await resolveDestination(parsed.data);
  if (!destination) return jsonError(404, "Unknown place.", "not_found");

  return NextResponse.json(
    {
      slug: destination.slug,
      name: destination.name,
      country: destination.country,
      countryCode: parsePlaceSlug(destination.slug)?.countryCode.toUpperCase() ?? null,
      tagline: destination.tagline,
      heroImage: destination.heroImage,
      cardImage: destination.cardImage,
      gradient: destination.gradient,
    },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
