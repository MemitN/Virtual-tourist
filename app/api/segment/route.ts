import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, getAuthedUser, jsonError, readJson } from "@/lib/api-utils";
import { getApiKey, META_BASE_URL, MissingApiKeyError, MODELS } from "@/lib/meta-client";
import { segmentBodySchema } from "@/lib/schemas";
import type { SegmentResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// NOTE: UI integration for segmentation (tap a landmark in the panorama to outline it)
// is deferred. This API route is ready and can be called from the viewer later.

const segmentResponseSchema = z.object({
  boxes: z.array(z.array(z.number())).default([]),
  masks: z.array(z.string()).default([]),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await readJson(request);
  if (!body.ok) return jsonError(400, "Request body must be valid JSON.", "bad_json");

  const parsed = segmentBodySchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError(400, "Invalid request.", "bad_input", parsed.error.flatten());
  }

  const auth = await getAuthedUser();
  if (!auth.ok) return auth.response;

  const limit = checkRateLimit(`segment:${auth.user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return jsonError(429, "Too many requests. Please slow down.", "rate_limited");
  }

  try {
    const response = await fetch(`${META_BASE_URL}/segment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({
        model: MODELS.segment,
        image_url: parsed.data.imageUrl,
        text_prompt: parsed.data.textPrompt,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Segmentation responded ${response.status}`);

    const result = segmentResponseSchema.safeParse(await response.json());
    const payload: SegmentResult = result.success
      ? result.data
      : { boxes: [], masks: [] };
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return jsonError(500, "Segmentation isn't configured yet.", "missing_api_key");
    }
    return jsonError(500, "Segmentation failed. Please try again.", "upstream_error");
  }
}
