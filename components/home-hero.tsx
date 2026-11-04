"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MapPin, MessageCircle, Play } from "lucide-react";
import { z } from "zod";
import { HeroGreeting } from "@/components/hero-greeting";
import type { GlobeFocus } from "@/components/earth-globe";
import { PlaceSearch } from "@/components/place-search";
import { SafeImage } from "@/components/safe-image";
import { Button } from "@/components/ui/button";
import { FEATURED_PLACES } from "@/lib/featured";
import { parsePlaceSlug } from "@/lib/place-slug";
import { cn } from "@/lib/utils";

// three.js is heavy: the globe loads on the client only, so the headline and search paint first.
const EarthGlobe = dynamic(() => import("@/components/earth-globe").then((m) => m.EarthGlobe), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-label="Loading globe"
      className="mx-auto aspect-square w-[78%] animate-pulse rounded-full shadow-[0_0_80px_-10px_rgba(56,189,248,0.55)]"
      style={{ background: "radial-gradient(circle at 32% 28%, #5cc8ff 0%, #1d6fb8 38%, #0b2f5c 70%, #04122b 100%)" }}
    />
  ),
});

const previewSchema = z.object({
  slug: z.string(),
  name: z.string(),
  country: z.string(),
  countryCode: z.string().nullable(),
  tagline: z.string(),
  heroImage: z.string(),
  cardImage: z.string(),
  gradient: z.string(),
});
type Preview = z.infer<typeof previewSchema>;

const previewCache = new Map<string, Preview>();

interface HomeHeroProps {
  suggestion: { slug: string; name: string } | null;
}

/**
 * The landing hero. It reacts to the search box: as soon as a place is highlighted, the hero's
 * backdrop, headline and postcard switch to that place, so the page already feels like "there".
 */
export function HomeHero({ suggestion }: HomeHeroProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [focus, setFocus] = useState<GlobeFocus | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const onPreview = useCallback((slug: string | null): void => {
    abortRef.current?.abort();
    if (!slug) {
      setPreview(null);
      return;
    }
    // Spin the globe to whatever is highlighted in the search box.
    const parsed = parsePlaceSlug(slug);
    const featured = FEATURED_PLACES.find((p) => p.slug === slug);
    const where = parsed ?? featured;
    if (where) setFocus({ lat: where.lat, lng: where.lng, key: slug });
    const cached = previewCache.get(slug);
    if (cached) {
      setPreview(cached);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    fetch(`/api/place-preview?slug=${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((json: unknown) => {
        const parsed = previewSchema.safeParse(json);
        if (!parsed.success) return;
        previewCache.set(slug, parsed.data);
        setPreview(parsed.data);
      })
      .catch(() => {
        /* aborted or offline: the hero simply stays as it was */
      });
  }, []);

  const onPhoto = preview !== null;

  return (
    <section className="relative isolate overflow-hidden">
      {/* Backdrop: slow aurora, or the searched place's photo */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute -left-24 top-0 h-[28rem] w-[28rem] animate-drift rounded-full bg-primary/25 blur-[110px]" />
        <div
          className="absolute -right-24 top-24 h-[30rem] w-[30rem] animate-drift rounded-full bg-accent/20 blur-[120px]"
          style={{ animationDelay: "-6s" }}
        />
        <div
          className="absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
          style={{ backgroundImage: "radial-gradient(hsl(var(--foreground) / 0.16) 1px, transparent 1px)", backgroundSize: "26px 26px" }}
        />
        <AnimatePresence>
          {preview && (
            <motion.div
              key={preview.slug}
              className="absolute inset-0"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <SafeImage src={preview.heroImage} alt="" gradient={preview.gradient} sizes="100vw" />
              <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/60 to-ink/25" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-ink/30" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mx-auto grid min-h-[88dvh] max-w-[1600px] items-center gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-4 lg:py-10">
        <div className={cn("relative z-10 order-2 transition-colors lg:order-1", onPhoto ? "text-white" : "text-foreground")}>
          <div className="relative min-h-[8.5rem] sm:min-h-[11rem]">
            <AnimatePresence mode="wait" initial={false}>
              {preview ? (
                <motion.div
                  key={preview.slug}
                  initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35 }}
                >
                  <h1 className="sr-only">Where to? {preview.name}</h1>
                  <p aria-hidden="true" className="font-script text-2xl text-white/80 sm:text-3xl">let&apos;s go to…</p>
                  <p className="mt-1 break-words font-script text-6xl leading-[0.95] text-gradient sm:text-8xl">
                    {preview.name}
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-white/85">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    {preview.country}
                  </p>
                </motion.div>
              ) : (
                <motion.div key="greeting" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <HeroGreeting />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {preview ? (
            <p className="mt-3 max-w-xl text-base text-white/85 sm:text-lg">{preview.tagline}</p>
          ) : (
            <h1 className="relative mt-2 inline-block font-script text-5xl leading-tight sm:text-7xl">
              Where to?
              <svg
                viewBox="0 0 220 14"
                aria-hidden="true"
                className="absolute -bottom-1 left-0 h-3 w-full text-accent"
                preserveAspectRatio="none"
              >
                <path d="M2 9c30-8 55 6 85-2s58-6 86 1 32 2 45-2" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </h1>
          )}

          <PlaceSearch variant="hero" className="mt-8 w-full max-w-xl" onPreview={onPreview} />

          {preview ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href={`/destination/${preview.slug}/tour`}>
                  <Play aria-hidden="true" />
                  Start the tour
                </Link>
              </Button>
              <Button asChild size="lg" variant="glass">
                <Link href={`/destination/${preview.slug}/guide`}>
                  <MessageCircle aria-hidden="true" />
                  Ask the guide
                </Link>
              </Button>
            </div>
          ) : (
            suggestion && (
              <Link
                href={`/destination/${suggestion.slug}`}
                className="mt-5 inline-flex min-h-11 -rotate-2 items-center gap-2 font-script text-3xl text-muted-foreground transition hover:text-foreground"
              >
                not sure? try {suggestion.name}
                <svg viewBox="0 0 40 24" aria-hidden="true" className="h-5 w-8">
                  <path d="M2 18c10-14 22-14 32-6m0 0-8-1m8 1-2 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            )
          )}
        </div>

        {/* The globe is the centerpiece: big, first on small screens, and bleeding past the column on wide ones */}
        <div className="relative order-1 mx-auto w-full max-w-[34rem] sm:max-w-[40rem] lg:order-2 lg:max-w-none lg:-mr-8 xl:-mr-16">
          <div className="mx-auto w-full lg:max-w-[min(100%,calc(100dvh-7rem))]">
            <EarthGlobe focus={focus} className="w-full" />
          </div>
          {preview && (
            <motion.div
              key={preview.slug}
              initial={reduceMotion ? false : { opacity: 0, y: 14, rotate: -9 }}
              animate={{ opacity: 1, y: 0, rotate: -4 }}
              className="pointer-events-none absolute bottom-16 left-2 hidden w-40 overflow-hidden rounded-xl border-4 border-white bg-white shadow-2xl sm:block lg:left-6 lg:w-48"
            >
              <div className="relative aspect-[4/3]">
                <SafeImage src={preview.cardImage} alt="" gradient={preview.gradient} sizes="200px" />
              </div>
              <p className="truncate px-2 py-1.5 text-center font-script text-xl text-ink">{preview.name}</p>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
