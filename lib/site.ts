export const SITE_NAME = "AI Virtual Tourism";
export const SITE_TAGLINE = "Real Places. AI Guides. Infinite Experiences.";
export const SITE_DESCRIPTION =
  "Explore any place on Earth with an AI local guide, 360° tours and travelers in shared real-time rooms.";

/** Absolute site origin for sitemap/robots. Set NEXT_PUBLIC_SITE_URL in production; Vercel's URL is the fallback. */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
