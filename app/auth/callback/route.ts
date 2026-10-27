import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({
  code: z.string().min(1).optional(),
  token_hash: z.string().min(1).optional(),
  type: z
    .enum(["magiclink", "email", "signup", "recovery", "invite", "email_change"])
    .optional(),
  next: z.string().max(512).optional(),
});

/** Only allow same-site relative paths to prevent open redirects. */
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/";
  }
  return next;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;

  const parsed = querySchema.safeParse({
    code: searchParams.get("code") ?? undefined,
    token_hash: searchParams.get("token_hash") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    next: searchParams.get("next") ?? undefined,
  });

  const failure = NextResponse.redirect(`${origin}/?auth=error`);
  if (!parsed.success) return failure;

  const { code, token_hash, type, next } = parsed.data;
  const supabase = createClient();
  if (!supabase) return failure;

  // PKCE magic link flow (default): ?code=...
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? failure : NextResponse.redirect(`${origin}${safeNext(next)}`);
  }

  // Email-template flow: ?token_hash=...&type=magiclink
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    return error ? failure : NextResponse.redirect(`${origin}${safeNext(next)}`);
  }

  return failure;
}
