"use client";

import { useEffect } from "react";
import { Check, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUAGES } from "@/lib/languages";
import { useLanguage } from "@/lib/useLanguage";

/** Picks the language for translations, guide replies, read-aloud and voice input. */
export function LanguageSwitcher() {
  const { language, info, setLanguage, mounted } = useLanguage();

  // Keep <html lang> and direction in step so screen readers and speech pick the right voice.
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.lang = info.speech;
    document.documentElement.dir = info.rtl ? "rtl" : "ltr";
  }, [mounted, info]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-11 gap-2 px-3 text-muted-foreground"
          aria-label={`Language: ${info.label}. Change language`}
        >
          <Languages aria-hidden="true" />
          <span className="hidden text-sm sm:inline">{info.native}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70dvh] w-56 overflow-y-auto">
        <DropdownMenuLabel>Translate places & chat into</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem key={lang.code} onSelect={() => setLanguage(lang.code)} className="min-h-11 justify-between">
            <span>
              {lang.native}
              {lang.native !== lang.label && <span className="ml-2 text-xs text-muted-foreground">{lang.label}</span>}
            </span>
            {language === lang.code && <Check className="h-4 w-4 text-primary" aria-label="Selected" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
