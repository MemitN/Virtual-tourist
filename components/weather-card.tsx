"use client";

import { MapPin, RefreshCw } from "lucide-react";
import { weatherIconFor } from "@/components/live-context-strip";
import { useLiveContext } from "@/lib/useLiveContext";
import { cn } from "@/lib/utils";

interface WeatherCardProps {
  slug: string;
  place: string;
  className?: string;
}

/** Glanceable live weather + local time card (destination hero and guide sidebar). */
export function WeatherCard({ slug, place, className }: WeatherCardProps) {
  const { context, status, retry } = useLiveContext(slug);
  const Icon = weatherIconFor(context?.conditions ?? "");
  const known = context !== null && context.conditions !== "Unknown";

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-black/40 p-4 text-white backdrop-blur-xl", className)}>
      {status === "loading" && (
        <div role="status" aria-label="Loading live weather" className="space-y-2">
          <div className="skeleton h-8 w-24" />
          <div className="skeleton h-4 w-32" />
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-white/80">Live weather unavailable.</span>
          <button
            type="button"
            onClick={retry}
            aria-label="Retry loading weather"
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/15"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {status === "ready" && context && (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Icon className="h-8 w-8 text-amber-300" aria-hidden="true" />
              <div>
                <p className="text-3xl font-bold leading-none">
                  {known ? `${Math.round(context.temp)}°C` : "–"}
                </p>
                <p className="mt-1 text-xs text-white/75">{known ? context.conditions : "Weather unavailable"}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[0.65rem] uppercase tracking-wider text-white/60">Local time</p>
              <p className="text-sm font-semibold">{context.localTime}</p>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1.5 border-t border-white/10 pt-3 text-xs text-white/80">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {place}
          </p>
        </>
      )}
    </div>
  );
}
