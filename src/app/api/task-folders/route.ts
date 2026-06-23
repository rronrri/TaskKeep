import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";

const folderSchema = z.object({ name: z.string().trim().min(1, "Escribe un nombre").max(80), parent_id: z.string().uuid().nullable().optional() });

export async function GET() {
  const auth = await requireApiUser(["manager", "collaborator"]);
  if (auth.error) return auth.error;
  const { data, error } = await createAdminClient().from("task_folders").select("id,name,parent_id,created_by,created_at,updated_at").eq("company_id", auth.user.companyId!).order("name");
  if (error) return apiError(error);
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireApiUser(["manager", "collaborator"]);
  if (auth.error) return auth.error;
  try {
    const input = folderSchema.parse(await request.json());
    const supabase = createAdminClient();
    if (input.parent_id) {
      const { data: parent } = await supabase.from("task_folders").select("id").eq("id", input.parent_id).eq("company_id", auth.user.companyId!).maybeSingle();
      if (!parent) return NextResponse.json({ error: "La carpeta superior no existe" }, { status: 404 });
    }
    const { data, error } = await supabase.from("task_folders").insert({ company_id: auth.user.companyId, parent_id: input.parent_id ?? null, created_by: auth.user.id, name: input.name }).select("id,name,parent_id,created_by,created_at,updated_at").single();
    if (error?.code === "23505") return NextResponse.json({ error: "Ya existe una carpeta con ese nombre en esta ubicación" }, { status: 409 });
    if (error) throw error;
    await writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "task_folder.created", entityType: "task_folder", entityId: data.id, metadata: { name: data.name, parentId: data.parent_id } });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
