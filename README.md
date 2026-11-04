# AI Virtual Tourism

Explore **any place on Earth** with an AI local guide, 360° tours, a trip toolkit and 14 languages. Built for the Meta Global AI Developer Hackathon (Build for Your World).

**Meta models:** `muse-spark-1.3` (with automatic fallback to 1.2 / 1.1 and Baseten's `muse-spark-open`) powers guide chat, translation, explanations and the trip toolkit. `muse-image-1.0` (optional panoramas) and `sam-3.1` (segmentation API) are also wired in.

## Quick start (2 steps, no other accounts needed)

1. `npm install`
2. Copy `.env.example` to `.env.local`, paste your key into `MODEL_API_KEY`, then `npm run dev`.

Open http://localhost:3000. Then open **http://localhost:3000/api/health**: it tries every provider/model and tells you which one answers. If something is off, run `node scripts/test-key.mjs`.

If you change `.env.local`, stop and restart `npm run dev`. If the app looks stale, delete the `.next` folder first.

## Features
- **AI local guide** per place, streamed, in 14 languages, with live weather and local time. Works as a guest; history is kept in your browser.
- **Trip toolkit** (`/destination/<place>/plan`): AI itinerary (days, interests, pace, budget; copy or print), phrasebook with read-aloud, travel essentials, and a weather-aware packing checklist.
- **Any city, landmark or country** via search, a 3D globe and an explore page.
- **360° tour** with landmark hotspots and "Explain" for each landmark.
- **Translate** any text or chat reply on demand; **read aloud** and **voice input**.
- **My trips** (`/trips`): save itineraries to your account (or this browser), reopen, copy, print, delete.
- **Favorites** (saved in the browser; synced to your account if Supabase is on), share links, installable PWA.

## Database (Supabase): optional, and your existing data is safe
Without Supabase the app runs in guest mode (history, favorites and saved trips live in the browser). With it you get sign-in, synced favorites, saved chat history and saved trips.

1. Create a Supabase project and put its URL and anon key in `.env.local`.
2. In the SQL editor run, in order: `supabase/migrations/0001_init.sql`, then `supabase/migrations/0002_saved_trips.sql`.
3. Auth settings: set the redirect URL to `http://localhost:3000/auth/callback`.
4. Check everything at `http://localhost:3000/api/health` (the `database` section lists every table and tells you which migration is missing).

**Upgrading an existing database:** only run `0002_saved_trips.sql`. It is additive and idempotent: it creates one new table (`saved_trips`) with row-level security and changes nothing in `profiles`, `favorites`, `chat_sessions` or `chat_messages`. Until you run it the app still works and saves trips on the device instead.

**Guest to account:** anything saved as a guest (favorites, trips) moves into the account automatically the first time the person signs in. Chat history can be cleared from the chat header (deletes it from the database when signed in).

LiveKit live feed is likewise optional.

## Deploy
Push to GitHub, import in Vercel, add the variables from `.env.example`, deploy. (`/api/health` is disabled in production.)

## Scripts
`npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `node scripts/test-key.mjs`
