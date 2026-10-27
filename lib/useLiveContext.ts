"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { LiveContext } from "@/lib/types";

const REFRESH_MS = 60_000;

const contextSchema = z.object({
  localTime: z.string().min(1).max(60),
  weather: z.string().max(120),
  temp: z.number(),
  conditions: z.string().max(60),
});

type Listener = (context: unknown) => void;
interface SharedChannel {
  listeners: Set<Listener>;
  release: () => void;
}
const sharedChannels = new Map<string, SharedChannel>();

/**
 * Several components on one page (weather card + chat strip) can watch the same slug.
 * Supabase returns the same channel object per topic, so share one subscription and count users.
 */
function subscribeShared(slug: string, listener: Listener): () => void {
  let shared = sharedChannels.get(slug);
  if (!shared) {
    const supabase = createClient();
    const listeners = new Set<Listener>();
    const channel = supabase
      ?.channel(`context:${slug}`)
      .on("broadcast", { event: "context" }, ({ payload }) => {
        for (const l of listeners) l(payload);
      })
      .subscribe();
    shared = {
      listeners,
      release: () => {
        if (supabase && channel) void supabase.removeChannel(channel);
        sharedChannels.delete(slug);
      },
    };
    sharedChannels.set(slug, shared);
  }
  shared.listeners.add(listener);
  const current = shared;
  return () => {
    current.listeners.delete(listener);
    if (current.listeners.size === 0) current.release();
  };
}

export type LiveContextStatus = "loading" | "ready" | "error";

/**
 * RT-4 client half: listens on context:${slug} for broadcasts and polls
 * GET /api/context/${slug} every 60 seconds as a fallback (and to refresh the clock).
 */
export function useLiveContext(slug: string): {
  context: LiveContext | null;
  status: LiveContextStatus;
  retry: () => void;
} {
  const [context, setContext] = useState<LiveContext | null>(null);
  const [status, setStatus] = useState<LiveContextStatus>("loading");
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch(`/api/context/${slug}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Context responded ${response.status}`);
      setContext(contextSchema.parse(await response.json()));
      setStatus("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      // Keep the last good reading if we have one.
      setStatus((previous) => (previous === "ready" ? previous : "error"));
    }
  }, [slug]);

  useEffect(() => {
    setContext(null);
    setStatus("loading");
    void refresh();

    const interval = setInterval(() => {
      if (!document.hidden) void refresh();
    }, REFRESH_MS);

    const unsubscribe = subscribeShared(slug, (payload) => {
      const parsed = contextSchema.safeParse(payload);
      if (parsed.success) {
        setContext(parsed.data);
        setStatus("ready");
      }
    });

    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
      unsubscribe();
    };
  }, [slug, refresh]);

  const retry = useCallback((): void => {
    setStatus("loading");
    void refresh();
  }, [refresh]);

  return { context, status, retry };
}
