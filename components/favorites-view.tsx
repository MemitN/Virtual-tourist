"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Heart, LogIn } from "lucide-react";
import { DestinationCard } from "@/components/destination-card";
import { FavoriteButton } from "@/components/favorite-button";
import { Button } from "@/components/ui/button";
import { summaryFromSlug } from "@/lib/place-slug";
import type { DestinationCardData } from "@/lib/types";
import { useFavoritesStore } from "@/lib/favorites-store";
import { useUiStore } from "@/lib/store";
import { useUser } from "@/lib/useUser";

function SkeletonGrid() {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <li key={i} className="skeleton aspect-[3/4] rounded-2xl" />
      ))}
    </ul>
  );
}

export function FavoritesView() {
  const { user, loading: userLoading } = useUser();
  const userId = user?.id ?? null;
  const openAuthDialog = useUiStore((s) => s.openAuthDialog);

  const ids = useFavoritesStore((s) => s.ids);
  const status = useFavoritesStore((s) => s.status);
  const load = useFavoritesStore((s) => s.load);

  useEffect(() => {
    if (userId) void load(userId);
  }, [userId, load]);

  // Any place on Earth can be a favorite: rebuild each card from its slug.
  const favorites = Object.keys(ids)
    .map((slug) => summaryFromSlug(slug))
    .filter((d): d is DestinationCardData => d !== null);

  if (userLoading || (userId && (status === "idle" || status === "loading"))) {
    return (
      <div role="status" aria-label="Loading your favorites">
        <SkeletonGrid />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center">
        <LogIn className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="font-display text-xl font-semibold">Sign in to see your favorites</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Save the places you love and they&apos;ll follow you across devices.
        </p>
        <Button className="mt-4" onClick={() => openAuthDialog("/favorites")}>
          Sign in
        </Button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-8 text-center" role="alert">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-destructive" aria-hidden="true" />
        <p className="font-display text-xl font-semibold">We couldn&apos;t load your favorites</p>
        <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
        <Button className="mt-4" variant="outline" onClick={() => void load(userId, true)}>
          Try again
        </Button>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center">
        <Heart className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="font-display text-xl font-semibold">No favorites yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap the heart on any destination to save it here.
        </p>
        <Button asChild className="mt-4">
          <Link href="/explore">Explore the world</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        {favorites.length} saved {favorites.length === 1 ? "destination" : "destinations"}
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        {favorites.map((destination) => (
          <li key={destination.slug}>
            <DestinationCard
              destination={destination}
              action={
                <FavoriteButton slug={destination.slug} name={destination.name} tone="glass" />
              }
            />
          </li>
        ))}
      </ul>
    </>
  );
}
