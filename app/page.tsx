import Link from "next/link";
import { ArrowRight, Globe2, MessageCircle, Sparkles, Users, View } from "lucide-react";
import { DestinationGrid } from "@/components/destination-grid";
import { GlobeSection } from "@/components/globe-section";
import { PlaceSearch } from "@/components/place-search";
import { SafeImage } from "@/components/safe-image";
import { Button } from "@/components/ui/button";
import { DESTINATIONS, getDestination } from "@/lib/destinations";
import { SITE_TAGLINE } from "@/lib/site";

const FEATURES = [
  { icon: MessageCircle, title: "AI Guides", text: "Local experts, 24/7" },
  { icon: View, title: "360° Tours", text: "Immersive exploration" },
  { icon: Users, title: "Live Together", text: "Real-time rooms" },
  { icon: Sparkles, title: "AI Generated", text: "Stunning visuals" },
] as const;

const STATS = [
  { value: "Any", label: "place on Earth" },
  { value: "360°", label: "immersive" },
  { value: "Live", label: "real-time rooms" },
  { value: "AI", label: "guided" },
] as const;

export default function HomePage() {
  const hero = getDestination("lisbon");
  const [line1, line2, line3] = SITE_TAGLINE.split(". ");

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div className="skeleton absolute inset-0 -z-10 rounded-none">
          {hero && (
            <SafeImage src={hero.heroImage} alt="" gradient={hero.gradient} sizes="100vw" priority />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#050816] via-[#050816]/70 to-[#050816]/10" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" aria-hidden="true" />
        </div>

        <div className="mx-auto flex min-h-[78dvh] max-w-[1600px] flex-col justify-center gap-6 px-4 py-14 text-white sm:px-6 lg:min-h-[72dvh]">
          <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.05] xs:text-5xl sm:text-6xl lg:text-7xl">
            <span className="block">{line1}.</span>
            <span className="text-gradient block">{line2}.</span>
            <span className="text-gradient block">{line3}</span>
          </h1>
          <p className="max-w-xl text-base text-white/85 sm:text-lg">
            Discover the world with AI-powered guides, stunning 360° views and real-time travel
            communities. Search any city, landmark or country on Earth, and a local meets you there.
          </p>
          <PlaceSearch variant="hero" className="w-full max-w-xl" />

          <ul className="mt-2 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-primary backdrop-blur-md">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="leading-tight">
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-xs text-white/70">{text}</span>
                </span>
              </li>
            ))}
          </ul>

          <p aria-hidden="true" className="absolute bottom-8 right-8 hidden -rotate-6 text-right font-script text-3xl text-white/90 lg:block">
            Same planet.
            <br />
            New perspective.
          </p>
        </div>
      </section>

      <section id="destinations" className="mx-auto max-w-[1600px] scroll-mt-20 px-4 py-8 sm:px-6" aria-labelledby="destinations-heading">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 id="destinations-heading" className="text-2xl font-bold sm:text-3xl">
              Popular Destinations
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">A green &ldquo;Live&rdquo; badge means travelers are exploring right now.</p>
          </div>
          <Link href="/explore" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline">
            View all <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <DestinationGrid destinations={DESTINATIONS} />
      </section>

      <section className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6" aria-labelledby="world-heading">
        <div className="panel overflow-hidden p-6 sm:p-10">
          <div className="mb-6 max-w-xl">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
              <Globe2 className="h-4 w-4" aria-hidden="true" /> The whole planet
            </p>
            <h2 id="world-heading" className="text-3xl font-bold sm:text-4xl">
              The world is closer than you think
            </h2>
            <p className="mt-2 text-muted-foreground">
              Spin the globe, tap a glowing point, or search for somewhere only you have heard of.
              Every place gets a live local guide, weather and a 360° view.
            </p>
            <Button asChild className="mt-4">
              <Link href="/explore">
                Explore the map <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <GlobeSection />
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-4 pb-12 sm:px-6" aria-label="At a glance">
        <ul className="panel grid grid-cols-2 gap-6 p-6 sm:grid-cols-4">
          {STATS.map((stat) => (
            <li key={stat.label} className="text-center">
              <p className="text-gradient text-3xl font-extrabold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
