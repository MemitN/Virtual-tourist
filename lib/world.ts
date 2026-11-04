import { cache } from "react";
import { z } from "zod";
import { getDestination } from "@/lib/destinations";
import { pickGuide } from "@/lib/guides";
import {
  buildPlaceSlug,
  parsePlaceSlug,
  regionName,
  slugifyName,
  timezoneFromLongitude,
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
const USER_AGENT = "Virtual-Tourist/1.0 (hackathon demo)";
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
  originalimage: z.object({ source: z.string().url(), width: z.number() }).optional(),
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

const nearbyImagesSchema = z.object({
  query: z
    .object({
      pages: z.record(
        z.object({
          title: z.string(),
          index: z.number().optional(),
          thumbnail: z.object({ source: z.string().url(), width: z.number() }).optional(),
        }),
      ),
    })
    .optional(),
});

const timezoneSchema = z.object({ timezone: z.string() });

async function getJson(url: string, revalidate: number): Promise<unknown> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(3500),
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
  return result.success ? result.data.timezone : timezoneFromLongitude(lng);
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

/** Wikipedia page for "Name" or, when that is a different place, "Name, Region" (e.g. Indiana, Pennsylvania). */
async function lookupWikiSmart(
  name: string,
  region: string | undefined,
  lat: number,
  lng: number,
): Promise<z.infer<typeof wikiSummarySchema> | null> {
  const direct = await lookupWiki(name, lat, lng);
  if (direct?.thumbnail || direct?.originalimage) return direct;
  const withRegion = region && region !== name ? await lookupWiki(`${name}, ${region}`, lat, lng) : null;
  return withRegion ?? direct;
}

/** A photo of something nearby (closest first) when the place's own page has none. */
async function lookupNearbyPhoto(lat: number, lng: number): Promise<{ hero: string; card: string } | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&generator=geosearch&ggscoord=${lat}%7C${lng}&ggsradius=10000&ggslimit=20&prop=pageimages&piprop=thumbnail&pithumbsize=1280&format=json`;
  const result = nearbyImagesSchema.safeParse(await getJson(url, ONE_DAY));
  if (!result.success) return null;
  const pages = Object.values(result.data.query?.pages ?? {}).sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  for (const page of pages) {
    const source = page.thumbnail?.source;
    if (!source || /\.svg(\/|$|\?)|\.svg\./i.test(source)) continue; // flags, maps and logos make poor heroes
    try {
      const hero = new URL(source);
      if (!/(^|\.)wikimedia\.org$/.test(hero.hostname)) continue;
      hero.search = "";
      const card = new URL(hero.toString());
      card.pathname = card.pathname.replace(/\/\d+px-/, "/500px-");
      return { hero: hero.toString(), card: card.toString() };
    } catch {
      continue;
    }
  }
  return null;
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

/**
 * Picks a Wikimedia photo at (up to) the wanted width. Wikimedia refuses thumbnails larger than the
 * original, so small originals are used as-is. Only wikimedia.org hosts are accepted (they are the
 * hosts next/image is configured for) and tracking query strings are dropped.
 */
function wikiImage(wiki: z.infer<typeof wikiSummarySchema> | null, width: number): string | null {
  const thumb = wiki?.thumbnail?.source;
  const original = wiki?.originalimage;
  try {
    let source = thumb;
    if (original && original.width <= width) source = original.source;
    else if (thumb) source = thumb.replace(/\/\d+px-/, `/${width}px-`);
    if (!source) return null;
    const url = new URL(source);
    if (!/(^|\.)wikimedia\.org$/.test(url.hostname)) return null;
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
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
    lookupWikiSmart(name, geo?.admin1, lat, lng),
    lookupLandmarks(name, lat, lng),
  ]);
  const ownHero = wikiImage(wiki, 1280);
  const nearby = ownHero ? null : await lookupNearbyPhoto(lat, lng);

  const country = geo?.country ?? regionName(parsed.countryCode);
  const region = geo?.admin1 && geo.admin1 !== name ? `, ${geo.admin1}` : "";
  const hue = scenicHue(slug);

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
    heroImage: ownHero ?? nearby?.hero ?? scenicSvg(slug, 1600, 900),
    cardImage: wikiImage(wiki, 500) ?? nearby?.card ?? scenicSvg(slug, 800, 1000),
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

const RESOLVE_BUDGET_MS = 9000;
const RESOLVE_TTL_MS = 10 * 60_000;
const RESOLVE_DEGRADED_TTL_MS = 30_000;
const RESOLVE_MAX_ENTRIES = 200;
const resolved = new Map<string, { value: Destination; expires: number }>();
const inFlight = new Map<string, Promise<Destination>>();

/** Minimal place built from the slug alone, used when the web lookups are too slow. */
async function buildFallbackDestination(slug: string, parsed: ParsedPlaceSlug): Promise<Destination> {
  const name = titleCase(parsed.nameSlug);
  const timezone = await lookupTimezone(parsed.lat, parsed.lng);
  return {
    slug,
    name,
    country: regionName(parsed.countryCode),
    tagline: `Discover ${name} through the eyes of a local.`,
    description: `${name} is a place in ${regionName(parsed.countryCode)}. Take a 360° look around, ask your guide what locals love, and see what the weather is doing there right now.`,
    timezone,
    lat: parsed.lat,
    lng: parsed.lng,
    starterQuestions: [
      `What should I do first in ${name}?`,
      `Where do locals eat in ${name}?`,
      `What's the best time of year to visit ${name}?`,
      `What are some hidden gems in ${name}?`,
    ],
    heroImage: scenicSvg(slug, 1600, 900),
    cardImage: scenicSvg(slug, 800, 1000),
    gradient: scenicGradient(slug),
    accent: `hsl(${scenicHue(slug)} 80% 60%)`,
    bestTime: "Ask your guide for the best season",
    currency: "Ask your guide",
    language: "Ask your guide",
    pois: [],
    ambientAudioUrl: null,
    guide: pickGuide(slug, parsed.countryCode),
    custom: true,
  };
}

