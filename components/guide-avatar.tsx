import type { GuideProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

interface GuideAvatarProps {
  guide: GuideProfile;
  size?: "sm" | "md" | "lg";
  online?: boolean;
  className?: string;
}

const SIZES = { sm: "h-9 w-9 text-base", md: "h-14 w-14 text-2xl", lg: "h-20 w-20 text-3xl" } as const;

/** Monogram portrait tinted per guide: personal without pretending to be a photo of a real person. */
export function GuideAvatar({ guide, size = "sm", online = false, className }: GuideAvatarProps) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)} aria-hidden="true">
      <span
        className={cn(
          "flex items-center justify-center rounded-full font-display font-bold text-white ring-2 ring-white/20",
          SIZES[size],
        )}
        style={{
          backgroundImage: `linear-gradient(135deg, hsl(${guide.hue} 75% 52%), hsl(${(guide.hue + 50) % 360} 80% 38%))`,
        }}
      >
        {guide.name.charAt(0)}
      </span>
      {online && (
        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card bg-success" />
      )}
    </span>
  );
}
