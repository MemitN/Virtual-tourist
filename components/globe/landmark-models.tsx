"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { LandmarkModel } from "@/lib/landmarks";

/*
  Low-poly miniatures of each landmark, built from a handful of shared primitives.
  Every model stands on +Y with its base at y = 0 and is roughly 0.1 globe-radii tall,
  so it reads as a recognisable silhouette from across the globe.
*/
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  cone: new THREE.ConeGeometry(1, 1, 14),
  sph: new THREE.SphereGeometry(1, 14, 10),
  half: new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  torus: new THREE.TorusGeometry(1, 0.18, 6, 24),
};

const M = {
  stone: new THREE.MeshStandardMaterial({ color: "#e6c9a0", roughness: 0.85 }),
  sand: new THREE.MeshStandardMaterial({ color: "#d9a85f", roughness: 0.9 }),
  white: new THREE.MeshStandardMaterial({ color: "#f7f5ef", roughness: 0.5 }),
  marble: new THREE.MeshStandardMaterial({ color: "#efe6d6", roughness: 0.6 }),
  dark: new THREE.MeshStandardMaterial({ color: "#3b3a46", roughness: 0.7 }),
  iron: new THREE.MeshStandardMaterial({ color: "#6b4a2f", roughness: 0.6, metalness: 0.3 }),
  gold: new THREE.MeshStandardMaterial({ color: "#ffcf40", roughness: 0.3, metalness: 0.7 }),
  red: new THREE.MeshStandardMaterial({ color: "#e0452f", roughness: 0.55 }),
  orange: new THREE.MeshStandardMaterial({ color: "#f2582c", roughness: 0.5 }),
  green: new THREE.MeshStandardMaterial({ color: "#58b89a", roughness: 0.6 }),
  grass: new THREE.MeshStandardMaterial({ color: "#4f9a4a", roughness: 0.9 }),
  rock: new THREE.MeshStandardMaterial({ color: "#8a7e72", roughness: 0.95 }),
  snow: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.6 }),
  glass: new THREE.MeshStandardMaterial({ color: "#8fd0ff", roughness: 0.15, metalness: 0.6 }),
  steel: new THREE.MeshStandardMaterial({ color: "#c9d3de", roughness: 0.25, metalness: 0.8 }),
  rose: new THREE.MeshStandardMaterial({ color: "#e98466", roughness: 0.85 }),
  uluru: new THREE.MeshStandardMaterial({ color: "#c8502d", roughness: 0.95 }),
  basil: new THREE.MeshStandardMaterial({ color: "#c93a3a", roughness: 0.5 }),
  teal: new THREE.MeshStandardMaterial({ color: "#2fb5a8", roughness: 0.5 }),
  blue: new THREE.MeshStandardMaterial({ color: "#3f6fd8", roughness: 0.5 }),
  yellow: new THREE.MeshStandardMaterial({ color: "#f5c542", roughness: 0.5 }),
};

type Vec = [number, number, number];
type Geo = keyof typeof G;
type Mat = keyof typeof M;

interface PartProps {
  g?: Geo;
  m: Mat;
  /** Base position (the part's bottom-centre). */
  p?: Vec;
  /** Size: [width, height, depth] (cylinders and cones: [radius, height, radius]). */
  s: Vec;
  r?: Vec;
}

/** A single primitive standing on its base position. */
function P({ g = "box", m, p = [0, 0, 0], s, r }: PartProps) {
  const lift = g === "sph" ? s[1] : g === "torus" || g === "half" ? 0 : s[1] / 2;
  return (
    <mesh
      geometry={G[g]}
      material={M[m]}
      position={[p[0], p[1] + lift, p[2]]}
      scale={s}
      rotation={r}
      raycast={() => null}
    />
  );
}

/** A tapered column (frustum) from radius `rb` at the bottom to `rt` at the top. */
function Taper({ rb, rt, h, m, p = [0, 0, 0], sides = 14 }: { rb: number; rt: number; h: number; m: Mat; p?: Vec; sides?: number }) {
  const geometry = useMemo(() => new THREE.CylinderGeometry(rt, rb, h, sides), [rt, rb, h, sides]);
  return <mesh geometry={geometry} material={M[m]} position={[p[0], p[1] + h / 2, p[2]]} raycast={() => null} />;
}

