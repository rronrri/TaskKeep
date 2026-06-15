import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const auth = await requireApiUser(["admin"]);
  if (auth.error) return auth.error;
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const size = 20;
  let query = createAdminClient()
    .from("audit_logs")
    .select("id,action,entity_type,entity_id,metadata,created_at,actor:users(full_name,email),company:companies!audit_logs_company_id_fkey(name)", { count: "exact" });
  const action = url.searchParams.get("action");
  if (action) query = query.eq("action", action);
  const { data, count, error } = await query.order("created_at", { ascending: false }).range((page - 1) * size, page * size - 1);
  if (error) return apiError(error);
  return NextResponse.json({ data, pagination: { page, size, total: count ?? 0 } });
}
