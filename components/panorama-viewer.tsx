"use client";

import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementRef,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import { AlertTriangle, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import type { LiveVideoTrack } from "@/lib/livekit";
import type { PointOfInterest } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Camera target in degrees. `nonce` lets the same hotspot be focused twice in a row. */
export interface PanoramaFocus {
  yaw: number;
  pitch: number;
  nonce: number;
}

interface PanoramaViewerProps {
  /** Equirectangular image. Ignored while liveVideoTrack is set. */
  imageUrl: string | null;
  /** Equirectangular live video. Takes priority over imageUrl. */
  liveVideoTrack: LiveVideoTrack | null;
  pois: readonly PointOfInterest[];
  activePoiId?: string | null;
  focus?: PanoramaFocus | null;
  onPoiSelect: (poi: PointOfInterest) => void;
  /** Accessible description of the scene, e.g. "360° view of Kyoto". */
  alt: string;
  /** CSS gradient behind the canvas while loading or on failure. */
  gradient: string;
  /** Rendered inside the fullscreen container so it stays visible in fullscreen. */
  overlay?: ReactNode;
  className?: string;
}

const SPHERE_RADIUS = 500;
const HOTSPOT_RADIUS = 400;
const MIN_FOV = 35;
const MAX_FOV = 90;
const START_FOV = 75;
const KEY_STEP = 0.12;
const MIN_POLAR = 0.15;
const MAX_POLAR = Math.PI - 0.15;

/** Direction the camera looks at for a yaw/pitch (degrees). Yaw 0 faces the image centre; positive yaw turns right. */
function directionFor(yawDeg: number, pitchDeg: number): THREE.Vector3 {
  const yaw = THREE.MathUtils.degToRad(yawDeg);
  const pitch = THREE.MathUtils.degToRad(pitchDeg);
  return new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  );
}

/** OrbitControls angles for a look direction (the camera sits opposite to where it looks). */
function anglesFor(yawDeg: number, pitchDeg: number): { azimuth: number; polar: number } {
  const d = directionFor(yawDeg, pitchDeg);
  return {
    azimuth: Math.atan2(-d.x, -d.z),
    polar: THREE.MathUtils.clamp(Math.acos(THREE.MathUtils.clamp(-d.y, -1, 1)), MIN_POLAR, MAX_POLAR),
  };
}

function shortestAngle(delta: number): number {
  return Math.atan2(Math.sin(delta), Math.cos(delta));
}

// ---------------------------------------------------------------------------
// Texture loading (outside the canvas so we can show DOM loading/error states)
// ---------------------------------------------------------------------------

type SourceState =
  | { status: "loading"; texture: null }
  | { status: "ready"; texture: THREE.Texture }
  | { status: "error"; texture: null };

