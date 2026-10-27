"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

interface UserState {
  user: User | null;
  loading: boolean;
}

const SERVER_SNAPSHOT: UserState = { user: null, loading: true };

let snapshot: UserState = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();
let stopAuthListener: (() => void) | null = null;

function emit(next: UserState): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

/** Starts one shared auth listener while at least one component is subscribed. */
function startAuth(): void {
  const supabase = createClient();
  if (!supabase) {
    emit({ user: null, loading: false });
    return;
  }

  let cancelled = false;
  supabase.auth
    .getUser()
    .then(({ data }) => {
      if (!cancelled) emit({ user: data.user, loading: false });
    })
    .catch(() => {
      if (!cancelled) emit({ user: null, loading: false });
    });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    emit({ user: session?.user ?? null, loading: false });
  });

  stopAuthListener = () => {
    cancelled = true;
    subscription.unsubscribe();
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) startAuth();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopAuthListener?.();
      stopAuthListener = null;
    }
  };
}

export function displayNameFor(user: User): string {
  const meta: unknown = user.user_metadata?.display_name;
  if (typeof meta === "string" && meta.trim()) return meta.trim();
  return user.email?.split("@")[0] ?? "Traveler";
}

/** Current Supabase user with live updates. Resolves to signed-out when Supabase isn't configured. */
export function useUser(): UserState & { configured: boolean; signOut: () => Promise<void> } {
  const state = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => SERVER_SNAPSHOT,
  );

  const signOut = useCallback(async () => {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
  }, []);

  return { ...state, configured: isSupabaseConfigured(), signOut };
}
