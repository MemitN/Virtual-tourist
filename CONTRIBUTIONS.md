# CONTRIBUTIONS

Solo project by **Dapash (Kenya)**, built during the Meta Global AI Developer Hackathon, Build for Your World track.

## Built during the hackathon

| Area | What I built | Files / commits |
| --- | --- | --- |
| Foundation | Next.js 14, Tailwind, design system | |
| Database | Supabase schema + RLS | `supabase/migrations/0001_init.sql` |
| AI guide | Streamed chat with live context (RT-1, RT-4) | `app/api/chat`, `lib/prompts.ts` |
| Shared rooms | Supabase Realtime presence + POI toasts (RT-2) | `lib/realtime/useRoom.ts` |
| 360° tour | R3F panorama + LiveKit live feed (RT-3) | `components/panorama-viewer.tsx` |
| Imagery | muse-image-1.0 panoramas | `app/api/image` |
| Segmentation | sam-3.1 API route | `app/api/segment` |

## Meta models used

- `muse-spark-1.3`: streamed guide chat
- `muse-image-1.0`: equirectangular panorama generation
- `sam-3.1`: segmentation API (UI deferred)
- Trip toolkit (itinerary, phrasebook, essentials, packing) runs on the same chat model via `/api/trip` (replaces the old `muse-wonder-1.0` stub)

## Third-party services and libraries

Supabase, LiveKit, Open-Meteo, Unsplash imagery, Next.js, Tailwind, shadcn/ui, Framer Motion, Zustand, Zod, react-three-fiber.

## Known gaps / stubs

- [ ] `sam-3.1` UI integration (API ready)
- [ ] LiveKit live feed (placeholder when unconfigured)

## Demo notes

_Add timestamps and talking points for the demo video here._

## Extra usability features (added after the core modules)
- Share button (native share sheet, clipboard fallback) on destination and tour pages; tour links deep-link to a hotspot with `?poi=`.
- Voice input (browser SpeechRecognition) in the guide chat; hidden where unsupported.
- Copy-reply button and lightweight, injection-safe formatting (paragraphs, bullets, bold) for guide replies.
- Global error page, 404 page with destination shortcuts, and loading skeleton.
- Installable PWA manifest, app icon, `sitemap.xml` and `robots.txt`.

## Any place on Earth + premium redesign
- **World-wide destinations:** every city, landmark or country is addressable by a self-describing slug (`name~cc~lat~lng`). Open-Meteo geocoding provides search and timezone; Wikipedia provides summary, photo and nearby landmarks (hotspot yaw = real compass bearing). Procedural SVG scenery is the fallback when no photo exists.
- **Global search** (combobox, Ctrl/Cmd+K, "Surprise me") and an interactive **3D globe** (react-three-fiber) with 36 featured places, plus an `/explore` page.
- **Human guides:** each place gets a named guide with a local-language greeting; the guide name flows into the system prompt. Guides say they are AI when asked.
- **Redesign:** midnight/electric-blue theme, left rail + top bar + mobile tab bar, hero search, three-column guide chat, weather card, favorites for any place.

## Translation, explanations, Baseten and branding
- **Translation:** 14 languages (incl. Swahili). The picker drives guide replies, on-demand AI translation of place text and chat messages (`/api/translate`), read-aloud voice and voice-input language.
- **Explanations:** "The story of {place}" on every destination page and an "Explain" button on every landmark in the tour (`/api/explain`), written by the local guide in the chosen language, cached and rate-limited.
- **Baseten / Muse Spark Open:** chat runs on any OpenAI-compatible host via `MODEL_BASE_URL` + `MODEL_CHAT_NAME` (Baseten: `https://inference.baseten.co/v1`, `meta-models/muse-spark-open`).
- **Brand:** custom VT-in-a-globe logo and icon, handwritten hero with cycling greetings and postcards.

## Reliability + trip toolkit update
- **Works with one key:** provider layer tries Meta (muse-spark 1.3 -> 1.2 -> 1.1, chat + Responses API) then Baseten, skipping dead hosts/keys; strips `<think>` reasoning; retries with conservative parameters on a 400. `/api/health` probes every candidate.
- **Guest mode:** guide chat and favorites work without Supabase (history/favorites in localStorage); signed-in users still get server history.
- **Never dead-ends:** no key or provider outage -> labelled offline guide, curated explanations, built-in itinerary/essentials/packing and an 8-language phrasebook.
- **Trip toolkit** (`/destination/<slug>/plan`): AI itinerary, phrasebook with read-aloud, essentials, weather-aware packing list. JSON output is validated with zod and cached.

## Database-backed trips (additive)
- `0002_saved_trips.sql`: new `saved_trips` table with RLS (own rows only), size limits, `updated_at` trigger. No existing table touched.
- `/api/trips` (list, create, limit 50 per user) and `/api/trips/[id]` (delete), zod-validated, same auth/RLS pattern as favorites.
- `lib/trips-store.ts`: account when signed in, localStorage otherwise or when the migration is missing; `syncGuestDataToAccount()` moves guest favorites and trips on first sign-in (`GuestSync`).
- `/trips` page, Save button and saved-plans list in the toolkit, clear-conversation in chat.
- `/api/health` reports each table (`profiles`, `favorites`, `chat_*`, `saved_trips`) and names the missing migration.
