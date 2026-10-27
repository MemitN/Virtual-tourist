import { createServiceClient } from "@/lib/supabase/server";
import type { LiveContext } from "@/lib/types";

const THROTTLE_MS = 30_000;
const lastSent = new Map<string, number>();

/**
 * Server-side broadcast of fresh weather/time to every client subscribed to
 * context:${slug} (RT-4). Best-effort and throttled; failures are ignored
 * because clients also poll GET /api/context/[slug] as a fallback.
 */
export async function publishContext(slug: string, context: LiveContext): Promise<void> {
  const now = Date.now();
  if (now - (lastSent.get(slug) ?? 0) < THROTTLE_MS) return;
  lastSent.set(slug, now);

  const client = createServiceClient();
  if (!client) return;

  const channel = client.channel(`context:${slug}`);
  try {
    // Not subscribed, so supabase-js sends this through the Realtime REST endpoint.
    await channel.send({ type: "broadcast", event: "context", payload: context });
  } catch {
    // Non-critical.
  } finally {
    await client.removeChannel(channel);
  }
}
