import { cache } from "react";
import { z } from "zod";
import { getDestination } from "@/lib/destinations";
import { pickGuide } from "@/lib/guides";
import {
  buildPlaceSlug,
  parsePlaceSlug,
  regionName,
  slugifyName,
  titleCase,
  type ParsedPlaceSlug,
} from "@/lib/place-slug";
import { scenicGradient, scenicHue, scenicSvg } from "@/lib/scenic";
import type { Destination, PlaceSearchResult, PointOfInterest } from "@/lib/types";

/*
  SERVER ONLY. Turns any coordinates on Earth into a full Destination using free, keyless services:
  Open-Meteo (geocoding + timezone), and Wikipedia (summary, photo, nearby landmarks).
  Every call is time-boxed and cached, and every field has a graceful fallback, so a slow or
  missing service never breaks a page.
*/
const USER_AGENT = "AI-Virtual-Tourism/1.0 (hackathon demo)";
const ONE_DAY = 86_400;

const geoResultSchema = z.object({
  name: z.string(),
  country: z.string().optional(),
  country_code: z.string().optional(),
  admin1: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string().optional(),
});
const geoResponseSchema = z.object({ results: z.array(geoResultSchema).optional() });

const wikiSummarySchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  extract: z.string().optional(),
  thumbnail: z.object({ source: z.string().url() }).optional(),
  coordinates: z.object({ lat: z.number(), lon: z.number() }).optional(),
  content_urls: z.object({ desktop: z.object({ page: z.string().url() }) }).optional(),
});

const geosearchSchema = z.object({
  query: z.object({
    geosearch: z.array(
      z.object({ title: z.string(), lat: z.number(), lon: z.number(), dist: z.number() }),
    ),
  }),
});

const timezoneSchema = z.object({ timezone: z.string() });

async function getJson(url: string, revalidate: number): Promise<unknown> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
      next: { revalidate },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Compass bearing in degrees (0 = north) from point 1 to point 2. */
function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"] as const;
function compassWord(bearing: number): string {
  return COMPASS[Math.round(bearing / 45) % 8] ?? "north";
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchPlaces(query: string, count = 8): Promise<PlaceSearchResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=${count}&language=en&format=json`;
  const parsed = geoResponseSchema.safeParse(await getJson(url, 3600));
  if (!parsed.success) return [];

  const seen = new Set<string>();
  const results: PlaceSearchResult[] = [];
  for (const r of parsed.data.results ?? []) {
    const countryCode = (r.country_code ?? "zz").toLowerCase();
    const slug = buildPlaceSlug({ name: r.name, countryCode, lat: r.latitude, lng: r.longitude });
    if (seen.has(slug)) continue;
    seen.add(slug);
    results.push({
      slug,
      name: r.name,
      country: r.country ?? regionName(countryCode),
      countryCode,
      region: r.admin1 ?? null,
      lat: r.latitude,
      lng: r.longitude,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Resolve a slug into a full Destination
// ---------------------------------------------------------------------------

type GeoMatch = z.infer<typeof geoResultSchema> | null;

async function lookupGeo(parsed: ParsedPlaceSlug): Promise<GeoMatch> {
  const query = parsed.nameSlug.replace(/-/g, " ");
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=en&format=json`;
  const result = geoResponseSchema.safeParse(await getJson(url, ONE_DAY));
  if (!result.success) return null;

  let best: GeoMatch = null;
  let bestDistance = 60; // km: anything farther is a different place with the same name
  for (const candidate of result.data.results ?? []) {
    const d = distanceKm(parsed.lat, parsed.lng, candidate.latitude, candidate.longitude);
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best;
}

async function lookupTimezone(lat: number, lng: number): Promise<string> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m&timezone=auto`;
  const result = timezoneSchema.safeParse(await getJson(url, ONE_DAY));
  return result.success ? result.data.timezone : "UTC";
}

async function lookupWiki(
  name: string,
  lat: number,
  lng: number,
): Promise<z.infer<typeof wikiSummarySchema> | null> {
  const title = encodeURIComponent(name.replace(/ /g, "_"));
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}?redirect=true`;
  const result = wikiSummarySchema.safeParse(await getJson(url, ONE_DAY));
  if (!result.success) return null;
  const { coordinates } = result.data;
  // Same name, different place (Paris, Texas)? Discard rather than show the wrong city.
  if (coordinates && distanceKm(lat, lng, coordinates.lat, coordinates.lon) > 80) return null;
  return result.data;
}

