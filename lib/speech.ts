/*
  Thin wrapper over the browser SpeechSynthesis API.
  One utterance queue at a time: starting a new read-aloud stops the previous one.
  Long text is split into sentences because Chrome silently cuts off long utterances.
*/

export type SpeechState = "idle" | "speaking" | "paused";

export interface SpeechHandlers {
  onStateChange?: (state: SpeechState) => void;
  onEnd?: () => void;
  onError?: () => void;
}

export interface SpeechResult {
  ok: boolean;
  /** Friendly message to show when ok is false. */
  message?: string;
}

export const SPEECH_UNSUPPORTED_MESSAGE =
  "Read-aloud isn't supported in this browser. Try Chrome, Edge or Safari.";

let session = 0;
let activeHandlers: SpeechHandlers | null = null;

export function isSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

/** Removes markdown noise and emoji so the voice doesn't read symbols aloud. */
function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_`#>~]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoChunks(text: string, maxLength = 200): string[] {
  const sentences = text.match(/[^.!?…]+[.!?…]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && (current + sentence).length > maxLength) {
      chunks.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const prefix = lang.slice(0, 2).toLowerCase();
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ??
    null
  );
}

export function playSpeech(
  text: string,
  handlers: SpeechHandlers = {},
  lang?: string,
): SpeechResult {
  if (!isSpeechSupported()) {
    return { ok: false, message: SPEECH_UNSUPPORTED_MESSAGE };
  }

  const chunks = splitIntoChunks(cleanForSpeech(text));
  if (chunks.length === 0) {
    return { ok: false, message: "There's nothing to read aloud yet." };
  }

  stopSpeech();
  const id = ++session;
  activeHandlers = handlers;
  const language = lang ?? (document.documentElement.lang || "en-US");
  const voice = pickVoice(language);
  const lastIndex = chunks.length - 1;

  chunks.forEach((chunk, index) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = language;
    if (voice) utterance.voice = voice;
    utterance.rate = 1;

    utterance.onstart = () => {
      if (id === session && index === 0) handlers.onStateChange?.("speaking");
    };
    utterance.onend = () => {
      if (id !== session || index !== lastIndex) return;
      activeHandlers = null;
      handlers.onStateChange?.("idle");
      handlers.onEnd?.();
    };
    utterance.onerror = (event) => {
      if (id !== session) return;
      // "canceled"/"interrupted" are normal when the user stops playback.
      if (event.error === "canceled" || event.error === "interrupted") return;
      activeHandlers = null;
      handlers.onStateChange?.("idle");
      handlers.onError?.();
    };

    window.speechSynthesis.speak(utterance);
  });

  return { ok: true };
}

export function pauseSpeech(): void {
  if (!isSpeechSupported() || !activeHandlers) return;
  window.speechSynthesis.pause();
  activeHandlers.onStateChange?.("paused");
}

export function resumeSpeech(): void {
  if (!isSpeechSupported() || !activeHandlers) return;
  window.speechSynthesis.resume();
  activeHandlers.onStateChange?.("speaking");
}

export function stopSpeech(): void {
  session += 1; // invalidates any pending utterance callbacks
  if (isSpeechSupported()) window.speechSynthesis.cancel();
  const handlers = activeHandlers;
  activeHandlers = null;
  handlers?.onStateChange?.("idle");
}
