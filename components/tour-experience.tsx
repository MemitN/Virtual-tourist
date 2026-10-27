"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { z } from "zod";
import { toast } from "sonner";
import {
  ChevronLeft,
  Loader2,
  MapPin,
  MessageCircle,
  RadioTower,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { AmbientAudio } from "@/components/ambient-audio";
import { LiveFeedToggle, type LiveFeedStatus } from "@/components/live-feed-toggle";
import { PanoramaViewer, type PanoramaFocus } from "@/components/panorama-viewer";
import { RoomPresence } from "@/components/room-presence";
import { ShareButton } from "@/components/share-button";
import { Button } from "@/components/ui/button";
import {
  connectLiveFeed,
  isLiveKitConfigured,
  type LiveFeedConnection,
  type LiveVideoTrack,
} from "@/lib/livekit";
import { useRoom } from "@/lib/realtime/useRoom";
import { SITE_NAME } from "@/lib/site";
import { useUiStore } from "@/lib/store";
import type { Destination, PointOfInterest, TourMode } from "@/lib/types";
import { cn } from "@/lib/utils";

const imageResponseSchema = z.object({
  url: z.string().url(),
  placeholder: z.boolean().optional(),
});
const apiErrorSchema = z.object({ error: z.string() });

const MOODS = [
  { id: "golden", label: "Golden hour", prompt: "golden hour light, warm long shadows, a quiet street" },
  { id: "misty", label: "Misty dawn", prompt: "soft mist at dawn, empty streets, pale pink sky" },
  { id: "night", label: "Night lights", prompt: "after dark, glowing lights and reflections, lively atmosphere" },
  { id: "rain", label: "Rainy day", prompt: "light rain, wet pavement, umbrellas, moody clouds" },
] as const;

type MoodId = (typeof MOODS)[number]["id"];

const VIEWER_HEIGHT = "h-[58dvh] min-h-[320px] sm:h-[68dvh]";

interface TourExperienceProps {
  destination: Destination;
  /** Hotspot to open on arrival, from a shared ?poi= link. */
  initialPoiId?: string | null;
}

export function TourExperience({ destination, initialPoiId = null }: TourExperienceProps) {
  const { slug, name, pois, heroImage, gradient, ambientAudioUrl } = destination;
  const pathname = usePathname();
  const reduceMotion = useReducedMotion() ?? false;
  const openAuthDialog = useUiStore((s) => s.openAuthDialog);

  const room = useRoom(slug);
  const { announcePoi } = room;

  const [mode, setMode] = useState<TourMode>("imagery");

  // --- AI imagery -----------------------------------------------------------
  const [imageUrl, setImageUrl] = useState<string>(heroImage);
  const [activeMood, setActiveMood] = useState<MoodId | null>(null);
  const [generating, setGenerating] = useState<MoodId | null>(null);
  const imageCache = useRef(new Map<MoodId, string>());
  const imageAbort = useRef<AbortController | null>(null);

  useEffect(() => () => imageAbort.current?.abort(), []);

  const generate = useCallback(
    async (mood: (typeof MOODS)[number]): Promise<void> => {
      if (generating) return;
      const cached = imageCache.current.get(mood.id);
      if (cached) {
        setImageUrl(cached);
        setActiveMood(mood.id);
        return;
      }

      const controller = new AbortController();
      imageAbort.current = controller;
      setGenerating(mood.id);
      try {
        const response = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, prompt: `${name}, ${mood.prompt}` }),
          signal: controller.signal,
        });

        if (response.status === 401) {
          toast("Sign in to generate new AI views.");
          openAuthDialog(pathname);
          return;
        }
        if (!response.ok) {
          const body = apiErrorSchema.safeParse(await response.json().catch(() => null));
          toast.error(
            body.success ? body.data.error : "Couldn't generate that view. Please try again.",
          );
          return;
        }

        const parsed = imageResponseSchema.safeParse(await response.json());
        if (!parsed.success) {
          toast.error("The image service sent back something unexpected.");
          return;
        }
        if (parsed.data.placeholder) {
          toast("AI image generation is switched off here, so you're seeing the demo view.");
        } else {
          imageCache.current.set(mood.id, parsed.data.url);
        }
        setImageUrl(parsed.data.url);
        setActiveMood(mood.id);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        toast.error("Network problem while generating the view. Please try again.");
      } finally {
        if (imageAbort.current === controller) imageAbort.current = null;
        setGenerating((current) => (current === mood.id ? null : current));
      }
    },
    [generating, slug, name, openAuthDialog, pathname],
  );

  // --- Live feed ------------------------------------------------------------
  const [liveStatus, setLiveStatus] = useState<LiveFeedStatus>("idle");
  const [liveTrack, setLiveTrack] = useState<LiveVideoTrack | null>(null);
  const [liveAttempt, setLiveAttempt] = useState(0);

  useEffect(() => {
    if (mode !== "live") {
      setLiveStatus("idle");
      setLiveTrack(null);
      return;
    }
    if (!isLiveKitConfigured()) {
      setLiveStatus("unavailable");
      return;
    }

    let cancelled = false;
    let connection: LiveFeedConnection | null = null;
    setLiveStatus("connecting");

    connectLiveFeed(slug, {
      onVideoTrack: (track) => {
        if (cancelled) return;
        setLiveTrack(track);
        setLiveStatus(track ? "live" : "waiting");
      },
      onDisconnected: () => {
        if (!cancelled) setLiveStatus("error");
      },
    })
      .then((result) => {
        if (cancelled) {
          result?.disconnect();
          return;
        }
        if (!result) {
          setLiveStatus("unavailable");
          return;
        }
        connection = result;
        setLiveStatus((previous) => (previous === "live" ? previous : "waiting"));
      })
      .catch(() => {
        if (!cancelled) setLiveStatus("error");
      });

    return () => {
      cancelled = true;
      connection?.disconnect();
      setLiveTrack(null);
    };
  }, [mode, slug, liveAttempt]);

  // --- Hotspots + shared room -----------------------------------------------
  const [activePoiId, setActivePoiId] = useState<string | null>(null);
  const [focus, setFocus] = useState<PanoramaFocus | null>(null);
  const activePoi = pois.find((poi) => poi.id === activePoiId) ?? null;

  const selectPoi = useCallback(
    (poi: PointOfInterest): void => {
      setActivePoiId(poi.id);
      setFocus({ yaw: poi.yaw, pitch: poi.pitch, nonce: Date.now() });
      announcePoi({ id: poi.id, label: poi.label });
    },
    [announcePoi],
  );

  const clearPoi = useCallback((): void => {
    setActivePoiId(null);
    announcePoi(null);
  }, [announcePoi]);

  // Open a hotspot from a shared link, once.
  const deepLinkedRef = useRef(false);
  useEffect(() => {
    if (deepLinkedRef.current || !initialPoiId) return;
    deepLinkedRef.current = true;
    const poi = pois.find((p) => p.id === initialPoiId);
    if (poi) selectPoi(poi);
  }, [initialPoiId, pois, selectPoi]);

  useEffect(() => {
    if (!activePoiId) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") clearPoi();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activePoiId, clearPoi]);

  const handleModeChange = (next: TourMode): void => {
    setMode(next);
    if (next === "live") clearPoi();
  };

  const poiCard = (
    <AnimatePresence>
      {mode === "imagery" && activePoi && (
        <motion.section
          key={activePoi.id}
          aria-label={`About ${activePoi.label}`}
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-x-3 bottom-3 z-20 rounded-2xl border border-white/15 bg-black/75 p-4 text-white shadow-lg backdrop-blur-xl sm:inset-x-auto sm:left-4 sm:max-w-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">{activePoi.label}</h2>
            <button
              type="button"
              onClick={clearPoi}
              aria-label="Close details"
              className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/15"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1 text-sm text-white/85">{activePoi.description}</p>
          <Button asChild size="sm" variant="glass" className="mt-3">
            <Link
              href={`/destination/${slug}/guide?q=${encodeURIComponent(
                `Tell me about ${activePoi.label} like a local would.`,
              )}`}
            >
              <MessageCircle aria-hidden="true" />
              Ask the guide
            </Link>
          </Button>
        </motion.section>
      )}
    </AnimatePresence>
  );

  return (
    <div className="container space-y-4 py-4 sm:py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/destination/${slug}`}
            className="mb-1 inline-flex min-h-11 items-center gap-1 rounded-full pr-3 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {name}
          </Link>
          <h1 className="text-3xl font-bold sm:text-4xl">360° tour of {name}</h1>
        </div>
        <RoomPresence room={room} pois={pois} />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <LiveFeedToggle mode={mode} onChange={handleModeChange} liveStatus={liveStatus} />
        <div className="flex items-center gap-2">
          <ShareButton
            title={activePoi ? `${activePoi.label}, ${name}` : `360° tour of ${name}`}
            text={`Explore ${activePoi ? activePoi.label : name} with me on ${SITE_NAME}.`}
            path={`/destination/${slug}/tour${activePoi ? `?poi=${activePoi.id}` : ""}`}
            className="h-11 px-4"
          />
          <AmbientAudio slug={slug} audioUrl={ambientAudioUrl} />
        </div>
      </div>

      {mode === "imagery" || liveTrack ? (
        <PanoramaViewer
          imageUrl={mode === "imagery" ? imageUrl : null}
          liveVideoTrack={mode === "live" ? liveTrack : null}
          pois={pois}
          activePoiId={activePoiId}
          focus={focus}
          onPoiSelect={selectPoi}
          alt={`360° view of ${name}`}
          gradient={gradient}
          overlay={poiCard}
          className={VIEWER_HEIGHT}
        />
      ) : (
        <LivePlaceholder
          status={liveStatus}
          gradient={gradient}
          onRetry={() => setLiveAttempt((n) => n + 1)}
          onBack={() => handleModeChange("imagery")}
        />
      )}

      {mode === "imagery" && (
        <section aria-labelledby="mood-heading" className="rounded-2xl border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 id="mood-heading" className="font-sans text-base font-semibold">
              Reimagine {name} with AI
            </h2>
          </div>
          <ul className="flex flex-wrap gap-2">
            <li>
              <MoodButton
                label="Original view"
                pressed={activeMood === null}
                busy={false}
                disabled={Boolean(generating)}
                onClick={() => {
                  setImageUrl(heroImage);
                  setActiveMood(null);
                }}
              />
            </li>
            {MOODS.map((mood) => (
              <li key={mood.id}>
                <MoodButton
                  label={mood.label}
                  pressed={activeMood === mood.id}
                  busy={generating === mood.id}
                  disabled={Boolean(generating)}
                  onClick={() => void generate(mood)}
                />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground" role="status" aria-live="polite">
            {generating
              ? "Painting a new 360° view. This can take up to a minute."
              : "Generated by Meta's muse-image-1.0. Sign in to create new views."}
          </p>
        </section>
      )}

      <section aria-labelledby="hotspots-heading">
        <h2 id="hotspots-heading" className="mb-3 text-xl font-bold">
          Hotspots
        </h2>
        {pois.length === 0 && (
          <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            No landmarks are mapped around {name} yet. Ask your guide where to go, and look around
            in 360° meanwhile.
          </p>
        )}
        <ul className="grid gap-2 sm:grid-cols-2">
          {pois.map((poi) => (
            <li key={poi.id}>
              <button
                type="button"
                disabled={mode !== "imagery"}
                aria-pressed={poi.id === activePoiId}
                onClick={() => selectPoi(poi)}
                className={cn(
                  "flex min-h-11 w-full items-start gap-3 rounded-2xl border bg-card p-3 text-left transition",
                  "hover:border-primary hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
                  poi.id === activePoiId && "border-primary",
                )}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-semibold">{poi.label}</span>
                  <span className="block text-xs text-muted-foreground">{poi.description}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {mode !== "imagery" && (
          <p className="mt-2 text-xs text-muted-foreground">
            Hotspots belong to the AI imagery view. Switch back to explore them.
          </p>
        )}
      </section>
    </div>
  );
}

interface MoodButtonProps {
  label: string;
  pressed: boolean;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}

function MoodButton({ label, pressed, busy, disabled, onClick }: MoodButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-busy={busy}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition",
        "hover:bg-muted disabled:cursor-wait disabled:opacity-60",
        pressed && "border-primary bg-primary/15 text-primary",
      )}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {label}
    </button>
  );
}

interface LivePlaceholderProps {
  status: LiveFeedStatus;
  gradient: string;
  onRetry: () => void;
  onBack: () => void;
}

/** Friendly stand-in for every moment the live 360° stream isn't on screen. */
function LivePlaceholder({ status, gradient, onRetry, onBack }: LivePlaceholderProps) {
  const copy: Record<LiveFeedStatus, { title: string; body: string }> = {
    idle: { title: "Preparing the live feed", body: "One moment…" },
    connecting: { title: "Connecting to the live feed", body: "Looking for a 360° camera in this destination…" },
    waiting: {
      title: "No one is streaming right now",
      body: "You're connected. The view will appear the moment a 360° camera goes live.",
    },
    live: { title: "Live", body: "Streaming now." },
    unavailable: {
      title: "Live 360° isn't set up yet",
      body: "This deployment has no LiveKit server configured. The AI imagery tour works everywhere.",
    },
    error: {
      title: "Couldn't reach the live feed",
      body: "Check your connection and try again, or return to the AI imagery.",
    },
  };
  const { title, body } = copy[status];
  const busy = status === "connecting" || status === "idle";

  return (
    <div
      role={status === "error" ? "alert" : "status"}
      className={cn(
        "relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border p-6 text-center text-white",
        VIEWER_HEIGHT,
      )}
      style={{ backgroundImage: gradient }}
    >
      <div className="absolute inset-0 bg-black/55" aria-hidden="true" />
      <div className="relative flex max-w-sm flex-col items-center gap-3">
        {busy ? (
          <Loader2 className="h-9 w-9 animate-spin" aria-hidden="true" />
        ) : (
          <RadioTower className="h-9 w-9" aria-hidden="true" />
        )}
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="text-sm text-white/85">{body}</p>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {status === "error" && (
            <Button variant="glass" size="sm" onClick={onRetry}>
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
          )}
          {status !== "connecting" && status !== "idle" && (
            <Button variant="glass" size="sm" onClick={onBack}>
              <Sparkles aria-hidden="true" />
              Back to AI imagery
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
