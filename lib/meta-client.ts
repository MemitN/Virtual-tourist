import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

/*
  Provider layer for Meta's Muse models.

  Works with just ONE key in MODEL_API_KEY. The server works out the rest and falls back
  automatically, in this order:

    1. Meta Model API   https://api.meta.ai/v1   muse-spark-1.3 -> 1.2 -> 1.1   (chat completions)
    2. Meta Model API   https://api.meta.ai/v1/responses                          (Responses API)
    3. Baseten          https://inference.baseten.co/v1   meta-models/muse-spark-open (hackathon credits)

  Keys that start with "b10" are tried on Baseten first. You may also set META_API_KEY and
  BASETEN_API_KEY separately to enable both providers at once.

  Force a single host/model (no fallback): MODEL_BASE_URL + MODEL_CHAT_NAME.
  Separate image host/key: IMAGE_BASE_URL / IMAGE_API_KEY.
  Open /api/health in dev to see exactly which candidate answered and why others failed.
*/

// The *_API_BASE overrides exist for local testing against a mock server.
export const META_BASE_URL = process.env.META_API_BASE?.trim() || "https://api.meta.ai/v1";
export const BASETEN_BASE_URL = process.env.BASETEN_API_BASE?.trim() || "https://inference.baseten.co/v1";

export const MODELS = {
  chat: "muse-spark-1.3",
  chatFallbacks: ["muse-spark-1.2", "muse-spark-1.1"],
  chatBaseten: "meta-models/muse-spark-open",
  planner: "muse-spark-1.3",
  image: "muse-image-1.0",
  segment: "sam-3.1",
} as const;

type Api = "chat" | "responses";
type Scheme = "Bearer" | "Api-Key";

export interface Candidate {
  /** Short label for logs and /api/health. */
  label: string;
  provider: "meta" | "baseten" | "custom";
  baseURL: string;
  model: string;
  api: Api;
  scheme: Scheme;
  key: string;
}

const env = (name: string): string => process.env[name]?.trim() ?? "";

export class MissingApiKeyError extends Error {
  constructor() {
    super("MODEL_API_KEY is not configured");
    this.name = "MissingApiKeyError";
  }
}

export function isMetaConfigured(): boolean {
  return Boolean(env("MODEL_API_KEY") || env("META_API_KEY") || env("BASETEN_API_KEY"));
}

export function getApiKey(): string {
  const key = env("META_API_KEY") || env("MODEL_API_KEY") || env("BASETEN_API_KEY");
  if (!key) throw new MissingApiKeyError();
  return key;
}

// Shared across route bundles in one server process, so the first success benefits every route.
const shared_ = globalThis as unknown as { __vtResolved?: Candidate | null };
let resolved: Candidate | null = shared_.__vtResolved ?? null;

