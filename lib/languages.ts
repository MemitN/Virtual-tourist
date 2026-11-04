export const LANGUAGE_CODES = [
  "en", "sw", "fr", "es", "pt", "ar", "de", "it", "zh", "ja", "ko", "hi", "tr", "ru",
] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export interface Language {
  code: LanguageCode;
  /** English name, used in prompts. */
  label: string;
  /** Name in its own language, shown in the picker. */
  native: string;
  /** BCP-47 tag for speech synthesis and recognition. */
  speech: string;
  rtl?: boolean;
}

export const LANGUAGES: readonly Language[] = [
  { code: "en", label: "English", native: "English", speech: "en-US" },
  { code: "sw", label: "Swahili", native: "Kiswahili", speech: "sw-KE" },
  { code: "fr", label: "French", native: "Français", speech: "fr-FR" },
  { code: "es", label: "Spanish", native: "Español", speech: "es-ES" },
  { code: "pt", label: "Portuguese", native: "Português", speech: "pt-PT" },
  { code: "ar", label: "Arabic", native: "العربية", speech: "ar-SA", rtl: true },
  { code: "de", label: "German", native: "Deutsch", speech: "de-DE" },
  { code: "it", label: "Italian", native: "Italiano", speech: "it-IT" },
  { code: "zh", label: "Chinese", native: "中文", speech: "zh-CN" },
  { code: "ja", label: "Japanese", native: "日本語", speech: "ja-JP" },
  { code: "ko", label: "Korean", native: "한국어", speech: "ko-KR" },
  { code: "hi", label: "Hindi", native: "हिन्दी", speech: "hi-IN" },
  { code: "tr", label: "Turkish", native: "Türkçe", speech: "tr-TR" },
  { code: "ru", label: "Russian", native: "Русский", speech: "ru-RU" },
];

export function languageByCode(code: LanguageCode): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]!;
}
