"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useUiStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type PlayResult = "playing" | "blocked" | "error";

interface Engine {
  play: () => Promise<PlayResult>;
  stop: () => void;
  dispose: () => void;
}

const TARGET_VOLUME = 0.35;

function hasUserActivation(): boolean {
  // Browsers refuse to start audio before the first gesture; this lets us avoid a noisy failed attempt.
  return typeof navigator === "undefined" || navigator.userActivation?.hasBeenActive !== false;
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

/** Soft synthesized pad, used when a destination has no audio file. Each destination gets its own root note. */
function createToneBed(seed: string): Engine {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let oscillators: OscillatorNode[] = [];
  let suspendTimer: ReturnType<typeof setTimeout> | null = null;

  const build = (): AudioContext => {
    const context = new AudioContext();
    const gain = context.createGain();
    gain.gain.value = 0;

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;

    const roots = [110, 123.47, 130.81, 146.83, 98];
    const root = roots[hashSeed(seed) % roots.length] ?? 110;
    // Root, fifth, octave and a major ninth, slightly detuned for a slow shimmer.
    const ratios = [1, 1.5, 2, 2.25];

    // A very slow LFO breathing on the volume.
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 0.15;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();

    oscillators = ratios.map((ratio, i) => {
      const osc = context.createOscillator();
      const voice = context.createGain();
      osc.type = i % 2 === 0 ? "sine" : "triangle";
      osc.frequency.value = root * ratio;
      osc.detune.value = (i - 1.5) * 4;
      voice.gain.value = 0.22 / (i + 1);
      osc.connect(voice).connect(filter);
      osc.start();
      return osc;
    });
    oscillators.push(lfo);

    filter.connect(gain).connect(context.destination);
    master = gain;
    return context;
  };

  return {
    async play() {
      try {
        if (!hasUserActivation()) return "blocked";
        if (!ctx) ctx = build();
        if (suspendTimer) clearTimeout(suspendTimer);
        if (ctx.state === "suspended") await ctx.resume();
        if (ctx.state !== "running") return "blocked";
        master?.gain.setTargetAtTime(TARGET_VOLUME, ctx.currentTime, 0.8);
        return "playing";
      } catch {
        return "error";
      }
    },
    stop() {
      const context = ctx;
      if (!context || !master) return;
      master.gain.setTargetAtTime(0, context.currentTime, 0.25);
      if (suspendTimer) clearTimeout(suspendTimer);
      suspendTimer = setTimeout(() => {
        if (context.state === "running") void context.suspend();
      }, 1200);
    },
    dispose() {
      if (suspendTimer) clearTimeout(suspendTimer);
      for (const osc of oscillators) {
        try {
          osc.stop();
        } catch {
          // Already stopped.
        }
      }
      oscillators = [];
      if (ctx && ctx.state !== "closed") void ctx.close();
      ctx = null;
      master = null;
    },
  };
}

function createFileLoop(url: string): Engine {
  const audio = new Audio();
  audio.loop = true;
  audio.preload = "none";
  audio.volume = TARGET_VOLUME;
  audio.src = url;

  return {
    async play() {
      try {
        await audio.play();
        return "playing";
      } catch (error) {
        return error instanceof DOMException && error.name === "NotAllowedError" ? "blocked" : "error";
      }
    },
    stop() {
      audio.pause();
    },
    dispose() {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    },
  };
}

interface AmbientAudioProps {
  slug: string;
  /** When null a soft synthesized tone bed is used instead. */
  audioUrl: string | null;
  className?: string;
}

/** Muted by default. The choice is persisted by the UI store, and playback only starts after a user gesture. */
export function AmbientAudio({ slug, audioUrl, className }: AmbientAudioProps) {
  const muted = useUiStore((s) => s.ambientMuted);
  const setMuted = useUiStore((s) => s.setAmbientMuted);
  // Persisted store state is read from localStorage on the client, so wait for mount to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const engineRef = useRef<Engine | null>(null);

  useEffect(() => setMounted(true), []);

  // One engine per destination, fully disposed on unmount or destination change.
  useEffect(() => {
    const engine = audioUrl ? createFileLoop(audioUrl) : createToneBed(slug);
    engineRef.current = engine;
    setFailed(false);
    setBlocked(false);
    return () => {
      engine.dispose();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [slug, audioUrl]);

  const start = useCallback(async (): Promise<void> => {
    const engine = engineRef.current;
    if (!engine) return;
    const result = await engine.play();
    setBlocked(result === "blocked");
    setFailed(result === "error");
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (muted) {
      engineRef.current?.stop();
      setBlocked(false);
      return;
    }
    void start();
  }, [muted, mounted, slug, audioUrl, start]);

  // Persisted "unmuted" on a fresh page load can't autoplay: resume on the first gesture.
  useEffect(() => {
    if (!blocked || muted) return;
    const resume = (): void => void start();
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });
    return () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
    };
  }, [blocked, muted, start]);

  if (!mounted) {
    return <div className={cn("skeleton h-11 w-11 rounded-full", className)} aria-hidden="true" />;
  }

  const playing = !muted && !blocked && !failed;
  const label = muted
    ? "Turn on ambient sound"
    : failed
      ? "Ambient sound unavailable. Turn off"
      : blocked
        ? "Tap to start ambient sound"
        : "Mute ambient sound";

  return (
    <button
      type="button"
      onClick={() => {
        if (muted) {
          setMuted(false);
        } else if (blocked) {
          void start();
        } else {
          setMuted(true);
        }
      }}
      aria-pressed={playing}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-full border bg-card transition hover:bg-muted active:scale-95",
        playing && "border-primary text-primary",
        className,
      )}
    >
      {playing ? (
        <Volume2 className="h-5 w-5" aria-hidden="true" />
      ) : (
        <VolumeX className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}
