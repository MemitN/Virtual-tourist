"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import type { PoiClickEvent, PresenceUser } from "@/lib/types";

export type RoomStatus = "connecting" | "connected" | "solo" | "error";

export interface PoiRef {
  id: string;
  label: string;
}

export type TimedPoiEvent = PoiClickEvent & { at: number };

export interface UseRoomResult {
  status: RoomStatus;
  /** Everyone in the room including you (you first). Just you in solo mode. */
  users: PresenceUser[];
  self: PresenceUser | null;
  /** Call when the local user clicks a hotspot; pass null to clear. */
  announcePoi: (poi: PoiRef | null) => void;
  /** Latest POI click from another user, for "X is looking at Y" toasts. */
  lastPoiEvent: TimedPoiEvent | null;
}

// Presence and broadcast payloads come from other browsers, so validate them.
const presenceUserSchema = z.object({
  userId: z.string().min(1).max(64),
  displayName: z.string().min(1).max(40),
  viewingPoi: z.string().max(64).nullable(),
});

const poiClickSchema = z.object({
  userId: z.string().min(1).max(64),
  displayName: z.string().min(1).max(40),
  poiId: z.string().min(1).max(64),
  poiLabel: z.string().min(1).max(80),
});

const identitySchema = z.object({
  userId: z.string().min(1).max(64),
  displayName: z.string().min(1).max(40),
});

type Identity = z.infer<typeof identitySchema>;

const GUEST_KEY = "avt:guest";
const MAX_REMOTE_USERS = 50;

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function getGuestIdentity(): Identity {
  try {
    const raw = sessionStorage.getItem(GUEST_KEY);
    if (raw) {
      const parsed = identitySchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    }
  } catch {
    // Storage blocked or corrupted: fall through and create a new guest.
  }
  const identity: Identity = {
    userId: `guest-${randomId().slice(0, 8)}`,
    displayName: `Guest ${Math.floor(1000 + Math.random() * 9000)}`,
  };
  try {
    sessionStorage.setItem(GUEST_KEY, JSON.stringify(identity));
  } catch {
    // Non-fatal: identity just won't persist across reloads.
  }
  return identity;
}

const profileSchema = z.object({ display_name: z.string().nullable() });

async function resolveIdentity(supabase: SupabaseClient | null): Promise<Identity> {
  if (supabase) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle();
        const profile = profileSchema.safeParse(data);
        const name =
          (profile.success ? profile.data.display_name : null) ??
          user.email?.split("@")[0] ??
          "Traveler";
        return { userId: user.id, displayName: name.slice(0, 40) };
      }
    } catch {
      // Fall back to a guest identity if auth lookup fails.
    }
  }
  return getGuestIdentity();
}

/**
 * Joins room:${slug}, tracks presence and shares POI clicks via Supabase Realtime.
 * Presence is broadcast-only (never written to the database).
 * Without Supabase config or on channel errors it degrades to solo mode.
 */
export function useRoom(slug: string): UseRoomResult {
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [self, setSelf] = useState<PresenceUser | null>(null);
  const [remote, setRemote] = useState<PresenceUser[]>([]);
  const [lastPoiEvent, setLastPoiEvent] = useState<TimedPoiEvent | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const selfRef = useRef<PresenceUser | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let activeChannel: RealtimeChannel | null = null;
    const supabase = createClient();

    setStatus("connecting");
    setRemote([]);
    setLastPoiEvent(null);
    joinedRef.current = false;

    void (async () => {
      const identity = await resolveIdentity(supabase);
      if (cancelled) return;

      const me: PresenceUser = { ...identity, viewingPoi: null };
      selfRef.current = me;
      setSelf(me);

      if (!supabase) {
        setStatus("solo");
        return;
      }

      // Unique key per tab so the same account in two tabs doesn't overwrite itself.
      const channel = supabase.channel(`room:${slug}`, {
        config: {
          presence: { key: `${identity.userId}:${randomId().slice(0, 8)}` },
          broadcast: { self: false },
        },
      });
      activeChannel = channel;
      channelRef.current = channel;

      channel.on("presence", { event: "sync" }, () => {
        if (cancelled) return;
        const byUser = new Map<string, PresenceUser>();
        for (const entries of Object.values(channel.presenceState())) {
          for (const entry of entries) {
            const parsed = presenceUserSchema.safeParse(entry);
            if (parsed.success && parsed.data.userId !== identity.userId) {
              byUser.set(parsed.data.userId, parsed.data);
            }
          }
        }
        setRemote([...byUser.values()].slice(0, MAX_REMOTE_USERS));
      });

      channel.on("broadcast", { event: "poi-click" }, ({ payload }) => {
        if (cancelled) return;
        const parsed = poiClickSchema.safeParse(payload);
        if (parsed.success && parsed.data.userId !== identity.userId) {
          setLastPoiEvent({ ...parsed.data, at: Date.now() });
        }
      });

      channel.subscribe((subscribeStatus) => {
        if (cancelled) return;
        if (subscribeStatus === "SUBSCRIBED") {
          channel
            .track(selfRef.current ?? me)
            .then((result) => {
              if (cancelled) return;
              joinedRef.current = result === "ok";
              setStatus(result === "ok" ? "connected" : "error");
            })
            .catch(() => {
              if (!cancelled) setStatus("error");
            });
        } else if (
          subscribeStatus === "CHANNEL_ERROR" ||
          subscribeStatus === "TIMED_OUT"
        ) {
          joinedRef.current = false;
          setStatus("error");
        }
      });
    })();

    return () => {
      cancelled = true;
      joinedRef.current = false;
      channelRef.current = null;
      if (supabase && activeChannel) {
        void supabase.removeChannel(activeChannel);
      }
    };
  }, [slug]);

  const announcePoi = useCallback((poi: PoiRef | null) => {
    const current = selfRef.current;
    if (!current) return;

    const next: PresenceUser = { ...current, viewingPoi: poi?.id ?? null };
    selfRef.current = next;
    setSelf(next);

    const channel = channelRef.current;
    if (!channel || !joinedRef.current) return;

    void channel.track(next);
    if (poi) {
      const payload: PoiClickEvent = {
        userId: next.userId,
        displayName: next.displayName,
        poiId: poi.id,
        poiLabel: poi.label,
      };
      void channel.send({ type: "broadcast", event: "poi-click", payload });
    }
  }, []);

  const users = useMemo<PresenceUser[]>(
    () => (self ? [self, ...remote] : remote),
    [self, remote],
  );

  return { status, users, self, announcePoi, lastPoiEvent };
}

/**
 * Read-only occupancy for the home page: observes each room's presence without
 * joining it, so the green dot reflects real travelers only.
 */
export function useRoomOccupancy(slugs: readonly string[]): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const slugKey = slugs.join(",");

  useEffect(() => {
    const supabase = createClient();
    if (!supabase || !slugKey) return;

    const channels = slugKey.split(",").map((slug) => {
      const channel = supabase.channel(`room:${slug}`, {
        config: { presence: { key: `observer-${randomId()}` } },
      });
      channel.on("presence", { event: "sync" }, () => {
        const count = Object.keys(channel.presenceState()).length;
        setCounts((prev) => (prev[slug] === count ? prev : { ...prev, [slug]: count }));
      });
      channel.subscribe();
      return channel;
    });

    return () => {
      for (const channel of channels) {
        void supabase.removeChannel(channel);
      }
    };
  }, [slugKey]);

  return counts;
}
