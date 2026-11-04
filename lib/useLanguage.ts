"use client";

import { useEffect, useState } from "react";
import { languageByCode, type Language, type LanguageCode } from "@/lib/languages";
import { useUiStore } from "@/lib/store";

/**
 * The chosen language. Until the component has mounted it reports English so server and client
 * markup match (the real choice lives in localStorage and is only known in the browser).
 */
export function useLanguage(): {
  language: LanguageCode;
  info: Language;
  setLanguage: (code: LanguageCode) => void;
  mounted: boolean;
} {
  const stored = useUiStore((s) => s.language);
  const setLanguage = useUiStore((s) => s.setLanguage);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const language = mounted ? stored : "en";
  return { language, info: languageByCode(language), setLanguage, mounted };
}
