/**
 * Procedural scenery used whenever a place has no photo (or a photo fails).
 * Pure and deterministic, so server and client always agree.
 */
function hash(seed: string): number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function scenicHue(seed: string): number {
  return hash(seed) % 360;
}

export function scenicGradient(seed: string): string {
  const h = scenicHue(seed);
  return `linear-gradient(135deg, hsl(${h} 55% 16%) 0%, hsl(${(h + 50) % 360} 80% 52%) 100%)`;
}

export function scenicSvg(seed: string, width = 1600, height = 900): string {
  const h = hash(seed);
  const hue1 = h % 360;
  const hue2 = (hue1 + 45 + ((h >> 8) % 70)) % 360;
  const rand = rng(h);

  const stars = Array.from({ length: 50 }, () => {
    const x = Math.round(rand() * width);
    const y = Math.round(rand() * height * 0.4);
    return `<circle cx="${x}" cy="${y}" r="${(rand() * 1.6 + 0.4).toFixed(1)}" fill="#fff" opacity="${(rand() * 0.6 + 0.2).toFixed(2)}"/>`;
  }).join("");

  const ridges = [0, 1, 2]
    .map((i) => {
      const base = height * (0.6 + i * 0.1);
      const step = width / 12;
      let d = `M0 ${height} L0 ${Math.round(base)}`;
      for (let x = step; x <= width + step; x += step) {
        d += ` L${Math.round(x)} ${Math.round(base - rand() * height * (0.14 - i * 0.03))}`;
      }
      d += ` L${width} ${height} Z`;
      return `<path d="${d}" fill="hsl(${hue1} ${45 - i * 8}% ${16 - i * 4}%)"/>`;
    })
    .join("");

  const sunX = Math.round(width * (0.25 + rand() * 0.5));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue1} 60% 12%)"/>` +
    `<stop offset="0.7" stop-color="hsl(${hue2} 85% 55%)"/></linearGradient></defs>` +
    `<rect width="${width}" height="${height}" fill="url(#s)"/>${stars}` +
    `<circle cx="${sunX}" cy="${Math.round(height * 0.55)}" r="${Math.round(height * 0.09)}" fill="hsl(${hue2} 95% 78%)" opacity="0.92"/>` +
    `${ridges}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
