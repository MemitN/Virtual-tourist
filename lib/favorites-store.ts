"use client";

import { create } from "zustand";
import { z } from "zod";

const favoriteSchema = z.object({ id: z.string(), destination_slug: z.string() });
const listResponseSchema = z.object({ favorites: z.array(favoriteSchema) });
const createResponseSchema = z.object({ favorite: favoriteSchema });

const PENDING_ID = "pending";

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
