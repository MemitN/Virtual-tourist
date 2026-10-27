"use client";

import { Users } from "lucide-react";
import { useRoomOccupancy } from "@/lib/realtime/useRoom";

/** Small live count of travelers currently in a destination's shared room. */
export function RoomOnlineBadge({ slug }: { slug: string }) {
  const count = useRoomOccupancy([slug])[slug] ?? 0;

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md"
      role="status"
    >
      {count > 0 ? (
        <>
          <span className="presence-dot" aria-hidden="true" />
          {count} {count === 1 ? "traveler" : "travelers"} here now
        </>
      ) : (
        <>
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          Be the first in the room
        </>
      )}
    </span>
  );
}
