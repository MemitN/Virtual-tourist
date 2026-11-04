# Hardening pass

- Voice input: Permissions-Policy blocked the microphone (`microphone=()`), so the mic button could never work. Now `microphone=(self)`.
- Slow custom places: `resolveDestination` is now cached (10 min), de-duplicated across concurrent requests, and capped at 9s with a fast fallback place. Upstream timeouts 5s -> 3.5s.
- `/api/context/[slug]`: no longer builds the whole place page; one Open-Meteo call, IP rate limit, non-blocking Realtime publish.
- Realtime publish: uses `httpSend` when available, time-boxed, bounded throttle map.
- Wrong "local time" when the timezone lookup fails: now estimated from longitude instead of showing UTC.
- Chat: history persistence can no longer hold the stream open.
- Segment API: https-only image URLs. Image API: 15 MB cap on generated images.
- Trips: collision-proof local ids; guest sync stops retrying when no database exists; blocked localStorage no longer throws in GuestSync.
- Layout: `viewport-fit=cover` (safe-area padding was inert on iPhones), light/dark theme-color, focusable `<main>` for the skip link, root `global-error.tsx`.
- Headers: HSTS, COOP, `X-Powered-By` removed.

## 3D Earth globe
- `components/earth-globe.tsx` + `components/globe/*`: realistic Earth (NASA imagery, day/night shading, clouds, atmosphere, country borders, continent labels) with 26 procedural 3D landmarks on their real coordinates (`lib/landmarks.ts`). Click a landmark to fly to it and open a card linking to its destination.
- The landing hero now centres on this globe and flies to whatever is highlighted in the search box.
- `/explore` uses the same globe with a keyboard-accessible landmark list.
- Textures live in `public/textures/earth/` (from the three.js examples; Natural Earth borders).
