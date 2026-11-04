"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, type MutableRefObject, type Ref } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, Stars, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { LandmarkModelMesh } from "@/components/globe/landmark-models";
import { CONTINENT_LABELS, LANDMARKS, type Landmark } from "@/lib/landmarks";

export interface GlobeApi {
  flyTo: (lat: number, lng: number, distance?: number) => void;
  zoomBy: (factor: number) => void;
  reset: () => void;
}

export const DEFAULT_DISTANCE = 3.1;
const MIN_DISTANCE = 1.55;
const MAX_DISTANCE = 5.2;
/** Where the sun sits in camera space: upper-left and toward the viewer, so the visible side is always lit. */
const SUN_VIEW = new THREE.Vector3(-0.55, 0.42, 0.72).normalize();

export function toVector(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/* ---------------------------------- Earth ---------------------------------- */

const EARTH_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  void main() {
    vUv = uv;
    vNormalV = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const EARTH_FRAGMENT = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D specMap;
  uniform vec3 sunDir;
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  void main() {
    vec3 n = normalize(vNormalV);
    vec3 v = normalize(-vViewPos);
    float ndl = dot(n, sunDir);
    float day = smoothstep(-0.18, 0.3, ndl);

    vec3 dayCol = texture2D(dayMap, vUv).rgb;
    vec3 nightCol = texture2D(nightMap, vUv).rgb;
    float spec = texture2D(specMap, vUv).r;

    vec3 col = dayCol * (0.1 + 1.05 * max(ndl, 0.0));
    col = mix(dayCol * 0.07 + nightCol * 1.35, col, day);

    // Sun glint on the oceans
    vec3 r = reflect(-sunDir, n);
    col += vec3(1.0, 0.95, 0.85) * pow(max(dot(r, v), 0.0), 38.0) * spec * 0.55 * day;

    // Soft blue limb, like the thin atmosphere seen edge-on
    float rim = pow(1.0 - max(dot(n, v), 0.0), 3.2);
    col += vec3(0.18, 0.5, 1.0) * rim * (0.25 + 0.75 * day) * 0.9;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormalV;
  void main() {
    vNormalV = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  varying vec3 vNormalV;
  void main() {
    float t = clamp(-vNormalV.z / 0.46, 0.0, 1.0);
    float i = pow(t, 2.2);
    vec3 col = mix(vec3(0.22, 0.55, 1.0), vec3(0.55, 0.9, 1.0), i);
    gl_FragColor = vec4(col, i * 0.85);
    #include <colorspace_fragment>
  }
`;

function Earth() {
  const textures = useTexture({
    day: "/textures/earth/day.jpg",
    night: "/textures/earth/night.jpg",
    spec: "/textures/earth/specular.jpg",
    clouds: "/textures/earth/clouds.png",
  });
  const gl = useThree((s) => s.gl);

  useMemo(() => {
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    for (const key of ["day", "night"] as const) {
      textures[key].colorSpace = THREE.SRGBColorSpace;
      textures[key].anisotropy = aniso;
    }
    textures.spec.anisotropy = aniso;
  }, [gl, textures]);

  const uniforms = useMemo(
    () => ({
      dayMap: { value: textures.day },
      nightMap: { value: textures.night },
      specMap: { value: textures.spec },
      sunDir: { value: SUN_VIEW },
    }),
    [textures],
  );

  const clouds = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (clouds.current) clouds.current.rotation.y += dt * 0.006;
  });

  return (
    <group>
      <mesh
        // The planet occludes anything behind it: without this, hover/click would "see through" to the far side.
        onPointerOver={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <sphereGeometry args={[1, 96, 64]} />
        <shaderMaterial vertexShader={EARTH_VERTEX} fragmentShader={EARTH_FRAGMENT} uniforms={uniforms} />
      </mesh>
      <mesh ref={clouds} raycast={() => null}>
        <sphereGeometry args={[1.009, 64, 48]} />
        <meshBasicMaterial
          color="#ffffff"
          alphaMap={textures.clouds}
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={1.1} raycast={() => null}>
        <sphereGeometry args={[1, 64, 48]} />
        <shaderMaterial
          vertexShader={ATMOSPHERE_VERTEX}
          fragmentShader={ATMOSPHERE_FRAGMENT}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/** Faint country borders from Natural Earth, loaded after the planet is already on screen. */
function Borders() {
  const geometry = useRef<THREE.BufferGeometry>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/textures/earth/borders.json", { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<number[][]>) : []))
      .then((rings) => {
        const pts: number[] = [];
        const a = new THREE.Vector3();
        const b = new THREE.Vector3();
        for (const ring of rings) {
          for (let i = 0; i + 3 < ring.length; i += 2) {
            a.copy(toVector(ring[i + 1] as number, ring[i] as number, 1.0025));
            b.copy(toVector(ring[i + 3] as number, ring[i + 2] as number, 1.0025));
            pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
          }
        }
        geometry.current?.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      })
      .catch(() => {
        /* borders are decoration: the globe is complete without them */
      });
    return () => controller.abort();
  }, []);
  return (
    <lineSegments raycast={() => null}>
      <bufferGeometry ref={geometry} />
      <lineBasicMaterial color="#ffffff" transparent opacity={0.2} depthWrite={false} />
    </lineSegments>
  );
}

/** Keeps the scene light fixed relative to the camera, matching the sun direction used by the planet shader. */
function CameraLight() {
  const light = useRef<THREE.DirectionalLight>(null);
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    if (!light.current) return;
    light.current.position.copy(SUN_VIEW).multiplyScalar(6);
    camera.localToWorld(light.current.position);
  });
  return <directionalLight ref={light} intensity={2.4} />;
}

/* -------------------------------- Landmarks -------------------------------- */

const UP = new THREE.Vector3(0, 1, 0);
const tmpCam = new THREE.Vector3();

interface LandmarkPinProps {
  landmark: Landmark;
  hovered: boolean;
  selected: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

function LandmarkPin({ landmark, hovered, selected, onHover, onSelect }: LandmarkPinProps) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const normal = useMemo(() => toVector(landmark.lat, landmark.lng, 1).normalize(), [landmark.lat, landmark.lng]);
  const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, normal), [normal]);
  const position = useMemo(() => normal.clone().multiplyScalar(1.001), [normal]);
  const scaleRef = useRef(1);

  useFrame(({ camera, clock }) => {
    if (!group.current) return;
    const d = camera.position.length();
    // Roughly constant on-screen size, but grows a little as you zoom in.
    const target = Math.pow(d / DEFAULT_DISTANCE, 0.55) * (hovered || selected ? 1.3 : 1);
    scaleRef.current += (target - scaleRef.current) * 0.18;
    group.current.scale.setScalar(scaleRef.current);
    if (ring.current) {
      const pulse = (clock.elapsedTime * 0.9 + landmark.lat) % 1;
      ring.current.scale.setScalar(0.6 + pulse * 1.4);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - pulse) * (selected ? 0.95 : 0.65);
    }
  });

  const isFacing = (camera: THREE.Camera): boolean => normal.dot(tmpCam.copy(camera.position)) > 1.03;

  return (
    <group
      ref={group}
      position={position}
      quaternion={quaternion}
      onPointerOver={(e) => {
        if (!isFacing(e.camera)) return;
        e.stopPropagation();
        onHover(landmark.id);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = "";
      }}
      onClick={(e) => {
        if (!isFacing(e.camera)) return;
        e.stopPropagation();
        if (e.delta < 5) onSelect(landmark.id);
      }}
    >
      {/* Pulsing ground ring in the landmark's accent colour */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry args={[0.05, 0.062, 32]} />
        <meshBasicMaterial color={landmark.accent} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0005, 0]} raycast={() => null}>
        <circleGeometry args={[0.05, 24]} />
        <meshBasicMaterial color={landmark.accent} transparent opacity={selected || hovered ? 0.45 : 0.22} depthWrite={false} toneMapped={false} />
      </mesh>
      <LandmarkModelMesh model={landmark.model} />
      {/* Generous invisible hit target so tiny models are easy to tap */}
      <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.085, 8, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
    </group>
  );
}

function ContinentLabel({ name, lat, lng }: { name: string; lat: number; lng: number }) {
  const el = useRef<HTMLDivElement>(null);
  const normal = useMemo(() => toVector(lat, lng, 1).normalize(), [lat, lng]);
  const position = useMemo(() => normal.clone().multiplyScalar(1.01), [normal]);
  useFrame(({ camera }) => {
    if (!el.current) return;
    const d = camera.position.length();
    const facing = THREE.MathUtils.clamp((normal.dot(camera.position) - 1.0) / 1.0, 0, 1);
    const zoomFade = THREE.MathUtils.clamp((d - 2.1) / 0.8, 0, 1);
    el.current.style.opacity = String(facing * facing * zoomFade * 0.85);
  });
  return (
    <Html position={position} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
      <div
        ref={el}
        aria-hidden="true"
        className="select-none whitespace-nowrap font-script text-xl tracking-wide text-white opacity-0 [text-shadow:0_1px_6px_rgba(0,20,40,0.9)] sm:text-2xl"
      >
        {name}
      </div>
    </Html>
  );
}

/* ----------------------------- Camera + controls ----------------------------- */

interface FlyTarget {
  dir: THREE.Vector3;
  dist: number;
}

interface RigProps {
  apiRef: Ref<GlobeApi>;
  autoRotate: boolean;
  zoomEnabled: boolean;
}

function CameraRig({ apiRef, autoRotate, zoomEnabled }: RigProps) {
  const camera = useThree((s) => s.camera);
  const controls = useRef<OrbitControlsImpl>(null);
  const target: MutableRefObject<FlyTarget | null> = useRef(null);

  useImperativeHandle(
    apiRef,
    () => ({
      flyTo: (lat, lng, distance = 2.05) => {
        target.current = { dir: toVector(lat, lng, 1).normalize(), dist: distance };
      },
      zoomBy: (factor) => {
        const d = THREE.MathUtils.clamp(camera.position.length() * factor, MIN_DISTANCE, MAX_DISTANCE);
        target.current = { dir: camera.position.clone().normalize(), dist: d };
      },
      reset: () => {
        target.current = { dir: new THREE.Vector3(0.2, 0.3, 1).normalize(), dist: DEFAULT_DISTANCE };
      },
    }),
    [camera],
  );

  useEffect(() => {
    // Let the page scroll vertically when a finger starts on the globe; horizontal drags still spin it.
    const dom = controls.current?.domElement as HTMLElement | undefined;
    if (dom) dom.style.touchAction = "pan-y";
  }, []);

  useFrame((_, dt) => {
    const t = target.current;
    if (!t) return;
    const dist = camera.position.length();
    const dir = camera.position.clone().normalize();
    const k = 1 - Math.pow(0.0008, dt);
    const angle = dir.angleTo(t.dir);
    const nextDir = dir.lerp(t.dir, k).normalize();
    const nextDist = THREE.MathUtils.lerp(dist, t.dist, k);
    camera.position.copy(nextDir.multiplyScalar(nextDist));
    if (angle < 0.004 && Math.abs(dist - t.dist) < 0.01) target.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      enableZoom={zoomEnabled}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.6}
      zoomSpeed={0.7}
      minDistance={MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
      minPolarAngle={Math.PI * 0.08}
      maxPolarAngle={Math.PI * 0.92}
      autoRotate={autoRotate}
      autoRotateSpeed={0.45}
      onStart={() => {
        target.current = null;
      }}
    />
  );
}

/* ----------------------------------- Scene ---------------------------------- */

export interface EarthSceneProps {
  apiRef: Ref<GlobeApi>;
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  autoRotate: boolean;
  zoomEnabled: boolean;
}

export function EarthScene({ apiRef, hoveredId, selectedId, onHover, onSelect, autoRotate, zoomEnabled }: EarthSceneProps) {
  useEffect(
    () => () => {
      document.body.style.cursor = "";
    },
    [],
  );
  return (
    <>
      <ambientLight intensity={0.55} />
      <CameraLight />
      <Stars radius={60} depth={40} count={2200} factor={3.2} saturation={0} fade speed={0.4} />
      <Earth />
      <Borders />
      {CONTINENT_LABELS.map((c) => (
        <ContinentLabel key={c.name} {...c} />
      ))}
      {LANDMARKS.map((landmark) => (
        <LandmarkPin
          key={landmark.id}
          landmark={landmark}
          hovered={hoveredId === landmark.id}
          selected={selectedId === landmark.id}
          onHover={onHover}
          onSelect={onSelect}
        />
      ))}
      <CameraRig apiRef={apiRef} autoRotate={autoRotate} zoomEnabled={zoomEnabled} />
    </>
  );
}
