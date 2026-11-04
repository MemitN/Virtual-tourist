"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

// three.js is heavy: load the globe only on the client and only when this section renders.
const EarthGlobe = dynamic(() => import("@/components/earth-globe").then((m) => m.EarthGlobe), {
  ssr: false,
  loading: () => <div role="status" aria-label="Loading globe" className="skeleton aspect-square w-full rounded-full" />,
});

/** The interactive Earth with its landmark list, for pages other than the hero (e.g. Explore). */
export function GlobeSection({ className }: { className?: string }) {
  return <EarthGlobe zoom rail className={cn("mx-auto w-full max-w-[44rem]", className)} />;
}
