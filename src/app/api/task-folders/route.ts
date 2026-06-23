import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";

const folderSchema = z.object({ name: z.string().trim().min(1, "Escribe un nombre").max(80), parent_id: z.string().uuid().nullable().optional() });
const deleteFolderSchema = z.object({ id: z.string().uuid() });
const restoreFolderSchema = z.object({
  folders: z.array(z.object({ id: z.string().uuid(), name: z.string(), parent_id: z.string().uuid().nullable(), created_by: z.string().uuid().nullable().optional(), created_at: z.string().optional(), updated_at: z.string().optional() })),
  tasks: z.array(z.object({ id: z.string().uuid(), folder_id: z.string().uuid().nullable() })),
});

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
    if (error?.code === "23505") return NextResponse.json({ error: "Ya existe una carpeta con ese nombre en esta ubicacion" }, { status: 409 });
    if (error) throw error;
    await writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "task_folder.created", entityType: "task_folder", entityId: data.id, metadata: { name: data.name, parentId: data.parent_id } });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser(["manager", "collaborator"]);
  if (auth.error) return auth.error;
  try {
    const input = restoreFolderSchema.parse(await request.json());
    const supabase = createAdminClient();
    const folders = input.folders.map((folder) => ({
      id: folder.id,
      company_id: auth.user.companyId,
      parent_id: folder.parent_id,
      created_by: folder.created_by ?? auth.user.id,
      name: folder.name,
      created_at: folder.created_at,
      updated_at: new Date().toISOString(),
    }));
    if (folders.length > 0) {
      const { error } = await supabase.from("task_folders").upsert(folders, { onConflict: "id" });
      if (error) throw error;
    }
    const restoreResults = await Promise.all(input.tasks.map(({ id, folder_id }) => supabase.from("tasks").update({ folder_id, deleted_at: null, updated_at: new Date().toISOString() }).eq("id", id).eq("company_id", auth.user.companyId!)));
    for (const result of restoreResults) if (result.error) throw result.error;
    await writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "task_folder.restored", entityType: "task_folder", entityId: input.folders[0]?.id, metadata: { folders: input.folders.length, tasks: input.tasks.length } });
    const { data } = await supabase.from("task_folders").select("id,name,parent_id,created_by,created_at,updated_at").eq("company_id", auth.user.companyId!).order("name");
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser(["manager", "collaborator"]);
  if (auth.error) return auth.error;
  try {
    const input = deleteFolderSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: allFolders, error: foldersError } = await supabase.from("task_folders").select("id,name,parent_id,created_by,created_at,updated_at").eq("company_id", auth.user.companyId!);
    if (foldersError) throw foldersError;
    const folder = (allFolders ?? []).find((item) => item.id === input.id);
    if (!folder) return NextResponse.json({ error: "Carpeta no encontrada" }, { status: 404 });

    const folderIds = collectDescendantIds(allFolders ?? [], input.id);
    const { data: taskRows, error: tasksError } = await supabase.from("tasks").select("id,folder_id").eq("company_id", auth.user.companyId!).in("folder_id", folderIds).is("deleted_at", null);
    if (tasksError) throw tasksError;
    const snapshot = { folders: (allFolders ?? []).filter((item) => folderIds.includes(item.id)), tasks: taskRows ?? [] };

    if (taskRows?.length) {
      const { error } = await supabase.from("tasks").update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("company_id", auth.user.companyId!).in("folder_id", folderIds).is("deleted_at", null);
      if (error) throw error;
    }
    const { error } = await supabase.from("task_folders").delete().eq("id", input.id).eq("company_id", auth.user.companyId!);
    if (error) throw error;
    await writeAudit({ actorId: auth.user.id, companyId: auth.user.companyId, action: "task_folder.deleted", entityType: "task_folder", entityId: input.id, metadata: { name: folder.name, deletedFolders: snapshot.folders.length, deletedTasks: snapshot.tasks.length } });
    return NextResponse.json({ data: { id: input.id, deleted_folder_ids: folderIds, snapshot } });
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

