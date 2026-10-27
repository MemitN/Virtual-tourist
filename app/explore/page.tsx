import type { Metadata } from "next";
import Link from "next/link";
import { GlobeSection } from "@/components/globe-section";
import { PlaceSearch } from "@/components/place-search";
import { FEATURED_PLACES, REGIONS } from "@/lib/featured";

export const metadata: Metadata = {
  title: "Explore the world",
  description: "Search any city, landmark or country on Earth and meet a local AI guide there.",
};

export default function ExplorePage() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-10 px-4 py-8 sm:px-6">
      <header className="max-w-3xl space-y-4">
        <h1 className="text-4xl font-extrabold sm:text-5xl">
          Where in the <span className="text-gradient">world</span> to?
        </h1>
        <p className="text-muted-foreground">
          Type any place on Earth: a megacity, a mountain village, an island. We&apos;ll pull up its
          photo, nearby landmarks, live weather and a local guide to talk to.
        </p>
        <PlaceSearch variant="hero" className="max-w-xl" />
      </header>

      <section aria-labelledby="globe-heading" className="panel p-6 sm:p-8">
        <h2 id="globe-heading" className="mb-4 text-2xl font-bold">
          Spin the globe
        </h2>
        <GlobeSection listCount={0} />
      </section>

      {REGIONS.map((region) => {
        const places = FEATURED_PLACES.filter((p) => p.region === region);
        if (places.length === 0) return null;
        const headingId = `region-${region.replace(/\s/g, "-").toLowerCase()}`;
        return (
          <section key={region} aria-labelledby={headingId}>
            <h2 id={headingId} className="mb-3 text-xl font-bold">
              {region}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {places.map((place) => (
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
          </section>
        );
      })}
    </div>
  );
}
