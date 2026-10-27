# AI Virtual Tourism

Explore Paris, Tokyo, Marrakech, Kyoto, Lisbon and Cape Town with an AI local guide, AI-generated 360° panoramas, and other travelers in shared real-time rooms. Built for the Meta Global AI Developer Hackathon (Build for Your World).

**Meta models used (via Meta Model API):** `muse-spark-1.3` (streamed guide chat), `muse-image-1.0` (panoramas), `sam-3.1` (segmentation API), `muse-wonder-1.0` (itinerary planning, stubbed).

## Setup (8 steps)

1. **Install:** Node 18.18+ required. Run `npm install`.
2. **Env file:** `cp .env.example .env.local`.
3. **Get `MODEL_API_KEY`:** Sign in to the Meta developer portal used for the hackathon, open the Meta Model API section, create an API key, and paste it into `MODEL_API_KEY`. Keep it server-side only. Leave `MUSE_IMAGE_ENABLED=false` until you want to spend image credits.
4. **Create a Supabase project** at supabase.com. Copy Project URL, anon key and service role key (Settings → API) into `.env.local`.
5. **Apply the database:** run the SQL in `supabase/migrations/0001_init.sql` in the Supabase SQL Editor (or `supabase db push` with the CLI).
6. **Auth + Storage:** In Authentication → URL Configuration set Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to Redirect URLs. The migration already creates the public `panoramas` Storage bucket (check Storage to confirm).
7. **Run:** `npm run dev` and open http://localhost:3000. LiveKit is optional; with `NEXT_PUBLIC_LIVEKIT_URL` unset the Live Feed shows a friendly placeholder.
8. **Deploy to Vercel:** Push to GitHub, import the repo in Vercel, add every variable from `.env.example` in Project Settings → Environment Variables, deploy, then add your Vercel domain and `https://<domain>/auth/callback` to Supabase Redirect URLs.

## Scripts

`npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint`
