import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { TripToolkit } from "@/components/trip-toolkit";
import { DESTINATIONS } from "@/lib/destinations";
import { resolveDestination } from "@/lib/world";

interface PageProps {
  params: { slug: string };
}

export function generateStaticParams(): { slug: string }[] {
  return DESTINATIONS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const destination = await resolveDestination(params.slug);
  if (!destination) return { title: "Place not found" };
  return {
    title: `Plan a trip to ${destination.name}`,
    description: `Itinerary, phrasebook, travel essentials and packing list for ${destination.name}, ${destination.country}.`,
  };
}

export default async function PlanPage({ params }: PageProps) {
  const destination = await resolveDestination(params.slug);
  if (!destination) notFound();
  const { slug, name, country, guide } = destination;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <Link
        href={`/destination/${slug}`}
        className="inline-flex min-h-11 w-fit items-center gap-1 rounded-full border bg-card/70 py-2 pl-2 pr-4 text-sm font-medium hover:bg-muted print:hidden"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {name}
      </Link>
      <header>
        <h1 className="text-3xl font-bold sm:text-4xl">Trip toolkit: {name}</h1>
        <p className="mt-1 text-muted-foreground">
          Itinerary, phrasebook, essentials and packing for {name}, {country}, in the language you picked. Made with {guide.name}, your AI guide.
        </p>
      </header>
      <TripToolkit slug={slug} name={name} guideName={guide.name} />
    </div>
  );
}