function Eiffel() {
  const leg = (x: number, z: number) => (
    <mesh key={`${x}${z}`} geometry={G.box} material={M.iron} position={[x * 0.5, 0.035, z * 0.5]} scale={[0.012, 0.085, 0.012]} rotation={[z * -0.26, 0, x * 0.26]} raycast={() => null} />
  );
  return (
    <group>
      {leg(0.05, 0.05)}
      {leg(-0.05, 0.05)}
      {leg(0.05, -0.05)}
      {leg(-0.05, -0.05)}
      <P m="iron" p={[0, 0.06, 0]} s={[0.07, 0.008, 0.07]} />
      <Taper rb={0.028} rt={0.012} h={0.06} m="iron" p={[0, 0.068, 0]} />
      <P m="iron" p={[0, 0.118, 0]} s={[0.032, 0.006, 0.032]} />
      <Taper rb={0.011} rt={0.004} h={0.07} m="iron" p={[0, 0.124, 0]} />
      <P g="cone" m="iron" p={[0, 0.19, 0]} s={[0.004, 0.04, 0.004]} />
    </group>
  );
}

function BigBen() {
  return (
    <group>
      <P m="stone" s={[0.034, 0.11, 0.034]} />
      <P m="stone" p={[0, 0.11, 0]} s={[0.04, 0.03, 0.04]} />
      <P m="white" p={[0.021, 0.12, 0]} s={[0.003, 0.018, 0.018]} />
      <P m="white" p={[0, 0.12, 0.021]} s={[0.018, 0.018, 0.003]} />
      <P g="cone" m="dark" p={[0, 0.14, 0]} s={[0.026, 0.05, 0.026]} />
      <P m="gold" p={[0, 0.19, 0]} s={[0.003, 0.02, 0.003]} />
    </group>
  );
}

function Colosseum() {
  return (
    <group>
      <Taper rb={0.075} rt={0.065} h={0.05} m="stone" />
      <P g="torus" m="stone" p={[0, 0.05, 0]} s={[0.066, 0.1, 0.066]} r={[Math.PI / 2, 0, 0]} />
      <Taper rb={0.045} rt={0.045} h={0.036} m="sand" p={[0, 0.002, 0]} />
    </group>
  );
}

function Sagrada() {
  const spire = (x: number, z: number, h: number) => (
    <group key={`${x}${z}`}>
      <Taper rb={0.014} rt={0.006} h={h} m="sand" p={[x, 0, z]} />
      <P g="cone" m="sand" p={[x, h, z]} s={[0.007, 0.03, 0.007]} />
    </group>
  );
  return (
    <group>
      <P m="stone" s={[0.1, 0.04, 0.04]} />
      {spire(-0.04, 0, 0.1)}
      {spire(-0.013, 0, 0.12)}
      {spire(0.013, 0, 0.12)}
      {spire(0.04, 0, 0.1)}
      {spire(0, 0.014, 0.17)}
    </group>
  );
}

function Parthenon() {
  const cols = Array.from({ length: 6 }, (_, i) => -0.05 + i * 0.02);
  return (
    <group>
      <P m="marble" s={[0.13, 0.014, 0.075]} />
      {cols.flatMap((x) => [0.028, -0.028].map((z) => <P key={`${x}${z}`} g="cyl" m="white" p={[x, 0.014, z]} s={[0.006, 0.05, 0.006]} />))}
      <P m="marble" p={[0, 0.064, 0]} s={[0.13, 0.008, 0.075]} />
      <P g="cone" m="marble" p={[0, 0.072, 0]} s={[0.04, 0.022, 0.065]} r={[0, Math.PI / 2, 0]} />
    </group>
  );
}

