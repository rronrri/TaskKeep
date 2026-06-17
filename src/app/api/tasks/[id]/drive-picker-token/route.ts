import { NextResponse } from "next/server";
import { apiError, requireApiUser } from "@/lib/api";
import { getGoogleAccessToken } from "@/lib/google-drive/oauth";
import { createAdminClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const auth = await requireApiUser(["manager", "collaborator"]);
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    let query = supabase
      .from("tasks")
      .select("id,company:companies!inner(drive_folder_id,drive_owner_user_id)")
      .eq("id", id)
      .eq("company_id", auth.user.companyId!)
      .is("deleted_at", null);

    if (auth.user.role === "collaborator") query = query.eq("responsible_id", auth.user.id);

    const { data: task, error } = await query.maybeSingle();
    if (error) throw error;
    if (!task) return NextResponse.json({ error: "Tarea no encontrada o no asignada" }, { status: 404 });

    const company = Array.isArray(task.company) ? task.company[0] : task.company;
    if (!company?.drive_folder_id || !company.drive_owner_user_id) {
      return NextResponse.json({ error: "El/la gestor/a debe conectar Google Drive y configurar una carpeta raiz" }, { status: 409 });
    }

    return NextResponse.json({ access_token: await getGoogleAccessToken(company.drive_owner_user_id) });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return apiError(error);
  }
}
