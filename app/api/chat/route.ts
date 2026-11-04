import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { z } from "zod";
import { checkRateLimit, jsonError, readJson } from "@/lib/api-utils";
import { createClient } from "@/lib/supabase/server";
import { createDemoStream } from "@/lib/demo-guide";
import { createChatStream, isMetaConfigured, logAiError } from "@/lib/meta-client";
import { buildGuidePrompt } from "@/lib/prompts";
import { publishContext } from "@/lib/realtime/publishContext";
import { chatBodySchema } from "@/lib/schemas";
import { getLiveContext } from "@/lib/weather";
import { resolveDestination } from "@/lib/world";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HISTORY_FOR_MODEL = 20;
const sessionRowSchema = z.object({ id: z.string().uuid() });

function toParam(message: ChatMessage): ChatCompletionMessageParam {
  return message.role === "user"
    ? { role: "user", content: message.content }
    : { role: "assistant", content: message.content };
}

/** Finds (or creates) the user's session for this destination and stores the user message. */
async function persistUserMessage(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
  content: string,
): Promise<string | null> {
  try {
    const { data: existing } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("destination_slug", slug)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let sessionId = sessionRowSchema.safeParse(existing).data?.id ?? null;
    if (!sessionId) {
      const { data: created } = await supabase
        .from("chat_sessions")
        .insert({ user_id: userId, destination_slug: slug })
        .select("id")
        .single();
      sessionId = sessionRowSchema.safeParse(created).data?.id ?? null;
    }
    if (!sessionId) return null;

    await supabase
      .from("chat_messages")
      .insert({ session_id: sessionId, role: "user", content });
    return sessionId;
  } catch {
    return null; // History is a nice-to-have; never block the chat.
  }
}

async function persistAssistantMessage(
  supabase: SupabaseClient,
  sessionId: string | null,
  content: string,
): Promise<void> {
  if (!sessionId || !content.trim()) return;
  try {
    await supabase
      .from("chat_messages")
      .insert({ session_id: sessionId, role: "assistant", content });
  } catch {
    // Ignore: see above.
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) return jsonError(400, "Request body must be valid JSON.", "bad_json");

  const parsed = chatBodySchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonError(400, "Invalid request.", "bad_input", parsed.error.flatten());
  }

  // Sign-in is optional: signed-in users get saved history, guests chat freely (rate-limited by IP).
  const supabase = createClient();
  const user = supabase ? (await supabase.auth.getUser().catch(() => ({ data: { user: null } }))).data.user : null;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  const limit = checkRateLimit(`chat:${user?.id ?? ip}`, 20, 60_000);
  if (!limit.allowed) {
    return jsonError(
      429,
      "You're asking very quickly. Give the guide a moment and try again.",
      "rate_limited",
      undefined,
      { "Retry-After": String(limit.retryAfterSeconds) },
    );
  }

  const { slug, messages, language } = parsed.data;
  const destination = await resolveDestination(slug);
  if (!destination) return jsonError(400, "Unknown destination.", "bad_input");

  // No key configured: fall back to the offline guide instead of an error.
  const demoMode = !isMetaConfigured();

  // RT-4: inject live weather + local time before the model call.
  const liveContext = await getLiveContext(destination);
  void publishContext(slug, liveContext);

  const systemPrompt = buildGuidePrompt(destination, liveContext, language ?? "en");
  const lastMessage = messages[messages.length - 1];
  const sessionPromise =
    lastMessage && supabase && user
      ? persistUserMessage(supabase, user.id, slug, lastMessage.content)
      : Promise.resolve(null);

  const lastText = lastMessage?.content ?? "";
  let upstream: ReadableStream<Uint8Array>;
  let usedFallback = false;
  try {
    upstream = demoMode
      ? createDemoStream(destination, liveContext, lastText, request.signal, "(Offline guide: add MODEL_API_KEY to .env.local for full Meta Muse answers.)")
      : await createChatStream({
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.slice(-MAX_HISTORY_FOR_MODEL).map(toParam),
          ],
          signal: request.signal,
        });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    const info = logAiError("chat", error);
    if (info.status === 429 && process.env.AI_STRICT === "true") {
      return jsonError(429, info.message, "upstream_error");
    }
    // Never leave the traveler with an error: answer from local knowledge and say why.
    usedFallback = true;
    upstream = createDemoStream(
      destination,
      liveContext,
      lastText,
      request.signal,
      `(Offline guide: the Meta AI service didn't respond, so this answer comes from local data. ${info.message})`,
    );
  }

  // Pass tokens straight through while collecting the full reply to save to history.
  const decoder = new TextDecoder();
  let fullReply = "";
  const collector = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      fullReply += decoder.decode(chunk, { stream: true });
      controller.enqueue(chunk);
    },
    async flush() {
      fullReply += decoder.decode();
      const sessionId = await Promise.race([
        sessionPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);
      if (supabase) await persistAssistantMessage(supabase, sessionId, fullReply);
    },
  });

  return new Response(upstream.pipeThrough(collector), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
      "X-Guide-Mode": demoMode ? "offline" : usedFallback ? "fallback" : "ai",
    },
  });
}
