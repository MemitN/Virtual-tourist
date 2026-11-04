"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, ChevronDown, Copy, Loader2, Printer, Trash2 } from "lucide-react";
import { ItineraryDays } from "@/components/itinerary-view";
import { Button } from "@/components/ui/button";
import { itineraryToText } from "@/lib/trip";
import { deleteTrip, listTrips, type SavedTrip } from "@/lib/trips-store";
import { useUser } from "@/lib/useUser";
import { cn } from "@/lib/utils";

export function TripsView() {
  const { user, loading: userLoading } = useUser();
  const [trips, setTrips] = useState<SavedTrip[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setError(false);
    try {
      const result = await listTrips(Boolean(user));
      setTrips(result.trips);
      setNote(result.note ?? null);
    } catch {
      setError(true);
    }
  }, [user]);

  useEffect(() => {
    if (!userLoading) void load();
  }, [userLoading, load]);

  const remove = async (trip: SavedTrip): Promise<void> => {
    if (!window.confirm(`Delete “${trip.title}”?`)) return;
    try {
      await deleteTrip(trip);
      setTrips((list) => (list ?? []).filter((t) => t.id !== trip.id));
    } catch {
      toast.error("Couldn't delete that trip. Please try again.");
    }
  };

  const copy = async (trip: SavedTrip): Promise<void> => {
    try {
      await navigator.clipboard.writeText(itineraryToText(trip.data));
      toast.success("Itinerary copied");
    } catch {
      toast.error("Couldn't copy. Use Print instead.");
    }
  };

  if (userLoading || (trips === null && !error)) {
    return (
      <p role="status" className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your trips…
      </p>
    );
  }
  if (error) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" /> Couldn&apos;t load your trips.
        </span>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }
  if (!trips || trips.length === 0) {
    return (
      <div className="panel flex flex-col items-center gap-3 p-10 text-center">
        <CalendarDays className="h-10 w-10 text-primary" aria-hidden="true" />
        <h2 className="text-xl font-bold">No saved trips yet</h2>
        <p className="max-w-md text-muted-foreground">Open any destination, tap Plan Trip, generate an itinerary and press Save trip.</p>
        <Button asChild>
          <Link href="/explore">Explore destinations</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {note && <p className="rounded-xl border bg-card/70 p-3 text-sm text-muted-foreground">{note}</p>}
      {!user && <p className="text-sm text-muted-foreground">Saved in this browser. Sign in and they will move to your account automatically.</p>}
      <ul className="space-y-3">
        {trips.map((trip) => {
          const expanded = open === trip.id;
          return (
            <li key={trip.id} className="panel p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : trip.id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
                  <ChevronDown className={cn("h-5 w-5 shrink-0 transition", expanded && "rotate-180")} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-lg font-semibold">{trip.title}</span>
                    <span className="block text-sm text-muted-foreground">
                      {new Date(trip.createdAt).toLocaleDateString()} · {trip.data.days.length} {trip.data.days.length === 1 ? "day" : "days"}
                      {trip.local ? " · this device" : ""}
                    </span>
                  </span>
                </button>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" aria-label="Copy itinerary" onClick={() => void copy(trip)}>
                    <Copy aria-hidden="true" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Delete trip" onClick={() => void remove(trip)}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
              {expanded && (
                <div className="mt-4 space-y-4">
                  <ItineraryDays itinerary={trip.data} />
                  <div className="flex flex-wrap gap-2 print:hidden">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/destination/${trip.slug}/plan`}>Plan again</Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.print()}>
                      <Printer aria-hidden="true" /> Print
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
