import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuthedUser, jsonError } from "@/lib/api-utils";
import { favoriteIdParamSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const parsed = favoriteIdParamSchema.safeParse(params);
  if (!parsed.success) return jsonError(400, "Invalid favorite id.", "bad_input");

  const auth = await getAuthedUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("favorites")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", auth.user.id)
    .select("id");

  if (error) return jsonError(500, "Couldn't remove this favorite.", "db_error");
  if (!data || data.length === 0) return jsonError(404, "Favorite not found.", "not_found");

  return NextResponse.json({ ok: true });
}
