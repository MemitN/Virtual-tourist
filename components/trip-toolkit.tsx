"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarDays,
  BookmarkCheck,
  BookmarkPlus,
  Check,
  Compass,
  Copy,
  Languages,
  Loader2,
  Luggage,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { ItineraryDays } from "@/components/itinerary-view";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/useLanguage";
import { useUser } from "@/lib/useUser";
import { deleteTrip, listTrips, saveTrip, type SavedTrip } from "@/lib/trips-store";
import { playSpeech, stopSpeech } from "@/lib/speech";
import {
  BUDGETS,
  essentialsSchema,
  INTERESTS,
  itinerarySchema,
  itineraryToText,
  PACES,
  packingSchema,
  phrasebookSchema,
  type Essentials,
  type Itinerary,
  type Packing,
  type Phrasebook,
  type TripKind,
  type TripOptions,
} from "@/lib/trip";
import { cn } from "@/lib/utils";

interface TripToolkitProps {
  slug: string;
  name: string;
  guideName: string;
}

type Status = "idle" | "loading" | "ready" | "error";

interface Slice<T> {
  status: Status;
  data: T | null;
  offline: boolean;
  note: string | null;
  error: string | null;
}

const empty = <T,>(): Slice<T> => ({ status: "idle", data: null, offline: false, note: null, error: null });

const SCHEMA_BY_KIND = {
  itinerary: itinerarySchema,
  phrasebook: phrasebookSchema,
  essentials: essentialsSchema,
  packing: packingSchema,
} as const;

/** Calls /api/trip for one kind and keeps its loading / error / offline state. */
function useTrip<T>(kind: TripKind, slug: string, language: string) {
  const [state, setState] = useState<Slice<T>>(empty<T>());
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = useCallback(
    async (options?: TripOptions): Promise<void> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setState((s) => ({ ...s, status: "loading", error: null }));
      try {
        const response = await fetch("/api/trip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, kind, language, ...(options ? { options } : {}) }),
          signal: controller.signal,
        });
        const json = (await response.json().catch(() => null)) as { data?: unknown; source?: string; note?: string; error?: string } | null;
        if (!response.ok || !json?.data) throw new Error(json?.error ?? "Something went wrong. Please try again.");
        const data = SCHEMA_BY_KIND[kind].parse(json.data) as T;
        setState({ status: "ready", data, offline: json.source === "offline", note: json.note ?? null, error: null });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState((s) => ({ ...s, status: "error", error: error instanceof Error ? error.message : "Something went wrong." }));
      }
    },
    [slug, kind, language],
  );

  return { state, setState, run };
}

const TABS: { id: TripKind; label: string; icon: LucideIcon }[] = [
  { id: "itinerary", label: "Itinerary", icon: CalendarDays },
  { id: "phrasebook", label: "Phrasebook", icon: Languages },
  { id: "essentials", label: "Essentials", icon: Compass },
  { id: "packing", label: "Packing", icon: Luggage },
];

