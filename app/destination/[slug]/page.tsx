import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  Coins,
  Landmark,
  Languages,
  MapPin,
  MessageCircle,
  Play,
  Clock,
} from "lucide-react";
import { DestinationCard } from "@/components/destination-card";
import { FavoriteButton } from "@/components/favorite-button";
import { GuideAvatar } from "@/components/guide-avatar";
import { RoomOnlineBadge } from "@/components/room-online-badge";
import { SafeImage } from "@/components/safe-image";
import { ShareButton } from "@/components/share-button";
import { Button } from "@/components/ui/button";
import { WeatherCard } from "@/components/weather-card";
import { DESTINATIONS } from "@/lib/destinations";
import { resolveDestination } from "@/lib/world";

interface PageProps {
  params: { slug: string };
}

// Curated cities are pre-rendered; every other place on Earth is rendered on first visit.
export function generateStaticParams(): { slug: string }[] {
  return DESTINATIONS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const destination = await resolveDestination(params.slug);
  if (!destination) return { title: "Place not found" };
  return {
    title: `${destination.name}, ${destination.country}`,
    description: destination.tagline,
    openGraph: destination.heroImage.startsWith("data:") ? {} : { images: [destination.heroImage] },
  };
}

export default async function DestinationPage({ params }: PageProps) {
  const destination = await resolveDestination(params.slug);
  if (!destination) notFound();

  const { slug, name, country, tagline, description, heroImage, gradient, guide, pois, custom } = destination;
  const stats = [
    { icon: Landmark, label: "Landmarks", value: pois.length > 0 ? `${pois.length} to explore` : "Ask your guide" },
    { icon: Languages, label: "Language", value: destination.language },
    { icon: Coins, label: "Currency", value: destination.currency },
    { icon: Clock, label: "Time zone", value: destination.timezone.replace(/_/g, " ") },
    { icon: CalendarDays, label: "Best time", value: destination.bestTime },
  ];
  const others = DESTINATIONS.filter((d) => d.slug !== slug).slice(0, 4);

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div className="skeleton absolute inset-0 -z-10 rounded-none">
          <SafeImage
            src={heroImage}
            alt={`View of ${name}, ${country}`}
            gradient={gradient}
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050816]/90 via-[#050816]/40 to-transparent" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-[#050816]/40" aria-hidden="true" />
        </div>

        <div className="relative mx-auto flex min-h-[64dvh] max-w-[1600px] flex-col justify-between gap-8 px-4 py-6 text-white sm:px-6">
          <Link
            href="/explore"
            className="inline-flex min-h-11 w-fit items-center gap-1 rounded-full border border-white/25 bg-black/40 py-2 pl-2 pr-4 text-sm font-medium backdrop-blur-md hover:bg-black/60"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Explore
          </Link>

          <WeatherCard
            slug={slug}
            place={`${name}, ${country}`}
            className="w-full max-w-xs md:absolute md:right-6 md:top-6 md:w-72"
          />

          <div className="flex max-w-2xl flex-col items-start gap-4 pb-2">
            <RoomOnlineBadge slug={slug} />
            <p className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wider text-white/85">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {country}
            </p>
            <h1 className="text-5xl font-extrabold leading-none sm:text-7xl">{name}</h1>
            <p className="text-lg font-medium text-white/90">{tagline}</p>
            <p className="line-clamp-4 text-sm text-white/75 sm:text-base">{description}</p>

            <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href={`/destination/${slug}/tour`}>
                  <Play aria-hidden="true" />
                  Start Tour
                </Link>
              </Button>
              <Button asChild size="lg" variant="glass" className="w-full sm:w-auto">
                <Link href={`/destination/${slug}/guide`}>
                  <MessageCircle aria-hidden="true" />
                  Ask the Guide
                </Link>
              </Button>
              <FavoriteButton slug={slug} name={name} variant="full" tone="glass" className="w-full sm:w-auto" />
              <ShareButton
                title={`${name}, ${country}`}
                text={`${name}: ${tagline}`}
                path={`/destination/${slug}`}
                tone="glass"
                className="w-full sm:w-auto"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] space-y-10 px-4 py-8 sm:px-6">
        <dl className="panel grid grid-cols-2 gap-5 p-5 md:grid-cols-5">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-sm font-semibold">{value}</dd>
              </div>
            </div>
          ))}
        </dl>

        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-10">
            {pois.length > 0 && (
              <section aria-labelledby="poi-heading">
                <h2 id="poi-heading" className="mb-3 text-2xl font-bold">
                  {custom ? "Nearby landmarks" : "Don't miss"}
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {pois.map((poi) => (
                    <li key={poi.id}>
                      <Link
                        href={`/destination/${slug}/tour?poi=${poi.id}`}
                        className="panel block p-4 transition hover:border-primary"
                      >
                        <h3 className="font-sans text-base font-semibold">{poi.label}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{poi.description}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="ask-heading">
              <h2 id="ask-heading" className="mb-3 text-2xl font-bold">
                Ask {guide.name}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {destination.starterQuestions.map((question) => (
                  <li key={question}>
                    <Link
                      href={`/destination/${slug}/guide?q=${encodeURIComponent(question)}`}
                      className="inline-flex min-h-11 items-center rounded-2xl border bg-card/70 px-4 py-2 text-left text-sm transition hover:border-primary hover:bg-primary/10"
                    >
                      {question}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside aria-labelledby="guide-heading" className="panel h-fit p-5">
            <h2 id="guide-heading" className="sr-only">
              Your guide
            </h2>
            <div className="flex items-center gap-4">
              <GuideAvatar guide={guide} size="lg" online />
              <div>
                <p className="text-xl font-bold">{guide.name}</p>
                <p className="text-sm text-muted-foreground">{guide.role} · {name}</p>
              </div>
            </div>
            <p className="mt-4 rounded-2xl bg-muted/60 p-4 text-sm">
              {guide.greeting} I&apos;m {guide.name}. Ask me where to eat, what to see, or how the
              day looks outside right now.
            </p>
            <Button asChild className="mt-4 w-full">
              <Link href={`/destination/${slug}/guide`}>
                <MessageCircle aria-hidden="true" />
                Chat with {guide.name}
              </Link>
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              {guide.name} is an AI guide powered by Meta&apos;s Muse models.
            </p>
          </aside>
        </div>

        {destination.source && (
          <p className="text-xs text-muted-foreground">
            Summary and photo from{" "}
            <a href={destination.source.url} target="_blank" rel="noreferrer noopener" className="underline">
              {destination.source.label}
            </a>{" "}
            (CC BY-SA).
          </p>
        )}

        <section aria-labelledby="more-heading">
          <h2 id="more-heading" className="mb-4 text-2xl font-bold">
            Explore more
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {others.map((other) => (
              <li key={other.slug}>
                <DestinationCard destination={other} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
