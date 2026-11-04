import { createServiceClient } from "@/lib/supabase/server";
import type { LiveContext } from "@/lib/types";

const THROTTLE_MS = 30_000;
const MAX_TRACKED = 500;
const lastSent = new Map<string, number>();

interface HttpSendChannel {
  httpSend?: (event: string, payload: unknown) => Promise<unknown>;
}

/**
 * Server-side broadcast of fresh weather/time to every client subscribed to
 * context:${slug} (RT-4). Best-effort, throttled and time-boxed; failures are ignored
 * because clients also poll GET /api/context/[slug] as a fallback.
 */
export async function publishContext(slug: string, context: LiveContext): Promise<void> {
  const now = Date.now();
  if (now - (lastSent.get(slug) ?? 0) < THROTTLE_MS) return;
  if (lastSent.size >= MAX_TRACKED) {
    for (const [key, at] of lastSent) if (now - at >= THROTTLE_MS) lastSent.delete(key);
  }
  lastSent.set(slug, now);

  const client = createServiceClient();
  if (!client) return;

  const channel = client.channel(`context:${slug}`);
  try {
    const send = (channel as unknown as HttpSendChannel).httpSend;
    // Newer supabase-js has an explicit REST send; older versions fall back automatically.
    const task =
      typeof send === "function"
        ? send.call(channel, "context", context)
        : channel.send({ type: "broadcast", event: "context", payload: context });
    await Promise.race([task, new Promise((resolve) => setTimeout(resolve, 3000))]);
  } catch {
    // Non-critical.
  } finally {
    void client.removeChannel(channel).catch(() => undefined);
  }
}