function remember(slug: string, value: Destination, ttl: number): void {
  if (resolved.size >= RESOLVE_MAX_ENTRIES) {
    const oldest = resolved.keys().next().value;
    if (oldest !== undefined) resolved.delete(oldest);
  }
  resolved.set(slug, { value, expires: Date.now() + ttl });
}

async function resolveCustom(slug: string, parsed: ParsedPlaceSlug): Promise<Destination> {
  const hit = resolved.get(slug);
  if (hit && hit.expires > Date.now()) return hit.value;

  const pending = inFlight.get(slug);
  if (pending) return pending;

  const task = (async (): Promise<Destination> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), RESOLVE_BUDGET_MS);
    });
    try {
      const full = await Promise.race([buildCustomDestination(slug, parsed).catch(() => null), timeout]);
      if (full) {
        remember(slug, full, RESOLVE_TTL_MS);
        return full;
      }
      const degraded = await buildFallbackDestination(slug, parsed);
      remember(slug, degraded, RESOLVE_DEGRADED_TTL_MS);
      return degraded;
    } finally {
      if (timer) clearTimeout(timer);
      inFlight.delete(slug);
    }
  })();
  inFlight.set(slug, task);
  return task;
}

/**
 * Resolves a curated slug instantly, or any world-place slug via the web.
 * Memoized per request (React cache), shared across requests for 10 minutes, concurrent callers
 * share one lookup, and the whole build is capped so a slow upstream can't stall a page or chat.
 */
export const resolveDestination = cache(async (slug: string): Promise<Destination | null> => {
  const known = getDestination(slug);
  if (known) return known;
  const parsed = parsePlaceSlug(slug);
  if (!parsed) return null;
  return resolveCustom(slug, parsed);
});
