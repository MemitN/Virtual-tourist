import type { Destination, DestinationSlug } from "@/lib/types";

/*
  Images are hotlinked from Unsplash. Swap any ID here if a photo is ever removed;
  every page reads images from this file only. UI components also fall back to
  the `gradient` field if an image fails to load.
*/
const unsplash = (id: string, width: number): string =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;

const IMG = {
  paris: "photo-1502602898657-3e91760cbb34",
  tokyo: "photo-1540959733332-eab4deabeeaf",
  marrakech: "photo-1539020140153-e479b8c22e70",
  kyoto: "photo-1493976040374-85c8e12f0c0e",
  lisbon: "photo-1548707309-dcebeab9ea9b",
  capeTown: "photo-1580060839134-75a5edca2e99",
} as const;

export const DESTINATIONS: readonly Destination[] = [
  {
    slug: "paris",
    guide: { name: "Sophie", role: "Local expert", greeting: "Bonjour!", hue: 345 },
    custom: false,
    name: "Paris",
    country: "France",
    tagline: "Golden light on zinc rooftops and café-lined boulevards.",
    description:
      "Paris rewards slow wandering: morning croissants on a quiet corner, the Seine glittering under stone bridges, and the Eiffel Tower sparkling on the hour after dark. Between the grand museums are village-like neighborhoods where locals queue at the boulangerie and argue happily about cheese.",
    timezone: "Europe/Paris",
    lat: 48.8566,
    lng: 2.3522,
    starterQuestions: [
      "Where would a local have breakfast near the Seine?",
      "How do I avoid the crowds at the Eiffel Tower?",
      "What's a perfect free evening in Paris?",
      "Which neighborhood feels least touristy?",
    ],
    heroImage: unsplash(IMG.paris, 1920),
    cardImage: unsplash(IMG.paris, 800),
    gradient: "linear-gradient(135deg, #1e2a5a 0%, #e0884a 100%)",
    accent: "#e0884a",
    bestTime: "April–June, September–October",
    currency: "Euro (EUR)",
    language: "French",
    ambientAudioUrl: null,
    pois: [
      { id: "eiffel-tower", label: "Eiffel Tower", description: "Iron lace rising over the Champ de Mars; it sparkles for five minutes every hour after sunset.", yaw: 20, pitch: 12 },
      { id: "seine-quay", label: "Seine riverbank", description: "Locals picnic on the quays with bread, cheese and a bottle as boats glide past.", yaw: 140, pitch: -4 },
      { id: "montmartre", label: "Montmartre", description: "Cobbled lanes, painters' squares and the white domes of Sacré-Cœur.", yaw: -95, pitch: 8 },
      { id: "louvre-pyramid", label: "Louvre Pyramid", description: "Glass and steel in the courtyard of a former royal palace.", yaw: -160, pitch: 0 },
    ],
  },
  {
    slug: "tokyo",
    guide: { name: "Kenji", role: "Local expert", greeting: "Konnichiwa!", hue: 210 },
    custom: false,
    name: "Tokyo",
    country: "Japan",
    tagline: "Neon canyons, quiet shrines, and the world's best ramen.",
    description:
      "Tokyo layers the ultramodern over the ancient: a silent cedar-lined shrine a few steps from a wall of neon, a ten-seat counter serving perfect tempura beside a vending machine glowing in the rain. Trains run on the second, the people are generous, and every alley hides something delicious.",
    timezone: "Asia/Tokyo",
    lat: 35.6762,
    lng: 139.6503,
    starterQuestions: [
      "What should I eat on my first night in Tokyo?",
      "How do I use the trains without getting lost?",
      "Where can I find a calm, quiet corner of the city?",
      "What etiquette should I know at a shrine?",
    ],
    heroImage: unsplash(IMG.tokyo, 1920),
    cardImage: unsplash(IMG.tokyo, 800),
    gradient: "linear-gradient(135deg, #1a1040 0%, #e0457b 100%)",
    accent: "#e0457b",
    bestTime: "March–May, October–November",
    currency: "Japanese yen (JPY)",
    language: "Japanese",
    ambientAudioUrl: null,
    pois: [
      { id: "shibuya-crossing", label: "Shibuya Crossing", description: "Thousands of people cross in every direction at once, perfectly orderly.", yaw: 10, pitch: 5 },
      { id: "senso-ji", label: "Sensō-ji Temple", description: "Tokyo's oldest temple, entered through the great Kaminarimon lantern gate.", yaw: 105, pitch: 6 },
      { id: "tokyo-tower", label: "Tokyo Tower", description: "A 1958 red-and-white lattice tower that still glows over the skyline.", yaw: -120, pitch: 14 },
      { id: "meiji-jingu", label: "Meiji Jingu", description: "A forest shrine where the city's noise fades under towering trees.", yaw: -50, pitch: 2 },
    ],
  },
  {
    slug: "marrakech",
    guide: { name: "Youssef", role: "Local expert", greeting: "Salaam!", hue: 28 },
    custom: false,
    name: "Marrakech",
    country: "Morocco",
    tagline: "Spice-scented souks under a rose-red sky.",
    description:
      "Marrakech is a feast for every sense: the call to prayer drifting over terracotta walls, the thump of drums in Jemaa el-Fnaa, mint tea poured from a height, and the hush of a riad courtyard with a lemon tree and a fountain. Get gloriously lost in the medina and let the city find you.",
    timezone: "Africa/Casablanca",
    lat: 31.6295,
    lng: -7.9811,
    starterQuestions: [
      "How do I haggle politely in the souks?",
      "What should I try at the food stalls in Jemaa el-Fnaa?",
      "Where can I escape the heat and noise?",
      "What should I wear to be respectful?",
    ],
    heroImage: unsplash(IMG.marrakech, 1920),
    cardImage: unsplash(IMG.marrakech, 800),
    gradient: "linear-gradient(135deg, #5a1e1e 0%, #f0a24a 100%)",
    accent: "#d9623b",
    bestTime: "March–May, September–November",
    currency: "Moroccan dirham (MAD)",
    language: "Arabic, Amazigh, French",
    ambientAudioUrl: null,
    pois: [
      { id: "jemaa-el-fnaa", label: "Jemaa el-Fnaa", description: "The great square: storytellers, musicians and sizzling night-market grills.", yaw: 15, pitch: 4 },
      { id: "koutoubia", label: "Koutoubia Mosque", description: "A 12th-century minaret that guides every wanderer home.", yaw: 120, pitch: 16 },
      { id: "majorelle", label: "Majorelle Garden", description: "Cobalt-blue walls and cactus gardens, a peaceful retreat from the medina.", yaw: -80, pitch: 0 },
      { id: "souk-spices", label: "Spice souk", description: "Pyramids of saffron, cumin and ras el hanout, and shopkeepers who'll let you sniff.", yaw: -150, pitch: -3 },
    ],
  },
  {
    slug: "kyoto",
    guide: { name: "Haruka", role: "Local expert", greeting: "Konnichiwa!", hue: 330 },
    custom: false,
    name: "Kyoto",
    country: "Japan",
    tagline: "Vermilion gates, moss gardens, and tea in the old capital.",
    description:
      "For more than a thousand years Kyoto was Japan's imperial heart, and it still moves to a gentler rhythm: geiko hurrying through lantern-lit Gion, bamboo whispering in Arashiyama, and a bowl of matcha whisked just so. Visit early or late and the temples are yours alone.",
    timezone: "Asia/Tokyo",
    lat: 35.0116,
    lng: 135.7681,
    starterQuestions: [
      "When is the quietest time to visit Fushimi Inari?",
      "How do I experience a proper tea ceremony?",
      "What's the respectful way to behave around geiko in Gion?",
      "Where can I see autumn leaves without the crowds?",
    ],
    heroImage: unsplash(IMG.kyoto, 1920),
    cardImage: unsplash(IMG.kyoto, 800),
    gradient: "linear-gradient(135deg, #3a1a1a 0%, #d94a2f 100%)",
    accent: "#d94a2f",
    bestTime: "March–April, November",
    currency: "Japanese yen (JPY)",
    language: "Japanese",
    ambientAudioUrl: null,
    pois: [
      { id: "fushimi-inari", label: "Fushimi Inari", description: "Thousands of vermilion torii gates climbing the sacred mountain.", yaw: 5, pitch: 3 },
      { id: "kinkaku-ji", label: "Kinkaku-ji", description: "The Golden Pavilion, mirrored in a still pond.", yaw: 110, pitch: 6 },
      { id: "arashiyama-bamboo", label: "Arashiyama Bamboo Grove", description: "A green cathedral of bamboo that sways and sighs in the breeze.", yaw: -100, pitch: 10 },
      { id: "gion", label: "Gion district", description: "Wooden machiya houses and lantern light where geiko still walk to appointments.", yaw: -165, pitch: -2 },
    ],
  },
  {
    slug: "lisbon",
    guide: { name: "Mateus", role: "Local expert", greeting: "Olá!", hue: 45 },
    custom: false,
    name: "Lisbon",
    country: "Portugal",
    tagline: "Pastel hills, rattling trams, and custard tarts at sunset.",
    description:
      "Lisbon spills down seven hills to the Tagus, a city of azulejo-tiled facades, fado drifting from tiny taverns, and viewpoints where everyone gathers at golden hour. Ride Tram 28, eat a warm pastel de nata, and linger over grilled sardines with a glass of vinho verde.",
    timezone: "Europe/Lisbon",
    lat: 38.7223,
    lng: -9.1393,
    starterQuestions: [
      "What's the best way to tackle Lisbon's hills?",
      "Where can I hear authentic fado?",
      "Which miradouro is best for sunset?",
      "What should I order at a traditional tasca?",
    ],
    heroImage: unsplash(IMG.lisbon, 1920),
    cardImage: unsplash(IMG.lisbon, 800),
    gradient: "linear-gradient(135deg, #123a5a 0%, #f2b84b 100%)",
    accent: "#f2b84b",
    bestTime: "March–May, September–October",
    currency: "Euro (EUR)",
    language: "Portuguese",
    ambientAudioUrl: null,
    pois: [
      { id: "alfama", label: "Alfama", description: "Lisbon's oldest quarter: a maze of lanes, laundry lines and fado.", yaw: 12, pitch: 4 },
      { id: "belem-tower", label: "Belém Tower", description: "A lacy Manueline fortress that watched ships leave for the Age of Discovery.", yaw: 115, pitch: 2 },
      { id: "tram-28", label: "Tram 28", description: "Vintage yellow tram clattering past tiled houses and steep corners.", yaw: -90, pitch: -3 },
      { id: "santa-luzia", label: "Miradouro de Santa Luzia", description: "A bougainvillea-draped viewpoint over red roofs and the river.", yaw: -155, pitch: 8 },
    ],
  },
  {
    slug: "cape-town",
    guide: { name: "Zanele", role: "Local expert", greeting: "Sawubona!", hue: 170 },
    custom: false,
    name: "Cape Town",
    country: "South Africa",
    tagline: "Where a flat-topped mountain meets two oceans.",
    description:
      "Cape Town sits beneath Table Mountain, wrapped in sea and vineyards. Hike at sunrise, taste wine in Constantia, wander the candy-colored streets of Bo-Kaap, and watch penguins waddle at Boulders Beach. It's wild, warm, and endlessly photogenic.",
    timezone: "Africa/Johannesburg",
    lat: -33.9249,
    lng: 18.4241,
    starterQuestions: [
      "Is it safe to hike Table Mountain, and when should I go?",
      "What's the story behind Bo-Kaap's colorful houses?",
      "What local foods should I try?",
      "What's a great day trip from Cape Town?",
    ],
    heroImage: unsplash(IMG.capeTown, 1920),
    cardImage: unsplash(IMG.capeTown, 800),
    gradient: "linear-gradient(135deg, #0f3a4a 0%, #3fb8a0 100%)",
    accent: "#3fb8a0",
    bestTime: "November–March",
    currency: "South African rand (ZAR)",
    language: "English, Afrikaans, isiXhosa",
    ambientAudioUrl: null,
    pois: [
      { id: "table-mountain", label: "Table Mountain", description: "The flat-topped icon, often draped in its own 'tablecloth' of cloud.", yaw: 8, pitch: 14 },
      { id: "bo-kaap", label: "Bo-Kaap", description: "Brightly painted houses on cobbled streets, home to Cape Malay heritage.", yaw: 118, pitch: 0 },
      { id: "waterfront", label: "V&A Waterfront", description: "A working harbor with seals, street music and the mountain as backdrop.", yaw: -85, pitch: 1 },
      { id: "camps-bay", label: "Camps Bay", description: "White sand beneath the Twelve Apostles, glowing at sunset.", yaw: -160, pitch: -2 },
    ],
  },
] as const;

export const DESTINATION_SLUGS: readonly DestinationSlug[] = DESTINATIONS.map(
  (d) => d.slug,
);

export function getDestination(slug: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.slug === slug);
}

export function isDestinationSlug(slug: string): slug is DestinationSlug {
  return DESTINATIONS.some((d) => d.slug === slug);
}