async function lookupLandmarks(name: string, lat: number, lng: number): Promise<PointOfInterest[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}%7C${lng}&gsradius=10000&gslimit=20&format=json`;
  const result = geosearchSchema.safeParse(await getJson(url, ONE_DAY));
  if (!result.success) return [];

  const lowerName = name.toLowerCase();
  const pois: PointOfInterest[] = [];
  const used = new Set<string>();
  for (const item of result.data.query.geosearch) {
    const title = item.title;
    const lower = title.toLowerCase();
    if (lower === lowerName || lower.startsWith("list of")) continue;
    const id = slugifyName(title);
    if (used.has(id)) continue;
    used.add(id);

    const bearing = bearingDeg(lat, lng, item.lat, item.lon);
    const yaw = ((bearing + 540) % 360) - 180;
    const km = item.dist / 1000;
    const away = km < 1 ? `${Math.round(item.dist)} m` : `${km.toFixed(1)} km`;
    pois.push({
      id,
      label: title,
      description: `${away} ${compassWord(bearing)} of the centre. Ask your guide what it's like.`,
      yaw: Math.round(yaw),
      pitch: used.size % 2 === 0 ? 4 : 9,
    });
    if (pois.length >= 6) break;
  }
  return pois;
}

function resizeWikimedia(source: string, width: number): string {
  return source.replace(/\/\d+px-/, `/${width}px-`);
}

function firstSentences(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "));
  return lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : `${cut.trimEnd()}…`;
}

async function buildCustomDestination(slug: string, parsed: ParsedPlaceSlug): Promise<Destination> {
  const geo = await lookupGeo(parsed);
  const name = geo?.name ?? titleCase(parsed.nameSlug);
  const lat = geo?.latitude ?? parsed.lat;
  const lng = geo?.longitude ?? parsed.lng;

  const [timezone, wiki, pois] = await Promise.all([
    geo?.timezone ? Promise.resolve(geo.timezone) : lookupTimezone(lat, lng),
    lookupWiki(name, lat, lng),
    lookupLandmarks(name, lat, lng),
  ]);

  const country = geo?.country ?? regionName(parsed.countryCode);
  const region = geo?.admin1 && geo.admin1 !== name ? `, ${geo.admin1}` : "";
  const hue = scenicHue(slug);
  const thumb = wiki?.thumbnail?.source;

  const tagline = wiki?.description
    ? `${wiki.description.charAt(0).toUpperCase()}${wiki.description.slice(1)}.`
    : `Discover ${name}${region} through the eyes of a local.`;
  const description = wiki?.extract
    ? firstSentences(wiki.extract, 460)
    : `${name} is a place in ${country}${region}. Take a 360° look around, ask your guide what locals love, and see what the weather is doing there right now.`;

  const starterQuestions = [
    `What should I do first in ${name}?`,
    `Where do locals eat in ${name}?`,
    `What's the best time of year to visit ${name}?`,
    pois[0] ? `Tell me about ${pois[0].label}.` : `What are some hidden gems in ${name}?`,
  ];

  return {
    slug,
    name,
    country,
    tagline,
    description,
    timezone,
    lat,
    lng,
    starterQuestions,
    heroImage: thumb ? resizeWikimedia(thumb, 1280) : scenicSvg(slug, 1600, 900),
    cardImage: thumb ? resizeWikimedia(thumb, 640) : scenicSvg(slug, 800, 1000),
    gradient: scenicGradient(slug),
    accent: `hsl(${hue} 80% 60%)`,
    bestTime: "Ask your guide for the best season",
    currency: "Ask your guide",
    language: "Ask your guide",
    pois,
    ambientAudioUrl: null,
    guide: pickGuide(slug, parsed.countryCode),
    custom: true,
    source: wiki?.content_urls
      ? { label: "Wikipedia", url: wiki.content_urls.desktop.page }
      : undefined,
  };
}

/**
 * Resolves a curated slug instantly, or any world-place slug via the web.
 * Memoized per request so generateMetadata and the page share one lookup.
 */
export const resolveDestination = cache(async (slug: string): Promise<Destination | null> => {
  const known = getDestination(slug);
  if (known) return known;
  const parsed = parsePlaceSlug(slug);
  if (!parsed) return null;
  return buildCustomDestination(slug, parsed);
});
