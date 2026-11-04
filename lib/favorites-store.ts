"use client";

import { create } from "zustand";
import { z } from "zod";

const favoriteSchema = z.object({ id: z.string(), destination_slug: z.string() });
const listResponseSchema = z.object({ favorites: z.array(favoriteSchema) });
const createResponseSchema = z.object({ favorite: favoriteSchema });

const PENDING_ID = "pending";
/** Pseudo user id used when nobody is signed in: favorites live in this browser's localStorage. */
export const GUEST_ID = "guest";
const LOCAL_KEY = "vt:favorites";

function readLocal(): string[] {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeLocal(slugs: string[]): void {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(slugs));
  } catch {
    /* storage blocked */
  }
}

export type FavoritesStatus = "idle" | "loading" | "ready" | "error";
export type ToggleResult = "added" | "removed" | "error" | "busy";

interface FavoritesState {
  userId: string | null;
  /** slug -> favorite row id (PENDING_ID while an optimistic add is in flight). */
  ids: Record<string, string>;
  pending: Record<string, boolean>;
  status: FavoritesStatus;
  load: (userId: string, force?: boolean) => Promise<void>;
  reset: () => void;
  toggle: (slug: string) => Promise<ToggleResult>;
}

export const useFavoritesStore = create<FavoritesState>()((set, get) => ({
  userId: null,
  ids: {},
  pending: {},
  status: "idle",

  load: async (userId, force = false) => {
    const current = get();
    if (!force && current.userId === userId && current.status !== "idle" && current.status !== "error") {
      return;
    }
    set({ userId, status: "loading", ...(current.userId !== userId ? { ids: {}, pending: {} } : {}) });

    if (userId === GUEST_ID) {
      const ids: Record<string, string> = {};
      for (const slug of readLocal()) ids[slug] = "local";
      set({ ids, status: "ready" });
      return;
    }

    try {
      const response = await fetch("/api/favorites", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const parsed = listResponseSchema.parse(await response.json());
      if (get().userId !== userId) return; // user changed while loading
      const ids: Record<string, string> = {};
      for (const row of parsed.favorites) ids[row.destination_slug] = row.id;
      set({ ids, status: "ready" });
    } catch {
      if (get().userId === userId) set({ status: "error" });
    }
  },

  reset: () => {
    if (get().userId === null && get().status === "idle") return;
    set({ userId: null, ids: {}, pending: {}, status: "idle" });
  },

  toggle: async (slug) => {
    const existing = get().ids[slug];
    if (get().pending[slug] || existing === PENDING_ID) return "busy";

    const setPending = (value: boolean): void =>
      set((s) => ({ pending: { ...s.pending, [slug]: value } }));
    const setId = (id: string | null): void =>
      set((s) => {
        const ids = { ...s.ids };
        if (id === null) delete ids[slug];
        else ids[slug] = id;
        return { ids };
      });

    if (get().userId === GUEST_ID) {
      const slugs = new Set(readLocal());
      const removing = Boolean(existing);
      if (removing) slugs.delete(slug);
      else slugs.add(slug);
      writeLocal([...slugs]);
      setId(removing ? null : "local");
      return removing ? "removed" : "added";
    }

    setPending(true);

    if (existing) {
      // Optimistic remove with rollback.
      setId(null);
      try {
        const response = await fetch(`/api/favorites/${existing}`, { method: "DELETE" });
        if (!response.ok && response.status !== 404) throw new Error(String(response.status));
        return "removed";
      } catch {
        setId(existing);
        return "error";
      } finally {
        setPending(false);
      }
    }

    // Optimistic add with rollback.
    setId(PENDING_ID);
    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const parsed = createResponseSchema.parse(await response.json());
      setId(parsed.favorite.id);
      return "added";
    } catch {
      setId(null);
      return "error";
    } finally {
      setPending(false);
    }
  },
}));
