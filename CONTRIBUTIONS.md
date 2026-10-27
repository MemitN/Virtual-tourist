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
- `muse-wonder-1.0`: itinerary planning (stubbed)

## Third-party services and libraries

Supabase, LiveKit, Open-Meteo, Unsplash imagery, Next.js, Tailwind, shadcn/ui, Framer Motion, Zustand, Zod, react-three-fiber.

## Known gaps / stubs

- [ ] `muse-wonder-1.0` itinerary planning (stub)
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
