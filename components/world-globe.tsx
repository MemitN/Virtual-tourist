"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import type { FeaturedPlace } from "@/lib/featured";

interface WorldGlobeProps {
  places: readonly FeaturedPlace[];
  onSelect: (place: FeaturedPlace) => void;
  className?: string;
}

function toVector(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/** Latitude/longitude lines every 15°, built once as a single line-segments geometry. */
function buildGraticule(): THREE.BufferGeometry {
  const points: number[] = [];
  const push = (v: THREE.Vector3): void => void points.push(v.x, v.y, v.z);
  for (let lat = -75; lat <= 75; lat += 15) {
    for (let lng = -180; lng < 180; lng += 6) {
      push(toVector(lat, lng, 1.002));
      push(toVector(lat, lng + 6, 1.002));
    }
  }
  for (let lng = -180; lng < 180; lng += 15) {
    for (let lat = -90; lat < 90; lat += 6) {
      push(toVector(lat, lng, 1.002));
      push(toVector(lat + 6, lng, 1.002));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

interface MarkerProps {
  place: FeaturedPlace;
  hovered: boolean;
  onHover: (slug: string | null) => void;
  onSelect: (place: FeaturedPlace) => void;
}

function Marker({ place, hovered, onHover, onSelect }: MarkerProps) {
  const position = useMemo(() => toVector(place.lat, place.lng, 1.015), [place.lat, place.lng]);
  return (
    <mesh
      position={position}
      scale={hovered ? 1.9 : 1}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(place.slug);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = "";
      }}
      // A drag that ends over a marker shouldn't count as a click.
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta < 4) onSelect(place);
      }}
    >
      <sphereGeometry args={[0.022, 12, 12]} />
      <meshBasicMaterial color={hovered ? "#ffffff" : "#4cc9ff"} toneMapped={false} />
    </mesh>
  );
}

/**
 * A drag-to-spin globe with every featured place as a glowing node.
 * The globe is a visual shortcut; keyboard users get the same places as links beside it.
 */
export function WorldGlobe({ places, onSelect, className }: WorldGlobeProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const graticule = useMemo(() => buildGraticule(), []);
  const [hovered, setHovered] = useState<string | null>(null);
  const hoveredPlace = places.find((p) => p.slug === hovered) ?? null;
  const rootRef = useRef<HTMLDivElement>(null);

  // Release GPU buffers and any cursor override when the globe goes away.
  useEffect(
    () => () => {
      graticule.dispose();
      document.body.style.cursor = "";
    },
    [graticule],
  );

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="Interactive globe. Drag to spin, tap a glowing point to visit. The list of places beside it works with a keyboard."
      className={className}
    >
      <Canvas camera={{ position: [0, 0.3, 3.1], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.8} />
        <mesh>
          <sphereGeometry args={[1, 64, 48]} />
          <meshBasicMaterial color="#071236" />
        </mesh>
        <mesh scale={1.12}>
          <sphereGeometry args={[1, 48, 32]} />
          <meshBasicMaterial color="#2f6bff" transparent opacity={0.12} side={THREE.BackSide} />
        </mesh>
        <lineSegments geometry={graticule}>
          <lineBasicMaterial color="#2f6bff" transparent opacity={0.45} />
        </lineSegments>
        {places.map((place) => (
          <Marker
            key={place.slug}
            place={place}
            hovered={hovered === place.slug}
            onHover={setHovered}
            onSelect={onSelect}
          />
        ))}
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          enableDamping
          autoRotate={!reduceMotion && hovered === null}
          autoRotateSpeed={0.6}
          minPolarAngle={Math.PI * 0.2}
          maxPolarAngle={Math.PI * 0.8}
        />
      </Canvas>
      <p aria-live="polite" className="sr-only">
        {hoveredPlace ? `${hoveredPlace.name}, ${hoveredPlace.country}` : ""}
      </p>
      {hoveredPlace && (
        <p
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-md"
        >
          {hoveredPlace.name}, {hoveredPlace.country}
        </p>
      )}
    </div>
  );
}
