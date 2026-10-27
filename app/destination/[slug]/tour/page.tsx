import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TourExperience } from "@/components/tour-experience";
import { DESTINATIONS } from "@/lib/destinations";
import { resolveDestination } from "@/lib/world";

interface PageProps {
  params: { slug: string };
  searchParams: { poi?: string | string[] };
}

export function generateStaticParams(): { slug: string }[] {
  return DESTINATIONS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const destination = await resolveDestination(params.slug);
  if (!destination) return { title: "Destination not found" };
  return {
    title: `360° tour of ${destination.name}`,
    description: `Look around ${destination.name} in 360°, explore hotspots, and share the view with other travelers.`,
  };
}

// Server component: validates the slug, then hands plain data to the client-side tour.
export default async function TourPage({ params, searchParams }: PageProps) {
  const destination = await resolveDestination(params.slug);
  if (!destination) notFound();
  const rawPoi = Array.isArray(searchParams.poi) ? searchParams.poi[0] : searchParams.poi;
  // Only ids that exist for this destination are honoured.
  const initialPoiId = destination.pois.find((p) => p.id === rawPoi)?.id ?? null;
  return <TourExperience destination={destination} initialPoiId={initialPoiId} />;
}
