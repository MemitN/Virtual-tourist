import { z } from "zod";
import type { LanguageCode } from "@/lib/languages";

const okSchema = z.object({ text: z.string().min(1), demo: z.boolean().optional() });
const errorSchema = z.object({ error: z.string() });

export interface AiText {
  text: string;
  /** True when the server is in demo mode and returned the original text untouched. */
  demo: boolean;
}

const cache = new Map<string, AiText>();

async function post(url: string, payload: unknown, signal?: AbortSignal): Promise<AiText> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) {
    const body = errorSchema.safeParse(await response.json().catch(() => null));
    throw new Error(body.success ? body.data.error : "Something went wrong. Please try again.");
  }
  const parsed = okSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("The server sent back something unexpected.");
  return { text: parsed.data.text, demo: parsed.data.demo ?? false };
}

export async function fetchTranslation(
  text: string,
  language: LanguageCode,
  signal?: AbortSignal,
): Promise<AiText> {
  const key = `tr|${language}|${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const result = await post("/api/translate", { text, language }, signal);
  cache.set(key, result);
  return result;
}

export async function fetchExplanation(
  slug: string,
  poiId: string | null,
  language: LanguageCode,
  signal?: AbortSignal,
): Promise<AiText> {
  const key = `ex|${slug}|${poiId ?? "-"}|${language}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const result = await post("/api/explain", { slug, language, ...(poiId ? { poiId } : {}) }, signal);
  cache.set(key, result);
  return result;
}
