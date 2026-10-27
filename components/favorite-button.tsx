"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFavoritesStore } from "@/lib/favorites-store";
import { useUiStore } from "@/lib/store";
import { useUser } from "@/lib/useUser";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  slug: string;
  /** Destination name, used for the accessible label and toasts. */
  name: string;
  variant?: "icon" | "full";
  /** "glass" is for use on top of photos. */
  tone?: "default" | "glass";
  className?: string;
}

export function FavoriteButton({
  slug,
  name,
  variant = "icon",
  tone = "default",
  className,
}: FavoriteButtonProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const { user, loading: userLoading } = useUser();
  const userId = user?.id ?? null;
  const openAuthDialog = useUiStore((s) => s.openAuthDialog);

  const isFavorite = useFavoritesStore((s) => Boolean(s.ids[slug]));
  const busy = useFavoritesStore((s) => Boolean(s.pending[slug]));
  const status = useFavoritesStore((s) => s.status);
  const load = useFavoritesStore((s) => s.load);
  const reset = useFavoritesStore((s) => s.reset);
  const toggle = useFavoritesStore((s) => s.toggle);

  // Many buttons can be mounted at once; the store de-duplicates the fetch.
  useEffect(() => {
    if (userLoading) return;
    if (userId) void load(userId);
    else reset();
  }, [userId, userLoading, load, reset]);

  const handleClick = async (): Promise<void> => {
    if (!userId) {
      openAuthDialog(pathname);
      return;
    }
    const wasFavorite = isFavorite;
    const result = await toggle(slug);

    if (result === "added") {
      toast.success(`Saved ${name} to your favorites`);
    } else if (result === "removed") {
      toast(`Removed ${name} from favorites`, {
        action: { label: "Undo", onClick: () => void toggle(slug) },
      });
    } else if (result === "error") {
      toast.error(
        wasFavorite
          ? `Couldn't remove ${name}. Please try again.`
          : `Couldn't save ${name}. Please try again.`,
      );
    }
  };

  const disabled = busy || userLoading || (userId !== null && status === "loading");
  const label = isFavorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`;

  const heart = (
    <motion.span
      key={String(isFavorite)}
      initial={reduceMotion ? false : { scale: 0.6 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 18 }}
      className="inline-flex"
    >
      <Heart
        className={cn("h-5 w-5 transition-colors", isFavorite && "fill-primary text-primary")}
        aria-hidden="true"
      />
    </motion.span>
  );

  if (variant === "full") {
    return (
      <Button
        size="lg"
        variant={tone === "glass" ? "glass" : "outline"}
        onClick={() => void handleClick()}
        disabled={disabled}
        aria-pressed={isFavorite}
        aria-busy={busy}
        aria-label={label}
        className={className}
      >
        {heart}
        {isFavorite ? "Saved" : "Save"}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={disabled}
      aria-pressed={isFavorite}
      aria-busy={busy}
      aria-label={label}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-60",
        tone === "glass"
          ? "border border-white/20 bg-black/45 text-white backdrop-blur-md hover:bg-black/65"
          : "border bg-card hover:bg-muted",
        className,
      )}
    >
      {heart}
    </button>
  );
}
