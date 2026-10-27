import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { z } from "zod";
import { checkRateLimit, getAuthedUser, jsonError, readJson } from "@/lib/api-utils";
import { createDemoStream } from "@/lib/demo-guide";
import { createChatStream, isMetaConfigured, MissingApiKeyError } from "@/lib/meta-client";
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

  const auth = await getAuthedUser();
  if (!auth.ok) return auth.response;

  const limit = checkRateLimit(`chat:${auth.user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return jsonError(
      429,
      "You're asking very quickly. Give the guide a moment and try again.",
      "rate_limited",
      undefined,
      { "Retry-After": String(limit.retryAfterSeconds) },
    );
  }

  const { slug, messages } = parsed.data;
  const destination = await resolveDestination(slug);
  if (!destination) return jsonError(400, "Unknown destination.", "bad_input");

  const demoMode = !isMetaConfigured() && process.env.DEMO_MODE === "true";
  if (!isMetaConfigured() && !demoMode) {
    return jsonError(
      500,
      "The AI guide isn't configured yet. Add MODEL_API_KEY to the server environment.",
      "missing_api_key",
    );
  }

  // RT-4: inject live weather + local time before the model call.
  const liveContext = await getLiveContext(destination);
  void publishContext(slug, liveContext);

  const systemPrompt = buildGuidePrompt(destination, liveContext);
  const lastMessage = messages[messages.length - 1];
  const sessionPromise = lastMessage
    ? persistUserMessage(auth.supabase, auth.user.id, slug, lastMessage.content)
    : Promise.resolve(null);

  let upstream: ReadableStream<Uint8Array>;
  try {
    upstream = demoMode
      ? createDemoStream(destination, liveContext, lastMessage?.content ?? "", request.signal)
      : await createChatStream({
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.slice(-MAX_HISTORY_FOR_MODEL).map(toParam),
          ],
          signal: request.signal,
        });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return jsonError(500, "The AI guide isn't configured yet.", "missing_api_key");
    }
    return jsonError(
      500,
      "The guide couldn't be reached right now. Please try again in a moment.",
      "upstream_error",
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
      const sessionId = await sessionPromise;
      await persistAssistantMessage(auth.supabase, sessionId, fullReply);
    },
  });

  return new Response(upstream.pipeThrough(collector), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
