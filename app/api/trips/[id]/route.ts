import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUser, jsonError } from "@/lib/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idSchema = z.object({ id: z.string().uuid() });

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const parsed = idSchema.safeParse(params);
  if (!parsed.success) return jsonError(400, "Invalid trip id.", "bad_input");

  const auth = await getAuthedUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("saved_trips")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", auth.user.id)
    .select("id");
  if (error) return jsonError(500, "Couldn't delete this trip.", "db_error");
  if (!data || data.length === 0) return jsonError(404, "Trip not found.", "not_found");
  return NextResponse.json({ ok: true });
}
