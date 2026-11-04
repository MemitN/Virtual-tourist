"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { GUEST_ID, useFavoritesStore } from "@/lib/favorites-store";
import { syncGuestDataToAccount } from "@/lib/trips-store";
import { useUser } from "@/lib/useUser";

/** Invisible. When someone signs in, moves what they saved as a guest into their account (once per session). */
export function GuestSync() {
  const { user } = useUser();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    const flag = `vt:synced:${userId}`;
    try {
      if (window.sessionStorage.getItem(flag)) return;
      window.sessionStorage.setItem(flag, "1");
    } catch {
      /* sessionStorage blocked: run anyway */
    }
    let hasLocal = false;
    try {
      hasLocal = Boolean(window.localStorage.getItem("vt:favorites") || window.localStorage.getItem("vt:trips"));
    } catch {
      /* localStorage blocked: nothing to move */
    }
    if (!hasLocal) return;

    void syncGuestDataToAccount().then((report) => {
      const parts = [
        report.favorites ? `${report.favorites} favorite${report.favorites === 1 ? "" : "s"}` : "",
        report.trips ? `${report.trips} trip${report.trips === 1 ? "" : "s"}` : "",
      ].filter(Boolean);
      if (parts.length) toast.success(`Moved ${parts.join(" and ")} to your account`);
      const store = useFavoritesStore.getState();
      if (store.userId && store.userId !== GUEST_ID) void store.load(userId, true);
    });
  }, [userId]);

  return null;
}
