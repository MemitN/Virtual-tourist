import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { cacheGet, cacheSet } from "@/lib/ai-cache";
import { checkRateLimit, jsonError, readJson } from "@/lib/api-utils";
import { AiHttpError, completeChat, isMetaConfigured, logAiError } from "@/lib/meta-client";
import { languageSchema, slugSchema } from "@/lib/schemas";
import { buildFallback, buildTripMessages, extractJson, SCHEMAS, TRIP_KINDS, tripOptionsSchema, type TripData, type TripKind } from "@/lib/trip";
import { getLiveContext } from "@/lib/weather";
import { resolveDestination } from "@/lib/world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  slug: slugSchema,
  kind: z.enum(TRIP_KINDS),
  language: languageSchema.default("en"),
  options: tripOptionsSchema.default({}),
});

const MAX_TOKENS: Record<TripKind, number> = { itinerary: 4500, phrasebook: 2500, essentials: 1800, packing: 1500 };

/** Generates a trip itinerary, phrasebook, essentials sheet or packing list as validated JSON. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await readJson(request);
  if (!body.ok) return jsonError(400, "Request body must be valid JSON.", "bad_json");
  const parsed = bodySchema.safeParse(body.data);
  if (!parsed.success) return jsonError(400, "Invalid request.", "bad_input", parsed.error.flatten());

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limit = checkRateLimit(`trip:${ip}`, 12, 60_000);
  if (!limit.allowed) {
    return jsonError(429, "That's a lot of trip planning at once. Try again in a moment.", "rate_limited", undefined, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const { slug, kind, language, options } = parsed.data;
  const destination = await resolveDestination(slug);
  if (!destination) return jsonError(400, "Unknown destination.", "bad_input");
  const live = await getLiveContext(destination);

  const offline = (reason?: string): NextResponse => {
    const data = buildFallback(kind, destination, live, options);
    if (!data) {
      return jsonError(503, reason ?? "This needs the AI model. Add MODEL_API_KEY to .env.local to turn it on.", "ai_unavailable");
    }
    return NextResponse.json({ data, source: "offline", ...(reason ? { note: reason } : {}) });
  };

  if (!isMetaConfigured()) return offline();

  // Weather changes the packing list, so it is part of that cache key; the others are stable for an hour.
  const keyParts = [slug, kind, language, JSON.stringify(options), kind === "packing" ? live.weather : ""];
  const cacheKey = `trip|${createHash("sha1").update(keyParts.join("|")).digest("hex")}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    try {
      return NextResponse.json({ data: JSON.parse(cached) as TripData, source: "ai" });
    } catch {
      /* ignore a corrupt entry */
    }
  }

  const { system, user } = buildTripMessages(kind, destination, live, language, options);
  const schema = SCHEMAS[kind];
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const reply = await completeChat({
        messages: [
          { role: "system", content: system },
          { role: "user", content: attempt === 0 ? user : `${user}\n\nIMPORTANT: your previous reply was not valid JSON for this shape. Return ONLY the JSON object.` },
        ],
        temperature: attempt === 0 ? 0.6 : 0.2,
        maxTokens: MAX_TOKENS[kind],
        signal: request.signal,
      });
      const data = schema.parse(extractJson(reply)) as TripData;
      cacheSet(cacheKey, JSON.stringify(data), 60 * 60 * 1000);
      return NextResponse.json({ data, source: "ai" });
    } catch (error) {
      lastError = error;
      if (request.signal.aborted) return new NextResponse(null, { status: 499 });
      // Provider-level failures (bad key, rate limit, unreachable) won't improve on a retry; bad JSON might.
      if (error instanceof AiHttpError && [401, 403, 429, undefined].includes(error.status)) break;
    }
  }

  const info = logAiError(`trip:${kind}`, lastError);
  return offline(`AI unavailable, showing a built-in version. ${info.message}`);
}
