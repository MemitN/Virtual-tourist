"use client";

import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { UseRoomResult } from "@/lib/realtime/useRoom";
import type { PointOfInterest, PresenceUser } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RoomPresenceProps {
  /** Result of useRoom(slug), owned by the page so only one channel is joined. */
  room: UseRoomResult;
  /** Used to turn a viewed POI id into a readable name. Optional on pages without hotspots. */
  pois?: readonly PointOfInterest[];
  className?: string;
}

const MAX_VISIBLE = 4;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${second}`.toUpperCase();
}

/** Stable colour per user so the same person looks the same on every screen. */
function colorFor(userId: string): string {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 55% 38%)`;
}

export function RoomPresence({ room, pois = [], className }: RoomPresenceProps) {
  const { status, users, self, lastPoiEvent } = room;

  // RT-2: "X is looking at Y" toast whenever someone else clicks a hotspot.
  useEffect(() => {
    if (!lastPoiEvent) return;
    toast(`${lastPoiEvent.displayName} is looking at ${lastPoiEvent.poiLabel}`, {
      id: `poi-${lastPoiEvent.userId}`,
      duration: 4000,
    });
  }, [lastPoiEvent]);

  const poiLabels = useMemo(() => new Map(pois.map((poi) => [poi.id, poi.label])), [pois]);

  const describe = (user: PresenceUser): string => {
    const name = user.userId === self?.userId ? `${user.displayName} (you)` : user.displayName;
    const poi = user.viewingPoi ? poiLabels.get(user.viewingPoi) : undefined;
    return poi ? `${name} is looking at ${poi}` : name;
  };

  if (status === "connecting") {
    return (
      <div
        role="status"
        aria-label="Joining the room"
        className={cn("flex items-center gap-2", className)}
      >
        <div className="skeleton h-9 w-9 rounded-full" aria-hidden="true" />
        <div className="skeleton h-4 w-24" aria-hidden="true" />
      </div>
    );
  }

  const live = status === "connected";
  const visible = users.slice(0, MAX_VISIBLE);
  const extra = users.length - visible.length;
  const others = Math.max(0, users.length - 1);

  let summary: string;
  if (!live) {
    summary = status === "error" ? "Live room offline. Exploring solo" : "Exploring solo";
  } else if (others === 0) {
    summary = "You're the first one here";
  } else {
    summary = `You and ${others} ${others === 1 ? "other" : "others"} here now`;
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {users.length > 0 ? (
        <ul aria-label="Travelers in this room" className="flex -space-x-2">
          {visible.map((user) => (
            <li key={user.userId} title={describe(user)}>
              <Avatar
                className={cn(
                  "h-9 w-9 border-2 border-background",
                  user.viewingPoi && "ring-2 ring-primary",
                )}
              >
                <AvatarFallback
                  className="text-xs font-semibold text-white"
                  style={{ backgroundColor: colorFor(user.userId) }}
                >
                  {initials(user.displayName)}
                </AvatarFallback>
              </Avatar>
              <span className="sr-only">{describe(user)}</span>
            </li>
          ))}
          {extra > 0 && (
            <li
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-semibold"
              title={`${extra} more`}
            >
              +{extra}
              <span className="sr-only"> more travelers</span>
            </li>
          )}
        </ul>
      ) : (
        <Users className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      )}
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        {live && <span className="presence-dot" aria-hidden="true" />}
        {summary}
      </p>
    </div>
  );
}
