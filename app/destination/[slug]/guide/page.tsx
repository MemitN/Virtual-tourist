import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatPanel } from "@/components/chat-panel";
import { DESTINATIONS } from "@/lib/destinations";
import { resolveDestination } from "@/lib/world";

interface PageProps {
  params: { slug: string };
  searchParams: { q?: string | string[] };
}

export function generateStaticParams(): { slug: string }[] {
  return DESTINATIONS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const destination = await resolveDestination(params.slug);
  if (!destination) return { title: "Destination not found" };
  return {
    title: `Chat with ${destination.guide.name}, your ${destination.name} guide`,
    description: `Chat with an AI local guide for ${destination.name}, powered by Meta's Muse models.`,
  };
}

export default async function GuidePage({ params, searchParams }: PageProps) {
  const destination = await resolveDestination(params.slug);
  if (!destination) notFound();

  // ?q= comes from starter-question links. Length is capped here and validated again by /api/chat.
  const rawQuestion = Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q;
  const initialQuestion = rawQuestion?.trim().slice(0, 300) || null;

  return <ChatPanel destination={destination} initialQuestion={initialQuestion} />;
}