function usePanoramaTexture(
  imageUrl: string | null,
  liveTrack: LiveVideoTrack | null,
  attempt: number,
): SourceState {
  const [state, setState] = useState<SourceState>({ status: "loading", texture: null });

  useEffect(() => {
    let cancelled = false;
    let texture: THREE.Texture | null = null;
    let detach: (() => void) | null = null;

    setState({ status: "loading", texture: null });

    if (liveTrack) {
      const element = document.createElement("video");
      element.muted = true;
      element.playsInline = true;
      element.autoplay = true;
      element.crossOrigin = "anonymous";
      liveTrack.attach(element);

      const onData = (): void => {
        if (cancelled) return;
        const videoTexture = new THREE.VideoTexture(element);
        videoTexture.colorSpace = THREE.SRGBColorSpace;
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.generateMipmaps = false;
        texture = videoTexture;
        setState({ status: "ready", texture: videoTexture });
      };
      const onError = (): void => {
        if (!cancelled) setState({ status: "error", texture: null });
      };
      element.addEventListener("loadeddata", onData, { once: true });
      element.addEventListener("error", onError, { once: true });
      // Autoplay of a muted inline video is normally allowed; if not, the first frame still renders.
      void element.play().catch(() => undefined);

      detach = () => {
        element.removeEventListener("loadeddata", onData);
        element.removeEventListener("error", onError);
        liveTrack.detach(element);
        element.srcObject = null;
      };
    } else if (imageUrl) {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin("anonymous");
      loader.load(
        imageUrl,
        (loaded) => {
          if (cancelled) {
            loaded.dispose();
            return;
          }
          loaded.colorSpace = THREE.SRGBColorSpace;
          loaded.minFilter = THREE.LinearFilter;
          loaded.generateMipmaps = false;
          texture = loaded;
          setState({ status: "ready", texture: loaded });
        },
        undefined,
        () => {
          if (!cancelled) setState({ status: "error", texture: null });
        },
      );
    } else {
      setState({ status: "error", texture: null });
    }

    return () => {
      cancelled = true;
      detach?.();
      texture?.dispose();
    };
  }, [imageUrl, liveTrack, attempt]);

  return state;
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

interface RigApi {
  nudge: (dAzimuth: number, dPolar: number) => void;
  zoom: (deltaFov: number) => void;
}

interface CameraRigProps {
  apiRef: MutableRefObject<RigApi | null>;
  focus: PanoramaFocus | null;
  autoRotate: boolean;
  reduceMotion: boolean;
  onInteract: () => void;
}

function CameraRig({ apiRef, focus, autoRotate, reduceMotion, onInteract }: CameraRigProps) {
  const controlsRef = useRef<ElementRef<typeof OrbitControls>>(null);
  const targetRef = useRef<{ azimuth: number; polar: number } | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const domRef = useRef<HTMLElement | null>(null);

  // Captures the camera and canvas element once the controls exist, and wires wheel + pinch zoom.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const camera = controls.object;
    const element = controls.domElement;
    if (!(camera instanceof THREE.PerspectiveCamera) || !(element instanceof HTMLElement)) return;
    cameraRef.current = camera;
    domRef.current = element;

    const setFov = (value: number): void => {
      camera.fov = THREE.MathUtils.clamp(value, MIN_FOV, MAX_FOV);
      camera.updateProjectionMatrix();
    };

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      onInteract();
      setFov(camera.fov + event.deltaY * 0.04);
    };

    const pointers = new Map<number, { x: number; y: number }>();
    let lastPinch = 0;
    const pinchDistance = (): number => {
      const [a, b] = [...pointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const onPointerDown = (event: PointerEvent): void => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) lastPinch = pinchDistance();
    };
    const onPointerMove = (event: PointerEvent): void => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        const distance = pinchDistance();
        onInteract();
        setFov(camera.fov + (lastPinch - distance) * 0.15);
        lastPinch = distance;
      }
    };
    const onPointerEnd = (event: PointerEvent): void => {
      pointers.delete(event.pointerId);
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerEnd);
    element.addEventListener("pointercancel", onPointerEnd);
    element.addEventListener("pointerleave", onPointerEnd);

    apiRef.current = {
      nudge: (dAzimuth, dPolar) => {
        const c = controlsRef.current;
        if (!c) return;
        c.setAzimuthalAngle(c.getAzimuthalAngle() + dAzimuth);
        c.setPolarAngle(c.getPolarAngle() + dPolar);
        c.update();
      },
      zoom: (deltaFov) => setFov(camera.fov + deltaFov),
    };

    return () => {
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerEnd);
      element.removeEventListener("pointercancel", onPointerEnd);
      element.removeEventListener("pointerleave", onPointerEnd);
      apiRef.current = null;
    };
  }, [apiRef, onInteract]);

  // Swing the camera toward a hotspot (instantly when the visitor prefers reduced motion).
  useEffect(() => {
    if (!focus) return;
    const next = anglesFor(focus.yaw, focus.pitch);
    const controls = controlsRef.current;
    if (reduceMotion && controls) {
      controls.setAzimuthalAngle(next.azimuth);
      controls.setPolarAngle(next.polar);
      controls.update();
      return;
    }
    targetRef.current = next;
  }, [focus, reduceMotion]);

  useFrame((_, delta) => {
    const target = targetRef.current;
    const controls = controlsRef.current;
    if (!target || !controls) return;
    const dAz = shortestAngle(target.azimuth - controls.getAzimuthalAngle());
    const dPolar = target.polar - controls.getPolarAngle();
    const ease = Math.min(1, delta * 5);
    controls.setAzimuthalAngle(controls.getAzimuthalAngle() + dAz * ease);
    controls.setPolarAngle(controls.getPolarAngle() + dPolar * ease);
    controls.update();
    if (Math.abs(dAz) < 0.002 && Math.abs(dPolar) < 0.002) targetRef.current = null;
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableZoom={false}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      // Negative speed makes dragging feel like grabbing the world.
      rotateSpeed={-0.35}
      minPolarAngle={MIN_POLAR}
      maxPolarAngle={MAX_POLAR}
      autoRotate={autoRotate}
      autoRotateSpeed={0.3}
      onStart={onInteract}
    />
  );
}

function PanoramaSphere({ texture }: { texture: THREE.Texture }) {
  return (
    // Mirrored on x so the image reads correctly from inside; rotated so the image centre faces yaw 0.
    <mesh scale={[-1, 1, 1]} rotation={[0, -Math.PI / 2, 0]}>
      <sphereGeometry args={[SPHERE_RADIUS, 64, 48]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} toneMapped={false} />
    </mesh>
  );
}

interface HotspotProps {
  poi: PointOfInterest;
  active: boolean;
  onSelect: (poi: PointOfInterest) => void;
}

function Hotspot({ poi, active, onSelect }: HotspotProps) {
  const position = useMemo(
    () => directionFor(poi.yaw, poi.pitch).multiplyScalar(HOTSPOT_RADIUS),
    [poi.yaw, poi.pitch],
  );

  return (
    <Html position={position} center zIndexRange={[30, 0]}>
      <button
        type="button"
        onClick={() => onSelect(poi)}
        aria-label={`Explore ${poi.label}`}
        aria-pressed={active}
        className={cn(
          "group flex min-h-11 items-center gap-2 rounded-full border border-white/40 bg-black/55 py-1.5 pl-2 pr-3 text-xs font-semibold text-white backdrop-blur-md transition",
          "hover:bg-black/75 active:scale-95",
          active && "border-primary bg-primary text-primary-foreground",
        )}
      >
        <span className="relative flex h-3.5 w-3.5 shrink-0" aria-hidden="true">
          {!active && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
          )}
          <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-white" />
        </span>
        <span className="whitespace-nowrap">{poi.label}</span>
      </button>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Error boundary: WebGL can be unavailable or lose its context.
// ---------------------------------------------------------------------------

interface BoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  resetKey: number;
}