function Basil() {
  const dome = (x: number, z: number, h: number, mat: Mat, r: number) => (
    <group key={`${x}${z}`}>
      <P g="cyl" m="stone" p={[x, 0, z]} s={[r, h, r]} />
      <P g="sph" m={mat} p={[x, h, z]} s={[r * 1.25, r * 1.6, r * 1.25]} />
      <P g="cone" m="gold" p={[x, h + r * 3.2, z]} s={[r * 0.15, r * 1.2, r * 0.15]} />
    </group>
  );
  return (
    <group>
      {dome(0, 0, 0.09, "basil", 0.016)}
      {dome(0.032, 0.01, 0.04, "green", 0.012)}
      {dome(-0.032, 0.01, 0.04, "blue", 0.012)}
      {dome(0, 0.034, 0.04, "yellow", 0.012)}
      {dome(0, -0.034, 0.04, "teal", 0.012)}
    </group>
  );
}

function Liberty() {
  return (
    <group>
      <P m="stone" s={[0.05, 0.03, 0.05]} />
      <Taper rb={0.02} rt={0.014} h={0.025} m="stone" p={[0, 0.03, 0]} />
      <Taper rb={0.018} rt={0.012} h={0.06} m="green" p={[0, 0.055, 0]} />
      <P g="sph" m="green" p={[0, 0.115, 0]} s={[0.011, 0.011, 0.011]} />
      <P m="green" p={[0.012, 0.11, 0]} s={[0.006, 0.04, 0.006]} r={[0, 0, -0.35]} />
      <P g="cone" m="gold" p={[0.026, 0.15, 0]} s={[0.006, 0.02, 0.006]} />
    </group>
  );
}

function GoldenGate() {
  return (
    <group>
      <P m="orange" p={[-0.06, 0, 0]} s={[0.012, 0.12, 0.016]} />
      <P m="orange" p={[0.06, 0, 0]} s={[0.012, 0.12, 0.016]} />
      <P m="orange" p={[0, 0.02, 0]} s={[0.17, 0.008, 0.02]} />
      <P m="orange" p={[-0.03, 0.12, 0]} s={[0.08, 0.004, 0.004]} r={[0, 0, -0.5]} />
      <P m="orange" p={[0.03, 0.12, 0]} s={[0.08, 0.004, 0.004]} r={[0, 0, 0.5]} />
      <P m="orange" p={[-0.12, 0.02, 0]} s={[0.08, 0.004, 0.004]} r={[0, 0, 0.32]} />
      <P m="orange" p={[0.12, 0.02, 0]} s={[0.08, 0.004, 0.004]} r={[0, 0, -0.32]} />
    </group>
  );
}

function Christ() {
  return (
    <group>
      <Taper rb={0.06} rt={0.03} h={0.04} m="rock" />
      <P m="stone" p={[0, 0.04, 0]} s={[0.022, 0.03, 0.022]} />
      <Taper rb={0.011} rt={0.009} h={0.06} m="white" p={[0, 0.07, 0]} />
      <P m="white" p={[0, 0.115, 0]} s={[0.09, 0.012, 0.012]} />
      <P g="sph" m="white" p={[0, 0.128, 0]} s={[0.009, 0.009, 0.009]} />
    </group>
  );
}

function Machu() {
  return (
    <group>
      <Taper rb={0.075} rt={0.05} h={0.03} m="grass" />
      <Taper rb={0.055} rt={0.04} h={0.03} m="stone" p={[0, 0.03, 0]} />
      <Taper rb={0.042} rt={0.03} h={0.03} m="grass" p={[0, 0.06, 0]} />
      <P m="stone" p={[0.012, 0.09, 0]} s={[0.022, 0.012, 0.016]} />
      <P g="cone" m="rock" p={[-0.045, 0, -0.03]} s={[0.04, 0.12, 0.04]} />
    </group>
  );
}

function Moai() {
  return (
    <group>
      <P m="rock" s={[0.034, 0.1, 0.03]} />
      <P m="rock" p={[0, 0.08, 0.012]} s={[0.034, 0.012, 0.018]} />
      <P m="rock" p={[0, 0.045, 0.014]} s={[0.01, 0.03, 0.012]} />
      <P m="dark" p={[0, 0.062, 0.014]} s={[0.026, 0.006, 0.006]} />
    </group>
  );
}

function Chichen() {
  return (
    <group>
      {[0.1, 0.08, 0.06, 0.04].map((w, i) => (
        <P key={w} m="stone" p={[0, i * 0.022, 0]} s={[w, 0.022, w]} />
      ))}
      <P m="sand" p={[0, 0.088, 0]} s={[0.026, 0.02, 0.026]} />
    </group>
  );
}

