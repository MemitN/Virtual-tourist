"use client";

import { DestinationCard } from "@/components/destination-card";
import { FavoriteButton } from "@/components/favorite-button";
import { useRoomOccupancy } from "@/lib/realtime/useRoom";
import type { Destination } from "@/lib/types";

interface DestinationGridProps {
  destinations: readonly Destination[];
}

/** Popular destinations, each with a live count of travelers in its shared room. */
export function DestinationGrid({ destinations }: DestinationGridProps) {
  const occupancy = useRoomOccupancy(destinations.map((d) => d.slug));

  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
      {destinations.map((destination, index) => (
        <li key={destination.slug} className="animate-fade-up" style={{ animationDelay: `${index * 60}ms` }}>
          <DestinationCard
            destination={destination}
            onlineCount={occupancy[destination.slug] ?? 0}
            showRoom
            priority={index < 3}
            action={<FavoriteButton slug={destination.slug} name={destination.name} tone="glass" />}
          />
        </li>
      ))}
    </ul>
  );
}
