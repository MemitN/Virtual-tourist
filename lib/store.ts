"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface UiState {
  authDialogOpen: boolean;
  /** Path to return to after the magic link is clicked. */
  authNext: string | null;
  openAuthDialog: (next?: string) => void;
  closeAuthDialog: () => void;
  /** Ambient audio is muted by default and the choice is persisted. */
  ambientMuted: boolean;
  setAmbientMuted: (muted: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      authDialogOpen: false,
      authNext: null,
      openAuthDialog: (next) => set({ authDialogOpen: true, authNext: next ?? null }),
      closeAuthDialog: () => set({ authDialogOpen: false }),
      ambientMuted: true,
      setAmbientMuted: (ambientMuted) => set({ ambientMuted }),
    }),
    {
      name: "avt:ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ ambientMuted: state.ambientMuted }),
    },
  ),
);
