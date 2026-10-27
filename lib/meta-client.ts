import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const META_BASE_URL = "https://api.meta.ai/v1";

export const MODELS = {
  chat: "muse-spark-1.3",
  planner: "muse-wonder-1.0",
  image: "muse-image-1.0",
  segment: "sam-3.1",
} as const;

export class MissingApiKeyError extends Error {
  constructor() {
    super("MODEL_API_KEY is not configured");
    this.name = "MissingApiKeyError";
  }
}

export function isMetaConfigured(): boolean {
  return Boolean(process.env.MODEL_API_KEY);
}

export function getApiKey(): string {
  const key = process.env.MODEL_API_KEY;
  if (!key) throw new MissingApiKeyError();
  return key;
}

let cached: OpenAI | null = null;

/** Lazily built so a missing key fails per-request (friendly 500) instead of at import time. */
export function getMetaClient(): OpenAI {
  if (!cached) {
    cached = new OpenAI({
      apiKey: getApiKey(),
      baseURL: META_BASE_URL,
      maxRetries: 1,
      timeout: 60_000,
    });
  }
  return cached;
}

interface ChatStreamOptions {
  messages: ChatCompletionMessageParam[];
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Opens a streamed completion on muse-spark-1.3 and exposes it as a plain-text
 * byte stream. The upstream request is awaited first so HTTP-level failures
 * (bad key, rate limit) throw here and the route can return a proper 500
 * instead of a broken 200 stream.
 */
export async function createChatStream(
  options: ChatStreamOptions,
): Promise<ReadableStream<Uint8Array>> {
  const client = getMetaClient();
  const upstream = await client.chat.completions.create(
    {
      model: MODELS.chat,
      messages: options.messages,
      stream: true,
      temperature: options.temperature ?? 0.8,
      max_tokens: options.maxTokens ?? 700,
    },
    options.signal ? { signal: options.signal } : undefined,
  );

  const encoder = new TextEncoder();
  const iterator = upstream[Symbol.asyncIterator]();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        // Loop so empty deltas (role-only / keep-alive chunks) never stall the stream.
        for (;;) {
          const { value, done } = await iterator.next();
          if (done) {
            controller.close();
            return;
          }
          const delta = value.choices[0]?.delta?.content;
          if (delta) {
            controller.enqueue(encoder.encode(delta));
            return;
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      upstream.controller.abort();
    },
  });
}

export type GeneratedImage =
  | { kind: "b64"; data: string }
  | { kind: "url"; url: string };

/** Panorama generation via muse-image-1.0 (widest landscape size the SDK types allow). */
export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const client = getMetaClient();
  const response = await client.images.generate({
    model: MODELS.image,
    prompt,
    n: 1,
    size: "1792x1024",
    response_format: "b64_json",
  });
  const item = response.data?.[0];
  if (item?.b64_json) return { kind: "b64", data: item.b64_json };
  if (item?.url) return { kind: "url", url: item.url };
  throw new Error("Image model returned no image");
}

export interface ItineraryStub {
  status: "stub";
  model: typeof MODELS.planner;
  slug: string;
  days: number;
}

/** muse-wonder-1.0 itinerary planning is intentionally stubbed for this hackathon build. */
export async function planItinerary(slug: string, days: number): Promise<ItineraryStub> {
  return { status: "stub", model: MODELS.planner, slug, days };
}
