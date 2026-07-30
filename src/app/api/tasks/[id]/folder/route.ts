import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { resolveTeamIds } from "@/lib/tasks/team-scope";

type Context = { params: Promise<{ id: string }> };
const moveSchema = z.object({ folder_id: z.string().uuid().nullable() });

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiUser(["manager", "collaborator"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const { folder_id } = moveSchema.parse(await request.json());
    const supabase = createAdminClient();
    const teamIds = await resolveTeamIds(supabase, auth.user.id, auth.user.role as "manager" | "collaborator");
    if (folder_id) {
      const { data: folder } = await supabase.from("task_folders").select("id,created_by").eq("id", folder_id).eq("company_id", auth.user.companyId!).maybeSingle();
      if (!folder || !folder.created_by || !teamIds.includes(folder.created_by)) {
        return NextResponse.json({ error: "Carpeta no encontrada" }, { status: 404 });
      }
    }
    let query = supabase.from("tasks").update({ folder_id, updated_at: new Date().toISOString() }).eq("id", id).eq("company_id", auth.user.companyId!).is("deleted_at", null);
    if (auth.user.role === "collaborator") query = query.eq("created_by", auth.user.id).eq("responsible_id", auth.user.id);
    if (auth.user.role === "manager") query = query.in("responsible_id", teamIds);
    const { data, error } = await query.select("id,folder_id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "No se puede mover esta tarea" }, { status: 403 });
    await writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "task.folder_changed", entityType: "task", entityId: id, metadata: { folderId: folder_id } });
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
