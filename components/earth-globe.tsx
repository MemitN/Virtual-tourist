"use client";

import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Minus, Pause, Play, Plus, RotateCcw, X } from "lucide-react";
import { z } from "zod";
import { EarthScene, type GlobeApi } from "@/components/globe/earth-scene";
import { SafeImage } from "@/components/safe-image";
import { LANDMARKS, type Landmark } from "@/lib/landmarks";
import { cn } from "@/lib/utils";

const previewSchema = z.object({
  slug: z.string(),
  tagline: z.string(),
  cardImage: z.string(),
  gradient: z.string(),
});
type Preview = z.infer<typeof previewSchema>;
const previewCache = new Map<string, Preview>();

export interface GlobeFocus {
  lat: number;
  lng: number;
  /** Change this to re-trigger a fly-to for the same coordinates. */
  key: string;
}

interface EarthGlobeProps {
  className?: string;
  /** Mouse-wheel zoom. Off by default so the globe never hijacks page scrolling. */
  zoom?: boolean;
  /** Show a keyboard-friendly row of landmark buttons under the globe. */
  rail?: boolean;
  /** Fly the camera to a place (e.g. what the visitor just searched for). */
  focus?: GlobeFocus | null;
  /** Start spinning on its own. */
  autoRotate?: boolean;
}

class GlobeBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Shown while the planet loads, and if WebGL isn't available at all. */
function GlobePlaceholder({ message }: { message?: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div
        role={message ? undefined : "status"}
        aria-label={message ? undefined : "Loading globe"}
        className="relative aspect-square w-[78%] rounded-full shadow-[0_0_80px_-10px_rgba(56,189,248,0.55)]"
        style={{
          background:
            "radial-gradient(circle at 32% 28%, #5cc8ff 0%, #1d6fb8 38%, #0b2f5c 70%, #04122b 100%)",
        }}
      >
        <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-tr from-transparent via-white/10 to-transparent" />
        {message && (
          <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-sm font-semibold text-white/90">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

function ReadySignal({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

function LandmarkCard({ landmark, onClose }: { landmark: Landmark; onClose: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(() => previewCache.get(landmark.city.slug) ?? null);

  useEffect(() => {
    const cached = previewCache.get(landmark.city.slug);
    if (cached) {
      setPreview(cached);
      return;
    }
    setPreview(null);
    const controller = new AbortController();
    fetch(`/api/place-preview?slug=${encodeURIComponent(landmark.city.slug)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: unknown) => {
        const parsed = previewSchema.safeParse(json);
        if (!parsed.success) return;
        previewCache.set(landmark.city.slug, parsed.data);
        setPreview(parsed.data);
      })
      .catch(() => {
        /* the card works fine without a photo */
      });
    return () => controller.abort();
  }, [landmark.city.slug]);

  return (
    <motion.div
      key={landmark.id}
      role="dialog"
      aria-label={`${landmark.name}, ${landmark.country}`}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-x-3 bottom-3 z-20 overflow-hidden rounded-2xl border border-white/15 bg-black/65 text-white shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:left-3 sm:w-80"
    >
      <div className="relative h-24 w-full overflow-hidden" style={{ background: `linear-gradient(135deg, ${landmark.accent}55, #0b2f5c)` }}>
        {preview && (
          <SafeImage src={preview.cardImage} alt="" gradient={preview.gradient} sizes="320px" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close landmark details"
          className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <p className="absolute bottom-2 left-3 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: landmark.accent }}>
          {landmark.continent}
        </p>
      </div>
      <div className="space-y-2 p-4">
        <div>
          <h3 className="text-lg font-bold leading-tight">{landmark.name}</h3>
          <p className="text-sm text-white/70">{landmark.country}</p>
        </div>
        <p className="text-sm text-white/85">{landmark.blurb}</p>
        <Link
          href={`/destination/${landmark.city.slug}`}
          className="mt-1 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
        >
          Visit {landmark.city.name}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </motion.div>
  );
}

function ControlButton({ label, onClick, children, pressed }: { label: string; onClick: () => void; children: ReactNode; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-md transition hover:bg-black/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
    >
      {children}
    </button>
  );
}

/**
 * A realistic, interactive 3D Earth: NASA imagery, day/night shading, clouds, atmosphere, borders,
 * and miniature 3D landmarks standing on their countries. Drag to spin, tap a landmark to fly to it.
 */
export function EarthGlobe({ className, zoom = false, rail = false, focus = null, autoRotate = true }: EarthGlobeProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const apiRef = useRef<GlobeApi>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [inView, setInView] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(autoRotate && !reduceMotion);

  const hovered = LANDMARKS.find((l) => l.id === hoveredId) ?? null;
  const selected = LANDMARKS.find((l) => l.id === selectedId) ?? null;
  const markReady = useCallback(() => setReady(true), []);

  // Don't burn GPU while the globe is scrolled out of view or the tab is hidden.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? true), { threshold: 0.05 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    const landmark = LANDMARKS.find((l) => l.id === id);
    if (landmark) apiRef.current?.flyTo(landmark.lat, landmark.lng, 2.0);
  }, []);

  useEffect(() => {
    if (focus) apiRef.current?.flyTo(focus.lat, focus.lng, 2.3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const initialCamera = useMemo(() => ({ position: [0.62, 0.93, 3.0] as [number, number, number], fov: 40, near: 0.1, far: 200 }), []);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        ref={rootRef}
        role="group"
        aria-label="Interactive 3D Earth. Drag to spin, tap a landmark to fly to it. The landmark list works with a keyboard."
        className="relative aspect-square w-full"
      >
        {/* A pool of deep space behind the planet, so the atmosphere glows in both light and dark themes */}
        <div
          aria-hidden="true"
          className="absolute inset-[-7%] rounded-full"
          style={{ background: "radial-gradient(circle, #0b1f3f 0%, #07162e 52%, rgba(5,16,36,0.55) 64%, transparent 72%)" }}
        />
        <GlobeBoundary fallback={<GlobePlaceholder message="Your browser can't show the 3D globe, but every landmark is still listed below." />}>
          {!ready && <GlobePlaceholder />}
          <div className={cn("absolute inset-0 transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}>
            <Canvas
              camera={initialCamera}
              dpr={[1, 2]}
              frameloop={inView ? "always" : "never"}
              gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            >
              <Suspense fallback={null}>
                <EarthScene
                  apiRef={apiRef}
                  hoveredId={hoveredId}
                  selectedId={selectedId}
                  onHover={setHoveredId}
                  onSelect={select}
                  autoRotate={spinning && selectedId === null && hoveredId === null}
                  zoomEnabled={zoom}
                />
                <ReadySignal onReady={markReady} />
              </Suspense>
            </Canvas>
          </div>
        </GlobeBoundary>

        <p aria-live="polite" className="sr-only">
          {selected ? `${selected.name}, ${selected.country}` : hovered ? `${hovered.name}, ${hovered.country}` : ""}
        </p>

        {/* Hover label */}
        <AnimatePresence>
          {hovered && !selected && (
            <motion.p
              key={hovered.id}
              aria-hidden="true"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-md"
            >
              {hovered.name} · {hovered.country}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Controls */}
        {ready && (
          <div className="absolute right-0 top-0 z-10 flex flex-col gap-2 sm:right-1">
            <ControlButton label="Zoom in" onClick={() => apiRef.current?.zoomBy(0.72)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
            </ControlButton>
            <ControlButton label="Zoom out" onClick={() => apiRef.current?.zoomBy(1.38)}>
              <Minus className="h-4 w-4" aria-hidden="true" />
            </ControlButton>
            <ControlButton
              label="Reset view"
              onClick={() => {
                setSelectedId(null);
                apiRef.current?.reset();
              }}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </ControlButton>
            <ControlButton
              label={spinning ? "Pause rotation" : "Resume rotation"}
              pressed={spinning}
              onClick={() => setSpinning((s) => !s)}
            >
              {spinning ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
            </ControlButton>
          </div>
        )}

        {ready && !selected && !hovered && (
          <p aria-hidden="true" className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap font-script text-xl text-white/80 [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
            drag to spin · tap a landmark
          </p>
        )}

        <AnimatePresence>
          {selected && <LandmarkCard key={selected.id} landmark={selected} onClose={() => setSelectedId(null)} />}
        </AnimatePresence>
      </div>

      {rail && (
        <ul aria-label="Landmarks on the globe" className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
          {LANDMARKS.map((landmark) => (
            <li key={landmark.id} className="shrink-0">
              <button
                type="button"
                aria-pressed={selectedId === landmark.id}
                onClick={() => select(landmark.id)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border bg-card/70 px-4 text-sm font-medium backdrop-blur transition hover:border-primary hover:bg-primary/10",
                  selectedId === landmark.id && "border-primary bg-primary/15",
                )}
              >
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: landmark.accent }} />
                {landmark.name}
                <span className="text-xs text-muted-foreground">{landmark.country}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