function Pyramids() {
  return (
    <group>
      <P g="cone" m="sand" p={[0, 0, 0]} s={[0.06, 0.1, 0.06]} r={[0, Math.PI / 4, 0]} />
      <P g="cone" m="sand" p={[0.07, 0, 0.04]} s={[0.045, 0.075, 0.045]} r={[0, Math.PI / 4, 0]} />
      <P g="cone" m="sand" p={[-0.065, 0, 0.05]} s={[0.03, 0.05, 0.03]} r={[0, Math.PI / 4, 0]} />
    </group>
  );
}

function Mesa() {
  return (
    <group>
      <Taper rb={0.09} rt={0.055} h={0.07} m="rock" />
      <Taper rb={0.055} rt={0.05} h={0.01} m="grass" p={[0, 0.07, 0]} />
    </group>
  );
}

function Volcano() {
  return (
    <group>
      <P g="cone" m="rock" s={[0.07, 0.11, 0.07]} />
      <P g="cone" m="snow" p={[0, 0.07, 0]} s={[0.032, 0.04, 0.032]} />
    </group>
  );
}

function Dome() {
  const minaret = (x: number, z: number) => (
    <group key={`${x}${z}`}>
      <Taper rb={0.008} rt={0.006} h={0.09} m="white" p={[x, 0, z]} />
      <P g="cone" m="white" p={[x, 0.09, z]} s={[0.009, 0.02, 0.009]} />
    </group>
  );
  return (
    <group>
      <P m="white" s={[0.08, 0.03, 0.08]} />
      <P m="white" p={[0, 0.03, 0]} s={[0.05, 0.03, 0.05]} />
      <P g="half" m="white" p={[0, 0.06, 0]} s={[0.032, 0.04, 0.032]} />
      <P g="cone" m="gold" p={[0, 0.1, 0]} s={[0.003, 0.016, 0.003]} />
      {minaret(0.05, 0.05)}
      {minaret(-0.05, 0.05)}
      {minaret(0.05, -0.05)}
      {minaret(-0.05, -0.05)}
    </group>
  );
}

function Wall() {
  const towers: number[] = [-0.08, -0.02, 0.05, 0.11];
  return (
    <group>
      <P m="sand" p={[-0.12, 0, 0]} s={[0.07, 0.03, 0.014]} r={[0, 0, 0.5]} />
      <P m="sand" p={[-0.055, 0.03, 0]} s={[0.07, 0.028, 0.014]} r={[0, 0, -0.35]} />
      <P m="sand" p={[0.005, 0.02, 0]} s={[0.07, 0.028, 0.014]} r={[0, 0, 0.4]} />
      <P m="sand" p={[0.07, 0.05, 0]} s={[0.07, 0.028, 0.014]} r={[0, 0, -0.3]} />
      {towers.map((x, i) => (
        <P key={x} m="stone" p={[x, 0.03 + (i % 2) * 0.03, 0]} s={[0.018, 0.03, 0.02]} />
      ))}
    </group>
  );
}

function Angkor() {
  const tower = (x: number, z: number, h: number) => (
    <group key={`${x}${z}`}>
      <Taper rb={0.014} rt={0.008} h={h} m="sand" p={[x, 0.02, z]} />
      <P g="cone" m="sand" p={[x, 0.02 + h, z]} s={[0.009, 0.03, 0.009]} />
    </group>
  );
  return (
    <group>
      <P m="stone" s={[0.11, 0.02, 0.11]} />
      {tower(0, 0, 0.08)}
      {tower(0.036, 0.036, 0.05)}
      {tower(-0.036, 0.036, 0.05)}
      {tower(0.036, -0.036, 0.05)}
      {tower(-0.036, -0.036, 0.05)}
    </group>
  );
}

