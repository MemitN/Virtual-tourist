"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FEATURED_PLACES, type FeaturedPlace } from "@/lib/featured";
import { cn } from "@/lib/utils";

// three.js is heavy: load the globe only on the client and only when this section renders.
const WorldGlobe = dynamic(() => import("@/components/world-globe").then((m) => m.WorldGlobe), {
  ssr: false,
  loading: () => <div role="status" aria-label="Loading globe" className="skeleton h-full w-full rounded-full" />,
});

interface GlobeSectionProps {
  /** How many places to list beside the globe. */
  listCount?: number;
  className?: string;
}

export function GlobeSection({ listCount = 12, className }: GlobeSectionProps) {
  const router = useRouter();
  const listed = FEATURED_PLACES.slice(0, listCount);

  return (
    <div className={cn("grid items-center gap-6 lg:grid-cols-2", className)}>
      <div className="relative mx-auto aspect-square w-full max-w-[34rem]">
        <WorldGlobe
          places={FEATURED_PLACES}
          onSelect={(place: FeaturedPlace) => router.push(`/destination/${place.slug}`)}
          className="absolute inset-0"
        />
      </div>
      <div>
        <ul className="flex flex-wrap gap-2" aria-label="Featured places">
          {listed.map((place) => (
            <li key={place.slug}>
              <Link
                href={`/destination/${place.slug}`}
                className="inline-flex min-h-11 items-center rounded-full border bg-card/70 px-4 text-sm font-medium transition hover:border-primary hover:bg-primary/10"
              >
                {place.name}
                <span className="ml-1.5 text-xs text-muted-foreground">{place.country}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
