import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DestinationGrid } from "@/components/destination-grid";
import { HomeHero } from "@/components/home-hero";
import { DESTINATIONS } from "@/lib/destinations";
import { FEATURED_PLACES } from "@/lib/featured";

export default function HomePage() {
  const zanzibar = FEATURED_PLACES.find((p) => p.name === "Zanzibar");

  return (
    <>
      <HomeHero
        suggestion={zanzibar ? { slug: zanzibar.slug, name: zanzibar.name } : null}
      />

      <section id="destinations" className="mx-auto max-w-[1600px] scroll-mt-20 px-4 py-8 sm:px-6" aria-labelledby="destinations-heading">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 id="destinations-heading" className="text-2xl font-bold sm:text-3xl">
            Popular right now
          </h2>
          <Link href="/explore" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline">
            View all <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <DestinationGrid destinations={DESTINATIONS} />
      </section>
    </>
  );
}