export function TripToolkit({ slug, name, guideName }: TripToolkitProps) {
  const { language } = useLanguage();
  const [tab, setTab] = useState<TripKind>("itinerary");

  const itinerary = useTrip<Itinerary>("itinerary", slug, language);
  const phrasebook = useTrip<Phrasebook>("phrasebook", slug, language);
  const essentials = useTrip<Essentials>("essentials", slug, language);
  const packing = useTrip<Packing>("packing", slug, language);

  // Load the passive tabs the first time they are opened (and again if the language changes).
  const loadedFor = useRef<Record<string, string>>({});
  useEffect(() => {
    const auto = { phrasebook, essentials, packing } as const;
    if (tab === "itinerary") return;
    const slice = auto[tab];
    if (loadedFor.current[tab] === language) return;
    loadedFor.current[tab] = language;
    void slice.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, language]);

  useEffect(() => () => stopSpeech(), []);

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Trip tools" className="flex gap-1 overflow-x-auto rounded-full border bg-card/70 p-1 print:hidden">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition",
              tab === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "itinerary" && <ItineraryTab slug={slug} name={name} guideName={guideName} trip={itinerary} />}
        {tab === "phrasebook" && <PhrasebookTab trip={phrasebook} />}
        {tab === "essentials" && <EssentialsTab name={name} trip={essentials} />}
        {tab === "packing" && <PackingTab trip={packing} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ shared bits */

function Banner({ offline, note }: { offline: boolean; note: string | null }) {
  if (!offline) return null;
  return (
    <p className="mb-4 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span>{note ?? "Showing a built-in version. Add MODEL_API_KEY to .env.local for AI-tailored results."}</span>
    </p>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="panel space-y-3 p-6">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {label}
      </p>
      <div className="skeleton h-5 w-2/3" />
      <div className="skeleton h-5 w-full" />
      <div className="skeleton h-5 w-5/6" />
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
      <span className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
        {message}
      </span>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-4 text-sm transition",
        active ? "border-primary bg-primary/15 font-semibold text-foreground" : "bg-card/70 text-muted-foreground hover:border-primary/60",
      )}
    >
      {active && <Check className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ itinerary */

function ItineraryTab({ slug, name, guideName, trip }: { slug: string; name: string; guideName: string; trip: ReturnType<typeof useTrip<Itinerary>> }) {
  const storageKey = `vt:plan:${slug}`;
  const [options, setOptions] = useState<TripOptions>({ days: 3, interests: [], pace: "Balanced", budget: "Mid-range" });
  const [copied, setCopied] = useState(false);
  const { language } = useLanguage();
  const { user, loading: userLoading } = useUser();
  const signedIn = Boolean(user);
  const [saved, setSaved] = useState<SavedTrip[]>([]);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const { state, setState, run } = trip;

  const refreshSaved = useCallback(async (): Promise<void> => {
    try {
      const result = await listTrips(signedIn, slug);
      setSaved(result.trips);
      setSavedNote(result.note ?? null);
    } catch {
      /* the saved list is a bonus; the planner still works */
    }
  }, [signedIn, slug]);

  useEffect(() => {
    if (!userLoading) void refreshSaved();
  }, [userLoading, refreshSaved]);

  // A fresh plan is not saved yet.
  useEffect(() => setJustSaved(false), [state.data]);

  const save = async (): Promise<void> => {
    if (!state.data || saving) return;
    setSaving(true);
    try {
      const result = await saveTrip(signedIn, { slug, title: state.data.title, language, data: state.data, options });
      setJustSaved(true);
      toast.success(result.savedTo === "account" ? "Saved to your account" : "Saved on this device");
      if (result.note) toast(result.note);
      await refreshSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save this trip.");
    } finally {
      setSaving(false);
    }
  };

  const removeSaved = async (trip: SavedTrip): Promise<void> => {
    try {
      await deleteTrip(trip);
      setSaved((list) => list.filter((t) => t.id !== trip.id));
      toast("Trip deleted");
    } catch {
      toast.error("Couldn't delete that trip. Please try again.");
    }
  };

  const openSaved = (trip: SavedTrip): void => {
    if (trip.options) setOptions(trip.options);
    setState({ status: "ready", data: trip.data, offline: false, note: null, error: null });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Restore the last plan for this place.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { options?: TripOptions; data?: unknown };
      const data = itinerarySchema.safeParse(saved.data);
      if (saved.options) setOptions(saved.options);
      if (data.success) setState({ status: "ready", data: data.data, offline: false, note: null, error: null });
    } catch {
      /* ignore corrupt saved plan */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Save whenever a plan finishes.
  useEffect(() => {
    if (state.status !== "ready" || !state.data) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ options, data: state.data }));
    } catch {
      /* storage blocked */
    }
  }, [state.status, state.data, options, storageKey]);

  const toggleInterest = (interest: string): void =>
    setOptions((o) => ({ ...o, interests: o.interests.includes(interest) ? o.interests.filter((i) => i !== interest) : [...o.interests, interest].slice(0, 8) }));

  const copy = async (): Promise<void> => {
    if (!state.data) return;
    try {
      await navigator.clipboard.writeText(itineraryToText(state.data));
      setCopied(true);
      toast.success("Itinerary copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Use Print to save it as a PDF instead.");
    }
  };

  return (
    <div className="space-y-5">
      <section aria-labelledby="plan-form" className="panel space-y-5 p-5 sm:p-6 print:hidden">
        <h2 id="plan-form" className="text-xl font-bold">
          Plan your trip to {name}
        </h2>

        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium">How many days?</span>
          <div className="flex items-center gap-2">
            <Button type="button" size="icon" variant="outline" aria-label="Fewer days" disabled={options.days <= 1} onClick={() => setOptions((o) => ({ ...o, days: Math.max(1, o.days - 1) }))}>
              <Minus aria-hidden="true" />
            </Button>
            <output aria-live="polite" className="w-16 text-center text-lg font-bold">
              {options.days} {options.days === 1 ? "day" : "days"}
            </output>
            <Button type="button" size="icon" variant="outline" aria-label="More days" disabled={options.days >= 7} onClick={() => setOptions((o) => ({ ...o, days: Math.min(7, o.days + 1) }))}>
              <Plus aria-hidden="true" />
            </Button>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">What do you love? (pick any)</legend>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((interest) => (
              <Chip key={interest} active={options.interests.includes(interest)} onClick={() => toggleInterest(interest)}>
                {interest}
              </Chip>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Pace</legend>
            <div className="flex flex-wrap gap-2">
              {PACES.map((pace) => (
                <Chip key={pace} active={options.pace === pace} onClick={() => setOptions((o) => ({ ...o, pace }))}>
                  {pace}
                </Chip>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Budget</legend>
            <div className="flex flex-wrap gap-2">
              {BUDGETS.map((budget) => (
                <Chip key={budget} active={options.budget === budget} onClick={() => setOptions((o) => ({ ...o, budget }))}>
                  {budget}
                </Chip>
              ))}
            </div>
          </fieldset>
        </div>

        <Button type="button" size="lg" onClick={() => void run(options)} disabled={state.status === "loading"} className="w-full sm:w-auto">
          {state.status === "loading" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
          {state.data ? "Plan it again" : `Ask ${guideName} to plan it`}
        </Button>
      </section>

      {state.status === "loading" && <Loading label={`${guideName} is planning your ${options.days}-day trip…`} />}
      {state.status === "error" && <ErrorBox message={state.error ?? "Something went wrong."} onRetry={() => void run(options)} />}

      {state.data && state.status !== "loading" && (
        <article aria-label="Your itinerary" className="space-y-4">
          <Banner offline={state.offline} note={state.note} />
          <header className="panel p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold">{state.data.title}</h2>
                {state.data.summary && <p className="mt-1 max-w-2xl text-muted-foreground">{state.data.summary}</p>}
              </div>
              <div className="flex flex-wrap gap-2 print:hidden">
                <Button type="button" size="sm" variant={justSaved ? "default" : "outline"} disabled={saving || justSaved} onClick={() => void save()}>
                  {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : justSaved ? <BookmarkCheck aria-hidden="true" /> : <BookmarkPlus aria-hidden="true" />}
                  {justSaved ? "Saved" : "Save trip"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
                  {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
                  <Printer aria-hidden="true" />
                  Print
                </Button>
              </div>
            </div>
          </header>

          <ItineraryDays itinerary={state.data} />
        </article>
      )}

      {saved.length > 0 && (
        <section aria-labelledby="saved-plans" className="panel space-y-3 p-5 print:hidden">
          <h2 id="saved-plans" className="font-semibold">
            Your saved plans for {name}
          </h2>
          {savedNote && <p className="text-xs text-muted-foreground">{savedNote}</p>}
          <ul className="divide-y">
            {saved.map((trip) => (
              <li key={trip.id} className="flex items-center justify-between gap-3 py-2">
                <button type="button" onClick={() => openSaved(trip)} className="min-h-11 min-w-0 flex-1 text-left hover:text-primary">
                  <span className="block truncate font-medium">{trip.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {new Date(trip.createdAt).toLocaleDateString()} · {trip.data.days.length} {trip.data.days.length === 1 ? "day" : "days"}
                    {trip.local ? " · this device" : ""}
                  </span>
                </button>
                <Button type="button" size="icon" variant="ghost" aria-label={`Delete ${trip.title}`} onClick={() => void removeSaved(trip)}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ phrasebook */

function PhrasebookTab({ trip }: { trip: ReturnType<typeof useTrip<Phrasebook>> }) {
  const { state, run } = trip;
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, Phrasebook["phrases"]>();
    for (const p of state.data?.phrases ?? []) {
      if (q && !`${p.meaning} ${p.local} ${p.pronunciation ?? ""}`.toLowerCase().includes(q)) continue;
      map.set(p.category, [...(map.get(p.category) ?? []), p]);
    }
    return [...map.entries()];
  }, [state.data, query]);

  const speak = (id: string, text: string): void => {
    const result = playSpeech(text, { onStateChange: (s) => setPlaying(s === "idle" ? null : id) }, state.data?.bcp47);
    if (!result.ok) toast(result.message ?? "Read-aloud isn't available here.");
  };

  if (state.status === "loading" || state.status === "idle") return <Loading label="Building your phrasebook…" />;
  if (state.status === "error" || !state.data) return <ErrorBox message={state.error ?? "Couldn't load the phrasebook."} onRetry={() => void run()} />;

  return (
    <div className="space-y-4">
      <Banner offline={state.offline} note={state.note} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{state.data.language} for travelers</h2>
        <label className="relative block w-full sm:w-64">
          <span className="sr-only">Search phrases</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search phrases"
            className="min-h-11 w-full rounded-full border bg-card pl-9 pr-4 text-base focus-visible:outline-none sm:text-sm"
          />
        </label>
      </div>

      {groups.length === 0 && <p className="text-sm text-muted-foreground">No phrases match “{query}”.</p>}
      {groups.map(([category, phrases]) => (
        <section key={category} className="panel p-4 sm:p-5">
          <h3 className="mb-2 font-semibold">{category}</h3>
          <ul className="divide-y">
            {phrases.map((p) => {
              const id = `${category}-${p.local}`;
              return (
                <li key={id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{p.meaning}</p>
                    <p className="text-lg font-semibold">{p.local}</p>
                    {p.pronunciation && <p className="text-sm italic text-muted-foreground">{p.pronunciation}</p>}
                  </div>
                  <Button type="button" size="icon" variant={playing === id ? "default" : "outline"} aria-label={`Hear “${p.local}”`} onClick={() => speak(id, p.local)}>
                    <Volume2 aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ essentials */

function EssentialsTab({ name, trip }: { name: string; trip: ReturnType<typeof useTrip<Essentials>> }) {
  const { state, run } = trip;
  if (state.status === "loading" || state.status === "idle") return <Loading label={`Gathering essentials for ${name}…`} />;
  if (state.status === "error" || !state.data) return <ErrorBox message={state.error ?? "Couldn't load the essentials."} onRetry={() => void run()} />;
  const e = state.data;

  const prose: [string, string | undefined][] = [
    ["Best time to go", e.bestTime],
    ["Getting around", e.getAround],
    ["Money", e.money],
    ["Staying connected", e.connectivity],
  ];
  const lists: [string, string[]][] = [
    ["Etiquette", e.etiquette],
    ["Staying safe", e.safety],
    ["What to eat and drink", e.localFood],
  ];

  return (
    <div className="space-y-4">
      <Banner offline={state.offline} note={state.note} />
      <div className="grid gap-4 md:grid-cols-2">
        {prose.filter(([, v]) => v).map(([title, value]) => (
          <section key={title} className="panel p-5">
            <h3 className="mb-1 font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{value}</p>
          </section>
        ))}
        {lists.filter(([, v]) => v.length > 0).map(([title, items]) => (
          <section key={title} className="panel p-5">
            <h3 className="mb-2 font-semibold">{title}</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ packing */

function PackingTab({ trip }: { trip: ReturnType<typeof useTrip<Packing>> }) {
  const { state, run } = trip;
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  if (state.status === "loading" || state.status === "idle") return <Loading label="Checking the weather and building your list…" />;
  if (state.status === "error" || !state.data) return <ErrorBox message={state.error ?? "Couldn't build the packing list."} onRetry={() => void run()} />;

  const total = state.data.groups.reduce((n, g) => n + g.items.length, 0);
  const done = Object.values(checked).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <Banner offline={state.offline} note={state.note} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{state.data.note}</p>
        <p className="text-sm font-semibold" aria-live="polite">
          {done} of {total} packed
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {state.data.groups.map((group) => (
          <section key={group.name} className="panel p-5">
            <h3 className="mb-2 font-semibold">{group.name}</h3>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const id = `${group.name}-${item}`;
                return (
                  <li key={id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                      <input type="checkbox" checked={Boolean(checked[id])} onChange={(e) => setChecked((c) => ({ ...c, [id]: e.target.checked }))} className="h-5 w-5 accent-[hsl(var(--primary))]" />
                      <span className={cn(checked[id] && "text-muted-foreground line-through")}>{item}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