/** Every provider/model combination worth trying, best guess first. */
export function candidates(): Candidate[] {
  const shared = env("MODEL_API_KEY");
  const metaKey = env("META_API_KEY") || shared;
  const basetenKey = env("BASETEN_API_KEY") || shared;
  const modelOverride = env("MODEL_CHAT_NAME");

  const customUrl = env("MODEL_BASE_URL");
  if (customUrl) {
    const key = shared || metaKey || basetenKey;
    if (!key) return [];
    const isBaseten = customUrl.includes("baseten");
    return [
      {
        label: `custom ${customUrl}`,
        provider: "custom",
        baseURL: customUrl.replace(/\/+$/, ""),
        model: modelOverride || (isBaseten ? MODELS.chatBaseten : MODELS.chat),
        api: "chat",
        scheme: "Bearer",
        key,
      },
    ];
  }

  const meta: Candidate[] = [];
  if (metaKey) {
    const models = [...new Set([modelOverride || MODELS.chat, MODELS.chat, ...MODELS.chatFallbacks])];
    for (const model of models) {
      meta.push({ label: `Meta ${model}`, provider: "meta", baseURL: META_BASE_URL, model, api: "chat", scheme: "Bearer", key: metaKey });
    }
    meta.push({ label: `Meta ${models[0]} (Responses API)`, provider: "meta", baseURL: META_BASE_URL, model: models[0]!, api: "responses", scheme: "Bearer", key: metaKey });
  }

  const baseten: Candidate[] = [];
  if (basetenKey) {
    const model = modelOverride && modelOverride.includes("/") ? modelOverride : MODELS.chatBaseten;
    const stripped = basetenKey.replace(/^b10[_-]/i, "");
    baseten.push({ label: "Baseten muse-spark-open", provider: "baseten", baseURL: BASETEN_BASE_URL, model, api: "chat", scheme: "Bearer", key: basetenKey });
    baseten.push({ label: "Baseten muse-spark-open (Api-Key header)", provider: "baseten", baseURL: BASETEN_BASE_URL, model, api: "chat", scheme: "Api-Key", key: basetenKey });
    if (stripped !== basetenKey) {
      baseten.push({ label: "Baseten muse-spark-open (key without b10_ prefix)", provider: "baseten", baseURL: BASETEN_BASE_URL, model, api: "chat", scheme: "Bearer", key: stripped });
    }
  }

  const looksBaseten = /^b10[_-]/i.test(shared) && !env("META_API_KEY");
  const ordered = looksBaseten ? [...baseten, ...meta] : [...meta, ...baseten];
  if (resolved) {
    const known = resolved;
    const idx = ordered.findIndex((c) => c.label === known.label);
    if (idx > 0) ordered.unshift(...ordered.splice(idx, 1));
  }
  return ordered;
}

export function getChatBaseUrl(): string {
  return candidates()[0]?.baseURL ?? META_BASE_URL;
}

export function getChatModel(): string {
  return candidates()[0]?.model ?? MODELS.chat;
}

/* ------------------------------------------------------------------ errors */

export class AiHttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AiHttpError";
  }
}

function statusOf(error: unknown): number | undefined {
  if (error instanceof AiHttpError) return error.status;
  return typeof error === "object" && error !== null && "status" in error
    ? (error as { status?: number }).status
    : undefined;
}

export interface AiErrorInfo {
  status?: number;
  /** Short, user-safe explanation. */
  message: string;
  /** Raw upstream text, for the server log and dev diagnostics. */
  raw: string;
}

/** Turns any upstream failure into something a person can act on. */
export function describeAiError(error: unknown): AiErrorInfo {
  const status = statusOf(error);
  const raw = error instanceof Error ? error.message : String(error);
  const base = status !== undefined ? { status, raw } : { raw };
  if (status === 401 || status === 403) {
    return {
      ...base,
      message:
        "The AI provider rejected the API key. Meta's Model API public preview may be limited to the US; if so use a Baseten key (MODEL_API_KEY) instead. Run `node scripts/test-key.mjs` or open /api/health for details.",
    };
  }
  if (status === 404) return { ...base, message: "The AI provider doesn't know that model. Check MODEL_CHAT_NAME / MODEL_BASE_URL in .env.local." };
  if (status === 429) return { ...base, message: "The AI provider is rate-limiting or out of credits. Try again in a minute." };
  if (status !== undefined && status >= 500) return { ...base, message: "The AI provider had a hiccup. Please try again." };
  if (/timed? ?out|aborted|ETIMEDOUT|TimeoutError/i.test(raw)) return { ...base, message: "The AI provider took too long to answer. Please try again." };
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|fetch failed|Connection error|EAI_AGAIN/i.test(raw)) {
    return { ...base, message: "Couldn't reach the AI provider from this computer. Check your internet connection or firewall." };
  }
  return { ...base, message: "The AI guide couldn't answer right now. Please try again." };
}

