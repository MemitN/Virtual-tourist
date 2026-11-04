"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { SafeImage } from "@/components/safe-image";
import type { Destination } from "@/lib/types";

/** What a postcard needs; both curated destinations and live search previews satisfy it. */
export type PostcardPlace = Pick<Destination, "slug" | "name" | "country" | "cardImage" | "gradient"> & {
  countryCode?: string | null;
};
import { cn } from "@/lib/utils";

const CARDS = [
  { rotate: -7, className: "left-0 top-6 w-40 sm:w-56", delay: 0 },
  { rotate: 5, className: "right-0 top-0 w-44 sm:w-60", delay: 0.8 },
  { rotate: -2, className: "bottom-0 left-[18%] w-44 sm:w-60", delay: 1.6 },
] as const;

const COUNTRY_CODES: Readonly<Record<string, string>> = {
  France: "FR",
  Japan: "JP",
  Morocco: "MA",
  Portugal: "PT",
  "South Africa": "ZA",
};

/** A scatter of handwritten postcards from the curated destinations. */
export function HeroPostcards({ destinations }: { destinations: readonly PostcardPlace[] }) {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <div className="relative mx-auto h-[22rem] w-full max-w-md sm:h-[30rem]">
      {/* Slowly turning globe outline behind the cards */}
      <svg
        viewBox="0 0 200 200"
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 animate-spin-slow text-primary/30"
      >
        <g fill="none" stroke="currentColor" strokeWidth="0.6">
          <circle cx="100" cy="100" r="96" />
          <ellipse cx="100" cy="100" rx="36" ry="96" />
          <ellipse cx="100" cy="100" rx="68" ry="96" />
          <path d="M4 100h192M16 62h168M16 138h168M40 28h120M40 172h120" />
        </g>
      </svg>

      {destinations.slice(0, 3).map((destination, index) => {
        const card = CARDS[index] ?? CARDS[0];
        return (
          <motion.div
            key={destination.slug}
            className={cn("absolute", card.className)}
            initial={{ opacity: 0, y: 30, rotate: card.rotate * 2 }}
            animate={
              reduceMotion
                ? { opacity: 1, y: 0, rotate: card.rotate }
                : { opacity: 1, y: [0, -8, 0], rotate: card.rotate }
            }
            transition={{
              opacity: { duration: 0.6, delay: 0.2 + index * 0.15 },
              rotate: { duration: 0.6, delay: 0.2 + index * 0.15 },
              y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: card.delay },
            }}
            whileHover={reduceMotion ? undefined : { rotate: 0, scale: 1.06, zIndex: 20 }}
          >
            <Link
              href={`/destination/${destination.slug}`}
              className="group block rounded-md bg-[#fbf7ee] p-2 pb-3 shadow-2xl shadow-black/50 focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Visit ${destination.name}, ${destination.country}`}
            >
              <span className="skeleton relative block aspect-[4/3] overflow-hidden rounded-sm">
                <SafeImage
                  src={destination.cardImage}
                  alt=""
                  gradient={destination.gradient}
                  sizes="240px"
                  priority={index === 0}
                />
                {/* Postage stamp */}
                <span
                  aria-hidden="true"
                  className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-sm border-2 border-dashed border-white/80 bg-black/30 text-[0.6rem] font-bold text-white backdrop-blur-sm"
                >
                  {destination.countryCode ?? COUNTRY_CODES[destination.country] ?? "VT"}
                </span>
              </span>
              <span className="mt-1.5 flex items-baseline justify-between px-1 font-script text-2xl leading-none text-[#14303a] sm:text-3xl">
                <span>{destination.name}</span>
                <span aria-hidden="true" className="text-base text-[#e5484d]">♥</span>
              </span>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
