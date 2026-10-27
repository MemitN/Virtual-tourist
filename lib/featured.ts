import { buildPlaceSlug } from "@/lib/place-slug";

export type Region = "Africa" | "Asia" | "Europe" | "Americas" | "Oceania" | "Middle East";

export interface FeaturedPlace {
  slug: string;
  name: string;
  country: string;
  region: Region;
  lat: number;
  lng: number;
}

type Seed = [name: string, country: string, cc: string, region: Region, lat: number, lng: number, curatedSlug?: string];

const SEEDS: readonly Seed[] = [
  ["Paris", "France", "fr", "Europe", 48.857, 2.352, "paris"],
  ["Tokyo", "Japan", "jp", "Asia", 35.69, 139.692, "tokyo"],
  ["Marrakech", "Morocco", "ma", "Africa", 31.629, -7.981, "marrakech"],
  ["Kyoto", "Japan", "jp", "Asia", 35.012, 135.768, "kyoto"],
  ["Lisbon", "Portugal", "pt", "Europe", 38.722, -9.139, "lisbon"],
  ["Cape Town", "South Africa", "za", "Africa", -33.925, 18.424, "cape-town"],
  ["Nairobi", "Kenya", "ke", "Africa", -1.286, 36.817],
  ["Zanzibar", "Tanzania", "tz", "Africa", -6.165, 39.202],
  ["Cairo", "Egypt", "eg", "Africa", 30.044, 31.236],
  ["Lagos", "Nigeria", "ng", "Africa", 6.524, 3.379],
  ["Accra", "Ghana", "gh", "Africa", 5.604, -0.187],
  ["Addis Ababa", "Ethiopia", "et", "Africa", 9.03, 38.74],
  ["Kigali", "Rwanda", "rw", "Africa", -1.944, 30.062],
  ["Bangkok", "Thailand", "th", "Asia", 13.756, 100.502],
  ["Seoul", "South Korea", "kr", "Asia", 37.566, 126.978],
  ["Bali", "Indonesia", "id", "Asia", -8.409, 115.189],
  ["Mumbai", "India", "in", "Asia", 19.076, 72.878],
  ["Singapore", "Singapore", "sg", "Asia", 1.352, 103.82],
  ["Hanoi", "Vietnam", "vn", "Asia", 21.028, 105.835],
  ["Istanbul", "Türkiye", "tr", "Europe", 41.008, 28.978],
  ["Rome", "Italy", "it", "Europe", 41.903, 12.496],
  ["Barcelona", "Spain", "es", "Europe", 41.389, 2.159],
  ["Reykjavík", "Iceland", "is", "Europe", 64.147, -21.942],
  ["Prague", "Czechia", "cz", "Europe", 50.088, 14.42],
  ["Santorini", "Greece", "gr", "Europe", 36.393, 25.462],
  ["Edinburgh", "United Kingdom", "gb", "Europe", 55.953, -3.188],
  ["New York", "United States", "us", "Americas", 40.713, -74.006],
  ["Rio de Janeiro", "Brazil", "br", "Americas", -22.907, -43.173],
  ["Mexico City", "Mexico", "mx", "Americas", 19.433, -99.133],
  ["Cusco", "Peru", "pe", "Americas", -13.532, -71.967],
  ["Vancouver", "Canada", "ca", "Americas", 49.283, -123.121],
  ["Buenos Aires", "Argentina", "ar", "Americas", -34.604, -58.382],
  ["Sydney", "Australia", "au", "Oceania", -33.869, 151.209],
  ["Queenstown", "New Zealand", "nz", "Oceania", -45.031, 168.663],
  ["Dubai", "United Arab Emirates", "ae", "Middle East", 25.205, 55.271],
  ["Petra", "Jordan", "jo", "Middle East", 30.329, 35.444],
];

export const FEATURED_PLACES: readonly FeaturedPlace[] = SEEDS.map(
  ([name, country, cc, region, lat, lng, curatedSlug]) => ({
    slug: curatedSlug ?? buildPlaceSlug({ name, countryCode: cc, lat, lng }),
    name,
    country,
    region,
    lat,
    lng,
  }),
);

export const REGIONS: readonly Region[] = ["Africa", "Asia", "Europe", "Americas", "Oceania", "Middle East"];

export function randomFeatured(excludeSlug?: string): FeaturedPlace {
  const pool = FEATURED_PLACES.filter((p) => p.slug !== excludeSlug);
  return pool[Math.floor(Math.random() * pool.length)] ?? FEATURED_PLACES[0]!;
}
