"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  Copy,
  LogIn,
  Pause,
  Play,
  RefreshCw,
  SendHorizontal,
  Square,
  Volume2,
} from "lucide-react";
import { GuideAvatar } from "@/components/guide-avatar";
import { LiveContextStrip } from "@/components/live-context-strip";
import { RichText } from "@/components/rich-text";
import { RoomPresence } from "@/components/room-presence";
import { Button } from "@/components/ui/button";
import { VoiceInputButton } from "@/components/voice-input-button";
import { WeatherCard } from "@/components/weather-card";
import { useRoom } from "@/lib/realtime/useRoom";
import {
  pauseSpeech,
  playSpeech,
  resumeSpeech,
  SPEECH_UNSUPPORTED_MESSAGE,
  stopSpeech,
  type SpeechState,
} from "@/lib/speech";
import { useUiStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import type { Destination, GuideProfile, UiChatMessage } from "@/lib/types";
import { useUser } from "@/lib/useUser";
import { cn } from "@/lib/utils";

const MAX_CONTENT = 4000;
const MAX_MESSAGES_SENT = 30;
const HISTORY_LIMIT = 100;

const apiErrorSchema = z.object({ error: z.string() });
const sessionRowSchema = z.object({ id: z.string() });
const historyRowSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

class ChatRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ChatRequestError";
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Loads the signed-in user's latest conversation for this destination (RLS limits rows to the owner). */
async function loadHistory(userId: string, slug: string): Promise<UiChatMessage[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data: session, error: sessionError } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("destination_slug", slug)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  const parsedSession = sessionRowSchema.safeParse(session);
  if (!parsedSession.success) return [];

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content")
    .eq("session_id", parsedSession.data.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw new Error(error.message);

  const rows = z.array(historyRowSchema).safeParse(data);
  if (!rows.success) throw new Error("Unexpected history format");
  return rows.data.reverse();
}

type HistoryStatus = "idle" | "loading" | "ready" | "error";

interface ChatPanelProps {
  destination: Destination;
  /** Pre-filled question from ?q=, sent once the user is signed in and history has loaded. */
  initialQuestion?: string | null;
}

export function ChatPanel({ destination, initialQuestion = null }: ChatPanelProps) {
  const { slug, name, starterQuestions, pois, guide } = destination;
  const pathname = usePathname();
  const { user, loading: userLoading } = useUser();
  const userId = user?.id ?? null;
  const openAuthDialog = useUiStore((s) => s.openAuthDialog);
  const room = useRoom(slug);

  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [historyStatus, setHistoryStatus] = useState<HistoryStatus>("idle");
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const [speech, setSpeech] = useState<{ id: string; state: SpeechState } | null>(null);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const streamingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSentRef = useRef(false);
  const dictationBaseRef = useRef("");

  const returnPath = useCallback(
    (): string => `${pathname}${typeof window !== "undefined" ? window.location.search : ""}`,
    [pathname],
  );

  // Stop streaming and speech when leaving the page.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      stopSpeech();
    },
    [],
  );

  // History for signed-in users; signed-out visitors start fresh.
  useEffect(() => {
    if (userLoading) return;
    if (!userId) {
      setMessages([]);
      setHistoryStatus("ready");
      return;
    }
    let cancelled = false;
    setHistoryStatus("loading");
    loadHistory(userId, slug)
      .then((history) => {
        if (cancelled) return;
        // Don't clobber a conversation the user already started while this was loading.
        setMessages((current) => (current.length > 0 ? current : history));
        setHistoryStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setHistoryStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, userLoading, slug, historyAttempt]);

  // Keep the newest text in view unless the reader scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, historyStatus]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  const streamReply = useCallback(
    async (base: UiChatMessage[]): Promise<void> => {
      const assistantId = newId();
      const controller = new AbortController();
      abortRef.current = controller;
      streamingRef.current = true;
      setStreaming(true);
      setErrorNote(null);
      setMessages([...base, { id: assistantId, role: "assistant", content: "", streaming: true }]);

      const patch = (update: (m: UiChatMessage) => UiChatMessage): void =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? update(m) : m)));
      const drop = (): void => setMessages((prev) => prev.filter((m) => m.id !== assistantId));

      try {
        const payload = base
          .filter((m) => !m.failed && m.content.trim())
          .slice(-MAX_MESSAGES_SENT)
          .map(({ role, content }) => ({ role, content: content.slice(0, MAX_CONTENT) }));

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, messages: payload }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const body = apiErrorSchema.safeParse(await response.json().catch(() => null));
          throw new ChatRequestError(
            body.success ? body.data.error : "The guide couldn't be reached. Please try again.",
            response.status,
          );
        }

        // RT-1: read the text/plain stream chunk by chunk and append tokens as they arrive.
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let received = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          if (!text) continue;
          received += text;
          patch((m) => ({ ...m, content: received }));
        }

        if (!received.trim()) throw new ChatRequestError("The guide sent an empty reply.", 502);
        patch((m) => ({ ...m, streaming: false }));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          // User pressed Stop (or left). Keep whatever text arrived.
          setMessages((prev) =>
            prev
              .map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
              .filter((m) => m.id !== assistantId || m.content.trim()),
          );
        } else if (error instanceof ChatRequestError && error.status === 401) {
          drop();
          setErrorNote("Your session has expired. Please sign in again.");
          openAuthDialog(returnPath());
        } else {
          patch((m) => ({ ...m, streaming: false, failed: true }));
          setErrorNote(
            error instanceof ChatRequestError
              ? error.message
              : "Connection lost while the guide was replying.",
          );
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        streamingRef.current = false;
        setStreaming(false);
      }
    },
    [slug, openAuthDialog, returnPath],
  );

  const send = useCallback(
    async (raw: string): Promise<void> => {
      const text = raw.trim();
      if (!text || streamingRef.current) return;
      if (!userId) {
        toast("Sign in to chat with your local guide.");
        openAuthDialog(returnPath());
        return;
      }
      setInput("");
      stickRef.current = true;
      const userMessage: UiChatMessage = {
        id: newId(),
        role: "user",
        content: text.slice(0, MAX_CONTENT),
      };
      await streamReply([...messagesRef.current.filter((m) => !m.failed), userMessage]);
    },
    [userId, openAuthDialog, returnPath, streamReply],
  );

  const retry = useCallback((): void => {
    if (streamingRef.current) return;
    const current = messagesRef.current.filter((m) => !m.failed);
    if (current[current.length - 1]?.role !== "user") return;
    stickRef.current = true;
    void streamReply(current);
  }, [streamReply]);

  // Deep link from a starter question or POI: send once when signed in and history is ready.
  useEffect(() => {
    if (!initialQuestion || autoSentRef.current) return;
    if (userLoading || !userId || historyStatus === "idle" || historyStatus === "loading") return;
    autoSentRef.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    void send(initialQuestion);
  }, [initialQuestion, userLoading, userId, historyStatus, send]);

  const toggleSpeech = useCallback(
    (id: string, text: string): void => {
      if (speech?.id === id && speech.state === "speaking") {
        pauseSpeech();
        return;
      }
      if (speech?.id === id && speech.state === "paused") {
        resumeSpeech();
        return;
      }
      const result = playSpeech(text, {
        onStateChange: (state) =>
          setSpeech((prev) => {
            if (state === "idle") return prev?.id === id ? null : prev;
            return { id, state };
          }),
        onError: () => toast.error("Read-aloud stopped unexpectedly."),
      });
      if (!result.ok) toast(result.message ?? SPEECH_UNSUPPORTED_MESSAGE);
    },
    [speech],
  );

  const handleDictationStart = useCallback((): void => {
    dictationBaseRef.current = textareaRef.current?.value.trim() ?? "";
  }, []);
  const handleDictation = useCallback((text: string): void => {
    const base = dictationBaseRef.current;
    setInput((base ? `${base} ${text}` : text).slice(0, MAX_CONTENT));
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void send(input);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(input);
    }
  };

  const historyLoading = historyStatus === "loading" || historyStatus === "idle";
  const showEmpty = !historyLoading && messages.length === 0;
  const lastMessage = messages[messages.length - 1];
  const canRetryLast = !streaming && lastMessage?.role === "assistant" && lastMessage.failed;

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && !m.streaming && m.content.trim());
  const lastAssistantSpeech = lastAssistant && speech?.id === lastAssistant.id ? speech.state : "idle";
  const chips = starterQuestions.slice(0, 3);

  return (
    <section
      aria-label={`Chat with ${guide.name}, your ${name} guide`}
      className="mx-auto grid h-[calc(100dvh-4rem)] max-w-[1600px] gap-4 px-3 py-3 sm:px-5 lg:grid-cols-[17rem_minmax(0,1fr)_17rem]"
    >
      {/* Left rail (desktop): who you're talking to, local conditions, who else is here. */}
      <aside className="hidden min-h-0 flex-col gap-3 overflow-y-auto lg:flex" aria-label="About your guide">
        <div className="panel p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Your guide</p>
          <div className="flex items-center gap-3">
            <GuideAvatar guide={guide} size="md" online />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{guide.name}</p>
              <p className="text-sm text-muted-foreground">{guide.role}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-success">
                <span className="presence-dot !h-2 !w-2" aria-hidden="true" /> Online
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">AI guide, powered by Meta&apos;s Muse models.</p>
        </div>
        <div>
          <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">Live context</p>
          <WeatherCard slug={slug} place={`${name}, ${destination.country}`} />
        </div>
        <div className="panel p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Room presence</p>
          <RoomPresence room={room} pois={pois} className="flex-wrap" />
        </div>
      </aside>

      {/* Center: the conversation. */}
      <div className="flex min-h-0 min-w-0 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-2 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={`/destination/${slug}`}
              aria-label={`Back to ${name}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border hover:bg-muted"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </Link>
            <GuideAvatar guide={guide} size="sm" online className="lg:hidden" />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold sm:text-2xl">
                Chat with {guide.name}
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                Your {name} guide · {destination.country}
              </p>
            </div>
          </div>
          <RoomPresence room={room} pois={pois} className="lg:hidden" />
        </header>

        <div
          ref={scrollRef}
          onScroll={(event) => {
            const el = event.currentTarget;
            stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          role="log"
          aria-label="Conversation"
          aria-live="polite"
          aria-relevant="additions"
          aria-busy={streaming}
          className="panel min-h-0 flex-1 space-y-4 overflow-y-auto p-3 sm:p-5"
        >
          {historyLoading && (
            <div role="status" aria-label="Loading your conversation" className="space-y-4">
              <div className="skeleton h-16 w-3/4 rounded-2xl" />
              <div className="skeleton ml-auto h-10 w-1/2 rounded-2xl" />
              <div className="skeleton h-20 w-4/5 rounded-2xl" />
            </div>
          )}

          {historyStatus === "error" && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm"
            >
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                Couldn&apos;t load your earlier conversation. You can still chat.
              </span>
              <Button size="sm" variant="outline" onClick={() => setHistoryAttempt((n) => n + 1)}>
                <RefreshCw aria-hidden="true" />
                Retry
              </Button>
            </div>
          )}

          {!userLoading && !userId && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-3 text-sm">
              <span>Sign in to chat with {guide.name} and keep your conversation history.</span>
              <Button size="sm" onClick={() => openAuthDialog(returnPath())}>
                <LogIn aria-hidden="true" />
                Sign in
              </Button>
            </div>
          )}

          {showEmpty && (
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-3">
                <GuideAvatar guide={guide} />
                <p className="max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm">
                  {guide.greeting} I&apos;m {guide.name}, your local guide in {name}. Ask me where to eat,
                  what to see, or how the day is shaping up outside right now. What would you like to
                  explore first?
                </p>
              </div>
              <div className="lg:hidden">
                <p className="mb-2 text-xs text-muted-foreground">Try asking:</p>
                <ul className="flex flex-wrap gap-2">
                  {starterQuestions.map((question) => (
                    <li key={question}>
                      <button
                        type="button"
                        onClick={() => void send(question)}
                        disabled={streaming || userLoading}
                        className="min-h-11 rounded-2xl border bg-card px-4 py-2 text-left text-sm transition hover:border-primary hover:bg-muted disabled:opacity-60"
                      >
                        {question}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              guide={guide}
              speechState={speech?.id === message.id ? speech.state : "idle"}
              onToggleSpeech={toggleSpeech}
              onStopSpeech={stopSpeech}
            />
          ))}

          {errorNote && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm"
            >
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                {errorNote}
              </span>
              {canRetryLast && (
                <Button size="sm" variant="outline" onClick={retry}>
                  <RefreshCw aria-hidden="true" />
                  Try again
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="safe-bottom space-y-2 pt-3">
          {messages.length > 0 && !streaming && (
            <ul className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1" aria-label="Quick questions">
              {chips.map((question) => (
                <li key={question} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => void send(question)}
                    className="min-h-11 rounded-full border bg-card/70 px-4 text-xs transition hover:border-primary hover:bg-primary/10"
                  >
                    {question}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <LiveContextStrip slug={slug} />
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <label htmlFor="chat-input" className="sr-only">
              Message {guide.name}
            </label>
            <textarea
              id="chat-input"
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={MAX_CONTENT}
              placeholder={userId ? `Ask ${guide.name} about ${name}…` : "Sign in to start chatting"}
              className="max-h-36 min-h-11 flex-1 resize-none rounded-2xl border bg-card px-4 py-2.5 text-base placeholder:text-muted-foreground focus-visible:outline-none sm:text-sm"
            />
            <VoiceInputButton
              onStart={handleDictationStart}
              onTranscript={handleDictation}
              disabled={streaming}
            />
            {streaming ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                aria-label="Stop the reply"
                onClick={() => abortRef.current?.abort()}
              >
                <Square className="fill-current" aria-hidden="true" />
              </Button>
            ) : (
              <Button type="submit" size="icon" aria-label="Send message" disabled={!input.trim()}>
                <SendHorizontal aria-hidden="true" />
              </Button>
            )}
          </form>
        </div>
      </div>

      {/* Right rail (desktop): ideas and read-aloud. */}
      <aside className="hidden min-h-0 flex-col gap-3 overflow-y-auto lg:flex" aria-label="Suggestions">
        <div className="panel p-4">
          <h2 className="mb-3 font-sans text-sm font-semibold">Suggested questions</h2>
          <ul className="space-y-2">
            {starterQuestions.map((question) => (
              <li key={question}>
                <button
                  type="button"
                  onClick={() => void send(question)}
                  disabled={streaming || userLoading}
                  className="min-h-11 w-full rounded-xl border bg-card/60 px-3 py-2 text-left text-xs transition hover:border-primary hover:bg-primary/10 disabled:opacity-60"
                >
                  {question}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <Button
          variant="outline"
          disabled={!lastAssistant}
          onClick={() => lastAssistant && toggleSpeech(lastAssistant.id, lastAssistant.content)}
          className="h-12 border-primary/40 text-primary"
        >
          {lastAssistantSpeech === "speaking" ? (
            <Pause aria-hidden="true" />
          ) : (
            <Volume2 aria-hidden="true" />
          )}
          {lastAssistantSpeech === "speaking" ? "Pause" : lastAssistantSpeech === "paused" ? "Resume" : "Read aloud"}
        </Button>
      </aside>
    </section>
  );
}

interface MessageBubbleProps {
  message: UiChatMessage;
  guide: GuideProfile;
  speechState: SpeechState;
  onToggleSpeech: (id: string, text: string) => void;
  onStopSpeech: () => void;
}

// Memoized so each streamed token only re-renders the bubble that is changing.
const MessageBubble = memo(function MessageBubble({
  message,
  guide,
  speechState,
  onToggleSpeech,
  onStopSpeech,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const copyReply = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  };

  if (message.role === "user") {
    return (
      <article className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          <span className="sr-only">You said: </span>
          {message.content}
        </p>
      </article>
    );
  }

  const waiting = message.streaming && !message.content;
  const canSpeak = !message.streaming && message.content.trim().length > 0;
  const speaking = speechState !== "idle";

  return (
    <article className="flex items-start gap-3">
      <GuideAvatar guide={guide} />
      <div className="min-w-0 max-w-[85%] space-y-1">
        <div
          className={cn(
            "rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm",
            message.failed && "border border-destructive/40",
          )}
        >
          <span className="sr-only">Guide said: </span>
          {waiting ? (
            <span role="status" className="flex items-center gap-1 py-1">
              <span className="sr-only">The guide is typing</span>
              <span className="typing-dot" style={{ animationDelay: "0ms" }} aria-hidden="true" />
              <span className="typing-dot" style={{ animationDelay: "150ms" }} aria-hidden="true" />
              <span className="typing-dot" style={{ animationDelay: "300ms" }} aria-hidden="true" />
            </span>
          ) : (
            <RichText text={message.content} />
          )}
          {message.failed && message.content && (
            <p className="mt-2 text-xs text-muted-foreground">This reply was interrupted.</p>
          )}
        </div>

        {canSpeak && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleSpeech(message.id, message.content)}
              aria-label={
                speechState === "speaking"
                  ? "Pause reading aloud"
                  : speechState === "paused"
                    ? "Resume reading aloud"
                    : "Read this reply aloud"
              }
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {speechState === "speaking" ? (
                <Pause className="h-4 w-4" aria-hidden="true" />
              ) : speechState === "paused" ? (
                <Play className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Volume2 className="h-4 w-4" aria-hidden="true" />
              )}
              {speechState === "speaking" ? "Pause" : speechState === "paused" ? "Resume" : "Listen"}
            </button>
            <button
              type="button"
              onClick={() => void copyReply()}
              aria-label={copied ? "Reply copied" : "Copy this reply"}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
            {speaking && (
              <button
                type="button"
                onClick={onStopSpeech}
                aria-label="Stop reading aloud"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Square className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
});
