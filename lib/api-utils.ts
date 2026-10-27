import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { ApiErrorBody } from "@/lib/types";

export function jsonError(
  status: number,
  error: string,
  code?: string,
  details?: unknown,
  headers?: Record<string, string>,
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = { error };
  if (code) body.code = code;
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status, ...(headers ? { headers } : {}) });
}

export async function readJson(
  request: Request,
): Promise<{ ok: true; data: unknown } | { ok: false }> {
  try {
    const data: unknown = await request.json();
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

export type AuthResult =
  | { ok: true; supabase: SupabaseClient; user: User }
  | { ok: false; response: NextResponse<ApiErrorBody> };

/** Resolves the signed-in user from cookies. 503 if Supabase isn't configured, 401 if signed out. */
export async function getAuthedUser(): Promise<AuthResult> {
  const supabase = createClient();
  if (!supabase) {
    return {
      ok: false,
      response: jsonError(
        503,
        "Sign-in isn't configured on this deployment yet.",
        "supabase_not_configured",
      ),
    };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: jsonError(401, "Please sign in to continue.", "unauthenticated"),
    };
  }
  return { ok: true, supabase, user };
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Small in-memory limiter to protect model credits. On serverless each instance
 * keeps its own counters, so treat it as a best-effort guard, not a hard quota.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  if (buckets.size > 1000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  bucket.count += 1;
  return {
    allowed: bucket.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}