class SceneBoundary extends Component<BoundaryProps, { failed: boolean; key: number }> {
  override state = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: BoundaryProps,
    state: { failed: boolean; key: number },
  ): { failed: boolean; key: number } | null {
    // A retry bumps resetKey, which clears a previous failure.
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export function PanoramaViewer({
  imageUrl,
  liveVideoTrack,
  pois,
  activePoiId = null,
  focus = null,
  onPoiSelect,
  alt,
  gradient,
  overlay,
  className,
}: PanoramaViewerProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const [attempt, setAttempt] = useState(0);
  const source = usePanoramaTexture(imageUrl, liveVideoTrack, attempt);
  const [interacted, setInteracted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<RigApi | null>(null);
  const helpId = useRef(`pano-help-${Math.random().toString(36).slice(2, 8)}`).current;

  const handleInteract = useCallback(() => setInteracted(true), []);

  useEffect(() => {
    setCanFullscreen(document.fullscreenEnabled === true);
    const onChange = (): void => {
      setFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    const container = containerRef.current;
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      // Leaving the page while fullscreen would otherwise strand the user.
      if (container && document.fullscreenElement === container) void document.exitFullscreen();
    };
  }, []);

  const toggleFullscreen = useCallback(async (): Promise<void> => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await containerRef.current?.requestFullscreen();
    } catch {
      // The browser refused (e.g. iframe policy). Nothing useful to show.
    }
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const api = apiRef.current;
    if (!api) return;
    // Arrow keys on a focused hotspot button still look around, matching drag behaviour.
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setInteracted(true);
      api.nudge(move[0], move[1]);
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      api.zoom(-6);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      api.zoom(6);
    }
  };

  const visiblePois = liveVideoTrack ? [] : pois;
  const sourceLabel = liveVideoTrack ? "live video" : "panorama";

  const errorPanel = (
    <div
      role="alert"
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/60 p-6 text-center text-white"
    >
      <AlertTriangle className="h-8 w-8" aria-hidden="true" />
      <p className="max-w-xs text-sm">
        The {sourceLabel} couldn&apos;t be displayed. Check your connection or try again.
      </p>
      <Button variant="glass" size="sm" onClick={() => setAttempt((n) => n + 1)}>
        <RefreshCw aria-hidden="true" />
        Try again
      </Button>
    </div>
  );

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={alt}
      aria-describedby={helpId}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border bg-black",
        fullscreen && "rounded-none border-0",
        className,
      )}
      style={{ backgroundImage: gradient }}
    >
      <p id={helpId} className="sr-only">
        Drag or use the arrow keys to look around. Press plus or minus to zoom.
        {canFullscreen ? " Use the fullscreen button for a larger view." : ""}
      </p>

      {source.status === "ready" && (
        <SceneBoundary resetKey={attempt} fallback={errorPanel}>
          <Canvas
            className="absolute inset-0 animate-in fade-in duration-700"
            camera={{ position: [0, 0, 0.1], fov: START_FOV, near: 0.1, far: SPHERE_RADIUS * 2 }}
            dpr={[1, 2]}
            gl={{ antialias: false, powerPreference: "high-performance" }}
          >
            <PanoramaSphere texture={source.texture} />
            <CameraRig
              apiRef={apiRef}
              focus={focus}
              autoRotate={!reduceMotion && !interacted && !activePoiId}
              reduceMotion={reduceMotion}
              onInteract={handleInteract}
            />
            {visiblePois.map((poi) => (
              <Hotspot
                key={poi.id}
                poi={poi}
                active={poi.id === activePoiId}
                onSelect={(selected) => {
                  setInteracted(true);
                  onPoiSelect(selected);
                }}
              />
            ))}
          </Canvas>
        </SceneBoundary>
      )}

      {source.status === "loading" && (
        <div
          role="status"
          className="skeleton absolute inset-0 z-10 flex items-center justify-center rounded-none bg-muted/70"
        >
          <p className="relative z-10 rounded-full bg-black/60 px-4 py-2 text-sm text-white">
            Loading {sourceLabel}…
          </p>
        </div>
      )}

      {source.status === "error" && errorPanel}

      {source.status === "ready" && !interacted && (
        <p
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/55 px-4 py-1.5 text-xs text-white backdrop-blur-md"
        >
          Drag to look around
        </p>
      )}

      {canFullscreen && (
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70 active:scale-95"
        >
          {fullscreen ? (
            <Minimize2 className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Maximize2 className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      )}

      {overlay}
    </div>
  );
}
