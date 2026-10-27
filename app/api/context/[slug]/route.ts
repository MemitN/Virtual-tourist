import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { publishContext } from "@/lib/realtime/publishContext";
import { contextParamSchema } from "@/lib/schemas";
import { getLiveContext } from "@/lib/weather";
import { resolveDestination } from "@/lib/world";

export const runtime = "nodejs";

/** Fallback for the live-context strip when the Realtime broadcast isn't available. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
): Promise<NextResponse> {
  const parsed = contextParamSchema.safeParse(params);
  if (!parsed.success) return jsonError(400, "Unknown destination.", "bad_input");

  const destination = await resolveDestination(parsed.data.slug);
  if (!destination) return jsonError(400, "Unknown destination.", "bad_input");

  const context = await getLiveContext(destination);
  await publishContext(destination.slug, context);

  return NextResponse.json(context, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