function Petronas() {
  return (
    <group>
      {[-0.022, 0.022].map((x) => (
        <group key={x}>
          <Taper rb={0.018} rt={0.014} h={0.12} m="steel" p={[x, 0, 0]} sides={8} />
          <Taper rb={0.012} rt={0.006} h={0.03} m="steel" p={[x, 0.12, 0]} sides={8} />
          <P g="cone" m="steel" p={[x, 0.15, 0]} s={[0.003, 0.03, 0.003]} />
        </group>
      ))}
      <P m="steel" p={[0, 0.07, 0]} s={[0.03, 0.006, 0.006]} />
    </group>
  );
}

function Burj() {
  return (
    <group>
      <Taper rb={0.026} rt={0.018} h={0.07} m="glass" sides={6} />
      <Taper rb={0.018} rt={0.011} h={0.06} m="glass" p={[0, 0.07, 0]} sides={6} />
      <Taper rb={0.011} rt={0.005} h={0.05} m="glass" p={[0, 0.13, 0]} sides={6} />
      <P g="cone" m="steel" p={[0, 0.18, 0]} s={[0.004, 0.06, 0.004]} />
    </group>
  );
}

function Mbs() {
  return (
    <group>
      {[-0.036, 0, 0.036].map((x) => (
        <Taper key={x} rb={0.014} rt={0.012} h={0.08} m="glass" p={[x, 0, 0]} sides={6} />
      ))}
      <P m="white" p={[0, 0.08, 0]} s={[0.15, 0.008, 0.026]} />
      <P m="teal" p={[0.04, 0.088, 0]} s={[0.05, 0.003, 0.02]} />
    </group>
  );
}

function Opera() {
  const shell = (x: number, s: number, rot: number) => (
    <P key={x} g="half" m="white" p={[x, 0.008, 0]} s={[s, s * 1.2, s * 0.7]} r={[0, 0, rot]} />
  );
  return (
    <group>
      <P m="stone" s={[0.14, 0.008, 0.06]} />
      {shell(-0.04, 0.034, 0.5)}
      {shell(0, 0.044, 0.35)}
      {shell(0.04, 0.034, 0.2)}
    </group>
  );
}

function Pagoda() {
  return (
    <group>
      {[0.06, 0.046, 0.032].map((w, i) => (
        <group key={w}>
          <P m="gold" p={[0, i * 0.032, 0]} s={[w * 0.7, 0.022, w * 0.7]} />
          <P g="cone" m="dark" p={[0, 0.022 + i * 0.032, 0]} s={[w * 0.9, 0.01, w * 0.9]} r={[0, Math.PI / 4, 0]} />
        </group>
      ))}
      <P g="cone" m="gold" p={[0, 0.1, 0]} s={[0.004, 0.025, 0.004]} />
    </group>
  );
}

function Petra() {
  return (
    <group>
      <P m="rose" s={[0.07, 0.09, 0.03]} />
      <P m="rose" p={[0, 0.09, 0]} s={[0.05, 0.03, 0.026]} />
      {[-0.022, -0.007, 0.007, 0.022].map((x) => (
        <P key={x} g="cyl" m="stone" p={[x, 0.006, 0.018]} s={[0.004, 0.05, 0.004]} />
      ))}
      <P m="dark" p={[0, 0.006, 0.0155]} s={[0.016, 0.034, 0.002]} />
    </group>
  );
}

function Uluru() {
  return <P g="half" m="uluru" s={[0.09, 0.055, 0.045]} />;
}

const MODELS: Record<LandmarkModel, () => JSX.Element> = {
  eiffel: Eiffel,
  bigben: BigBen,
  colosseum: Colosseum,
  sagrada: Sagrada,
  parthenon: Parthenon,
  basil: Basil,
  liberty: Liberty,
  goldengate: GoldenGate,
  christ: Christ,
  machu: Machu,
  moai: Moai,
  chichen: Chichen,
  pyramids: Pyramids,
  mesa: Mesa,
  volcano: Volcano,
  dome: Dome,
  wall: Wall,
  angkor: Angkor,
  petronas: Petronas,
  burj: Burj,
  mbs: Mbs,
  opera: Opera,
  pagoda: Pagoda,
  petra: Petra,
  uluru: Uluru,
};

export function LandmarkModelMesh({ model }: { model: LandmarkModel }) {
  const Model = MODELS[model];
  return <Model />;
}
