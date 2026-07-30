import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { resolveTeamIds } from "@/lib/tasks/team-scope";

type Context = { params: Promise<{ id: string }> };
const moveSchema = z.object({ parent_id: z.string().uuid().nullable() });

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiUser(["manager", "collaborator"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await context.params;
    const { parent_id } = moveSchema.parse(await request.json());
    const supabase = createAdminClient();
    const teamIds = await resolveTeamIds(supabase, auth.user.id, auth.user.role as "manager" | "collaborator");
    const { data: allFolders, error: foldersError } = await supabase.from("task_folders").select("id,name,parent_id,created_by").eq("company_id", auth.user.companyId!).in("created_by", teamIds);
    if (foldersError) throw foldersError;
    const folder = (allFolders ?? []).find((item) => item.id === id);
    if (!folder) return NextResponse.json({ error: "Carpeta no encontrada" }, { status: 404 });
    if (parent_id) {
      const parent = (allFolders ?? []).find((item) => item.id === parent_id);
      if (!parent) return NextResponse.json({ error: "La carpeta destino no existe" }, { status: 404 });
      if (collectDescendantIds(allFolders ?? [], id).includes(parent_id)) {
        return NextResponse.json({ error: "No puedes mover una carpeta dentro de sí misma" }, { status: 409 });
      }
    }
    const { data, error } = await supabase
      .from("task_folders")
      .update({ parent_id, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", auth.user.companyId!)
      .select("id,name,parent_id,created_by,created_at,updated_at")
      .single();
    if (error?.code === "23505") return NextResponse.json({ error: "Ya existe una carpeta con ese nombre en esa ubicación" }, { status: 409 });
    if (error) throw error;
    await writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "task_folder.moved", entityType: "task_folder", entityId: id, metadata: { name: folder.name, parentId: parent_id } });
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}

function collectDescendantIds(folders: Array<{ id: string; parent_id: string | null }>, rootId: string) {
  const ids = [rootId];
  for (let index = 0; index < ids.length; index += 1) {
    const current = ids[index];
    for (const folder of folders) if (folder.parent_id === current) ids.push(folder.id);
  }
  return ids;
}
