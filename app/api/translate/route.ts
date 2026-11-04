import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { checkRateLimit, jsonError, readJson } from "@/lib/api-utils";
import { cacheGet, cacheSet } from "@/lib/ai-cache";
import { completeChat, isMetaConfigured, logAiError, MissingApiKeyError } from "@/lib/meta-client";
import { buildTranslateSystemPrompt } from "@/lib/prompts";
import { translateBodySchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await readJson(request);
  if (!body.ok) return jsonError(400, "Request body must be valid JSON.", "bad_json");
  const parsed = translateBodySchema.safeParse(body.data);
  if (!parsed.success) return jsonError(400, "Invalid request.", "bad_input", parsed.error.flatten());

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const limit = checkRateLimit(`translate:${ip}`, 25, 60_000);
  if (!limit.allowed) {
    return jsonError(429, "Translating too fast. Try again in a moment.", "rate_limited", undefined, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const { text, language } = parsed.data;

  if (!isMetaConfigured()) return NextResponse.json({ text, demo: true });

  const cacheKey = `tr|${language}|${createHash("sha1").update(text).digest("hex")}`;
  const cached = cacheGet(cacheKey);
  if (cached) return NextResponse.json({ text: cached });

  try {
    const translated = await completeChat({
      messages: [
        { role: "system", content: buildTranslateSystemPrompt(language) },
        { role: "user", content: text },
      ],
      temperature: 0.2,
      maxTokens: 2000,
      signal: request.signal,
    });
    cacheSet(cacheKey, translated, 6 * 60 * 60 * 1000);
    return NextResponse.json({ text: translated });
  } catch (error) {
    if (error instanceof MissingApiKeyError) return NextResponse.json({ text, demo: true });
    const info = logAiError("translate", error);
    return jsonError(info.status === 429 ? 429 : 502, info.message, "upstream_error");
  }
}
