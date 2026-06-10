import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { taskSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.error) return auth.error;
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const size = Math.min(50, Math.max(1, Number(url.searchParams.get("size") ?? 20)));
  const supabase = createAdminClient();
  let query = supabase
    .from("tasks")
    .select("*, responsible:users!tasks_responsible_id_fkey(full_name,email)", { count: "exact" })
    .is("deleted_at", null);
  if (auth.user.role !== "admin") query = query.eq("company_id", auth.user.companyId!);
  if (auth.user.role === "collaborator") query = query.eq("responsible_id", auth.user.id);
  for (const key of ["status", "priority", "responsible_id"] as const) {
    const value = url.searchParams.get(key);
    if (value) query = query.eq(key, value);
  }
  if (url.searchParams.get("pinned") === "true") query = query.eq("is_pinned", true);
  const { data, count, error } = await query
    .order("is_pinned", { ascending: false })
    .order("deadline", { ascending: true })
    .range((page - 1) * size, page * size - 1);
  if (error) return apiError(error);
  return NextResponse.json({ data, pagination: { page, size, total: count ?? 0 } });
}

export async function POST(request: Request) {
  const auth = await requireApiUser(["manager"]);
  if (auth.error) return auth.error;
  try {
    const input = taskSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: responsible } = await supabase
      .from("users")
      .select("id")
      .eq("id", input.responsible_id)
      .eq("company_id", auth.user.companyId!)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (!responsible) return NextResponse.json({ error: "Responsable no válido" }, { status: 400 });
    const { data, error } = await supabase
      .from("tasks")
      .insert({ ...input, company_id: auth.user.companyId, created_by: auth.user.id })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
