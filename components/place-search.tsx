"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Globe2, Loader2, MapPin, Search, Shuffle, Star } from "lucide-react";
import { z } from "zod";
import { DESTINATIONS } from "@/lib/destinations";
import { randomFeatured } from "@/lib/featured";
import type { PlaceSearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const responseSchema = z.object({
  places: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      country: z.string(),
      countryCode: z.string(),
      region: z.string().nullable(),
      lat: z.number(),
      lng: z.number(),
    }),
  ),
});

interface Option {
  slug: string;
  title: string;
  subtitle: string;
  curated: boolean;
}

interface PlaceSearchProps {
  variant?: "hero" | "compact";
  autoFocus?: boolean;
  /** Called after navigating (e.g. to close a dialog). */
  onNavigate?: () => void;
  className?: string;
}

type RemoteStatus = "idle" | "loading" | "ready" | "error";

/** Search any city, landmark or region on Earth. Curated cities answer instantly; the rest come from the world map. */
export function PlaceSearch({ variant = "compact", autoFocus, onNavigate, className }: PlaceSearchProps) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [remote, setRemote] = useState<PlaceSearchResult[]>([]);
  const [status, setStatus] = useState<RemoteStatus>("idle");
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const searching = trimmed.length >= 2;

  // Debounced world search with cancellation of stale requests.
  useEffect(() => {
    if (!searching) {
      setRemote([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/places?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Places responded ${response.status}`);
        setRemote(responseSchema.parse(await response.json()).places);
        setStatus("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, searching]);

  const options = useMemo<Option[]>(() => {
    const q = trimmed.toLowerCase();
    const curated = DESTINATIONS.filter(
      (d) => !q || [d.name, d.country].some((f) => f.toLowerCase().includes(q)),
    ).map<Option>((d) => ({
      slug: d.slug,
      title: d.name,
      subtitle: `${d.country} · Featured`,
      curated: true,
    }));
    if (!searching) return curated;

    const curatedNames = new Set(curated.map((o) => o.title.toLowerCase()));
    const world = remote
      .filter((r) => !curatedNames.has(r.name.toLowerCase()))
      .map<Option>((r) => ({
        slug: r.slug,
        title: r.name,
        subtitle: [r.region, r.country].filter(Boolean).join(", "),
        curated: false,
      }));
    return [...curated, ...world];
  }, [trimmed, searching, remote]);

  useEffect(() => setActive(0), [options.length, trimmed]);

  // Close the list when focus or a click lands elsewhere.
  useEffect(() => {
    const onPointer = (event: PointerEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  const go = (slug: string): void => {
    setOpen(false);
    setQuery("");
    router.push(`/destination/${slug}`);
    onNavigate?.();
  };

  const surprise = (): void => go(randomFeatured().slug);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(options.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      const option = options[active];
      if (option) {
        event.preventDefault();
        go(option.slug);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const hero = variant === "hero";
  const showList = open && (options.length > 0 || searching);
  const noResults = searching && status === "ready" && options.length === 0;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex items-center gap-2 border bg-card/90 backdrop-blur-xl transition focus-within:border-primary focus-within:shadow-glow",
          hero ? "rounded-full p-1.5 pl-5" : "rounded-2xl px-3",
        )}
      >
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <label htmlFor={`${listId}-input`} className="sr-only">
          Search any place in the world
        </label>
        <input
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && options[active] ? `${listId}-opt-${active}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search any city, landmark or country on Earth…"
          className={cn(
            "min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm",
            hero ? "h-12" : "h-12",
          )}
        />
        {status === "loading" && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-label="Searching" />
        )}
        <button
          type="button"
          onClick={surprise}
          aria-label="Surprise me with a random place"
          title="Surprise me"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Shuffle className="h-4 w-4" aria-hidden="true" />
        </button>
        {hero && (
          <button
            type="button"
            onClick={() => {
              const first = options[active];
              if (first) go(first.slug);
            }}
            aria-label="Go to the selected place"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:brightness-110 active:scale-95"
          >
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {showList && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-[22rem] overflow-y-auto rounded-2xl border bg-popover/95 p-2 shadow-2xl backdrop-blur-xl">
          {!searching && (
            <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Featured · or type any place on Earth
            </p>
          )}
          <ul id={listId} role="listbox" aria-label="Places">
            {options.map((option, index) => (
              <li
                key={option.slug}
                id={`${listId}-opt-${index}`}
                role="option"
                aria-selected={index === active}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => go(option.slug)}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-2",
                  index === active && "bg-primary/15",
                )}
              >
                {option.curated ? (
                  <Star className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{option.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{option.subtitle}</span>
                </span>
              </li>
            ))}
          </ul>

          {searching && status === "loading" && options.length === 0 && (
            <p role="status" className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Globe2 className="h-4 w-4 animate-pulse" aria-hidden="true" />
              Searching the world…
            </p>
          )}
          {noResults && (
            <p role="status" className="px-3 py-4 text-sm text-muted-foreground">
              No places found for “{trimmed}”. Check the spelling or try a nearby city.
            </p>
          )}
          {status === "error" && (
            <p role="alert" className="px-3 py-3 text-xs text-muted-foreground">
              The world map is unreachable right now. Featured cities still work.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