/** Server log + optional dev-only details for a failed AI call. */
export function logAiError(scope: string, error: unknown): AiErrorInfo {
  const info = describeAiError(error);
  console.error(`[ai:${scope}] ${info.status ?? "ERR"} ${info.raw}`);
  return info;
}

/* ------------------------------------------------------------------ transport */

interface CallOptions {
  messages: ChatCompletionMessageParam[];
  signal?: AbortSignal | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
}

type Variant = "standard" | "compat";

function authHeader(c: Candidate): string {
  return c.scheme === "Bearer" ? `Bearer ${c.key}` : `Api-Key ${c.key}`;
}

function messageText(m: ChatCompletionMessageParam): string {
  return typeof m.content === "string" ? m.content : "";
}

async function send(
  c: Candidate,
  options: CallOptions,
  stream: boolean,
  variant: Variant,
  timeoutMs: number,
): Promise<Response> {
  const maxTokens = options.maxTokens ?? 1200;
  let url: string;
  let body: Record<string, unknown>;

  if (c.api === "responses") {
    url = `${c.baseURL}/responses`;
    const system = options.messages.filter((m) => m.role === "system").map(messageText).join("\n\n");
    body = {
      model: c.model,
      ...(system ? { instructions: system } : {}),
      input: options.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: messageText(m) })),
      max_output_tokens: maxTokens,
      ...(variant === "standard" ? { temperature: options.temperature ?? 0.6 } : {}),
    };
  } else {
    url = `${c.baseURL}/chat/completions`;
    body = {
      model: c.model,
      messages: options.messages,
      stream,
      ...(variant === "standard"
        ? { temperature: options.temperature ?? 0.6, max_tokens: maxTokens }
        : { max_completion_tokens: maxTokens }),
    };
  }

  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader(c), Accept: stream ? "text/event-stream" : "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code;
    const msg = error instanceof Error ? error.message : String(error);
    throw new AiHttpError(code ? `${msg} (${code})` : msg);
  }
  if (!response.ok) {
    const text = (await response.text().catch(() => "")).slice(0, 400).replace(/\s+/g, " ");
    throw new AiHttpError(`HTTP ${response.status} ${text}`, response.status);
  }
  return response;
}

/** Removes hidden reasoning that some models inline in the answer. */
export function stripThinking(text: string): string {
  return text
    .replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, "")
    .replace(/^[\s\S]*?<\/(think|thinking|reasoning)>/i, (m) => (/<(think|thinking|reasoning)>/i.test(m) ? m : ""))
    .trim();
}

function textFromResponses(json: unknown): string {
  const j = json as {
    output_text?: unknown;
    output?: { content?: { text?: unknown }[] }[];
  };
  if (typeof j.output_text === "string") return j.output_text;
  const parts: string[] = [];
  for (const item of j.output ?? []) {
    for (const c of item.content ?? []) if (typeof c.text === "string") parts.push(c.text);
  }
  return parts.join("");
}

function textFromChat(json: unknown): string {
  const j = json as { choices?: { message?: { content?: unknown } }[] };
  const content = j.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((p) => (typeof (p as { text?: unknown }).text === "string" ? (p as { text: string }).text : "")).join("");
  }
  return "";
}

/**
 * Runs `fn` against each candidate until one works. A rejected key skips that provider's remaining
 * models, a network failure skips the whole host, a bad model name moves to the next model, and a
 * 400 is retried once with a more conservative parameter set.
 */
