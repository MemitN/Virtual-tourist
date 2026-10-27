"use client";

import { useRef, type KeyboardEvent } from "react";
import { Radio, Sparkles } from "lucide-react";
import type { TourMode } from "@/lib/types";
import { cn } from "@/lib/utils";

export type LiveFeedStatus =
  | "idle"
  | "connecting"
  | "waiting"
  | "live"
  | "unavailable"
  | "error";

interface LiveFeedToggleProps {
  mode: TourMode;
  onChange: (mode: TourMode) => void;
  /** Drives the small indicator on the Live Feed option. */
  liveStatus: LiveFeedStatus;
  className?: string;
}

const OPTIONS: { value: TourMode; label: string; icon: typeof Sparkles }[] = [
  { value: "imagery", label: "AI Imagery", icon: Sparkles },
  { value: "live", label: "Live Feed", icon: Radio },
];

/** Two-option segmented control implemented as an ARIA radio group with arrow-key navigation. */
export function LiveFeedToggle({ mode, onChange, liveStatus, className }: LiveFeedToggleProps) {
  const refs = useRef<Record<TourMode, HTMLButtonElement | null>>({ imagery: null, live: null });

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const index = OPTIONS.findIndex((o) => o.value === mode);
    let next = index;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = OPTIONS.length - 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (index - 1 + OPTIONS.length) % OPTIONS.length;
    } else next = (index + 1) % OPTIONS.length;

    const target = OPTIONS[next];
    if (!target) return;
    onChange(target.value);
    refs.current[target.value]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Tour view"
      onKeyDown={handleKeyDown}
      className={cn("inline-flex rounded-full border bg-card p-1", className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = mode === value;
        return (
          <button
            key={value}
            ref={(el) => {
              refs.current[value] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(value)}
            className={cn(
              "relative inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
              selected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
            {value === "live" && liveStatus === "live" && (
              <>
                <span className="presence-dot" aria-hidden="true" />
                <span className="sr-only">(streaming now)</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
