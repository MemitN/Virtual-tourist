"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface SafeImageProps {
  src: string;
  alt: string;
  /** CSS gradient shown if the image fails to load. */
  gradient: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}

/**
 * Fills its (relatively positioned) parent. Fades in on load, and falls back
 * to a gradient so a broken remote image never leaves an empty hole.
 */
export function SafeImage({ src, alt, gradient, sizes, priority, className }: SafeImageProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");

  if (status === "failed") {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn("absolute inset-0", className)}
        style={{ backgroundImage: gradient }}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      // Procedural scenery is an inline data URL, which the image optimizer can't fetch.
      unoptimized={src.startsWith("data:")}
      onLoad={() => setStatus("loaded")}
      onError={() => setStatus("failed")}
      className={cn(
        "object-cover transition-opacity duration-700",
        status === "loaded" ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  );
}
