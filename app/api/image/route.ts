import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { checkRateLimit, getAuthedUser, jsonError, readJson } from "@/lib/api-utils";
import { generateImage, MissingApiKeyError } from "@/lib/meta-client";
import { buildPanoramaPrompt } from "@/lib/prompts";
import { imageBodySchema } from "@/lib/schemas";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveDestination } from "@/lib/world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "panoramas";

function extensionFor(contentType: string): string {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "png";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await readJson(request);
  if (!body.ok) return jsonError(400, "Request body must be valid JSON.", "bad_json");

  const parsed = imageBodySchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError(400, "Invalid request.", "bad_input", parsed.error.flatten());
  }

  const { slug, prompt } = parsed.data;
  const destination = await resolveDestination(slug);
  if (!destination) return jsonError(400, "Unknown destination.", "bad_input");

  // Dev-friendly default: skip the model (and its credits) and return a stand-in image.
  if (process.env.MUSE_IMAGE_ENABLED !== "true") {
    return NextResponse.json({ url: destination.heroImage, placeholder: true });
  }

  // Real generation costs credits, so it requires a signed-in user.
  const auth = await getAuthedUser();
  if (!auth.ok) return auth.response;

  const limit = checkRateLimit(`image:${auth.user.id}`, 5, 10 * 60_000);
  if (!limit.allowed) {
    return jsonError(
      429,
      "Panorama generation is limited. Please wait a few minutes.",
      "rate_limited",
      undefined,
      { "Retry-After": String(limit.retryAfterSeconds) },
    );
  }

  try {
    const generated = await generateImage(buildPanoramaPrompt(destination, prompt));

    let bytes: Buffer;
    let contentType = "image/png";
    if (generated.kind === "b64") {
      bytes = Buffer.from(generated.data, "base64");
    } else {
      const download = await fetch(generated.url, { signal: AbortSignal.timeout(20_000) });
      if (!download.ok) throw new Error(`Image download failed: ${download.status}`);
      contentType = download.headers.get("content-type") ?? contentType;
      bytes = Buffer.from(await download.arrayBuffer());
    }

    const storage = createServiceClient();
    if (!storage) {
      // Storage not configured: hand back the model's URL if we have one.
      if (generated.kind === "url") return NextResponse.json({ url: generated.url });
      return jsonError(500, "Image storage isn't configured.", "storage_not_configured");
    }

    const path = `${slug}/${crypto.randomUUID()}.${extensionFor(contentType)}`;
    const { error: uploadError } = await storage.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType, cacheControl: "31536000", upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { data } = storage.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return jsonError(500, "Image generation isn't configured yet.", "missing_api_key");
    }
    return jsonError(
      500,
      "Couldn't generate the panorama right now. Please try again.",
      "upstream_error",
    );
  }
}
