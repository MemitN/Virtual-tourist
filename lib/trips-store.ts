import { itinerarySchema, tripOptionsSchema, type Itinerary, type TripOptions } from "@/lib/trip";
import { z } from "zod";

/*
  Saved trips. Signed in: stored in the user's account (Supabase table saved_trips, via /api/trips).
  Guest, or if the database migration hasn't been applied: stored in this browser (localStorage).
*/

export interface SavedTrip {
  id: string;
  slug: string;
  title: string;
  language: string;
  data: Itinerary;
  options: TripOptions | null;
  createdAt: string;
  /** True when this copy lives only in this browser. */
  local: boolean;
}

const LOCAL_KEY = "vt:trips";
const MAX_LOCAL = 30;

const rowSchema = z.object({
  id: z.string(),
  destination_slug: z.string(),
  title: z.string(),
  language: z.string().default("en"),
  data: itinerarySchema,
  options: tripOptionsSchema.nullable().optional(),
  created_at: z.string(),
});

const localSchema = z.array(
  z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    language: z.string().default("en"),
    data: itinerarySchema,
    options: tripOptionsSchema.nullable().default(null),
    createdAt: z.string(),
    local: z.literal(true).default(true),
  }),
);

export function readLocalTrips(): SavedTrip[] {
  try {
    const parsed = localSchema.safeParse(JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "[]"));
    return parsed.success ? (parsed.data as SavedTrip[]) : [];
  } catch {
    return [];
  }
}

export function writeLocalTrips(trips: SavedTrip[]): boolean {
  try {
    if (trips.length === 0) window.localStorage.removeItem(LOCAL_KEY);
    else window.localStorage.setItem(LOCAL_KEY, JSON.stringify(trips.slice(0, MAX_LOCAL)));
    return true;
  } catch {
    return false;
  }
}

class ApiProblem extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function api(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, init);
  const json = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;
  if (!response.ok) throw new ApiProblem(json?.error ?? "Request failed", json?.code);
  return json;
}

/** True when the failure just means "use this browser instead" (no database / migration not run). */
function shouldUseLocal(error: unknown): boolean {
  return error instanceof ApiProblem && (error.code === "db_migration_missing" || error.code === "supabase_not_configured");
}

export interface ListResult {
  trips: SavedTrip[];
  /** Set when an account was expected but we fell back to this browser. */
  note?: string;
}

export async function listTrips(signedIn: boolean, slug?: string): Promise<ListResult> {
  const local = readLocalTrips().filter((t) => !slug || t.slug === slug);
  if (!signedIn) return { trips: local };
  try {
    const json = (await api(`/api/trips${slug ? `?slug=${encodeURIComponent(slug)}` : ""}`)) as { trips?: unknown[] };
    const remote: SavedTrip[] = [];
    for (const row of json.trips ?? []) {
      const parsed = rowSchema.safeParse(row);
      if (parsed.success) {
        const r = parsed.data;
        remote.push({ id: r.id, slug: r.destination_slug, title: r.title, language: r.language, data: r.data, options: r.options ?? null, createdAt: r.created_at, local: false });
      }
    }
    return { trips: [...remote, ...local] };
  } catch (error) {
    if (shouldUseLocal(error)) return { trips: local, note: (error as Error).message };
    throw error;
  }
}

export interface SaveResult {
  trip: SavedTrip;
  savedTo: "account" | "device";
  note?: string;
}

export async function saveTrip(
  signedIn: boolean,
  input: { slug: string; title: string; language: string; data: Itinerary; options: TripOptions | null },
): Promise<SaveResult> {
  const saveLocal = (note?: string): SaveResult => {
    const trip: SavedTrip = { id: `local-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`, createdAt: new Date().toISOString(), local: true, ...input };
    if (!writeLocalTrips([trip, ...readLocalTrips()])) throw new Error("Couldn't save: this browser blocked storage.");
    return { trip, savedTo: "device", ...(note ? { note } : {}) };
  };
  if (!signedIn) return saveLocal();

  try {
    const json = (await api("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: input.slug, title: input.title, language: input.language, data: input.data, ...(input.options ? { options: input.options } : {}) }),
    })) as { trip?: unknown };
    const parsed = rowSchema.parse(json.trip);
    return {
      savedTo: "account",
      trip: { id: parsed.id, slug: parsed.destination_slug, title: parsed.title, language: parsed.language, data: parsed.data, options: parsed.options ?? null, createdAt: parsed.created_at, local: false },
    };
  } catch (error) {
    if (shouldUseLocal(error)) return saveLocal((error as Error).message);
    throw error;
  }
}

export async function deleteTrip(trip: SavedTrip): Promise<void> {
  if (trip.local) {
    writeLocalTrips(readLocalTrips().filter((t) => t.id !== trip.id));
    return;
  }
  await api(`/api/trips/${trip.id}`, { method: "DELETE" });
}

export interface SyncReport {
  favorites: number;
  trips: number;
}

/**
 * After sign-in, moves anything saved as a guest (favorites, trips) into the account, then clears
 * what was moved. Safe to run twice: favorites are idempotent and trips are removed once saved.
 */
export async function syncGuestDataToAccount(): Promise<SyncReport> {
  const report: SyncReport = { favorites: 0, trips: 0 };

  // Favorites
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem("vt:favorites") ?? "[]");
    const slugs = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
    const failed: string[] = [];
    for (const slug of slugs) {
      const response = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) }).catch(() => null);
      if (response?.ok) report.favorites += 1;
      else if (response?.status === 400) continue; // unknown slug: drop it
      else failed.push(slug);
    }
    if (failed.length === 0) window.localStorage.removeItem("vt:favorites");
    else window.localStorage.setItem("vt:favorites", JSON.stringify(failed));
  } catch {
    /* nothing to sync */
  }

  // Trips (oldest first so the newest ends up first in the account)
  const local = readLocalTrips();
  const oldestFirst = [...local].reverse();
  const unsynced = new Set<string>();
  for (const [index, trip] of oldestFirst.entries()) {
    try {
      await api("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: trip.slug, title: trip.title, language: trip.language, data: trip.data, ...(trip.options ? { options: trip.options } : {}) }),
      });
      report.trips += 1;
    } catch (error) {
      unsynced.add(trip.id); // keep it locally and try again next time
      if (shouldUseLocal(error)) {
        // No database to sync into: keep everything left on this device and stop retrying now.
        for (const rest of oldestFirst.slice(index + 1)) unsynced.add(rest.id);
        break;
      }
    }
  }
  const remaining = local.filter((trip) => unsynced.has(trip.id));
  if (remaining.length !== local.length) writeLocalTrips(remaining);
  return report;
}
