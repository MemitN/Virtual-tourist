import { FEATURED_PLACES } from "@/lib/featured";
import { buildPlaceSlug } from "@/lib/place-slug";

export type Continent =
  | "North America"
  | "South America"
  | "Europe"
  | "Africa"
  | "Asia"
  | "Oceania"
  | "Antarctica";

/** Which procedural 3D miniature draws this landmark on the globe. */
export type LandmarkModel =
  | "eiffel"
  | "bigben"
  | "colosseum"
  | "sagrada"
  | "parthenon"
  | "basil"
  | "liberty"
  | "goldengate"
  | "christ"
  | "machu"
  | "moai"
  | "chichen"
  | "pyramids"
  | "mesa"
  | "volcano"
  | "dome"
  | "wall"
  | "angkor"
  | "petronas"
  | "burj"
  | "mbs"
  | "opera"
  | "pagoda"
  | "petra"
  | "uluru";

export interface Landmark {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  continent: Continent;
  lat: number;
  lng: number;
  model: LandmarkModel;
  /** Colour of the ground ring and label accent. */
  accent: string;
  blurb: string;
  /** The destination page this landmark opens. */
  city: { name: string; slug: string };
}

type Seed = Omit<Landmark, "city"> & { city: string; cityCoords?: [number, number] };

