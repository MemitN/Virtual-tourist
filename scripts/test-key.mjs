// Usage (from the project folder):  node scripts/test-key.mjs
// Tries your MODEL_API_KEY against every provider/model/auth format the app can use and tells you
// which ones work, plus which Muse models your Meta account can see. It never prints the key.
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const key = env.META_API_KEY || env.MODEL_API_KEY || env.BASETEN_API_KEY;
if (!key) { console.log("No key found. Put MODEL_API_KEY=... in .env.local first."); process.exit(1); }
console.log(`Key found: ${key.length} characters, starts with "${key.slice(0, 4)}"\n`);

const variants = [["as written", key]];
if (/^b10[_-]/i.test(key)) variants.push(["without the b10_ prefix", key.replace(/^b10[_-]/i, "")]);

const chat = (model) => ({ model, messages: [{ role: "user", content: "Say pong" }], max_tokens: 20 });
const targets = [
  ...["muse-spark-1.3", "muse-spark-1.2", "muse-spark-1.1"].map((m) => ({ name: `Meta ${m}`, url: "https://api.meta.ai/v1/chat/completions", body: chat(m), schemes: ["Bearer"] })),
  { name: "Meta Responses API", url: "https://api.meta.ai/v1/responses", body: { model: "muse-spark-1.3", input: "Say pong", max_output_tokens: 20 }, schemes: ["Bearer"] },
  { name: "Baseten", url: "https://inference.baseten.co/v1/chat/completions", body: chat("meta-models/muse-spark-open"), schemes: ["Bearer", "Api-Key"] },
];

let worked = false;
for (const t of targets) for (const [label, k] of variants) for (const scheme of t.schemes) {
  try {
    const res = await fetch(t.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `${scheme} ${k}` },
      body: JSON.stringify(t.body),
      signal: AbortSignal.timeout(30000),
    });
    const text = (await res.text()).slice(0, 140).replace(/\s+/g, " ");
    console.log(`${res.ok ? "WORKS " : "failed"}  ${t.name.padEnd(24)} key ${label.padEnd(24)} auth=${scheme.padEnd(7)} -> HTTP ${res.status} ${res.ok ? "" : text}`);
    if (res.ok) worked = true;
  } catch (e) {
    console.log(`error   ${t.name} ${label} ${scheme}: ${e.cause?.code ?? e.message}`);
  }
}

try {
  const res = await fetch("https://api.meta.ai/v1/models", { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
  if (res.ok) {
    const json = await res.json();
    console.log("\nModels your Meta key can use:", (json.data ?? []).map((m) => m.id).join(", ") || "(none listed)");
  }
} catch { /* optional */ }

console.log(worked
  ? "\nAt least one combination works. The app tries them all automatically, so you can just run: npm run dev"
  : "\nNothing worked. Common causes: the key is for another service; Meta's Model API public preview is US-only (use a Baseten key from the hackathon credits instead); or your network blocks the host.");
