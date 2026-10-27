import type { ReactNode } from "react";
import Link from "next/link";
import { SafeImage } from "@/components/safe-image";
import type { DestinationCardData } from "@/lib/types";

interface DestinationCardProps {
  destination: DestinationCardData;
  /** Number of travelers currently in this destination's room. */
  onlineCount?: number;
  /** Show the "room" footer line (live rooms are only tracked for places on screen). */
  showRoom?: boolean;
  priority?: boolean;
  /** Optional control (e.g. favorite button) pinned top-right, above the card link. */
  action?: ReactNode;
}

export function DestinationCard({
  destination,
  onlineCount = 0,
  showRoom = false,
  priority = false,
  action,
}: DestinationCardProps) {
  const { slug, name, country, tagline, cardImage, gradient } = destination;
  const occupied = onlineCount > 0;

  return (
    <article className="group relative overflow-hidden rounded-2xl border bg-card shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-glow focus-within:-translate-y-1 focus-within:shadow-glow">
      <div className="skeleton relative aspect-[3/4] w-full rounded-none">
        <SafeImage
          src={cardImage}
          alt={`Scenic view of ${name}, ${country}`}
          gradient={gradient}
          sizes="(min-width: 1280px) 16vw, (min-width: 768px) 33vw, 50vw"
          priority={priority}
          className="transition-transform duration-700 group-hover:scale-105"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#050816] via-[#050816]/30 to-transparent"
          aria-hidden="true"
        />

        {occupied && (
          <span
            className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[0.7rem] font-semibold text-white backdrop-blur-md"
            role="status"
          >
            <span className="presence-dot !h-2 !w-2" aria-hidden="true" />
            Live
          </span>
        )}

        {action && <div className="absolute right-2 top-2 z-10">{action}</div>}

        <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
          <h3 className="text-xl font-bold leading-tight">
            {/* The ::after stretches this link over the whole card; the action stays above via z-10. */}
            <Link
              href={`/destination/${slug}`}
              className="rounded-md after:absolute after:inset-0 after:content-['']"
            >
              {name}
            </Link>
          </h3>
          <p className="text-xs font-medium text-white/80">{country}</p>
          <p className="mt-1 line-clamp-2 text-xs text-white/70">{tagline}</p>
          {showRoom && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-white/90">
              <span
                className={occupied ? "presence-dot !h-2 !w-2" : "h-2 w-2 rounded-full bg-white/40"}
                aria-hidden="true"
              />
              {occupied ? `${onlineCount} in room` : "Room open"}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