/** Real coordinates of each landmark. `city` is the destination the landmark opens. */
const SEEDS: readonly Seed[] = [
  // Europe
  { id: "eiffel", name: "Eiffel Tower", country: "France", countryCode: "fr", continent: "Europe", lat: 48.8584, lng: 2.2945, model: "eiffel", accent: "#ffb454", city: "Paris", blurb: "Gustave Eiffel's 330 m iron lattice, built for the 1889 World's Fair." },
  { id: "bigben", name: "Big Ben", country: "United Kingdom", countryCode: "gb", continent: "Europe", lat: 51.5007, lng: -0.1246, model: "bigben", accent: "#f5d06f", city: "London", cityCoords: [51.507, -0.128], blurb: "The Elizabeth Tower and its great bell beside the Thames." },
  { id: "colosseum", name: "Colosseum", country: "Italy", countryCode: "it", continent: "Europe", lat: 41.8902, lng: 12.4922, model: "colosseum", accent: "#e8b27a", city: "Rome", blurb: "Rome's 50,000-seat amphitheatre, still standing after 1,900 years." },
  { id: "sagrada", name: "Sagrada Família", country: "Spain", countryCode: "es", continent: "Europe", lat: 41.4036, lng: 2.1744, model: "sagrada", accent: "#f2c27b", city: "Barcelona", blurb: "Gaudí's unfinished basilica of soaring, organic spires." },
  { id: "parthenon", name: "Parthenon", country: "Greece", countryCode: "gr", continent: "Europe", lat: 37.9715, lng: 23.7257, model: "parthenon", accent: "#f4e3c1", city: "Athens", cityCoords: [37.984, 23.728], blurb: "The marble temple crowning the Acropolis of Athens." },
  { id: "basil", name: "St Basil's Cathedral", country: "Russia", countryCode: "ru", continent: "Europe", lat: 55.7525, lng: 37.6231, model: "basil", accent: "#ff6b6b", city: "Moscow", cityCoords: [55.756, 37.617], blurb: "Colourful onion domes on Red Square." },

  // Africa
  { id: "pyramids", name: "Pyramids of Giza", country: "Egypt", countryCode: "eg", continent: "Africa", lat: 29.9792, lng: 31.1342, model: "pyramids", accent: "#ffd479", city: "Cairo", blurb: "The last surviving wonder of the ancient world." },
  { id: "tablemtn", name: "Table Mountain", country: "South Africa", countryCode: "za", continent: "Africa", lat: -33.9628, lng: 18.4098, model: "mesa", accent: "#7ed6a5", city: "Cape Town", blurb: "A flat-topped sandstone icon above Cape Town's bay." },
  { id: "kilimanjaro", name: "Mount Kilimanjaro", country: "Tanzania", countryCode: "tz", continent: "Africa", lat: -3.0674, lng: 37.3556, model: "volcano", accent: "#bfe9ff", city: "Zanzibar", blurb: "Africa's highest peak at 5,895 m, with a snowcap on the equator." },

  // Asia
  { id: "tajmahal", name: "Taj Mahal", country: "India", countryCode: "in", continent: "Asia", lat: 27.1751, lng: 78.0421, model: "dome", accent: "#ffffff", city: "Agra", cityCoords: [27.1767, 78.0081], blurb: "A white-marble mausoleum built for love in the 1600s." },
  { id: "greatwall", name: "Great Wall of China", country: "China", countryCode: "cn", continent: "Asia", lat: 40.4319, lng: 116.5704, model: "wall", accent: "#d9a066", city: "Beijing", cityCoords: [39.904, 116.407], blurb: "Thousands of kilometres of wall rippling over the mountains." },
  { id: "fuji", name: "Mount Fuji", country: "Japan", countryCode: "jp", continent: "Asia", lat: 35.3606, lng: 138.7274, model: "volcano", accent: "#bfe9ff", city: "Tokyo", blurb: "Japan's sacred, perfectly conical volcano." },
  { id: "kinkakuji", name: "Kinkaku-ji", country: "Japan", countryCode: "jp", continent: "Asia", lat: 35.0394, lng: 135.7292, model: "pagoda", accent: "#ffd34d", city: "Kyoto", blurb: "The Golden Pavilion, glittering over its mirror pond." },
  { id: "angkor", name: "Angkor Wat", country: "Cambodia", countryCode: "kh", continent: "Asia", lat: 13.4125, lng: 103.867, model: "angkor", accent: "#e0b070", city: "Siem Reap", cityCoords: [13.3671, 103.8448], blurb: "The world's largest religious monument, in the Khmer jungle." },
  { id: "mbs", name: "Marina Bay Sands", country: "Singapore", countryCode: "sg", continent: "Asia", lat: 1.2834, lng: 103.8607, model: "mbs", accent: "#5ee0ff", city: "Singapore", blurb: "Three towers carrying a ship-shaped Sky Park." },
  { id: "petronas", name: "Petronas Towers", country: "Malaysia", countryCode: "my", continent: "Asia", lat: 3.1579, lng: 101.7116, model: "petronas", accent: "#c8d6e5", city: "Kuala Lumpur", cityCoords: [3.139, 101.687], blurb: "Twin steel-and-glass spires linked by a sky bridge." },
  { id: "hagia", name: "Hagia Sophia", country: "Türkiye", countryCode: "tr", continent: "Asia", lat: 41.0086, lng: 28.9802, model: "dome", accent: "#e9c9a0", city: "Istanbul", blurb: "A 1,500-year-old dome that has been church, mosque and museum." },
  { id: "burj", name: "Burj Khalifa", country: "United Arab Emirates", countryCode: "ae", continent: "Asia", lat: 25.1972, lng: 55.2744, model: "burj", accent: "#9fd8ff", city: "Dubai", blurb: "At 828 m, the tallest building ever built." },
  { id: "petra", name: "Petra", country: "Jordan", countryCode: "jo", continent: "Asia", lat: 30.3285, lng: 35.4444, model: "petra", accent: "#ff9f7a", city: "Petra", blurb: "The rose-red city carved straight into the cliffs." },

  // Oceania
  { id: "opera", name: "Sydney Opera House", country: "Australia", countryCode: "au", continent: "Oceania", lat: -33.8568, lng: 151.2153, model: "opera", accent: "#ffffff", city: "Sydney", blurb: "Sail-shaped shells on Sydney Harbour." },
  { id: "uluru", name: "Uluru", country: "Australia", countryCode: "au", continent: "Oceania", lat: -25.3444, lng: 131.0369, model: "uluru", accent: "#ff7a4d", city: "Uluru", cityCoords: [-25.3444, 131.0369], blurb: "A glowing red monolith in the heart of the Outback." },

  // North America
  { id: "liberty", name: "Statue of Liberty", country: "United States", countryCode: "us", continent: "North America", lat: 40.6892, lng: -74.0445, model: "liberty", accent: "#6ee7b7", city: "New York", blurb: "Lady Liberty, a gift from France, welcoming the harbour." },
  { id: "goldengate", name: "Golden Gate Bridge", country: "United States", countryCode: "us", continent: "North America", lat: 37.8199, lng: -122.4783, model: "goldengate", accent: "#ff6a3d", city: "San Francisco", cityCoords: [37.774, -122.419], blurb: "International-orange suspension bridge over the bay." },
  { id: "chichen", name: "Chichén Itzá", country: "Mexico", countryCode: "mx", continent: "North America", lat: 20.683, lng: -88.5686, model: "chichen", accent: "#e7c27d", city: "Chichén Itzá", cityCoords: [20.683, -88.5686], blurb: "El Castillo, the Maya step-pyramid aligned to the equinox." },

  // South America
  { id: "christ", name: "Christ the Redeemer", country: "Brazil", countryCode: "br", continent: "South America", lat: -22.9519, lng: -43.2105, model: "christ", accent: "#f2f2f2", city: "Rio de Janeiro", blurb: "Arms wide open above Rio on Corcovado mountain." },
  { id: "machu", name: "Machu Picchu", country: "Peru", countryCode: "pe", continent: "South America", lat: -13.1631, lng: -72.545, model: "machu", accent: "#8bd17c", city: "Cusco", blurb: "The Inca citadel in the clouds." },
  { id: "moai", name: "Moai of Rapa Nui", country: "Chile", countryCode: "cl", continent: "South America", lat: -27.1127, lng: -109.3497, model: "moai", accent: "#c2b8a3", city: "Easter Island", cityCoords: [-27.1127, -109.3497], blurb: "Giant stone heads gazing across Easter Island." },

  // Antarctica
  { id: "erebus", name: "Mount Erebus", country: "Antarctica", countryCode: "aq", continent: "Antarctica", lat: -77.53, lng: 167.17, model: "volcano", accent: "#bfe9ff", city: "Mount Erebus", cityCoords: [-77.53, 167.17], blurb: "The southernmost active volcano on Earth." },
];

function citySlug(seed: Seed): string {
  const match = FEATURED_PLACES.find((p) => p.name === seed.city);
  if (match) return match.slug;
  const [lat, lng] = seed.cityCoords ?? [seed.lat, seed.lng];
  return buildPlaceSlug({ name: seed.city, countryCode: seed.countryCode, lat, lng });
}

export const LANDMARKS: readonly Landmark[] = SEEDS.map((seed) => {
  const { city, cityCoords, ...rest } = seed;
  void cityCoords;
  return { ...rest, city: { name: city, slug: citySlug(seed) } };
});

export const CONTINENT_LABELS: readonly { name: Continent; lat: number; lng: number }[] = [
  { name: "North America", lat: 46, lng: -102 },
  { name: "South America", lat: -14, lng: -60 },
  { name: "Europe", lat: 54, lng: 18 },
  { name: "Africa", lat: 5, lng: 20 },
  { name: "Asia", lat: 47, lng: 90 },
  { name: "Oceania", lat: -24, lng: 134 },
  { name: "Antarctica", lat: -82, lng: 20 },
];
