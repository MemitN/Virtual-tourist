import { getDestination, isDestinationSlug } from "@/lib/destinations";
import { scenicGradient, scenicSvg } from "@/lib/scenic";
import type { DestinationCardData } from "@/lib/types";

/*
  Any place on Earth is addressable by slug: "<name>~<cc>~<lat>~<lng>", e.g. "nairobi~ke~-1.286~36.817".
  The slug carries everything needed to rebuild the place, so favorites, rooms and shared
  links work with no database of places. Pure and client-safe (no fetching here).
*/
const PLACE_SLUG = /^([a-z0-9-]{1,36})~([a-z]{2})~(-?\d{1,2}(?:\.\d{1,3})?)~(-?\d{1,3}(?:\.\d{1,3})?)$/;

export interface ParsedPlaceSlug {
  nameSlug: string;
  countryCode: string;
  lat: number;
  lng: number;
}

export function slugifyName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36)
    .replace(/-+$/g, "");
  return slug || "place";
}

export function buildPlaceSlug(place: {
  name: string;
  countryCode?: string | null;
  lat: number;
  lng: number;
}): string {
  const cc = /^[a-z]{2}$/i.test(place.countryCode ?? "") ? (place.countryCode as string).toLowerCase() : "zz";
  return `${slugifyName(place.name)}~${cc}~${place.lat.toFixed(3)}~${place.lng.toFixed(3)}`;
}

export function parsePlaceSlug(slug: string): ParsedPlaceSlug | null {
  const match = PLACE_SLUG.exec(slug);
  if (!match) return null;
  const [, nameSlug, countryCode, latText, lngText] = match;
  const lat = Number(latText);
  const lng = Number(lngText);
  if (!nameSlug || !countryCode || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { nameSlug, countryCode, lat, lng };
}

export function isValidSlug(slug: string): boolean {
  return isDestinationSlug(slug) || parsePlaceSlug(slug) !== null;
}

export function titleCase(nameSlug: string): string {
  return nameSlug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function regionName(countryCode: string): string {
  if (countryCode.toLowerCase() === "zz") return "Somewhere on Earth";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode.toUpperCase()) ?? countryCode.toUpperCase();
  } catch {
    return countryCode.toUpperCase();
  }
}

/** Enough to draw a card for any slug without a network call (used by favorites). */
export function summaryFromSlug(slug: string): DestinationCardData | null {
  const known = getDestination(slug);
  if (known) return known;
  const parsed = parsePlaceSlug(slug);
  if (!parsed) return null;
  const name = titleCase(parsed.nameSlug);
  return {
    slug,
    name,
    country: regionName(parsed.countryCode),
    tagline: `Explore ${name} with a local AI guide.`,
    cardImage: scenicSvg(slug, 800, 1000),
    gradient: scenicGradient(slug),
  };
}
