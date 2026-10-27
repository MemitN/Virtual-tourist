import type { GuideProfile } from "@/lib/types";

/** Diverse, deterministic guide names for places outside the curated six. */
const NAMES = [
  "Amara", "Kenji", "Sofía", "Omar", "Priya", "Mateus", "Zanele", "Elif",
  "Lars", "Mei", "Tariq", "Chloé", "Diego", "Nia", "Anika", "Jomo",
  "Leila", "Mateo", "Yuki", "Kwame", "Ingrid", "Rafael", "Selam", "Noor",
] as const;

const GREETINGS: Readonly<Record<string, string>> = {
  fr: "Bonjour!", jp: "Konnichiwa!", ma: "Salaam!", pt: "Olá!", za: "Sawubona!",
  ke: "Karibu!", tz: "Karibu!", es: "¡Hola!", mx: "¡Hola!", ar: "¡Hola!", cl: "¡Hola!",
  co: "¡Hola!", pe: "¡Hola!", it: "Ciao!", de: "Hallo!", at: "Servus!", ch: "Grüezi!",
  br: "Olá!", in: "Namaste!", eg: "Ahlan!", tr: "Merhaba!", gr: "Yassou!",
  th: "Sawasdee!", kr: "Annyeong!", cn: "Nǐ hǎo!", id: "Halo!", vn: "Xin chào!",
  ru: "Privet!", ie: "Dia duit!", nl: "Hoi!", se: "Hej!", no: "Hei!", dk: "Hej!",
  fi: "Hei!", pl: "Cześć!", cz: "Ahoj!", hu: "Szia!", is: "Halló!", au: "G'day!",
  nz: "Kia ora!", us: "Hey there!", gb: "Hello!", ae: "Marhaba!", sa: "Marhaba!",
  jo: "Marhaba!", et: "Selam!", gh: "Akwaaba!", rw: "Muraho!", ph: "Kumusta!",
  my: "Selamat datang!", sg: "Hello!", ca: "Hello!",
};

function hash(seed: string): number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

export function pickGuide(seed: string, countryCode: string): GuideProfile {
  const h = hash(seed);
  return {
    name: NAMES[h % NAMES.length] ?? "Amara",
    role: "Local expert",
    greeting: GREETINGS[countryCode.toLowerCase()] ?? "Hello!",
    hue: h % 360,
  };
}
