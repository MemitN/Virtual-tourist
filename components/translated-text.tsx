"use client";

import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { fetchTranslation } from "@/lib/ai-client";
import { useLanguage } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";

interface TranslatedTextProps {
  text: string;
  className?: string;
  /** Show the "translated by AI" toggle (off for tiny labels). */
  showToggle?: boolean;
}

/** Renders text as-is in English; otherwise translates it on demand into the chosen language. */
export function TranslatedText({ text, className, showToggle = true }: TranslatedTextProps) {
  const { language, info } = useLanguage();
  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    setTranslated(null);
    setFailed(false);
    setShowOriginal(false);
    if (language === "en") return;

    const controller = new AbortController();
    setLoading(true);
    fetchTranslation(text, language, controller.signal)
      .then((result) => {
        // Demo mode returns the original untouched; treat as "nothing to show".
        setTranslated(result.demo ? null : result.text);
        setFailed(result.demo);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [text, language]);

  const shown = translated && !showOriginal ? translated : text;

  return (
    <span className="block">
      <span className={cn(className, loading && "opacity-60 transition-opacity")} aria-busy={loading}>
        {shown}
      </span>
      {showToggle && language !== "en" && (
        <span className="mt-1 flex min-h-6 items-center gap-1.5 text-xs opacity-80" role="status">
          <Languages className="h-3.5 w-3.5" aria-hidden="true" />
          {loading && `Translating to ${info.label}…`}
          {!loading && failed && "Translation unavailable right now. Showing the original."}
          {!loading && translated && (
            <>
              {showOriginal ? "Original" : `Translated to ${info.label} by AI`}
              <button
                type="button"
                onClick={() => setShowOriginal((v) => !v)}
                className="min-h-11 rounded px-1 font-medium underline underline-offset-2"
              >
                {showOriginal ? "Show translation" : "Show original"}
              </button>
            </>
          )}
        </span>
      )}
    </span>
  );
}