async function withCandidates<T>(fn: (c: Candidate, variant: Variant) => Promise<T>): Promise<T> {
  const list = candidates();
  if (list.length === 0) throw new MissingApiKeyError();
  const deadAuth = new Set<string>();
  const deadHosts = new Set<string>();
  let firstError: unknown = null;

  for (const c of list) {
    if (deadHosts.has(c.baseURL) || deadAuth.has(`${c.baseURL}|${c.scheme}|${c.key}`)) continue;
    for (const variant of ["standard", "compat"] as const) {
      try {
        const result = await fn(c, variant);
        resolved = c;
        shared_.__vtResolved = c;
        return result;
      } catch (error) {
        if (firstError === null) firstError = error;
        const status = statusOf(error);
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[ai] ${c.label} (${variant}) failed: ${status ?? "network"} ${message}`);
        if (error instanceof Error && error.name === "AbortError") throw error;
        if (status === 400 && variant === "standard") continue; // retry with conservative params
        if (status === 401 || status === 403) deadAuth.add(`${c.baseURL}|${c.scheme}|${c.key}`);
        else if (status === undefined) deadHosts.add(c.baseURL);
        break;
      }
    }
  }
  throw firstError ?? new Error("No AI provider available");
}

/* ------------------------------------------------------------------ public API */

/** Single non-streamed completion, used for explanations, translations and trip planning. */
export async function completeChat(options: CallOptions): Promise<string> {
  const raw = await withCandidates(async (c, variant) => {
    const response = await send(c, options, false, variant, 60_000);
    const json: unknown = await response.json();
    const text = c.api === "responses" ? textFromResponses(json) : textFromChat(json);
    if (!stripThinking(text)) throw new AiHttpError("The model returned an empty answer", 502);
    return text;
  });
  return stripThinking(raw);
}

/** Incrementally drops <think>…</think> blocks from streamed text. */
function createThinkFilter(): { push: (chunk: string) => string; flush: () => string } {
  const OPEN = /<(think|thinking|reasoning)>/i;
  let inside: string | null = null;
  let buffer = "";
  return {
    push(chunk) {
      buffer += chunk;
      let out = "";
      for (;;) {
        if (inside) {
          const close = buffer.toLowerCase().indexOf(`</${inside}>`);
          if (close === -1) {
            buffer = buffer.slice(Math.max(0, buffer.length - (inside.length + 3)));
            return out;
          }
          buffer = buffer.slice(close + inside.length + 3);
          inside = null;
          continue;
        }
        const open = OPEN.exec(buffer);
        if (open) {
          out += buffer.slice(0, open.index);
          buffer = buffer.slice(open.index + open[0].length);
          inside = open[1]!.toLowerCase();
          continue;
        }
        const lt = buffer.lastIndexOf("<");
        if (lt !== -1 && buffer.length - lt < 12) {
          out += buffer.slice(0, lt);
          buffer = buffer.slice(lt);
        } else {
          out += buffer;
          buffer = "";
        }
        return out;
      }
    },
    flush() {
      const rest = inside ? "" : buffer;
      buffer = "";
      return rest;
    },
  };
}

/**
 * Opens a streamed completion and exposes it as a plain-text byte stream. The upstream request is
 * awaited first so HTTP-level failures (bad key, rate limit) throw here and the route can react
 * instead of returning a broken 200 stream.
 */
export async function createChatStream(options: CallOptions): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();

  const { response, candidate } = await withCandidates(async (c, variant) => {
    if (c.api === "responses") {
      const r = await send(c, options, false, variant, 60_000);
      return { response: r, candidate: c };
    }
    const r = await send(c, options, true, variant, 60_000);
    if (!r.body) throw new AiHttpError("The AI provider sent no stream", 502);
    return { response: r, candidate: c };
  });

  // Responses API fallback: not streamed upstream, so emit the finished answer in small pieces.
  if (candidate.api === "responses") {
    const text = stripThinking(textFromResponses(await response.json()));
    if (!text) throw new AiHttpError("The model returned an empty answer", 502);
    const pieces = text.split(/(?<=\s)/);
    let i = 0;
    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (i >= pieces.length) return controller.close();
        await new Promise((r) => setTimeout(r, 12));
        controller.enqueue(encoder.encode(pieces[i++] ?? ""));
      },
    });
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const filter = createThinkFilter();
  let pending = "";
  let finished = false;

  const take = (line: string): string => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return "";
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") {
      if (data === "[DONE]") finished = true;
      return "";
    }
    try {
      const json = JSON.parse(data) as { choices?: { delta?: { content?: unknown } }[] };
      const delta = json.choices?.[0]?.delta?.content;
      return typeof delta === "string" ? filter.push(delta) : "";
    } catch {
      return "";
    }
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        for (;;) {
          if (finished) {
            const tail = filter.flush();
            if (tail) controller.enqueue(encoder.encode(tail));
            controller.close();
            return;
          }
          const { value, done } = await reader.read();
          if (done) {
            let out = pending ? take(pending) : "";
            out += filter.flush();
            if (out) controller.enqueue(encoder.encode(out));
            controller.close();
            return;
          }
          pending += decoder.decode(value, { stream: true });
          const lines = pending.split("\n");
          pending = lines.pop() ?? "";
          let out = "";
          for (const line of lines) out += take(line);
          if (out) {
            controller.enqueue(encoder.encode(out));
            return;
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      void reader.cancel().catch(() => undefined);
    },
  });
}

/* ------------------------------------------------------------------ diagnostics */

export interface ProbeResult {
  label: string;
  ok: boolean;
  status: number | null;
  ms: number;
  detail: string;
}

/** Tries every candidate once (no early exit) so /api/health can show what works and what doesn't. */
export async function probeCandidates(): Promise<{ results: ProbeResult[]; metaModels: string[] }> {
  const results: ProbeResult[] = [];
  for (const c of candidates()) {
    const started = Date.now();
    try {
      const response = await send(c, { messages: [{ role: "user", content: "Reply with the single word: pong" }], maxTokens: 30, temperature: 0 }, false, "standard", 25_000);
      const json: unknown = await response.json();
      const text = stripThinking(c.api === "responses" ? textFromResponses(json) : textFromChat(json));
      results.push({ label: c.label, ok: true, status: response.status, ms: Date.now() - started, detail: text.slice(0, 60) });
    } catch (error) {
      results.push({ label: c.label, ok: false, status: statusOf(error) ?? null, ms: Date.now() - started, detail: (error instanceof Error ? error.message : String(error)).slice(0, 200) });
    }
  }

  let metaModels: string[] = [];
  const metaKey = env("META_API_KEY") || env("MODEL_API_KEY");
  if (metaKey && !env("MODEL_BASE_URL")) {
    try {
      const res = await fetch(`${META_BASE_URL}/models`, { headers: { Authorization: `Bearer ${metaKey}` }, signal: AbortSignal.timeout(15_000) });
      if (res.ok) {
        const json = (await res.json()) as { data?: { id?: string }[] };
        metaModels = (json.data ?? []).map((m) => m.id ?? "").filter(Boolean).slice(0, 40);
      }
    } catch {
      /* listing is optional */
    }
  }
  return { results, metaModels };
}

/* ------------------------------------------------------------------ images */

export type GeneratedImage = { kind: "b64"; data: string } | { kind: "url"; url: string };

let imageClient: OpenAI | null = null;
function getImageClient(): OpenAI {
  if (!imageClient) {
    imageClient = new OpenAI({
      apiKey: env("IMAGE_API_KEY") || getApiKey(),
      baseURL: env("IMAGE_BASE_URL") || META_BASE_URL,
      maxRetries: 1,
      timeout: 120_000,
    });
  }
  return imageClient;
}

/** Panorama generation via muse-image-1.0 (widest landscape size the SDK types allow). */
export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const response = await getImageClient().images.generate({
    model: MODELS.image,
    prompt,
    n: 1,
    size: "1792x1024",
    response_format: "b64_json",
  });
  const item = response.data?.[0];
  if (item?.b64_json) return { kind: "b64", data: item.b64_json };
  if (item?.url) return { kind: "url", url: item.url };
  throw new Error("Image model returned no image");
}
