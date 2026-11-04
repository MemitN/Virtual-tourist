import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { checkRateLimit, jsonError, readJson } from "@/lib/api-utils";
import { cacheGet, cacheSet } from "@/lib/ai-cache";
import { completeChat, isMetaConfigured, logAiError, MissingApiKeyError } from "@/lib/meta-client";
import { buildExplainMessages } from "@/lib/prompts";
import { explainBodySchema } from "@/lib/schemas";
import { resolveDestination } from "@/lib/world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const devDetails = (raw: string): string | undefined => (process.env.NODE_ENV === "production" ? undefined : raw);

/** Public (destination pages are public), so it is rate-limited per IP and cached. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await readJson(request);
  if (!body.ok) return jsonError(400, "Request body must be valid JSON.", "bad_json");
  const parsed = explainBodySchema.safeParse(body.data);
  if (!parsed.success) return jsonError(400, "Invalid request.", "bad_input", parsed.error.flatten());

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const limit = checkRateLimit(`explain:${ip}`, 12, 60_000);
  if (!limit.allowed) {
    return jsonError(429, "That's a lot of questions at once. Try again in a moment.", "rate_limited", undefined, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const { slug, poiId, language } = parsed.data;
  const destination = await resolveDestination(slug);
  if (!destination) return jsonError(400, "Unknown destination.", "bad_input");
  const poi = poiId ? (destination.pois.find((p) => p.id === poiId) ?? null) : null;
  if (poiId && !poi) return jsonError(400, "Unknown landmark.", "bad_input");

  // Without a working AI key the page still shows the curated description instead of an error.
  const offline = (): NextResponse =>
    NextResponse.json({ text: poi ? poi.description : destination.description, demo: true });
  if (!isMetaConfigured()) return offline();

  const cacheKey = `explain|${slug}|${poiId ?? "-"}|${language}`;
  const cached = cacheGet(cacheKey);
  if (cached) return NextResponse.json({ text: cached });

  try {
    const { system, user } = buildExplainMessages(destination, poi, language);
    const text = await completeChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.6,
      maxTokens: 1500,
      signal: request.signal,
    });
    cacheSet(cacheKey, text);
    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof MissingApiKeyError || request.signal.aborted) return offline();
    const info = logAiError("explain", error);
    if (info.status === 429) return jsonError(429, info.message, "upstream_error", devDetails(info.raw));
    return offline();
  }
}
