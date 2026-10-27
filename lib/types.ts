/** Curated slugs ("paris") or a world-place slug ("nairobi~ke~-1.286~36.817"). See lib/place-slug.ts. */
export type DestinationSlug = string;

/** The human the traveler chats with. Names are local-flavoured; the guide still says it is an AI if asked. */
export interface GuideProfile {
  name: string;
  role: string;
  /** Local-language opener, e.g. "Bonjour!". */
  greeting: string;
  /** 0-360, tints the avatar. */
  hue: number;
}

/** A clickable hotspot inside the 360° viewer. yaw/pitch are in degrees. */
export interface PointOfInterest {
  id: string;
  label: string;
  description: string;
  yaw: number;
  pitch: number;
}

export interface Destination {
  slug: DestinationSlug;
  name: string;
  country: string;
  tagline: string;
  description: string;
  timezone: string;
  lat: number;
  lng: number;
  starterQuestions: string[];
  // Presentation + usability extras
  heroImage: string;
  cardImage: string;
  /** CSS gradient shown while images load or if they fail. */
  gradient: string;
  accent: string;
  bestTime: string;
  currency: string;
  language: string;
  pois: PointOfInterest[];
  /** Optional ambient loop. When null the ambient component synthesizes a soft tone bed. */
  ambientAudioUrl: string | null;
  guide: GuideProfile;
  /** True for places outside the curated six (resolved live from the world map). */
  custom: boolean;
  /** Where the description/photo came from, shown as attribution. */
  source?: { label: string; url: string };
}

/** The little the card UI needs, so a card can be built from a slug alone. */
export type DestinationCardData = Pick<
  Destination,
  "slug" | "name" | "country" | "tagline" | "cardImage" | "gradient"
>;

export interface PlaceSearchResult {
  slug: string;
  name: string;
  country: string;
  countryCode: string;
  region: string | null;
  lat: number;
  lng: number;
}

export interface LiveContext {
  localTime: string;
  weather: string;
  temp: number;
  conditions: string;
}

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface UiChatMessage extends ChatMessage {
  id: string;
  /** True while tokens are still arriving. */
  streaming?: boolean;
  /** True if generation failed part-way. */
  failed?: boolean;
}

/** Realtime presence payload tracked per user in room:${slug}. */
export interface PresenceUser {
  userId: string;
  displayName: string;
  viewingPoi: string | null;
}

/** Broadcast event sent when a user clicks a POI. */
export interface PoiClickEvent {
  userId: string;
  displayName: string;
  poiId: string;
  poiLabel: string;
}

export type TourMode = "imagery" | "live";

export interface ApiErrorBody {
  error: string;
  code?: string;
  details?: unknown;
}

export interface FavoriteRow {
  id: string;
  user_id: string;
  destination_slug: string;
  created_at: string;
}

export interface SegmentResult {
  boxes: number[][];
  masks: string[];
}
