"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Pause, Play, RefreshCw, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import { RichText } from "@/components/rich-text";
import { Button } from "@/components/ui/button";
import { fetchExplanation } from "@/lib/ai-client";
import { pauseSpeech, playSpeech, resumeSpeech, stopSpeech, type SpeechState } from "@/lib/speech";
import { useLanguage } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";

interface ExplainPanelProps {
  slug: string;
  /** Landmark id; omit to explain the whole place. */
  poiId?: string | null;
  /** What the button says it will explain, e.g. "Kyoto" or "Fushimi Inari". */
  subject: string;
  guideName: string;
  tone?: "default" | "dark";
  className?: string;
}

type Status = "idle" | "loading" | "ready" | "error";

/** An AI-written explanation of a place or landmark, in the chosen language, with read-aloud. */
export function ExplainPanel({ slug, poiId = null, subject, guideName, tone = "default", className }: ExplainPanelProps) {
  const { language, info } = useLanguage();
  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [speech, setSpeech] = useState<SpeechState>("idle");
  const abortRef = useRef<AbortController | null>(null);
  // Only auto-refresh on language change once the traveler has asked for an explanation.
  const requestedRef = useRef(false);

  const load = useCallback(async (): Promise<void> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    requestedRef.current = true;
    setStatus("loading");
    setNote(null);
    try {
      const result = await fetchExplanation(slug, poiId, language, controller.signal);
      setText(result.text);
      setStatus("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNote(error instanceof Error ? error.message : "Couldn't load the explanation.");
      setStatus("error");
    }
  }, [slug, poiId, language]);

  useEffect(() => {
    if (requestedRef.current) void load();
  }, [load]);

  // Reset when the landmark changes, and stop speech/requests on unmount.
  useEffect(() => {
    requestedRef.current = false;
    setStatus("idle");
    setText("");
    stopSpeech();
    setSpeech("idle");
  }, [slug, poiId]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      stopSpeech();
    },
    [],
  );

  const toggleSpeech = (): void => {
    if (speech === "speaking") return pauseSpeech();
    if (speech === "paused") return resumeSpeech();
    const result = playSpeech(
      text,
      { onStateChange: setSpeech, onError: () => toast.error("Read-aloud stopped unexpectedly.") },
      info.speech,
    );
    if (!result.ok && result.message) toast(result.message);
  };

  const dark = tone === "dark";

  if (status === "idle") {
    return (
      <Button
        onClick={() => void load()}
        variant={dark ? "glass" : "outline"}
        size="sm"
        className={cn("w-fit", className)}
      >
        <Sparkles aria-hidden="true" />
        Explain {subject}
        {language !== "en" && <span className="opacity-70">· {info.native}</span>}
      </Button>
    );
  }

  return (
    <div className={cn("space-y-3", className)} aria-live="polite">
      {status === "loading" && (
        <p role="status" className="flex items-center gap-2 text-sm opacity-80">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {guideName} is writing about {subject}…
        </p>
      )}

      {status === "error" && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          <span>{note}</span>
          <Button size="sm" variant={dark ? "glass" : "outline"} onClick={() => void load()}>
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        </div>
      )}

      {status === "ready" && (
        <>
          <div className={cn("text-sm leading-relaxed", dark ? "text-white/90" : "text-foreground/90")}>
            <RichText text={text} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={dark ? "glass" : "outline"} onClick={toggleSpeech}>
              {speech === "speaking" ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              {speech === "speaking" ? "Pause" : speech === "paused" ? "Resume" : "Listen"}
            </Button>
            {speech !== "idle" && (
              <Button
                size="icon"
                variant={dark ? "glass" : "outline"}
                aria-label="Stop reading aloud"
                onClick={() => {
                  stopSpeech();
                  setSpeech("idle");
                }}
              >
                <Square className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
            <span className="text-xs opacity-70">Written by {guideName} (AI) in {info.label}</span>
          </div>
        </>
      )}
    </div>
  );
}
