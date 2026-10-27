"use client";

import {
  Clock,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  RefreshCw,
  Snowflake,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useLiveContext } from "@/lib/useLiveContext";
import { cn } from "@/lib/utils";

export function weatherIconFor(conditions: string): LucideIcon {
  const c = conditions.toLowerCase();
  if (c.includes("thunder")) return CloudLightning;
  if (c.includes("snow")) return Snowflake;
  if (c.includes("rain") || c.includes("drizzle")) return CloudRain;
  if (c.includes("fog")) return CloudFog;
  if (c.includes("clear")) return Sun;
  if (c.includes("partly") || c.includes("mostly")) return CloudSun;
  return Cloud;
}

interface LiveContextStripProps {
  slug: string;
  className?: string;
}

/** Compact local time + weather pill that sits above the chat input. Refreshes every 60 seconds. */
export function LiveContextStrip({ slug, className }: LiveContextStripProps) {
  const { context, status, retry } = useLiveContext(slug);

  if (status === "loading") {
    return (
      <div
        role="status"
        aria-label="Loading local time and weather"
        className={cn("flex items-center gap-3 px-1", className)}
      >
        <div className="skeleton h-5 w-24" aria-hidden="true" />
        <div className="skeleton h-5 w-32" aria-hidden="true" />
      </div>
    );
  }

  if (status === "error" || !context) {
    return (
      <div className={cn("flex items-center gap-2 px-1 text-xs text-muted-foreground", className)}>
        <span>Local conditions are unavailable right now.</span>
        <button
          type="button"
          onClick={retry}
          className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 font-medium text-primary hover:bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  const weatherKnown = context.conditions !== "Unknown";
  const WeatherIcon = weatherIconFor(context.conditions);

  return (
    <div
      aria-label="Live local conditions"
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-full border bg-card/70 px-4 py-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="presence-dot" aria-hidden="true" />
      <span className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">Local time:</span>
        <span className="font-medium text-foreground">{context.localTime}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <WeatherIcon className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">Weather:</span>
        <span className="font-medium text-foreground">
          {weatherKnown ? context.weather : "Weather unavailable"}
        </span>
      </span>
    </div>
  );
}
